import { MultiplayerMessage, MultiplayerStatus, PlayerCharacter, RemotePlayerState } from './types.ts';
import { GameEngine } from './engine.ts';

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private engine: GameEngine | null = null;
  private serverAddress: string = '';
  private roomId: string = 'SALA-1';
  private playerId: string = Math.random().toString(36).substring(2, 9);
  private playerName: string = 'WazzimaGiygg';
  private character: PlayerCharacter = 'wazzima';
  private connected: boolean = false;
  private connecting: boolean = false;
  private error: string | null = null;
  private ping: number = 0;
  private lastPingSentTime: number = 0;
  private sendInterval: any = null;
  private listeners: ((status: MultiplayerStatus) => void)[] = [];
  private chatListeners: ((chat: { name: string; character: PlayerCharacter; text: string; time: number }) => void)[] = [];

  constructor() {
    // Default server address to current window host
    if (typeof window !== 'undefined') {
      this.serverAddress = window.location.host;
    }
  }

  public setEngine(engine: GameEngine) {
    this.engine = engine;
    this.engine.playerCharacter = this.character;
  }

  public subscribe(cb: (status: MultiplayerStatus) => void) {
    this.listeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  public onChat(cb: (chat: { name: string; character: PlayerCharacter; text: string; time: number }) => void) {
    this.chatListeners.push(cb);
    return () => {
      this.chatListeners = this.chatListeners.filter(l => l !== cb);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach(cb => cb(status));
  }

  public getStatus(): MultiplayerStatus {
    const remoteCount = this.engine ? this.engine.remotePlayers.size : 0;
    return {
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
    };
  }

  public setConfig(options: {
    serverAddress?: string;
    roomId?: string;
    playerName?: string;
    character?: PlayerCharacter;
  }) {
    if (options.serverAddress !== undefined) this.serverAddress = options.serverAddress.trim();
    if (options.roomId !== undefined) this.roomId = options.roomId.trim().toUpperCase() || 'SALA-1';
    if (options.character !== undefined) {
      this.character = options.character;
      if (this.engine) this.engine.playerCharacter = options.character;
    }
    if (options.playerName !== undefined) {
      this.playerName = options.playerName.trim();
    } else if (options.character !== undefined) {
      // Auto default name if not customized
      this.playerName = options.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario';
    }
    this.notify();
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.connecting = true;
    this.error = null;
    this.notify();

    try {
      // Build WebSocket URL from serverAddress
      let target = this.serverAddress.trim();
      if (!target) {
        target = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
      }

      // Remove any leading http://, https://, ws://, wss://
      target = target.replace(/^(https?:\/\/|wss?:\/\/)/i, '');
      const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' && !target.startsWith('localhost') && !target.startsWith('127.0.0.1');
      const protocol = isSecure ? 'wss://' : 'ws://';
      const wsUrl = `${protocol}${target}/ws`;

      console.log(`[Multiplayer] Connecting to ${wsUrl} in room ${this.roomId}...`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.connecting = false;
        this.error = null;
        console.log(`[Multiplayer] Connected! Joining room ${this.roomId} as ${this.character} (${this.playerName})`);

        // Send Join Message
        this.send({
          type: 'join',
          roomId: this.roomId,
          senderId: this.playerId,
          payload: {
            name: this.playerName,
            character: this.character,
          },
        });

        // Start ping & send loop
        this.startSyncLoop();
        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[Multiplayer] Failed to parse message', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Multiplayer] WebSocket error', err);
        this.error = 'Não foi possível conectar ao servidor. Verifique o IP/Host.';
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
        console.log('[Multiplayer] Disconnected from room');
        this.notify();
      };
    } catch (e: any) {
      this.connecting = false;
      this.connected = false;
      this.error = e?.message || 'Erro ao inicializar conexão WebSocket';
      this.notify();
    }
  }

  public disconnect() {
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

  private send(msg: MultiplayerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private startSyncLoop() {
    this.stopSyncLoop();
    // Send state 30 times a second (~33ms)
    this.sendInterval = setInterval(() => {
      this.sendLocalPlayerUpdate();
    }, 33);
  }

  private stopSyncLoop() {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
  }

  private sendLocalPlayerUpdate() {
    if (!this.engine || !this.connected) return;

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

    this.send({
      type: 'player_update',
      roomId: this.roomId,
      senderId: this.playerId,
      payload,
    });
  }

  public broadcastWorldEvent(eventType: string, data: any) {
    if (!this.connected) return;
    this.send({
      type: 'world_event',
      roomId: this.roomId,
      senderId: this.playerId,
      payload: {
        eventType,
        data,
      },
    });
  }

  public sendChatMessage(text: string) {
    if (!this.connected || !text.trim()) return;
    this.send({
      type: 'chat',
      roomId: this.roomId,
      senderId: this.playerId,
      payload: {
        text: text.trim(),
      },
    });
  }

  private handleMessage(msg: any) {
    const { type, senderId, payload } = msg;
    if (senderId === this.playerId) return;

    if (type === 'room_joined') {
      console.log('[Multiplayer] Joined room payload:', payload);
      this.notify();
    } else if (type === 'player_joined') {
      console.log(`[Multiplayer] Player joined: ${payload?.name} (${payload?.character})`);
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
        const remoteState: RemotePlayerState = {
          ...payload,
          id: senderId,
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
      this.chatListeners.forEach(cb => cb(payload));
    }
  }
}

// Global Singleton for Multiplayer Client
export const multiplayerClient = new MultiplayerClient();
