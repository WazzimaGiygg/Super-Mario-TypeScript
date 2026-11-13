/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MarioPower = 'small' | 'super' | 'fire' | 'tanooki';

export type MarioState = 
  | 'idle' 
  | 'running' 
  | 'skidding' 
  | 'jumping' 
  | 'falling' 
  | 'crouching'
  | 'pole_slide' 
  | 'castle_walk' 
  | 'castle_entered'
  | 'pipe_entering' 
  | 'pipe_exiting' 
  | 'tail_whip'
  | 'growing' 
  | 'shrinking' 
  | 'dead';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export type TileType = 
  | 'empty'
  | 'ground'
  | 'brick'
  | 'question'
  | 'question_empty'
  | 'hard_block'
  | 'pipe_top_left'
  | 'pipe_top_right'
  | 'pipe_body_left'
  | 'pipe_body_right'
  | 'pipe_warp_top_left'
  | 'pipe_warp_top_right'
  | 'pipe_horiz_top'
  | 'pipe_horiz_bottom'
  | 'pole'
  | 'pole_top'
  | 'castle_brick'
  | 'castle_crenel'
  | 'castle_door'
  | 'castle_window'
  | 'underground_ground'
  | 'underground_brick';

export type ItemContent = 'coin' | 'mushroom' | 'fireflower' | 'leaf' | 'star' | '1up' | 'none';

export interface BlockTile {
  type: TileType;
  content: ItemContent;
  bumpOffset: number; // for block hitting animation
  bumpVel: number;
  coinsLeft?: number;
  invisible?: boolean;
}

export type EnemyType = 'goomba' | 'koopa' | 'piranha';

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  alive: boolean;
  state: 'walk' | 'squashed' | 'shell_idle' | 'shell_moving' | 'flipped' | 'rising' | 'lowering';
  stateTimer: number;
  facing: 'left' | 'right';
  animFrame: number;
  animTimer: number;
  pipeOriginY?: number;
}

export interface Item {
  id: number;
  type: 'mushroom' | 'fireflower' | 'leaf' | 'star' | '1up' | 'coin';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  collected: boolean;
  emerging: boolean;
  emergeY: number;
}

export interface Fireball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  exploding: boolean;
  explodeTimer: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'brick_piece' | 'score_text' | 'smoke' | 'sparkle' | 'coin_glint' | 'enemy_poof' | 'star_burst';
  text?: string;
  life: number;
  maxLife: number;
  color?: string;
  size?: number;
  gravity?: number;
  rotation?: number;
  rotSpeed?: number;
}

export interface LevelData {
  id: string;
  name: string;
  theme: 'overworld' | 'underground' | 'castle';
  width: number; // in tiles (16px per tile)
  height: number; // usually 15 tiles (240px)
  tiles: (BlockTile | null)[][]; // [y][x]
  enemies: { type: EnemyType; x: number; y: number }[];
  coins: Point[];
  marioStart: Point;
  flagX: number;
  castleX: number;
  pipeWarps?: {
    from: Rect;
    toLevel: string;
    toPos: Point;
    type: 'down' | 'right';
  }[];
  bgColor: string;
  timeLimit: number;
  endlessStage?: number;
  enemySpeedMultiplier?: number;
  checkpoints?: { x: number; respawnPos: Point }[];
}

export type GameDifficulty = 'easy' | 'normal' | 'hard';
export type ResolutionScale = '0.5x' | '0.75x' | '1x' | '1.25x' | '1.5x' | '2x' | 'fit';

export interface GameStats {
  score: number;
  coins: number;
  world: string;
  time: number;
  lives: number;
  highScore: number;
  difficulty?: GameDifficulty;
}

export interface GamepadControls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  run: boolean;
  pause: boolean;
}

export type PlayerCharacter = 'mario' | 'wazzima';

export type MultiplayerTransport = 'firebase' | 'websocket';

export interface FirebaseUserSummary {
  uid: string;
  displayName: string;
  email: string;
  photoUrl: string;
}

export interface FirebaseRoomSummary {
  roomId: string;
  hostUid: string;
  hostName: string;
  levelId: string;
  endlessStage: number;
  seed: number;
  status: 'open' | 'playing' | 'closed';
}

export interface RemotePlayerState {
  id: string;
  name: string;
  photoUrl?: string;
  character: PlayerCharacter;
  x: number;
  y: number;
  renderX?: number;
  renderY?: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  power: MarioPower;
  state: MarioState;
  animFrame: number;
  isStatue?: boolean;
  tailWhipTimer?: number;
  isFluttering?: boolean;
  invulnerable?: boolean;
  score: number;
  lives: number;
  coins: number;
  lastUpdated: number;
}

export interface MultiplayerMessage {
  type: 
    | 'join'
    | 'room_joined'
    | 'player_joined'
    | 'player_left'
    | 'player_update'
    | 'world_event'
    | 'chat';
  roomId: string;
  senderId: string;
  payload?: any;
}

export interface MultiplayerStatus {
  transport: MultiplayerTransport;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  serverAddress: string;
  roomId: string;
  playerId: string;
  playerName: string;
  character: PlayerCharacter;
  playerCount: number;
  ping: number;
  authUser: FirebaseUserSummary | null;
  isHost: boolean;
  availableRooms: FirebaseRoomSummary[];
}

