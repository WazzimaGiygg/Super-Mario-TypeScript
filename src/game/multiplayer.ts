import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
  MarioPower,
  MarioState,
  MultiplayerLogoffEvent,
  MultiplayerMessage,
  MultiplayerStatus,
  MultiplayerSyncStats,
  MultiplayerTransport,
  PlayerCharacter,
  RemotePlayerState,
} from './types.ts';
import { GameEngine } from './engine.ts';
import { createEndlessLevel, createWorld1_1, createWorld1_2, createWorld2_2, createWorld1_4 } from './levels.ts';

function sanitizeRoomId(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (cleaned.length < 2) return 'SALA-1';
  return cleaned.slice(0, 32);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function isValidIdString(val: unknown): val is string {
  return typeof val === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(val);
}

const VALID_MARIO_POWERS = new Set<MarioPower>(['small', 'super', 'fire', 'tanooki', 'femboy', 'cape']);
const VALID_FIRESTORE_POWERS = new Set<string>(['small', 'super', 'fire', 'tanooki', 'femboy']);
const VALID_WORLD_EVENT_TYPES = new Set(['enemy_defeat', 'coin_collect', 'brick_break', 'level_change']);
const VALID_MARIO_STATES = new Set<string>([
  'idle',
  'running',
  'skidding',
  'jumping',
  'falling',
  'crouching',
  'pole_slide',
  'castle_walk',
  'castle_entered',
  'pipe_entering',
  'pipe_exiting',
  'tail_whip',
  'growing',
  'shrinking',
  'dead',
]);

const MAX_ROOM_PLAYERS = 16;
const ROOM_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ROOM_HEARTBEAT_INTERVAL_MS = 30 * 1000; // Host refreshes room updatedAt every 30s if active
const PLAYER_LOGOFF_TIMEOUT_MS = 20 * 1000; // 20 seconds without heartbeat -> player logoff/drop detected
const WORLD_EVENT_BATCH_MS = 140; // Base group window for rapid world events
const MAX_WS_RECONNECT_ATTEMPTS = 8;
const MAX_SEEN_IDS = 400;
const SYNC_RATE_STORAGE_KEY = 'smb_mp_sync_rate_hz';
const ADAPTIVE_SCALING_STORAGE_KEY = 'smb_mp_adaptive_scaling';
const DEFAULT_SYNC_RATE_HZ = 15;
const MIN_SYNC_RATE_HZ = 10;
const MAX_SYNC_RATE_HZ = 20;

interface PlayerSyncSnapshot {
  name: string;
  photoUrl: string;
  character: PlayerCharacter;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  power: string;
  state: MarioState;
  animFrame: number;
  isStatue: boolean;
  tailWhipTimer: number;
  isFluttering: boolean;
  invulnerable: boolean;
  score: number;
  lives: number;
  coins: number;
  stageCleared: boolean;
  levelId: string;
  sentAt: number;
}

interface QueuedWorldEvent {
  eventType: 'enemy_defeat' | 'coin_collect' | 'brick_break';
  x: number;
  y: number;
  meta?: string;
}

function sanitizePowerForFirestore(power: MarioPower | string): string {
  if (power === 'cape') return 'super';
  return VALID_FIRESTORE_POWERS.has(power) ? power : 'small';
}

function sanitizePowerForClient(power: unknown): MarioPower {
  if (typeof power === 'string' && VALID_MARIO_POWERS.has(power as MarioPower)) {
    return power as MarioPower;
  }
  return 'small';
}

function sanitizeState(state: unknown): MarioState {
  if (typeof state === 'string' && VALID_MARIO_STATES.has(state)) {
    return state as MarioState;
  }
  return 'idle';
}

function encodeEventCode(eventType: 'enemy_defeat' | 'coin_collect' | 'brick_break'): string {
  if (eventType === 'coin_collect') return 'c';
  if (eventType === 'brick_break') return 'b';
  return 'e';
}

function decodeEventCode(code: string): 'enemy_defeat' | 'coin_collect' | 'brick_break' | null {
  if (code === 'c') return 'coin_collect';
  if (code === 'b') return 'brick_break';
  if (code === 'e') return 'enemy_defeat';
  return null;
}

function loadSavedSyncRateHz(): number {
  if (typeof window === 'undefined') return DEFAULT_SYNC_RATE_HZ;
  try {
    const raw = window.localStorage.getItem(SYNC_RATE_STORAGE_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return Math.round(clamp(parsed, MIN_SYNC_RATE_HZ, MAX_SYNC_RATE_HZ));
      }
    }
  } catch {
    // ignore storage access issues
  }
  return DEFAULT_SYNC_RATE_HZ;
}

function loadSavedAdaptiveScaling(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(ADAPTIVE_SCALING_STORAGE_KEY);
    if (raw === 'false') return false;
  } catch {
    // ignore storage access issues
  }
  return true;
}

