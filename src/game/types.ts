/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MarioPower = 'small' | 'super' | 'fire' | 'tanooki' | 'femboy' | 'cape';

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
  | 'castle_stone'
  | 'castle_crenel'
  | 'castle_door'
  | 'castle_window'
  | 'underground_ground'
  | 'underground_brick'
  | 'coral'
  | 'sea_ground'
  | 'lava'
  | 'bridge'
  | 'axe'
  | 'ghost_floor'
  | 'ghost_brick';

export type ItemContent = 'coin' | 'mushroom' | 'fireflower' | 'leaf' | 'feather' | 'femboy' | 'star' | '1up' | 'none';

export interface BlockTile {
  type: TileType;
  content: ItemContent;
  bumpOffset: number; // for block hitting animation
  bumpVel: number;
  coinsLeft?: number;
  invisible?: boolean;
}

export type EnemyType =
  | 'goomba'
  | 'koopa'
  | 'red_koopa'
  | 'paratroopa'
  | 'hammer_bro'
  | 'piranha'
  | 'blooper'
  | 'cheep_cheep'
  | 'fast_cheep'
  | 'bullet_bill'
  | 'bowser'
  | 'lava_bubble'
  | 'boo'
  | 'dry_bones';

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
  hp?: number;
  hitFlashTimer?: number;
  originX?: number;
  fireTimer?: number;
  shellKillStreak?: number;
}

export interface Item {
  id: number;
  type: 'mushroom' | 'fireflower' | 'leaf' | 'feather' | 'femboy' | 'star' | '1up' | 'coin';
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
  color?: 'fire' | 'white';
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type:
    | 'brick_piece'
    | 'debris'
    | 'impact_ring'
    | 'score_text'
    | 'smoke'
    | 'dust'
    | 'sparkle'
    | 'coin_glint'
    | 'enemy_poof'
    | 'star_burst'
    | 'bubble'
    | 'heart';
  text?: string;
  life: number;
  maxLife: number;
  color?: string;
  secondaryColor?: string;
  shape?: 'chunk' | 'splinter' | 'shell';
  size?: number;
  gravity?: number;
  rotation?: number;
  rotSpeed?: number;
}

export interface FloatingPlatformSpec {
  x: number;
  y: number;
  width: number;
  height?: number;
  axis: 'horizontal' | 'vertical' | 'bob';
  range: number;
  speed: number;
  phase?: number;
}

export interface LevelData {
  id: string;
  name: string;
  theme: 'overworld' | 'underground' | 'castle' | 'underwater' | 'ghost_house';
  width: number; // in tiles (16px per tile)
  height: number; // usually 15 tiles (240px)
  tiles: (BlockTile | null)[][]; // [y][x]
  enemies: { type: EnemyType; x: number; y: number }[];
  coins: Point[];
  marioStart: Point;
  flagX: number;
  castleX: number;
  dryFinishStartX?: number;
  pipeWarps?: {
    from: Rect;
    toLevel: string;
    toPos: Point;
    type: 'down' | 'right';
  }[];
  bgColor: string;
  timeLimit: number;
  endlessStage?: number;
  cycleNumber?: number;
  seed?: number;
  enemySpeedMultiplier?: number;
  biomeLabel?: string;
  checkpoints?: { x: number; respawnPos: Point }[];
  floatingPlatforms?: FloatingPlatformSpec[];
  isCustom?: boolean;
  singleplayerWorld?: number;
  singleplayerStage?: number;
  isFinalCastle?: boolean;
  smwNodeId?: string;
  smwWorldName?: string;
}

export type GameMode = 'classic' | 'singleplayer' | 'smw_world_map';
export type GameDifficulty = 'easy' | 'normal' | 'hard';
export type ResolutionScale = '0.5x' | '0.75x' | '1x' | '1.25x' | '1.5x' | '2x' | 'fit';

export type DebugPlaceableId =
  | 'coin'
  | 'mushroom'
  | 'fireflower'
  | 'leaf'
  | 'feather'
  | 'femboy'
  | 'star'
  | '1up'
  | 'question_coin'
  | 'question_mushroom'
  | 'brick'
  | 'hard_block'
  | 'goomba'
  | 'koopa'
  | 'red_koopa'
  | 'paratroopa'
  | 'hammer_bro'
  | 'boo'
  | 'dry_bones';

export interface DebugPlaceableSpec {
  id: DebugPlaceableId;
  label: string;
  category: 'item' | 'tile' | 'enemy';
}

export interface GameStats {
  score: number;
  coins: number;
  world: string;
  time: number;
  lives: number;
  highScore: number;
  difficulty?: GameDifficulty;
  isNewHighScore?: boolean;
  isDebugMode?: boolean;
  isDebugPlacementActive?: boolean;
  debugX?: number;
  debugY?: number;
  debugSelectedItemId?: DebugPlaceableId;
  debugSelectedItemLabel?: string;
  isIllegalInstructionBug?: boolean;
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
  updatedAtMs?: number;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  photoUrl?: string;
  character: PlayerCharacter;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
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
  stageCleared?: boolean;
  levelId?: string;
  seq?: number;
  lastUpdated: number;
}

export interface MultiplayerMatchPlayerStanding {
  id: string;
  name: string;
  photoUrl?: string;
  character: PlayerCharacter;
  score: number;
  coins: number;
  lives: number;
  isLocal: boolean;
}

export interface MultiplayerMatchResult {
  loserNames: string[];
  isTie: boolean;
  winner: MultiplayerMatchPlayerStanding;
  standings: MultiplayerMatchPlayerStanding[];
}

export interface MultiplayerLogoffEvent {
  type: 'remote_logoff' | 'local_logoff' | 'network_offline' | 'room_inactive';
  message: string;
  playerName?: string;
  timestamp: number;
}

export interface MultiplayerMessage {
  type:
    | 'join'
    | 'room_joined'
    | 'room_full'
    | 'player_joined'
    | 'player_left'
    | 'player_update'
    | 'world_event'
    | 'world_events_batch'
    | 'chat'
    | 'room_expired'
    | 'ping_probe'
    | 'pong_probe';
  roomId: string;
  senderId: string;
  seq?: number;
  payload?: any;
}

export interface MultiplayerSyncStats {
  updatesSent: number;
  updatesSkipped: number;
  eventsBatched: number;
  packetsRejected: number;
}

export interface MultiplayerStatus {
  transport: MultiplayerTransport;
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  reconnectAttempt: number;
  error: string | null;
  serverAddress: string;
  roomId: string;
  playerId: string;
  playerName: string;
  character: PlayerCharacter;
  playerCount: number;
  maxRoomPlayers: number;
  ping: number;
  syncRateHz: number;
  effectiveSyncRateHz: number;
  adaptiveScaling: boolean;
  syncStats: MultiplayerSyncStats;
  authUser: FirebaseUserSummary | null;
  isHost: boolean;
  availableRooms: FirebaseRoomSummary[];
  networkOnline: boolean;
  inactivityRemainingSec: number | null;
}
