import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  db,
  OperationType,
  handleFirestoreError,
  signInWithGoogle,
  signOutGoogle,
  subscribeAuth,
  updatePreferredCharacter,
} from '../firebase.ts';
import {
  FirebaseRoomSummary,
  FirebaseUserSummary,
  LevelData,
  MultiplayerMessage,
  MultiplayerStatus,
  MultiplayerTransport,
  PlayerCharacter,
  RemotePlayerState,
} from './types.ts';
import { GameEngine } from './engine.ts';
import { createEndlessLevel, createWorld1_1, createWorld1_2 } from './levels.ts';

function sanitizeRoomId(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (cleaned.length < 2) return 'SALA-1';
  return cleaned.slice(0, 32);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private engine: GameEngine | null = null;
  private transport: MultiplayerTransport = 'firebase';
  private serverAddress: string = '';
  private roomId: string = 'SALA-1';
  private playerId: string = Math.random().toString(36).substring(2, 9);
  private playerName: string = 'WazzimaGiygg';
  private character: PlayerCharacter = 'wazzima';
  private connected: boolean = false;
  private connecting: boolean = false;
  private error: string | null = null;
  private ping: number = 0;
  private sendInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: ((status: MultiplayerStatus) => void)[] = [];
  private chatListeners: ((chat: { name: string; character: PlayerCharacter; text: string; time: number }) => void)[] = [];

  // Firebase Auth & Firestore State
  private authUser: FirebaseUserSummary | null = null;
  private isHost: boolean = false;
  private availableRooms: FirebaseRoomSummary[] = [];
  private unsubAuth: Unsubscribe | null = null;
  private unsubRoomsList: Unsubscribe | null = null;
  private roomUnsubs: Unsubscribe[] = [];
  private seenMessageIds: Set<string> = new Set();
  private seenEventIds: Set<string> = new Set();
  private joinedAtMs: number = 0;
  private isApplyingRemoteLevel: boolean = false;
  private currentRoomSeed: number = 1001;

  // Dirty-checking state for quota-friendly Firestore sync
  private lastSyncedPayload: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: string;
    power: string;
    state: string;
    score: number;
    lives: number;
    coins: number;
    character: string;
    sentAt: number;
  } | null = null;
  private syncWriteInFlight: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.serverAddress = window.location.host;
      window.addEventListener('beforeunload', () => {
        if (this.connected && this.transport === 'firebase' && this.authUser) {
          // Best-effort cleanup on tab close
          deleteDoc(doc(db, 'rooms', this.roomId, 'players', this.authUser.uid)).catch(() => {});
        }
      });
    }

    this.unsubAuth = subscribeAuth((user: User | null) => {
      if (user) {
        const displayName = (user.displayName || user.email?.split('@')[0] || 'Jogador').slice(0, 32);
        this.authUser = {
          uid: user.uid,
          displayName,
          email: user.email || '',
          photoUrl: (user.photoURL || '').slice(0, 300),
        };
        this.playerId = user.uid;
        if (this.playerName === 'WazzimaGiygg' || this.playerName === 'Mario') {
          this.playerName = displayName;
        }
        this.subscribeAvailableRooms();
      } else {
        this.authUser = null;
        this.availableRooms = [];
        this.stopAvailableRoomsListener();
        if (this.connected && this.transport === 'firebase') {
          this.disconnect();
        }
      }
      this.notify();
    });
  }

  public setEngine(engine: GameEngine) {
    this.engine = engine;
    this.engine.playerCharacter = this.character;
    this.engine.onLevelChanged = (level: LevelData) => {
      this.handleLocalLevelChanged(level);
    };
  }

  public subscribe(cb: (status: MultiplayerStatus) => void) {
    this.listeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  public onChat(cb: (chat: { name: string; character: PlayerCharacter; text: string; time: number }) => void) {
    this.chatListeners.push(cb);
    return () => {
      this.chatListeners = this.chatListeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => cb(status));
  }

  public getStatus(): MultiplayerStatus {
    const remoteCount = this.engine ? this.engine.remotePlayers.size : 0;
    return {
      transport: this.transport,
      connected: this.connected,
      connecting: this.connecting,
      error: this.error,
      serverAddress: this.serverAddress,
      roomId: this.roomId,
      playerId: this.playerId,
      playerName: this.playerName,
      character: this.character,
      playerCount: this.connected ? 1 + remoteCount : 0,
      ping: this.ping,
      authUser: this.authUser,
      isHost: this.isHost,
      availableRooms: this.availableRooms,
    };
  }

  public setConfig(options: {
    transport?: MultiplayerTransport;
    serverAddress?: string;
    roomId?: string;
    playerName?: string;
    character?: PlayerCharacter;
  }) {
    if (options.transport !== undefined && !this.connected) {
      this.transport = options.transport;
      this.error = null;
    }
    if (options.serverAddress !== undefined) this.serverAddress = options.serverAddress.trim();
    if (options.roomId !== undefined) this.roomId = sanitizeRoomId(options.roomId);
    if (options.character !== undefined) {
      this.character = options.character;
      if (this.engine) this.engine.playerCharacter = options.character;
      if (this.authUser) {
        updatePreferredCharacter(this.authUser.uid, options.character).catch(() => {});
      }
    }
    if (options.playerName !== undefined) {
      const trimmed = options.playerName.trim().slice(0, 32);
      if (trimmed) this.playerName = trimmed;
    } else if (options.character !== undefined && !this.authUser) {
      this.playerName = options.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario';
    }
    this.notify();
  }

  // --- GOOGLE LOGIN ---
  public async loginWithGoogle(): Promise<boolean> {
    this.error = null;
    this.notify();
    try {
      await signInWithGoogle();
      return true;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        this.error = 'Login cancelado pelo usuário.';
      } else if (code === 'auth/popup-blocked') {
        this.error = 'Pop-up bloqueado pelo navegador. Permita pop-ups para entrar com Google.';
      } else {
        this.error = err?.message || 'Erro ao autenticar com o Google.';
      }
      this.notify();
      return false;
    }
  }

  public async logoutGoogle(): Promise<void> {
    if (this.connected && this.transport === 'firebase') {
      await this.disconnect();
    }
    await signOutGoogle();
    this.error = null;
    this.notify();
  }

  private subscribeAvailableRooms() {
    this.stopAvailableRoomsListener();
    if (!this.authUser) return;

    const path = 'rooms';
    const q = query(
      collection(db, path),
      where('status', 'in', ['open', 'playing']),
      limit(20)
    );

    this.unsubRoomsList = onSnapshot(
      q,
      (snapshot) => {
        const rooms: FirebaseRoomSummary[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          rooms.push({
            roomId: d.roomId || docSnap.id,
            hostUid: d.hostUid,
            hostName: d.hostName || 'Anfitrião',
            levelId: d.levelId || 'world-1-1',
            endlessStage: d.endlessStage || 0,
            seed: d.seed || 1001,
            status: d.status || 'open',
          });
        });
        this.availableRooms = rooms;
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  private stopAvailableRoomsListener() {
    if (this.unsubRoomsList) {
      this.unsubRoomsList();
      this.unsubRoomsList = null;
    }
  }

  // --- CONNECT / DISCONNECT ---
  public async connect() {
    if (this.transport === 'firebase') {
      await this.connectFirebase();
    } else {
      this.connectWebSocket();
    }
  }

  public async disconnect() {
    if (this.transport === 'firebase') {
      await this.disconnectFirebase();
    } else {
      this.disconnectWebSocket();
    }
  }

  // --- FIREBASE FIRESTORE MULTIPLAYER ---
  private async connectFirebase() {
    if (this.connected || this.connecting) return;
    if (!this.authUser) {
      this.error = 'Faça login com sua conta Google antes de entrar em uma sala Firebase.';
      this.notify();
      return;
    }

    this.connecting = true;
    this.error = null;
    this.roomId = sanitizeRoomId(this.roomId);
    this.notify();

    const roomPath = `rooms/${this.roomId}`;
    const roomRef = doc(db, 'rooms', this.roomId);
    const playerPath = `rooms/${this.roomId}/players/${this.authUser.uid}`;
    const playerRef = doc(db, 'rooms', this.roomId, 'players', this.authUser.uid);

    try {
      const existingRoomSnap = await getDoc(roomRef);
      const currentLevel = this.engine?.level;
      const initialLevelId = currentLevel?.id || 'world-1-1';
      const initialEndlessStage = currentLevel?.endlessStage || 0;

      if (existingRoomSnap.exists()) {
        const roomData = existingRoomSnap.data();
        if (roomData.status === 'closed') {
          if (roomData.hostUid === this.authUser.uid) {
            await deleteDoc(roomRef);
            await this.createNewFirebaseRoom(roomRef, roomPath, initialLevelId, initialEndlessStage);
          } else {
            this.connecting = false;
            this.error = `A sala "${this.roomId}" foi encerrada pelo anfitrião. Escolha outro código ou crie uma nova sala.`;
            this.notify();
            return;
          }
        } else {
          this.isHost = roomData.hostUid === this.authUser.uid;
          this.currentRoomSeed = roomData.seed || 1001;
          // Sync guest to host's active level
          if (!this.isHost && this.engine) {
            this.applyRemoteRoomLevel(roomData.levelId, roomData.endlessStage || 0, this.currentRoomSeed);
          }
        }
      } else {
        await this.createNewFirebaseRoom(roomRef, roomPath, initialLevelId, initialEndlessStage);
      }

      // Register local player document
      const initialPayload = this.buildPlayerDocPayload();
      try {
        await setDoc(playerRef, initialPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, playerPath);
      }

      this.joinedAtMs = Date.now();
      this.seenMessageIds.clear();
      this.seenEventIds.clear();
      this.lastSyncedPayload = null;
      this.connected = true;
      this.connecting = false;

      this.attachFirebaseRoomListeners();
      this.startFirebaseSyncLoop();
      this.notify();
    } catch (err: any) {
      this.connecting = false;
      this.connected = false;
      this.error = err?.message || 'Falha ao conectar na sala do Firebase.';
      this.notify();
    }
  }

  private async createNewFirebaseRoom(
    roomRef: ReturnType<typeof doc>,
    roomPath: string,
    levelId: string,
    endlessStage: number
  ) {
    if (!this.authUser) return;
    this.isHost = true;
    this.currentRoomSeed = Math.floor(Date.now() % 10000000);
    try {
      await setDoc(roomRef, {
        roomId: this.roomId,
        hostUid: this.authUser.uid,
        hostName: (this.playerName || this.authUser.displayName).slice(0, 40),
        levelId: levelId.slice(0, 64),
        endlessStage: clamp(endlessStage, 0, 9999),
        seed: this.currentRoomSeed,
        status: 'playing',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, roomPath);
    }
  }

  private attachFirebaseRoomListeners() {
    this.clearRoomListeners();
    if (!this.authUser) return;

    const myUid = this.authUser.uid;
    const roomId = this.roomId;

    // 1. Room state listener (status & level sync)
    const roomPath = `rooms/${roomId}`;
    const unsubRoom = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          if (this.connected) {
            this.error = 'A sala foi encerrada pelo anfitrião.';
            this.disconnectFirebase(false);
          }
          return;
        }
        const data = snap.data();
        if (data.status === 'closed' && this.connected) {
          this.error = 'A sala foi fechada pelo anfitrião.';
          this.disconnectFirebase(false);
          return;
        }
        this.isHost = data.hostUid === myUid;
        if (!this.isHost && this.engine && data.levelId) {
          this.applyRemoteRoomLevel(data.levelId, data.endlessStage || 0, data.seed || 1001);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, roomPath);
      }
    );
    this.roomUnsubs.push(unsubRoom);

    // 2. Players subcollection listener
    const playersPath = `rooms/${roomId}/players`;
    const playersQuery = query(
      collection(db, 'rooms', roomId, 'players'),
      where('roomId', '==', roomId),
      limit(12)
    );
    const unsubPlayers = onSnapshot(
      playersQuery,
      (snapshot) => {
        if (!this.engine) return;
        const activeIds = new Set<string>();
        snapshot.forEach((docSnap) => {
          if (docSnap.id === myUid) return;
          const d = docSnap.data();
          activeIds.add(docSnap.id);

          const prev = this.engine!.remotePlayers.get(docSnap.id);
          const remoteState: RemotePlayerState = {
            id: docSnap.id,
            name: d.name || 'Jogador',
            photoUrl: d.photoUrl || '',
            character: d.character === 'mario' ? 'mario' : 'wazzima',
            x: typeof d.x === 'number' ? d.x : 40,
            y: typeof d.y === 'number' ? d.y : 192,
            renderX: prev?.renderX,
            renderY: prev?.renderY,
            vx: typeof d.vx === 'number' ? d.vx : 0,
            vy: typeof d.vy === 'number' ? d.vy : 0,
            facing: d.facing === 'left' ? 'left' : 'right',
            power: d.power || 'small',
            state: d.state || 'idle',
            animFrame: typeof d.animFrame === 'number' ? d.animFrame : 0,
            isStatue: Boolean(d.isStatue),
            tailWhipTimer: typeof d.tailWhipTimer === 'number' ? d.tailWhipTimer : 0,
            isFluttering: Boolean(d.isFluttering),
            invulnerable: Boolean(d.invulnerable),
            score: typeof d.score === 'number' ? d.score : 0,
            lives: typeof d.lives === 'number' ? d.lives : 3,
            coins: typeof d.coins === 'number' ? d.coins : 0,
            lastUpdated: Date.now(),
          };

          if (!prev && this.engine) {
            this.engine.spawnPowerUpSparkles?.(this.engine.marioX, this.engine.marioY);
          }
          this.engine!.remotePlayers.set(docSnap.id, remoteState);
        });

        // Remove players who left the room
        for (const existingId of Array.from(this.engine.remotePlayers.keys())) {
          if (!activeIds.has(existingId)) {
            this.engine.remotePlayers.delete(existingId);
          }
        }
        this.notify();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, playersPath);
      }
    );
    this.roomUnsubs.push(unsubPlayers);

    // 3. Messages subcollection listener
    const messagesPath = `rooms/${roomId}/messages`;
    const messagesQuery = query(
      collection(db, 'rooms', roomId, 'messages'),
      where('roomId', '==', roomId),
      limit(35)
    );
    const unsubMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const fresh: { id: string; name: string; character: PlayerCharacter; text: string; time: number }[] = [];
        snapshot.forEach((docSnap) => {
          if (this.seenMessageIds.has(docSnap.id)) return;
          this.seenMessageIds.add(docSnap.id);
          const d = docSnap.data();
          const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
          fresh.push({
            id: docSnap.id,
            name: d.name || 'Jogador',
            character: d.character === 'mario' ? 'mario' : 'wazzima',
            text: d.text || '',
            time: ts,
          });
        });
        fresh.sort((a, b) => a.time - b.time);
        fresh.forEach((msg) => {
          this.chatListeners.forEach((cb) => cb(msg));
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, messagesPath);
      }
    );
    this.roomUnsubs.push(unsubMessages);

    // 4. World Events subcollection listener
    const eventsPath = `rooms/${roomId}/events`;
    const eventsQuery = query(
      collection(db, 'rooms', roomId, 'events'),
      where('roomId', '==', roomId),
      limit(25)
    );
    const unsubEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        if (!this.engine) return;
        snapshot.forEach((docSnap) => {
          if (this.seenEventIds.has(docSnap.id)) return;
          this.seenEventIds.add(docSnap.id);
          const d = docSnap.data();
          if (d.uid === myUid) return;
          const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
          if (ts < this.joinedAtMs - 2000) return; // Ignore old events from before join

          if (d.eventType === 'enemy_defeat') {
            this.engine!.spawnEnemyDefeatParticles(d.x, d.y);
          } else if (d.eventType === 'coin_collect') {
            this.engine!.spawnCoinParticles(d.x, d.y);
          } else if (d.eventType === 'brick_break') {
            this.engine!.createBrickDebris(d.x, d.y);
          }
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, eventsPath);
      }
    );
    this.roomUnsubs.push(unsubEvents);
  }

  private clearRoomListeners() {
    this.roomUnsubs.forEach((unsub) => unsub());
    this.roomUnsubs = [];
  }

  private buildPlayerDocPayload() {
    const e = this.engine;
    return {
      uid: this.authUser?.uid || this.playerId,
      roomId: this.roomId,
      name: (this.playerName || this.authUser?.displayName || 'Jogador').slice(0, 32),
      photoUrl: (this.authUser?.photoUrl || '').slice(0, 300),
      character: this.character,
      x: Number(clamp(e?.marioX ?? 40, -100, 20000).toFixed(1)),
      y: Number(clamp(e?.marioY ?? 192, -200, 1000).toFixed(1)),
      vx: Number(clamp(e?.marioVx ?? 0, -50, 50).toFixed(2)),
      vy: Number(clamp(e?.marioVy ?? 0, -50, 50).toFixed(2)),
      facing: e?.marioFacing === 'left' ? 'left' : 'right',
      power: e?.marioPower || 'small',
      state: String(e?.marioState || 'idle').slice(0, 32),
      animFrame: clamp(Math.floor(e?.marioAnimFrame ?? 0), 0, 10),
      isStatue: Boolean(e?.isStatue),
      tailWhipTimer: clamp(Math.floor(e?.tailWhipTimer ?? 0), 0, 100),
      isFluttering: Boolean(e?.isFluttering),
      invulnerable: (e?.marioInvulnerableTimer ?? 0) > 0,
      score: Math.max(0, Math.floor(e?.stats.score ?? 0)),
      lives: clamp(Math.floor(e?.stats.lives ?? 3), 0, 999),
      coins: clamp(Math.floor(e?.stats.coins ?? 0), 0, 999),
      updatedAt: serverTimestamp(),
    };
  }

  private startFirebaseSyncLoop() {
    this.stopSyncLoop();
    // Adaptive sync ~7Hz when moving, heartbeat every 4.5s when idle
    this.sendInterval = setInterval(() => {
      this.syncLocalPlayerToFirestore();
    }, 140);
  }

  private async syncLocalPlayerToFirestore() {
    if (!this.engine || !this.connected || !this.authUser || this.syncWriteInFlight) return;

    const payload = this.buildPlayerDocPayload();
    const now = Date.now();
    const prev = this.lastSyncedPayload;

    const moved =
      !prev ||
      Math.abs(payload.x - prev.x) >= 1.5 ||
      Math.abs(payload.y - prev.y) >= 1.5 ||
      payload.state !== prev.state ||
      payload.facing !== prev.facing ||
      payload.power !== prev.power ||
      payload.character !== prev.character ||
      payload.score !== prev.score ||
      payload.lives !== prev.lives ||
      payload.coins !== prev.coins ||
      now - prev.sentAt > 4500;

    if (!moved) return;

    this.syncWriteInFlight = true;
    const t0 = performance.now();
    const playerPath = `rooms/${this.roomId}/players/${this.authUser.uid}`;
    const playerRef = doc(db, 'rooms', this.roomId, 'players', this.authUser.uid);

    try {
      await updateDoc(playerRef, {
        name: payload.name,
        photoUrl: payload.photoUrl,
        character: payload.character,
        x: payload.x,
        y: payload.y,
        vx: payload.vx,
        vy: payload.vy,
        facing: payload.facing,
        power: payload.power,
        state: payload.state,
        animFrame: payload.animFrame,
        isStatue: payload.isStatue,
        tailWhipTimer: payload.tailWhipTimer,
        isFluttering: payload.isFluttering,
        invulnerable: payload.invulnerable,
        score: payload.score,
        lives: payload.lives,
        coins: payload.coins,
        updatedAt: serverTimestamp(),
      });
      this.ping = Math.round(performance.now() - t0);
      this.lastSyncedPayload = {
        x: payload.x,
        y: payload.y,
        vx: payload.vx,
        vy: payload.vy,
        facing: payload.facing,
        power: payload.power,
        state: payload.state,
        score: payload.score,
        lives: payload.lives,
        coins: payload.coins,
        character: payload.character,
        sentAt: now,
      };
    } catch (err: any) {
      // Only raise structured error if permission error or non-transient
      const msg = err?.message || '';
      if (msg.includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.UPDATE, playerPath);
      }
    } finally {
      this.syncWriteInFlight = false;
    }
  }

  private async disconnectFirebase(closeRoomIfHost: boolean = true) {
    this.stopSyncLoop();
    this.clearRoomListeners();

    const wasConnected = this.connected;
    const wasHost = this.isHost;
    const uid = this.authUser?.uid;
    const roomId = this.roomId;

    this.connected = false;
    this.connecting = false;
    this.isHost = false;
    if (this.engine) {
      this.engine.remotePlayers.clear();
    }
    this.notify();

    if (wasConnected && uid) {
      try {
        await deleteDoc(doc(db, 'rooms', roomId, 'players', uid));
      } catch {
        // Ignore cleanup errors on disconnect
      }
      if (closeRoomIfHost && wasHost) {
        try {
          await updateDoc(doc(db, 'rooms', roomId), {
            status: 'closed',
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignore if room already deleted/closed
        }
      }
    }
  }

  private async handleLocalLevelChanged(level: LevelData) {
    if (this.isApplyingRemoteLevel) return;
    if (!this.connected || this.transport !== 'firebase' || !this.isHost || !this.authUser) return;

    const roomPath = `rooms/${this.roomId}`;
    const newSeed = Math.floor(Date.now() % 10000000);
    this.currentRoomSeed = newSeed;
    try {
      await updateDoc(doc(db, 'rooms', this.roomId), {
        levelId: level.id.slice(0, 64),
        endlessStage: clamp(level.endlessStage || 0, 0, 9999),
        seed: newSeed,
        status: 'playing',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, roomPath);
    }
  }

  private applyRemoteRoomLevel(levelId: string, endlessStage: number, seed: number) {
    if (!this.engine) return;
    const currentId = this.engine.level?.id;
    const currentStage = this.engine.endlessStage || 0;

    if (levelId.startsWith('endless-') && endlessStage > 0) {
      if (currentStage === endlessStage && currentId?.startsWith('endless-')) return;
      this.isApplyingRemoteLevel = true;
      this.engine.loadLevel(createEndlessLevel(seed, endlessStage), true, false);
      this.isApplyingRemoteLevel = false;
    } else if (levelId === 'world-1-2' && currentId !== 'world-1-2') {
      this.isApplyingRemoteLevel = true;
      this.engine.loadLevel(createWorld1_2(), true, false);
      this.isApplyingRemoteLevel = false;
    } else if (levelId === 'world-1-1' && currentId !== 'world-1-1') {
      this.isApplyingRemoteLevel = true;
      this.engine.loadLevel(createWorld1_1(), true, false);
      this.isApplyingRemoteLevel = false;
    }
  }

  // --- LEGACY IP WEBSOCKET MULTIPLAYER (LOCAL LAN FALLBACK) ---
  private connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.connecting = true;
    this.error = null;
    this.notify();

    try {
      let target = this.serverAddress.trim();
      if (!target) {
        target = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
      }

      target = target.replace(/^(https?:\/\/|wss?:\/\/)/i, '');
      const isSecure =
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        !target.startsWith('localhost') &&
        !target.startsWith('127.0.0.1');
      const protocol = isSecure ? 'wss://' : 'ws://';
      const wsUrl = `${protocol}${target}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.connecting = false;
        this.error = null;

        this.sendWs({
          type: 'join',
          roomId: this.roomId,
          senderId: this.playerId,
          payload: {
            name: this.playerName,
            character: this.character,
          },
        });

        this.startWsSyncLoop();
        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleWsMessage(msg);
        } catch (e) {
          console.error('[Multiplayer] Failed to parse message', e);
        }
      };

      this.ws.onerror = () => {
        this.error = 'Não foi possível conectar ao servidor IP. Verifique o endereço ou use o Multiplayer Firebase com Login Google.';
        this.connecting = false;
        this.notify();
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.connecting = false;
        this.stopSyncLoop();
        if (this.engine) {
          this.engine.remotePlayers.clear();
        }
        this.notify();
      };
    } catch (e: any) {
      this.connecting = false;
      this.connected = false;
      this.error = e?.message || 'Erro ao inicializar conexão WebSocket';
      this.notify();
    }
  }

  private disconnectWebSocket() {
    this.stopSyncLoop();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    if (this.engine) {
      this.engine.remotePlayers.clear();
    }
    this.notify();
  }

  private sendWs(msg: MultiplayerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startWsSyncLoop() {
    this.stopSyncLoop();
    this.sendInterval = setInterval(() => {
      this.sendWsLocalPlayerUpdate();
    }, 33);
  }

  private stopSyncLoop() {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
  }

  private sendWsLocalPlayerUpdate() {
    if (!this.engine || !this.connected || this.transport !== 'websocket') return;

    const payload: Omit<RemotePlayerState, 'lastUpdated'> = {
      id: this.playerId,
      name: this.playerName,
      character: this.character,
      x: this.engine.marioX,
      y: this.engine.marioY,
      vx: this.engine.marioVx,
      vy: this.engine.marioVy,
      facing: this.engine.marioFacing,
      power: this.engine.marioPower,
      state: this.engine.marioState,
      animFrame: this.engine.marioAnimFrame,
      isStatue: this.engine.isStatue,
      tailWhipTimer: this.engine.tailWhipTimer,
      isFluttering: this.engine.isFluttering,
      invulnerable: this.engine.marioInvulnerableTimer > 0,
      score: this.engine.stats.score,
      lives: this.engine.stats.lives,
      coins: this.engine.stats.coins,
    };

    this.sendWs({
      type: 'player_update',
      roomId: this.roomId,
      senderId: this.playerId,
      payload,
    });
  }

  private handleWsMessage(msg: any) {
    const { type, senderId, payload } = msg;
    if (senderId === this.playerId) return;

    if (type === 'room_joined') {
      this.notify();
    } else if (type === 'player_joined') {
      if (this.engine) {
        this.engine.spawnPowerUpSparkles?.(this.engine.marioX, this.engine.marioY);
      }
      this.notify();
    } else if (type === 'player_left') {
      if (this.engine && senderId) {
        this.engine.remotePlayers.delete(senderId);
      }
      this.notify();
    } else if (type === 'player_update') {
      if (this.engine && payload) {
        const prev = this.engine.remotePlayers.get(senderId);
        const remoteState: RemotePlayerState = {
          ...payload,
          id: senderId,
          renderX: prev?.renderX,
          renderY: prev?.renderY,
          lastUpdated: Date.now(),
        };
        this.engine.remotePlayers.set(senderId, remoteState);
      }
    } else if (type === 'world_event') {
      if (this.engine && payload) {
        const { eventType, data } = payload;
        if (eventType === 'enemy_defeat' && data) {
          this.engine.spawnEnemyDefeatParticles(data.x, data.y);
        } else if (eventType === 'coin_collect' && data) {
          this.engine.spawnCoinParticles(data.x, data.y);
        } else if (eventType === 'brick_break' && data) {
          this.engine.createBrickDebris(data.x, data.y);
        }
      }
    } else if (type === 'chat' && payload) {
      this.chatListeners.forEach((cb) => cb(payload));
    }
  }

  // --- SHARED EVENTS & CHAT ---
  public async broadcastWorldEvent(eventType: 'enemy_defeat' | 'coin_collect' | 'brick_break' | 'level_change', data: { x: number; y: number; meta?: string }) {
    if (!this.connected) return;
    if (this.transport === 'websocket') {
      this.sendWs({
        type: 'world_event',
        roomId: this.roomId,
        senderId: this.playerId,
        payload: { eventType, data },
      });
      return;
    }

    if (!this.authUser) return;
    const eventId = `${this.authUser.uid}_${Date.now()}`;
    const eventPath = `rooms/${this.roomId}/events/${eventId}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'events', eventId), {
        uid: this.authUser.uid,
        roomId: this.roomId,
        eventType,
        x: Number((data.x || 0).toFixed(1)),
        y: Number((data.y || 0).toFixed(1)),
        meta: String(data.meta || '').slice(0, 64),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, eventPath);
    }
  }

  public async sendChatMessage(text: string) {
    const clean = text.trim().slice(0, 120);
    if (!this.connected || !clean) return;

    if (this.transport === 'websocket') {
      this.sendWs({
        type: 'chat',
        roomId: this.roomId,
        senderId: this.playerId,
        payload: { text: clean },
      });
      return;
    }

    if (!this.authUser) return;
    const msgId = `${this.authUser.uid}_${Date.now()}`;
    const msgPath = `rooms/${this.roomId}/messages/${msgId}`;
    try {
      await setDoc(doc(db, 'rooms', this.roomId, 'messages', msgId), {
        uid: this.authUser.uid,
        roomId: this.roomId,
        name: (this.playerName || this.authUser.displayName).slice(0, 32),
        character: this.character,
        text: clean,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, msgPath);
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