function trackBoundedId(set: Set<string>, id: string, max: number = MAX_SEEN_IDS) {
  set.add(id);
  if (set.size > max) {
    const oldest = set.values().next().value;
    if (oldest !== undefined) set.delete(oldest);
  }
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
  private reconnecting: boolean = false;
  private reconnectAttempt: number = 0;
  private manualDisconnect: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private error: string | null = null;
  private ping: number = 0;
  private syncRateHz: number = loadSavedSyncRateHz();
  private adaptiveScaling: boolean = loadSavedAdaptiveScaling();
  private lastEffectiveSyncHz: number = DEFAULT_SYNC_RATE_HZ;
  private sendInterval: ReturnType<typeof setInterval> | null = null;
  private pingProbeInterval: ReturnType<typeof setInterval> | null = null;
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: ((status: MultiplayerStatus) => void)[] = [];
  private chatListeners: ((chat: { name: string; character: PlayerCharacter; text: string; time: number }) => void)[] = [];
  private logoffListeners: ((event: MultiplayerLogoffEvent) => void)[] = [];

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
  private currentMatchGeneration: number = 1;

  // Logoff & Room Inactivity Tracking
  private networkOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastRoomActivityMs: number = Date.now();
  private lastRoomDocTouchMs: number = 0;
  private roomServerUpdatedAtMs: number = Date.now();
  private remotePlayerNames: Map<string, string> = new Map();
  private remoteLastHeartbeatMs: Map<string, number> = new Map();
  private cleaningRoomIds: Set<string> = new Set();
  private hostUidInRoom: string = '';

  // Delta-checking, sequence tracking & batching state
  private lastSyncedPayload: PlayerSyncSnapshot | null = null;
  private syncWriteInFlight: boolean = false;
  private pendingImmediateSync: boolean = false;
  private outboundSeq: number = 0;
  private remoteLastSeq: Map<string, number> = new Map();
  private pendingWorldEvents: QueuedWorldEvent[] = [];
  private pendingWorldEventKeys: Set<string> = new Set();
  private worldEventBatchTimer: ReturnType<typeof setTimeout> | null = null;
  private ownEmittedEventIds: { id: string; createdAtMs: number }[] = [];
  private lastTelemetryNotifyMs: number = 0;
  private syncStats: MultiplayerSyncStats = {
    updatesSent: 0,
    updatesSkipped: 0,
    eventsBatched: 0,
    packetsRejected: 0,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.serverAddress = window.location.host;

      const attemptUnloadCleanup = () => {
        if (this.connected && this.transport === 'firebase' && this.authUser) {
          deleteDoc(doc(db, 'rooms', this.roomId, 'players', this.authUser.uid)).catch(() => {});
          if (this.isHost && this.engine && this.engine.remotePlayers.size === 0) {
            deleteDoc(doc(db, 'rooms', this.roomId)).catch(() => {});
          }
        }
      };

      window.addEventListener('beforeunload', attemptUnloadCleanup);
      window.addEventListener('pagehide', attemptUnloadCleanup);

      window.addEventListener('offline', () => {
        this.networkOnline = false;
        if (this.connected && !this.manualDisconnect) {
          this.reconnecting = true;
          this.emitLogoffEvent({
            type: 'network_offline',
            message: 'Conexão de rede perdida! Aguardando reconexão automática...',
          });
        }
        this.notify();
      });

      window.addEventListener('online', () => {
        this.networkOnline = true;
        if (!this.manualDisconnect) {
          if (this.transport === 'websocket' && this.reconnecting && !this.connected) {
            this.clearReconnectTimer();
            this.reconnectAttempt = 0;
            this.connectWebSocket();
          } else if (this.transport === 'firebase' && this.connected && this.authUser) {
            this.touchRoomActivity();
            this.recoverFirebaseConnection();
          }
        }
        this.notify();
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
        const wasConnectedFirebase = this.connected && this.transport === 'firebase';
        const prevUid = this.authUser?.uid;
        const prevRoomId = this.roomId;
        const wasHost = this.isHost;

        this.authUser = null;
        this.availableRooms = [];
        this.stopAvailableRoomsListener();

        if (wasConnectedFirebase) {
          this.manualDisconnect = true;
          this.disconnectFirebase(wasHost, prevUid, prevRoomId);
          this.error = 'Logoff da conta Google detectado. Você saiu da sala.';
          this.emitLogoffEvent({
            type: 'local_logoff',
            message: 'Logoff detectado! Você foi desconectado da sala.',
          });
        }
      }
      this.syncEngineFlags();
      this.notify();
    });
  }

  private emitLogoffEvent(event: Omit<MultiplayerLogoffEvent, 'timestamp'>) {
    const full: MultiplayerLogoffEvent = { ...event, timestamp: Date.now() };
    this.logoffListeners.forEach((cb) => cb(full));
  }

  private touchRoomActivity() {
    this.lastRoomActivityMs = Date.now();
  }

  private resetSyncTracking() {
    this.lastSyncedPayload = null;
    this.syncWriteInFlight = false;
    this.pendingImmediateSync = false;
    this.outboundSeq = 0;
    this.remoteLastSeq.clear();
    this.ownEmittedEventIds = [];
    this.clearWorldEventQueue();
    this.syncStats = {
      updatesSent: 0,
      updatesSkipped: 0,
      eventsBatched: 0,
      packetsRejected: 0,
    };
  }

  private clearWorldEventQueue() {
    if (this.worldEventBatchTimer) {
      clearTimeout(this.worldEventBatchTimer);
      this.worldEventBatchTimer = null;
    }
    this.pendingWorldEvents = [];
    this.pendingWorldEventKeys.clear();
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private getActivePlayerCount(): number {
    if (!this.connected) return 1;
    return 1 + (this.engine ? this.engine.remotePlayers.size : 0);
  }

  private getEffectiveSyncRateHz(): number {
    const baseHz = Math.round(clamp(this.syncRateHz, MIN_SYNC_RATE_HZ, MAX_SYNC_RATE_HZ));
    if (!this.adaptiveScaling) return baseHz;
    const count = this.getActivePlayerCount();
    if (count <= 4) return baseHz;
    if (count <= 8) return Math.min(baseHz, 12);
    if (count <= 12) return Math.min(baseHz, 10);
    return Math.min(baseHz, 8);
  }

  private getAdaptivePositionDeadband(): number {
    if (!this.adaptiveScaling) return 1.5;
    const count = this.getActivePlayerCount();
    if (count <= 4) return 1.5;
    if (count <= 8) return 2.0;
    if (count <= 12) return 2.5;
    return 3.0;
  }

  private getAdaptiveHeartbeatIntervalMs(): number {
    if (!this.adaptiveScaling) return 5000;
    const count = this.getActivePlayerCount();
    if (count <= 4) return 5000;
    if (count <= 8) return 6500;
    if (count <= 12) return 8000;
    return 9500;
  }

  private getAdaptiveBatchWindowMs(): number {
    if (!this.adaptiveScaling) return WORLD_EVENT_BATCH_MS;
    const count = this.getActivePlayerCount();
    if (count <= 4) return WORLD_EVENT_BATCH_MS;
    if (count <= 8) return 175;
    return 220;
  }

  private reconcileAdaptiveSyncRate() {
    if (!this.connected) return;
    const nextEffective = this.getEffectiveSyncRateHz();
    if (nextEffective !== this.lastEffectiveSyncHz) {
      if (this.transport === 'firebase') {
        this.startFirebaseSyncLoop();
      } else {
        this.startWsSyncLoop();
      }
      this.notify();
    }
  }

  private getSyncIntervalMs(): number {
    const effectiveHz = this.getEffectiveSyncRateHz();
    this.lastEffectiveSyncHz = effectiveHz;
    return Math.round(1000 / effectiveHz);
  }

  private syncEngineFlags() {
    if (!this.engine) return;
    this.engine.playerCharacter = this.character;
    this.engine.localPlayerId = this.playerId;
    this.engine.localPlayerName = this.playerName || this.authUser?.displayName || 'Jogador';
    this.engine.localPlayerPhotoUrl = this.authUser?.photoUrl || '';
    this.engine.isMultiplayerConnected = this.connected;
    this.engine.isMultiplayerHost = this.transport === 'firebase' ? this.isHost : true;
    this.engine.isMultiplayerFirebase = this.transport === 'firebase';
  }

  public setEngine(engine: GameEngine) {
    this.engine = engine;
    this.syncEngineFlags();
    this.engine.onLevelChanged = (level: LevelData) => {
      this.handleLocalLevelChanged(level);
    };
    this.engine.onMultiplayerSyncNeeded = () => {
      this.touchRoomActivity();
      this.syncNow();
    };
    this.engine.onMultiplayerWorldEvent = (eventType, x, y) => {
      this.broadcastWorldEvent(eventType, { x, y });
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

  public onLogoffEvent(cb: (event: MultiplayerLogoffEvent) => void) {
    this.logoffListeners.push(cb);
    return () => {
      this.logoffListeners = this.logoffListeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => cb(status));
  }

  private notifyTelemetryThrottled() {
    const now = Date.now();
    if (now - this.lastTelemetryNotifyMs >= 1000) {
      this.lastTelemetryNotifyMs = now;
      this.notify();
    }
  }

  public getStatus(): MultiplayerStatus {
    const remoteCount = this.engine ? this.engine.remotePlayers.size : 0;
    const inactivityRemainingSec = this.connected
      ? Math.max(0, Math.ceil((ROOM_INACTIVITY_TIMEOUT_MS - (Date.now() - this.lastRoomActivityMs)) / 1000))
      : null;
    return {
      transport: this.transport,
      connected: this.connected,
      connecting: this.connecting,
      reconnecting: this.reconnecting,
      reconnectAttempt: this.reconnectAttempt,
      error: this.error,
      serverAddress: this.serverAddress,
      roomId: this.roomId,
      playerId: this.playerId,
      playerName: this.playerName,
      character: this.character,
      playerCount: this.connected ? 1 + remoteCount : 0,
      maxRoomPlayers: MAX_ROOM_PLAYERS,
      ping: this.ping,
      syncRateHz: this.syncRateHz,
      effectiveSyncRateHz: this.getEffectiveSyncRateHz(),
      adaptiveScaling: this.adaptiveScaling,
      syncStats: { ...this.syncStats },
      authUser: this.authUser,
      isHost: this.isHost,
      availableRooms: this.availableRooms,
      networkOnline: this.networkOnline,
      inactivityRemainingSec,
    };
  }

  public setConfig(options: {
    transport?: MultiplayerTransport;
    serverAddress?: string;
    roomId?: string;
    playerName?: string;
    character?: PlayerCharacter;
    syncRateHz?: number;
    adaptiveScaling?: boolean;
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
    let syncRateUpdated = false;
    if (options.syncRateHz !== undefined && Number.isFinite(options.syncRateHz)) {
      const nextHz = Math.round(clamp(options.syncRateHz, MIN_SYNC_RATE_HZ, MAX_SYNC_RATE_HZ));
      if (nextHz !== this.syncRateHz) {
        this.syncRateHz = nextHz;
        syncRateUpdated = true;
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(SYNC_RATE_STORAGE_KEY, String(nextHz));
          } catch {
            // ignore
          }
        }
      }
    }
    if (options.adaptiveScaling !== undefined && options.adaptiveScaling !== this.adaptiveScaling) {
      this.adaptiveScaling = options.adaptiveScaling;
      syncRateUpdated = true;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(ADAPTIVE_SCALING_STORAGE_KEY, String(options.adaptiveScaling));
        } catch {
          // ignore
        }
      }
    }
    if (syncRateUpdated && this.connected) {
      if (this.transport === 'firebase') {
        this.startFirebaseSyncLoop();
      } else {
        this.startWsSyncLoop();
      }
    }
    this.syncEngineFlags();
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
        const now = Date.now();
        const rooms: FirebaseRoomSummary[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const roomCode = d.roomId || docSnap.id;
          const updatedAtMs = d.updatedAt?.toMillis ? d.updatedAt.toMillis() : now;

          // Auto-remove rooms inactive for more than 5 minutes
          if (now - updatedAtMs > ROOM_INACTIVITY_TIMEOUT_MS) {
            this.deleteFirebaseRoomCompletely(roomCode).catch(() => {});
            return;
          }

          rooms.push({
            roomId: roomCode,
            hostUid: d.hostUid,
            hostName: d.hostName || 'Anfitrião',
            levelId: d.levelId || 'world-1-1',
            endlessStage: d.endlessStage || 0,
            seed: d.seed || 1001,
            status: d.status || 'open',
            updatedAtMs,
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
    this.manualDisconnect = false;
    this.reconnecting = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    if (this.transport === 'firebase') {
      await this.connectFirebase();
    } else {
      this.connectWebSocket();
    }
  }

  public async disconnect() {
    this.manualDisconnect = true;
    this.reconnecting = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.clearWorldEventQueue();
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
    this.resetSyncTracking();
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
        const updatedAtMs = roomData.updatedAt?.toMillis ? roomData.updatedAt.toMillis() : Date.now();
        const isExpired = Date.now() - updatedAtMs > ROOM_INACTIVITY_TIMEOUT_MS;

        if (roomData.status === 'closed' || isExpired) {
          if (roomData.hostUid === this.authUser.uid || isExpired) {
            await this.deleteFirebaseRoomCompletely(this.roomId);
            await this.createNewFirebaseRoom(roomRef, roomPath, initialLevelId, initialEndlessStage);
          } else {
            this.connecting = false;
            this.error = `A sala "${this.roomId}" foi encerrada pelo anfitrião. Escolha outro código ou crie uma nova sala.`;
            this.syncEngineFlags();
            this.notify();
            return;
          }
        } else {
          // Enforce room capacity (up to 16 active non-zombie players) before writing doc
          const existingPlayersSnap = await getDocs(
            query(collection(db, 'rooms', this.roomId, 'players'), where('roomId', '==', this.roomId), limit(MAX_ROOM_PLAYERS + 1))
          );
          const checkNow = Date.now();
          let activePeers = 0;
          existingPlayersSnap.forEach((pSnap) => {
            if (pSnap.id === this.authUser!.uid) return;
            const pUpdated = pSnap.data()?.updatedAt?.toMillis ? pSnap.data().updatedAt.toMillis() : checkNow;
            if (checkNow - pUpdated <= 45000) {
              activePeers += 1;
            }
          });
          if (activePeers >= MAX_ROOM_PLAYERS) {
            this.connecting = false;
            this.error = `A sala "${this.roomId}" atingiu o limite máximo de ${MAX_ROOM_PLAYERS} jogadores simultâneos.`;
            this.syncEngineFlags();
            this.notify();
            return;
          }

          this.isHost = roomData.hostUid === this.authUser.uid;
          this.hostUidInRoom = roomData.hostUid || '';
          this.currentRoomSeed = roomData.seed || 1001;
          this.currentMatchGeneration = roomData.matchGeneration || 1;
          this.roomServerUpdatedAtMs = updatedAtMs;
          if (this.engine && (this.engine.stats.lives <= 0 || this.engine.isMultiplayerMatchOver)) {
            const joinLevel = !this.isHost
              ? this.buildLevelFromRoomData(roomData.levelId || 'world-1-1', roomData.endlessStage || 0, this.currentRoomSeed)
              : undefined;
            this.isApplyingRemoteLevel = true;
            this.engine.restartMultiplayerMatch(joinLevel, false);
            this.isApplyingRemoteLevel = false;
          } else if (!this.isHost && this.engine) {
            this.applyRemoteRoomLevel(roomData.levelId, roomData.endlessStage || 0, this.currentRoomSeed);
          }
        }
      } else {
        await this.createNewFirebaseRoom(roomRef, roomPath, initialLevelId, initialEndlessStage);
      }

      if (this.engine) {
        if (this.engine.stats.lives <= 0 || this.engine.isMultiplayerMatchOver) {
          this.isApplyingRemoteLevel = true;
          this.engine.restartMultiplayerMatch(this.engine.level, false);
          this.isApplyingRemoteLevel = false;
        }
        this.engine.isGameStarted = true;
      }

      // Register local player document and seed baseline snapshot for delta diffing
      const initialPayload = this.buildPlayerDocPayload(true);
      try {
        await setDoc(playerRef, initialPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, playerPath);
      }

      const now = Date.now();
      this.joinedAtMs = now;
      this.lastRoomActivityMs = now;
      this.lastRoomDocTouchMs = now;
      this.roomServerUpdatedAtMs = now;
      this.seenMessageIds.clear();
      this.seenEventIds.clear();
      this.remotePlayerNames.clear();
      this.remoteLastHeartbeatMs.clear();
      this.lastSyncedPayload = this.snapshotFromPayload(initialPayload, now);
      this.connected = true;
      this.connecting = false;
      this.reconnecting = false;
      this.reconnectAttempt = 0;
      this.syncEngineFlags();

      this.attachFirebaseRoomListeners();
      this.startFirebaseSyncLoop();
      this.startFirebaseWatchdog();
      this.notify();
    } catch (err: any) {
      this.connecting = false;
      this.connected = false;
      this.error = err?.message || 'Falha ao conectar na sala do Firebase.';
      this.syncEngineFlags();
      this.notify();
    }
  }

  private async recoverFirebaseConnection() {
    if (!this.connected || this.transport !== 'firebase' || !this.authUser || this.manualDisconnect) return;
    if (!this.networkOnline) return;

    this.reconnectAttempt += 1;
    this.reconnecting = true;
    this.notify();

    try {
      const roomRef = doc(db, 'rooms', this.roomId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists() || roomSnap.data().status === 'closed') {
        this.reconnecting = false;
        this.error = 'A sala não existe mais ou foi encerrada durante a queda de rede.';
        await this.disconnectFirebase(false);
        return;
      }

      const playerRef = doc(db, 'rooms', this.roomId, 'players', this.authUser.uid);
      const fullPayload = this.buildPlayerDocPayload(true);
      await setDoc(playerRef, fullPayload, { merge: true });
      this.lastSyncedPayload = this.snapshotFromPayload(fullPayload, Date.now());
      this.attachFirebaseRoomListeners();
      this.reconnecting = false;
      this.reconnectAttempt = 0;
      this.error = null;
      this.flushWorldEventBatch();
      this.syncNow();
      this.notify();
    } catch {
      if (this.reconnectAttempt < MAX_WS_RECONNECT_ATTEMPTS && !this.manualDisconnect) {
        const delayMs = Math.min(12000, 1500 * Math.pow(2, this.reconnectAttempt - 1));
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
          this.recoverFirebaseConnection();
        }, delayMs);
      } else {
        this.reconnecting = false;
        this.error = 'Não foi possível restaurar a conexão com o Firebase.';
        this.notify();
      }
    }
  }

  private handleFirebaseSnapshotError(err: any, op: OperationType, path: string) {
    const code = err?.code || '';
    const isTransient =
      !this.networkOnline ||
      code === 'unavailable' ||
      code === 'deadline-exceeded' ||
      code === 'aborted' ||
      code === 'resource-exhausted';

    if (isTransient && this.connected && !this.manualDisconnect) {
      if (!this.reconnecting) {
        this.reconnecting = true;
        this.reconnectAttempt = 0;
        this.notify();
        const delayMs = 1500;
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
          this.recoverFirebaseConnection();
        }, delayMs);
      }
      return;
    }
    handleFirestoreError(err, op, path);
  }

  private async createNewFirebaseRoom(
    roomRef: ReturnType<typeof doc>,
    roomPath: string,
    levelId: string,
    endlessStage: number
  ) {
    if (!this.authUser) return;
    this.isHost = true;
    this.hostUidInRoom = this.authUser.uid;
    this.currentRoomSeed = this.engine?.level?.seed ?? Math.floor(Date.now() % 10000000);
    this.currentMatchGeneration = 1;
    try {
      await setDoc(roomRef, {
        roomId: this.roomId,
        hostUid: this.authUser.uid,
        hostName: (this.playerName || this.authUser.displayName).slice(0, 40),
        levelId: levelId.slice(0, 64),
        endlessStage: clamp(endlessStage, 0, 9999),
        seed: this.currentRoomSeed,
        matchGeneration: 1,
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

    // 1. Room state listener (status, level sync & rematch generation)
    const roomPath = `rooms/${roomId}`;
    const unsubRoom = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          if (this.connected) {
            this.manualDisconnect = true;
            this.error = 'A sala foi encerrada pelo anfitrião.';
            this.emitLogoffEvent({
              type: 'remote_logoff',
              message: 'A sala foi encerrada pelo anfitrião.',
            });
            this.disconnectFirebase(false);
          }
          return;
        }
        const data = snap.data();
        if (data.status === 'closed' && this.connected) {
          this.manualDisconnect = true;
          this.error = 'A sala foi fechada pelo anfitrião.';
          this.emitLogoffEvent({
            type: 'remote_logoff',
            message: 'O anfitrião encerrou a sala.',
          });
          this.disconnectFirebase(false);
          return;
        }
        if (data.roomId && data.roomId !== roomId) {
          this.syncStats.packetsRejected += 1;
          return;
        }
        if (data.updatedAt?.toMillis) {
          this.roomServerUpdatedAtMs = data.updatedAt.toMillis();
        }
        this.isHost = data.hostUid === myUid;
        this.hostUidInRoom = typeof data.hostUid === 'string' ? data.hostUid : '';
        this.syncEngineFlags();

        const incomingGen = typeof data.matchGeneration === 'number' && Number.isFinite(data.matchGeneration) ? data.matchGeneration : 1;
        if (incomingGen > this.currentMatchGeneration) {
          this.currentMatchGeneration = incomingGen;
          this.touchRoomActivity();
          if (this.engine && !this.isHost) {
            const targetLevel = this.buildLevelFromRoomData(
              typeof data.levelId === 'string' ? data.levelId : 'world-1-1',
              typeof data.endlessStage === 'number' ? clamp(data.endlessStage, 0, 9999) : 0,
              typeof data.seed === 'number' && Number.isFinite(data.seed) ? data.seed : 1001
            );
            this.isApplyingRemoteLevel = true;
            this.engine.restartMultiplayerMatch(targetLevel, false);
            this.isApplyingRemoteLevel = false;
            this.syncNow();
          }
        } else if (!this.isHost && this.engine && typeof data.levelId === 'string') {
          this.touchRoomActivity();
          this.applyRemoteRoomLevel(
            data.levelId,
            typeof data.endlessStage === 'number' ? clamp(data.endlessStage, 0, 9999) : 0,
            typeof data.seed === 'number' && Number.isFinite(data.seed) ? data.seed : 1001
          );
        }
      },
      (error) => {
        this.handleFirebaseSnapshotError(error, OperationType.GET, roomPath);
      }
    );
    this.roomUnsubs.push(unsubRoom);

    // 2. Players subcollection listener (supports up to 16 simultaneous players)
    const playersPath = `rooms/${roomId}/players`;
    const playersQuery = query(
      collection(db, 'rooms', roomId, 'players'),
      where('roomId', '==', roomId),
      limit(MAX_ROOM_PLAYERS)
    );
    const unsubPlayers = onSnapshot(
      playersQuery,
      (snapshot) => {
        if (!this.engine) return;
        const now = Date.now();
        const activeIds = new Set<string>();

        snapshot.docChanges().forEach((change) => {
          if (change.doc.id === myUid) return;
          if (change.type === 'removed') {
            const leftName = this.remotePlayerNames.get(change.doc.id) || change.doc.data()?.name || 'Jogador';
            const leftIsHost = change.doc.id === this.hostUidInRoom;
            this.remotePlayerNames.delete(change.doc.id);
            this.remoteLastHeartbeatMs.delete(change.doc.id);
            this.emitLogoffEvent({
              type: 'remote_logoff',
              playerName: leftName,
              message: leftIsHost
                ? `${leftName} (Anfitrião) fez logoff / saiu da sala.`
                : `${leftName} fez logoff / saiu da sala.`,
            });
          } else if (change.type === 'modified') {
            this.remoteLastHeartbeatMs.set(change.doc.id, now);
          }
        });

        snapshot.forEach((docSnap) => {
          if (docSnap.id === myUid) return;
          const d = docSnap.data();

          // Strict player identity & room validation
          if (!isValidIdString(docSnap.id) || d.uid !== docSnap.id || d.roomId !== roomId) {
            this.syncStats.packetsRejected += 1;
            return;
          }

          // Filter out abandoned zombie player docs left from prior crashed sessions (> 45s old on join)
          const serverUpdatedMs = d.updatedAt?.toMillis ? d.updatedAt.toMillis() : null;
          if (
            serverUpdatedMs !== null &&
            !this.remoteLastHeartbeatMs.has(docSnap.id) &&
            Math.abs(now - serverUpdatedMs) < 86400000 &&
            now - serverUpdatedMs > 45000
          ) {
            if (this.isHost) {
              deleteDoc(doc(db, 'rooms', roomId, 'players', docSnap.id)).catch(() => {});
            }
            return;
          }

          if (!this.remoteLastHeartbeatMs.has(docSnap.id)) {
            this.remoteLastHeartbeatMs.set(docSnap.id, now);
          }

          activeIds.add(docSnap.id);

          const prev = this.engine!.remotePlayers.get(docSnap.id);
          const remoteName = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 32) : 'Jogador';
          this.remotePlayerNames.set(docSnap.id, remoteName);

          const targetX = typeof d.x === 'number' && Number.isFinite(d.x) ? clamp(d.x, -100, 20000) : (prev?.x ?? 40);
          const targetY = typeof d.y === 'number' && Number.isFinite(d.y) ? clamp(d.y, -200, 1000) : (prev?.y ?? 192);

          const remoteState: RemotePlayerState = {
            id: docSnap.id,
            name: remoteName,
            photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl.slice(0, 300) : '',
            character: d.character === 'mario' ? 'mario' : 'wazzima',
            x: targetX,
            y: targetY,
            targetX,
            targetY,
            renderX: prev?.renderX ?? targetX,
            renderY: prev?.renderY ?? targetY,
            vx: typeof d.vx === 'number' && Number.isFinite(d.vx) ? clamp(d.vx, -50, 50) : 0,
            vy: typeof d.vy === 'number' && Number.isFinite(d.vy) ? clamp(d.vy, -50, 50) : 0,
            facing: d.facing === 'left' ? 'left' : 'right',
            power: sanitizePowerForClient(d.power),
            state: sanitizeState(d.state),
            animFrame: typeof d.animFrame === 'number' && Number.isFinite(d.animFrame) ? clamp(Math.floor(d.animFrame), 0, 10) : 0,
            isStatue: Boolean(d.isStatue),
            tailWhipTimer: typeof d.tailWhipTimer === 'number' && Number.isFinite(d.tailWhipTimer) ? clamp(Math.floor(d.tailWhipTimer), 0, 100) : 0,
            isFluttering: Boolean(d.isFluttering),
            invulnerable: Boolean(d.invulnerable),
            score: typeof d.score === 'number' && Number.isFinite(d.score) ? Math.max(0, Math.floor(d.score)) : 0,
            lives: typeof d.lives === 'number' && Number.isFinite(d.lives) ? clamp(Math.floor(d.lives), 0, 999) : 3,
            coins: typeof d.coins === 'number' && Number.isFinite(d.coins) ? clamp(Math.floor(d.coins), 0, 999) : 0,
            stageCleared: Boolean(d.stageCleared),
            levelId: typeof d.levelId === 'string' ? d.levelId.slice(0, 64) : undefined,
            lastUpdated: this.remoteLastHeartbeatMs.get(docSnap.id) ?? now,
          };

          const hasMeaningfulActivity =
            !prev ||
            Math.abs(remoteState.x - prev.x) >= 1.5 ||
            Math.abs(remoteState.y - prev.y) >= 1.5 ||
            remoteState.state !== prev.state ||
            remoteState.score !== prev.score ||
            remoteState.lives !== prev.lives ||
            remoteState.coins !== prev.coins ||
            remoteState.stageCleared !== prev.stageCleared ||
            remoteState.levelId !== prev.levelId;

          if (hasMeaningfulActivity) {
            this.touchRoomActivity();
          }

          if (!prev && this.engine) {
            this.engine.spawnPowerUpSparkles?.(this.engine.marioX, this.engine.marioY);
          }
          this.engine!.remotePlayers.set(docSnap.id, remoteState);
        });

        // Remove players who left the room
        for (const existingId of Array.from(this.engine.remotePlayers.keys())) {
          if (!activeIds.has(existingId)) {
            this.engine.remotePlayers.delete(existingId);
            this.remoteLastHeartbeatMs.delete(existingId);
            this.remotePlayerNames.delete(existingId);
          }
        }
        this.reconcileAdaptiveSyncRate();
        this.engine.evaluateMultiplayerMatchEnd();
        this.notify();
      },
      (error) => {
        this.handleFirebaseSnapshotError(error, OperationType.LIST, playersPath);
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
          trackBoundedId(this.seenMessageIds, docSnap.id);
          const d = docSnap.data();
          if (d.roomId !== roomId || !isValidIdString(d.uid) || typeof d.text !== 'string') {
            this.syncStats.packetsRejected += 1;
            return;
          }
          const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
          fresh.push({
            id: docSnap.id,
            name: (typeof d.name === 'string' && d.name.trim() ? d.name.trim() : 'Jogador').slice(0, 32),
            character: d.character === 'mario' ? 'mario' : 'wazzima',
            text: d.text.slice(0, 120),
            time: ts,
          });
        });
        fresh.sort((a, b) => a.time - b.time);
        fresh.forEach((msg) => {
          this.chatListeners.forEach((cb) => cb(msg));
        });
      },
      (error) => {
        this.handleFirebaseSnapshotError(error, OperationType.LIST, messagesPath);
      }
    );
    this.roomUnsubs.push(unsubMessages);

    // 4. World Events subcollection listener (supports packed batched events in `meta`)
    const eventsPath = `rooms/${roomId}/events`;
    const eventsQuery = query(
      collection(db, 'rooms', roomId, 'events'),
      where('roomId', '==', roomId),
      limit(40)
    );
    const unsubEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        if (!this.engine) return;
        snapshot.forEach((docSnap) => {
          if (this.seenEventIds.has(docSnap.id)) return;
          trackBoundedId(this.seenEventIds, docSnap.id);
          const d = docSnap.data();
          if (
            d.roomId !== roomId ||
            !isValidIdString(d.uid) ||
            !VALID_WORLD_EVENT_TYPES.has(d.eventType) ||
            typeof d.x !== 'number' ||
            typeof d.y !== 'number' ||
            !Number.isFinite(d.x) ||
            !Number.isFinite(d.y)
          ) {
            this.syncStats.packetsRejected += 1;
            return;
          }
          if (d.uid === myUid) return;
          const ts = d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
          if (ts < this.joinedAtMs - 2000) return;

          if (typeof d.meta === 'string' && d.meta.startsWith('b:')) {
            const entries = d.meta.slice(2).split('|');
            for (const entry of entries) {
              const [code, coords] = entry.split('@');
              const evType = decodeEventCode(code);
              if (!evType || !coords) continue;
              const [xStr, yStr] = coords.split(',');
              const ex = Number(xStr);
              const ey = Number(yStr);
              if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;
              this.replayRemoteWorldEvent(evType, clamp(ex, -100, 20000), clamp(ey, -200, 1000));
            }
          } else {
            this.replayRemoteWorldEvent(
              d.eventType,
              clamp(d.x, -100, 20000),
              clamp(d.y, -200, 1000)
            );
          }
        });
      },
      (error) => {
        this.handleFirebaseSnapshotError(error, OperationType.LIST, eventsPath);
      }
    );
    this.roomUnsubs.push(unsubEvents);
  }

  private replayRemoteWorldEvent(eventType: string, x: number, y: number) {
    if (!this.engine) return;
    if (eventType === 'enemy_defeat') {
      this.engine.spawnEnemyDefeatParticles(x, y, undefined, true);
    } else if (eventType === 'coin_collect') {
      this.engine.spawnCoinParticles(x, y, true);
    } else if (eventType === 'brick_break') {
      this.engine.createBrickDebris(x, y, true);
    }
  }

  private clearRoomListeners() {
    this.roomUnsubs.forEach((unsub) => unsub());
    this.roomUnsubs = [];
  }

  private buildPlayerDocPayload(forFirestore: boolean) {
    const e = this.engine;
    const rawPower = e?.marioPower || 'small';
    return {
      uid: this.authUser?.uid || this.playerId,
      roomId: this.roomId,
      name: (this.playerName || this.authUser?.displayName || 'Jogador').slice(0, 32),
      photoUrl: (this.authUser?.photoUrl || '').slice(0, 300),
      character: this.character,
      x: Number(clamp(e?.marioX ?? 40, -100, 20000).toFixed(1)),
      y: Number(clamp(e?.marioY ?? 192, -200, 1000).toFixed(1)),
      vx: Number(clamp(e?.marioVx ?? 0, -50, 50).toFixed(1)),
      vy: Number(clamp(e?.marioVy ?? 0, -50, 50).toFixed(1)),
      facing: e?.marioFacing === 'left' ? ('left' as const) : ('right' as const),
      power: forFirestore ? sanitizePowerForFirestore(rawPower) : rawPower,
      state: sanitizeState(e?.marioState || 'idle'),
      animFrame: clamp(Math.floor(e?.marioAnimFrame ?? 0), 0, 10),
      isStatue: Boolean(e?.isStatue),
      tailWhipTimer: clamp(Math.floor(e?.tailWhipTimer ?? 0), 0, 100),
      isFluttering: Boolean(e?.isFluttering),
      invulnerable: (e?.marioInvulnerableTimer ?? 0) > 0,
      score: Math.max(0, Math.floor(e?.stats.score ?? 0)),
      lives: clamp(Math.floor(e?.stats.lives ?? 3), 0, 999),
      coins: clamp(Math.floor(e?.stats.coins ?? 0), 0, 999),
      stageCleared: Boolean(e?.localStageCleared),
      levelId: (e?.level?.id || 'world-1-1').slice(0, 64),
      updatedAt: serverTimestamp(),
    };
  }

  private snapshotFromPayload(payload: ReturnType<MultiplayerClient['buildPlayerDocPayload']>, sentAt: number): PlayerSyncSnapshot {
    return {
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
      stageCleared: payload.stageCleared,
      levelId: payload.levelId,
      sentAt,
    };
  }

  private buildDeltaFields(
    current: PlayerSyncSnapshot,
    prev: PlayerSyncSnapshot | null
  ): { delta: Record<string, unknown>; hasCriticalChange: boolean; hasAnyChange: boolean } {
    if (!prev) {
      return {
        delta: {
          name: current.name,
          photoUrl: current.photoUrl,
          character: current.character,
          x: current.x,
          y: current.y,
          vx: current.vx,
          vy: current.vy,
          facing: current.facing,
          power: current.power,
          state: current.state,
          animFrame: current.animFrame,
          isStatue: current.isStatue,
          tailWhipTimer: current.tailWhipTimer,
          isFluttering: current.isFluttering,
          invulnerable: current.invulnerable,
          score: current.score,
          lives: current.lives,
          coins: current.coins,
          stageCleared: current.stageCleared,
          levelId: current.levelId,
        },
        hasCriticalChange: true,
        hasAnyChange: true,
      };
    }

    const delta: Record<string, unknown> = {};
    let hasCriticalChange = false;

    if (current.name !== prev.name) delta.name = current.name;
    if (current.photoUrl !== prev.photoUrl) delta.photoUrl = current.photoUrl;
    if (current.character !== prev.character) {
      delta.character = current.character;
      hasCriticalChange = true;
    }

    // Adaptive spatial deadband reduces Firebase ops gracefully in 8-16 player rooms
    const deadband = this.getAdaptivePositionDeadband();
    if (Math.abs(current.x - prev.x) >= deadband) delta.x = current.x;
    if (Math.abs(current.y - prev.y) >= deadband) delta.y = current.y;
    if (Math.abs(current.vx - prev.vx) >= 0.45 || (current.vx === 0 && prev.vx !== 0)) {
      delta.vx = current.vx;
    }
    if (Math.abs(current.vy - prev.vy) >= 0.5 || (current.vy === 0 && prev.vy !== 0)) {
      delta.vy = current.vy;
    }

    if (current.facing !== prev.facing) delta.facing = current.facing;
    if (current.power !== prev.power) {
      delta.power = current.power;
      hasCriticalChange = true;
    }
    if (current.state !== prev.state) {
      delta.state = current.state;
      if (current.state === 'dead' || current.state === 'castle_entered') {
        hasCriticalChange = true;
      }
    }

    // Suppress idle animFrame churn; local client interpolates walking frames
    if (current.animFrame !== prev.animFrame && current.state !== 'idle' && current.state !== 'crouching') {
      delta.animFrame = current.animFrame;
    }

    if (current.isStatue !== prev.isStatue) delta.isStatue = current.isStatue;
    if (current.tailWhipTimer !== prev.tailWhipTimer) delta.tailWhipTimer = current.tailWhipTimer;
    if (current.isFluttering !== prev.isFluttering) delta.isFluttering = current.isFluttering;
    if (current.invulnerable !== prev.invulnerable) {
      delta.invulnerable = current.invulnerable;
      hasCriticalChange = true;
    }
    if (current.score !== prev.score) delta.score = current.score;
    if (current.lives !== prev.lives) {
      delta.lives = current.lives;
      hasCriticalChange = true;
    }
    if (current.coins !== prev.coins) delta.coins = current.coins;
    if (current.stageCleared !== prev.stageCleared) {
      delta.stageCleared = current.stageCleared;
      hasCriticalChange = true;
    }
    if (current.levelId !== prev.levelId) {
      delta.levelId = current.levelId;
      hasCriticalChange = true;
    }

    return {
      delta,
      hasCriticalChange,
      hasAnyChange: Object.keys(delta).length > 0,
    };
  }

  public syncNow() {
    if (!this.connected) return;
    if (this.transport === 'firebase') {
      if (this.syncWriteInFlight) {
        this.pendingImmediateSync = true;
      } else {
        this.syncLocalPlayerToFirestore(true);
      }
    } else {
      this.sendWsLocalPlayerUpdate(true);
    }
  }

  private startFirebaseSyncLoop() {
    this.stopSyncLoop();
    const intervalMs = this.getSyncIntervalMs();
    this.sendInterval = setInterval(() => {
      this.syncLocalPlayerToFirestore(false);
    }, intervalMs);
  }

  private async syncLocalPlayerToFirestore(force: boolean = false) {
    if (!this.engine || !this.connected || !this.authUser || !this.networkOnline) return;
    if (this.syncWriteInFlight) {
      if (force) this.pendingImmediateSync = true;
      return;
    }

    const now = Date.now();
    const rawPayload = this.buildPlayerDocPayload(true);
    const currentSnapshot = this.snapshotFromPayload(rawPayload, now);
    const prev = this.lastSyncedPayload;
    const { delta, hasAnyChange } = this.buildDeltaFields(currentSnapshot, prev);

    if (hasAnyChange) {
      this.touchRoomActivity();
    }

    const heartbeatDue = !prev || now - prev.sentAt >= this.getAdaptiveHeartbeatIntervalMs();
    if (!force && !hasAnyChange && !heartbeatDue) {
      this.syncStats.updatesSkipped += 1;
      this.notifyTelemetryThrottled();
      return;
    }

    // Minimal delta write: if idle heartbeat only, send solely updatedAt timestamp
    const updateBody: Record<string, unknown> = hasAnyChange
      ? { ...delta, updatedAt: serverTimestamp() }
      : { updatedAt: serverTimestamp() };

    this.syncWriteInFlight = true;
    const t0 = performance.now();
    const playerPath = `rooms/${this.roomId}/players/${this.authUser.uid}`;
    const playerRef = doc(db, 'rooms', this.roomId, 'players', this.authUser.uid);

    try {
      await updateDoc(playerRef, updateBody);
      this.ping = Math.round(performance.now() - t0);
      this.syncStats.updatesSent += 1;
      if (this.reconnecting) {
        this.reconnecting = false;
        this.reconnectAttempt = 0;
        this.notify();
      } else {
        this.notifyTelemetryThrottled();
      }
      this.lastSyncedPayload = {
        ...(prev || currentSnapshot),
        ...(hasAnyChange ? delta : {}),
        sentAt: now,
      } as PlayerSyncSnapshot;
    } catch (err: any) {
      const msg = err?.message || '';
      const code = err?.code || '';
      if (msg.includes('Missing or insufficient permissions') || code === 'permission-denied') {
        handleFirestoreError(err, OperationType.UPDATE, playerPath);
      } else if (code === 'not-found') {
        // Re-create player doc transparently if cleaned up during transient drop
        setDoc(playerRef, rawPayload).catch(() => {});
        this.lastSyncedPayload = currentSnapshot;
      }
    } finally {
      this.syncWriteInFlight = false;
      if (this.pendingImmediateSync) {
        this.pendingImmediateSync = false;
        this.syncLocalPlayerToFirestore(true);
      }
    }
  }

  private startFirebaseWatchdog() {
    this.stopWatchdog();
    this.watchdogInterval = setInterval(() => {
      if (!this.connected || this.transport !== 'firebase' || !this.authUser) return;
      const now = Date.now();

      // 1. Detect remote player heartbeat logoff / connection drop (> 20s without update)
      if (this.engine) {
        for (const [rpId, rp] of Array.from(this.engine.remotePlayers.entries())) {
          const lastSeen = this.remoteLastHeartbeatMs.get(rpId) ?? rp.lastUpdated;
          if (now - lastSeen > PLAYER_LOGOFF_TIMEOUT_MS) {
            const leftIsHost = rpId === this.hostUidInRoom;
            this.engine.remotePlayers.delete(rpId);
            this.remoteLastHeartbeatMs.delete(rpId);
            this.remotePlayerNames.delete(rpId);
            this.emitLogoffEvent({
              type: 'remote_logoff',
              playerName: rp.name,
              message: leftIsHost
                ? `${rp.name} (Anfitrião) desconectou por inatividade/logoff.`
                : `${rp.name} perdeu conexão ou fez logoff.`,
            });
            if (this.isHost) {
              deleteDoc(doc(db, 'rooms', this.roomId, 'players', rpId)).catch(() => {});
            }
            this.notify();
          }
        }
      }

      // 2. Check 5-minute room inactivity auto-removal
      const inactiveMs = now - this.lastRoomActivityMs;
      if (inactiveMs >= ROOM_INACTIVITY_TIMEOUT_MS) {
        if (this.isHost) {
          this.handleRoomInactiveRemoval(this.roomId);
          return;
        } else if (now - Math.max(this.lastRoomActivityMs, this.roomServerUpdatedAtMs) >= ROOM_INACTIVITY_TIMEOUT_MS + 10000) {
          this.handleRoomInactiveRemoval(this.roomId);
          return;
        }
      }

      // 3. Keep room alive while gameplay/chat activity continues (every ~30s)
      if (
        this.isHost &&
        this.lastRoomActivityMs > this.lastRoomDocTouchMs &&
        now - this.lastRoomDocTouchMs >= ROOM_HEARTBEAT_INTERVAL_MS
      ) {
        this.lastRoomDocTouchMs = now;
        updateDoc(doc(db, 'rooms', this.roomId), {
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      // Refresh UI countdown cleanly when idle > 45s
      if (inactiveMs > 45000) {
        this.notify();
      }
    }, 5000);
  }

  private stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  private async handleRoomInactiveRemoval(roomId: string) {
    if (!this.connected) return;
    this.manualDisconnect = true;
    const message = 'Sala removida automaticamente após 5 minutos de inatividade.';
    this.error = message;
    this.emitLogoffEvent({
      type: 'room_inactive',
      message,
    });
    const uid = this.authUser?.uid;
    await this.disconnectFirebase(false, uid, roomId);
    await this.deleteFirebaseRoomCompletely(roomId);
  }

  private async deleteFirebaseRoomCompletely(roomId: string) {
    if (!roomId || !this.authUser || this.cleaningRoomIds.has(roomId)) return;
    this.cleaningRoomIds.add(roomId);
    try {
      const subcollections = ['players', 'messages', 'events'] as const;
      for (const sub of subcollections) {
        try {
          for (let pass = 0; pass < 5; pass++) {
            const snap = await getDocs(
              query(collection(db, 'rooms', roomId, sub), where('roomId', '==', roomId), limit(100))
            );
            if (snap.empty) break;
            await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
            if (snap.size < 100) break;
          }
        } catch {
          // Ignore subcollection list/delete failures on already-deleted rooms
        }
      }
      await deleteDoc(doc(db, 'rooms', roomId)).catch(() => {});
    } finally {
      this.cleaningRoomIds.delete(roomId);
    }
  }

  private async disconnectFirebase(
    removeOrCloseRoomIfHost: boolean = true,
    overrideUid?: string,
    overrideRoomId?: string
  ) {
    this.stopSyncLoop();
    this.stopWatchdog();
    this.clearReconnectTimer();
    this.clearWorldEventQueue();
    this.clearRoomListeners();

    const wasConnected = this.connected;
    const wasHost = this.isHost;
    const uid = overrideUid || this.authUser?.uid;
    const roomId = overrideRoomId || this.roomId;

    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.reconnectAttempt = 0;
    this.isHost = false;
    this.remoteLastHeartbeatMs.clear();
    this.remotePlayerNames.clear();
    if (this.engine) {
      this.engine.remotePlayers.clear();
    }
    this.syncEngineFlags();
    this.notify();

    if (wasConnected && uid) {
      try {
        await deleteDoc(doc(db, 'rooms', roomId, 'players', uid));
      } catch {
        // Ignore cleanup errors on disconnect
      }
      if (removeOrCloseRoomIfHost && wasHost && this.authUser) {
        await this.deleteFirebaseRoomCompletely(roomId);
      }
    }
  }

  private async handleLocalLevelChanged(level: LevelData) {
    if (this.isApplyingRemoteLevel || !this.connected) return;

    if (this.transport === 'websocket') {
      this.sendWsLocalPlayerUpdate(true);
      this.broadcastWorldEvent('level_change', {
        x: 0,
        y: 0,
        meta: `sync:${level.id}|${level.endlessStage || 0}|${level.seed || 1001}`,
      });
      return;
    }

    if (this.transport !== 'firebase' || !this.isHost || !this.authUser) return;

    const roomPath = `rooms/${this.roomId}`;
    const newSeed = level.seed ?? Math.floor(Date.now() % 10000000);
    this.currentRoomSeed = newSeed;
    this.touchRoomActivity();
    this.lastRoomDocTouchMs = Date.now();
    this.syncNow();
    try {
      await updateDoc(doc(db, 'rooms', this.roomId), {
        levelId: level.id.slice(0, 64),
        endlessStage: clamp(level.endlessStage || 0, 0, 9999),
        seed: newSeed,
        matchGeneration: this.currentMatchGeneration,
        status: 'playing',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, roomPath);
    }
  }

  private buildLevelFromRoomData(levelId: string, endlessStage: number, seed: number): LevelData {
    if (levelId.startsWith('endless-') && endlessStage > 0) {
      return createEndlessLevel(seed, endlessStage);
    }
    if (levelId === 'world-1-4') {
      return createWorld1_4();
    }
    if (levelId === 'world-2-2') {
      return createWorld2_2();
    }
    if (levelId === 'world-1-2') {
      return createWorld1_2();
    }
    return createWorld1_1();
  }

  private applyRemoteRoomLevel(levelId: string, endlessStage: number, seed: number) {
    if (!this.engine) return;
    const currentId = this.engine.level?.id;
    const currentStage = this.engine.endlessStage || 0;
    const currentSeed = this.engine.level?.seed;

    if (levelId.startsWith('endless-') && endlessStage > 0) {
      if (currentStage === endlessStage && currentSeed === seed && currentId === levelId) return;
      this.isApplyingRemoteLevel = true;
      this.engine.loadLevel(createEndlessLevel(seed, endlessStage), true, false, false);
      this.isApplyingRemoteLevel = false;
      this.syncNow();
    } else if (levelId === 'world-1-4' && currentId !== 'world-1-4') {
      this.isApplyingRemoteLevel = true;
      this.engine.loadLevel(createWorld1_4(), true, false, false);
      this.isApplyingRemoteLevel = false;
      this.syncNow();
    } else if (levelId === 'world-2-2' && currentId !== 'world-2-2') {
      this.isApplyingRemoteLevel = true;
      this.engine.loadLevel(createWorld2_2(), true, false, false);
      this.isApplyingRemoteLevel = false;
      this.syncNow();
    } else if (levelId === 'world-1-2' && currentId !== 'world-1-2') {
      this.isApplyingRemoteLevel = true;
      this.engine.loadLevel(createWorld1_2(), true, false, false);
      this.isApplyingRemoteLevel = false;
      this.syncNow();
    } else if (levelId === 'world-1-1' && currentId !== 'world-1-1') {
      this.isApplyingRemoteLevel = true;
      this.engine.loadLevel(createWorld1_1(), true, false, false);
      this.isApplyingRemoteLevel = false;
      this.syncNow();
    }
  }

  public async startMultiplayerRematch() {
    if (!this.engine) return;
    if (!this.connected) {
      this.engine.restartGame();
      return;
    }

    if (this.transport === 'websocket') {
      this.engine.restartMultiplayerMatch(createWorld1_1(), false);
      this.syncNow();
      this.broadcastWorldEvent('level_change', { x: 0, y: 0, meta: 'rematch' });
      return;
    }

    if (!this.isHost || !this.authUser) return;
    const nextGen = this.currentMatchGeneration + 1;
    this.currentMatchGeneration = nextGen;
    const newSeed = Math.floor(Date.now() % 10000000);
    this.currentRoomSeed = newSeed;

    this.isApplyingRemoteLevel = true;
    this.engine.restartMultiplayerMatch(createWorld1_1(), false);
    this.isApplyingRemoteLevel = false;
    this.syncNow();

    const roomPath = `rooms/${this.roomId}`;
    try {
      await updateDoc(doc(db, 'rooms', this.roomId), {
        levelId: 'world-1-1',
        endlessStage: 0,
        seed: newSeed,
        matchGeneration: nextGen,
        status: 'playing',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, roomPath);
    }
  }

  // --- LEGACY IP WEBSOCKET MULTIPLAYER (LOCAL LAN WITH DELTA SYNC & AUTO-RECONNECT) ---
  private connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.connecting = true;
    this.error = null;
    if (!this.reconnecting) {
      this.resetSyncTracking();
    }
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
        this.reconnecting = false;
        this.reconnectAttempt = 0;
        this.error = null;
        this.lastSyncedPayload = null;
        this.remoteLastSeq.clear();
        this.touchRoomActivity();

        if (this.engine) {
          if (this.engine.stats.lives <= 0 || this.engine.isMultiplayerMatchOver) {
            this.engine.restartMultiplayerMatch(undefined, false);
          }
          this.engine.isGameStarted = true;
        }
        this.syncEngineFlags();

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
        this.sendWsLocalPlayerUpdate(true);
        this.flushWorldEventBatch();
        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleWsMessage(msg);
        } catch {
          this.syncStats.packetsRejected += 1;
        }
      };

      this.ws.onerror = () => {
        this.connecting = false;
        if (!this.reconnecting) {
          this.error = 'Não foi possível conectar ao servidor IP. Tentando reconectar...';
        }
        this.syncEngineFlags();
        this.notify();
      };

      this.ws.onclose = () => {
        const wasConnected = this.connected;
        const wasConnecting = this.connecting;
        this.connected = false;
        this.connecting = false;
        this.stopSyncLoop();
        if (this.engine) {
          this.engine.remotePlayers.clear();
        }
        if (!this.manualDisconnect && (wasConnected || this.reconnecting || wasConnecting)) {
          this.scheduleWsReconnect();
        } else if (wasConnected && !this.error) {
          this.emitLogoffEvent({
            type: 'network_offline',
            message: 'Conexão WebSocket com a sala foi encerrada.',
          });
        }
        this.syncEngineFlags();
        this.notify();
      };
    } catch (e: any) {
      this.connecting = false;
      this.connected = false;
      this.error = e?.message || 'Erro ao inicializar conexão WebSocket';
      if (!this.manualDisconnect) {
        this.scheduleWsReconnect();
      }
      this.syncEngineFlags();
      this.notify();
    }
  }

  private scheduleWsReconnect() {
    if (this.manualDisconnect || this.transport !== 'websocket') return;
    if (this.reconnectAttempt >= MAX_WS_RECONNECT_ATTEMPTS) {
      this.reconnecting = false;
      this.error = 'Não foi possível reconectar automaticamente após várias tentativas.';
      this.emitLogoffEvent({
        type: 'network_offline',
        message: 'Reconexão automática esgotada. Conecte novamente manualmente.',
      });
      this.notify();
      return;
    }

    this.reconnectAttempt += 1;
    this.reconnecting = true;
    const delayMs = Math.min(15000, 1000 * Math.pow(2, this.reconnectAttempt - 1));
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (!this.manualDisconnect && !this.connected && this.transport === 'websocket') {
        this.connectWebSocket();
      }
    }, delayMs);
    this.notify();
  }

  private disconnectWebSocket() {
    this.stopSyncLoop();
    this.clearReconnectTimer();
    this.clearWorldEventQueue();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.reconnectAttempt = 0;
    if (this.engine) {
      this.engine.remotePlayers.clear();
    }
    this.syncEngineFlags();
    this.notify();
  }

  private sendWs(msg: MultiplayerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startWsSyncLoop() {
    this.stopSyncLoop();
    const intervalMs = this.getSyncIntervalMs();
    this.sendInterval = setInterval(() => {
      this.sendWsLocalPlayerUpdate(false);
    }, intervalMs);
    this.pingProbeInterval = setInterval(() => {
      if (this.connected && this.transport === 'websocket') {
        this.sendWs({
          type: 'ping_probe',
          roomId: this.roomId,
          senderId: this.playerId,
          payload: { t: Date.now() },
        });
      }
    }, 4000);
  }

  private stopSyncLoop() {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
    if (this.pingProbeInterval) {
      clearInterval(this.pingProbeInterval);
      this.pingProbeInterval = null;
    }
  }

  private sendWsLocalPlayerUpdate(force: boolean = false) {
    if (!this.engine || !this.connected || this.transport !== 'websocket') return;

    const now = Date.now();
    const rawPayload = this.buildPlayerDocPayload(false);
    const currentSnapshot = this.snapshotFromPayload(rawPayload, now);
    const prev = this.lastSyncedPayload;
    const { delta, hasAnyChange } = this.buildDeltaFields(currentSnapshot, prev);

    if (hasAnyChange) {
      this.touchRoomActivity();
    }

    const heartbeatDue = !prev || now - prev.sentAt >= this.getAdaptiveHeartbeatIntervalMs();
    if (!force && !hasAnyChange && !heartbeatDue) {
      this.syncStats.updatesSkipped += 1;
      this.notifyTelemetryThrottled();
      return;
    }

    this.outboundSeq += 1;
    const deltaPayload = hasAnyChange ? { id: this.playerId, ...delta } : { id: this.playerId };

    this.sendWs({
      type: 'player_update',
      roomId: this.roomId,
      senderId: this.playerId,
      seq: this.outboundSeq,
      payload: deltaPayload,
    });

    this.syncStats.updatesSent += 1;
    this.lastSyncedPayload = {
      ...(prev || currentSnapshot),
      ...(hasAnyChange ? delta : {}),
      sentAt: now,
    } as PlayerSyncSnapshot;
    this.notifyTelemetryThrottled();
  }

  private handleWsMessage(msg: any) {
    if (!msg || typeof msg !== 'object') {
      this.syncStats.packetsRejected += 1;
      return;
    }

    const { type, roomId, senderId, seq, payload } = msg;
    if (typeof type !== 'string') {
      this.syncStats.packetsRejected += 1;
      return;
    }

    if (roomId && String(roomId).trim().toUpperCase() !== this.roomId && type !== 'room_expired') {
      this.syncStats.packetsRejected += 1;
      return;
    }

    if (senderId === this.playerId && type !== 'room_joined' && type !== 'chat') return;
    if (type !== 'room_expired' && type !== 'room_joined' && !isValidIdString(senderId)) {
      this.syncStats.packetsRejected += 1;
      return;
    }

    if (type === 'room_joined') {
      this.touchRoomActivity();
      this.notify();
    } else if (type === 'room_full') {
      this.manualDisconnect = true;
      this.error = payload?.message || `Sala cheia (limite de ${MAX_ROOM_PLAYERS} jogadores).`;
      this.disconnectWebSocket();
    } else if (type === 'pong_probe') {
      if (typeof payload?.t === 'number' && Number.isFinite(payload.t)) {
        this.ping = Math.max(1, Math.round(Date.now() - payload.t));
        this.notifyTelemetryThrottled();
      }
    } else if (type === 'player_joined') {
      this.touchRoomActivity();
      this.lastSyncedPayload = null;
      this.sendWsLocalPlayerUpdate(true);
      if (this.engine) {
        this.engine.spawnPowerUpSparkles?.(this.engine.marioX, this.engine.marioY);
        const remotes = Array.from(this.engine.remotePlayers.values());
        const isCoordinator = remotes.every((rp) => this.playerId <= rp.id);
        if (isCoordinator && this.engine.level) {
          this.broadcastWorldEvent('level_change', {
            x: 0,
            y: 0,
            meta: `sync:${this.engine.level.id}|${this.engine.level.endlessStage || 0}|${this.engine.level.seed || 1001}`,
          });
        }
      }
      this.reconcileAdaptiveSyncRate();
      this.notify();
    } else if (type === 'player_left') {
      if (this.engine && senderId) {
        const leftPlayer = this.engine.remotePlayers.get(senderId);
        const leftName = (typeof payload?.name === 'string' && payload.name.slice(0, 32)) || leftPlayer?.name || 'Jogador';
        this.engine.remotePlayers.delete(senderId);
        this.remoteLastSeq.delete(senderId);
        this.emitLogoffEvent({
          type: 'remote_logoff',
          playerName: leftName,
          message: `${leftName} desconectou / saiu da sala.`,
        });
      }
      this.reconcileAdaptiveSyncRate();
      this.notify();
    } else if (type === 'room_expired') {
      this.manualDisconnect = true;
      const msgText = payload?.message || 'Sala removida automaticamente após 5 minutos de inatividade.';
      this.error = msgText;
      this.emitLogoffEvent({
        type: 'room_inactive',
        message: msgText,
      });
      this.disconnectWebSocket();
    } else if (type === 'player_update') {
      if (!this.engine || !payload || typeof payload !== 'object') {
        this.syncStats.packetsRejected += 1;
        return;
      }

      // Discard out-of-order / duplicate packets per sender (allow reset on reconnect)
      if (typeof seq === 'number' && Number.isFinite(seq)) {
        const prevSeq = this.remoteLastSeq.get(senderId) ?? 0;
        if (seq <= prevSeq && !(seq <= 3 && prevSeq > 10)) {
          this.syncStats.packetsRejected += 1;
          return;
        }
        this.remoteLastSeq.set(senderId, seq);
      }

      const prev = this.engine.remotePlayers.get(senderId);
      const nextX = typeof payload.x === 'number' && Number.isFinite(payload.x) ? clamp(payload.x, -100, 20000) : (prev?.x ?? 40);
      const nextY = typeof payload.y === 'number' && Number.isFinite(payload.y) ? clamp(payload.y, -200, 1000) : (prev?.y ?? 192);

      const remoteState: RemotePlayerState = {
        id: senderId,
        name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 32) : (prev?.name ?? 'Jogador'),
        photoUrl: typeof payload.photoUrl === 'string' ? payload.photoUrl.slice(0, 300) : (prev?.photoUrl ?? ''),
        character: payload.character === 'mario' || payload.character === 'wazzima' ? payload.character : (prev?.character ?? 'wazzima'),
        x: nextX,
        y: nextY,
        targetX: nextX,
        targetY: nextY,
        renderX: prev?.renderX ?? nextX,
        renderY: prev?.renderY ?? nextY,
        vx: typeof payload.vx === 'number' && Number.isFinite(payload.vx) ? clamp(payload.vx, -50, 50) : (prev?.vx ?? 0),
        vy: typeof payload.vy === 'number' && Number.isFinite(payload.vy) ? clamp(payload.vy, -50, 50) : (prev?.vy ?? 0),
        facing: payload.facing === 'left' || payload.facing === 'right' ? payload.facing : (prev?.facing ?? 'right'),
        power: payload.power !== undefined ? sanitizePowerForClient(payload.power) : (prev?.power ?? 'small'),
        state: payload.state !== undefined ? sanitizeState(payload.state) : (prev?.state ?? 'idle'),
        animFrame: typeof payload.animFrame === 'number' && Number.isFinite(payload.animFrame) ? clamp(Math.floor(payload.animFrame), 0, 10) : (prev?.animFrame ?? 0),
        isStatue: typeof payload.isStatue === 'boolean' ? payload.isStatue : Boolean(prev?.isStatue),
        tailWhipTimer: typeof payload.tailWhipTimer === 'number' && Number.isFinite(payload.tailWhipTimer) ? clamp(Math.floor(payload.tailWhipTimer), 0, 100) : (prev?.tailWhipTimer ?? 0),
        isFluttering: typeof payload.isFluttering === 'boolean' ? payload.isFluttering : Boolean(prev?.isFluttering),
        invulnerable: typeof payload.invulnerable === 'boolean' ? payload.invulnerable : Boolean(prev?.invulnerable),
        score: typeof payload.score === 'number' && Number.isFinite(payload.score) ? Math.max(0, Math.floor(payload.score)) : (prev?.score ?? 0),
        lives: typeof payload.lives === 'number' && Number.isFinite(payload.lives) ? clamp(Math.floor(payload.lives), 0, 999) : (prev?.lives ?? 3),
        coins: typeof payload.coins === 'number' && Number.isFinite(payload.coins) ? clamp(Math.floor(payload.coins), 0, 999) : (prev?.coins ?? 0),
        stageCleared: typeof payload.stageCleared === 'boolean' ? payload.stageCleared : Boolean(prev?.stageCleared),
        levelId: typeof payload.levelId === 'string' ? payload.levelId.slice(0, 64) : prev?.levelId,
        seq: typeof seq === 'number' ? seq : prev?.seq,
        lastUpdated: Date.now(),
      };

      if (
        !prev ||
        Math.abs(remoteState.x - prev.x) >= 1.5 ||
        Math.abs(remoteState.y - prev.y) >= 1.5 ||
        remoteState.state !== prev.state ||
        remoteState.score !== prev.score
      ) {
        this.touchRoomActivity();
      }
      this.engine.remotePlayers.set(senderId, remoteState);
      this.reconcileAdaptiveSyncRate();
      this.engine.evaluateMultiplayerMatchEnd();
    } else if (type === 'world_event') {
      this.touchRoomActivity();
      if (this.engine && payload && typeof payload === 'object') {
        const { eventType, data } = payload;
        if (!VALID_WORLD_EVENT_TYPES.has(eventType)) {
          this.syncStats.packetsRejected += 1;
          return;
        }
        if (eventType === 'level_change' && data?.meta === 'rematch') {
          this.isApplyingRemoteLevel = true;
          this.engine.restartMultiplayerMatch(createWorld1_1(), false);
          this.isApplyingRemoteLevel = false;
          this.syncNow();
        } else if (eventType === 'level_change' && typeof data?.meta === 'string' && data.meta.startsWith('sync:')) {
          const [, remoteLevelId, remoteStageStr, remoteSeedStr] = data.meta.split('|');
          if (remoteLevelId) {
            this.applyRemoteRoomLevel(
              remoteLevelId,
              Number(remoteStageStr) || 0,
              Number(remoteSeedStr) || 1001
            );
          }
        } else if (data && typeof data.x === 'number' && typeof data.y === 'number' && Number.isFinite(data.x) && Number.isFinite(data.y)) {
          this.replayRemoteWorldEvent(eventType, clamp(data.x, -100, 20000), clamp(data.y, -200, 1000));
        }
      }
    } else if (type === 'world_events_batch') {
      this.touchRoomActivity();
      if (this.engine && Array.isArray(payload?.events)) {
        for (const ev of payload.events.slice(0, 20)) {
          if (
            !ev ||
            !VALID_WORLD_EVENT_TYPES.has(ev.eventType) ||
            typeof ev.x !== 'number' ||
            typeof ev.y !== 'number' ||
            !Number.isFinite(ev.x) ||
            !Number.isFinite(ev.y)
          ) {
            this.syncStats.packetsRejected += 1;
            continue;
          }
          this.replayRemoteWorldEvent(ev.eventType, clamp(ev.x, -100, 20000), clamp(ev.y, -200, 1000));
        }
      }
    } else if (type === 'chat' && payload && typeof payload.text === 'string') {
      this.touchRoomActivity();
      this.chatListeners.forEach((cb) =>
        cb({
          name: typeof payload.name === 'string' ? payload.name.slice(0, 32) : 'Jogador',
          character: payload.character === 'mario' ? 'mario' : 'wazzima',
          text: payload.text.slice(0, 120),
          time: typeof payload.time === 'number' && Number.isFinite(payload.time) ? payload.time : Date.now(),
        })
      );
    }
  }

  // --- SHARED EVENTS & CHAT (WITH BATCHING & DEDUPLICATION) ---
  public async broadcastWorldEvent(
    eventType: 'enemy_defeat' | 'coin_collect' | 'brick_break' | 'level_change',
    data: { x: number; y: number; meta?: string }
  ) {
    if (!this.connected) return;
    this.touchRoomActivity();

    // Critical level transitions bypass batching immediately
    if (eventType === 'level_change') {
      if (this.transport === 'websocket') {
        this.outboundSeq += 1;
        this.sendWs({
          type: 'world_event',
          roomId: this.roomId,
          senderId: this.playerId,
          seq: this.outboundSeq,
          payload: { eventType, data },
        });
        return;
      }
      if (!this.authUser) return;
      const eventId = `${this.authUser.uid}_${Date.now()}_lvl`;
      const eventPath = `rooms/${this.roomId}/events/${eventId}`;
      try {
        await setDoc(doc(db, 'rooms', this.roomId, 'events', eventId), {
          uid: this.authUser.uid,
          roomId: this.roomId,
          eventType,
          x: Number(clamp(data.x || 0, -100, 20000).toFixed(1)),
          y: Number(clamp(data.y || 0, -200, 1000).toFixed(1)),
          meta: String(data.meta || '').slice(0, 64),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, eventPath);
      }
      return;
    }

    // Spatial deduplication within active batch window (avoids double writes on multi-hit ticks)
    const qx = Math.round(clamp(data.x || 0, -100, 20000));
    const qy = Math.round(clamp(data.y || 0, -200, 1000));
    const dedupKey = `${eventType}:${Math.round(qx / 16)}:${Math.round(qy / 16)}`;
    if (this.pendingWorldEventKeys.has(dedupKey)) {
      this.syncStats.eventsBatched += 1;
      this.notifyTelemetryThrottled();
      return;
    }

    this.pendingWorldEventKeys.add(dedupKey);
    this.pendingWorldEvents.push({
      eventType,
      x: qx,
      y: qy,
      meta: data.meta,
    });

    if (this.pendingWorldEvents.length >= 6) {
      await this.flushWorldEventBatch();
    } else if (!this.worldEventBatchTimer) {
      this.worldEventBatchTimer = setTimeout(() => {
        this.flushWorldEventBatch();
      }, this.getAdaptiveBatchWindowMs());
    }
  }

  private async flushWorldEventBatch() {
    if (this.worldEventBatchTimer) {
      clearTimeout(this.worldEventBatchTimer);
      this.worldEventBatchTimer = null;
    }
    if (this.pendingWorldEvents.length === 0 || !this.connected) {
      this.pendingWorldEvents = [];
      this.pendingWorldEventKeys.clear();
      return;
    }

    const batch = this.pendingWorldEvents.splice(0, this.pendingWorldEvents.length);
    this.pendingWorldEventKeys.clear();

    if (this.transport === 'websocket') {
      this.outboundSeq += 1;
      if (batch.length === 1) {
        const ev = batch[0];
        this.sendWs({
          type: 'world_event',
          roomId: this.roomId,
          senderId: this.playerId,
          seq: this.outboundSeq,
          payload: { eventType: ev.eventType, data: { x: ev.x, y: ev.y, meta: ev.meta } },
        });
      } else {
        this.syncStats.eventsBatched += batch.length - 1;
        this.sendWs({
          type: 'world_events_batch',
          roomId: this.roomId,
          senderId: this.playerId,
          seq: this.outboundSeq,
          payload: { events: batch },
        });
        this.notifyTelemetryThrottled();
      }
      return;
    }

    if (!this.authUser || !this.networkOnline) return;

    if (batch.length === 1) {
      const ev = batch[0];
      const eventId = `${this.authUser.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const eventPath = `rooms/${this.roomId}/events/${eventId}`;
      try {
        await setDoc(doc(db, 'rooms', this.roomId, 'events', eventId), {
          uid: this.authUser.uid,
          roomId: this.roomId,
          eventType: ev.eventType,
          x: ev.x,
          y: ev.y,
          meta: String(ev.meta || '').slice(0, 64),
          createdAt: serverTimestamp(),
        });
        this.trackAndPruneOwnEvents(eventId);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, eventPath);
      }
      return;
    }

    // Pack multiple world events into compact `b:<type@x,y|...>` strings (<= 64 chars per Firestore doc)
    const chunks: QueuedWorldEvent[][] = [];
    let currentChunk: QueuedWorldEvent[] = [];
    let currentLen = 2; // 'b:'
    for (const ev of batch) {
      const token = `${encodeEventCode(ev.eventType)}@${ev.x},${ev.y}`;
      const extra = (currentChunk.length > 0 ? 1 : 0) + token.length;
      if (currentChunk.length > 0 && currentLen + extra > 64) {
        chunks.push(currentChunk);
        currentChunk = [ev];
        currentLen = 2 + token.length;
      } else {
        currentChunk.push(ev);
        currentLen += extra;
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    let mergedSavings = 0;
    for (const chunk of chunks) {
      const first = chunk[0];
      const meta =
        chunk.length === 1
          ? String(first.meta || '').slice(0, 64)
          : `b:${chunk.map((c) => `${encodeEventCode(c.eventType)}@${c.x},${c.y}`).join('|')}`.slice(0, 64);
      if (chunk.length > 1) {
        mergedSavings += chunk.length - 1;
      }
      const eventId = `${this.authUser.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const eventPath = `rooms/${this.roomId}/events/${eventId}`;
      try {
        await setDoc(doc(db, 'rooms', this.roomId, 'events', eventId), {
          uid: this.authUser.uid,
          roomId: this.roomId,
          eventType: first.eventType,
          x: first.x,
          y: first.y,
          meta,
          createdAt: serverTimestamp(),
        });
        this.trackAndPruneOwnEvents(eventId);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, eventPath);
      }
    }
    if (mergedSavings > 0) {
      this.syncStats.eventsBatched += mergedSavings;
      this.notifyTelemetryThrottled();
    }
  }

  private trackAndPruneOwnEvents(newEventId: string) {
    const now = Date.now();
    this.ownEmittedEventIds.push({ id: newEventId, createdAtMs: now });
    let pruned = 0;
    while (this.ownEmittedEventIds.length > 2 && pruned < 2) {
      const oldest = this.ownEmittedEventIds[0];
      if (now - oldest.createdAtMs < 12000) break;
      this.ownEmittedEventIds.shift();
      deleteDoc(doc(db, 'rooms', this.roomId, 'events', oldest.id)).catch(() => {});
      pruned += 1;
    }
  }

  public async sendChatMessage(text: string) {
    const clean = text.trim().slice(0, 120);
    if (!this.connected || !clean) return;
    this.touchRoomActivity();

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
