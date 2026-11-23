/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MarioPower,
  MarioState,
  Rect,
  Point,
  BlockTile,
  Enemy,
  EnemyType,
  Item,
  Fireball,
  Particle,
  LevelData,
  GameStats,
  GamepadControls,
  TileType,
  GameMode,
  GameDifficulty,
  SmwSwitchColor,
  PlayerCharacter,
  RemotePlayerState,
  MultiplayerMatchPlayerStanding,
  MultiplayerMatchResult,
  DebugPlaceableId,
  DebugPlaceableSpec,
  BonusBlockFace,
  BonusStageBlock,
  ReservePowerItem,
  YoshiEntity,
  CarryableKind,
  CarryableObject,
  KeyholeEntity,
} from './types.ts';
import { SpriteAtlas, NES_COLORS } from './sprites.ts';
import { SoundEngine } from './audio.ts';
import { ParticleSystem } from './particles.ts';
import { EnemySpawnManager } from './enemySpawnManager.ts';
import { CameraSystem } from './camera.ts';
import {
  createWorld1_1,
  createSecretVault,
  createWorld1_2,
  createWorld2_2,
  createWorldGhostHouse,
  createWorld1_4,
  createEndlessLevel,
  createSingleplayerLevel,
  SINGLEPLAYER_WORLD_COUNT,
  SINGLEPLAYER_STAGES_PER_WORLD,
  cloneLevelData,
  sanitizeCustomLevelEntities,
  computeStageWCoins,
  stripNonSmwPowerUpBoxes,
  isCastleStageForYoshi,
} from './levels.ts';
import { createSmwWikiWorldStage, createSmwWiki1SecretRoom } from './smwWorldMap.ts';
import { getTopScore, updateTopScore, saveNewScore, getLastPlayerName } from './scoreboard.ts';
import {
  AchievementManager,
  AchievementMetric,
  AchievementProgressView,
  AchievementUnlockEvent,
} from './achievements.ts';

export class GameEngine {
  // Screen Dimensions (NES native 256x240)
  public static readonly NES_WIDTH = 256;
  public static readonly NES_HEIGHT = 240;
  public static readonly TILE_SIZE = 16;

  // Level State
  public level!: LevelData;
  public camera: CameraSystem = new CameraSystem({
    viewportWidth: GameEngine.NES_WIDTH,
    characterWidth: 16,
  });
  public cameraX: number = 0;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public isStageClear: boolean = false;
  public isGameStarted: boolean = false;

  // Character & Multiplayer State
  public playerCharacter: PlayerCharacter = 'mario';
  public localPlayerId: string = 'local';
  public localPlayerName: string = 'Jogador';
  public localPlayerPhotoUrl: string = '';
  public isMultiplayerConnected: boolean = false;
  public isMultiplayerHost: boolean = true;
  public isMultiplayerFirebase: boolean = false;
  public localStageCleared: boolean = false;
  public waitingForPlayersFinish: boolean = false;
  public waitingPlayersNames: string[] = [];
  public stageArrivalNotice: string = '';
  public allPlayersClearedReady: boolean = false;
  public allPlayersClearedCountdown: number = 0;
  private notifiedArrivedPlayerIds: Set<string> = new Set();
  public isMultiplayerMatchOver: boolean = false;
  public multiplayerMatchResult: MultiplayerMatchResult | null = null;
  public onMultiplayerSyncNeeded?: () => void;
  public onMultiplayerWorldEvent?: (
    eventType: 'enemy_defeat' | 'coin_collect' | 'brick_break',
    x: number,
    y: number
  ) => void;
  public remotePlayers: Map<string, RemotePlayerState> = new Map();
  private remoteBadgeWidthCache: Map<string, number> = new Map();

  private isNearCamera(worldX: number): boolean {
    const camCenter = this.camera.renderX + GameEngine.NES_WIDTH * 0.5;
    return Math.abs(worldX - camCenter) <= GameEngine.NES_WIDTH * 0.85;
  }

  // Mario State
  public marioX: number = 40;
  public marioY: number = 192;
  public marioVx: number = 0;
  public marioVy: number = 0;
  public marioPower: MarioPower = 'small';
  public marioState: MarioState = 'idle';
  public marioFacing: 'left' | 'right' = 'right';
  public marioGrounded: boolean = false;
  public marioInvulnerableTimer: number = 0;
  public marioAnimFrame: number = 0;
  public marioAnimTimer: number = 0;
  public marioStarTimer: number = 0;
  public marioGrowthTimer: number = 0;
  public marioShrinkTimer: number = 0;
  public marioDeathTimer: number = 0;
  private marioTransitionFrom: MarioPower = 'small';
  private marioTransitionKind: 'grow' | 'power_flash' | 'shrink' = 'grow';
  private marioFireThrowTimer: number = 0;
  private starComboCount: number = 0;
  private stompComboCount: number = 0;
  private static readonly STOMP_COMBO_SCORES = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000] as const;
  private static readonly SHELL_STREAK_SCORES = [500, 800, 1000, 2000, 4000, 5000, 8000] as const;

  // Tanooki Suit State & SMW Spin Jump (R1.19.1CU.5)
  public tailWhipTimer: number = 0;
  public isFluttering: boolean = false;
  public isStatue: boolean = false;
  public isSpinJumping: boolean = false;
  public spinJumpTimer: number = 0;

  // Screen-Shake Effect (Heavy Landings, Large Enemy Stomps, Pipe Entry, Boss Impacts)
  public screenShakeTimer: number = 0;
  public screenShakeIntensity: number = 0;
  private screenShakeMaxDuration: number = 12;
  public screenShakeOffsetX: number = 0;
  public screenShakeOffsetY: number = 0;

  // Pipe Warp State & Authentic In-Pipe Visual Clipping
  public warpTimer: number = 0;
  public warpTarget: { toLevel: string; toPos: Point; returnPos?: Point } | null = null;
  public warpDir: 'down' | 'right' = 'down';
  public pipeExitDir: 'up' | 'down' | 'right' = 'up';
  public pipeClipLipY: number | null = null;
  public pipeClipLipX: number | null = null;

  // Flagpole / SMW Points Goal Gate & Stage Clear State
  public poleSlideY: number = 0;
  public flagY: number = 0;
  public castleWalkTargetX: number = 0;
  public stageClearTallyDelay: number = 0;
  public stageClearDelayTimer: number = 0;
  public timeCountTickCounter: number = 0;
  public goalTapeY: number = 44;
  public goalTapeDir: 1 | -1 = 1;
  public goalTapeCut: boolean = false;
  public goalPointsWallet: number = 0;
  public lastGoalGatePoints: number = 0;
  public pendingBonusStage: boolean = false;
  public isBonusStageActive: boolean = false;
  public bonusStageBlocks: BonusStageBlock[] = [];
  public bonusStageLivesWon: number = 0;
  public bonusStageFinishDelay: number = 0;
  public bonusStageIrisProgress: number = 0;
  public bonusStageTimeFrames: number = 0;
  public static readonly BONUS_BLOCK_FACES: readonly BonusBlockFace[] = [
    '1up',
    'mushroom',
    'flower',
    'feather',
    'leaf',
    'femboy',
  ];
  public onSmwGoalWalletChanged?: (wallet: number) => void;
  // R1.16.13U.4: Carteira de Power-UPs (SMW Reserve Item Box)
  public reservePowerUp: ReservePowerItem | null = null;
  // R1.16.OV.4: 4 Giant Floating W-Coins per stage
  public wCoinsCollected: number = 0;
  public wCoinsTotal: number = 0;
  private collectedWCoinIndices: Set<number> = new Set();
  private wCoinLifeAwardedThisStage: boolean = false;
  // R02.16.PG.4: SMW Castle Entrance Animation state
  public smwCastleEntryActive: boolean = false;
  public smwCastleEntryTimer: number = 0;
  public smwCastleBannerProgress: number = 0;
  public smwCastleIrisProgress: number = 0;
  private smwCastleTargetX: number = 0;
  private bonusReturnLevelMeta: {
    id: string;
    name: string;
    singleplayerWorld?: number;
    singleplayerStage?: number;
    isFinalCastle?: boolean;
    smwNodeId?: string;
    smwWorldName?: string;
    endlessStage?: number;
    isCustom?: boolean;
    onYoshi?: boolean;
  } | null = null;

  // Intermission & Endless Stage Tracking
  public intermissionTimer: number = 0;
  public endlessStage: number = 0;
  public onLevelChanged?: (level: LevelData) => void;

  // Checkpoint State
  public activeCheckpoint: Point | null = null;
  public activatedCheckpointIndices: Set<number> = new Set();

  // Entities
  public enemies: Enemy[] = [];
  public items: Item[] = [];
  public yoshis: YoshiEntity[] = [];
  public carryables: CarryableObject[] = [];
  public keyholes: KeyholeEntity[] = [];
  public heldCarryableId: number | null = null;
  public heldShellEnemyId: number | null = null;
  public pSwitchBlueTimer: number = 0;
  private pSwitchTransformedBlocks: { tx: number; ty: number; origX: number; origY: number }[] = [];
  public keyholeClearTimer: number = 0;
  public keyholeTransitionActive: boolean = false;
  public keyholeTotalTimer: number = 0;
  public activeKeyholeId: number | null = null;
  private keyholeKeyStartX: number = 0;
  private keyholeKeyStartY: number = 0;
  private keyholeKeyX: number = 0;
  private keyholeKeyY: number = 0;
  private keyholeHintCooldown: number = 0;
  public marioOnYoshi: boolean = false;
  public yoshiTongueTimer: number = 0;
  public yoshiTongueCooldown: number = 0;
  public yoshiRemountGraceTimer: number = 0;
  public fireballs: Fireball[] = [];
  public bossFireballs: { id: number; x: number; y: number; vx: number; animTimer: number }[] = [];
  public hammerProjectiles: { id: number; x: number; y: number; vx: number; vy: number; animTimer: number }[] = [];
  public floatingPlatforms: {
    id: number;
    originX: number;
    originY: number;
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    dx: number;
    dy: number;
    width: number;
    height: number;
    axis: 'horizontal' | 'vertical' | 'bob';
    range: number;
    speed: number;
    timer: number;
  }[] = [];
  private ridingPlatformId: number | null = null;
  public particleSystem: ParticleSystem = new ParticleSystem();
  public enemySpawnManager: EnemySpawnManager = new EnemySpawnManager();
  private skidDustTimer: number = 0;

  public get particles(): Particle[] {
    return this.particleSystem.particles;
  }

  // Castle Axe, Bridge Collapse, Toodle & Final Princesa Femboy Cutscene State
  public bridgeCollapseQueue: { tx: number; ty: number }[] = [];
  public bridgeCollapseTimer: number = 0;
  public castleToodleActive: boolean = false;
  public castleToodleX: number = 0;
  public castleToodleY: number = 0;
  public castleToodleDialogueTimer: number = 0;
  public castlePrincessActive: boolean = false;
  public castlePrincessX: number = 0;
  public castlePrincessY: number = 0;
  public castlePrincessDialogueTimer: number = 0;

  // Game Mode & Singleplayer 7-World Campaign + SMW Beta V0.9 World Map State
  public gameMode: GameMode = 'classic';
  public singleplayerWorld: number = 1;
  public singleplayerStage: number = 1;
  public isCampaignVictory: boolean = false;
  public lastClearWasSecretExit: boolean = false;
  public onSmwStageCompleted?: (nodeId: string, meta?: { secretExit?: boolean }) => void;
  public yellowSwitchUnlocked: boolean = false;
  public greenSwitchUnlocked: boolean = false;
  public redSwitchUnlocked: boolean = false;
  public pinkSwitchUnlocked: boolean = false;
  public blueSwitchUnlocked: boolean = false;
  public switchPalaceActivated: boolean = false;
  public onSmwYellowSwitchActivated?: () => void;
  public onSmwSwitchActivated?: (color: SmwSwitchColor) => void;

  // Scenery Elements (Bushes, Clouds, Hills)
  public sceneries: { type: string; x: number; y: number }[] = [];

  // Difficulty Setting: Easy (5 lives, start Super, more time), Normal (3 lives), Hard (1 life, aggressive timer)
  public difficulty: GameDifficulty = 'normal';

  // Stats & Scoring
  public stats: GameStats = {
    score: 0,
    coins: 0,
    world: '1-1',
    time: 400,
    lives: 3,
    highScore: getTopScore(),
    difficulty: 'normal',
    isNewHighScore: false,
    goalPointsWallet: 0,
    isBonusStage: false,
    bonusBlocksRemaining: 0,
    bonusLivesWon: 0,
    reservePowerUp: null,
    wCoinsCollected: 0,
    wCoinsTotal: 0,
  };

  // Local High Score & Ranking Run Tracking
  public currentRunId: string = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  private runInitialHighScore: number = getTopScore();
  public isNewHighScore: boolean = false;
  private hasTriggeredNewRecordBanner: boolean = false;
  public lastSavedRank: number | null = null;

  // Cheat Mode & Editor Immortality State
  public isCheatActive: boolean = false;
  public infiniteLives: boolean = false;
  public isEditorImmortality: boolean = false;
  private customLevelTemplate: LevelData | null = null;
  private customSubAreaOrigin: { levelTemplate: LevelData; returnPos: Point } | null = null;
  public customCampaignLevels: LevelData[] = [];
  public customCampaignIndex: number = 0;
  private keyCavePipeLipKeys: Set<string> = new Set();
  private ceilingTileColumns: boolean[] = [];

  // Achievement Tracking System
  public achievementManager: AchievementManager = new AchievementManager();
  public stageElapsedMs: number = 0;
  public recentAchievementUnlock: AchievementUnlockEvent | null = null;
  public onAchievementUnlocked?: (event: AchievementUnlockEvent) => void;
  public onAchievementsChanged?: (views: AchievementProgressView[]) => void;

  // Sonic-style Debug Mode & Item Placement Cursor
  public static readonly DEBUG_PLACEABLES: readonly DebugPlaceableSpec[] = [
    { id: 'coin', label: 'MOEDA', category: 'item' },
    { id: 'mushroom', label: 'COGUMELO', category: 'item' },
    { id: 'fireflower', label: 'FLOR DE FOGO', category: 'item' },
    { id: 'leaf', label: 'FOLHA TANOOKI', category: 'item' },
    { id: 'feather', label: 'PENA (CAPE)', category: 'item' },
    { id: 'femboy', label: 'LAÇO FEMBOY', category: 'item' },
    { id: 'star', label: 'ESTRELA', category: 'item' },
    { id: '1up', label: '1-UP', category: 'item' },
    { id: 'question_coin', label: 'BLOCO ? MOEDA', category: 'tile' },
    { id: 'exclam_yellow', label: 'BLOCO [!] SMW', category: 'tile' },
    { id: 'exclam_green', label: 'BLOCO [!] VERDE', category: 'tile' },
    { id: 'exclam_red', label: 'BLOCO [!] VERMELHO', category: 'tile' },
    { id: 'exclam_pink', label: 'BLOCO [!] ROSA', category: 'tile' },
    { id: 'exclam_blue', label: 'BLOCO [!] AZUL', category: 'tile' },
    { id: 'brick', label: 'TIJOLO', category: 'tile' },
    { id: 'hard_block', label: 'BLOCO DURO', category: 'tile' },
    { id: 'goomba', label: 'GOOMBA', category: 'enemy' },
    { id: 'koopa', label: 'KOOPA VERDE', category: 'enemy' },
    { id: 'red_koopa', label: 'KOOPA VERMELHO', category: 'enemy' },
    { id: 'paratroopa', label: 'PARATROOPA', category: 'enemy' },
    { id: 'hammer_bro', label: 'HAMMER BRO', category: 'enemy' },
    { id: 'boo', label: 'FANTASMA BOO', category: 'enemy' },
    { id: 'dry_bones', label: 'DRY BONES', category: 'enemy' },
    { id: 'yoshi', label: 'YOSHI', category: 'item' },
    { id: 'key', label: 'CHAVE SMW', category: 'item' },
    { id: 'keyhole', label: 'BURACO CHAVE', category: 'item' },
    { id: 'p_switch_blue', label: 'BOTÃO AZUL', category: 'item' },
    { id: 'p_switch_cyan', label: 'BOTÃO CIANO', category: 'item' },
  ];
  public isDebugMode: boolean = false;
  public isDebugPlacementActive: boolean = false;
  public debugPlaceIndex: number = 0;

  // Easter Egg: Abyss + Run -> "ILLEGAL INSTRUCTION" Glitched Screen
  public isIllegalInstructionBug: boolean = false;
  public illegalInstructionTimer: number = 0;
  private lastSafeGroundPos: Point = { x: 40, y: 192 };

  private timeAccumulator: number = 0;
  private nextEntityId: number = 1;
  private sound: SoundEngine;
  private atlas: SpriteAtlas;

  // Input states
  public controls: GamepadControls = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    run: false,
    spinJump: false,
    pause: false,
  };

  private prevControls: GamepadControls = { ...this.controls };

  constructor() {
    this.sound = SoundEngine.get();
    this.atlas = SpriteAtlas.get();
    this.loadLevel(createWorld1_1(), true, false);
  }

  public loadLevel(newLevel: LevelData, showIntermission: boolean = false, isRespawn: boolean = false, notifyNetwork: boolean = true) {
    let resolvedLevel = newLevel;
    const isSubAreaLevel =
      resolvedLevel.id === 'secret-vault' || resolvedLevel.id === 'smw-wiki-1-secret';
    if (isRespawn && isSubAreaLevel && this.customSubAreaOrigin) {
      resolvedLevel = cloneLevelData(this.customSubAreaOrigin.levelTemplate);
      this.customSubAreaOrigin = null;
    }
    if (resolvedLevel.isCustom) {
      if (!isRespawn) {
        const sanitized = sanitizeCustomLevelEntities(resolvedLevel).level;
        this.customLevelTemplate = cloneLevelData(sanitized);
        resolvedLevel = cloneLevelData(sanitized);
      } else if (this.customLevelTemplate) {
        resolvedLevel = cloneLevelData(this.customLevelTemplate);
      }
    } else if (!isRespawn && !isSubAreaLevel) {
      this.customLevelTemplate = null;
      this.customSubAreaOrigin = null;
      this.customCampaignLevels = [];
      this.customCampaignIndex = 0;
      this.isEditorImmortality = false;
      this.infiniteLives = this.isCheatActive;
    }
    if (resolvedLevel.isCustom && this.customCampaignLevels.length > 0 && !resolvedLevel.biomeLabel) {
      resolvedLevel.biomeLabel = resolvedLevel.name || 'CAMPANHA PERSONALIZADA';
    }
    resolvedLevel = stripNonSmwPowerUpBoxes(resolvedLevel);
    if (!isRespawn) {
      this.stageElapsedMs = 0;
    }
    this.level = resolvedLevel;
    this.keyCavePipeLipKeys = new Set();
    if (Array.isArray(resolvedLevel.pipeWarps)) {
      resolvedLevel.pipeWarps.forEach(pw => {
        if (pw.toLevel === 'smw-wiki-1-secret' && pw.type === 'down') {
          const lipTx = Math.floor(pw.from.x / GameEngine.TILE_SIZE);
          const lipTy = Math.floor((pw.from.y + pw.from.height) / GameEngine.TILE_SIZE);
          this.keyCavePipeLipKeys.add(`${lipTx},${lipTy}`);
        }
      });
    }
    this.ceilingTileColumns = new Array(resolvedLevel.width).fill(false);
    if (
      resolvedLevel.theme === 'underground' ||
      resolvedLevel.theme === 'ghost_house' ||
      resolvedLevel.theme === 'castle'
    ) {
      const row0 = resolvedLevel.tiles[0];
      const row1 = resolvedLevel.tiles[1];
      for (let tx = 0; tx < resolvedLevel.width; tx++) {
        const hasRow0 = Boolean(row0?.[tx] && this.isSolidTile(row0[tx]!.type));
        const hasRow1 = Boolean(row1?.[tx] && this.isSolidTile(row1[tx]!.type));
        this.ceilingTileColumns[tx] = hasRow0 || hasRow1;
      }
    }
    this.isStageClear = false;
    this.lastClearWasSecretExit = false;
    this.isSpinJumping = false;
    this.spinJumpTimer = 0;
    this.isGameOver = false;
    this.isIllegalInstructionBug = false;
    this.illegalInstructionTimer = 0;
    this.isDebugPlacementActive = false;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.stageArrivalNotice = '';
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.notifiedArrivedPlayerIds.clear();
    this.intermissionTimer = showIntermission ? 85 : 0;
    this.stageClearTallyDelay = 0;
    this.stageClearDelayTimer = 0;
    this.timeCountTickCounter = 0;
    this.goalTapeY = 44;
    this.goalTapeDir = 1;
    this.goalTapeCut = false;
    this.lastGoalGatePoints = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = false;
    this.bonusStageBlocks = [];
    this.bonusStageLivesWon = 0;
    this.bonusStageFinishDelay = 0;
    this.bonusStageIrisProgress = 0;
    this.bonusStageTimeFrames = 0;
    this.bonusReturnLevelMeta = null;
    this.stats.goalPointsWallet = this.goalPointsWallet;
    this.stats.isBonusStage = false;
    this.stats.bonusBlocksRemaining = 0;
    this.stats.bonusLivesWon = 0;
    this.warpTimer = 0;
    this.warpTarget = null;
    this.warpDir = 'down';
    this.pipeExitDir = 'up';
    this.pipeClipLipY = null;
    this.pipeClipLipX = null;
    this.bridgeCollapseQueue = [];
    this.bridgeCollapseTimer = 0;
    this.castleToodleActive = false;
    this.castleToodleX = 0;
    this.castleToodleY = 0;
    this.castleToodleDialogueTimer = 0;
    this.castlePrincessActive = false;
    this.castlePrincessX = 0;
    this.castlePrincessY = 0;
    this.castlePrincessDialogueTimer = 0;
    this.switchPalaceActivated = false;
    this.smwCastleEntryActive = false;
    this.smwCastleEntryTimer = 0;
    this.smwCastleBannerProgress = 0;
    this.smwCastleIrisProgress = 0;
    this.smwCastleTargetX = 0;
    if (!isRespawn) {
      this.isCampaignVictory = false;
      this.collectedWCoinIndices.clear();
      this.wCoinLifeAwardedThisStage = false;
    }
    this.stats.reservePowerUp = this.reservePowerUp;
    this.bossFireballs = [];
    this.hammerProjectiles = [];
    if (resolvedLevel.smwNodeId !== undefined) {
      this.endlessStage = 0;
    } else if (resolvedLevel.singleplayerWorld !== undefined && resolvedLevel.singleplayerStage !== undefined) {
      this.singleplayerWorld = resolvedLevel.singleplayerWorld;
      this.singleplayerStage = resolvedLevel.singleplayerStage;
      this.endlessStage = 0;
    } else if (resolvedLevel.endlessStage !== undefined) {
      this.endlessStage = resolvedLevel.endlessStage;
    } else if (
      resolvedLevel.id === 'world-1-1' ||
      resolvedLevel.id === 'world-1-2' ||
      resolvedLevel.id === 'world-2-2' ||
      resolvedLevel.id === 'world-1-4' ||
      resolvedLevel.isCustom
    ) {
      this.endlessStage = 0;
    }

    const levelWidthPx = this.level.width * GameEngine.TILE_SIZE;

    if (!isRespawn) {
      // Fresh stage entry: clear checkpoints and start at initial position
      this.activeCheckpoint = null;
      this.activatedCheckpointIndices.clear();
      this.marioX = resolvedLevel.marioStart.x;
      this.marioY = resolvedLevel.marioStart.y - (this.getMarioHeight() - 16);
      if (resolvedLevel.isCustom && resolvedLevel.marioStart.x > 160) {
        this.camera.centerOn(resolvedLevel.marioStart.x, levelWidthPx);
      } else {
        this.camera.snapTo(0, levelWidthPx);
      }
    } else {
      // Respawn after death: strip power-ups (always return as Small Mario)
      this.marioPower = 'small';
      this.marioStarTimer = 0;
      this.starComboCount = 0;
      if (this.activeCheckpoint) {
        this.marioX = this.activeCheckpoint.x;
        this.marioY = this.activeCheckpoint.y;
        this.camera.centerOn(this.activeCheckpoint.x, levelWidthPx);
      } else {
        this.marioX = newLevel.marioStart.x;
        this.marioY = newLevel.marioStart.y;
        this.camera.snapTo(0, levelWidthPx);
      }
    }

    this.cameraX = this.camera.x;

    this.marioVx = 0;
    this.marioVy = 0;
    this.marioGrounded = false;
    this.lastSafeGroundPos = { x: this.marioX, y: Math.min(this.marioY, GameEngine.NES_HEIGHT - 48) };
    this.stompComboCount = 0;
    this.marioGrowthTimer = 0;
    this.marioShrinkTimer = 0;
    this.marioFireThrowTimer = 0;
    this.marioState = 'idle';
    this.marioFacing = 'right';
    this.marioInvulnerableTimer = isRespawn ? 40 : 0;
    this.stats.world =
      newLevel.isCustom && this.customCampaignLevels.length > 0
        ? `${this.customCampaignIndex + 1}/${this.customCampaignLevels.length}`
        : newLevel.id === 'world-1-1'
        ? '1-1'
        : newLevel.id === 'world-1-2'
        ? '1-2'
        : newLevel.id === 'world-2-2'
        ? '2-2'
        : newLevel.id === 'world-ghost'
        ? 'MANSÃO'
        : newLevel.id === 'world-1-4'
        ? '1-4'
        : newLevel.name;
    const timeBonus = this.difficulty === 'easy' ? 80 : this.difficulty === 'hard' ? -80 : 0;
    this.stats.time = Math.max(150, newLevel.timeLimit + timeBonus);
    this.stats.difficulty = this.difficulty;
    this.flagY = 3 * GameEngine.TILE_SIZE;

    const speedMult = newLevel.enemySpeedMultiplier ?? 1;
    const bowserHp =
      newLevel.smwNodeId === 'wiki-5-castelo'
        ? 6
        : newLevel.singleplayerWorld !== undefined
        ? 3 + newLevel.singleplayerWorld
        : 5 + Math.floor(((newLevel.endlessStage || 1) - 1) / 4) * 2;
    this.enemySpawnManager.reset(newLevel.endlessStage ?? 0, newLevel.theme);

    // Load enemies (avoid spawning enemies directly on top of Mario's respawn position)
    this.enemies = newLevel.enemies
      .filter(e => {
        if (!isRespawn || !this.activeCheckpoint) return true;
        return Math.abs(e.x - this.activeCheckpoint.x) > 20;
      })
      .map(e => ({
        id: this.nextEntityId++,
        type: e.type,
        x: e.x,
        y: e.y,
        vx: EnemySpawnManager.getInitialVelocity(e.type, speedMult, -1),
        vy: e.type === 'paratroopa' ? -2.8 : 0,
        width: e.type === 'bowser' ? 24 : 16,
        height:
          e.type === 'bowser'
            ? 24
            : e.type === 'koopa' ||
              e.type === 'red_koopa' ||
              e.type === 'paratroopa' ||
              e.type === 'hammer_bro' ||
              e.type === 'dry_bones'
            ? 24
            : 16,
        alive: true,
        state: 'walk' as const,
        stateTimer: 0,
        facing: 'left' as const,
        animFrame: 0,
        animTimer: 0,
        pipeOriginY: e.type === 'piranha' || e.type === 'lava_bubble' ? e.y : undefined,
        hp: e.type === 'bowser' ? bowserHp : undefined,
        hitFlashTimer: 0,
        originX: e.x,
        fireTimer: e.type === 'bowser' ? 50 : e.type === 'hammer_bro' ? 42 : undefined,
        bossName: e.type === 'bowser' ? newLevel.bossName : undefined,
      }));

    // R1.16.1RZ.4: Yoshi (only from custom editor/debug; NEVER spawns inside castles)
    this.yoshis = [];
    this.yoshiTongueTimer = 0;
    this.yoshiTongueCooldown = 0;
    this.yoshiRemountGraceTimer = 0;
    if (isCastleStageForYoshi(resolvedLevel) || isRespawn) {
      this.marioOnYoshi = false;
    }
    this.stats.onYoshi = this.marioOnYoshi;
    if (!isCastleStageForYoshi(resolvedLevel) && Array.isArray(resolvedLevel.yoshis)) {
      resolvedLevel.yoshis.forEach(yPos => {
        this.spawnYoshiAt(yPos.x, yPos.y);
      });
    }

    // R1.19.1GX.5: Keys, Keyholes, and Portable Blue/Cyan P-Switches
    this.carryables = [];
    this.keyholes = [];
    this.heldCarryableId = null;
    this.heldShellEnemyId = null;
    this.pSwitchBlueTimer = 0;
    this.pSwitchTransformedBlocks = [];
    this.keyholeClearTimer = 0;
    this.keyholeTransitionActive = false;
    this.keyholeTotalTimer = 0;
    this.activeKeyholeId = null;
    this.keyholeKeyStartX = 0;
    this.keyholeKeyStartY = 0;
    this.keyholeKeyX = 0;
    this.keyholeKeyY = 0;
    this.keyholeHintCooldown = 0;
    if (Array.isArray(resolvedLevel.carryables)) {
      resolvedLevel.carryables.forEach(c => {
        this.spawnCarryableObject(c.kind, c.x, c.y);
      });
    }
    if (Array.isArray(resolvedLevel.keyholes)) {
      resolvedLevel.keyholes.forEach(k => {
        this.spawnKeyhole(k.x, k.y);
      });
    }

    // Place standalone coins as items
    this.items = [];
    newLevel.coins.forEach(c => {
      this.items.push({
        id: this.nextEntityId++,
        type: 'coin',
        x: c.x,
        y: c.y,
        vx: 0,
        vy: 0,
        width: 16,
        height: 16,
        grounded: true,
        collected: false,
        emerging: false,
        emergeY: c.y,
      });
    });

    // R1.16.OV.4: Place 4 giant floating "W" Coins across playable stages
    const skipDefaultWCoins =
      resolvedLevel.id === 'smw-bonus-stage' ||
      resolvedLevel.id === 'secret-vault' ||
      resolvedLevel.id === 'smw-wiki-1-secret' ||
      Boolean(resolvedLevel.isCustom);
    const stageWCoins =
      resolvedLevel.wCoins !== undefined
        ? resolvedLevel.wCoins.slice(0, 4)
        : skipDefaultWCoins
        ? []
        : computeStageWCoins(resolvedLevel);
    this.wCoinsTotal = stageWCoins.length;
    this.wCoinsCollected = this.collectedWCoinIndices.size;
    this.stats.wCoinsTotal = this.wCoinsTotal;
    this.stats.wCoinsCollected = this.wCoinsCollected;
    stageWCoins.forEach((wc, idx) => {
      if (this.collectedWCoinIndices.has(idx)) return;
      this.items.push({
        id: this.nextEntityId++,
        type: 'w_coin',
        x: wc.x,
        y: wc.y,
        vx: 0,
        vy: 0,
        width: 20,
        height: 26,
        grounded: false,
        collected: false,
        emerging: false,
        emergeY: wc.y,
        wCoinIndex: idx,
      });
    });

    this.fireballs = [];
    this.ridingPlatformId = null;
    this.floatingPlatforms = (newLevel.floatingPlatforms ?? []).map(fp => {
      const phase = fp.phase ?? 0;
      const offset = Math.sin(phase) * fp.range;
      const initX = fp.axis === 'horizontal' ? fp.x + offset : fp.x;
      const initY = fp.axis === 'vertical' || fp.axis === 'bob' ? fp.y + offset : fp.y;
      return {
        id: this.nextEntityId++,
        originX: fp.x,
        originY: fp.y,
        x: initX,
        y: initY,
        prevX: initX,
        prevY: initY,
        dx: 0,
        dy: 0,
        width: fp.width,
        height: fp.height ?? 10,
        axis: fp.axis,
        range: fp.range,
        speed: fp.speed,
        timer: phase,
      };
    });
    this.particleSystem.clear();
    this.generateBackgroundScenery();

    // Start background music only when gameplay has actually started
    if (this.isGameStarted) {
      this.startLevelMusic(newLevel.theme);
    } else {
      this.sound.stopMusic();
    }

    if (
      !isRespawn &&
      notifyNetwork &&
      newLevel.id !== 'secret-vault' &&
      newLevel.id !== 'smw-wiki-1-secret' &&
      this.onLevelChanged
    ) {
      this.onLevelChanged(newLevel);
    }
  }

  private generateBackgroundScenery() {
    this.sceneries = [];
    if (this.level.useBonusBackdrop || this.level.smwNodeId?.startsWith('wiki-switch-')) {
      return;
    }
    if (this.level.theme === 'underwater') {
      const waterEnd = this.level.dryFinishStartX ?? this.level.width * 16;
      for (let x = 24; x < waterEnd - 32; x += 96 + Math.random() * 64) {
        this.sceneries.push({
          type: Math.random() > 0.5 ? 'seaweed_tall' : 'seaweed_short',
          x: x + Math.random() * 24,
          y: 13 * 16,
        });
      }
      if (this.level.dryFinishStartX !== undefined) {
        this.sceneries.push({
          type: 'cloud_med',
          x: this.level.dryFinishStartX + 48,
          y: 36,
        });
        this.sceneries.push({
          type: 'bush_small',
          x: this.level.dryFinishStartX + 24,
          y: 13 * 16,
        });
      }
      return;
    }

    if (this.level.theme === 'ghost_house') {
      const mansionEnd = Math.max(200, this.level.width * 16 - 240);
      for (let x = 48; x < mansionEnd; x += 140) {
        this.sceneries.push({ type: 'ghost_window', x, y: 44 });
        this.sceneries.push({ type: 'ghost_chandelier', x: x + 68, y: 32 });
        if ((Math.floor(x / 140) % 2) === 0) {
          this.sceneries.push({ type: 'ghost_portrait', x: x + 104, y: 74 });
        }
        this.sceneries.push({ type: 'ghost_mist', x: x + 16, y: 196 });
      }
      return;
    }

    if (this.level.theme !== 'overworld') return;

    for (let x = 0; x < this.level.width * 16; x += 180 + Math.random() * 80) {
      // Cloud
      this.sceneries.push({
        type: Math.random() > 0.5 ? 'cloud_med' : 'cloud_large',
        x: x + Math.random() * 40,
        y: 24 + Math.random() * 32,
      });
      // Hill
      this.sceneries.push({
        type: Math.random() > 0.5 ? 'hill_large' : 'hill_small',
        x: x + 60,
        y: 13 * 16,
      });
      // Bush
      this.sceneries.push({
        type: Math.random() > 0.4 ? 'bush_large' : 'bush_small',
        x: x + 110,
        y: 13 * 16,
      });
    }
  }

  private isMarioUnderwater(): boolean {
    return (
      this.level.theme === 'underwater' &&
      (this.level.dryFinishStartX === undefined || this.marioX < this.level.dryFinishStartX)
    );
  }

  // --- GAME UPDATE LOOP ---
  public update(deltaMs: number) {
    if (this.isPaused) return;

    // R1.16.UF.4: Ignore any interactive/buffered controls until gameplay actually starts
    if (!this.isGameStarted) {
      this.controls = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        run: false,
        spinJump: false,
        select: false,
        pause: false,
      };
      this.prevControls = { ...this.controls };
      this.marioVx = 0;
      return;
    }

    // Easter Egg: Game screen is locked in "ILLEGAL INSTRUCTION" glitched state until Dev Button is pressed
    if (this.isIllegalInstructionBug) {
      this.illegalInstructionTimer++;
      this.updateCamera();
      this.prevControls = { ...this.controls };
      return;
    }

    // Check multiplayer game-over condition (someone ran out of lives)
    this.evaluateMultiplayerMatchEnd();
    if (this.isMultiplayerMatchOver) return;
    if (this.isGameOver) return;

    // Check pause button pressed (edge-triggered)
    if (this.controls.pause && !this.prevControls.pause) {
      this.togglePause();
      this.prevControls = { ...this.controls };
      return;
    }

    // Intermission screen active (shows World and Lives counter)
    if (this.intermissionTimer > 0) {
      this.intermissionTimer--;
      if (this.controls.jump || this.controls.run) {
        this.intermissionTimer = 0;
      }
      this.prevControls = { ...this.controls };
      return;
    }

    // R1.16.OY.4: Impede uso do modo debug se alcançar o final da fase (mesmo que ativado)
    if (
      this.isGameStarted &&
      !this.isGameOver &&
      this.marioState !== 'dead' &&
      (this.isDebugMode || this.isDebugPlacementActive) &&
      this.enforceStageEndDebugLock(true)
    ) {
      // Debug mode forced off upon reaching stage end; continue normal update
    }

    // Sonic-Style Debug Mode Object Placement Cursor (free flying + manual item placement)
    if (
      this.isDebugMode &&
      this.isDebugPlacementActive &&
      this.isGameStarted &&
      !this.isStageClear &&
      !this.isGameOver &&
      this.marioState !== 'dead' &&
      !this.isDebugLockedAtStageEnd()
    ) {
      this.updateDebugPlacementCursor();
      this.enforceStageEndDebugLock(true);
      this.particleSystem.update();
      this.updateCamera();
      this.prevControls = { ...this.controls };
      return;
    }

    // Bonus Stage (SMW 9-block 1-UP roulette room)
    if (this.isBonusStageActive) {
      if (this.bonusStageFinishDelay > 0) {
        this.bonusStageFinishDelay--;
        if (this.marioGrowthTimer > 0) {
          this.marioGrowthTimer--;
        }

        // Let Mario settle cleanly onto the Bonus Room floor/blocks instead of freezing mid-air
        const settleHeight = this.getMarioHeight();
        this.marioVx = 0;
        this.isSpinJumping = false;
        this.spinJumpTimer = 0;
        this.marioVy = Math.min(5.5, this.marioVy + 0.42);
        this.marioY += this.marioVy;

        const settleBox: Rect = {
          x: this.marioX + 1,
          y: this.marioY,
          width: 14,
          height: settleHeight,
        };
        let landed = false;
        for (const t of this.getTilesIntersecting(settleBox)) {
          if (this.isSolidTile(t.tile.type) && this.marioVy >= 0) {
            this.marioY = t.tileY * GameEngine.TILE_SIZE - settleHeight;
            this.marioVy = 0;
            this.marioGrounded = true;
            this.marioState = 'idle';
            landed = true;
            break;
          }
        }
        const maxFloorY = 13 * GameEngine.TILE_SIZE - settleHeight;
        if (!landed && this.marioY >= maxFloorY) {
          this.marioY = maxFloorY;
          this.marioVy = 0;
          this.marioGrounded = true;
          this.marioState = 'idle';
          landed = true;
        }
        if (!landed) {
          this.marioGrounded = false;
          this.marioState = this.marioVy < 0 ? 'jumping' : 'falling';
        }

        if (this.bonusStageFinishDelay <= 26) {
          this.bonusStageIrisProgress = Math.max(
            this.bonusStageIrisProgress,
            Math.min(1, (26 - Math.max(0, this.bonusStageFinishDelay)) / 24)
          );
        }

        this.particleSystem.update();
        this.updateBlocks();
        this.updateCamera();
        if (this.bonusStageFinishDelay <= 0) {
          this.finishSmwBonusStage();
        }
        this.prevControls = { ...this.controls };
        return;
      }

      for (const b of this.bonusStageBlocks) {
        if (!b.resolved) {
          b.timer++;
          if (b.timer >= 20) {
            b.timer = 0;
            b.faceIndex = (b.faceIndex + 1) % GameEngine.BONUS_BLOCK_FACES.length;
          }
        }
      }

      if (this.bonusStageTimeFrames > 0) {
        this.bonusStageTimeFrames--;
        this.stats.time = Math.max(0, Math.ceil(this.bonusStageTimeFrames / 60));
        if (this.bonusStageTimeFrames <= 0) {
          this.bonusStageFinishDelay = 85;
          this.sound.playStageClear();
          const timeoutLabel =
            this.bonusStageLivesWon > 0
              ? `TEMPO! +${this.bonusStageLivesWon} VIDAS`
              : 'TEMPO! BONUS FIM!';
          this.particleSystem.emitScoreText(timeoutLabel, 24, 36, {
            maxLife: 85,
            vy: -0.25,
            color: '#fce078',
          });
          this.particleSystem.update();
          this.updateBlocks();
          this.updateCamera();
          this.prevControls = { ...this.controls };
          return;
        }
      }

      this.updateMario(deltaMs);
      this.particleSystem.update();
      this.updateBlocks();
      this.updateCamera();
      this.prevControls = { ...this.controls };
      return;
    }

    // SMW Goal Gate moving crossbar tape oscillator
    if (
      this.hasGoalPointsPost() &&
      !this.goalTapeCut &&
      !this.isStageClear &&
      this.marioState !== 'castle_walk' &&
      this.marioState !== 'castle_entered'
    ) {
      this.goalTapeY += this.goalTapeDir * 1.45;
      if (this.goalTapeY >= 184) {
        this.goalTapeY = 184;
        this.goalTapeDir = -1;
      } else if (this.goalTapeY <= 44) {
        this.goalTapeY = 44;
        this.goalTapeDir = 1;
      }
    }

    // Timer countdown & stage elapsed tracker (only when the player has actually started the game!)
    if (this.isGameStarted && !this.isStageClear && this.marioState !== 'dead') {
      if (
        !this.isBonusStageActive &&
        this.marioState !== 'castle_walk' &&
        this.marioState !== 'castle_entered' &&
        this.bridgeCollapseQueue.length === 0
      ) {
        this.stageElapsedMs += deltaMs;
      }
      this.timeAccumulator += deltaMs;
      if (this.timeAccumulator >= 600) {
        this.timeAccumulator = 0;
        if (this.stats.time > 0) {
          this.stats.time--;
          if (this.stats.time === 0) {
            if (this.isEditorImmortality) {
              this.stats.time = this.level.timeLimit || 400;
            } else {
              this.killMario();
            }
          }
        }
      }
    }

    // Castle Axe bridge collapse animation
    if (this.bridgeCollapseQueue.length > 0) {
      this.bridgeCollapseTimer++;
      if (this.bridgeCollapseTimer % 2 === 0) {
        const nextTile = this.bridgeCollapseQueue.shift();
        if (nextTile) {
          this.level.tiles[nextTile.ty][nextTile.tx] = null;
          this.particleSystem.add({
            type: 'smoke',
            x: nextTile.tx * GameEngine.TILE_SIZE + 4,
            y: nextTile.ty * GameEngine.TILE_SIZE,
            vx: 0,
            vy: -0.6,
            life: 0,
            maxLife: 16,
          });
        }
        if (this.bridgeCollapseQueue.length === 0) {
          this.marioState = 'castle_walk';
          this.marioFacing = 'right';
          this.sound.playStageClear();
        }
      }
      this.updateEnemies();
      this.particleSystem.update();
      this.prevControls = { ...this.controls };
      return;
    }

    // SMW Keyhole Secret Exit transition sequence (authentic key lock-in + expanding keyhole + keyhole iris)
    if (this.keyholeClearTimer > 0) {
      this.keyholeClearTimer++;
      this.keyholeTotalTimer++;
      const activeKh = this.keyholes.find(k => k.id === this.activeKeyholeId);
      if (activeKh) {
        activeKh.animTimer++;
        const slideT = Math.min(1, this.keyholeTotalTimer / 11);
        const easedSlide = 1 - Math.pow(1 - slideT, 2);
        this.keyholeKeyX =
          this.keyholeKeyStartX + (activeKh.x - this.keyholeKeyStartX) * easedSlide;
        this.keyholeKeyY =
          this.keyholeKeyStartY + (activeKh.y + 4 - this.keyholeKeyStartY) * easedSlide;
        if (this.keyholeTotalTimer === 11) {
          this.spawnPowerUpSparkles(activeKh.x, activeKh.y + 4);
        }
      }
      this.marioVx = 0;
      this.marioVy = 0;
      this.particleSystem.update();
      this.updateCamera();
      if (this.keyholeClearTimer >= 45) {
        this.keyholeClearTimer = 0;
        this.finishStage();
      }
      this.prevControls = { ...this.controls };
      return;
    }

    // Update Blue P-Switch temporary coin->block timer (R1.19.1GX.5)
    if (this.pSwitchBlueTimer > 0 && !this.isStageClear && this.marioState !== 'dead') {
      this.pSwitchBlueTimer--;
      if (this.pSwitchBlueTimer <= 0) {
        this.revertBluePSwitchBlocks();
      }
    }
    if (this.keyholeHintCooldown > 0) {
      this.keyholeHintCooldown--;
    }

    // SMW SELECT button during active gameplay: release stored Reserve Box power-up ("Carteira")
    const selectPressed = Boolean(this.controls.select) && !Boolean(this.prevControls.select);
    if (
      selectPressed &&
      this.isGameStarted &&
      !this.isStageClear &&
      !this.isGameOver &&
      this.marioState !== 'dead'
    ) {
      this.dropReservePowerUp(true);
    }

    // Update Floating Platforms (and carry Mario smoothly if riding one)
    this.updateFloatingPlatforms();

    // Update Mario
    this.updateMario(deltaMs);

    // R1.16.OY.4: Bloqueia imediatamente o Modo Debug se o personagem alcançar o final da fase
    if (this.isDebugMode || this.isDebugPlacementActive) {
      this.enforceStageEndDebugLock(true);
    }

    // Dynamic progressive enemy wave spawning (increases spawn frequency & adds faster enemies per cycle)
    if (
      this.isGameStarted &&
      !this.isStageClear &&
      this.marioState !== 'dead' &&
      this.marioState !== 'castle_walk' &&
      this.marioState !== 'castle_entered'
    ) {
      const dynamicSpawns = this.enemySpawnManager.update({
        level: this.level,
        cameraX: this.cameraX,
        nesWidth: GameEngine.NES_WIDTH,
        tileSize: GameEngine.TILE_SIZE,
        marioX: this.marioX,
        marioY: this.marioY,
        enemies: this.enemies,
        isSolidTile: type => this.isSolidTile(type),
        nextId: () => this.nextEntityId++,
      });
      if (dynamicSpawns.length > 0) {
        this.enemies.push(...dynamicSpawns);
      }
    }

    // Update Enemies
    this.updateEnemies();

    // Update Yoshis (R1.16.1RZ.4)
    this.updateYoshis();

    // Update Items
    this.updateItems();

    // Update Carryables (Keys, Blue/Cyan P-Switches) & Keyholes (R1.19.1GX.5)
    this.updateCarryablesAndKeyholes();

    // Update Fireballs & Enemy Projectiles
    this.updateFireballs();
    this.updateBossFireballs();
    this.updateHammerProjectiles();

    // Update Particles
    this.particleSystem.update();

    // Update Block Bumps
    this.updateBlocks();

    // Update Camera
    this.updateCamera();

    this.prevControls = { ...this.controls };
  }

  // --- MARIO UPDATE ---
  private updateMario(deltaMs: number) {
    // 1. Starman invincibility timer & trailing sparkle aura
    if (this.marioStarTimer > 0) {
      this.marioStarTimer--;
      if (
        this.marioStarTimer % 4 === 0 &&
        this.marioState !== 'dead' &&
        this.marioState !== 'castle_entered'
      ) {
        const starColors = ['#fce078', '#58f8f8', '#78f858', '#ff70b8'];
        this.particleSystem.add({
          type: 'sparkle',
          x: this.marioX + 2 + Math.random() * 12,
          y: this.marioY + 2 + Math.random() * Math.max(10, this.getMarioHeight() - 4),
          vx: (Math.random() - 0.5) * 0.9,
          vy: -0.5 - Math.random() * 0.6,
          life: 0,
          maxLife: 16,
          color: starColors[Math.floor((this.marioStarTimer / 4) % starColors.length)],
          size: 2,
        });
      }
      if (this.marioStarTimer === 0) {
        this.starComboCount = 0;
        if (
          !this.isStageClear &&
          this.marioState !== 'dead' &&
          this.marioState !== 'pole_slide' &&
          this.marioState !== 'castle_walk' &&
          this.marioState !== 'castle_entered' &&
          !this.isIllegalInstructionBug
        ) {
          this.startLevelMusic(this.level.theme);
        }
      }
    }

    if (this.marioFireThrowTimer > 0) {
      this.marioFireThrowTimer--;
    }
    if (this.yoshiRemountGraceTimer > 0) {
      this.yoshiRemountGraceTimer--;
    }
    if (this.yoshiTongueCooldown > 0) {
      this.yoshiTongueCooldown--;
    }
    if (this.isCastleLevel() && this.marioOnYoshi) {
      this.marioOnYoshi = false;
      this.yoshiTongueTimer = 0;
      this.stats.onYoshi = false;
    }

    // 2. Growth / Shrink freeze animations (pause post-damage invulnerability countdown until control resumes)
    if (this.marioGrowthTimer > 0) {
      this.marioGrowthTimer--;
      return;
    }
    if (this.marioShrinkTimer > 0) {
      this.marioShrinkTimer--;
      return;
    }

    // 3. Temporary post-damage invulnerability timer
    if (this.marioInvulnerableTimer > 0) {
      this.marioInvulnerableTimer--;
    }

    // 3. Death sequence (Authentic NES arc)
    if (this.marioState === 'dead') {
      this.marioDeathTimer++;
      // Frames 0-14: Mario freezes in place with dead sprite
      if (this.marioDeathTimer === 14) {
        this.marioVy = -7.5; // Upward hop
      } else if (this.marioDeathTimer > 14) {
        // Gravity pulls Mario down off screen (ignoring tiles and enemies)
        this.marioVy += 0.36;
        this.marioY += this.marioVy;
      }
      // After death jingle ends (~135 frames)
      if (this.marioDeathTimer > 135) {
        this.handleLifeLost();
      }
      return;
    }

    // 4. Pipe entering animation (sinking smoothly into pipe until fully hidden)
    if (this.marioState === 'pipe_entering') {
      this.warpTimer++;
      if (this.warpDir === 'down') {
        this.marioVx = 0;
        this.marioY += 0.8;
        const sinkDoneY = (this.pipeClipLipY ?? this.marioY) + 2;
        if (this.marioY >= sinkDoneY || this.warpTimer >= 52) {
          this.finishPipeWarp();
        }
      } else {
        this.marioVx = 0.75;
        this.marioX += 0.75;
        this.marioAnimTimer++;
        if (this.marioAnimTimer >= 6) {
          this.marioAnimTimer = 0;
          this.marioAnimFrame = (this.marioAnimFrame + 1) % 3;
        }
        const enterDoneX = (this.pipeClipLipX ?? this.marioX) + 2;
        if (this.marioX >= enterDoneX || this.warpTimer >= 44) {
          this.finishPipeWarp();
        }
      }
      return;
    }

    // 4b. Pipe exiting animation (rising smoothly out of pipe until feet stand flush on rim)
    if (this.marioState === 'pipe_exiting') {
      this.warpTimer++;
      this.marioVx = 0;
      if (this.pipeExitDir === 'up') {
        this.marioY -= 0.75;
        const targetTopY = (this.pipeClipLipY ?? this.marioY) - this.getMarioHeight();
        if (this.marioY <= targetTopY || this.warpTimer >= 60) {
          this.marioY = targetTopY;
          this.marioVy = 0;
          this.marioGrounded = true;
          this.marioState = 'idle';
          this.pipeClipLipY = null;
          this.pipeClipLipX = null;
        }
      } else if (this.pipeExitDir === 'down') {
        this.marioY += 0.75;
        if (this.warpTimer >= 48) {
          this.marioState = 'idle';
          this.pipeClipLipY = null;
          this.pipeClipLipX = null;
        }
      } else {
        this.marioX += 0.75;
        if (this.warpTimer >= 48) {
          this.marioState = 'idle';
          this.pipeClipLipY = null;
          this.pipeClipLipX = null;
        }
      }
      return;
    }

    // 5. Flagpole sliding animation
    if (this.marioState === 'pole_slide') {
      const bottomY = 12 * GameEngine.TILE_SIZE - this.getMarioHeight();
      if (this.marioY < bottomY) {
        this.marioY += 2.5;
        this.flagY = Math.min(bottomY + 8, this.flagY + 2.5);
      } else {
        // Drop off pole base block firmly down onto the real ground level (row 13)
        this.marioState = 'castle_walk';
        this.marioFacing = 'right';
        this.marioX = (Math.floor(this.level.flagX / GameEngine.TILE_SIZE) + 1) * GameEngine.TILE_SIZE;
        this.marioY = 13 * GameEngine.TILE_SIZE - this.getMarioHeight();
        this.sound.playStageClear();
      }
      return;
    }

    // 6. Castle walk & SMW Castle Door Entry animation
    if (this.marioState === 'castle_walk') {
      if (this.smwCastleEntryActive) {
        this.smwCastleEntryTimer++;
        const targetFloorY = 13 * GameEngine.TILE_SIZE - this.getMarioHeight();
        this.marioY = targetFloorY;
        if (this.smwCastleEntryTimer <= 14) {
          // Pause in victory pose directly in front of castle archway
          this.marioAnimFrame = 0;
        } else {
          // Step cleanly inside the dark arched doorway
          this.marioX = Math.min(this.smwCastleTargetX + 5, this.marioX + 0.16);
          this.marioAnimTimer++;
          if (this.marioAnimTimer >= 5) {
            this.marioAnimTimer = 0;
            this.marioAnimFrame = (this.marioAnimFrame + 1) % 3;
          }
          if (this.smwCastleEntryTimer >= 30) {
            this.smwCastleBannerProgress = Math.min(1, (this.smwCastleEntryTimer - 30) / 24);
          }
        }
        if (this.smwCastleEntryTimer >= 44) {
          this.marioVx = 0;
          this.finishStage();
        }
        return;
      }

      const targetFloorY = 13 * GameEngine.TILE_SIZE - this.getMarioHeight();
      if (this.marioY < targetFloorY) {
        this.marioY = Math.min(targetFloorY, this.marioY + 2.8);
      } else {
        this.marioY = targetFloorY;
      }
      this.marioX += 1.2;
      this.marioAnimTimer++;
      if (this.marioAnimTimer >= 6) {
        this.marioAnimTimer = 0;
        this.marioAnimFrame = (this.marioAnimFrame + 1) % 3;
      }

      // Enter castle door (or stop face-to-face in front of Toodle / Princesa Femboy on castle stages)
      const hasCastleGreeter = (this.castleToodleActive || this.castlePrincessActive) && this.level.theme === 'castle';
      const defaultCastleStopX =
        this.level.castleX > 0 && this.level.castleX < 99000
          ? this.level.castleX
          : Math.min((this.level.width - 2) * GameEngine.TILE_SIZE, this.level.flagX + 64);
      const targetStopX = this.castlePrincessActive && this.level.theme === 'castle'
        ? this.castlePrincessX - 24
        : this.castleToodleActive && this.level.theme === 'castle'
        ? this.castleToodleX - 24
        : defaultCastleStopX;
      if (this.marioX >= targetStopX) {
        if (hasCastleGreeter) {
          this.marioX = targetStopX;
        }
        if (this.gameMode === 'smw_world_map') {
          // R02.16.PG.4: Trigger authentic Super Mario World castle entry animation
          this.marioX = targetStopX;
          this.marioVx = 0;
          this.smwCastleTargetX = targetStopX;
          this.smwCastleEntryActive = true;
          this.smwCastleEntryTimer = 1;
          this.smwCastleBannerProgress = 0;
          this.sound.playPowerUpAppear();
          return;
        }
        this.marioVx = 0;
        this.finishStage();
      }
      return;
    }

    // 7. Castle entered & stage clear time tally countdown sequence
    if (this.marioState === 'castle_entered') {
      if (this.keyholeTransitionActive) {
        this.keyholeTotalTimer++;
        const activeKh = this.keyholes.find(k => k.id === this.activeKeyholeId);
        if (activeKh) {
          activeKh.animTimer++;
        }
      } else if (this.gameMode === 'smw_world_map') {
        this.smwCastleBannerProgress = Math.min(1, this.smwCastleBannerProgress + 0.045);
      }
      if (this.castleToodleActive) {
        this.castleToodleDialogueTimer++;
      }
      if (this.castlePrincessActive) {
        this.castlePrincessDialogueTimer++;
        if (this.castlePrincessDialogueTimer % 18 === 4) {
          this.spawnFemboyHeartParticle(
            this.castlePrincessX + 4 + (Math.random() * 14 - 7),
            this.castlePrincessY - 4
          );
        }
      }

      if (this.localStageCleared) {
        this.handleStageClearReadyToAdvance();
        return;
      }

      if (this.stageClearTallyDelay > 0) {
        this.stageClearTallyDelay--;
        return;
      }

      if (this.stats.time > 0) {
        // Tally remaining time into score points (+50 points per second)
        const step = this.stats.time > 200 ? 3 : this.stats.time > 60 ? 2 : 1;
        const dec = Math.min(this.stats.time, step);
        this.stats.time -= dec;
        this.stats.score += dec * 50;
        this.syncHighScore(this.stats.time === 0 || this.stats.time % 10 === 0);

        this.timeCountTickCounter++;
        if (this.timeCountTickCounter % 2 === 0 || dec > 1) {
          this.sound.playCountTick();
        }

        // Establish post-countdown delay once time points reach 0
        if (this.stats.time === 0) {
          this.stageClearDelayTimer = this.keyholeTransitionActive
            ? 36
            : this.castlePrincessActive
            ? 260
            : this.castleToodleActive
            ? 210
            : 90;
        }
        return;
      }

      // If time was already 0 before entering castle, wait once
      if (this.stageClearDelayTimer === 0) {
        this.stageClearDelayTimer = this.keyholeTransitionActive
          ? 36
          : this.castlePrincessActive
          ? 260
          : this.castleToodleActive
          ? 210
          : 60;
        return;
      }

      const activeDialogueTimer = this.castlePrincessActive
        ? this.castlePrincessDialogueTimer
        : this.castleToodleDialogueTimer;
      const skipPressed =
        (this.castleToodleActive || this.castlePrincessActive) &&
        activeDialogueTimer > 75 &&
        ((this.controls.jump && !this.prevControls.jump) || (this.controls.run && !this.prevControls.run));
      if (skipPressed) {
        this.stageClearDelayTimer = 0;
      } else {
        this.stageClearDelayTimer--;
      }

      if (this.gameMode === 'smw_world_map' && !this.pendingBonusStage && !this.keyholeTransitionActive) {
        if (this.stageClearDelayTimer <= 28) {
          this.smwCastleIrisProgress = Math.max(
            this.smwCastleIrisProgress,
            Math.min(1, (28 - Math.max(0, this.stageClearDelayTimer)) / 26)
          );
        }
      }

      if (this.stageClearDelayTimer <= 0) {
        if (this.pendingBonusStage && !this.isBonusStageActive) {
          this.startSmwBonusStage();
        } else {
          this.handleStageClearReadyToAdvance();
        }
      }
      return;
    }

    // --- Normal Player Control ---

    // Tanooki Tail Whip update
    if (this.tailWhipTimer > 0) {
      this.tailWhipTimer--;
      this.marioState = 'tail_whip';
      this.checkTailWhipCollisions();
      if (this.tailWhipTimer === 0) {
        this.marioState = this.marioGrounded ? 'idle' : 'falling';
      }
    }

    const isUnderwater = this.isMarioUnderwater();
    const isRunning = this.controls.run;
    const starBoost = this.marioStarTimer > 0 ? 1.15 : 1;
    const maxSpeed = (isUnderwater ? (isRunning ? 2.2 : 1.55) : (isRunning ? 3.4 : 2.0)) * starBoost;
    const accel = isUnderwater ? 0.13 : (isRunning ? 0.22 : 0.16);
    // Ground friction: 0.72 stops Mario quickly when directional key is released (eliminates ice-like excessive sliding)
    // Air/Water friction: slightly looser for natural momentum control
    const friction = isUnderwater ? (this.marioGrounded ? 0.78 : 0.92) : (this.marioGrounded ? 0.72 : 0.90);

    // Tanooki Statue Mode: Holding Down in Tanooki suit turns into invulnerable statue
    this.isStatue = this.marioPower === 'tanooki' && this.controls.down && this.marioGrounded;

    // Horizontal Movement (cannot walk while statue)
    if (!this.isStatue && this.controls.left && !this.controls.right) {
      this.marioFacing = 'left';
      if (this.marioVx > 0.3) {
        // Skidding / Quick turn-around brake
        this.marioVx -= isUnderwater ? 0.25 : 0.45;
        this.marioState = 'skidding';
      } else {
        this.marioVx -= accel;
        if (this.marioVx < -maxSpeed) this.marioVx = -maxSpeed;
        if (this.tailWhipTimer <= 0) this.marioState = 'running';
      }
    } else if (!this.isStatue && this.controls.right && !this.controls.left) {
      this.marioFacing = 'right';
      if (this.marioVx < -0.3) {
        // Skidding / Quick turn-around brake
        this.marioVx += isUnderwater ? 0.25 : 0.45;
        this.marioState = 'skidding';
      } else {
        this.marioVx += accel;
        if (this.marioVx > maxSpeed) this.marioVx = maxSpeed;
        if (this.tailWhipTimer <= 0) this.marioState = 'running';
      }
    } else {
      // Natural Deceleration & Crisp Stop
      this.marioVx *= friction;
      if (Math.abs(this.marioVx) < 0.25) {
        this.marioVx = 0;
        if (this.marioGrounded && this.tailWhipTimer <= 0) this.marioState = 'idle';
      }
    }

      if (this.marioState === 'skidding' && this.marioGrounded && !isUnderwater && Math.abs(this.marioVx) > 0.9) {
        this.skidDustTimer++;
        if (this.skidDustTimer % 4 === 1) {
          this.particleSystem.emitSkidDust(this.marioX + 8, this.marioY + this.getMarioHeight(), this.marioVx);
        }
      } else {
        this.skidDustTimer = 0;
      }

      // Crouch (Super/Fire/Tanooki)
    const isCrouching = this.controls.down && this.marioGrounded && this.marioPower !== 'small';
    if (isCrouching) {
      this.marioState = 'crouching';
      this.marioVx *= 0.5; // firm brake while ducking
      if (Math.abs(this.marioVx) < 0.2) this.marioVx = 0;
    }

    // Jumping / Spin Jumping / Swimming
    const jumpPressed = this.controls.jump && !this.prevControls.jump;
    const isSpinHeld = Boolean(this.controls.spinJump);
    const spinPressed = isSpinHeld && !Boolean(this.prevControls.spinJump);
    const jumpMult = this.marioPower === 'femboy' ? Math.SQRT2 : 1;

    if (
      this.marioOnYoshi &&
      !this.isStatue &&
      (spinPressed || (this.controls.down && jumpPressed && this.marioGrounded))
    ) {
      // Spin Jump key dismounts Yoshi anytime (even mid-air) with an authentic SMW Spin Jump; Crouch+Jump also dismounts
      this.dismountYoshi(false);
      this.marioVy = (spinPressed ? -7.2 : -6.8) * jumpMult;
      this.marioGrounded = false;
      this.marioState = 'jumping';
      if (spinPressed) {
        this.isSpinJumping = true;
        this.spinJumpTimer = 0;
        this.sound.playSpinJump();
        this.spawnPowerUpSparkles(this.marioX + 4, this.marioY + this.getMarioHeight() - 8);
      } else {
        this.isSpinJumping = false;
        this.spinJumpTimer = 0;
        this.sound.playJumpSuper();
      }
      this.onMultiplayerSyncNeeded?.();
    } else {
      if (isUnderwater) {
        this.isSpinJumping = false;
        this.spinJumpTimer = 0;
        if ((jumpPressed || spinPressed) && !this.isStatue) {
          this.marioVy = (isRunning ? -2.9 : -2.55) * jumpMult;
          this.marioGrounded = false;
          this.marioState = 'jumping';
          this.sound.playSwim();
          this.particleSystem.emitBubble(
            this.marioX + (this.marioFacing === 'right' ? 12 : 2),
            this.marioY + 4,
            3,
            -0.65
          );
        }

        // Gentle ambient bubbles while swimming
        if (Math.random() < 0.03) {
          this.particleSystem.emitBubble(
            this.marioX + (this.marioFacing === 'right' ? 12 : 2),
            this.marioY + 4,
            2,
            -0.5
          );
        }

        // Buoyant underwater gravity
        this.isFluttering = false;
        this.marioVy += 0.085;
        const maxUnderwaterFall = this.controls.jump || isSpinHeld ? 1.1 : 1.65;
        if (this.marioVy > maxUnderwaterFall) this.marioVy = maxUnderwaterFall;
      } else {
        if (spinPressed && this.marioGrounded && !this.isStatue) {
          const capeLaunchMult =
            this.marioPower === 'cape' && Math.abs(this.marioVx) >= 2.5 ? 1.08 : 1;
          const spinImpulse = (isRunning ? -7.6 : -6.8) * jumpMult * capeLaunchMult;
          this.particleSystem.emitJumpDust(this.marioX + 8, this.marioY + this.getMarioHeight(), this.marioVx);
          if (capeLaunchMult > 1) {
            this.spawnPowerUpSparkles(this.marioX, this.marioY + this.getMarioHeight() - 8);
          }
          this.marioVy = spinImpulse;
          this.marioGrounded = false;
          this.marioState = 'jumping';
          this.isSpinJumping = true;
          this.spinJumpTimer = 0;
          this.sound.playSpinJump();
        } else if (jumpPressed && this.marioGrounded && !this.isStatue) {
          const capeLaunchMult =
            this.marioPower === 'cape' && Math.abs(this.marioVx) >= 2.5 ? 1.12 : 1;
          const jumpImpulse = (isRunning ? -8.4 : -7.4) * jumpMult * capeLaunchMult;
          this.particleSystem.emitJumpDust(this.marioX + 8, this.marioY + this.getMarioHeight(), this.marioVx);
          if (capeLaunchMult > 1) {
            this.spawnPowerUpSparkles(this.marioX, this.marioY + this.getMarioHeight() - 8);
          }
          this.marioVy = jumpImpulse;
          this.marioGrounded = false;
          this.marioState = 'jumping';
          this.isSpinJumping = false;
          this.spinJumpTimer = 0;

          if (this.marioPower === 'small') {
            this.sound.playJumpSmall();
          } else {
            this.sound.playJumpSuper();
          }
        }

        if (!this.marioGrounded && this.isSpinJumping) {
          this.spinJumpTimer++;
        }

        // Tanooki Flutter & Cape Glide: holding jump while descending slows fall speed cleanly (disabled during Spin Jump)
        this.isFluttering = false;
        if (!this.isSpinJumping && this.marioPower === 'cape' && !this.marioGrounded && this.controls.jump && this.marioVy > 0.25) {
          this.isFluttering = true;
          this.marioVy = Math.min(this.marioVy, 0.85); // wide buoyant cape glide
        } else if (!this.isSpinJumping && this.marioPower === 'tanooki' && !this.marioGrounded && this.controls.jump && this.marioVy > 0.5) {
          this.isFluttering = true;
          this.marioVy = Math.min(this.marioVy, 1.15); // gentle glide / flutter fall
        } else if (this.marioPower === 'cape' && !this.marioGrounded && this.controls.down) {
          // Cape Dive: pressing Down in midair accelerates descent
          this.marioVy = Math.min(7.0, this.marioVy + 0.22);
        }

        // Variable jump height: cut ascent when releasing jump / spin button
        if (!this.controls.jump && !isSpinHeld && this.marioVy < -2.5) {
          this.marioVy = -2.5;
        }

        // Gravity
        const glideGravity = this.marioPower === 'cape' ? 0.05 : 0.08;
        const gravity = this.isFluttering ? glideGravity : (this.marioVy < 0 ? 0.38 : 0.62);
        this.marioVy += gravity;
        if (this.marioVy > 7.0) this.marioVy = 7.0; // Terminal velocity
      }
    }

    // Check Pipe Warp: Down key on vertical pipe (grounded or underwater) or Right key against horizontal pipe
    if (
      (this.marioGrounded && (this.controls.down || this.controls.right)) ||
      (isUnderwater && this.controls.down)
    ) {
      if (this.checkPipeWarp()) {
        return;
      }
    }

    // R1.19.1GX.5: Release carried object/shell when Run button is released (or forced drop on Yoshi/Statue)
    if (this.isCarryingAnything()) {
      if (this.marioOnYoshi || this.isStatue) {
        this.releaseHeldObject(true);
      } else if (!this.controls.run) {
        this.releaseHeldObject(false);
      }
    }

    // Action button pressed (Run button):
    const runPressed = this.controls.run && !this.prevControls.run;
    if (this.marioOnYoshi && runPressed && this.yoshiTongueCooldown <= 0 && !this.isStatue) {
      this.yoshiTongueTimer = 14;
      this.yoshiTongueCooldown = 18;
      this.sound.playKick();
    } else if (runPressed && !this.isCarryingAnything()) {
      const activePlayerFireballs = this.fireballs.filter(
        fb => fb.alive && !fb.exploding && fb.color !== 'white'
      ).length;
      if (this.marioPower === 'fire' && activePlayerFireballs < 2) {
        this.shootFireball();
      } else if ((this.marioPower === 'tanooki' || this.marioPower === 'cape') && this.tailWhipTimer <= 0) {
        // Tanooki Tail Whip / Cape Spin 360 Sweep!
        this.tailWhipTimer = 18;
        this.sound.playKick();
      }
    }

    if (this.yoshiTongueTimer > 0) {
      this.yoshiTongueTimer--;
      this.checkYoshiTongueCollisions();
    }

    // Apply Velocity with AABB Collision
    this.moveMarioWithCollision();

    // Keep Mario beneath the water surface so he doesn't swim into the HUD
    if (isUnderwater && this.marioY < 24) {
      this.marioY = 24;
      if (this.marioVy < 0) this.marioVy = 0;
    }

    // Prevent passing Cave / Ghost House / Castle stages on top of the ceiling or jumping excessively high
    // (Exempt when Developer Mode / Cheat Mode is active)
    if (!this.isCheatActive && !this.isStageClear) {
      const minTX = Math.max(0, Math.min(this.level.width - 1, Math.floor((this.marioX + 1) / GameEngine.TILE_SIZE)));
      const maxTX = Math.max(0, Math.min(this.level.width - 1, Math.floor((this.marioX + 14) / GameEngine.TILE_SIZE)));
      const inCeilingTheme =
        this.level.theme === 'underground' ||
        this.level.theme === 'ghost_house' ||
        this.level.theme === 'castle';
      const overlapsCeilingSpan =
        inCeilingTheme && (Boolean(this.ceilingTileColumns[minTX]) || Boolean(this.ceilingTileColumns[maxTX]));
      const jumpedTooHigh =
        (overlapsCeilingSpan && this.marioY < -2) ||
        ((this.level.theme === 'underground' || this.level.theme === 'ghost_house') && this.marioY < -56) ||
        this.marioY < -80;

      if (jumpedTooHigh) {
        if (this.isEditorImmortality) {
          this.marioY = overlapsCeilingSpan ? 34 : 2;
          this.marioVy = 2.5;
          this.marioInvulnerableTimer = Math.max(this.marioInvulnerableTimer, 45);
          this.sound.playPipe();
          this.particleSystem.emitScoreText('IMORTAL', this.marioX, Math.max(20, this.marioY), {
            maxLife: 30,
            vy: -0.9,
          });
          return;
        }
        this.marioY = Math.max(0, this.marioY);
        this.particleSystem.emitScoreText('ALTO DEMAIS!', this.marioX - 18, Math.max(20, this.marioY + 12), {
          maxLife: 50,
          vy: -0.8,
        });
        this.killMario(false);
        return;
      }
    }

    // Animation frames update
    if (this.marioGrounded) {
      if (Math.abs(this.marioVx) > 0.1) {
        const frameInterval = isRunning ? 4 : 7;
        this.marioAnimTimer++;
        if (this.marioAnimTimer >= frameInterval) {
          this.marioAnimTimer = 0;
          this.marioAnimFrame = (this.marioAnimFrame + 1) % 3;
        }
      } else {
        this.marioAnimFrame = 0;
      }
    } else {
      this.marioState = this.marioVy < 0 ? 'jumping' : 'falling';
    }

    // Flagpole Collision Check
    this.checkFlagpoleCollision();

    // Castle Lava & Axe Tile Collision Checks
    const hazardCheckBox = this.getMarioHitbox();
    const overlappingTiles = this.getTilesIntersecting(hazardCheckBox);
    for (const t of overlappingTiles) {
      if (t.tile.type === 'axe' && !this.isStageClear && this.bridgeCollapseQueue.length === 0) {
        this.triggerCastleAxeClear(t.tileX, t.tileY);
        return;
      }
      if (t.tile.type === 'lava') {
        if (this.isEditorImmortality) {
          this.marioVy = -6.5;
          this.marioInvulnerableTimer = Math.max(this.marioInvulnerableTimer, 45);
          this.sound.playPipe();
          return;
        }
        this.killMario(true);
        return;
      }
      if ((t.tile.type as string) === 'spike') {
        if (this.isSpinJumping && this.marioVy >= 0) {
          this.marioY = Math.min(this.marioY, t.tileY * GameEngine.TILE_SIZE - this.getMarioHeight());
          this.triggerSpinBounce(t.tileX * GameEngine.TILE_SIZE + 8, t.tileY * GameEngine.TILE_SIZE);
          break;
        }
        this.damageMario();
        return;
      }
    }

    // Checkpoint Activation Check
    if (this.level.checkpoints && this.level.checkpoints.length > 0) {
      this.level.checkpoints.forEach((cp, idx) => {
        if (!this.activatedCheckpointIndices.has(idx) && this.marioX >= cp.x) {
          this.activatedCheckpointIndices.add(idx);
          this.activeCheckpoint = { ...cp.respawnPos };
          this.sound.playPowerUpEat();
          this.particleSystem.emitScoreText('CHECKPOINT!', this.marioX - 24, this.marioY - 20, {
            maxLife: 60,
            vy: -1.0,
          });
        }
      });
    }

    // Record safe grounded coordinates for developer recovery
    if (
      this.marioGrounded &&
      this.marioY > 0 &&
      this.marioY < GameEngine.NES_HEIGHT - 24
    ) {
      this.lastSafeGroundPos = { x: this.marioX, y: this.marioY };
    }

    // Check Pit Fall Death (Abyss)
    if (this.marioY > GameEngine.NES_HEIGHT + 16) {
      const isDeveloperModeActive = this.isCheatActive || this.isDebugMode;
      if (isDeveloperModeActive && !this.isEditorImmortality && this.controls.run && !this.isStageClear) {
        // Easter Egg (Developer Mode only): Falling into the abyss while holding Run triggers "ILLEGAL INSTRUCTION" glitched screen
        this.triggerIllegalInstructionBug();
        return;
      }
      if (this.isEditorImmortality) {
        this.marioY = GameEngine.NES_HEIGHT - 18;
        this.marioVy = -9.5;
        this.marioInvulnerableTimer = Math.max(this.marioInvulnerableTimer, 60);
        if (this.marioPower === 'small') {
          this.sound.playJumpSmall();
        } else {
          this.sound.playJumpSuper();
        }
      } else {
        this.killMario(true);
      }
    }
  }

  // --- COLLISION RESOLUTION ---
  private moveMarioWithCollision() {
    const width = 14;
    const height = this.getMarioHeight();

    // Horizontal Movement
    this.marioX += this.marioVx;

    // Clamp within level horizontal bounds (bidirectional camera follows Mario inside viewport bounds)
    if (this.marioX < 0) {
      this.marioX = 0;
      this.marioVx = 0;
    }
    const maxMarioX = this.level.width * GameEngine.TILE_SIZE - 16;
    if (this.marioX > maxMarioX) {
      this.marioX = maxMarioX;
      this.marioVx = 0;
    }

    // Check horizontal tile collisions
    const marioBoxH: Rect = {
      x: this.marioX + 1,
      y: this.marioY,
      width: width,
      height: height - 2,
    };

    const tilesH = this.getTilesIntersecting(marioBoxH);
    for (const t of tilesH) {
      if (this.isSolidTile(t.tile.type)) {
        if (this.marioVx > 0) {
          this.marioX = t.tileX * GameEngine.TILE_SIZE - (width + 1);
        } else if (this.marioVx < 0) {
          this.marioX = (t.tileX + 1) * GameEngine.TILE_SIZE - 1;
        }
        this.marioVx = 0;
        break;
      }
    }

    // Vertical Movement
    const prevMarioY = this.marioY;
    const wasGrounded = this.marioGrounded;
    this.marioY += this.marioVy;
    this.marioGrounded = false;

    // Detect and reveal 'hidden' mystery blocks that only appear when Mario jumps into them from below
    if (this.marioVy < 0) {
      const currHeadTY = Math.floor(this.marioY / GameEngine.TILE_SIZE);
      const prevHeadTY = Math.floor(prevMarioY / GameEngine.TILE_SIZE);
      const minTX = Math.floor((this.marioX + 2) / GameEngine.TILE_SIZE);
      const maxTX = Math.floor((this.marioX + width - 2) / GameEngine.TILE_SIZE);

      let foundHidden = false;
      // Search from bottom-most tile upwards to find the ceiling block Mario jumped into
      for (let ty = prevHeadTY; ty >= currHeadTY && !foundHidden; ty--) {
        if (ty < 0 || ty >= this.level.height) continue;
        for (let tx = minTX; tx <= maxTX; tx++) {
          if (tx < 0 || tx >= this.level.width) continue;
          const block = this.level.tiles[ty][tx];
          if (block && block.invisible) {
            const blockBottomY = (ty + 1) * GameEngine.TILE_SIZE;
            if (prevMarioY >= blockBottomY - 4) {
              // Reveal the hidden mystery block!
              block.invisible = false;
              this.marioY = blockBottomY;
              this.marioVy = 0;
              this.hitBlock(tx, ty, block);
              foundHidden = true;
              break;
            }
          }
        }
      }
    }

    const marioBoxV: Rect = {
      x: this.marioX + 1,
      y: this.marioY,
      width: width,
      height: height,
    };

    const tilesV = this.getTilesIntersecting(marioBoxV);
    for (const t of tilesV) {
      if (this.isSolidTile(t.tile.type)) {
        if (this.marioVy > 0) {
          // Landing on floor
          const impactVy = this.marioVy;
          if ((t.tile.type as string) === 'spike' && this.isSpinJumping) {
            this.marioY = t.tileY * GameEngine.TILE_SIZE - height;
            this.triggerSpinBounce(t.tileX * GameEngine.TILE_SIZE + 8, t.tileY * GameEngine.TILE_SIZE);
            break;
          }
          this.marioY = t.tileY * GameEngine.TILE_SIZE - height;
          this.marioVy = 0;
          this.marioGrounded = true;
          this.isSpinJumping = false;
          this.spinJumpTimer = 0;
          this.stompComboCount = 0;

          // Heavy Landing Screen-Shake: triggers when falling from high drops (impactVy >= 5.5) or slamming down as Tanooki Statue
          if (impactVy >= 5.5 || this.isStatue) {
            const intensity = this.isStatue ? 4.5 : Math.min(5.0, (impactVy - 4.5) * 2.2);
            this.triggerScreenShake(intensity, 12);
            this.sound.playBump();
            this.particleSystem.emitLandingDust(this.marioX + 8, this.marioY + height, true);
          } else if (!wasGrounded && impactVy >= 1.5 && this.level.theme !== 'underwater') {
            this.particleSystem.emitLandingDust(this.marioX + 8, this.marioY + height, false);
          }

          // Femboy Extra Ability: landing on the ground unleashes 2 pure white fireballs from both sides
          const minLandingVy = this.level.theme === 'underwater' ? 0.5 : 0.9;
          if (
            this.marioPower === 'femboy' &&
            !wasGrounded &&
            impactVy >= minLandingVy &&
            !this.isStageClear &&
            this.marioState !== 'dead'
          ) {
            this.spawnFemboyGroundFireballs();
          }

          if (this.marioState === 'jumping' || this.marioState === 'falling') {
            this.marioState = Math.abs(this.marioVx) > 0.1 ? 'running' : 'idle';
          }

          const switchTile = tilesV.find(x => this.getSwitchTileColor(x.tile.type) !== null);
          if (switchTile && !this.isStageClear) {
            this.activateSmwSwitch(
              switchTile.tileX,
              switchTile.tileY,
              switchTile.tile
            );
          }
        } else if (this.marioVy < 0) {
          // Bumping head on ceiling / block
          this.marioY = (t.tileY + 1) * GameEngine.TILE_SIZE;
          this.marioVy = 0;
          this.hitBlock(t.tileX, t.tileY, t.tile);
        }
        break;
      }
    }

    // One-way top landing check on floating platforms
    this.ridingPlatformId = null;
    if (!this.marioGrounded && this.marioVy >= 0 && this.floatingPlatforms.length > 0) {
      const mLeft = this.marioX + 1;
      const mRight = mLeft + width;
      for (const plat of this.floatingPlatforms) {
        if (mRight > plat.x + 1 && mLeft < plat.x + plat.width - 1) {
          if (prevMarioY + height <= plat.prevY + 6 && this.marioY + height >= plat.y) {
            const impactVy = this.marioVy;
            this.marioY = plat.y - height;
            this.marioVy = 0;
            this.marioGrounded = true;
            this.isSpinJumping = false;
            this.spinJumpTimer = 0;
            this.ridingPlatformId = plat.id;
            this.stompComboCount = 0;

            if (!wasGrounded && impactVy >= 1.5 && this.level.theme !== 'underwater') {
              this.particleSystem.emitLandingDust(this.marioX + 8, this.marioY + height, false);
            }
            if (
              this.marioPower === 'femboy' &&
              !wasGrounded &&
              impactVy >= 0.9 &&
              !this.isStageClear &&
              this.marioState !== 'dead'
            ) {
              this.spawnFemboyGroundFireballs();
            }
            if (this.marioState === 'jumping' || this.marioState === 'falling') {
              this.marioState = Math.abs(this.marioVx) > 0.1 ? 'running' : 'idle';
            }
            break;
          }
        }
      }
    }
  }

  private updateFloatingPlatforms() {
    if (this.floatingPlatforms.length === 0) {
      this.ridingPlatformId = null;
      return;
    }

    let carriedPlat: (typeof this.floatingPlatforms)[number] | null = null;
    for (const plat of this.floatingPlatforms) {
      plat.prevX = plat.x;
      plat.prevY = plat.y;
      plat.timer += plat.speed;
      const offset = Math.sin(plat.timer) * plat.range;
      plat.x = plat.axis === 'horizontal' ? plat.originX + offset : plat.originX;
      plat.y = plat.axis === 'vertical' || plat.axis === 'bob' ? plat.originY + offset : plat.originY;
      plat.dx = plat.x - plat.prevX;
      plat.dy = plat.y - plat.prevY;
      if (this.ridingPlatformId === plat.id) {
        carriedPlat = plat;
      }
    }

    if (
      carriedPlat &&
      this.marioState !== 'dead' &&
      this.marioState !== 'pole_slide' &&
      this.marioState !== 'castle_walk' &&
      this.marioState !== 'castle_entered'
    ) {
      this.marioX += carriedPlat.dx;
      this.marioY += carriedPlat.dy;
      const maxMarioX = this.level.width * GameEngine.TILE_SIZE - 16;
      if (this.marioX < 0) this.marioX = 0;
      if (this.marioX > maxMarioX) this.marioX = maxMarioX;
    }
  }

  private hitBlock(tx: number, ty: number, block: BlockTile) {
    if (block.bumpOffset !== 0) return;

    const wasInvisible = !!block.invisible;
    // Permanently reveal hidden block
    block.invisible = false;

    // Trigger bump animation
    block.bumpOffset = 0;
    block.bumpVel = -4;

    // Defeat any enemy standing on this block
    const blockTopY = ty * GameEngine.TILE_SIZE;
    const blockCenterX = (tx + 0.5) * GameEngine.TILE_SIZE;
    this.enemies.forEach(e => {
      if (
        e.alive &&
        e.y + e.height >= blockTopY - 4 &&
        e.y + e.height <= blockTopY + 4 &&
        e.x + e.width > tx * GameEngine.TILE_SIZE &&
        e.x < (tx + 1) * GameEngine.TILE_SIZE
      ) {
        e.alive = false;
        e.state = 'flipped';
        e.vy = -5;
        this.sound.playKick();
        this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
        this.addScore(100, e.x, e.y);
        this.recordEnemyDefeat(e.type);
      }
    });

    // Bounce any active Mushroom / 1-UP / Starman resting on top of the bumped block
    this.items.forEach(item => {
      if (
        !item.collected &&
        !item.emerging &&
        (item.type === 'mushroom' || item.type === '1up' || item.type === 'star') &&
        item.y + item.height >= blockTopY - 4 &&
        item.y + item.height <= blockTopY + 4 &&
        item.x + item.width > tx * GameEngine.TILE_SIZE &&
        item.x < (tx + 1) * GameEngine.TILE_SIZE
      ) {
        item.vy = -3.8;
        const itemCenterX = item.x + item.width / 2;
        if (Math.abs(itemCenterX - blockCenterX) > 2) {
          item.vx = itemCenterX < blockCenterX ? -Math.abs(item.vx || 1.2) : Math.abs(item.vx || 1.2);
        }
      }
    });

    // Hidden mystery blocks & question blocks reveal as question_empty and dispense contents
    if (wasInvisible || block.type === 'question') {
      block.type = 'question_empty';
      this.spawnBlockContent(tx, ty, block.content);
      block.content = 'none';

      if (wasInvisible) {
        // Secret discovery sparkles
        this.particleSystem.add({
          type: 'sparkle',
          x: tx * GameEngine.TILE_SIZE + 4,
          y: ty * GameEngine.TILE_SIZE + 4,
          vx: 0,
          vy: -1.5,
          life: 0,
          maxLife: 30,
        });
      }
      return;
    }

    const exclamColor = this.getExclamBlockColor(block.type);
    if (exclamColor) {
      if (!this.isSwitchUnlocked(exclamColor)) return;
      block.type = 'question_empty';
      block.content = 'none';
      if (exclamColor === 'yellow') {
        this.spawnDirectMushroom(tx, ty);
      } else {
        const rewardItem = this.getExclamRewardItem(exclamColor);
        this.spawnBlockContent(tx, ty, rewardItem);
      }
      this.particleSystem.add({
        type: 'sparkle',
        x: tx * GameEngine.TILE_SIZE + 4,
        y: ty * GameEngine.TILE_SIZE + 4,
        vx: 0,
        vy: -1.4,
        life: 0,
        maxLife: 24,
      });
      return;
    }

    if (block.type === 'bonus_block') {
      this.resolveBonusStageBlock(tx, ty, block);
      return;
    }

    if (block.type === 'brick' || block.type === 'underground_brick' || block.type === 'ghost_brick') {
      if (block.coinsLeft && block.coinsLeft > 0) {
        block.coinsLeft--;
        this.spawnCoin(tx * GameEngine.TILE_SIZE, (ty - 1) * GameEngine.TILE_SIZE);
        this.triggerScreenShake(2.4, 7);
        if (block.coinsLeft === 0) {
          block.type = 'question_empty';
        }
      } else if (this.marioPower !== 'small') {
        // Big Mario breaks brick!
        this.level.tiles[ty][tx] = null;
        this.sound.playBrickBreak();
        this.createBrickDebris(tx * GameEngine.TILE_SIZE, ty * GameEngine.TILE_SIZE);
        this.addScore(50, tx * GameEngine.TILE_SIZE, ty * GameEngine.TILE_SIZE);
        this.triggerScreenShake(3.4, 9);
        this.recordAchievementProgress('bricks_broken', 1);
      } else {
        // Small Mario bumps brick
        this.sound.playBump();
        this.triggerScreenShake(2.4, 7);
      }
    }
  }

  public isSwitchUnlocked(color: SmwSwitchColor): boolean {
    switch (color) {
      case 'yellow':
        return this.yellowSwitchUnlocked;
      case 'green':
        return this.greenSwitchUnlocked;
      case 'red':
        return this.redSwitchUnlocked;
      case 'pink':
        return this.pinkSwitchUnlocked;
      case 'blue':
        return this.blueSwitchUnlocked;
    }
  }

  public setSwitchUnlocked(color: SmwSwitchColor, unlocked: boolean): void {
    switch (color) {
      case 'yellow':
        this.yellowSwitchUnlocked = unlocked;
        break;
      case 'green':
        this.greenSwitchUnlocked = unlocked;
        break;
      case 'red':
        this.redSwitchUnlocked = unlocked;
        break;
      case 'pink':
        this.pinkSwitchUnlocked = unlocked;
        break;
      case 'blue':
        this.blueSwitchUnlocked = unlocked;
        break;
    }
  }

  private getExclamBlockColor(type: TileType): SmwSwitchColor | null {
    switch (type) {
      case 'exclam_yellow':
        return 'yellow';
      case 'exclam_green':
        return 'green';
      case 'exclam_red':
        return 'red';
      case 'exclam_pink':
        return 'pink';
      case 'exclam_blue':
        return 'blue';
      default:
        return null;
    }
  }

  private getSwitchTileColor(type: TileType): SmwSwitchColor | null {
    switch (type) {
      case 'yellow_switch':
        return 'yellow';
      case 'green_switch':
        return 'green';
      case 'red_switch':
        return 'red';
      case 'pink_switch':
        return 'pink';
      case 'blue_switch':
        return 'blue';
      default:
        return null;
    }
  }

  private isAnySwitchTile(type: TileType | undefined): boolean {
    return (
      type === 'yellow_switch' ||
      type === 'yellow_switch_pressed' ||
      type === 'green_switch' ||
      type === 'green_switch_pressed' ||
      type === 'red_switch' ||
      type === 'red_switch_pressed' ||
      type === 'pink_switch' ||
      type === 'pink_switch_pressed' ||
      type === 'blue_switch' ||
      type === 'blue_switch_pressed'
    );
  }

  private getExclamRewardItem(color: SmwSwitchColor): 'mushroom' | 'feather' | 'fireflower' | 'femboy' | 'leaf' {
    switch (color) {
      case 'green':
        return 'feather';
      case 'red':
        return 'fireflower';
      case 'pink':
        return 'femboy';
      case 'blue':
        return 'leaf';
      case 'yellow':
      default:
        return 'mushroom';
    }
  }

  private spawnDirectMushroom(tx: number, ty: number) {
    const x = tx * GameEngine.TILE_SIZE;
    const y = ty * GameEngine.TILE_SIZE;
    this.sound.playPowerUpAppear();
    this.items.push({
      id: this.nextEntityId++,
      type: 'mushroom',
      x,
      y,
      vx: 1.2,
      vy: 0,
      width: 16,
      height: 16,
      grounded: false,
      collected: false,
      emerging: true,
      emergeY: y - 16,
    });
  }

  private activateSmwSwitch(tx: number, ty: number, tile: BlockTile) {
    const color = this.getSwitchTileColor(tile.type);
    if (this.isStageClear || !color) return;

    const pressedMap: Record<SmwSwitchColor, TileType> = {
      yellow: 'yellow_switch_pressed',
      green: 'green_switch_pressed',
      red: 'red_switch_pressed',
      pink: 'pink_switch_pressed',
      blue: 'blue_switch_pressed',
    };
    const bannerMap: Record<SmwSwitchColor, { title: string; detail: string }> = {
      yellow: { title: 'SWITCH AMARELO!', detail: 'BLOCOS [!] LIBERADOS!' },
      green: { title: 'SWITCH VERDE!', detail: 'BLOCOS [!] PENA LIBERADOS!' },
      red: { title: 'SWITCH VERMELHO!', detail: 'BLOCOS [!] FOGO LIBERADOS!' },
      pink: { title: 'SWITCH ROSA!', detail: 'BLOCOS [!] FEMBOY LIBERADOS!' },
      blue: { title: 'SWITCH AZUL!', detail: 'BLOCOS [!] TANOOKI LIBERADOS!' },
    };

    tile.type = pressedMap[color];
    this.setSwitchUnlocked(color, true);
    this.switchPalaceActivated = true;
    this.marioVx = 0;
    this.marioVy = 0;
    this.marioGrounded = true;

    const px = tx * GameEngine.TILE_SIZE;
    const py = ty * GameEngine.TILE_SIZE;
    this.sound.stopMusic();
    this.sound.playPowerUpEat();
    this.sound.playStageClear();
    this.triggerScreenShake(4.2, 16);

    for (let i = 0; i < 6; i++) {
      this.particleSystem.add({
        type: 'sparkle',
        x: px + (i - 2.5) * 8,
        y: py - 4 - (i % 2) * 8,
        vx: (i - 2.5) * 0.45,
        vy: -1.6 - (i % 3) * 0.35,
        life: 0,
        maxLife: 45,
      });
    }

    const banner = bannerMap[color];
    this.addScore(1000, px, py, banner.title);
    this.particleSystem.emitScoreText(banner.detail, px - 36, py - 24, {
      maxLife: 95,
      vy: -0.45,
    });
    this.transformStageEndEnemiesToPoints();
    this.enforceStageEndDebugLock(false);
    if (color === 'yellow') {
      this.onSmwYellowSwitchActivated?.();
    }
    this.onSmwSwitchActivated?.(color);
    this.finishStage();
  }

  private spawnBlockContent(tx: number, ty: number, content: string) {
    const x = tx * GameEngine.TILE_SIZE;
    const y = ty * GameEngine.TILE_SIZE;

    if (content === 'coin') {
      this.spawnCoin(x, y - 16);
    } else if (content === 'leaf') {
      this.sound.playPowerUpAppear();
      this.items.push({
        id: this.nextEntityId++,
        type: 'leaf',
        x,
        y: y - 8,
        vx: 0,
        vy: -2.0,
        width: 16,
        height: 16,
        grounded: false,
        collected: false,
        emerging: true,
        emergeY: y - 24,
      });
    } else if (content === 'feather') {
      this.sound.playPowerUpAppear();
      this.items.push({
        id: this.nextEntityId++,
        type: 'feather',
        x,
        y: y - 8,
        vx: 0,
        vy: -2.0,
        width: 16,
        height: 16,
        grounded: false,
        collected: false,
        emerging: true,
        emergeY: y - 24,
      });
    } else if (content === 'femboy') {
      this.sound.playPowerUpAppear();
      this.items.push({
        id: this.nextEntityId++,
        type: 'femboy',
        x,
        y,
        vx: 1.15,
        vy: 0,
        width: 16,
        height: 16,
        grounded: false,
        collected: false,
        emerging: true,
        emergeY: y - 16,
      });
    } else if (content === 'fireflower') {
      // Explicit Fire Flower block: emerges and remains stationary on the block
      this.sound.playPowerUpAppear();
      this.items.push({
        id: this.nextEntityId++,
        type: 'fireflower',
        x,
        y,
        vx: 0,
        vy: 0,
        width: 16,
        height: 16,
        grounded: false,
        collected: false,
        emerging: true,
        emergeY: y - 16,
      });
    } else if (content === 'mushroom') {
      // Classic SMB power-up progression: Small Mario gets Super Mushroom, Big Mario gets Fire Flower
      const itemType: 'mushroom' | 'fireflower' = this.marioPower === 'small' ? 'mushroom' : 'fireflower';

      this.sound.playPowerUpAppear();
      this.items.push({
        id: this.nextEntityId++,
        type: itemType,
        x,
        y: y,
        vx: itemType === 'fireflower' ? 0 : 1.2,
        vy: 0,
        width: 16,
        height: 16,
        grounded: false,
        collected: false,
        emerging: true,
        emergeY: y - 16,
      });
    } else if (content === 'star') {
      this.sound.playPowerUpAppear();
      this.items.push({
        id: this.nextEntityId++,
        type: 'star',
        x,
        y: y,
        vx: 1.4,
        vy: -3.5,
        width: 16,
        height: 16,
        grounded: false,
        collected: false,
        emerging: true,
        emergeY: y - 16,
      });
    } else if (content === '1up') {
      this.sound.playPowerUpAppear();
      this.items.push({
        id: this.nextEntityId++,
        type: '1up',
        x,
        y: y,
        vx: 1.2,
        vy: 0,
        width: 16,
        height: 16,
        grounded: false,
        collected: false,
        emerging: true,
        emergeY: y - 16,
      });
    } else {
      this.sound.playBump();
    }
  }

  private spawnCoin(x: number, y: number) {
    this.sound.playCoin();
    this.stats.coins++;
    if (this.stats.coins >= 100) {
      this.stats.coins = 0;
      this.stats.lives++;
      this.sound.playPowerUpEat();
    }
    this.addScore(200, x, y);
    this.spawnCoinParticles(x, y);
    this.recordAchievementProgress('coins_collected', 1);

    // Bouncing coin particle
    this.particleSystem.add({
      type: 'sparkle',
      x: x + 4,
      y: y,
      vx: 0,
      vy: -6,
      life: 0,
      maxLife: 25,
    });
  }

  public createBrickDebris(x: number, y: number, fromRemote: boolean = false) {
    if (!fromRemote || this.isNearCamera(x)) {
      this.particleSystem.emitBrickBreak(x, y, this.level.theme);
    }
    if (!fromRemote && this.isMultiplayerConnected) {
      this.onMultiplayerWorldEvent?.('brick_break', x, y);
    }
  }

  // --- ENEMIES UPDATE ---
  private updateEnemies() {
    const marioBox = this.getMarioHitbox();

    this.enemies.forEach(e => {
      if (!e.alive && e.state !== 'flipped' && e.state !== 'squashed') return;

      // R1.19.1GX.5: Carried Koopa shell follows Mario's hands and shields against contact enemies
      if (this.heldShellEnemyId === e.id) {
        if (!e.alive || (e.type !== 'koopa' && e.type !== 'red_koopa') || e.state !== 'shell_idle') {
          this.heldShellEnemyId = null;
        } else {
          const dir = this.marioFacing === 'right' ? 1 : -1;
          e.x = this.marioX + dir * 10;
          e.y = this.marioY + Math.max(2, this.getMarioHeight() - 16);
          e.vx = 0;
          e.vy = 0;
          e.stateTimer = Math.max(e.stateTimer, 180);
          const shellBox: Rect = { x: e.x, y: e.y, width: e.width, height: e.height };
          for (const other of this.enemies) {
            if (
              other.id !== e.id &&
              other.alive &&
              other.type !== 'bowser' &&
              other.type !== 'lava_bubble' &&
              this.rectsIntersect(shellBox, { x: other.x, y: other.y, width: other.width, height: other.height })
            ) {
              other.alive = false;
              other.state = 'flipped';
              other.vy = -5;
              e.alive = false;
              e.state = 'flipped';
              e.vy = -5;
              this.heldShellEnemyId = null;
              this.sound.playKick();
              this.triggerScreenShake(2.8, 6);
              this.spawnEnemyDefeatParticles(other.x, other.y, other.type);
              this.addScore(400, other.x, other.y);
              this.recordEnemyDefeat(other.type);
              break;
            }
          }
          return;
        }
      }

      // Squashed Goomba timer
      if (e.state === 'squashed') {
        e.stateTimer++;
        return;
      }

      // Flipped dead enemy falling off screen
      if (e.state === 'flipped') {
        e.vy += 0.35;
        e.y += e.vy;
        e.x += e.vx;
        return;
      }

      // Piranha plant animation and logic
      if (e.type === 'piranha') {
        e.animTimer++;
        if (e.animTimer % 8 === 0) {
          e.animFrame = (e.animFrame + 1) % 2;
        }

        // Check if Mario is near or on top of the pipe (Mario's center vs pipe center)
        const marioCenter = this.marioX + 7;
        const marioNearPipe = Math.abs(marioCenter - e.x) < 28;

        // Piranha rises and lowers periodically
        e.stateTimer++;
        const cycle = e.stateTimer % 180;
        if (cycle < 60 && e.pipeOriginY && !marioNearPipe) {
          // Rise outside pipe
          e.y = Math.max(e.pipeOriginY - 24, e.y - 0.5);
        } else if (e.pipeOriginY) {
          // Lower back into pipe
          e.y = Math.min(e.pipeOriginY, e.y + 0.5);
        }

        // CRITICAL BUG FIX: Only damage Mario when protruding OUTSIDE the pipe!
        // When inside the pipe (e.y >= e.pipeOriginY - 6), it cannot hurt Mario.
        if (e.pipeOriginY !== undefined && e.y < e.pipeOriginY - 6) {
          const protrudingHeight = Math.max(4, e.pipeOriginY - e.y);
          const piranhaHitbox: Rect = {
            x: e.x - 7,
            y: e.y,
            width: 14,
            height: protrudingHeight,
          };
          if (this.rectsIntersect(marioBox, piranhaHitbox)) {
            const prevMarioBottom = marioBox.y + marioBox.height - this.marioVy;
            const isSpinBounce =
              this.isSpinJumping &&
              this.marioVy >= -0.6 &&
              prevMarioBottom <= e.y + 13;
            this.marioHitEnemy(e, isSpinBounce);
          }
        }
        return;
      }

      // Only activate enemy when camera is near (within 300px)
      if (e.x > this.cameraX + GameEngine.NES_WIDTH + 40 || e.x < this.cameraX - 40) {
        if (e.type === 'bullet_bill' && e.x < this.cameraX - 40) {
          e.alive = false;
        }
        return;
      }

      // Boo (Haunted Ghost AI: freezes & blushes when Mario looks at it; floats toward Mario when facing away)
      if (e.type === 'boo') {
        e.stateTimer++;
        const speedMult = this.level.enemySpeedMultiplier ?? 1;
        const marioCenterX = this.marioX + 8;
        const marioCenterY = this.marioY + this.getMarioHeight() / 2 - 4;
        const booCenterX = e.x + 8;
        const booCenterY = e.y + 8;
        const dx = marioCenterX - booCenterX;
        const dy = marioCenterY - booCenterY;

        const marioLookingAtBoo =
          (dx > 1 && this.marioFacing === 'left') ||
          (dx < -1 && this.marioFacing === 'right');

        e.facing = dx >= 0 ? 'right' : 'left';

        if (marioLookingAtBoo) {
          e.vx = 0;
          e.vy = 0;
          e.animFrame = 1; // Shy blush covering eyes
        } else {
          e.animFrame = 0; // Menacing chase
          const dist = Math.hypot(dx, dy) || 1;
          const speed = 0.78 * speedMult;
          e.vx = (dx / dist) * speed;
          e.vy = (dy / dist) * speed + Math.sin(e.stateTimer * 0.1) * 0.16;
          e.x += e.vx;
          e.y += e.vy;
        }

        const canCollideBoo =
          this.marioState !== 'dead' &&
          this.marioState !== 'pipe_entering' &&
          this.marioState !== 'pipe_exiting' &&
          this.marioState !== 'pole_slide' &&
          this.marioState !== 'castle_walk' &&
          this.marioState !== 'castle_entered';

        if (canCollideBoo) {
          const booHitbox: Rect = { x: e.x + 2, y: e.y + 2, width: 12, height: 12 };
          if (this.rectsIntersect(marioBox, booHitbox)) {
            const prevMarioBottom = marioBox.y + marioBox.height - this.marioVy;
            const isSpinBounce =
              this.isSpinJumping &&
              this.marioVy >= -0.6 &&
              prevMarioBottom <= e.y + 13;
            this.marioHitEnemy(e, isSpinBounce);
          }
        }
        return;
      }

      // Koopa / Red Koopa stationary shell: wakes back up to patrol if left untouched
      if ((e.type === 'koopa' || e.type === 'red_koopa') && e.state === 'shell_idle') {
        if (e.stateTimer > 0) {
          e.stateTimer--;
          if (e.stateTimer <= 0) {
            const speedMult = this.level.enemySpeedMultiplier ?? 1;
            const dir: -1 | 1 = this.marioX >= e.x ? 1 : -1;
            e.state = 'walk';
            e.height = 24;
            e.y -= 8;
            e.facing = dir > 0 ? 'right' : 'left';
            e.vx = EnemySpawnManager.getInitialVelocity(e.type, speedMult, dir);
          }
        }
      }

      // Post-kick grace period for moving shells so kicking doesn't self-hit immediately
      if ((e.type === 'koopa' || e.type === 'red_koopa') && e.state === 'shell_moving' && e.stateTimer > 0) {
        e.stateTimer--;
      }

      // Dry Bones crumbled bone-pile state: rests harmlessly then shakes & revives
      if (e.type === 'dry_bones' && e.state === 'shell_idle') {
        e.stateTimer--;
        if (e.stateTimer <= 0) {
          const speedMult = this.level.enemySpeedMultiplier ?? 1;
          const dir: -1 | 1 = this.marioX >= e.x ? 1 : -1;
          e.state = 'walk';
          e.height = 24;
          e.y -= 8;
          e.facing = dir > 0 ? 'right' : 'left';
          e.vx = EnemySpawnManager.getInitialVelocity('dry_bones', speedMult, dir);
          this.sound.playBump();
          this.spawnEnemyDefeatParticles(e.x, e.y + 8, 'dry_bones');
        }
        return;
      }

      // Bullet Bill (High-speed straight horizontal projectile enemy, ignores gravity/walls)
      if (e.type === 'bullet_bill') {
        e.x += e.vx;
        const canCollide =
          this.marioState !== 'dead' &&
          this.marioState !== 'pipe_entering' &&
          this.marioState !== 'pipe_exiting' &&
          this.marioState !== 'pole_slide' &&
          this.marioState !== 'castle_walk' &&
          this.marioState !== 'castle_entered';
        if (canCollide) {
          const bulletBox: Rect = { x: e.x + 1, y: e.y + 2, width: e.width - 2, height: e.height - 4 };
          if (this.rectsIntersect(marioBox, bulletBox)) {
            const prevMarioBottom = marioBox.y + marioBox.height - this.marioVy;
            const isStomp = this.marioVy > 0 && prevMarioBottom <= e.y + 8;
            this.marioHitEnemy(e, isStomp);
          }
        }
        return;
      }

      // Cheep-Cheep & Fast Turbo Cheep-Cheep (Swimming fish AI)
      if (e.type === 'cheep_cheep' || e.type === 'fast_cheep') {
        e.stateTimer++;
        e.animTimer++;
        const animStep = e.type === 'fast_cheep' ? 6 : 10;
        if (e.animTimer % animStep === 0) {
          e.animFrame = (e.animFrame + 1) % 2;
        }
        e.x += e.vx;
        const waveFreq = e.type === 'fast_cheep' ? 0.12 : 0.06;
        const waveAmp = e.type === 'fast_cheep' ? 0.65 : 0.35;
        e.y += Math.sin(e.stateTimer * waveFreq) * waveAmp;
        if (this.level.dryFinishStartX !== undefined && e.x > this.level.dryFinishStartX - 24) {
          e.vx = -Math.abs(e.vx);
          e.facing = 'left';
        }
        const cheepHitbox: Rect = { x: e.x + 2, y: e.y + 2, width: 12, height: 12 };
        if (this.rectsIntersect(marioBox, cheepHitbox)) {
          this.marioHitEnemy(e, false);
        }
        return;
      }

      // Blooper (Underwater squid AI: lunges diagonally toward Mario, then drifts downward)
      if (e.type === 'blooper') {
        e.stateTimer++;
        const speedMult = this.level.enemySpeedMultiplier ?? 1;
        const cycle = e.stateTimer % 72;
        if (cycle === 1 && e.y > 38) {
          const dirToMario = this.marioX >= e.x ? 1 : -1;
          e.vx = dirToMario * 0.85 * speedMult;
          e.vy = -1.65;
          e.facing = dirToMario >= 0 ? 'right' : 'left';
          e.animFrame = 0;
        } else if (cycle < 22) {
          e.vy += 0.07;
          e.animFrame = 0;
        } else {
          e.vx *= 0.92;
          e.vy = 0.45;
          e.animFrame = 1;
        }

        e.x += e.vx;
        e.y += e.vy;

        // Keep Blooper below water surface and above sea floor
        if (e.y < 28) {
          e.y = 28;
          e.vy = 0.4;
        }
        if (e.y > 11 * GameEngine.TILE_SIZE) {
          e.y = 11 * GameEngine.TILE_SIZE;
          e.vy = 0;
        }
        if (this.level.dryFinishStartX !== undefined && e.x > this.level.dryFinishStartX - 24) {
          e.x = this.level.dryFinishStartX - 24;
          e.vx = -Math.abs(e.vx);
        }

        const blooperHitbox: Rect = { x: e.x + 2, y: e.y + 2, width: 12, height: 12 };
        if (this.rectsIntersect(marioBox, blooperHitbox)) {
          this.marioHitEnemy(e, false);
        }
        return;
      }

      // Lava Bubble / Podoboo (Leaps vertically from lava pools)
      if (e.type === 'lava_bubble') {
        e.stateTimer++;
        e.animTimer++;
        if (e.animTimer % 6 === 0) {
          e.animFrame = (e.animFrame + 1) % 2;
        }
        const originY = e.pipeOriginY ?? 13 * GameEngine.TILE_SIZE;
        const speedMult = this.level.enemySpeedMultiplier ?? 1;
        const cycleLen = Math.max(70, Math.round(125 / Math.sqrt(speedMult)));
        const cycle = e.stateTimer % cycleLen;
        if (cycle === 1) {
          e.y = originY;
          e.vy = -5.4 - Math.min(1.0, (speedMult - 1) * 0.6);
        } else if (cycle < cycleLen - 25) {
          e.vy += 0.16;
          e.y += e.vy;
          if (e.y > originY) {
            e.y = originY;
            e.vy = 0;
          }
        } else {
          e.y = originY + 8;
          e.vy = 0;
        }

        if (e.y < originY - 4) {
          const bubbleHitbox: Rect = { x: e.x + 2, y: e.y + 2, width: 12, height: 12 };
          if (this.rectsIntersect(marioBox, bubbleHitbox)) {
            this.marioHitEnemy(e, false);
          }
        }
        return;
      }

      // Bowser (Castle Boss AI: patrols bridge, jumps, breathes fireballs)
      if (e.type === 'bowser') {
        if (e.hitFlashTimer && e.hitFlashTimer > 0) {
          e.hitFlashTimer--;
        }
        e.stateTimer++;
        e.animTimer++;
        if (e.animTimer % 12 === 0) {
          e.animFrame = (e.animFrame + 1) % 2;
        }
        const speedMult = this.level.enemySpeedMultiplier ?? 1;
        e.facing = this.marioX < e.x ? 'left' : 'right';

        const arenaCenter = e.originX ?? e.x;
        const minX = arenaCenter - 52;
        const maxX = arenaCenter + 40;
        e.x += e.vx;
        if (e.x <= minX) {
          e.x = minX;
          e.vx = Math.abs(e.vx);
        } else if (e.x >= maxX) {
          e.x = maxX;
          e.vx = -Math.abs(e.vx);
        }

        // Periodic jump on bridge
        const jumpInterval = Math.max(65, Math.round(115 / Math.sqrt(speedMult)));
        if (e.stateTimer % jumpInterval === 0 && Math.abs(e.vy) < 0.05) {
          e.vy = -4.9;
        }

        e.vy += 0.28;
        if (e.vy > 5.5) e.vy = 5.5;
        e.y += e.vy;

        const bowserBoxV: Rect = { x: e.x + 2, y: e.y, width: e.width - 4, height: e.height };
        const tilesV = this.getTilesIntersecting(bowserBoxV);
        for (const t of tilesV) {
          if (this.isSolidTile(t.tile.type) && e.vy > 0) {
            const impactVy = e.vy;
            e.y = t.tileY * GameEngine.TILE_SIZE - e.height;
            e.vy = 0;
            if (impactVy >= 1.2) {
              this.triggerScreenShake(Math.min(5.2, 2.8 + impactVy * 0.38), 14);
              this.particleSystem.emitLandingDust(e.x + e.width / 2, e.y + e.height, true);
              if (Math.abs(this.marioX - e.x) < 260) {
                this.sound.playBump();
              }
            }
            break;
          }
        }

        // Breathe horizontal fireball toward Mario when Mario is within range
        if (e.fireTimer !== undefined) {
          e.fireTimer--;
          if (e.fireTimer <= 0) {
            const cycleCount = Math.floor(((this.level.endlessStage || 1) - 1) / 4);
            e.fireTimer = Math.max(48, 108 - cycleCount * 14);
            if (Math.abs(this.marioX - e.x) < 230 && this.bridgeCollapseQueue.length === 0) {
              const dir = e.facing === 'left' ? -1 : 1;
              this.sound.playBowserFire();
              this.bossFireballs.push({
                id: this.nextEntityId++,
                x: dir < 0 ? e.x - 10 : e.x + e.width,
                y: e.y + 6 + (e.stateTimer % 2 === 0 ? 0 : 8),
                vx: dir * (2.0 + Math.min(1.4, (speedMult - 1) * 0.9)),
                animTimer: 0,
              });
            }
          }
        }

        const bowserHitbox: Rect = { x: e.x + 2, y: e.y + 2, width: e.width - 4, height: e.height - 2 };
        if (this.rectsIntersect(marioBox, bowserHitbox)) {
          // Bowser cannot be normal-stomped, but Spin Jump bounces safely off his spiky shell
          const prevMarioBottom = marioBox.y + marioBox.height - this.marioVy;
          const isSpinBounce =
            this.isSpinJumping &&
            this.marioVy >= -0.6 &&
            prevMarioBottom <= e.y + 14;
          this.marioHitEnemy(e, isSpinBounce);
        }
        return;
      }

      // Walking & hopping enemy animation (Goomba, Koopa, Red Koopa, Paratroopa, Hammer Bro)
      e.animTimer++;
      const animRate =
        e.type === 'paratroopa' ? 6 : e.type === 'red_koopa' ? 7 : e.type === 'hammer_bro' ? 8 : 10;
      if (e.animTimer % animRate === 0) {
        e.animFrame = (e.animFrame + 1) % 2;
      }

      if (e.type === 'hammer_bro') {
        e.stateTimer++;
        e.facing = this.marioX + 7 >= e.x + 8 ? 'right' : 'left';
        const patrolCenter = e.originX ?? e.x;
        if (e.x <= patrolCenter - 22 && e.vx < 0) {
          e.vx = Math.abs(e.vx);
        } else if (e.x >= patrolCenter + 22 && e.vx > 0) {
          e.vx = -Math.abs(e.vx);
        }
      }

      // Apply horizontal speed
      e.x += e.vx;

      // World boundary collision check (keeps Goombas/enemies inside level horizontally)
      const levelPixelWidth = this.level.width * GameEngine.TILE_SIZE;
      if (e.x < 0) {
        e.x = 0;
        e.vx = Math.abs(e.vx);
        e.facing = 'right';
      } else if (e.x + e.width > levelPixelWidth) {
        e.x = levelPixelWidth - e.width;
        e.vx = -Math.abs(e.vx);
        e.facing = 'left';
      }

      // Horizontal wall & pipe collision check with exact boundary snapping
      const enemyBoxH: Rect = { x: e.x, y: e.y + 1, width: e.width, height: e.height - 3 };
      const tilesH = this.getTilesIntersecting(enemyBoxH);
      for (const t of tilesH) {
        if (this.isSolidTile(t.tile.type)) {
          if (e.vx > 0) {
            e.x = t.tileX * GameEngine.TILE_SIZE - e.width;
          } else if (e.vx < 0) {
            e.x = (t.tileX + 1) * GameEngine.TILE_SIZE;
          }
          e.vx = -e.vx;
          if (e.type !== 'hammer_bro') {
            e.facing = e.vx > 0 ? 'right' : 'left';
          }
          if (e.state === 'shell_moving') {
            this.sound.playBump();
          }
          break;
        }
      }

      // Apply Gravity (Paratroopas glide in high bouncing arcs; Hammer Bros hop cleanly)
      const prevEnemyY = e.y;
      const enemyGravity = e.type === 'paratroopa' ? 0.21 : e.type === 'hammer_bro' ? 0.30 : 0.35;
      e.vy += enemyGravity;
      if (e.vy > 6.0) e.vy = 6.0;
      e.y += e.vy;

      // Vertical floor/pipe-top/ceiling collision check
      const enemyBoxV: Rect = { x: e.x + 1, y: e.y, width: e.width - 2, height: e.height };
      const tilesV = this.getTilesIntersecting(enemyBoxV);
      let enemyGrounded = false;
      let groundedFloatingPlatform: (typeof this.floatingPlatforms)[number] | null = null;
      for (const t of tilesV) {
        if (this.isSolidTile(t.tile.type)) {
          if (e.vy > 0) {
            e.y = t.tileY * GameEngine.TILE_SIZE - e.height;
            if (e.type === 'paratroopa') {
              // Winged Paratroopa rebounds upward rhythmically in a bouncing arc
              e.vy = -4.6;
            } else {
              e.vy = 0;
              enemyGrounded = true;
            }
            break;
          } else if (e.vy < 0) {
            e.y = (t.tileY + 1) * GameEngine.TILE_SIZE;
            e.vy = 0;
            break;
          }
        }
      }

      // Land & ride floating platforms (used by Goombas, Koopas, and Dry Bones)
      if (!enemyGrounded && e.vy >= 0 && this.floatingPlatforms.length > 0) {
        const prevBottom = prevEnemyY + e.height;
        const nextBottom = e.y + e.height;
        for (const plat of this.floatingPlatforms) {
          const horizOverlap = e.x + e.width - 2 > plat.x && e.x + 2 < plat.x + plat.width;
          if (horizOverlap && prevBottom <= plat.y + 5 && nextBottom >= plat.y) {
            e.y = plat.y - e.height;
            e.x += plat.dx;
            if (e.type === 'paratroopa') {
              e.vy = -4.6;
            } else {
              e.vy = 0;
              enemyGrounded = true;
              groundedFloatingPlatform = plat;
            }
            break;
          }
        }
      }

      // Hammer Brother hops & throws spinning hammers in high arcs toward the player
      if (e.type === 'hammer_bro' && e.state === 'walk') {
        const speedMult = this.level.enemySpeedMultiplier ?? 1;
        const hopInterval = Math.max(75, Math.round(135 / Math.sqrt(speedMult)));
        if (enemyGrounded && e.stateTimer % hopInterval === 0) {
          e.vy = -5.2;
        }

        if (e.fireTimer === undefined) {
          e.fireTimer = 42;
        }
        e.fireTimer--;
        if (e.fireTimer <= 0) {
          e.fireTimer = Math.max(46, Math.round((76 + Math.random() * 28) / Math.sqrt(speedMult)));
          if (Math.abs(this.marioX - e.x) < 220 && e.y < GameEngine.NES_HEIGHT - 16) {
            const throwDir = this.marioX + 7 >= e.x + 8 ? 1 : -1;
            const distFactor = Math.min(1.0, Math.abs(this.marioX - e.x) / 140);
            this.sound.playKick();
            this.hammerProjectiles.push({
              id: this.nextEntityId++,
              x: throwDir > 0 ? e.x + 10 : e.x - 6,
              y: e.y - 4,
              vx: throwDir * (1.15 + distFactor * 0.85 + Math.random() * 0.25),
              vy: -4.8 - Math.random() * 0.8,
              animTimer: 0,
            });
          }
        }
      }

      // Red Koopa & Dry Bones smart ledge-turn AI: stays on platforms instead of walking blindly into pits
      if ((e.type === 'red_koopa' || e.type === 'dry_bones') && e.state === 'walk' && enemyGrounded) {
        const probeX = e.vx > 0 ? e.x + e.width + 2 : e.x - 2;
        if (groundedFloatingPlatform) {
          const staysOnPlat =
            probeX >= groundedFloatingPlatform.x + 2 &&
            probeX <= groundedFloatingPlatform.x + groundedFloatingPlatform.width - 2;
          if (!staysOnPlat) {
            e.vx = -e.vx;
            e.facing = e.vx > 0 ? 'right' : 'left';
          }
        } else {
          const probeTX = Math.floor(probeX / GameEngine.TILE_SIZE);
          const footTY = Math.floor((e.y + e.height + 2) / GameEngine.TILE_SIZE);
          if (probeTX >= 0 && probeTX < this.level.width && footTY >= 0 && footTY < this.level.height) {
            const groundAhead = this.level.tiles[footTY]?.[probeTX];
            if (!groundAhead || !this.isSolidTile(groundAhead.type)) {
              e.vx = -e.vx;
              e.facing = e.vx > 0 ? 'right' : 'left';
            }
          }
        }
      }

      // Clean up enemies that fall into pits
      if (e.y > GameEngine.NES_HEIGHT + 32) {
        e.alive = false;
        e.state = 'flipped';
        return;
      }

      // Ground enemy-to-enemy interactions
      if (e.state === 'shell_moving') {
        // Moving shell kills other enemies with impact screen-shake & classic escalating combo
        const shellBox: Rect = { x: e.x, y: e.y, width: e.width, height: e.height };
        this.enemies.forEach(other => {
          if (other.id !== e.id && other.alive && this.rectsIntersect(shellBox, { x: other.x, y: other.y, width: other.width, height: other.height })) {
            const otherWasMovingShell = other.state === 'shell_moving';
            other.alive = false;
            other.state = 'flipped';
            other.vy = -5;
            if (otherWasMovingShell) {
              e.alive = false;
              e.state = 'flipped';
              e.vy = -5;
            }
            this.sound.playKick();
            this.triggerScreenShake(3.0, 7);
            this.spawnEnemyDefeatParticles(other.x, other.y, other.type);
            const streak = e.shellKillStreak ?? 0;
            e.shellKillStreak = streak + 1;
            if (streak < GameEngine.SHELL_STREAK_SCORES.length) {
              this.addScore(GameEngine.SHELL_STREAK_SCORES[streak], other.x, other.y);
            } else {
              this.awardExtraLife(other.x, other.y);
            }
            this.recordEnemyDefeat(other.type);
            if (otherWasMovingShell) {
              this.recordEnemyDefeat(e.type);
            }
          }
        });
      } else if (e.state === 'walk' && e.type !== 'paratroopa' && e.type !== 'hammer_bro') {
        // Walking Goombas & Koopas bump and reverse direction on contact with each other or idle shells
        for (const other of this.enemies) {
          if (
            other.id === e.id ||
            !other.alive ||
            (other.state !== 'walk' && other.state !== 'shell_idle') ||
            other.type === 'piranha' ||
            other.type === 'blooper' ||
            other.type === 'cheep_cheep' ||
            other.type === 'fast_cheep' ||
            other.type === 'bullet_bill' ||
            other.type === 'paratroopa' ||
            other.type === 'hammer_bro' ||
            other.type === 'boo'
          ) {
            continue;
          }

          const overlapX = Math.min(e.x + e.width, other.x + other.width) - Math.max(e.x, other.x);
          const overlapY = Math.min(e.y + e.height, other.y + other.height) - Math.max(e.y, other.y);
          if (overlapX > 0 && overlapY > 2) {
            const eCenter = e.x + e.width / 2;
            const otherCenter = other.x + other.width / 2;
            const eLeft = eCenter <= otherCenter;
            const prevEX = e.x;
            const prevOtherX = other.x;

            if (other.state === 'walk') {
              const halfPush = overlapX / 2;
              e.x += eLeft ? -halfPush : halfPush;
              other.x += eLeft ? halfPush : -halfPush;
              e.vx = eLeft ? -Math.abs(e.vx) : Math.abs(e.vx);
              e.facing = e.vx > 0 ? 'right' : 'left';
              other.vx = eLeft ? Math.abs(other.vx) : -Math.abs(other.vx);
              other.facing = other.vx > 0 ? 'right' : 'left';
            } else {
              e.x = eLeft ? other.x - e.width : other.x + other.width;
              e.vx = eLeft ? -Math.abs(e.vx) : Math.abs(e.vx);
              e.facing = e.vx > 0 ? 'right' : 'left';
            }

            // Ensure separation doesn't push either enemy into a solid pipe/wall
            const eHitsWall = this.getTilesIntersecting({ x: e.x, y: e.y + 1, width: e.width, height: e.height - 3 }).some(t => this.isSolidTile(t.tile.type));
            if (eHitsWall) {
              e.x = prevEX;
            }
            if (other.state === 'walk') {
              const otherHitsWall = this.getTilesIntersecting({ x: other.x, y: other.y + 1, width: other.width, height: other.height - 3 }).some(t => this.isSolidTile(t.tile.type));
              if (otherHitsWall) {
                other.x = prevOtherX;
              }
            }
          }
        }
      }

      // Check collision with Mario (only during active playable states)
      const canCollideWithMario =
        this.marioState !== 'dead' &&
        this.marioState !== 'pipe_entering' &&
        this.marioState !== 'pipe_exiting' &&
        this.marioState !== 'pole_slide' &&
        this.marioState !== 'castle_walk' &&
        this.marioState !== 'castle_entered';

      if (canCollideWithMario && !(e.type === 'dry_bones' && e.state === 'shell_idle')) {
        const currentMarioBox = this.getMarioHitbox();
        const enemyHitbox: Rect = { x: e.x + 1, y: e.y + 1, width: e.width - 2, height: e.height - 1 };
        if (this.rectsIntersect(currentMarioBox, enemyHitbox)) {
          // Is Mario jumping/falling down on top of enemy?
          const prevMarioBottom = currentMarioBox.y + currentMarioBox.height - this.marioVy;
          const isShell =
            (e.type === 'koopa' || e.type === 'red_koopa') &&
            (e.state === 'shell_idle' || e.state === 'shell_moving');
          const isStomp =
            this.marioVy > 0 &&
            prevMarioBottom <= e.y + (isShell ? 12 : this.isSpinJumping ? 13 : 9);
          if (
            (e.type === 'koopa' || e.type === 'red_koopa') &&
            e.state === 'shell_moving' &&
            e.stateTimer > 0 &&
            !isStomp
          ) {
            return;
          }
          this.marioHitEnemy(e, isStomp);
        }
      }
    });

    // Cleanup squashed and fallen offscreen dead enemies
    this.enemies = this.enemies.filter(
      e => (e.state !== 'squashed' || e.stateTimer < 30) && (e.state !== 'flipped' || e.y <= GameEngine.NES_HEIGHT + 48)
    );
  }

  public isSpinBounceProtectedEnemy(type: EnemyType | string): boolean {
    return (
      type === 'boo' ||
      type === 'piranha' ||
      type === 'dry_bones' ||
      type === 'bowser' ||
      type === 'spiny' ||
      type === 'spike_top' ||
      type === 'thwomp'
    );
  }

  private triggerSpinBounce(impactX: number, impactY: number, soundKind: 'bounce' | 'stomp' = 'bounce') {
    const holdBoost = Boolean(this.controls.spinJump || this.controls.jump);
    this.isSpinJumping = true;
    this.marioGrounded = false;
    this.marioState = 'jumping';
    this.marioVy = holdBoost ? -6.8 : -5.4;
    this.spawnPowerUpSparkles(impactX - 4, impactY - 4);
    if (soundKind === 'stomp') {
      this.sound.playStomp();
    } else {
      this.sound.playSpinBounce();
    }
    this.triggerScreenShake(1.6, 4);
  }

  private awardExtraLife(x: number, y: number) {
    this.stats.lives++;
    this.sound.play1Up();
    const isFemboy = this.marioPower === 'femboy';
    const message = isFemboy ? 'Cumming' : 'Life UP';
    this.particleSystem.emitScoreText(message, x - 8, y - 10, {
      maxLife: 45,
      vy: -1.0,
      color: isFemboy ? '#ff70c8' : '#78f858',
    });
    if (isFemboy) {
      this.spawnFemboyHeartParticle(x + 8, y - 4);
    }
  }

  private awardStompCombo(x: number, y: number, minStep: number = 0) {
    const step = Math.max(this.stompComboCount, minStep);
    this.stompComboCount = step + 1;
    if (step < GameEngine.STOMP_COMBO_SCORES.length) {
      this.addScore(GameEngine.STOMP_COMBO_SCORES[step], x, y);
    } else {
      this.awardExtraLife(x, y);
    }
  }

  private marioHitEnemy(e: Enemy, isStomp: boolean) {
    // Starman kills everything except lava sparks with classic combo escalation
    if (this.marioStarTimer > 0) {
      if (e.type === 'lava_bubble') return;
      e.alive = false;
      e.state = 'flipped';
      e.vy = -5;
      this.sound.playKick();
      this.triggerLargeEnemyImpactShake(e);
      this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
      if (e.type === 'bowser') {
        this.addScore(5000, e.x, e.y, `${this.getBossDisplayName(e).toUpperCase()}!`);
      } else {
        const step = this.starComboCount;
        this.starComboCount++;
        if (step < GameEngine.STOMP_COMBO_SCORES.length) {
          this.addScore(GameEngine.STOMP_COMBO_SCORES[step], e.x, e.y);
        } else {
          this.awardExtraLife(e.x, e.y);
        }
      }
      this.recordEnemyDefeat(e.type);
      return;
    }

    if (isStomp) {
      // R1.19.1CU.5: SMW Spin Jump bounces safely off Boos, Piranha Plants, Bowser, Dry Bones, and future spiky enemies
      if (this.isSpinJumping) {
        if (this.isSpinBounceProtectedEnemy(e.type) && e.type !== 'dry_bones') {
          this.marioY = Math.min(this.marioY, e.y - this.getMarioHeight());
          this.triggerSpinBounce(e.x + e.width / 2, e.y, 'bounce');
          return;
        }
        if (e.type === 'dry_bones') {
          if (e.state === 'walk') {
            this.triggerLargeEnemyImpactShake(e);
            e.state = 'shell_idle';
            e.stateTimer = 210;
            e.vx = 0;
            e.y += 8;
            e.height = 16;
            this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
            this.awardStompCombo(e.x, e.y);
          }
          this.marioY = Math.min(this.marioY, e.y - this.getMarioHeight());
          this.triggerSpinBounce(e.x + e.width / 2, e.y, 'stomp');
          return;
        }
        if (
          e.type === 'goomba' ||
          e.type === 'koopa' ||
          e.type === 'red_koopa' ||
          e.type === 'paratroopa' ||
          e.type === 'hammer_bro' ||
          e.type === 'bullet_bill'
        ) {
          e.alive = false;
          e.state = e.type === 'goomba' ? 'squashed' : 'flipped';
          e.vx = 0;
          e.vy = e.type === 'goomba' ? 0 : -4.2;
          this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
          this.awardStompCombo(e.x, e.y, e.type === 'hammer_bro' ? 5 : e.type === 'bullet_bill' ? 1 : 0);
          this.recordEnemyDefeat(e.type);
          this.triggerSpinBounce(e.x + e.width / 2, e.y, 'stomp');
          return;
        }
      }

      if (e.type === 'goomba') {
        e.alive = false;
        e.state = 'squashed';
        this.sound.playStomp();
        this.marioVy = -6.0; // Stomp bounce
        this.triggerScreenShake(1.5, 4);
        this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
        this.awardStompCombo(e.x, e.y);
        this.recordEnemyDefeat(e.type);
      } else if (e.type === 'bullet_bill') {
        e.alive = false;
        e.state = 'flipped';
        e.vx = 0;
        e.vy = 2.5;
        this.sound.playStomp();
        this.marioVy = -6.2;
        this.triggerScreenShake(2.5, 7);
        this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
        this.awardStompCombo(e.x, e.y, 1);
        this.recordEnemyDefeat(e.type);
      } else if (e.type === 'paratroopa') {
        // Stomping a Paratroopa knocks off its wings and turns it into a fast Red Koopa
        const speedMult = this.level.enemySpeedMultiplier ?? 1;
        this.triggerLargeEnemyImpactShake(e);
        e.type = 'red_koopa';
        e.state = 'walk';
        e.vy = 0;
        e.vx = EnemySpawnManager.getInitialVelocity('red_koopa', speedMult, e.vx >= 0 ? 1 : -1);
        this.sound.playStomp();
        this.marioVy = -6.0;
        this.spawnEnemyDefeatParticles(e.x, e.y, 'paratroopa');
        this.awardStompCombo(e.x, e.y);
      } else if (e.type === 'hammer_bro') {
        // Stomping a Hammer Brother defeats it for high points (1000+ pts)
        e.alive = false;
        e.state = 'flipped';
        e.vy = -5.0;
        e.vx = 0;
        this.sound.playStomp();
        this.marioVy = -6.0;
        this.triggerLargeEnemyImpactShake(e);
        this.spawnEnemyDefeatParticles(e.x, e.y, 'hammer_bro');
        this.awardStompCombo(e.x, e.y, 5);
        this.recordEnemyDefeat(e.type);
      } else if (e.type === 'koopa' || e.type === 'red_koopa') {
        if (e.state === 'walk') {
          // Retreat into shell (large 24px enemy stomp impact)
          this.triggerLargeEnemyImpactShake(e);
          e.state = 'shell_idle';
          e.stateTimer = 330; // ~5.5s before Koopa wakes back up
          e.vx = 0;
          e.y += 8;
          e.height = 16;
          e.shellKillStreak = 0;
          this.sound.playStomp();
          this.marioY = Math.min(this.marioY, e.y - this.getMarioHeight());
          this.marioVy = -6.0;
          this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
          this.awardStompCombo(e.x, e.y);
        } else if (e.state === 'shell_moving') {
          // Stop moving shell & continue airborne bounce combo
          e.state = 'shell_idle';
          e.stateTimer = 330;
          e.vx = 0;
          e.shellKillStreak = 0;
          this.sound.playStomp();
          this.marioY = Math.min(this.marioY, e.y - this.getMarioHeight());
          this.marioVy = -5.5;
          this.triggerScreenShake(2.8, 7);
          this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
          this.awardStompCombo(e.x, e.y);
        } else if (e.state === 'shell_idle') {
          // Kick stationary shell from above & continue airborne bounce combo
          e.state = 'shell_moving';
          e.stateTimer = 8; // Post-kick self-hit grace window
          e.shellKillStreak = 0;
          e.vx = this.marioX + 7 < e.x + 8 ? 4.2 : -4.2;
          this.sound.playKick();
          this.marioY = Math.min(this.marioY, e.y - this.getMarioHeight());
          this.marioVy = -5.0;
          this.triggerScreenShake(3.0, 7);
          this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
          this.awardStompCombo(e.x, e.y);
        }
      } else if (e.type === 'dry_bones') {
        if (e.state === 'walk') {
          this.triggerLargeEnemyImpactShake(e);
          e.state = 'shell_idle';
          e.stateTimer = 210; // ~3.5s before bones reassemble
          e.vx = 0;
          e.y += 8;
          e.height = 16;
          this.sound.playStomp();
          this.marioY = Math.min(this.marioY, e.y - this.getMarioHeight());
          this.marioVy = -6.0;
          this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
          this.awardStompCombo(e.x, e.y);
        }
      } else {
        // Non-stompable enemies (e.g., Boo, Bowser) still damage Mario
        this.damageMario();
      }
    } else {
      // Hit from side
      if (e.type === 'dry_bones' && e.state === 'shell_idle') {
        return;
      }
      if ((e.type === 'koopa' || e.type === 'red_koopa') && e.state === 'shell_idle') {
        // R1.19.1GX.5: Hold Run to pick up and carry Koopa shell like in SMW!
        if (
          this.controls.run &&
          !this.isCarryingAnything() &&
          !this.marioOnYoshi &&
          !this.isStatue
        ) {
          this.heldShellEnemyId = e.id;
          e.vx = 0;
          e.vy = 0;
          e.stateTimer = Math.max(e.stateTimer, 240);
          return;
        }
        // Kick shell horizontally
        e.state = 'shell_moving';
        e.stateTimer = 8; // Post-kick self-hit grace window
        e.shellKillStreak = 0;
        e.vx = this.marioX < e.x ? 4.8 : -4.8;
        this.sound.playKick();
        this.triggerScreenShake(3.0, 7);
        this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
        this.addScore(400, e.x, e.y);
        return;
      }

      // Mario takes damage
      this.damageMario();
    }
  }

  private damageMario() {
    if (
      this.marioStarTimer > 0 ||
      this.marioInvulnerableTimer > 0 ||
      this.marioState === 'dead' ||
      this.marioState === 'pipe_entering' ||
      this.marioState === 'pipe_exiting' ||
      this.isStageClear ||
      this.marioState === 'pole_slide' ||
      this.marioState === 'castle_walk' ||
      this.marioState === 'castle_entered'
    ) {
      return;
    }

    // Tanooki statue is completely immune to normal enemy damage
    if (this.isStatue) return;

    // Editor immortality absorbs all enemy hits without shrinking or losing life
    if (this.isEditorImmortality) {
      this.marioInvulnerableTimer = 90;
      this.sound.playPipe();
      this.particleSystem.emitScoreText('IMORTAL', this.marioX, this.marioY - 12, {
        maxLife: 30,
        vy: -0.9,
      });
      return;
    }

    // R1.16.1RZ.4: Riding Yoshi absorbs the hit and Yoshi bolts away cleanly
    if (this.marioOnYoshi) {
      this.dismountYoshi(true);
      this.marioInvulnerableTimer = 100;
      this.sound.playPipe();
      this.triggerScreenShake(2.2, 6);
      this.particleSystem.emitScoreText('YOSHI!', this.marioX, Math.max(20, this.marioY - 12), {
        maxLife: 36,
        vy: -0.9,
        color: '#58f898',
      });
      this.onMultiplayerSyncNeeded?.();
      return;
    }

    this.releaseHeldObject(true);
    this.isSpinJumping = false;
    this.spinJumpTimer = 0;
    if (this.marioPower === 'tanooki' || this.marioPower === 'femboy' || this.marioPower === 'cape') {
      // Tanooki, Femboy, and Cape power-ups downgrade to Super Mario on damage
      this.marioTransitionFrom = this.marioPower;
      this.marioTransitionKind = 'shrink';
      this.marioPower = 'super';
      this.marioInvulnerableTimer = 120;
      this.marioShrinkTimer = 24;
      this.sound.playPipe();
      this.triggerScreenShake(2.0, 6);
      this.dropReservePowerUp(false);
      this.onMultiplayerSyncNeeded?.();
    } else if (this.marioPower === 'fire' || this.marioPower === 'super') {
      // Fire / Super Mario absorbs the hit, retains player life, and reverts to Small Mario with temporary invincibility
      this.marioTransitionFrom = this.marioPower;
      this.marioTransitionKind = 'shrink';
      this.marioPower = 'small';
      this.marioY += 16; // Anchors feet on ground so Mario does not hover
      this.marioInvulnerableTimer = 120; // 2 seconds flashing temporary invincibility after shrink
      this.marioShrinkTimer = 32; // Freeze frames for shrink animation
      this.sound.playPipe();
      this.triggerScreenShake(2.5, 7);
      this.dropReservePowerUp(false);
      this.onMultiplayerSyncNeeded?.();
    } else {
      // Small Mario dies (unless infinite lives is active)
      if (this.infiniteLives) {
        this.marioInvulnerableTimer = 180;
        this.sound.playPipe();
        return;
      }
      this.killMario();
    }
  }

  public killMario(isPitFall: boolean = false) {
    if (this.marioState === 'dead') return;
    this.releaseHeldObject(true);
    this.isSpinJumping = false;
    this.spinJumpTimer = 0;
    this.marioState = 'dead';
    this.marioPower = 'small'; // Abyss or damage always removes power-ups
    this.marioOnYoshi = false;
    this.yoshiTongueTimer = 0;
    this.stats.onYoshi = false;
    this.marioStarTimer = 0;
    this.marioVx = 0;
    this.sound.stopMusic();
    this.sound.playDeath();

    if (isPitFall) {
      this.marioVy = 0;
      this.marioDeathTimer = 50; // Pause below the screen while death tune plays
    } else {
      this.marioVy = 0; // Brief freeze before launching upward
      this.marioDeathTimer = 0;
    }
    this.onMultiplayerSyncNeeded?.();
  }

  private handleLifeLost() {
    if (this.isGameOver) return;
    this.marioPower = 'small';
    this.marioStarTimer = 0;

    if (this.infiniteLives) {
      this.stats.lives = 99;
      // Respawn at checkpoint with classic NES intermission
      this.loadLevel(this.level, true, true);
      return;
    }

    this.stats.lives = Math.max(0, this.stats.lives - 1);
    if (this.stats.lives <= 0) {
      this.syncHighScore(true);
      this.onMultiplayerSyncNeeded?.();
      this.evaluateMultiplayerMatchEnd();
      if (!this.isMultiplayerMatchOver) {
        this.persistRunScoreToRanking();
        this.isGameOver = true;
        this.sound.playGameOver();
      }
    } else {
      // Respawn at checkpoint or stage start with classic NES lives screen
      this.loadLevel(this.level, true, true);
    }
  }

  // --- ITEMS UPDATE ---
  private updateItems() {
    const marioBox = this.getMarioHitbox();
    const canCollectItems =
      this.marioState !== 'dead' &&
      this.marioState !== 'pipe_entering' &&
      this.marioState !== 'pipe_exiting';

    this.items.forEach(item => {
      if (item.collected) return;

      // Emerging from block animation
      if (item.emerging) {
        item.y -= 0.6;
        if (item.y <= item.emergeY) {
          item.emerging = false;
        }
        return;
      }

      if (item.reserveDropGrace && item.reserveDropGrace > 0) {
        item.reserveDropGrace--;
      }

      // Coin collected in air
      if (item.type === 'coin') {
        if (canCollectItems && this.rectsIntersect(marioBox, { x: item.x, y: item.y, width: 16, height: 16 })) {
          this.collectFloatingCoinItem(item);
        }
        return;
      }

      // R1.16.OV.4: Giant Floating "W" Coin (collect 4 in a stage -> +1 Extra Life)
      if (item.type === 'w_coin') {
        const floatOffsetY = Math.sin(Date.now() / 220 + (item.wCoinIndex ?? 0) * 1.4) * 3;
        if (
          canCollectItems &&
          this.rectsIntersect(marioBox, {
            x: item.x - 1,
            y: item.y + floatOffsetY - 1,
            width: item.width + 2,
            height: item.height + 2,
          })
        ) {
          this.collectWCoinItem(item);
        }
        return;
      }

      // R1.16.13U.4: Items released from the Power-Up Reserve Box fall smoothly straight down for Mario to catch
      if (item.fromReserveBox) {
        item.y += 1.45;
        if (item.y > GameEngine.NES_HEIGHT + 24) {
          item.collected = true;
          return;
        }
      } else if (item.type === 'leaf' || item.type === 'feather') {
        // Super Leaf & Cape Feather floating physics: gentle side-to-side oscillation and slow fall
        const swayFreq = item.type === 'feather' ? 175 : 200;
        const swayAmp = item.type === 'feather' ? 1.35 : 1.2;
        const fallSpeed = item.type === 'feather' ? 0.65 : 0.75;
        item.x += Math.sin(Date.now() / swayFreq) * swayAmp;
        item.y += fallSpeed;
      } else {
        // Grounded / Moving items (Super Mushroom, Fire Flower, Starman, 1-UP)
        if (item.type === 'fireflower') {
          item.vx = 0; // Fire Flower remains stationary atop its block
        } else {
          item.x += item.vx;

          // Horizontal collision
          const itemBoxH: Rect = { x: item.x, y: item.y, width: item.width, height: item.height - 2 };
          const tilesH = this.getTilesIntersecting(itemBoxH);
          for (const t of tilesH) {
            if (this.isSolidTile(t.tile.type)) {
              item.vx = -item.vx;
              item.x += item.vx;
              break;
            }
          }
        }

        // Gravity
        item.vy += 0.35;
        if (item.vy > 5.0) item.vy = 5.0;
        item.y += item.vy;

        // Floor collision
        const itemBoxV: Rect = { x: item.x, y: item.y, width: item.width, height: item.height };
        const tilesV = this.getTilesIntersecting(itemBoxV);
        for (const t of tilesV) {
          if (this.isSolidTile(t.tile.type)) {
            if (item.vy > 0) {
              item.y = t.tileY * GameEngine.TILE_SIZE - item.height;
              if (item.type === 'star') {
                item.vy = -5.2; // Starman bounces energetically
              } else {
                item.vy = 0;
              }
              break;
            }
          }
        }
      }

      // Mario touches item (respect brief drop grace for Reserve Box items so they descend visibly first)
      if (
        canCollectItems &&
        !(item.reserveDropGrace && item.reserveDropGrace > 0) &&
        this.rectsIntersect(marioBox, { x: item.x, y: item.y, width: 16, height: 16 })
      ) {
        item.collected = true;
        this.collectItem(item);
      }
    });

    this.items = this.items.filter(i => !i.collected);
  }

  private powerToReserveItem(power: MarioPower): ReservePowerItem | null {
    switch (power) {
      case 'super':
        return 'mushroom';
      case 'fire':
        return 'fireflower';
      case 'tanooki':
        return 'leaf';
      case 'cape':
        return 'feather';
      case 'femboy':
        return 'femboy';
      default:
        return null;
    }
  }

  public dropReservePowerUp(manual: boolean = false): boolean {
    if (!this.reservePowerUp) return false;
    if (
      this.marioState === 'dead' ||
      this.marioState === 'pole_slide' ||
      this.marioState === 'castle_walk' ||
      this.marioState === 'castle_entered' ||
      this.isStageClear ||
      this.isBonusStageActive
    ) {
      return false;
    }

    const itemType = this.reservePowerUp;
    this.reservePowerUp = null;
    this.stats.reservePowerUp = null;

    const spawnX = Math.max(
      this.cameraX + 12,
      Math.min(this.cameraX + GameEngine.NES_WIDTH - 28, Math.round(this.marioX))
    );
    const spawnY = 26;

    this.items.push({
      id: this.nextEntityId++,
      type: itemType,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      width: 16,
      height: 16,
      grounded: false,
      collected: false,
      emerging: false,
      emergeY: spawnY,
      fromReserveBox: true,
      reserveDropGrace: manual ? 8 : 20,
    });

    this.sound.playPowerUpAppear();
    this.spawnPowerUpSparkles(spawnX, spawnY);
    this.onMultiplayerSyncNeeded?.();
    return true;
  }

  private transitionMarioPower(targetPower: MarioPower, itemX: number, itemY: number, label: string) {
    this.sound.playPowerUpEat();
    const prevPower = this.marioPower;

    // Super Mushroom never downgrades an already powered-up Big/Fire/Suit Mario (R0.15.6J.3 + R1.16.13U.4)
    if (targetPower === 'super' && prevPower !== 'small') {
      if (!this.reservePowerUp) {
        this.reservePowerUp = 'mushroom';
        this.stats.reservePowerUp = 'mushroom';
      }
      this.addScore(1000, itemX, itemY);
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
      return;
    }

    // R1.16.13U.4: Store displaced or duplicate power-up in the SMW Reserve Box
    if (prevPower !== 'small') {
      if (prevPower === targetPower) {
        const dupReserve = this.powerToReserveItem(targetPower);
        if (dupReserve) {
          this.reservePowerUp = dupReserve;
          this.stats.reservePowerUp = dupReserve;
        }
      } else {
        const prevReserve = this.powerToReserveItem(prevPower);
        if (prevReserve && !(prevPower === 'super' && this.reservePowerUp && this.reservePowerUp !== 'mushroom')) {
          this.reservePowerUp = prevReserve;
          this.stats.reservePowerUp = prevReserve;
        }
      }
    }

    this.marioTransitionFrom = prevPower;
    this.marioPower = targetPower;

    if (prevPower === 'small' && targetPower !== 'small') {
      // Shift up 16px so feet remain anchored on ground, while protecting against tight ceiling clipping
      const targetY = this.marioY - 16;
      const headTiles = this.getTilesIntersecting({ x: this.marioX + 1, y: targetY, width: 14, height: 14 }).filter(t =>
        this.isSolidTile(t.tile.type)
      );
      if (headTiles.length === 0) {
        this.marioY = targetY;
      } else {
        const ceilingBottom = Math.max(...headTiles.map(t => (t.tileY + 1) * GameEngine.TILE_SIZE));
        const spaceBelowClear = !this.getTilesIntersecting({
          x: this.marioX + 1,
          y: ceilingBottom,
          width: 14,
          height: 30,
        }).some(t => this.isSolidTile(t.tile.type));
        if (spaceBelowClear) {
          this.marioY = ceilingBottom;
        } else {
          this.marioY = targetY;
          this.marioState = 'crouching';
        }
      }
      this.marioTransitionKind = 'grow';
      this.marioGrowthTimer = 36;
    } else if (prevPower !== targetPower) {
      // Already Big -> switching/upgrading suit (e.g. Super -> Fire Flower) flashes palette without shrinking
      this.marioTransitionKind = 'power_flash';
      this.marioGrowthTimer = 28;
    }

    this.addScore(1000, itemX, itemY, label);
    this.spawnPowerUpSparkles(this.marioX, this.marioY);
    this.onMultiplayerSyncNeeded?.();
  }

  private collectFloatingCoinItem(item: Item) {
    item.collected = true;
    this.sound.playCoin();
    this.stats.coins++;
    if (this.stats.coins >= 100) {
      this.stats.coins = 0;
      this.stats.lives++;
      this.sound.playPowerUpEat();
    }
    this.spawnCoinParticles(item.x, item.y);
    this.addScore(200, item.x, item.y);
    this.recordAchievementProgress('coins_collected', 1);
  }

  private collectWCoinItem(item: Item) {
    item.collected = true;
    const wIdx = item.wCoinIndex ?? this.collectedWCoinIndices.size;
    if (!this.collectedWCoinIndices.has(wIdx)) {
      this.collectedWCoinIndices.add(wIdx);
    }
    this.wCoinsCollected = this.collectedWCoinIndices.size;
    this.stats.wCoinsCollected = this.wCoinsCollected;
    this.stats.wCoinsTotal = this.wCoinsTotal;
    this.sound.playPowerUpEat();
    this.spawnCoinParticles(item.x + 2, item.y + 4);
    this.spawnPowerUpSparkles(item.x + 2, item.y + 4);
    this.addScore(500, item.x, item.y - 4, `W ${this.wCoinsCollected}/${this.wCoinsTotal}`);
    if (this.wCoinsTotal >= 4 && this.wCoinsCollected >= 4 && !this.wCoinLifeAwardedThisStage) {
      this.wCoinLifeAwardedThisStage = true;
      this.awardExtraLife(this.marioX, Math.max(24, this.marioY - 12));
      this.particleSystem.emitScoreText('4x W! +1 VIDA!', this.marioX, Math.max(20, this.marioY - 22), {
        maxLife: 48,
        vy: -0.9,
      });
      this.recordAchievementProgress('w_coin_sets', 1);
    }
    this.onMultiplayerSyncNeeded?.();
  }

  private collectItem(item: Item) {
    if (item.type === 'leaf') {
      this.transitionMarioPower('tanooki', item.x, item.y, 'TANOOKI!');
    } else if (item.type === 'feather') {
      this.transitionMarioPower('cape', item.x, item.y, 'PENA!');
    } else if (item.type === 'femboy') {
      this.transitionMarioPower('femboy', item.x, item.y, 'FEMBOY!');
    } else if (item.type === 'mushroom') {
      this.transitionMarioPower('super', item.x, item.y, 'SUPER!');
    } else if (item.type === 'fireflower') {
      this.transitionMarioPower('fire', item.x, item.y, 'FIRE!');
    } else if (item.type === 'star') {
      this.sound.playPowerUpEat();
      this.marioStarTimer = 600; // 10 seconds of temporary Starman invincibility
      this.starComboCount = 0;
      this.sound.playMusic('starman');
      this.addScore(1000, item.x, item.y, 'STAR!');
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
      this.onMultiplayerSyncNeeded?.();
    } else if (item.type === '1up') {
      this.awardExtraLife(item.x, item.y);
      this.onMultiplayerSyncNeeded?.();
    }
  }

  public spawnPowerUpSparkles(x: number, y: number) {
    this.particleSystem.emitPowerUpSparkles(x, y);
  }

  // --- FIREBALLS UPDATE ---
  private shootFireball() {
    this.sound.playFireball();
    this.marioFireThrowTimer = 8;
    const isCrouching = this.marioPower !== 'small' && this.marioState === 'crouching';
    const dir = this.marioFacing === 'right' ? 1 : -1;
    this.fireballs.push({
      id: this.nextEntityId++,
      x: this.marioFacing === 'right' ? this.marioX + 14 : this.marioX - 4,
      y: isCrouching ? this.marioY + 14 : this.marioY + 8,
      vx: dir * 5.0,
      vy: 1.5,
      alive: true,
      exploding: false,
      explodeTimer: 0,
    });
  }

  private spawnFemboyGroundFireballs() {
    // Allow up to 6 active white fireballs on screen so repeated landings always fire cleanly
    const activeWhite = this.fireballs.filter(fb => fb.color === 'white' && fb.alive && !fb.exploding);
    if (activeWhite.length >= 6) return;

    const height = this.getMarioHeight();
    const spawnY = this.marioY + height - 10;
    this.sound.playFireball();

    this.fireballs.push(
      {
        id: this.nextEntityId++,
        x: this.marioX - 6,
        y: spawnY,
        vx: -4.4,
        vy: -2.0,
        alive: true,
        exploding: false,
        explodeTimer: 0,
        color: 'white',
      },
      {
        id: this.nextEntityId++,
        x: this.marioX + 14,
        y: spawnY,
        vx: 4.4,
        vy: -2.0,
        alive: true,
        exploding: false,
        explodeTimer: 0,
        color: 'white',
      }
    );
  }

  private updateFireballs() {
    this.fireballs.forEach(fb => {
      if (fb.exploding) {
        fb.explodeTimer++;
        return;
      }

      // Horizontal movement & wall collision
      fb.x += fb.vx;
      const fbBoxH: Rect = { x: fb.x, y: fb.y, width: 8, height: 8 };
      const tilesH = this.getTilesIntersecting(fbBoxH);
      for (const t of tilesH) {
        if (this.isSolidTile(t.tile.type)) {
          fb.exploding = true;
          break;
        }
      }
      if (fb.exploding) return;

      // Vertical movement & ground bounce
      fb.y += fb.vy;
      fb.vy += 0.4;
      const fbBox: Rect = { x: fb.x, y: fb.y, width: 8, height: 8 };
      const tilesV = this.getTilesIntersecting(fbBox);
      for (const t of tilesV) {
        if (this.isSolidTile(t.tile.type)) {
          if (fb.vy > 0) {
            fb.y = t.tileY * GameEngine.TILE_SIZE - 8;
            fb.vy = -3.8; // Bounce up
          } else {
            fb.exploding = true;
          }
          break;
        }
      }
      if (fb.exploding) return;
      fbBox.y = fb.y;

      // Check enemy hit
      this.enemies.forEach(e => {
        if (e.alive && !fb.exploding && this.rectsIntersect(fbBox, { x: e.x, y: e.y, width: e.width, height: e.height })) {
          fb.exploding = true;
          if (e.type === 'boo' || e.type === 'lava_bubble') {
            this.sound.playBump();
            return;
          }
          if (e.type === 'dry_bones') {
            if (e.state === 'walk') {
              e.state = 'shell_idle';
              e.stateTimer = 210;
              e.vx = 0;
              e.y += 8;
              e.height = 16;
              this.sound.playKick();
              this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
              this.addScore(200, e.x, e.y);
            } else {
              e.stateTimer = 210;
            }
            return;
          }
          if (e.type === 'bowser') {
            e.hp = (e.hp ?? 5) - 1;
            e.hitFlashTimer = 10;
            this.sound.playKick();
            this.spawnEnemyDefeatParticles(fb.x, fb.y, 'bowser');
            if (e.hp <= 0) {
              e.alive = false;
              e.state = 'flipped';
              e.vy = -5.5;
              this.triggerScreenShake(4.0, 12);
              this.addScore(5000, e.x, e.y, `${this.getBossDisplayName(e).toUpperCase()}!`);
              this.recordEnemyDefeat('bowser');
              if (fb.color === 'white') {
                this.spawnFemboyHeartParticle(e.x + e.width / 2, e.y + 4);
              }
            } else {
              this.addScore(100, e.x, e.y);
            }
            return;
          }
          // R1.16.SW.4: Fireball-defeatable enemies (except ghosts 'boo' & skeletons 'dry_bones') turn into coins!
          e.alive = false;
          e.state = 'flipped';
          e.vy = 0;
          const coinX = Math.round(e.x);
          const coinY = Math.max(
            24,
            Math.min(12 * GameEngine.TILE_SIZE, Math.round(e.y + Math.max(0, e.height - 16)))
          );
          e.y = GameEngine.NES_HEIGHT + 96;
          this.items.push({
            id: this.nextEntityId++,
            type: 'coin',
            x: coinX,
            y: coinY,
            vx: 0,
            vy: 0,
            width: 16,
            height: 16,
            grounded: true,
            collected: false,
            emerging: false,
            emergeY: coinY,
          });
          this.sound.playCoin();
          this.spawnCoinParticles(coinX, coinY);
          if (fb.color === 'white') {
            this.spawnFemboyHeartParticle(e.x + e.width / 2, coinY);
          }
          this.addScore(200, coinX, coinY, 'MOEDA!');
          this.recordEnemyDefeat(e.type);
        }
      });

      // Offscreen
      if (fb.x > this.cameraX + GameEngine.NES_WIDTH || fb.x < this.cameraX - 20 || fb.y > GameEngine.NES_HEIGHT) {
        fb.alive = false;
      }
    });

    this.fireballs = this.fireballs.filter(fb => fb.alive && fb.explodeTimer < 10);
  }

  private updateBossFireballs() {
    if (this.bossFireballs.length === 0) return;
    const canHitMario =
      this.marioState !== 'dead' &&
      this.marioState !== 'pipe_entering' &&
      this.marioState !== 'pipe_exiting' &&
      this.marioState !== 'pole_slide' &&
      this.marioState !== 'castle_walk' &&
      this.marioState !== 'castle_entered';
    const marioBox = this.getMarioHitbox();

    this.bossFireballs.forEach(bf => {
      bf.x += bf.vx;
      bf.animTimer++;
      if (canHitMario) {
        const bfBox: Rect = { x: bf.x + 1, y: bf.y + 1, width: 14, height: 6 };
        if (this.rectsIntersect(marioBox, bfBox)) {
          if (this.marioStarTimer <= 0) {
            this.damageMario();
          }
        }
      }
    });

    this.bossFireballs = this.bossFireballs.filter(
      bf => bf.x > this.cameraX - 64 && bf.x < this.cameraX + GameEngine.NES_WIDTH + 64
    );
  }

  private updateHammerProjectiles() {
    if (this.hammerProjectiles.length === 0) return;
    const canHitMario =
      this.marioState !== 'dead' &&
      this.marioState !== 'pipe_entering' &&
      this.marioState !== 'pipe_exiting' &&
      this.marioState !== 'pole_slide' &&
      this.marioState !== 'castle_walk' &&
      this.marioState !== 'castle_entered';
    const marioBox = this.getMarioHitbox();

    this.hammerProjectiles.forEach(h => {
      h.x += h.vx;
      h.vy += 0.21;
      if (h.vy > 5.8) h.vy = 5.8;
      h.y += h.vy;
      h.animTimer++;

      if (canHitMario) {
        const hammerBox: Rect = { x: h.x + 2, y: h.y + 2, width: 8, height: 8 };
        if (this.rectsIntersect(marioBox, hammerBox)) {
          if (this.marioStarTimer <= 0) {
            this.damageMario();
          } else {
            this.spawnEnemyDefeatParticles(h.x, h.y);
            h.y = GameEngine.NES_HEIGHT + 64;
          }
        }
      }
    });

    this.hammerProjectiles = this.hammerProjectiles.filter(
      h =>
        h.y <= GameEngine.NES_HEIGHT + 24 &&
        h.x > this.cameraX - 64 &&
        h.x < this.cameraX + GameEngine.NES_WIDTH + 64
    );
  }

  private triggerCastleAxeClear(axeTX: number, axeTY: number) {
    this.level.tiles[axeTY][axeTX] = null;
    this.bossFireballs = [];
    this.marioStarTimer = 0;
    this.starComboCount = 0;
    this.marioVx = 0;
    this.marioVy = 0;
    this.sound.stopMusic();
    this.sound.playBridgeCollapse();
    this.triggerScreenShake(3.5, 14);

    // Collect bridge tiles left-to-right to collapse sequentially
    const bridgeTiles: { tx: number; ty: number }[] = [];
    for (let tx = 0; tx < this.level.width; tx++) {
      for (let ty = 0; ty < this.level.height; ty++) {
        if (this.level.tiles[ty][tx]?.type === 'bridge') {
          bridgeTiles.push({ tx, ty });
        }
      }
    }
    this.bridgeCollapseQueue = bridgeTiles;
    this.bridgeCollapseTimer = 0;

    // Reveal Princesa Femboy on Final Castle (7-5) or Toodle on Worlds 1-6 castles
    const greeterX = Math.max(axeTX * GameEngine.TILE_SIZE + 44, this.level.castleX - 20);
    if (this.level.isFinalCastle) {
      this.castlePrincessActive = true;
      this.castlePrincessX = greeterX;
      this.castlePrincessY = 13 * GameEngine.TILE_SIZE - 28;
      this.castlePrincessDialogueTimer = 0;
      this.particleSystem.emitPowerUpSparkles(this.castlePrincessX, this.castlePrincessY - 8);
      this.spawnFemboyHeartParticle(this.castlePrincessX + 8, this.castlePrincessY - 10);
    } else {
      this.castleToodleActive = true;
      this.castleToodleX = greeterX;
      this.castleToodleY = 13 * GameEngine.TILE_SIZE - 24;
      this.castleToodleDialogueTimer = 0;
      this.particleSystem.emitPowerUpSparkles(this.castleToodleX, this.castleToodleY - 8);
    }

    // Drop Bowser into the lava
    this.enemies.forEach(e => {
      if (e.type === 'bowser' && e.alive) {
        e.alive = false;
        e.state = 'flipped';
        e.vy = -1.5;
        e.vx = 0;
        this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
        this.addScore(5000, e.x, e.y, `${this.getBossDisplayName(e).toUpperCase()}!`);
        this.recordEnemyDefeat('bowser');
      }
    });

    // R1.16.P4.4: Transforma outros inimigos próximos ao final do castelo em pontos multiplicados
    this.transformStageEndEnemiesToPoints();
    this.enforceStageEndDebugLock(false);

    if (bridgeTiles.length === 0) {
      this.marioState = 'castle_walk';
      this.marioFacing = 'right';
      this.sound.playStageClear();
    }
  }

  // --- PARTICLES & SCORE POPUPS ---
  private spawnFemboyHeartParticle(x: number, y: number) {
    this.particleSystem.emitHeart(x, y);
  }

  // Helper to spawn glittering sparkles on coin collection
  public spawnCoinParticles(x: number, y: number, fromRemote: boolean = false) {
    if (!fromRemote || this.isNearCamera(x)) {
      this.particleSystem.emitCoinSparkles(x, y);
    }
    if (!fromRemote && this.isMultiplayerConnected) {
      this.onMultiplayerWorldEvent?.('coin_collect', x, y);
    }
  }

  // Helper to spawn impact stars, debris fragments, and poof clouds when defeating an enemy
  public spawnEnemyDefeatParticles(x: number, y: number, enemyType?: EnemyType, fromRemote: boolean = false) {
    if (!fromRemote || this.isNearCamera(x)) {
      this.particleSystem.emitEnemyDefeat(x, y, enemyType);
    }
    if (!fromRemote && this.isMultiplayerConnected) {
      this.onMultiplayerWorldEvent?.('enemy_defeat', x, y);
    }
  }

  private syncHighScore(persist: boolean = true) {
    if (this.isCheatActive || this.level?.isCustom || this.customLevelTemplate) return;
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
    }
    if (this.stats.score > 0 && this.stats.score > this.runInitialHighScore) {
      this.isNewHighScore = true;
      this.stats.isNewHighScore = true;
      if (!this.hasTriggeredNewRecordBanner && this.runInitialHighScore > 0) {
        this.hasTriggeredNewRecordBanner = true;
        this.particleSystem.emitScoreText('NOVO RECORDE!', this.marioX, this.marioY - 22, {
          maxLife: 55,
          vy: -0.9,
        });
        this.particleSystem.emitCoinSparkles(this.marioX + 8, this.marioY);
      }
    }
    if (persist && this.stats.score > 0) {
      updateTopScore(this.stats.score);
    }
  }

  public persistRunScoreToRanking(customName?: string): number | null {
    if (this.isCheatActive || this.level?.isCustom || this.customLevelTemplate || this.stats.score <= 0) return null;
    this.syncHighScore(true);
    const defaultName =
      customName?.trim() ||
      getLastPlayerName() ||
      (this.localPlayerName && this.localPlayerName !== 'Jogador' ? this.localPlayerName : '') ||
      (this.playerCharacter === 'wazzima' ? 'WAZZIMA' : 'MARIO');
    const result = saveNewScore(this.stats.score, this.stats.coins, this.stats.world, defaultName, {
      id: this.currentRunId,
      character: this.playerCharacter,
      difficulty: this.difficulty,
    });
    this.lastSavedRank = result.rank;
    return result.rank;
  }

  public resetLocalHighScore() {
    this.stats.highScore = 0;
    this.runInitialHighScore = 0;
    this.isNewHighScore = false;
    this.hasTriggeredNewRecordBanner = false;
    this.stats.isNewHighScore = false;
    this.lastSavedRank = null;
  }

  private addScore(points: number, x: number, y: number, customText?: string) {
    this.stats.score += points;
    // Cheaters cannot update high score!
    this.syncHighScore(true);

    this.particleSystem.emitScoreText(customText || `${points}`, x, y - 8);
  }

  // --- ACHIEVEMENT TRACKING & REWARDS ---
  public getStageElapsedSeconds(): number {
    return this.stageElapsedMs / 1000;
  }

  public getAchievements(): AchievementProgressView[] {
    return this.achievementManager.getViews();
  }

  public getAchievementSummary() {
    return this.achievementManager.getSummary();
  }

  public resetAchievements(): AchievementProgressView[] {
    this.achievementManager.reset();
    this.recentAchievementUnlock = null;
    const views = this.achievementManager.getViews();
    this.onAchievementsChanged?.(views);
    return views;
  }

  public recordAchievementProgress(
    metric: AchievementMetric,
    amount: number = 1
  ): AchievementUnlockEvent[] {
    const unlocked = this.achievementManager.recordMetric(metric, amount);
    if (unlocked.length === 0) return unlocked;

    for (const evt of unlocked) {
      if (evt.rewardPoints > 0) {
        this.stats.score += evt.rewardPoints;
        this.syncHighScore(true);
      }
      if (evt.rewardLives > 0) {
        this.stats.lives = Math.min(99, this.stats.lives + evt.rewardLives);
      }
      if (evt.rewardLives > 0) {
        this.sound.play1Up();
      } else {
        this.sound.playPowerUpEat();
      }
      this.particleSystem.emitPowerUpSparkles(this.marioX, Math.max(24, this.marioY - 8));
      this.particleSystem.emitScoreText(
        `CONQUISTA: ${evt.achievement.title.toUpperCase()}!`,
        Math.max(8, this.marioX - 36),
        Math.max(20, this.marioY - 22),
        {
          maxLife: 65,
          vy: -0.75,
          color: '#fce078',
        }
      );
      this.recentAchievementUnlock = evt;
      this.onAchievementUnlocked?.(evt);
    }

    this.onAchievementsChanged?.(this.achievementManager.getViews());
    return unlocked;
  }

  private recordEnemyDefeat(enemyType: EnemyType) {
    this.recordAchievementProgress('enemies_defeated', 1);
    if (enemyType === 'goomba') {
      this.recordAchievementProgress('goombas_defeated', 1);
    } else if (enemyType === 'bowser') {
      this.recordAchievementProgress('bowsers_defeated', 1);
    }
  }

  // --- CHEAT ENGINE METHODS ("lula132026") ---
  public activateCheatMode() {
    this.isCheatActive = true;
    this.infiniteLives = true;
    this.stats.lives = 99;
    this.sound.playPowerUpEat();
    this.particleSystem.emitScoreText('CHEAT ON!', this.marioX, this.marioY - 16, {
      maxLife: 45,
      vy: -1.2,
    });
  }

  public setPowerUp(power: MarioPower | 'star') {
    if (power === 'star') {
      this.marioStarTimer = 999999;
      this.starComboCount = 0;
      this.sound.playPowerUpEat();
      this.sound.playMusic('starman');
    } else {
      const prevPower = this.marioPower;
      this.marioTransitionFrom = prevPower;
      this.marioPower = power;
      if (prevPower === 'small' && power !== 'small') {
        this.marioY -= 16;
        this.marioTransitionKind = 'grow';
      } else if (prevPower !== 'small' && power === 'small') {
        this.marioY += 16;
        this.marioTransitionKind = 'shrink';
      } else {
        this.marioTransitionKind = 'power_flash';
      }
      this.marioGrowthTimer = 25;
      this.sound.playPowerUpEat();
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
    }
  }

  public toggleInfiniteLives(): boolean {
    this.infiniteLives = !this.infiniteLives;
    if (this.infiniteLives) {
      this.stats.lives = 99;
      this.sound.playPowerUpEat();
    } else {
      this.stats.lives = 3;
    }
    return this.infiniteLives;
  }

  public addCheatScore(points: number) {
    this.stats.score += points;
    this.sound.playCoin();
    this.particleSystem.emitScoreText(`+${points}`, this.marioX, this.marioY - 14, {
      maxLife: 35,
      vy: -1.2,
    });
  }

  public teleportToStageEnd(): boolean {
    if (
      this.isStageClear ||
      this.marioState === 'dead' ||
      this.marioState === 'pole_slide' ||
      this.marioState === 'castle_walk' ||
      this.marioState === 'castle_entered'
    ) {
      return false;
    }

    const marioHeight = this.getMarioHeight();
    const findSafeFloorY = (tx: number): number | null => {
      if (tx < 0 || tx >= this.level.width) return null;
      for (let ty = 2; ty < this.level.height; ty++) {
        const tile = this.level.tiles[ty]?.[tx];
        if (!tile || tile.type === 'lava' || tile.type === 'axe' || !this.isSolidTile(tile.type)) {
          continue;
        }
        const above1 = this.level.tiles[ty - 1]?.[tx];
        const above2 = this.level.tiles[ty - 2]?.[tx];
        const clearAbove =
          (!above1 || !this.isSolidTile(above1.type)) &&
          (!above2 || !this.isSolidTile(above2.type));
        if (clearAbove) {
          return ty * GameEngine.TILE_SIZE - marioHeight;
        }
      }
      return null;
    };

    let targetTX = Math.max(2, this.level.width - 20);
    if (this.level.id === 'secret-vault') {
      targetTX = 17;
    } else if (this.level.theme === 'castle') {
      let axeTX = this.level.width - 12;
      for (let tx = 0; tx < this.level.width; tx++) {
        for (let ty = 0; ty < this.level.height; ty++) {
          if (this.level.tiles[ty]?.[tx]?.type === 'axe') {
            axeTX = tx;
            break;
          }
        }
      }
      targetTX = Math.max(2, axeTX - 2);
    } else if (this.level.flagX > 0 && this.level.flagX < 99000) {
      const flagTX = Math.floor(this.level.flagX / GameEngine.TILE_SIZE);
      targetTX = Math.max(2, flagTX - 3);
    } else if (this.level.pipeWarps && this.level.pipeWarps.length > 0) {
      targetTX = Math.max(2, Math.floor(this.level.pipeWarps[0].from.x / GameEngine.TILE_SIZE) - 2);
    }

    let safeY = findSafeFloorY(targetTX);
    if (safeY === null) {
      for (let delta = 1; delta <= 8; delta++) {
        const leftTry = findSafeFloorY(targetTX - delta);
        if (leftTry !== null) {
          targetTX -= delta;
          safeY = leftTry;
          break;
        }
        const rightTry = findSafeFloorY(targetTX + delta);
        if (rightTry !== null) {
          targetTX += delta;
          safeY = rightTry;
          break;
        }
      }
    }

    this.warpTimer = 0;
    this.warpTarget = null;
    this.pipeClipLipY = null;
    this.pipeClipLipX = null;
    this.isStatue = false;
    this.tailWhipTimer = 0;
    this.bossFireballs = [];
    this.hammerProjectiles = [];
    this.marioVx = 0;
    this.marioVy = 0;
    this.marioGrounded = true;
    this.marioState = 'idle';
    this.marioFacing = 'right';
    this.marioInvulnerableTimer = Math.max(this.marioInvulnerableTimer, 60);
    this.marioX = targetTX * GameEngine.TILE_SIZE;
    this.marioY = safeY ?? (13 * GameEngine.TILE_SIZE - marioHeight);

    const levelWidthPx = this.level.width * GameEngine.TILE_SIZE;
    this.camera.centerOn(this.marioX, levelWidthPx);
    this.cameraX = this.camera.x;

    this.sound.playPowerUpEat();
    this.spawnPowerUpSparkles(this.marioX, this.marioY);
    this.particleSystem.emitScoreText('FINAL DA FASE!', this.marioX - 24, this.marioY - 18, {
      maxLife: 50,
      vy: -1.0,
      color: '#fce078',
    });
    return true;
  }

  // --- SONIC-STYLE DEBUG MODE & ITEM PLACEMENT ---
  public getCurrentDebugPlaceable(): DebugPlaceableSpec {
    const idx =
      ((this.debugPlaceIndex % GameEngine.DEBUG_PLACEABLES.length) + GameEngine.DEBUG_PLACEABLES.length) %
      GameEngine.DEBUG_PLACEABLES.length;
    return GameEngine.DEBUG_PLACEABLES[idx];
  }

  public isDebugLockedAtStageEnd(): boolean {
    if (!this.level) return false;
    return (
      this.isStageClear ||
      this.isBonusStageActive ||
      this.bridgeCollapseQueue.length > 0 ||
      this.marioState === 'pole_slide' ||
      this.marioState === 'castle_walk' ||
      this.marioState === 'castle_entered' ||
      this.isDebugPlacementBlockedAt(this.marioX)
    );
  }

  private enforceStageEndDebugLock(notify: boolean = true): boolean {
    if (!this.isDebugLockedAtStageEnd()) return false;
    if (this.isDebugMode || this.isDebugPlacementActive) {
      this.isDebugPlacementActive = false;
      this.isDebugMode = false;
      this.stats.isDebugMode = false;
      this.stats.isDebugPlacementActive = false;
      this.marioVx = 0;
      this.marioVy = 0;
      if (notify) {
        this.sound.playBump();
        this.particleSystem.emitScoreText(
          'DEBUG BLOQUEADO!',
          Math.max(8, this.marioX - 28),
          Math.max(24, this.marioY - 18),
          {
            maxLife: 45,
            vy: -0.9,
            color: '#ff6868',
          }
        );
      }
    }
    return true;
  }

  public toggleDebugMode(force?: boolean): boolean {
    const next = force !== undefined ? force : !this.isDebugMode;
    if (next && this.isDebugLockedAtStageEnd()) {
      this.isDebugMode = false;
      this.isDebugPlacementActive = false;
      this.sound.playBump();
      this.particleSystem.emitScoreText(
        'DEBUG BLOQUEADO!',
        Math.max(8, this.marioX - 28),
        Math.max(24, this.marioY - 18),
        {
          maxLife: 45,
          vy: -0.9,
          color: '#ff6868',
        }
      );
      return false;
    }
    this.isDebugMode = next;
    if (next) {
      this.isCheatActive = true;
      this.sound.playPowerUpEat();
      this.particleSystem.emitScoreText('DEBUG ON!', this.marioX, Math.max(24, this.marioY - 16), {
        maxLife: 45,
        vy: -1.0,
        color: '#58f8f8',
      });
    } else {
      this.isDebugPlacementActive = false;
      this.marioVx = 0;
      this.marioVy = 0;
      this.marioGrounded = false;
    }
    return this.isDebugMode;
  }

  public toggleDebugPlacementCursor(force?: boolean): boolean {
    if (
      this.marioState === 'dead' ||
      this.isStageClear ||
      this.isGameOver ||
      this.isIllegalInstructionBug ||
      this.isDebugLockedAtStageEnd()
    ) {
      this.isDebugPlacementActive = false;
      if (this.isDebugLockedAtStageEnd()) {
        this.isDebugMode = false;
      }
      return false;
    }
    if (!this.isDebugMode) {
      this.toggleDebugMode(true);
    }
    const next = force !== undefined ? force : !this.isDebugPlacementActive;
    this.isDebugPlacementActive = next;
    this.marioVx = 0;
    this.marioVy = 0;
    if (!next) {
      this.marioGrounded = false;
      this.marioInvulnerableTimer = Math.max(this.marioInvulnerableTimer, 30);
    }
    this.sound.playDebugCycle();
    return this.isDebugPlacementActive;
  }

  public cycleDebugPlaceable(delta: 1 | -1 = 1): DebugPlaceableSpec {
    if (!this.isDebugMode || this.isDebugLockedAtStageEnd()) {
      return this.getCurrentDebugPlaceable();
    }
    const total = GameEngine.DEBUG_PLACEABLES.length;
    this.debugPlaceIndex = (this.debugPlaceIndex + delta + total) % total;
    this.sound.playDebugCycle();
    return this.getCurrentDebugPlaceable();
  }

  public isDebugPlacementBlockedAt(worldX: number): boolean {
    const T = GameEngine.TILE_SIZE;
    const proximityPx = 3 * T; // 3 blocos (48px)
    const maxPxX = Math.max(0, this.level.width * T - T);
    const px = Math.max(0, Math.min(maxPxX, Math.round(worldX)));
    const tileX = Math.max(0, Math.min(this.level.width - 1, Math.floor((px + 8) / T)));
    let hasExplicitEnd = false;

    // 1. Bandeira final (flagX) e região do castelo de saída
    if (this.level.flagX > 0 && this.level.flagX < 99000) {
      hasExplicitEnd = true;
      const flagTile = Math.floor(this.level.flagX / T);
      const zoneMinX = this.level.flagX - proximityPx;
      const zoneMaxX = Math.max(
        this.level.flagX + proximityPx,
        this.level.castleX > 0 && this.level.castleX < 99000
          ? this.level.castleX + proximityPx
          : this.level.flagX + proximityPx
      );
      if (px >= zoneMinX && px <= zoneMaxX) return true;
      if (Math.abs(tileX - flagTile) <= 3) return true;
    }

    // 2. Machado do Castelo (axe) ou Interruptor Amarelo (yellow_switch / yellow_switch_pressed)
    for (let ty = 0; ty < this.level.height; ty++) {
      const row = this.level.tiles[ty];
      if (!row) continue;
      for (let tx = 0; tx < this.level.width; tx++) {
        const type = row[tx]?.type;
        if (type === 'axe' || this.isAnySwitchTile(type)) {
          hasExplicitEnd = true;
          const endPx = tx * T;
          if (px >= endPx - proximityPx && px <= endPx + proximityPx) return true;
          if (Math.abs(tileX - tx) <= 3) return true;
        }
      }
    }

    // 3. Castelo de saída quando não há bandeira explícita
    if (this.level.castleX > 0 && this.level.castleX < 99000) {
      hasExplicitEnd = true;
      const castleTile = Math.floor(this.level.castleX / T);
      if (px >= this.level.castleX - proximityPx && px <= this.level.castleX + proximityPx) {
        return true;
      }
      if (Math.abs(tileX - castleTile) <= 3) return true;
    }

    // 4. Fallback caso uma fase customizada não possua marcador explícito de final
    if (!hasExplicitEnd) {
      const endTile = Math.max(0, this.level.width - 1);
      if (px >= endTile * T - proximityPx || Math.abs(tileX - endTile) <= 3) {
        return true;
      }
    }

    return false;
  }

  public placeDebugItemAt(worldX?: number, worldY?: number): boolean {
    if (!this.isDebugMode || this.enforceStageEndDebugLock(true)) return false;
    const spec = this.getCurrentDebugPlaceable();
    const maxPxX = Math.max(0, this.level.width * GameEngine.TILE_SIZE - 16);
    const px = Math.max(0, Math.min(maxPxX, Math.round(worldX ?? this.marioX)));
    const py = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 16, Math.round(worldY ?? this.marioY)));

    // R1.16.QO.4: Bloqueia inserção de objetos no modo debug em cima ou a até 3 blocos do final da fase
    if (this.isDebugPlacementBlockedAt(px)) {
      this.sound.playBump();
      this.particleSystem.emitScoreText('PERTO DO FINAL!', Math.max(8, px - 24), Math.max(20, py - 14), {
        maxLife: 40,
        vy: -1.0,
        color: '#ff6868',
      });
      return false;
    }

    // R1.16.1RZ.4: Yoshi cannot be inserted or spawned inside castle stages
    if (spec.id === 'yoshi') {
      if (this.isCastleLevel()) {
        this.sound.playBump();
        this.particleSystem.emitScoreText('PROIBIDO NO CASTELO!', Math.max(8, px - 34), Math.max(20, py - 14), {
          maxLife: 45,
          vy: -1.0,
          color: '#ff6868',
        });
        return false;
      }
      const spawnY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 20, py));
      this.spawnYoshiAt(px, spawnY);
      this.sound.playPowerUpAppear();
      this.spawnPowerUpSparkles(px, spawnY);
      return true;
    }

    if (spec.id === 'key' || spec.id === 'p_switch_blue' || spec.id === 'p_switch_cyan') {
      this.spawnCarryableObject(spec.id, px, py);
      this.sound.playPowerUpAppear();
      this.spawnPowerUpSparkles(px, py);
      return true;
    }

    if (spec.id === 'keyhole') {
      this.spawnKeyhole(px, py);
      this.sound.playPowerUpAppear();
      this.spawnPowerUpSparkles(px, py);
      return true;
    }

    if (spec.category === 'item') {
      const itemType = spec.id as Item['type'];
      const dir = this.marioFacing === 'left' ? -1 : 1;
      const vx =
        itemType === 'mushroom' || itemType === '1up' || itemType === 'star'
          ? dir * 1.4
          : 0;
      this.items.push({
        id: this.nextEntityId++,
        type: itemType,
        x: px,
        y: py,
        vx,
        vy: itemType === 'star' ? -3.2 : 0,
        width: 16,
        height: 16,
        grounded: itemType === 'coin',
        collected: false,
        emerging: false,
        emergeY: py,
      });
      if (itemType === 'coin') {
        this.sound.playCoin();
        this.spawnCoinParticles(px, py);
      } else {
        this.sound.playPowerUpAppear();
        this.spawnPowerUpSparkles(px, py);
      }
      return true;
    }

    if (spec.category === 'tile') {
      const tx = Math.max(0, Math.min(this.level.width - 1, Math.floor((px + 8) / GameEngine.TILE_SIZE)));
      const ty = Math.max(0, Math.min(this.level.height - 1, Math.floor((py + 8) / GameEngine.TILE_SIZE)));
      if (!this.level.tiles[ty]) return false;

      let newTile: BlockTile;
      if (spec.id === 'question_coin') {
        newTile = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, coinsLeft: 1 };
      } else if (spec.id === 'exclam_yellow') {
        newTile = { type: 'exclam_yellow', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };
      } else if (spec.id === 'exclam_green') {
        newTile = { type: 'exclam_green', content: 'feather', bumpOffset: 0, bumpVel: 0 };
      } else if (spec.id === 'exclam_red') {
        newTile = { type: 'exclam_red', content: 'fireflower', bumpOffset: 0, bumpVel: 0 };
      } else if (spec.id === 'exclam_pink') {
        newTile = { type: 'exclam_pink', content: 'femboy', bumpOffset: 0, bumpVel: 0 };
      } else if (spec.id === 'exclam_blue') {
        newTile = { type: 'exclam_blue', content: 'leaf', bumpOffset: 0, bumpVel: 0 };
      } else if (spec.id === 'brick') {
        newTile = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
      } else {
        newTile = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      this.level.tiles[ty][tx] = newTile;
      this.sound.playBump();
      this.spawnCoinParticles(tx * GameEngine.TILE_SIZE, ty * GameEngine.TILE_SIZE);
      return true;
    }

    // Enemy placement
    const enemyType = spec.id as EnemyType;
    const speedMult = this.level.enemySpeedMultiplier ?? 1;
    const isTall =
      enemyType === 'koopa' ||
      enemyType === 'red_koopa' ||
      enemyType === 'paratroopa' ||
      enemyType === 'hammer_bro' ||
      enemyType === 'dry_bones';
    const enemyHeight = isTall ? 24 : 16;
    const spawnY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - enemyHeight, py - (isTall ? 8 : 0)));
    this.enemies.push({
      id: this.nextEntityId++,
      type: enemyType,
      x: px,
      y: spawnY,
      vx: EnemySpawnManager.getInitialVelocity(enemyType, speedMult, -1),
      vy: enemyType === 'paratroopa' ? -2.8 : 0,
      width: 16,
      height: enemyHeight,
      alive: true,
      state: 'walk',
      stateTimer: 0,
      facing: 'left',
      animFrame: 0,
      animTimer: 0,
      originX: px,
      fireTimer: enemyType === 'hammer_bro' ? 42 : undefined,
    });
    this.sound.playStomp();
    this.spawnPowerUpSparkles(px, spawnY);
    return true;
  }

  private updateDebugPlacementCursor() {
    const fast = this.controls.run;
    const speed = fast ? 4.4 : 2.3;
    let dx = 0;
    let dy = 0;

    if (this.controls.left && !this.controls.right) {
      dx = -speed;
      this.marioFacing = 'left';
    } else if (this.controls.right && !this.controls.left) {
      dx = speed;
      this.marioFacing = 'right';
    }
    if (this.controls.up && !this.controls.down) {
      dy = -speed;
    } else if (this.controls.down && !this.controls.up) {
      dy = speed;
    }

    const maxX = Math.max(0, this.level.width * GameEngine.TILE_SIZE - 16);
    this.marioX = Math.max(0, Math.min(maxX, this.marioX + dx));
    this.marioY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 16, this.marioY + dy));
    this.marioVx = dx;
    this.marioVy = 0;

    // Sonic Debug Controls:
    // - Run button tap (Shift / X / K): cycle item
    // - Jump button tap (Space / Z): insert selected item manually at cursor
    if (this.controls.run && !this.prevControls.run) {
      this.cycleDebugPlaceable(1);
    }
    if (this.controls.jump && !this.prevControls.jump) {
      this.placeDebugItemAt();
    }
  }

  // --- ABYSS + RUN EASTER EGG ("ILLEGAL INSTRUCTION") ---
  private triggerIllegalInstructionBug() {
    this.isIllegalInstructionBug = true;
    this.illegalInstructionTimer = 0;
    this.isDebugPlacementActive = false;
    this.marioVx = 0;
    this.marioVy = 0;
    this.sound.stopMusic();
    this.sound.playIllegalInstructionGlitch();
    this.triggerScreenShake(5.0, 18);
  }

  public recoverFromIllegalInstruction(): boolean {
    if (!this.isIllegalInstructionBug) return false;
    this.isIllegalInstructionBug = false;
    this.illegalInstructionTimer = 0;

    // Restore Mario safely back onto solid ground before the abyss
    const maxX = Math.max(16, this.level.width * GameEngine.TILE_SIZE - 32);
    let safeX = Math.max(16, Math.min(maxX, this.lastSafeGroundPos.x));
    let safeY = Math.max(24, Math.min(GameEngine.NES_HEIGHT - 48, this.lastSafeGroundPos.y));

    const checkStandingOnSolid = (px: number): number | null => {
      const tx = Math.max(0, Math.min(this.level.width - 1, Math.floor((px + 8) / GameEngine.TILE_SIZE)));
      for (let ty = 2; ty < this.level.height; ty++) {
        const t = this.level.tiles[ty]?.[tx];
        if (t && t.type !== 'lava' && this.isSolidTile(t.type)) {
          const above = this.level.tiles[ty - 1]?.[tx];
          if (!above || !this.isSolidTile(above.type)) {
            return ty * GameEngine.TILE_SIZE - this.getMarioHeight();
          }
        }
      }
      return null;
    };

    const verifiedY = checkStandingOnSolid(safeX);
    if (verifiedY !== null) {
      safeY = verifiedY;
    } else {
      // Fallback: scan nearby columns for solid ground
      for (let offset = 1; offset <= 10; offset++) {
        const leftX = Math.max(16, safeX - offset * GameEngine.TILE_SIZE);
        const ly = checkStandingOnSolid(leftX);
        if (ly !== null) {
          safeX = leftX;
          safeY = ly;
          break;
        }
      }
    }

    this.marioX = safeX;
    this.marioY = safeY;
    this.marioVx = 0;
    this.marioVy = 0;
    this.marioGrounded = false;
    this.marioState = 'idle';
    this.marioInvulnerableTimer = 90;

    const levelWidthPx = this.level.width * GameEngine.TILE_SIZE;
    this.camera.centerOn(this.marioX, levelWidthPx);
    this.cameraX = this.camera.x;

    this.startLevelMusic(this.level.theme);
    this.sound.playDebugRecover();
    this.spawnPowerUpSparkles(this.marioX, this.marioY);
    this.particleSystem.emitScoreText('TELA RESTAURADA!', this.marioX - 28, Math.max(24, this.marioY - 18), {
      maxLife: 55,
      vy: -0.9,
      color: '#58f898',
    });
    return true;
  }

  private startLevelMusic(theme: LevelData['theme']) {
    if (
      this.isBonusStageActive ||
      this.level?.musicTrack === 'bonus' ||
      this.level?.smwNodeId?.startsWith('wiki-switch-')
    ) {
      this.sound.playMusic('bonus');
      return;
    }
    if (this.level?.musicTrack) {
      this.sound.playMusic(this.level.musicTrack);
      return;
    }
    if (theme === 'underground') {
      this.sound.playMusic('underground');
    } else if (theme === 'castle') {
      this.sound.playMusic('castle');
    } else if (theme === 'underwater') {
      this.sound.playMusic('underwater');
    } else if (theme === 'ghost_house') {
      this.sound.playMusic('ghost_house');
    } else {
      this.sound.playMusic('overworld');
    }
  }

  // --- BLOCK BUMP ANIMATION ---
  private updateBlocks() {
    for (let y = 0; y < this.level.height; y++) {
      for (let x = 0; x < this.level.width; x++) {
        const block = this.level.tiles[y][x];
        if (block && block.bumpOffset !== 0) {
          block.bumpOffset += block.bumpVel;
          block.bumpVel += 0.8;
          if (block.bumpOffset >= 0) {
            block.bumpOffset = 0;
            block.bumpVel = 0;
          }
        }
      }
    }
  }

  // --- SCREEN-SHAKE SYSTEM ---
  public triggerScreenShake(intensity: number = 4.0, durationFrames: number = 12) {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    if (durationFrames >= this.screenShakeTimer) {
      this.screenShakeMaxDuration = Math.max(1, durationFrames);
      this.screenShakeTimer = durationFrames;
    }
  }

  private triggerLargeEnemyImpactShake(e: Enemy) {
    const isWazzima = this.playerCharacter === 'wazzima';
    if (e.type === 'bowser') {
      this.triggerScreenShake(isWazzima ? 6.5 : 5.5, 20);
    } else if (e.height >= 24 || e.width >= 24) {
      this.triggerScreenShake(isWazzima ? 5.2 : 4.2, isWazzima ? 16 : 13);
    } else {
      this.triggerScreenShake(isWazzima ? 3.5 : 2.8, 9);
    }
  }

  // --- CAMERA & SCREEN SHAKE UPDATE ---
  private updateCamera() {
    if (this.marioState !== 'dead') {
      const levelWidthPx = this.level.width * GameEngine.TILE_SIZE;
      this.camera.follow(this.marioX, this.marioVx, levelWidthPx);
      this.cameraX = this.camera.x;
    }

    // Process screen-shake decay and pseudo-random displacement
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer--;
      const progress = this.screenShakeTimer / Math.max(1, this.screenShakeMaxDuration);
      const currentIntensity = this.screenShakeIntensity * progress;
      this.screenShakeOffsetX = (Math.random() * 2 - 1) * currentIntensity;
      this.screenShakeOffsetY = (Math.random() * 2 - 1) * currentIntensity;
      if (this.screenShakeTimer <= 0) {
        this.screenShakeIntensity = 0;
        this.screenShakeOffsetX = 0;
        this.screenShakeOffsetY = 0;
      }
    } else {
      this.screenShakeOffsetX = 0;
      this.screenShakeOffsetY = 0;
    }
  }

  // --- PIPE WARP & FLAGPOLE ---
  private checkPipeWarp(): boolean {
    if (!this.level.pipeWarps) return false;
    const marioBox = this.getMarioHitbox();
    const isUnderwater = this.isMarioUnderwater();

    for (const pw of this.level.pipeWarps) {
      // Must press down for down pipe or right for right pipe
      if (pw.type === 'down' && !this.controls.down) continue;
      if (pw.type === 'right' && !this.controls.right) continue;

      // Underwater pipes allow a 4px vertical tolerance so swimming down onto the rim triggers reliably
      const triggerRect: Rect =
        pw.type === 'down' && isUnderwater
          ? { x: pw.from.x, y: pw.from.y - 2, width: pw.from.width, height: pw.from.height + 6 }
          : pw.from;

      if (this.rectsIntersect(marioBox, triggerRect)) {
        // For downward pipes, ensure Mario's feet are near/above the rim (not standing on the floor beside a tall pipe)
        if (pw.type === 'down') {
          const rimY = pw.from.y + pw.from.height;
          const marioBottom = this.marioY + this.getMarioHeight();
          if (marioBottom > rimY + 6) continue;
        }

        this.releaseHeldObject(true);
        this.marioState = 'pipe_entering';
        this.isStatue = false;
        this.isSpinJumping = false;
        this.spinJumpTimer = 0;
        this.stompComboCount = 0;
        this.marioVx = 0;
        this.marioVy = 0;
        this.warpTimer = 0;
        this.warpTarget = {
          toLevel: pw.toLevel,
          toPos: pw.toPos,
          returnPos: { x: pw.from.x + 8, y: pw.from.y },
        };
        this.warpDir = pw.type;
        this.pipeExitDir = 'up';

        // Visual clip lip & exact character alignment with pipe opening
        if (pw.type === 'down') {
          const rimY = pw.from.y + pw.from.height;
          this.pipeClipLipY = rimY;
          this.pipeClipLipX = null;
          // Center Mario cleanly inside the 32px pipe and align feet flush with rim
          this.marioX = pw.from.x + (pw.from.width - 16) / 2;
          this.marioY = rimY - this.getMarioHeight();
        } else {
          const rimX = pw.from.x + pw.from.width;
          this.pipeClipLipX = rimX;
          this.pipeClipLipY = null;
        }

        const isWazzima = this.playerCharacter === 'wazzima';
        this.triggerScreenShake(isWazzima ? 4.4 : 3.5, isWazzima ? 16 : 12);
        this.sound.playPipe();
        return true;
      }
    }
    return false;
  }

  private finishPipeWarp() {
    if (!this.warpTarget) return;

    const targetLevelId = this.warpTarget.toLevel;
    const destPos = { ...this.warpTarget.toPos };
    const returningFromSubArea =
      this.level.id === 'secret-vault' || this.level.id === 'smw-wiki-1-secret';

    if (targetLevelId === 'secret-vault' || targetLevelId === 'smw-wiki-1-secret') {
      const originIsCustom = Boolean(this.level.isCustom);
      if (originIsCustom && targetLevelId === 'smw-wiki-1-secret') {
        const savedReturnPos = this.warpTarget.returnPos
          ? { ...this.warpTarget.returnPos }
          : { ...this.level.marioStart };
        this.customSubAreaOrigin = {
          levelTemplate: cloneLevelData(this.customLevelTemplate || this.level),
          returnPos: savedReturnPos,
        };
      }
      const subAreaLevel =
        targetLevelId === 'smw-wiki-1-secret'
          ? createSmwWiki1SecretRoom()
          : createSecretVault();
      if (targetLevelId === 'smw-wiki-1-secret' && this.customSubAreaOrigin) {
        subAreaLevel.smwNodeId = undefined;
        subAreaLevel.pipeWarps = (subAreaLevel.pipeWarps || []).map(pw => ({
          ...pw,
          from: { ...pw.from },
          toLevel: 'custom-subarea-return',
          toPos: { ...this.customSubAreaOrigin!.returnPos },
        }));
      }
      this.loadLevel(subAreaLevel, false, false, false);
      this.marioX = destPos.x;
      this.marioY = destPos.y;
      this.marioVx = 0;
      this.marioVy = 0;
      this.marioGrounded = false;
      this.camera.snapTo(0, this.level.width * GameEngine.TILE_SIZE);
      this.cameraX = this.camera.x;
      this.marioState = 'falling';
      this.pipeClipLipY = null;
      this.pipeClipLipX = null;
    } else if (
      targetLevelId === this.level.id ||
      targetLevelId === 'world-1-1' ||
      targetLevelId === 'world-1-2' ||
      targetLevelId === 'world-2-2' ||
      targetLevelId === 'wiki-1-overworld' ||
      (targetLevelId === 'custom-subarea-return' && Boolean(this.customSubAreaOrigin))
    ) {
      if (targetLevelId === 'custom-subarea-return' && this.customSubAreaOrigin) {
        const returnLevel = cloneLevelData(this.customSubAreaOrigin.levelTemplate);
        this.customSubAreaOrigin = null;
        this.loadLevel(returnLevel, false, false, false);
      } else if (targetLevelId === 'world-1-1') {
        this.loadLevel(createWorld1_1(), false, false, !returningFromSubArea);
      } else if (targetLevelId === 'wiki-1-overworld') {
        this.loadLevel(
          createSmwWikiWorldStage('wiki-1-overworld'),
          false,
          false,
          !returningFromSubArea
        );
      } else if (targetLevelId === 'world-1-2' && this.level.id !== 'world-1-2') {
        this.loadLevel(createWorld1_2(), false, false, true);
      } else if (targetLevelId === 'world-2-2' && this.level.id !== 'world-2-2') {
        this.loadLevel(createWorld2_2(), false, false, true);
      }

      const rimY = destPos.y + 16;
      this.marioX = destPos.x;
      this.marioY = rimY;
      this.marioVx = 0;
      this.marioVy = 0;
      this.marioGrounded = false;
      this.camera.centerOn(this.marioX, this.level.width * GameEngine.TILE_SIZE);
      this.cameraX = this.camera.x;
      this.marioState = 'pipe_exiting';
      this.pipeExitDir = 'up';
      this.warpTimer = 0;
      this.pipeClipLipY = rimY;
      this.pipeClipLipX = null;
    }

    const isWazzima = this.playerCharacter === 'wazzima';
    this.triggerScreenShake(isWazzima ? 3.2 : 2.4, 11);
    this.sound.playPipe();
    this.warpTarget = null;
  }

  // Tanooki 360-degree Tail Whip & Cape Spin: hits enemies, deflects boss fireballs (Cape), and bumps blocks
  private checkTailWhipCollisions() {
    const isCape = this.marioPower === 'cape';
    const whipBox: Rect = {
      x: this.marioX - (isCape ? 12 : 10),
      y: this.marioY + 4,
      width: isCape ? 40 : 36,
      height: 24,
    };

    if (isCape && (this.bossFireballs.length > 0 || this.hammerProjectiles.length > 0)) {
      this.bossFireballs = this.bossFireballs.filter(bf => {
        const bfBox: Rect = { x: bf.x, y: bf.y, width: 12, height: 8 };
        if (this.rectsIntersect(whipBox, bfBox)) {
          this.spawnEnemyDefeatParticles(bf.x, bf.y);
          this.sound.playKick();
          return false;
        }
        return true;
      });
      this.hammerProjectiles = this.hammerProjectiles.filter(h => {
        const hBox: Rect = { x: h.x, y: h.y, width: 12, height: 12 };
        if (this.rectsIntersect(whipBox, hBox)) {
          this.spawnEnemyDefeatParticles(h.x, h.y);
          this.sound.playKick();
          return false;
        }
        return true;
      });
    }

    // Defeat enemies struck by tail whip
    this.enemies.forEach(e => {
      if (!e.alive || e.state === 'flipped' || e.state === 'squashed' || e.type === 'lava_bubble') return;
      const eBox: Rect = { x: e.x, y: e.y, width: e.width, height: e.height };
      if (this.rectsIntersect(whipBox, eBox)) {
        if (e.type === 'bowser') {
          if (e.hitFlashTimer && e.hitFlashTimer > 0) return;
          e.hp = (e.hp ?? 5) - 1;
          e.hitFlashTimer = 14;
          this.sound.playKick();
          this.triggerScreenShake(2.5, 6);
          this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
          if (e.hp <= 0) {
            e.alive = false;
            e.state = 'flipped';
            e.vy = -5.5;
            this.addScore(5000, e.x, e.y, `${this.getBossDisplayName(e).toUpperCase()}!`);
            this.recordEnemyDefeat('bowser');
          } else {
            this.addScore(100, e.x, e.y);
          }
          return;
        }
        e.alive = false;
        e.state = 'flipped';
        e.vy = -5.5;
        e.vx = this.marioFacing === 'right' ? 2.5 : -2.5;
        this.sound.playKick();
        this.triggerScreenShake(2.5, 6);
        this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
        this.addScore(200, e.x, e.y);
        this.recordEnemyDefeat(e.type);
      }
    });

    // Bump or break adjacent blocks with tail
    const hitTileX = Math.floor((this.marioFacing === 'right' ? this.marioX + 18 : this.marioX - 6) / GameEngine.TILE_SIZE);
    const hitTileY = Math.floor((this.marioY + 12) / GameEngine.TILE_SIZE);
    if (hitTileX >= 0 && hitTileX < this.level.width && hitTileY >= 0 && hitTileY < this.level.height) {
      const block = this.level.tiles[hitTileY][hitTileX];
      const exclamCol = block ? this.getExclamBlockColor(block.type) : null;
      if (
        block &&
        (block.type === 'brick' ||
          block.type === 'underground_brick' ||
          block.type === 'ghost_brick' ||
          block.type === 'question' ||
          (exclamCol !== null && this.isSwitchUnlocked(exclamCol)))
      ) {
        this.hitBlock(hitTileX, hitTileY, block);
        this.triggerScreenShake(2.0, 5);
      }
    }
  }

  public isCastleLevel(): boolean {
    return isCastleStageForYoshi(this.level);
  }

  private getBossDisplayName(enemy?: Enemy): string {
    return enemy?.bossName || this.level?.bossName || 'BOWSER';
  }

  public spawnYoshiAt(x: number, y: number): YoshiEntity | null {
    if (this.isCastleLevel()) {
      return null;
    }
    const maxPxX = Math.max(0, this.level.width * GameEngine.TILE_SIZE - 20);
    const yoshi: YoshiEntity = {
      id: this.nextEntityId++,
      x: Math.max(0, Math.min(maxPxX, x)),
      y: Math.max(16, Math.min(GameEngine.NES_HEIGHT - 20, y)),
      vx: 0,
      vy: 0,
      width: 20,
      height: 20,
      facing: this.marioFacing,
      state: 'idle',
      animFrame: 0,
      animTimer: 0,
      remountCooldown: 0,
    };
    this.yoshis.push(yoshi);
    return yoshi;
  }

  private dismountYoshi(panicked: boolean) {
    if (!this.marioOnYoshi) return;
    this.marioOnYoshi = false;
    this.yoshiTongueTimer = 0;
    this.yoshiRemountGraceTimer = panicked ? 32 : 22;
    this.stats.onYoshi = false;
    if (this.isCastleLevel()) return;

    const footY = this.marioY + this.getMarioHeight();
    const spawnY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 20, footY - 20));
    const dir = this.marioFacing === 'left' ? -1 : 1;
    const spawned = this.spawnYoshiAt(this.marioX - 2, spawnY);
    if (spawned) {
      spawned.state = panicked ? 'runaway' : 'idle';
      spawned.vx = panicked ? dir * 2.2 : 0;
      spawned.vy = panicked ? -2.4 : 0;
      spawned.facing = this.marioFacing;
      spawned.remountCooldown = panicked ? 26 : 18;
    }
  }

  private updateYoshis() {
    if (this.isCastleLevel()) {
      if (this.yoshis.length > 0) this.yoshis = [];
      if (this.marioOnYoshi) {
        this.marioOnYoshi = false;
        this.stats.onYoshi = false;
      }
      return;
    }

    if (this.yoshis.length === 0) return;

    const marioBox = this.getMarioHitbox();
    const canMount =
      !this.marioOnYoshi &&
      this.yoshiRemountGraceTimer <= 0 &&
      this.marioState !== 'dead' &&
      this.marioState !== 'pipe_entering' &&
      this.marioState !== 'pipe_exiting' &&
      !this.isStageClear &&
      !(this.isDebugMode && this.isDebugPlacementActive);

    const levelPixelWidth = this.level.width * GameEngine.TILE_SIZE;

    for (let i = this.yoshis.length - 1; i >= 0; i--) {
      const yoshi = this.yoshis[i];
      if (yoshi.remountCooldown > 0) yoshi.remountCooldown--;

      if (yoshi.state === 'runaway') {
        yoshi.animTimer++;
        if (yoshi.animTimer % 8 === 0) {
          yoshi.animFrame = (yoshi.animFrame + 1) % 2;
        }
        yoshi.x += yoshi.vx;
        if (yoshi.x < 0) {
          yoshi.x = 0;
          yoshi.vx = Math.abs(yoshi.vx);
          yoshi.facing = 'right';
        } else if (yoshi.x + yoshi.width > levelPixelWidth) {
          yoshi.x = levelPixelWidth - yoshi.width;
          yoshi.vx = -Math.abs(yoshi.vx);
          yoshi.facing = 'left';
        }
        const hBox: Rect = { x: yoshi.x, y: yoshi.y, width: yoshi.width, height: yoshi.height - 2 };
        const hTiles = this.getTilesIntersecting(hBox);
        for (const t of hTiles) {
          if (this.isSolidTile(t.tile.type)) {
            if (yoshi.vx > 0) {
              yoshi.x = t.tileX * GameEngine.TILE_SIZE - yoshi.width;
              yoshi.vx = -Math.abs(yoshi.vx);
              yoshi.facing = 'left';
            } else if (yoshi.vx < 0) {
              yoshi.x = (t.tileX + 1) * GameEngine.TILE_SIZE;
              yoshi.vx = Math.abs(yoshi.vx);
              yoshi.facing = 'right';
            }
            break;
          }
        }
      }

      // Gravity & vertical floor collision
      yoshi.vy = Math.min(5.5, yoshi.vy + 0.35);
      yoshi.y += yoshi.vy;
      const vBox: Rect = { x: yoshi.x + 2, y: yoshi.y, width: yoshi.width - 4, height: yoshi.height };
      const vTiles = this.getTilesIntersecting(vBox);
      for (const t of vTiles) {
        if (this.isSolidTile(t.tile.type) && yoshi.vy >= 0) {
          yoshi.y = t.tileY * GameEngine.TILE_SIZE - yoshi.height;
          yoshi.vy = 0;
          break;
        }
      }

      if (yoshi.y > GameEngine.NES_HEIGHT + 32) {
        this.yoshis.splice(i, 1);
        continue;
      }

      if (canMount && yoshi.remountCooldown <= 0) {
        const yBox: Rect = { x: yoshi.x, y: yoshi.y, width: yoshi.width, height: yoshi.height };
        if (this.rectsIntersect(marioBox, yBox)) {
          this.yoshis.splice(i, 1);
          this.marioOnYoshi = true;
          this.stats.onYoshi = true;
          this.marioVy = Math.min(this.marioVy, -2.0);
          this.sound.playPowerUpEat();
          this.spawnPowerUpSparkles(yoshi.x + 4, yoshi.y);
          this.particleSystem.emitScoreText('YOSHI!', yoshi.x, Math.max(20, yoshi.y - 10), {
            maxLife: 38,
            vy: -0.9,
            color: '#58f898',
          });
          this.onMultiplayerSyncNeeded?.();
          break;
        }
      }
    }
  }

  public isCarryingAnything(): boolean {
    return this.heldCarryableId !== null || this.heldShellEnemyId !== null;
  }

  public spawnCarryableObject(kind: CarryableKind, x: number, y: number): CarryableObject {
    const maxPxX = Math.max(0, this.level.width * GameEngine.TILE_SIZE - 16);
    const clampedX = Math.max(0, Math.min(maxPxX, Math.round(x)));
    const clampedY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 16, Math.round(y)));
    const obj: CarryableObject = {
      id: this.nextEntityId++,
      kind,
      x: clampedX,
      y: clampedY,
      vx: 0,
      vy: 0,
      width: 16,
      height: 16,
      grounded: false,
      consumed: false,
      pressed: false,
      pressTimer: 0,
      pickupCooldown: 0,
      spawnX: clampedX,
      spawnY: clampedY,
    };
    this.carryables.push(obj);
    return obj;
  }

  public spawnKeyhole(x: number, y: number): KeyholeEntity {
    const maxPxX = Math.max(0, this.level.width * GameEngine.TILE_SIZE - 16);
    const clampedX = Math.max(0, Math.min(maxPxX, Math.round(x)));
    const clampedY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 16, Math.round(y)));
    const kh: KeyholeEntity = {
      id: this.nextEntityId++,
      x: clampedX,
      y: clampedY,
      width: 16,
      height: 16,
      activated: false,
      animTimer: 0,
    };
    this.keyholes.push(kh);
    return kh;
  }

  public releaseHeldObject(forceDrop: boolean = false) {
    const dir = this.marioFacing === 'right' ? 1 : -1;
    const maxPxX = Math.max(0, this.level.width * GameEngine.TILE_SIZE - 16);

    if (this.heldShellEnemyId !== null) {
      const shellId = this.heldShellEnemyId;
      this.heldShellEnemyId = null;
      const shell = this.enemies.find(e => e.id === shellId && e.alive);
      if (shell && (shell.type === 'koopa' || shell.type === 'red_koopa') && shell.state === 'shell_idle') {
        if (forceDrop || this.controls.down) {
          shell.x = Math.max(0, Math.min(maxPxX, this.marioX + dir * 14));
          shell.vx = 0;
          shell.vy = 0;
          shell.state = 'shell_idle';
          shell.stateTimer = Math.max(shell.stateTimer, 240);
        } else {
          shell.state = 'shell_moving';
          shell.stateTimer = 8;
          shell.shellKillStreak = 0;
          shell.vx = dir * 4.8;
          shell.vy = 0;
          this.sound.playKick();
          this.triggerScreenShake(2.6, 6);
          this.spawnEnemyDefeatParticles(shell.x, shell.y, shell.type);
        }
      }
    }

    if (this.heldCarryableId !== null) {
      const objId = this.heldCarryableId;
      this.heldCarryableId = null;
      const obj = this.carryables.find(c => c.id === objId && !c.consumed);
      if (obj) {
        obj.pickupCooldown = 14;
        if (forceDrop || this.controls.down) {
          obj.x = Math.max(0, Math.min(maxPxX, this.marioX + dir * 12));
          obj.vx = dir * 0.4;
          obj.vy = 0;
        } else if (this.controls.up) {
          obj.vx = dir * 1.4 + this.marioVx * 0.45;
          obj.vy = -4.8;
          this.sound.playKick();
        } else {
          obj.vx = dir * 3.4 + this.marioVx * 0.4;
          obj.vy = -1.8;
          this.sound.playKick();
        }
      }
    }
  }

  private updateCarryablesAndKeyholes() {
    if (this.heldCarryableId !== null) {
      const heldExists = this.carryables.some(
        c => c.id === this.heldCarryableId && !c.consumed && !c.pressed
      );
      if (!heldExists) {
        this.heldCarryableId = null;
      }
    }

    const canInteractMario =
      this.marioState !== 'dead' &&
      this.marioState !== 'pipe_entering' &&
      this.marioState !== 'pipe_exiting' &&
      this.marioState !== 'pole_slide' &&
      this.marioState !== 'castle_walk' &&
      this.marioState !== 'castle_entered';
    const marioBox = this.getMarioHitbox();
    const maxPxX = Math.max(0, this.level.width * GameEngine.TILE_SIZE - 16);

    for (const obj of this.carryables) {
      if (obj.consumed) continue;
      if (obj.pressed) {
        obj.pressTimer++;
        if (obj.pressTimer >= 32) {
          obj.consumed = true;
        }
        continue;
      }
      if (obj.pickupCooldown > 0) {
        obj.pickupCooldown--;
      }

      if (this.heldCarryableId === obj.id) {
        const dir = this.marioFacing === 'right' ? 1 : -1;
        obj.x = Math.max(0, Math.min(maxPxX, this.marioX + dir * 10));
        obj.y = this.marioY + Math.max(2, this.getMarioHeight() - 16);
        obj.vx = 0;
        obj.vy = 0;
        obj.grounded = false;
      } else {
        // Physics for unheld carryable objects (Keys & Portable P-Switches)
        obj.vy = Math.min(5.8, obj.vy + 0.32);
        if (obj.grounded) {
          obj.vx *= 0.82;
          if (Math.abs(obj.vx) < 0.08) obj.vx = 0;
        }

        // Horizontal movement & collision
        obj.x += obj.vx;
        if (obj.x < 0) {
          obj.x = 0;
          obj.vx = -obj.vx * 0.45;
        } else if (obj.x > maxPxX) {
          obj.x = maxPxX;
          obj.vx = -obj.vx * 0.45;
        }
        const hTiles = this.getTilesIntersecting({
          x: obj.x,
          y: obj.y + 2,
          width: obj.width,
          height: obj.height - 4,
        });
        for (const t of hTiles) {
          if (this.isSolidTile(t.tile.type)) {
            if (obj.vx > 0) {
              obj.x = t.tileX * GameEngine.TILE_SIZE - obj.width;
            } else if (obj.vx < 0) {
              obj.x = (t.tileX + 1) * GameEngine.TILE_SIZE;
            }
            obj.vx = -obj.vx * 0.45;
            break;
          }
        }

        // Vertical movement & collision
        const prevObjY = obj.y;
        obj.y += obj.vy;
        obj.grounded = false;
        const vTiles = this.getTilesIntersecting({
          x: obj.x + 2,
          y: obj.y,
          width: obj.width - 4,
          height: obj.height,
        });
        for (const t of vTiles) {
          if (this.isSolidTile(t.tile.type)) {
            if (obj.vy >= 0) {
              obj.y = t.tileY * GameEngine.TILE_SIZE - obj.height;
              obj.vy = 0;
              obj.grounded = true;
              break;
            } else {
              obj.y = (t.tileY + 1) * GameEngine.TILE_SIZE;
              obj.vy = 0;
              break;
            }
          }
        }

        // Ride floating platforms
        if (!obj.grounded && obj.vy >= 0 && this.floatingPlatforms.length > 0) {
          const prevBottom = prevObjY + obj.height;
          const nextBottom = obj.y + obj.height;
          for (const plat of this.floatingPlatforms) {
            const horizOverlap = obj.x + obj.width - 2 > plat.x && obj.x + 2 < plat.x + plat.width;
            if (horizOverlap && prevBottom <= plat.y + 5 && nextBottom >= plat.y) {
              obj.y = plat.y - obj.height;
              obj.x += plat.dx;
              obj.vy = 0;
              obj.grounded = true;
              break;
            }
          }
        }

        // Respawn at original spawn point if dropped into an abyss
        if (obj.y > GameEngine.NES_HEIGHT + 32) {
          obj.x = obj.spawnX;
          obj.y = obj.spawnY;
          obj.vx = 0;
          obj.vy = 0;
          obj.grounded = false;
        }

        // Mario interaction: stomp P-Switch OR pick up while holding Run
        if (canInteractMario && obj.pickupCooldown <= 0) {
          const objBox: Rect = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
          if (this.rectsIntersect(marioBox, objBox)) {
            const prevMarioBottom = marioBox.y + marioBox.height - this.marioVy;
            const isPSwitch = obj.kind === 'p_switch_blue' || obj.kind === 'p_switch_cyan';
            const isStomp =
              isPSwitch &&
              ((this.marioVy > 0 && prevMarioBottom <= obj.y + 10) ||
                (!this.controls.run && this.marioVy >= 0 && prevMarioBottom <= obj.y + 10));

            if (isStomp) {
              this.activatePSwitch(obj);
            } else if (
              this.controls.run &&
              !this.isCarryingAnything() &&
              !this.marioOnYoshi &&
              !this.isStatue
            ) {
              this.heldCarryableId = obj.id;
              obj.vx = 0;
              obj.vy = 0;
              obj.grounded = false;
            } else if (!this.controls.run) {
              // Gentle nudge when walking into unheld carryable without Run
              obj.vx = this.marioX + 7 < obj.x + 8 ? 1.1 : -1.1;
            }
          }
        }
      }
    }

    // Keyhole unlock check (key can be carried OR thrown directly into the keyhole!)
    for (const kh of this.keyholes) {
      if (kh.activated || this.keyholeClearTimer > 0) continue;
      const khBox: Rect = {
        x: kh.x - 3,
        y: kh.y - 3,
        width: kh.width + 6,
        height: kh.height + 6,
      };

      const matchingKey = this.carryables.find(c => {
        if (c.consumed || c.kind !== 'key') return false;
        const keyBox: Rect = { x: c.x, y: c.y, width: c.width, height: c.height };
        return this.rectsIntersect(khBox, keyBox);
      });

      if (matchingKey) {
        this.triggerKeyholeUnlock(matchingKey, kh);
        break;
      }

      if (canInteractMario && this.keyholeHintCooldown <= 0 && this.rectsIntersect(marioBox, khBox)) {
        this.keyholeHintCooldown = 90;
        this.particleSystem.emitScoreText('PRECISA CHAVE!', Math.max(8, kh.x - 16), Math.max(20, kh.y - 12), {
          maxLife: 45,
          vy: -0.7,
          color: '#fce078',
        });
      }
    }

    this.carryables = this.carryables.filter(c => !c.consumed);
  }

  private activatePSwitch(obj: CarryableObject) {
    obj.pressed = true;
    obj.pressTimer = 0;
    obj.vx = 0;
    obj.vy = 0;
    if (this.heldCarryableId === obj.id) {
      this.heldCarryableId = null;
    }
    this.marioVy = Math.min(this.marioVy, -3.5);
    this.sound.playBump();
    this.triggerScreenShake(2.8, 8);

    if (obj.kind === 'p_switch_blue') {
      this.activateBluePSwitch(obj.x, obj.y);
    } else if (obj.kind === 'p_switch_cyan') {
      this.activateCyanPSwitch(obj.x, obj.y);
    }
  }

  private activateBluePSwitch(originX: number, originY: number) {
    let converted = 0;
    for (const item of this.items) {
      if (item.collected || item.type !== 'coin') continue;
      if (Math.abs(item.x - originX) > 360) continue;

      const tx = Math.floor((item.x + 4) / GameEngine.TILE_SIZE);
      const ty = Math.floor((item.y + 4) / GameEngine.TILE_SIZE);
      if (
        ty >= 0 &&
        ty < this.level.height &&
        tx >= 0 &&
        tx < this.level.width &&
        !this.level.tiles[ty][tx]
      ) {
        this.level.tiles[ty][tx] = {
          type: 'brick',
          content: 'none',
          bumpOffset: 0,
          bumpVel: 0,
        };
        this.pSwitchTransformedBlocks.push({
          tx,
          ty,
          origX: item.x,
          origY: item.y,
        });
        item.collected = true;
        this.spawnCoinParticles(item.x, item.y);
        converted++;
      }
    }
    this.items = this.items.filter(i => !i.collected);
    this.pSwitchBlueTimer = 600;
    this.sound.playPowerUpAppear();
    this.particleSystem.emitScoreText(
      converted > 0 ? `BLOCO P! x${converted}` : 'BLOCO P!',
      Math.max(8, originX - 12),
      Math.max(20, originY - 12),
      { maxLife: 45, vy: -0.9, color: '#58a8f8' }
    );
  }

  private revertBluePSwitchBlocks() {
    this.pSwitchBlueTimer = 0;
    for (const entry of this.pSwitchTransformedBlocks) {
      const tile = this.level.tiles[entry.ty]?.[entry.tx];
      if (tile && tile.type === 'brick') {
        this.level.tiles[entry.ty][entry.tx] = null;
        this.items.push({
          id: this.nextEntityId++,
          type: 'coin',
          x: entry.origX,
          y: entry.origY,
          vx: 0,
          vy: 0,
          width: 16,
          height: 16,
          grounded: true,
          collected: false,
          emerging: false,
          emergeY: entry.origY,
        });
        this.spawnCoinParticles(entry.origX, entry.origY);
      }
    }
    this.pSwitchTransformedBlocks = [];
  }

  private activateCyanPSwitch(originX: number, originY: number) {
    let converted = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.type === 'bowser' || e.id === this.heldShellEnemyId) {
        continue;
      }
      const inRange =
        Math.abs(e.x - originX) <= 320 ||
        (e.x >= this.cameraX - 48 && e.x <= this.cameraX + GameEngine.NES_WIDTH + 48);
      if (!inRange) continue;

      const coinX = Math.max(0, Math.min(this.level.width * GameEngine.TILE_SIZE - 16, Math.round(e.x)));
      const coinY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 32, Math.round(e.y)));
      e.alive = false;
      e.state = 'flipped';
      e.y = GameEngine.NES_HEIGHT + 96;
      this.items.push({
        id: this.nextEntityId++,
        type: 'coin',
        x: coinX,
        y: coinY,
        vx: 0,
        vy: 0,
        width: 16,
        height: 16,
        grounded: true,
        collected: false,
        emerging: false,
        emergeY: coinY,
      });
      this.spawnCoinParticles(coinX, coinY);
      this.recordEnemyDefeat(e.type);
      converted++;
    }
    this.sound.playCoin();
    this.particleSystem.emitScoreText(
      converted > 0 ? `MOEDA P! x${converted}` : 'MOEDA P!',
      Math.max(8, originX - 12),
      Math.max(20, originY - 12),
      { maxLife: 45, vy: -0.9, color: '#58f8f8' }
    );
  }

  private triggerKeyholeUnlock(keyObj: CarryableObject, kh: KeyholeEntity) {
    this.keyholeKeyStartX = keyObj.x;
    this.keyholeKeyStartY = keyObj.y;
    this.keyholeKeyX = keyObj.x;
    this.keyholeKeyY = keyObj.y;
    keyObj.consumed = true;
    if (this.heldCarryableId === keyObj.id) {
      this.heldCarryableId = null;
    }
    this.releaseHeldObject(true);
    kh.activated = true;
    kh.animTimer = 0;
    this.activeKeyholeId = kh.id;
    this.keyholeClearTimer = 1;
    this.keyholeTransitionActive = true;
    this.keyholeTotalTimer = 1;
    this.lastClearWasSecretExit = true;
    this.marioFacing = kh.x + 8 >= this.marioX + 8 ? 'right' : 'left';
    this.marioVx = 0;
    this.marioVy = 0;
    this.sound.stopMusic();
    this.sound.playKeyholeClear();
    this.addScore(1000, kh.x, kh.y, 'CHAVE!');
    this.spawnPowerUpSparkles(kh.x, kh.y);
    this.enforceStageEndDebugLock(false);
  }

  private getYoshiTongueRect(): Rect | null {
    if (!this.marioOnYoshi || this.yoshiTongueTimer <= 0) return null;
    const progress = Math.sin(((14 - this.yoshiTongueTimer) / 14) * Math.PI);
    const reach = Math.max(8, Math.round(28 * progress));
    const mouthY = this.marioY + this.getMarioHeight() - 14;
    if (this.marioFacing === 'right') {
      return { x: this.marioX + 14, y: mouthY, width: reach, height: 8 };
    }
    return { x: this.marioX + 2 - reach, y: mouthY, width: reach, height: 8 };
  }

  private checkYoshiTongueCollisions() {
    const tongueBox = this.getYoshiTongueRect();
    if (!tongueBox) return;

    // 1. Eat coins, W-coins & items
    this.items.forEach(item => {
      if (item.collected || item.emerging) return;
      const itemBox: Rect = { x: item.x, y: item.y, width: item.width, height: item.height };
      if (this.rectsIntersect(tongueBox, itemBox)) {
        if (item.type === 'coin') {
          this.collectFloatingCoinItem(item);
        } else if (item.type === 'w_coin') {
          this.collectWCoinItem(item);
        } else {
          item.collected = true;
          this.collectItem(item);
        }
      }
    });
    this.items = this.items.filter(i => !i.collected);

    // 2. Eat regular enemies (not Bowser, ghosts, skeletons, or lava sparks)
    this.enemies.forEach(e => {
      if (
        !e.alive ||
        e.type === 'bowser' ||
        e.type === 'lava_bubble' ||
        e.type === 'boo' ||
        e.type === 'dry_bones'
      ) {
        return;
      }
      const eBox: Rect = { x: e.x, y: e.y, width: e.width, height: e.height };
      if (this.rectsIntersect(tongueBox, eBox)) {
        e.alive = false;
        e.state = 'flipped';
        e.y = GameEngine.NES_HEIGHT + 96;
        this.sound.playPowerUpEat();
        this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
        this.addScore(200, e.x, e.y);
        this.recordEnemyDefeat(e.type);
      }
    });
  }

  public hasGoalPointsPost(): boolean {
    return Boolean(
      this.level &&
        this.level.theme !== 'castle' &&
        !this.level.isFinalCastle &&
        this.level.flagX > 0 &&
        this.level.flagX < 99000 &&
        !this.isBonusStageActive
    );
  }

  public computeGoalGatePoints(
    marioCenterY: number,
    tapeY: number = this.goalTapeY,
    marioHeight: number = this.getMarioHeight()
  ): number {
    // Player only earns Goal Gate points when Mario reaches the moving tape cursor position
    const tapeHalfThickness = 4;
    const maxReach = Math.max(14, marioHeight * 0.5 + tapeHalfThickness);
    if (Math.abs(marioCenterY - (tapeY + 2)) > maxReach && Math.abs(marioCenterY - tapeY) > maxReach) {
      return 0;
    }

    // Score depends on the cursor's height when touched (50 at top -> 1 at bottom)
    const ratio = Math.max(0, Math.min(1, (178 - tapeY) / (178 - 44)));

    if (ratio >= 0.86) return 50;
    if (ratio >= 0.68) return 40;
    if (ratio >= 0.50) return 30;
    if (ratio >= 0.34) return 20;
    if (ratio >= 0.18) return 10;
    if (ratio >= 0.08) return 5;
    return 1;
  }

  public applyGoalPointsReward(points: number, x: number, y: number) {
    const cleanPoints = Math.max(0, Math.floor(points));
    if (cleanPoints <= 0) {
      this.pendingBonusStage = false;
      this.stats.goalPointsWallet = this.goalPointsWallet;
      this.particleSystem.emitScoreText('SEM FITA! +0', x - 16, Math.max(40, y), {
        maxLife: 65,
        vy: -0.6,
        color: '#d8e0ec',
      });
      return;
    }

    const prevWallet = Math.max(0, Math.min(99, this.goalPointsWallet));
    const total = prevWallet + cleanPoints;

    // Score bonus proportional to goal gate points (authentic SMW scoring feel)
    this.addScore(cleanPoints * 100, x, Math.max(40, y), `+${cleanPoints} PTS POSTE!`);

    // 50 points milestone -> +3 lives (3-UP!)
    const earnedThreeUp = cleanPoints >= 50 || (prevWallet < 50 && total >= 50);
    if (earnedThreeUp) {
      if (!this.infiniteLives && !this.isEditorImmortality) {
        this.stats.lives += 3;
      }
      this.sound.play1Up();
      this.particleSystem.emitScoreText('3-UP! +3 VIDAS', x - 20, Math.max(32, y - 22), {
        maxLife: 75,
        vy: -0.7,
        color: '#58f898',
      });
    }

    // 100+ accumulated points -> reset wallet to 0 and queue Bonus Stage (chance for 9 lives)
    if (total >= 100) {
      this.goalPointsWallet = 0;
      this.pendingBonusStage = true;
      this.particleSystem.emitScoreText('100 PTS! BONUS STAGE!', x - 28, Math.max(46, y - 36), {
        maxLife: 85,
        vy: -0.55,
        color: '#fce078',
      });
    } else {
      this.goalPointsWallet = total;
      this.pendingBonusStage = false;
    }

    this.stats.goalPointsWallet = this.goalPointsWallet;
    this.onSmwGoalWalletChanged?.(this.goalPointsWallet);
  }

  public startSmwBonusStage() {
    if (this.isBonusStageActive) return;

    this.bonusReturnLevelMeta = {
      id: this.level.id,
      name: this.level.name,
      singleplayerWorld: this.level.singleplayerWorld,
      singleplayerStage: this.level.singleplayerStage,
      isFinalCastle: this.level.isFinalCastle,
      smwNodeId: this.level.smwNodeId,
      smwWorldName: this.level.smwWorldName,
      endlessStage: this.level.endlessStage,
      isCustom: this.level.isCustom,
      onYoshi: this.marioOnYoshi,
    };

    const width = 16;
    const height = 15;
    const tiles: (BlockTile | null)[][] = Array.from({ length: height }, () =>
      Array<BlockTile | null>(width).fill(null)
    );

    // Solid floor across rows 13..14
    for (let tx = 0; tx < width; tx++) {
      tiles[13][tx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
      tiles[14][tx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }

    // 3x3 rotating SMW Bonus Stage blocks (9 opportunities for 1-UP lives)
    const cols = [4, 7, 10];
    const rows = [4, 7, 10];
    const bonusBlocks: BonusStageBlock[] = [];
    let idx = 0;
    for (const ty of rows) {
      for (const tx of cols) {
        tiles[ty][tx] = { type: 'bonus_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
        bonusBlocks.push({
          tx,
          ty,
          x: tx * GameEngine.TILE_SIZE,
          y: ty * GameEngine.TILE_SIZE,
          timer: (idx * 7) % 20,
          faceIndex: idx % GameEngine.BONUS_BLOCK_FACES.length,
          resolved: false,
          result: null,
        });
        idx++;
      }
    }

    const bonusLevel: LevelData = {
      id: 'smw-bonus-stage',
      name: 'BONUS STAGE',
      theme: 'overworld',
      width,
      height,
      tiles,
      enemies: [],
      coins: [],
      marioStart: { x: 24, y: 12 * GameEngine.TILE_SIZE },
      flagX: 999999,
      castleX: 999999,
      bgColor: '#0c1230',
      musicTrack: 'bonus',
      useBonusBackdrop: true,
      timeLimit: 60,
      biomeLabel: 'BONUS STAGE · VIDAS & POWER-UPS',
    };

    this.level = bonusLevel;
    this.ceilingTileColumns = new Array(width).fill(false);
    this.enemies = [];
    this.items = [];
    this.yoshis = [];
    this.carryables = [];
    this.keyholes = [];
    this.heldCarryableId = null;
    this.heldShellEnemyId = null;
    this.pSwitchBlueTimer = 0;
    this.pSwitchTransformedBlocks = [];
    this.fireballs = [];
    this.bossFireballs = [];
    this.hammerProjectiles = [];
    this.floatingPlatforms = [];
    this.sceneries = [];
    this.particleSystem.clear();

    this.isStageClear = false;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.stageClearTallyDelay = 0;
    this.stageClearDelayTimer = 0;
    this.smwCastleEntryActive = false;
    this.smwCastleEntryTimer = 0;
    this.smwCastleBannerProgress = 0;
    this.smwCastleIrisProgress = 0;
    this.keyholeClearTimer = 0;
    this.keyholeTransitionActive = false;
    this.keyholeTotalTimer = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = true;
    this.bonusStageBlocks = bonusBlocks;
    this.bonusStageLivesWon = 0;
    this.bonusStageFinishDelay = 0;
    this.bonusStageIrisProgress = 0;
    this.bonusStageTimeFrames = 60 * 60;

    this.marioOnYoshi = false;
    this.yoshiTongueTimer = 0;
    this.yoshiTongueCooldown = 0;
    this.stats.onYoshi = false;
    this.marioGrowthTimer = 0;
    this.marioShrinkTimer = 0;
    this.marioInvulnerableTimer = 0;
    this.isSpinJumping = false;
    this.spinJumpTimer = 0;
    this.screenShakeTimer = 0;
    this.screenShakeIntensity = 0;
    this.screenShakeOffsetX = 0;
    this.screenShakeOffsetY = 0;

    this.marioX = 24;
    this.marioY = 13 * GameEngine.TILE_SIZE - this.getMarioHeight();
    this.marioVx = 0;
    this.marioVy = 0;
    this.marioGrounded = true;
    this.marioState = 'idle';
    this.marioFacing = 'right';
    this.marioStarTimer = 0;
    this.camera.snapTo(0, width * GameEngine.TILE_SIZE);
    this.cameraX = 0;

    this.stats.world = 'BONUS';
    this.stats.time = 60;
    this.stats.isBonusStage = true;
    this.stats.bonusBlocksRemaining = bonusBlocks.length;
    this.stats.bonusLivesWon = 0;
    this.stats.goalPointsWallet = this.goalPointsWallet;

    this.sound.playPowerUpEat();
    this.startLevelMusic(bonusLevel.theme);
    this.particleSystem.emitScoreText('BONUS! BATA OS 9 BLOCOS!', 16, 48, {
      maxLife: 80,
      vy: -0.35,
      color: '#fce078',
    });
  }

  public resolveBonusStageBlock(tx: number, ty: number, block?: BlockTile): boolean {
    if (!this.isBonusStageActive || this.bonusStageFinishDelay > 0) {
      return false;
    }
    const targetBlock = block ?? this.level.tiles[ty]?.[tx];
    const entry = this.bonusStageBlocks.find(b => b.tx === tx && b.ty === ty);
    if (!targetBlock || !entry || entry.resolved) {
      return false;
    }

    const chosen = GameEngine.BONUS_BLOCK_FACES[entry.faceIndex % GameEngine.BONUS_BLOCK_FACES.length];
    entry.resolved = true;
    entry.result = chosen;

    targetBlock.type = 'question_empty';
    targetBlock.content = 'none';

    if (chosen === '1up') {
      this.bonusStageLivesWon++;
      if (!this.infiniteLives && !this.isEditorImmortality) {
        this.stats.lives++;
      }
      this.sound.play1Up();
      this.addScore(1000, entry.x, entry.y, '+1 VIDA!');
      this.spawnPowerUpSparkles(entry.x, entry.y - 8);
    } else if (chosen === 'mushroom') {
      this.transitionMarioPower('super', entry.x, entry.y, 'SUPER!');
      this.spawnPowerUpSparkles(entry.x, entry.y - 8);
    } else if (chosen === 'flower') {
      this.transitionMarioPower('fire', entry.x, entry.y, 'FIRE!');
      this.spawnPowerUpSparkles(entry.x, entry.y - 8);
    } else if (chosen === 'feather') {
      this.transitionMarioPower('cape', entry.x, entry.y, 'PENA!');
      this.spawnPowerUpSparkles(entry.x, entry.y - 8);
    } else if (chosen === 'leaf') {
      this.transitionMarioPower('tanooki', entry.x, entry.y, 'TANOOKI!');
      this.spawnPowerUpSparkles(entry.x, entry.y - 8);
    } else if (chosen === 'femboy') {
      this.transitionMarioPower('femboy', entry.x, entry.y, 'FEMBOY!');
      this.spawnPowerUpSparkles(entry.x, entry.y - 8);
    }

    const remaining = this.bonusStageBlocks.filter(b => !b.resolved).length;
    this.stats.bonusBlocksRemaining = remaining;
    this.stats.bonusLivesWon = this.bonusStageLivesWon;

    if (remaining === 0) {
      this.bonusStageFinishDelay = 85;
      this.sound.playStageClear();
      const summaryLabel =
        this.bonusStageLivesWon > 0
          ? `BONUS FIM! +${this.bonusStageLivesWon} VIDAS`
          : 'BONUS FIM! POWER-UP!';
      this.particleSystem.emitScoreText(
        summaryLabel,
        24,
        36,
        { maxLife: 85, vy: -0.25, color: '#58f898' }
      );
    }

    return true;
  }

  public finishSmwBonusStage() {
    this.isBonusStageActive = false;
    this.pendingBonusStage = false;
    this.bonusStageFinishDelay = 0;
    this.bonusStageTimeFrames = 0;
    this.bonusStageIrisProgress = 1;
    this.stats.isBonusStage = false;
    this.stats.bonusBlocksRemaining = 0;
    this.marioGrowthTimer = 0;
    this.marioShrinkTimer = 0;
    this.isSpinJumping = false;
    this.spinJumpTimer = 0;
    this.marioVx = 0;
    this.marioVy = 0;
    this.isStageClear = true;
    this.marioState = 'castle_entered';

    if (this.bonusReturnLevelMeta) {
      this.level.id = this.bonusReturnLevelMeta.id;
      this.level.name = this.bonusReturnLevelMeta.name;
      this.level.singleplayerWorld = this.bonusReturnLevelMeta.singleplayerWorld;
      this.level.singleplayerStage = this.bonusReturnLevelMeta.singleplayerStage;
      this.level.isFinalCastle = this.bonusReturnLevelMeta.isFinalCastle;
      this.level.smwNodeId = this.bonusReturnLevelMeta.smwNodeId;
      this.level.smwWorldName = this.bonusReturnLevelMeta.smwWorldName;
      this.level.endlessStage = this.bonusReturnLevelMeta.endlessStage;
      this.level.isCustom = this.bonusReturnLevelMeta.isCustom;
      if (this.bonusReturnLevelMeta.onYoshi) {
        this.marioOnYoshi = true;
        this.stats.onYoshi = true;
      }
      this.bonusReturnLevelMeta = null;
    }

    this.handleStageClearReadyToAdvance();
  }

  public isEnemyNearStageEnd(enemyX: number, rangePx: number = 192): boolean {
    if (!this.level) return false;
    const T = GameEngine.TILE_SIZE;
    let hasMarker = false;

    if (this.level.flagX > 0 && this.level.flagX < 99000) {
      hasMarker = true;
      if (enemyX >= this.level.flagX - rangePx) return true;
    }

    if (this.level.castleX > 0 && this.level.castleX < 99000) {
      hasMarker = true;
      if (Math.abs(enemyX - this.level.castleX) <= rangePx) return true;
    }

    for (let ty = 0; ty < this.level.height; ty++) {
      const row = this.level.tiles[ty];
      if (!row) continue;
      for (let tx = 0; tx < this.level.width; tx++) {
        const type = row[tx]?.type;
        if (type === 'axe' || this.isAnySwitchTile(type)) {
          hasMarker = true;
          const markerX = tx * T;
          if (Math.abs(enemyX - markerX) <= rangePx) return true;
        }
      }
    }

    if (!hasMarker) {
      return enemyX >= this.level.width * T - rangePx;
    }
    return false;
  }

  public transformStageEndEnemiesToPoints(): { count: number; totalPoints: number } {
    const candidates = this.enemies
      .filter(
        e =>
          e.alive &&
          e.state !== 'flipped' &&
          e.state !== 'squashed' &&
          e.type !== 'bowser' &&
          this.isEnemyNearStageEnd(e.x)
      )
      .sort((a, b) => a.x - b.x);

    let totalPoints = 0;
    candidates.forEach((e, idx) => {
      const basePoints =
        e.type === 'hammer_bro' || e.type === 'dry_bones' || e.type === 'boo'
          ? 400
          : e.type === 'red_koopa' ||
            e.type === 'paratroopa' ||
            e.type === 'blooper' ||
            e.type === 'fast_cheep'
          ? 300
          : 200;
      const multiplier = Math.min(8, idx + 2);
      const pts = basePoints * multiplier;

      e.alive = false;
      e.state = 'flipped';
      e.vx = 0;
      e.vy = -4.5;
      this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
      this.spawnCoinParticles(e.x, e.y);
      this.addScore(pts, e.x, Math.max(36, e.y - 6), `${pts} (x${multiplier})`);
      totalPoints += pts;
    });

    if (candidates.length > 0) {
      this.hammerProjectiles = [];
      this.bossFireballs = [];
      this.sound.playCoin();
    }

    return { count: candidates.length, totalPoints };
  }

  private checkFlagpoleCollision() {
    if (
      this.isBonusStageActive ||
      this.isStageClear ||
      this.marioState === 'pole_slide' ||
      this.marioState === 'castle_walk' ||
      this.marioState === 'castle_entered' ||
      !this.hasGoalPointsPost()
    ) {
      return;
    }

    if (this.marioX >= this.level.flagX - 6 && this.marioX <= this.level.flagX + 24) {
      // Cross the SMW Points Goal Gate!
      this.marioStarTimer = 0;
      this.starComboCount = 0;
      this.isSpinJumping = false;
      this.spinJumpTimer = 0;
      this.marioVx = 0;
      this.marioVy = 0;
      this.marioState = 'castle_walk';
      this.marioFacing = 'right';

      const marioHeight = this.getMarioHeight();
      const marioCenterY = this.marioY + marioHeight * 0.5;
      const earnedGoalPts = this.computeGoalGatePoints(marioCenterY, this.goalTapeY, marioHeight);
      this.goalTapeCut = earnedGoalPts > 0;
      if (this.goalTapeCut) {
        this.particleSystem.emitCoinSparkles(this.level.flagX + 16, this.goalTapeY);
      }
      this.lastGoalGatePoints = earnedGoalPts;
      this.applyGoalPointsReward(earnedGoalPts, this.level.flagX, Math.max(40, this.marioY));
      this.transformStageEndEnemiesToPoints();
      this.enforceStageEndDebugLock(false);
      this.sound.playStageClear();
      this.onMultiplayerSyncNeeded?.();
    }
  }

  private finishStage() {
    if (this.marioState === 'castle_entered') return;
    this.releaseHeldObject(true);
    this.isStageClear = true;
    this.marioState = 'castle_entered';
    this.stageClearTallyDelay = this.keyholeTransitionActive ? 34 : 40;
    this.stageClearDelayTimer = 0;
    this.timeCountTickCounter = 0;
    this.transformStageEndEnemiesToPoints();
    this.enforceStageEndDebugLock(false);
    if (!this.isBonusStageActive) {
      this.recordAchievementProgress('levels_completed', 1);
      if (this.stageElapsedMs < 60000) {
        this.recordAchievementProgress('level_clear_under_60s', 1);
      }
    }
    this.syncHighScore(true);
    this.onMultiplayerSyncNeeded?.();
  }

  private handleStageClearReadyToAdvance() {
    if (!this.localStageCleared) {
      this.localStageCleared = true;
      this.onMultiplayerSyncNeeded?.();
    }

    const now = Date.now();
    const activeRemotes = Array.from(this.remotePlayers.values()).filter(
      rp => now - rp.lastUpdated < 45000 && rp.lives > 0
    );

    if (!this.isMultiplayerConnected || activeRemotes.length === 0) {
      this.waitingForPlayersFinish = false;
      this.waitingPlayersNames = [];
      this.allPlayersClearedReady = false;
      this.advanceToNextLevel();
      return;
    }

    const isRemoteClearedThisLevel = (rp: RemotePlayerState) =>
      Boolean(rp.stageCleared) && (!rp.levelId || rp.levelId === this.level.id);

    const clearedRemotes = activeRemotes.filter(isRemoteClearedThisLevel);
    const pending = activeRemotes.filter(rp => !isRemoteClearedThisLevel(rp));

    // Notify local player immediately whenever a remote teammate arrives/finishes!
    const newlyArrivedNames: string[] = [];
    clearedRemotes.forEach(rp => {
      if (!this.notifiedArrivedPlayerIds.has(rp.id)) {
        this.notifiedArrivedPlayerIds.add(rp.id);
        newlyArrivedNames.push(rp.name || (rp.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario'));
      }
    });
    if (newlyArrivedNames.length > 0) {
      this.stageArrivalNotice = `${newlyArrivedNames.join(', ')} chegou ao final da fase!`;
      this.sound.playPowerUpEat();
    }

    if (pending.length > 0) {
      this.waitingForPlayersFinish = true;
      this.allPlayersClearedReady = false;
      this.waitingPlayersNames = pending.map(rp => {
        const name = rp.name || (rp.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario');
        if (rp.state === 'pole_slide' || rp.state === 'castle_walk' || rp.state === 'castle_entered') {
          return `${name} (entrando no castelo)`;
        }
        return name;
      });
      this.allPlayersClearedCountdown = 0;
      return;
    }

    // All active teammates have finished this exact stage!
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.allPlayersClearedReady = true;

    // In Firebase mode, only the host drives the room level transition so everyone receives the exact same seed.
    if (this.isMultiplayerFirebase && !this.isMultiplayerHost) {
      return;
    }

    // In WebSocket mode, designate the player with lexicographically smallest ID as level coordinator.
    if (!this.isMultiplayerFirebase) {
      const isWsCoordinator = activeRemotes.every(rp => this.localPlayerId <= rp.id);
      if (!isWsCoordinator) {
        return;
      }
    }

    if (this.allPlayersClearedCountdown <= 0) {
      this.allPlayersClearedCountdown = 110; // ~1.8s so both players clearly see the arrival notice
      return;
    }

    this.allPlayersClearedCountdown--;
    if (this.allPlayersClearedCountdown <= 0) {
      this.advanceToNextLevel();
    }
  }

  public evaluateMultiplayerMatchEnd() {
    if (!this.isMultiplayerConnected || this.remotePlayers.size === 0 || this.isMultiplayerMatchOver) {
      return;
    }

    const now = Date.now();
    const recentRemotes = Array.from(this.remotePlayers.values()).filter(
      rp => now - rp.lastUpdated < 25000
    );
    if (recentRemotes.length === 0) return;

    const localDisplayName =
      this.localPlayerName || (this.playerCharacter === 'wazzima' ? 'WazzimaGiygg' : 'Mario');

    const localZero = this.stats.lives <= 0;
    const zeroRemotes = recentRemotes.filter(rp => rp.lives <= 0);
    if (!localZero && zeroRemotes.length === 0) {
      return;
    }

    const loserNames: string[] = [];
    if (localZero) loserNames.push(localDisplayName);
    zeroRemotes.forEach(rp => {
      loserNames.push(rp.name || (rp.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario'));
    });

    const standings: MultiplayerMatchPlayerStanding[] = [
      {
        id: this.localPlayerId,
        name: localDisplayName,
        photoUrl: this.localPlayerPhotoUrl,
        character: this.playerCharacter,
        score: this.stats.score,
        coins: this.stats.coins,
        lives: Math.max(0, this.stats.lives),
        isLocal: true,
      },
      ...recentRemotes.map(rp => ({
        id: rp.id,
        name: rp.name || (rp.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario'),
        photoUrl: rp.photoUrl,
        character: rp.character,
        score: rp.score,
        coins: rp.coins,
        lives: Math.max(0, rp.lives),
        isLocal: false,
      })),
    ];

    standings.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lives !== a.lives) return b.lives - a.lives;
      return b.coins - a.coins;
    });

    const isTie = standings.length >= 2 && standings[0].score === standings[1].score;
    const winner = standings[0];

    this.multiplayerMatchResult = {
      loserNames,
      isTie,
      winner,
      standings,
    };
    this.syncHighScore(true);
    this.persistRunScoreToRanking();
    this.isMultiplayerMatchOver = true;
    this.waitingForPlayersFinish = false;
    this.sound.stopMusic();
    if (winner.isLocal) {
      this.sound.playStageClear();
    } else {
      this.sound.playGameOver();
    }
  }

  public advanceToNextLevel() {
    const isCustomStageOrSubArea = Boolean(this.level.isCustom || this.customSubAreaOrigin);
    if (isCustomStageOrSubArea && this.customCampaignLevels.length > 0) {
      this.customSubAreaOrigin = null;
      const nextIndex = this.customCampaignIndex + 1;
      if (nextIndex < this.customCampaignLevels.length) {
        this.customCampaignIndex = nextIndex;
        const nextStage = cloneLevelData(this.customCampaignLevels[nextIndex]);
        nextStage.isCustom = true;
        if (!nextStage.biomeLabel || nextStage.biomeLabel === 'FASE DO JOGADOR') {
          nextStage.biomeLabel = nextStage.name || `FASE ${nextIndex + 1}`;
        }
        this.customLevelTemplate = cloneLevelData(nextStage);
        this.loadLevel(nextStage, true, false);
        return;
      }
      this.isCampaignVictory = true;
      this.isStageClear = false;
      this.bonusStageIrisProgress = 0;
      this.sound.stopMusic();
      this.sound.playStageClear();
      return;
    }
    if (isCustomStageOrSubArea && this.customLevelTemplate) {
      this.customSubAreaOrigin = null;
      this.loadLevel(cloneLevelData(this.customLevelTemplate), true, false);
      return;
    }
    if (this.gameMode === 'smw_world_map' && this.level.smwNodeId) {
      const clearedNodeId = this.level.smwNodeId;
      const wasSecretExit = this.lastClearWasSecretExit;
      this.lastClearWasSecretExit = false;
      this.isStageClear = false;
      this.localStageCleared = false;
      this.waitingForPlayersFinish = false;
      this.waitingPlayersNames = [];
      this.allPlayersClearedReady = false;
      this.allPlayersClearedCountdown = 0;
      this.stageClearDelayTimer = 0;
      this.stageClearTallyDelay = 0;
      this.smwCastleEntryActive = false;
      this.smwCastleEntryTimer = 0;
      this.bonusStageIrisProgress = 0;
      this.keyholeClearTimer = 0;
      this.keyholeTransitionActive = false;
      this.keyholeTotalTimer = 0;
      this.marioState = 'idle';
      this.marioVx = 0;
      this.marioVy = 0;
      this.isGameStarted = false;
      this.resetControls();
      this.syncHighScore(true);
      this.persistRunScoreToRanking();
      this.sound.stopMusic();
      this.onSmwStageCompleted?.(clearedNodeId, { secretExit: wasSecretExit });
      return;
    }
    if (this.level.isFinalCastle) {
      this.isCampaignVictory = true;
      this.isStageClear = false;
      this.bonusStageIrisProgress = 0;
      this.syncHighScore(true);
      this.persistRunScoreToRanking();
      this.sound.stopMusic();
      this.sound.playStageClear();
      return;
    }
    if (
      this.gameMode === 'singleplayer' &&
      this.level.singleplayerWorld !== undefined &&
      this.level.singleplayerStage !== undefined
    ) {
      const currW = this.level.singleplayerWorld;
      const currS = this.level.singleplayerStage;
      if (currS < SINGLEPLAYER_STAGES_PER_WORLD) {
        this.loadLevel(createSingleplayerLevel(currW, currS + 1), true, false);
      } else if (currW < SINGLEPLAYER_WORLD_COUNT) {
        this.loadLevel(createSingleplayerLevel(currW + 1, 1), true, false);
      } else {
        this.isCampaignVictory = true;
        this.isStageClear = false;
        this.bonusStageIrisProgress = 0;
        this.syncHighScore(true);
        this.persistRunScoreToRanking();
      }
      return;
    }
    if (this.level.id === 'world-1-1') {
      this.loadLevel(createWorld1_2(), true, false);
    } else if (this.level.id === 'world-1-2') {
      this.loadLevel(createWorld2_2(), true, false);
    } else if (this.level.id === 'world-2-2') {
      this.loadLevel(createWorldGhostHouse(), true, false);
    } else if (this.level.id === 'world-ghost') {
      this.loadLevel(createWorld1_4(), true, false);
    } else if (this.level.id === 'world-1-4') {
      // After beating Castle 1-4, continue infinitely through Cycle 2+ (Overworld -> Caverna -> Água -> Castelo)
      this.loadLevel(createEndlessLevel(Date.now(), 5), true, false);
    } else {
      const nextStage = (this.endlessStage || 0) + 1;
      this.loadLevel(createEndlessLevel(Date.now(), nextStage), true, false);
    }
  }

  public setDifficulty(diff: GameDifficulty) {
    this.difficulty = diff;
    this.stats.difficulty = diff;
    if (diff === 'easy') {
      this.stats.lives = Math.max(this.stats.lives, 5);
      if (this.marioPower === 'small') {
        this.marioPower = 'super';
      }
    } else if (diff === 'hard') {
      this.stats.lives = Math.min(this.stats.lives, 1);
    }
  }

  public restartMultiplayerMatch(targetLevel?: LevelData, notifyNetwork: boolean = true) {
    this.customCampaignLevels = [];
    this.customCampaignIndex = 0;
    this.isMultiplayerMatchOver = false;
    this.multiplayerMatchResult = null;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.stageArrivalNotice = '';
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.notifiedArrivedPlayerIds.clear();

    this.activeCheckpoint = null;
    this.activatedCheckpointIndices.clear();

    const initialLives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 1 : 3;
    const initialTime = this.difficulty === 'easy' ? 500 : this.difficulty === 'hard' ? 300 : 400;
    const topScore = getTopScore();
    this.currentRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.runInitialHighScore = topScore;
    this.isNewHighScore = false;
    this.hasTriggeredNewRecordBanner = false;
    this.lastSavedRank = null;

    this.goalPointsWallet = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = false;
    this.stats = {
      score: 0,
      coins: 0,
      world: '1-1',
      time: initialTime,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: topScore,
      difficulty: this.difficulty,
      isNewHighScore: false,
      goalPointsWallet: 0,
      isBonusStage: false,
      bonusBlocksRemaining: 0,
      bonusLivesWon: 0,
    };

    this.isGameStarted = true;
    this.endlessStage = targetLevel?.endlessStage || 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    this.loadLevel(targetLevel || createWorld1_1(), true, false, notifyNetwork);
    this.onMultiplayerSyncNeeded?.();
  }

  public setEditorImmortality(enabled: boolean) {
    this.isEditorImmortality = enabled;
    this.infiniteLives = this.isCheatActive || enabled;
    if (enabled) {
      this.stats.lives = 99;
    } else if (!this.isCheatActive) {
      const initialLives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 1 : 3;
      this.stats.lives = initialLives;
    }
  }

  public playCustomLevel(customLevel: LevelData, immortality: boolean = false) {
    this.customSubAreaOrigin = null;
    this.customCampaignLevels = [];
    this.customCampaignIndex = 0;
    this.gameMode = 'classic';
    this.smwCastleEntryActive = false;
    this.smwCastleEntryTimer = 0;
    this.smwCastleBannerProgress = 0;
    this.smwCastleIrisProgress = 0;
    this.keyholeClearTimer = 0;
    this.keyholeTransitionActive = false;
    this.keyholeTotalTimer = 0;
    this.isIllegalInstructionBug = false;
    this.illegalInstructionTimer = 0;
    this.marioGrowthTimer = 0;
    this.marioShrinkTimer = 0;
    this.marioFireThrowTimer = 0;

    this.isMultiplayerMatchOver = false;
    this.multiplayerMatchResult = null;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.stageArrivalNotice = '';
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.notifiedArrivedPlayerIds.clear();
    this.activeCheckpoint = null;
    this.activatedCheckpointIndices.clear();

    this.isEditorImmortality = immortality;
    this.infiniteLives = this.isCheatActive || immortality;

    const initialLives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 1 : 3;
    const topScore = getTopScore();
    this.currentRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.runInitialHighScore = topScore;
    this.isNewHighScore = false;
    this.hasTriggeredNewRecordBanner = false;
    this.lastSavedRank = null;

    this.goalPointsWallet = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = false;
    this.reservePowerUp = null;
    this.stats = {
      score: 0,
      coins: 0,
      world: customLevel.name || 'CUSTOM',
      time: customLevel.timeLimit || 400,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: topScore,
      difficulty: this.difficulty,
      isNewHighScore: false,
      goalPointsWallet: 0,
      isBonusStage: false,
      bonusBlocksRemaining: 0,
      bonusLivesWon: 0,
      reservePowerUp: null,
      wCoinsCollected: 0,
      wCoinsTotal: 0,
    };

    this.isCampaignVictory = false;
    this.isGameOver = false;
    this.isStageClear = false;
    this.isPaused = false;
    this.isGameStarted = true;
    this.endlessStage = 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    const sanitized = sanitizeCustomLevelEntities(customLevel).level;
    const prepared: LevelData = { ...sanitized, isCustom: true };
    this.loadLevel(prepared, true, false);
  }

  public startCustomCampaign(levels: LevelData[], immortality: boolean = false) {
    if (!levels || levels.length === 0) return;

    const preparedLevels: LevelData[] = levels.map((lvl, idx) => {
      const sanitized = sanitizeCustomLevelEntities(lvl).level;
      return {
        ...cloneLevelData(sanitized),
        isCustom: true,
        biomeLabel: sanitized.name || `FASE ${idx + 1}`,
      };
    });

    this.customSubAreaOrigin = null;
    this.customCampaignLevels = preparedLevels;
    this.customCampaignIndex = 0;
    this.gameMode = 'classic';
    this.smwCastleEntryActive = false;
    this.smwCastleEntryTimer = 0;
    this.smwCastleBannerProgress = 0;
    this.smwCastleIrisProgress = 0;
    this.keyholeClearTimer = 0;
    this.keyholeTransitionActive = false;
    this.keyholeTotalTimer = 0;
    this.isIllegalInstructionBug = false;
    this.illegalInstructionTimer = 0;
    this.marioGrowthTimer = 0;
    this.marioShrinkTimer = 0;
    this.marioFireThrowTimer = 0;

    this.isMultiplayerMatchOver = false;
    this.multiplayerMatchResult = null;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.stageArrivalNotice = '';
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.notifiedArrivedPlayerIds.clear();
    this.activeCheckpoint = null;
    this.activatedCheckpointIndices.clear();

    this.isEditorImmortality = immortality;
    this.infiniteLives = this.isCheatActive || immortality;

    const initialLives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 1 : 3;
    const topScore = getTopScore();
    this.currentRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.runInitialHighScore = topScore;
    this.isNewHighScore = false;
    this.hasTriggeredNewRecordBanner = false;
    this.lastSavedRank = null;

    this.goalPointsWallet = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = false;
    this.reservePowerUp = null;
    const firstLevel = cloneLevelData(preparedLevels[0]);
    this.stats = {
      score: 0,
      coins: 0,
      world: `1/${preparedLevels.length}`,
      time: firstLevel.timeLimit || 400,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: topScore,
      difficulty: this.difficulty,
      isNewHighScore: false,
      goalPointsWallet: 0,
      isBonusStage: false,
      bonusBlocksRemaining: 0,
      bonusLivesWon: 0,
      reservePowerUp: null,
      wCoinsCollected: 0,
      wCoinsTotal: 0,
    };

    this.isCampaignVictory = false;
    this.isGameOver = false;
    this.isStageClear = false;
    this.isPaused = false;
    this.isGameStarted = true;
    this.endlessStage = 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    this.loadLevel(firstLevel, true, false);
  }

  public isPlayingCustomCampaign(): boolean {
    return this.customCampaignLevels.length > 0;
  }

  public getCustomCampaignProgress(): { index: number; total: number } | null {
    if (this.customCampaignLevels.length === 0) return null;
    return {
      index: this.customCampaignIndex,
      total: this.customCampaignLevels.length,
    };
  }

  public startSingleplayerCampaign(world: number = 1, stage: number = 1) {
    this.customCampaignLevels = [];
    this.customCampaignIndex = 0;
    this.gameMode = 'singleplayer';
    this.singleplayerWorld = Math.max(1, Math.min(SINGLEPLAYER_WORLD_COUNT, Math.floor(world)));
    this.singleplayerStage = Math.max(1, Math.min(SINGLEPLAYER_STAGES_PER_WORLD, Math.floor(stage)));
    this.isCampaignVictory = false;

    this.isEditorImmortality = false;
    this.infiniteLives = this.isCheatActive;

    this.isMultiplayerMatchOver = false;
    this.multiplayerMatchResult = null;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.stageArrivalNotice = '';
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.notifiedArrivedPlayerIds.clear();

    this.activeCheckpoint = null;
    this.activatedCheckpointIndices.clear();

    const initialLives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 1 : 3;
    const topScore = getTopScore();
    this.currentRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.runInitialHighScore = topScore;
    this.isNewHighScore = false;
    this.hasTriggeredNewRecordBanner = false;
    this.lastSavedRank = null;

    this.goalPointsWallet = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = false;
    this.reservePowerUp = null;
    const firstLevel = createSingleplayerLevel(this.singleplayerWorld, this.singleplayerStage);
    this.stats = {
      score: 0,
      coins: 0,
      world: firstLevel.name,
      time: firstLevel.timeLimit,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: topScore,
      difficulty: this.difficulty,
      isNewHighScore: false,
      goalPointsWallet: 0,
      isBonusStage: false,
      bonusBlocksRemaining: 0,
      bonusLivesWon: 0,
      reservePowerUp: null,
      wCoinsCollected: 0,
      wCoinsTotal: 0,
    };

    this.isPaused = false;
    this.isGameStarted = true;
    this.endlessStage = 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    this.loadLevel(firstLevel, true, false);
  }

  public startSmwStage(level: LevelData, resetSession: boolean = false) {
    this.customCampaignLevels = [];
    this.customCampaignIndex = 0;
    this.gameMode = 'smw_world_map';
    this.isCampaignVictory = false;
    this.isEditorImmortality = false;
    this.infiniteLives = this.isCheatActive;

    this.isMultiplayerMatchOver = false;
    this.multiplayerMatchResult = null;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.stageArrivalNotice = '';
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.notifiedArrivedPlayerIds.clear();

    this.activeCheckpoint = null;
    this.activatedCheckpointIndices.clear();

    const initialLives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 1 : 3;
    const topScore = getTopScore();
    if (resetSession || !this.currentRunId || this.isGameOver || this.stats.lives <= 0) {
      this.currentRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      this.runInitialHighScore = topScore;
      this.isNewHighScore = false;
      this.hasTriggeredNewRecordBanner = false;
      this.lastSavedRank = null;
      if (resetSession) {
        this.goalPointsWallet = 0;
        this.onSmwGoalWalletChanged?.(0);
        this.reservePowerUp = null;
      }
      this.pendingBonusStage = false;
      this.isBonusStageActive = false;
      this.stats = {
        score: 0,
        coins: 0,
        world: level.name,
        time: level.timeLimit,
        lives: this.infiniteLives ? 99 : initialLives,
        highScore: topScore,
        difficulty: this.difficulty,
        isNewHighScore: false,
        goalPointsWallet: this.goalPointsWallet,
        isBonusStage: false,
        bonusBlocksRemaining: 0,
        bonusLivesWon: 0,
        reservePowerUp: this.reservePowerUp,
        wCoinsCollected: 0,
        wCoinsTotal: 0,
      };
      this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    }

    this.isPaused = false;
    this.isGameStarted = true;
    this.isGameOver = false;
    this.endlessStage = 0;
    this.marioStarTimer = 0;
    this.resetControls();
    this.loadLevel(level, true, false);
  }

  public getActiveSmwNodeId(): string | null {
    return this.level?.smwNodeId ?? this.bonusReturnLevelMeta?.smwNodeId ?? null;
  }

  public resetControls() {
    this.controls = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      run: false,
      spinJump: false,
      select: false,
      pause: false,
    };
    this.prevControls = { ...this.controls };
  }

  public returnToSmwOverworldState() {
    this.gameMode = 'smw_world_map';
    this.isGameStarted = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.isStageClear = false;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.stageClearDelayTimer = 0;
    this.stageClearTallyDelay = 0;
    this.smwCastleEntryActive = false;
    this.smwCastleEntryTimer = 0;
    this.smwCastleBannerProgress = 0;
    this.smwCastleIrisProgress = 0;
    this.keyholeClearTimer = 0;
    this.keyholeTransitionActive = false;
    this.keyholeTotalTimer = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = false;
    this.bonusStageBlocks = [];
    this.bonusStageLivesWon = 0;
    this.bonusStageFinishDelay = 0;
    this.bonusStageIrisProgress = 0;
    this.bonusStageTimeFrames = 0;
    this.bonusReturnLevelMeta = null;
    this.stats.isBonusStage = false;
    this.stats.bonusBlocksRemaining = 0;
    this.stats.bonusLivesWon = 0;
    this.marioState = 'idle';
    this.marioVx = 0;
    this.marioVy = 0;
    this.resetControls();
  }

  public restartGame() {
    const isCustomRestart = Boolean(
      this.level?.isCustom || this.bonusReturnLevelMeta?.isCustom || this.customSubAreaOrigin
    );
    const activeSmwNodeId = this.level?.smwNodeId ?? this.bonusReturnLevelMeta?.smwNodeId;
    this.customSubAreaOrigin = null;
    if (isCustomRestart && this.customCampaignLevels.length > 0) {
      this.startCustomCampaign(this.customCampaignLevels, this.isEditorImmortality);
      return;
    }
    if (isCustomRestart && this.customLevelTemplate) {
      this.playCustomLevel(this.customLevelTemplate, this.isEditorImmortality);
      return;
    }

    if (this.gameMode === 'smw_world_map' && activeSmwNodeId) {
      this.startSmwStage(createSmwWikiWorldStage(activeSmwNodeId), true);
      return;
    }

    if (this.gameMode === 'singleplayer') {
      this.startSingleplayerCampaign(1, 1);
      return;
    }

    this.isCampaignVictory = false;
    this.isEditorImmortality = false;
    this.infiniteLives = this.isCheatActive;

    this.isMultiplayerMatchOver = false;
    this.multiplayerMatchResult = null;
    this.localStageCleared = false;
    this.waitingForPlayersFinish = false;
    this.waitingPlayersNames = [];
    this.stageArrivalNotice = '';
    this.allPlayersClearedReady = false;
    this.allPlayersClearedCountdown = 0;
    this.notifiedArrivedPlayerIds.clear();

    this.activeCheckpoint = null;
    this.activatedCheckpointIndices.clear();

    const initialLives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 1 : 3;
    const initialTime = this.difficulty === 'easy' ? 500 : this.difficulty === 'hard' ? 300 : 400;
    const topScore = getTopScore();
    this.currentRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.runInitialHighScore = topScore;
    this.isNewHighScore = false;
    this.hasTriggeredNewRecordBanner = false;
    this.lastSavedRank = null;

    this.goalPointsWallet = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = false;
    this.bonusStageBlocks = [];
    this.bonusStageLivesWon = 0;
    this.bonusStageFinishDelay = 0;
    this.bonusStageIrisProgress = 0;
    this.bonusStageTimeFrames = 0;
    this.bonusReturnLevelMeta = null;
    this.reservePowerUp = null;
    this.stats = {
      score: 0,
      coins: 0,
      world: '1-1',
      time: initialTime,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: topScore,
      difficulty: this.difficulty,
      isNewHighScore: false,
      goalPointsWallet: 0,
      isBonusStage: false,
      bonusBlocksRemaining: 0,
      bonusLivesWon: 0,
      reservePowerUp: null,
      wCoinsCollected: 0,
      wCoinsTotal: 0,
    };

    this.isPaused = false;
    this.isGameStarted = true;
    this.endlessStage = 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    this.loadLevel(createWorld1_1(), true, false);
  }

  public exitToMainMenu() {
    this.customLevelTemplate = null;
    this.customSubAreaOrigin = null;
    this.customCampaignLevels = [];
    this.customCampaignIndex = 0;
    this.gameMode = 'classic';
    this.goalPointsWallet = 0;
    this.pendingBonusStage = false;
    this.isBonusStageActive = false;
    this.bonusStageBlocks = [];
    this.bonusStageLivesWon = 0;
    this.bonusStageFinishDelay = 0;
    this.bonusStageIrisProgress = 0;
    this.bonusStageTimeFrames = 0;
    this.bonusReturnLevelMeta = null;
    this.stats.isBonusStage = false;
    this.stats.bonusBlocksRemaining = 0;
    this.stats.bonusLivesWon = 0;
    this.reservePowerUp = null;
    this.stats.reservePowerUp = null;
    this.isCampaignVictory = false;
    this.castleToodleActive = false;
    this.castlePrincessActive = false;
    this.isEditorImmortality = false;
    this.infiniteLives = this.isCheatActive;
    this.isIllegalInstructionBug = false;
    this.illegalInstructionTimer = 0;
    this.isDebugPlacementActive = false;
    this.isPaused = false;
    this.isGameStarted = false;
    this.isGameOver = false;
    this.isStageClear = false;
    this.endlessStage = 0;
    this.marioPower = 'small';
    this.marioStarTimer = 0;
    this.marioState = 'idle';
    this.controls = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      run: false,
      pause: false,
    };
    this.loadLevel(createWorld1_1(), false, false, false);
    this.sound.stopMusic();
  }

  public togglePause() {
    this.isPaused = !this.isPaused;
    this.sound.playPause();
    this.sound.setMusicPaused(this.isPaused);
    if (this.isPaused) {
      this.controls = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        run: false,
        pause: false,
      };
    }
  }

  // --- COLLISION UTILS ---
  private getMarioHeight(): number {
    if (this.marioPower === 'small') return 16;
    if (this.marioState === 'crouching') return 18;
    return 30;
  }

  public getMarioHitbox(): Rect {
    const isCrouching = this.marioPower !== 'small' && this.marioState === 'crouching';
    return {
      x: this.marioX + 2,
      y: isCrouching ? this.marioY + 12 : this.marioY,
      width: 12,
      height: isCrouching ? 18 : this.getMarioHeight(),
    };
  }

  private rectsIntersect(a: Rect, b: Rect): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  private isSolidTile(type: TileType): boolean {
    return (
      type === 'ground' ||
      type === 'brick' ||
      type === 'question' ||
      type === 'question_empty' ||
      type === 'hard_block' ||
      type === 'pipe_top_left' ||
      type === 'pipe_top_right' ||
      type === 'pipe_body_left' ||
      type === 'pipe_body_right' ||
      type === 'pipe_warp_top_left' ||
      type === 'pipe_warp_top_right' ||
      type === 'pipe_horiz_top' ||
      type === 'pipe_horiz_bottom' ||
      type === 'underground_ground' ||
      type === 'underground_brick' ||
      type === 'coral' ||
      type === 'sea_ground' ||
      type === 'bridge' ||
      type === 'castle_stone' ||
      type === 'ghost_floor' ||
      type === 'ghost_brick' ||
      this.isAnySwitchTile(type) ||
      type === 'bonus_block' ||
      (this.getExclamBlockColor(type) !== null &&
        this.isSwitchUnlocked(this.getExclamBlockColor(type)!))
    );
  }

  private getTilesIntersecting(rect: Rect): { tileX: number; tileY: number; tile: BlockTile }[] {
    const list: { tileX: number; tileY: number; tile: BlockTile }[] = [];
    const minTX = Math.floor(rect.x / GameEngine.TILE_SIZE);
    const maxTX = Math.floor((rect.x + rect.width - 0.01) / GameEngine.TILE_SIZE);
    const minTY = Math.floor(rect.y / GameEngine.TILE_SIZE);
    const maxTY = Math.floor((rect.y + rect.height - 0.01) / GameEngine.TILE_SIZE);

    for (let ty = minTY; ty <= maxTY; ty++) {
      if (ty < 0 || ty >= this.level.height) continue;
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (tx < 0 || tx >= this.level.width) continue;
        const tile = this.level.tiles[ty][tx];
        if (tile && (!tile.invisible || tile.bumpOffset !== 0)) {
          list.push({ tileX: tx, tileY: ty, tile });
        }
      }
    }
    return list;
  }

  // --- RENDERING PIPELINE ---
  public render(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;

    // 0. Intermission Screen (Classic NES World & Lives Card)
    if (this.intermissionTimer > 0) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);

      // Render the classic HUD at top
      this.renderInCanvasHUD(ctx);

      ctx.fillStyle = '#ffffff';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      // WORLD 1-1
      ctx.fillText(`WORLD ${this.stats.world}`, GameEngine.NES_WIDTH / 2, 90);
      if (this.level.biomeLabel) {
        ctx.fillStyle = '#fce078';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillText(this.level.biomeLabel, GameEngine.NES_WIDTH / 2, 106);
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffffff';
      }

      // Mario Icon + x + Lives
      const iconX = GameEngine.NES_WIDTH / 2 - 24;
      const iconY = 118;
      ctx.drawImage(this.atlas.marioSmallIdle, iconX, iconY);
      ctx.fillText(`x  ${this.stats.lives}`, iconX + 36, iconY + 12);

      ctx.textAlign = 'left';
      return;
    }

    if (this.isBonusStageActive) {
      this.renderBonusStage(ctx);
      return;
    }

    const camX = this.camera.renderX;

    // 1. Background Fill (Split ocean/sky smoothly at dryFinishStartX on underwater levels)
    if (this.level.theme === 'underwater' && this.level.dryFinishStartX !== undefined) {
      const splitScreenX = Math.round(this.level.dryFinishStartX - camX);
      if (splitScreenX <= 0) {
        ctx.fillStyle = '#5c94fc';
        ctx.fillRect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
      } else if (splitScreenX >= GameEngine.NES_WIDTH) {
        ctx.fillStyle = this.level.bgColor;
        ctx.fillRect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
      } else {
        ctx.fillStyle = this.level.bgColor;
        ctx.fillRect(0, 0, splitScreenX, GameEngine.NES_HEIGHT);
        ctx.fillStyle = '#5c94fc';
        ctx.fillRect(splitScreenX, 0, GameEngine.NES_WIDTH - splitScreenX, GameEngine.NES_HEIGHT);
      }
    } else {
      ctx.fillStyle = this.level.bgColor;
      ctx.fillRect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
    }

    // Apply Screen Shake offset to all world entities and background scenery
    ctx.save();
    if (this.screenShakeOffsetX !== 0 || this.screenShakeOffsetY !== 0) {
      ctx.translate(Math.round(this.screenShakeOffsetX), Math.round(this.screenShakeOffsetY));
    }

    // 2. Background Scenery (Clouds, Hills, Bushes, Seaweed & Water Surface)
    this.renderScenery(ctx);

    // 3. Tilemap & Floating Platforms
    this.renderTiles(ctx);
    this.renderFloatingPlatforms(ctx);

    // 4. Flagpole & Flag & SMW Castle Victory Banner
    this.renderFlagpole(ctx);
    if (
      this.gameMode === 'smw_world_map' &&
      this.smwCastleBannerProgress > 0 &&
      this.level.castleX > 0 &&
      this.level.castleX < 99000
    ) {
      const poleBaseX = Math.round(this.level.castleX + 8 - camX);
      if (poleBaseX >= -24 && poleBaseX <= GameEngine.NES_WIDTH + 24) {
        const roofY = 8 * GameEngine.TILE_SIZE;
        const poleH = Math.round(24 * this.smwCastleBannerProgress);
        const topY = roofY - poleH;
        ctx.fillStyle = '#000000';
        ctx.fillRect(poleBaseX - 1, topY, 3, poleH);
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(poleBaseX, topY, 1, poleH);
        if (poleH >= 8) {
          ctx.fillStyle = '#d82800';
          ctx.fillRect(poleBaseX + 1, topY + 1, 14, 9);
          ctx.fillStyle = '#fce078';
          ctx.fillRect(poleBaseX + 2, topY + 2, 12, 7);
          ctx.fillStyle = '#d82800';
          ctx.fillRect(poleBaseX + 4, topY + 4, 2, 3);
          ctx.fillRect(poleBaseX + 7, topY + 5, 2, 2);
          ctx.fillRect(poleBaseX + 10, topY + 4, 2, 3);
        }
      }
    }

    // 5. Items & Keyholes + Unheld Carryables (R1.19.1GX.5)
    this.renderKeyholes(ctx);
    this.renderItems(ctx);
    this.renderCarryables(ctx, false);

    // 6. Enemies
    this.renderEnemies(ctx);

    // 7. Fireballs
    this.renderFireballs(ctx);

    // 8. Remote Players (Multiplayer by IP)
    this.renderRemotePlayers(ctx);

    // 9. Toodle / Princesa Femboy (Castle Victory Chamber)
    this.renderCastleToodle(ctx);
    this.renderCastlePrincess(ctx);

    // 9b. Unmounted Yoshis (R1.16.1RZ.4)
    this.renderYoshis(ctx);

    // 10. Mario / WazzimaGiygg (or Sonic Debug Placement Cursor)
    this.renderMario(ctx);
    this.renderCarryables(ctx, true);
    if (this.isDebugMode && this.isDebugPlacementActive) {
      this.renderDebugCursor(ctx);
    }

    // 10b. Foreground right pillar of the SMW Goal Gate (Mario passes behind it!)
    this.renderFlagpoleForeground(ctx);

    // 11. Particles & Floating Scores
    this.particleSystem.render(ctx, camX, GameEngine.NES_WIDTH, this.atlas);

    ctx.restore();

    // 12. Castle Dialogue Overlays + In-Canvas Pixel HUD
    this.renderCastleToodleDialogue(ctx);
    this.renderCastlePrincessDialogue(ctx);
    this.renderInCanvasHUD(ctx);

    // 13. SMW Keyhole Secret Exit Transition (Key lock-in + expanding keyhole + keyhole-shaped iris curtain)
    if (this.keyholeTransitionActive) {
      this.renderKeyholeClearTransition(ctx, camX);
    }

    // 13b. SMW Castle Circular Iris-Out Transition (R02.16.PG.4)
    if (this.gameMode === 'smw_world_map' && this.smwCastleIrisProgress > 0) {
      const doorScreenX =
        this.level.castleX > 0 && this.level.castleX < 99000
          ? Math.round(this.level.castleX + 8 - camX)
          : Math.round(this.marioX + 8 - camX);
      const doorScreenY = 12 * GameEngine.TILE_SIZE;
      const maxRadius = 280;
      const radius = Math.max(0, maxRadius * (1 - this.smwCastleIrisProgress));
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.rect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
      if (radius > 0.5) {
        ctx.arc(doorScreenX, doorScreenY, radius, 0, Math.PI * 2, true);
      }
      ctx.fill('evenodd');
      ctx.restore();
    }

    // 13c. Keep closed blackout while waiting for multiplayer teammates immediately after Bonus Stage
    if (this.bonusStageIrisProgress >= 1) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
    }

    // 14. Easter Egg: "ILLEGAL INSTRUCTION" Glitched Screen Effect
    if (this.isIllegalInstructionBug) {
      this.renderIllegalInstructionGlitch(ctx);
    }
  }

  private renderInCanvasHUD(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = '8px "Press Start 2P", monospace';

    // Helper for crisp 1px NES drop-shadow text
    const drawShadowText = (text: string, x: number, y: number, color: string = '#ffffff') => {
      ctx.fillStyle = '#000000';
      ctx.fillText(text, x + 1, y + 1);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    // 1. SCORE COLUMN (X: 16) - In Sonic Debug Mode, Score transforms into live X/Y coordinates!
    const isWazzima = this.playerCharacter === 'wazzima';
    const isFemboy = this.marioPower === 'femboy';
    if (this.isDebugMode) {
      const hexX = Math.max(0, Math.round(this.marioX)).toString(16).toUpperCase().padStart(4, '0');
      const hexY = Math.max(0, Math.round(this.marioY)).toString(16).toUpperCase().padStart(4, '0');
      ctx.font = '5px "Press Start 2P", monospace';
      drawShadowText('COORD DEBUG', 16, 12, '#58f8f8');
      ctx.font = '7px "Press Start 2P", monospace';
      drawShadowText(`${hexX}${hexY}`, 16, 21, '#58f898');
      ctx.font = '5px "Press Start 2P", monospace';
      drawShadowText(`X:${Math.round(this.marioX)} Y:${Math.round(this.marioY)}`, 16, 29, '#fce078');
      ctx.font = '8px "Press Start 2P", monospace';
    } else {
      const charName = isWazzima ? 'WazzimaGiygg' : 'MARIO';
      const charColor = isWazzima ? '#38f838' : '#ffffff';
      if (isWazzima) {
        ctx.font = '5px "Press Start 2P", monospace';
        drawShadowText(charName, 16, 12, charColor);
        ctx.font = '8px "Press Start 2P", monospace';
      } else {
        drawShadowText(charName, 16, 12, charColor);
      }
      drawShadowText(String(this.stats.score).padStart(6, '0'), 16, 21, isFemboy ? '#ff99cc' : '#ffffff');

      if (isFemboy) {
        ctx.font = '5px "Press Start 2P", monospace';
        drawShadowText('LOVE POINTS', 16, 29, '#ff4d94');
        ctx.font = '8px "Press Start 2P", monospace';
      }
    }

    // 2. MULTIPLAYER BADGE (Dynamic player count 2P..16P ON)
    if (this.remotePlayers.size > 0) {
      drawShadowText(`${1 + this.remotePlayers.size}P ON`, 84, 12, '#38f838');
    }

    // CHEAT USE / DEBUG badge if active
    if (this.isCheatActive) {
      const cheatY = this.isDebugMode || isFemboy ? 37 : 29;
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#000000';
      ctx.fillText(this.isDebugMode ? 'DEBUG USE' : 'CHEAT USE', 17, cheatY + 1);
      ctx.fillStyle = this.isDebugMode ? '#58f8f8' : '#ff3333';
      ctx.fillText(this.isDebugMode ? 'DEBUG USE' : 'CHEAT USE', 16, cheatY);
      ctx.font = '8px "Press Start 2P", monospace';
    }

    // 2. COINS DISPLAY (X: 84)
    // Rotating animated golden coin sprite
    const qCoin = this.atlas.itemCoinFrames[Math.floor((Date.now() / 150) % 4)];
    // Coin drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(85, 14, 8, 8);
    ctx.drawImage(qCoin, 84, 13, 8, 8);
    drawShadowText(`x${String(this.stats.coins).padStart(2, '0')}`, 95, 21, '#f8d838');

    // 3. LIVES COUNT (X: 132)
    // Mario icon + x + lives (or ∞ for infinite lives)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(133, 11, 10, 10);
    ctx.drawImage(this.atlas.marioSmallIdle, 132, 10, 10, 10);
    const livesLabel = this.infiniteLives || this.isEditorImmortality || this.stats.lives >= 99 ? 'x∞' : `x${this.stats.lives}`;
    const livesColor = this.stats.lives === 1 ? '#ff4444' : '#ffffff';
    drawShadowText(livesLabel, 144, 19, livesColor);

    // 4. WORLD COLUMN (X: 176)
    drawShadowText('WORLD', 176, 12, '#ffffff');
    drawShadowText(this.stats.world, 180, 21, '#ffffff');

    // 5. TIME REMAINING (X: 218)
    const isLowTime = this.stats.time < 100;
    const timeColor = isLowTime && Math.floor(Date.now() / 250) % 2 === 0 ? '#ff3333' : '#ffffff';
    drawShadowText('TIME', 218, 12, '#ffffff');
    drawShadowText(String(this.stats.time).padStart(3, '0'), 222, 21, timeColor);

    // 6. Active Temporary Starman Invincibility Meter (subtle 8x8 icon + timer bar under Coins column)
    if (this.marioStarTimer > 0 && this.atlas.itemStarFrames.length > 0) {
      const starIcon = this.atlas.itemStarFrames[Math.floor((Date.now() / 70) % this.atlas.itemStarFrames.length)];
      ctx.drawImage(starIcon, 84, 24, 8, 8);
      if (this.marioStarTimer > 10000) {
        ctx.font = '5px "Press Start 2P", monospace';
        drawShadowText('STAR ∞', 95, 30, '#fce078');
      } else {
        const ratio = Math.max(0, Math.min(1, this.marioStarTimer / 600));
        const barW = 30;
        const fillW = Math.max(1, Math.round(barW * ratio));
        ctx.fillStyle = '#000000';
        ctx.fillRect(94, 26, barW + 2, 4);
        ctx.fillStyle = this.marioStarTimer < 120 && Math.floor(this.marioStarTimer / 4) % 2 === 0 ? '#ff4444' : '#fce078';
        ctx.fillRect(95, 27, fillW, 2);
      }
    }

    // 7. SMW Power-Up Reserve Box ("Carteira de Power-UPs" — R1.16.13U.4)
    if (!this.isBonusStageActive) {
      const boxX = 128;
      const boxY = 22;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(boxX, boxY, 20, 20);
      ctx.strokeStyle = this.reservePowerUp ? '#fce078' : '#78716c';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX + 0.5, boxY + 0.5, 19, 19);
      if (this.reservePowerUp) {
        let resSprite: HTMLCanvasElement | null = null;
        if (this.reservePowerUp === 'mushroom') resSprite = this.atlas.itemMushroomSuper;
        else if (this.reservePowerUp === 'fireflower') resSprite = this.atlas.itemFireFlowerFrames[0];
        else if (this.reservePowerUp === 'leaf') resSprite = this.atlas.itemSuperLeaf;
        else if (this.reservePowerUp === 'feather') resSprite = this.atlas.itemFeather;
        else if (this.reservePowerUp === 'femboy') resSprite = this.atlas.itemFemboy;
        if (resSprite) {
          ctx.drawImage(resSprite, boxX + 2, boxY + 2, 16, 16);
        }
      }
    }

    // 8. SMW Goal Points Wallet badge (★XX/100) & 4 Giant W-Coins Counter (R1.16.OV.4)
    ctx.font = '5px "Press Start 2P", monospace';
    if (this.isBonusStageActive) {
      const rem = this.bonusStageBlocks.filter(b => !b.resolved).length;
      drawShadowText(`BONUS ${9 - rem}/9 +${this.bonusStageLivesWon}V`, 146, 30, '#58f898');
    } else {
      drawShadowText(`★${String(this.goalPointsWallet).padStart(2, '0')}/100`, 156, 30, '#fce078');
      if (this.wCoinsTotal > 0) {
        const wColor = this.wCoinsCollected >= 4 ? '#58f898' : '#f8d838';
        drawShadowText(`W:${this.wCoinsCollected}/${this.wCoinsTotal}`, 216, 30, wColor);
      }
    }

    ctx.restore();
  }

  private renderParallaxPeriod(period: number, scrollOffset: number, drawSlice: (x: number, idx: number) => void) {
    const startIdx = Math.floor((scrollOffset - period) / period);
    const endIdx = Math.ceil((scrollOffset + GameEngine.NES_WIDTH + period) / period);
    for (let idx = startIdx; idx <= endIdx; idx++) {
      const screenX = Math.round(idx * period - scrollOffset);
      if (screenX > GameEngine.NES_WIDTH + period || screenX + period < -16) continue;
      drawSlice(screenX, idx);
    }
  }

  private renderOverworldParallax(ctx: CanvasRenderingContext2D, camX: number, clipStartX: number = 0) {
    const timeSec = Date.now() / 1000;
    ctx.save();
    if (clipStartX > 0) {
      ctx.beginPath();
      ctx.rect(clipStartX, 0, Math.max(0, GameEngine.NES_WIDTH - clipStartX), GameEngine.NES_HEIGHT);
      ctx.clip();
    }

    // Layer 0: Subtle horizon sky atmospheric bands
    ctx.fillStyle = '#6ca2ff';
    ctx.fillRect(0, 128, GameEngine.NES_WIDTH, 42);
    ctx.fillStyle = '#84b6ff';
    ctx.fillRect(0, 170, GameEngine.NES_WIDTH, 42);

    // Layer 1a: Distant drifting cirrus clouds (0.14x parallax + gentle wind drift)
    const farCloudScroll = camX * 0.14 + timeSec * 4.5;
    this.renderParallaxPeriod(160, farCloudScroll, (sx, idx) => {
      const cy = 34 + ((Math.abs(idx) * 19) % 34);
      ctx.fillStyle = '#c8e0ff';
      ctx.fillRect(sx + 14, cy + 4, 28, 6);
      ctx.fillRect(sx + 20, cy + 1, 16, 4);
      ctx.fillStyle = '#e8f2ff';
      ctx.fillRect(sx + 16, cy + 3, 22, 4);
    });

    // Layer 1b: Distant mountain range silhouettes (0.18x parallax)
    this.renderParallaxPeriod(240, camX * 0.18, (sx) => {
      // Twin distant peaks
      ctx.fillStyle = '#487ce0';
      ctx.beginPath();
      ctx.moveTo(sx, 208);
      ctx.lineTo(sx + 56, 118);
      ctx.lineTo(sx + 114, 208);
      ctx.lineTo(sx + 172, 132);
      ctx.lineTo(sx + 240, 208);
      ctx.closePath();
      ctx.fill();

      // Subtle sunlit upper ridge highlights
      ctx.fillStyle = '#6294ec';
      ctx.beginPath();
      ctx.moveTo(sx + 56, 118);
      ctx.lineTo(sx + 76, 148);
      ctx.lineTo(sx + 56, 142);
      ctx.lineTo(sx + 38, 150);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sx + 172, 132);
      ctx.lineTo(sx + 190, 158);
      ctx.lineTo(sx + 172, 152);
      ctx.lineTo(sx + 156, 160);
      ctx.closePath();
      ctx.fill();
    });

    // Layer 2: Mid-ground rolling emerald hills & treeline silhouettes (0.40x parallax)
    this.renderParallaxPeriod(192, camX * 0.40, (sx) => {
      ctx.fillStyle = '#2e7e46';
      ctx.beginPath();
      ctx.arc(sx + 48, 212, 46, Math.PI, 0);
      ctx.arc(sx + 136, 214, 54, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = '#3b9854';
      ctx.beginPath();
      ctx.arc(sx + 48, 214, 38, Math.PI, 0);
      ctx.arc(sx + 136, 216, 44, Math.PI, 0);
      ctx.fill();

      // Distant hill ridge rim
      ctx.fillStyle = '#52b868';
      ctx.fillRect(sx + 26, 174, 44, 2);
      ctx.fillRect(sx + 110, 170, 52, 2);
    });

    ctx.restore();
  }

  private renderUndergroundParallax(ctx: CanvasRenderingContext2D, camX: number) {
    // Layer 1: Deep cavern rock silhouettes & ceiling stalactites (0.18x parallax)
    this.renderParallaxPeriod(224, camX * 0.18, (sx, idx) => {
      ctx.fillStyle = '#0c1024';
      ctx.fillRect(sx, 28, 224, 182);

      // Deep stalactite clusters
      ctx.fillStyle = '#141c3c';
      const peaks = [24, 72, 128, 184];
      peaks.forEach((px, pIdx) => {
        const len = 28 + (((Math.abs(idx) + pIdx) * 13) % 26);
        ctx.beginPath();
        ctx.moveTo(sx + px - 14, 28);
        ctx.lineTo(sx + px, 28 + len);
        ctx.lineTo(sx + px + 14, 28);
        ctx.closePath();
        ctx.fill();
      });

      // Deep stalagmites
      ctx.beginPath();
      ctx.moveTo(sx + 40, 212);
      ctx.lineTo(sx + 64, 152);
      ctx.lineTo(sx + 92, 212);
      ctx.moveTo(sx + 148, 212);
      ctx.lineTo(sx + 178, 144);
      ctx.lineTo(sx + 208, 212);
      ctx.fill();
    });

    // Layer 2: Mid-ground stone arches & faint glowing crystals (0.42x parallax)
    this.renderParallaxPeriod(192, camX * 0.42, (sx, idx) => {
      ctx.fillStyle = '#182448';
      ctx.fillRect(sx + 18, 36, 18, 174);
      ctx.fillRect(sx + 122, 36, 14, 174);
      ctx.fillStyle = '#1f2e58';
      ctx.fillRect(sx + 21, 36, 4, 174);
      ctx.fillRect(sx + 125, 36, 3, 174);

      // Subtle glowing cavern crystal veins
      const glowPhase = Math.floor(Date.now() / 420 + idx) % 2 === 0;
      ctx.fillStyle = glowPhase ? '#287898' : '#206080';
      ctx.fillRect(sx + 24, 88, 4, 8);
      ctx.fillRect(sx + 30, 94, 3, 5);
      ctx.fillRect(sx + 128, 122, 4, 9);
      ctx.fillStyle = '#58b8d8';
      ctx.fillRect(sx + 25, 89, 1, 3);
      ctx.fillRect(sx + 129, 123, 1, 3);
    });
  }

  private renderUnderwaterParallax(ctx: CanvasRenderingContext2D, camX: number, waterEndScreenX: number) {
    if (waterEndScreenX <= 0) return;
    const timeSec = Date.now() / 1000;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, waterEndScreenX, GameEngine.NES_HEIGHT);
    ctx.clip();

    // Layer 1a: Shimmering diagonal surface sunbeams (0.12x parallax)
    this.renderParallaxPeriod(144, camX * 0.12, (sx, idx) => {
      const sway = Math.sin(timeSec * 1.4 + idx) * 6;
      ctx.fillStyle = 'rgba(130, 215, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(sx + 20, 26);
      ctx.lineTo(sx + 52, 26);
      ctx.lineTo(sx + 84 + sway, 208);
      ctx.lineTo(sx + 38 + sway, 208);
      ctx.closePath();
      ctx.fill();
    });

    // Layer 1b: Distant deep-sea trench silhouettes (0.20x parallax)
    this.renderParallaxPeriod(240, camX * 0.20, (sx) => {
      ctx.fillStyle = '#0e3694';
      ctx.beginPath();
      ctx.moveTo(sx, 208);
      ctx.lineTo(sx + 36, 148);
      ctx.lineTo(sx + 92, 166);
      ctx.lineTo(sx + 148, 128);
      ctx.lineTo(sx + 204, 162);
      ctx.lineTo(sx + 240, 208);
      ctx.closePath();
      ctx.fill();
    });

    // Layer 2: Mid-ground reef silhouettes & rising parallax bubbles (0.42x parallax)
    this.renderParallaxPeriod(192, camX * 0.42, (sx, idx) => {
      ctx.fillStyle = '#1850b8';
      ctx.beginPath();
      ctx.arc(sx + 44, 208, 30, Math.PI, 0);
      ctx.arc(sx + 132, 208, 24, Math.PI, 0);
      ctx.fill();

      // Coral branching silhouette
      ctx.fillRect(sx + 90, 168, 6, 40);
      ctx.fillRect(sx + 82, 176, 8, 5);
      ctx.fillRect(sx + 96, 172, 8, 5);

      // Gentle ambient background bubble
      const bubbleY = 200 - (((timeSec * 18 + Math.abs(idx) * 47) % 156));
      ctx.fillStyle = 'rgba(184, 244, 255, 0.35)';
      ctx.fillRect(Math.round(sx + 62 + Math.sin(timeSec * 2 + idx) * 3), Math.round(bubbleY), 3, 3);
    });

    ctx.restore();
  }

  private renderGhostHouseParallax(ctx: CanvasRenderingContext2D, camX: number) {
    // Layer 1: Distant moonlit haunted towers & attic rafters (0.16x parallax)
    this.renderParallaxPeriod(256, camX * 0.16, (sx) => {
      ctx.fillStyle = '#120822';
      ctx.fillRect(sx + 24, 58, 40, 152);
      ctx.beginPath();
      ctx.moveTo(sx + 18, 58);
      ctx.lineTo(sx + 44, 26);
      ctx.lineTo(sx + 70, 58);
      ctx.closePath();
      ctx.fill();

      ctx.fillRect(sx + 156, 76, 52, 134);
      ctx.beginPath();
      ctx.moveTo(sx + 150, 76);
      ctx.lineTo(sx + 182, 44);
      ctx.lineTo(sx + 214, 76);
      ctx.closePath();
      ctx.fill();

      // Distant faint tower window
      ctx.fillStyle = '#2a2454';
      ctx.fillRect(sx + 40, 68, 8, 14);
      ctx.fillRect(sx + 178, 88, 8, 14);
    });

    // Layer 2: Mid-ground gothic hallway pillars & archways (0.42x parallax)
    this.renderParallaxPeriod(160, camX * 0.42, (sx) => {
      ctx.fillStyle = '#1d1032';
      ctx.fillRect(sx + 12, 24, 16, 186);
      ctx.fillRect(sx + 104, 24, 16, 186);
      // Gothic pointed arch connecting pillars
      ctx.fillRect(sx + 28, 24, 76, 12);
      ctx.fillStyle = '#2a1848';
      ctx.fillRect(sx + 14, 24, 3, 186);
      ctx.fillRect(sx + 106, 24, 3, 186);
      // Wainscoting lower wall trim
      ctx.fillStyle = '#22133a';
      ctx.fillRect(sx, 174, 160, 36);
      ctx.fillStyle = '#36205a';
      ctx.fillRect(sx, 174, 160, 2);
    });
  }

  private renderCastleParallax(ctx: CanvasRenderingContext2D, camX: number) {
    const flicker = Math.floor(Date.now() / 120) % 2;

    // Layer 0: Subtle pulsing magma glow near bottom abyss
    ctx.fillStyle = flicker === 0 ? 'rgba(180, 36, 0, 0.14)' : 'rgba(210, 54, 0, 0.18)';
    ctx.fillRect(0, 178, GameEngine.NES_WIDTH, 62);

    // Layer 1: Distant fortress towers & battlements (0.18x parallax)
    this.renderParallaxPeriod(240, camX * 0.18, (sx) => {
      ctx.fillStyle = '#16090c';
      ctx.fillRect(sx + 18, 66, 48, 144);
      ctx.fillRect(sx + 18, 58, 10, 8);
      ctx.fillRect(sx + 37, 58, 10, 8);
      ctx.fillRect(sx + 56, 58, 10, 8);

      ctx.fillRect(sx + 132, 84, 60, 126);
      ctx.fillRect(sx + 132, 76, 12, 8);
      ctx.fillRect(sx + 156, 76, 12, 8);
      ctx.fillRect(sx + 180, 76, 12, 8);

      // Slit castle windows glowing warmly
      ctx.fillStyle = '#5c1810';
      ctx.fillRect(sx + 39, 82, 6, 14);
      ctx.fillRect(sx + 159, 102, 6, 14);
    });

    // Layer 2: Mid-ground stone arches, chains & flickering dungeon torches (0.44x parallax)
    this.renderParallaxPeriod(176, camX * 0.44, (sx) => {
      // Stone columns
      ctx.fillStyle = '#24161a';
      ctx.fillRect(sx + 16, 24, 16, 186);
      ctx.fillRect(sx + 112, 24, 16, 186);
      ctx.fillStyle = '#322026';
      ctx.fillRect(sx + 18, 24, 3, 186);
      ctx.fillRect(sx + 114, 24, 3, 186);

      // Hanging chain silhouette
      ctx.fillStyle = '#3c2a30';
      for (let cy = 26; cy < 72; cy += 6) {
        ctx.fillRect(sx + 72, cy, 3, 4);
      }

      // Dungeon wall torch with warm glow
      ctx.fillStyle = 'rgba(248, 152, 40, 0.14)';
      ctx.fillRect(sx + 62, 88, 22, 22);
      ctx.fillStyle = '#4a3228';
      ctx.fillRect(sx + 71, 100, 4, 10);
      ctx.fillStyle = '#f87818';
      ctx.fillRect(sx + 70, 95 + flicker, 6, 5);
      ctx.fillStyle = '#fce068';
      ctx.fillRect(sx + 72, 96 - flicker, 2, 3);
    });
  }

  private renderBonusBackdrop(ctx: CanvasRenderingContext2D, camX: number = 0) {
    // SMW Indigo Bonus Room & Switch Palace Backdrop with diamond checker pattern
    ctx.fillStyle = this.level?.bgColor || '#0c1230';
    ctx.fillRect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
    const parallaxScroll = camX * 0.25;
    this.renderParallaxPeriod(32, parallaxScroll, (sx) => {
      for (let rowIdx = 0, y = 32; y < 208; rowIdx++, y += 24) {
        const dx = sx + (rowIdx % 2 === 1 ? 16 : 0);
        ctx.fillStyle = 'rgba(48, 84, 176, 0.24)';
        ctx.fillRect(dx + 6, y + 2, 4, 4);
        ctx.fillRect(dx + 2, y + 6, 12, 4);
        ctx.fillRect(dx + 6, y + 10, 4, 4);
        ctx.fillStyle = 'rgba(92, 136, 232, 0.12)';
        ctx.fillRect(dx + 6, y + 6, 4, 4);
      }
    });
  }

  private renderScenery(ctx: CanvasRenderingContext2D) {
    const camX = this.camera.renderX;
    if (this.level.useBonusBackdrop || this.level.smwNodeId?.startsWith('wiki-switch-')) {
      this.renderBonusBackdrop(ctx, camX);
      return;
    }
    if (this.level.theme === 'underwater') {
      const waterEndScreenX =
        this.level.dryFinishStartX !== undefined
          ? Math.min(GameEngine.NES_WIDTH, Math.round(this.level.dryFinishStartX - camX))
          : GameEngine.NES_WIDTH;

      // Deep ocean parallax layers clipped to underwater span + sky parallax on dry finale
      this.renderUnderwaterParallax(ctx, camX, waterEndScreenX);
      if (waterEndScreenX < GameEngine.NES_WIDTH) {
        this.renderOverworldParallax(ctx, camX, Math.max(0, waterEndScreenX));
      }

      if (waterEndScreenX > 0) {
        // Animated shimmering top water wave line
        const phase = Math.floor(Date.now() / 160);
        ctx.fillStyle = '#3898ff';
        ctx.fillRect(0, 0, waterEndScreenX, 26);
        for (let wx = 0; wx < waterEndScreenX; wx += 8) {
          const offset = ((wx / 8 + phase) % 2 === 0) ? 0 : 2;
          ctx.fillStyle = '#74d8ff';
          ctx.fillRect(wx, 24 + offset, 6, 2);
          ctx.fillStyle = '#b8f4ff';
          ctx.fillRect(wx + 1, 24 + offset, 3, 1);
        }
      }

      this.sceneries.forEach(s => {
        const sx = Math.round(s.x - camX);
        if (sx < -80 || sx > GameEngine.NES_WIDTH + 80) return;

        if (s.type === 'seaweed_tall') {
          this.drawSeaweed(ctx, sx, s.y, 44);
        } else if (s.type === 'seaweed_short') {
          this.drawSeaweed(ctx, sx, s.y, 26);
        } else if (s.type === 'cloud_med') {
          this.drawCloud(ctx, Math.round(s.x - camX * 0.65), s.y, 32);
        } else if (s.type === 'bush_small') {
          this.drawBush(ctx, sx, s.y, 32);
        }
      });
      return;
    }

    if (this.level.theme === 'underground') {
      this.renderUndergroundParallax(ctx, camX);
      return;
    }

    if (this.level.theme === 'castle') {
      this.renderCastleParallax(ctx, camX);
      return;
    }

    if (this.level.theme === 'ghost_house') {
      this.renderGhostHouseParallax(ctx, camX);
      const flicker = Math.floor(Date.now() / 140) % 2;
      const mistShift = Math.sin(Date.now() / 900) * 6;
      this.sceneries.forEach(s => {
        const parallaxFactor =
          s.type === 'ghost_window' || s.type === 'ghost_portrait' ? 0.78 : 0.9;
        const sx = Math.round(s.x - camX * parallaxFactor);
        if (sx < -80 || sx > GameEngine.NES_WIDTH + 80) return;

        if (s.type === 'ghost_window') {
          // Moonlit Gothic Arched Window
          ctx.fillStyle = '#24143c';
          ctx.fillRect(sx - 2, s.y + 8, 28, 38);
          ctx.beginPath();
          ctx.arc(sx + 12, s.y + 10, 14, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#1f2858';
          ctx.fillRect(sx + 1, s.y + 10, 22, 33);
          ctx.beginPath();
          ctx.arc(sx + 12, s.y + 10, 11, Math.PI, 0);
          ctx.fill();
          // Pale moon glow
          ctx.fillStyle = '#c8d4ff';
          ctx.beginPath();
          ctx.arc(sx + 15, s.y + 12, 4, 0, Math.PI * 2);
          ctx.fill();
          // Window mullions
          ctx.fillStyle = '#140822';
          ctx.fillRect(sx + 11, s.y, 2, 44);
          ctx.fillRect(sx + 1, s.y + 24, 22, 2);
        } else if (s.type === 'ghost_chandelier') {
          // Hanging Candle Chandelier
          ctx.fillStyle = '#3c2a58';
          ctx.fillRect(sx + 10, s.y, 2, 10);
          ctx.fillRect(sx + 2, s.y + 10, 18, 3);
          ctx.fillRect(sx + 2, s.y + 6, 2, 5);
          ctx.fillRect(sx + 10, s.y + 4, 2, 7);
          ctx.fillRect(sx + 18, s.y + 6, 2, 5);
          // Flickering candle flames
          ctx.fillStyle = '#f8d850';
          ctx.fillRect(sx + 2, s.y + 3 + flicker, 2, 3);
          ctx.fillRect(sx + 10, s.y + 1 + (1 - flicker), 2, 3);
          ctx.fillRect(sx + 18, s.y + 3 + flicker, 2, 3);
          ctx.fillStyle = 'rgba(248, 216, 80, 0.14)';
          ctx.fillRect(sx - 2, s.y, 26, 16);
        } else if (s.type === 'ghost_portrait') {
          // Haunted Framed Painting
          ctx.fillStyle = '#4a3260';
          ctx.fillRect(sx, s.y, 20, 24);
          ctx.fillStyle = '#1c102e';
          ctx.fillRect(sx + 2, s.y + 2, 16, 20);
          ctx.fillStyle = '#7868a0';
          ctx.fillRect(sx + 6, s.y + 6, 8, 8);
          ctx.fillStyle = '#f888b8';
          ctx.fillRect(sx + 8, s.y + 9, 1, 1);
          ctx.fillRect(sx + 11, s.y + 9, 1, 1);
        } else if (s.type === 'ghost_mist') {
          ctx.fillStyle = 'rgba(130, 88, 190, 0.18)';
          ctx.fillRect(Math.round(sx + mistShift), s.y, 44, 12);
          ctx.fillRect(Math.round(sx + 10 + mistShift), s.y - 4, 26, 6);
        }
      });
      return;
    }

    if (this.level.theme !== 'overworld') return;

    this.renderOverworldParallax(ctx, camX);

    // Clouds scroll at 0.58x, midground hills at 0.78x, foreground bushes at 1.0x
    this.sceneries.forEach(s => {
      if (s.type === 'cloud_med' || s.type === 'cloud_large') {
        const sx = Math.round(s.x - camX * 0.58);
        if (sx < -80 || sx > GameEngine.NES_WIDTH + 80) return;
        this.drawCloud(ctx, sx, s.y, s.type === 'cloud_large' ? 48 : 32);
      } else if (s.type === 'hill_large' || s.type === 'hill_small') {
        const sx = Math.round(s.x - camX * 0.78);
        if (sx < -80 || sx > GameEngine.NES_WIDTH + 80) return;
        this.drawHill(ctx, sx, s.y, s.type === 'hill_large' ? 48 : 32, s.type === 'hill_large' ? 35 : 20);
      } else {
        const sx = Math.round(s.x - camX);
        if (sx < -80 || sx > GameEngine.NES_WIDTH + 80) return;
        if (s.type === 'bush_large') {
          this.drawBush(ctx, sx, s.y, 48);
        } else if (s.type === 'bush_small') {
          this.drawBush(ctx, sx, s.y, 32);
        }
      }
    });
  }

  private drawSeaweed(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
    const sway = Math.floor(Date.now() / 320);
    for (let seg = 0; seg < h; seg += 6) {
      const dx = ((seg / 6 + sway) % 2 === 0) ? 0 : 2;
      ctx.fillStyle = '#008858';
      ctx.fillRect(x + dx, y - seg - 6, 6, 6);
      ctx.fillStyle = '#20c888';
      ctx.fillRect(x + dx + 1, y - seg - 5, 3, 4);
    }
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
    ctx.fillStyle = NES_COLORS.CLOUD_WHITE;
    ctx.beginPath();
    ctx.arc(x + 12, y + 10, 8, 0, Math.PI * 2);
    ctx.arc(x + w / 2, y + 6, 12, 0, Math.PI * 2);
    ctx.arc(x + w - 12, y + 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 4, y + 8, w - 8, 8);
  }

  private drawHill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = NES_COLORS.HILL_GREEN;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w / 2, y - h);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
    // Hill spots
    ctx.fillStyle = NES_COLORS.HILL_SPOTS;
    ctx.fillRect(x + w / 2 - 3, y - h + 10, 6, 2);
    ctx.fillRect(x + w / 2 - 8, y - h + 20, 4, 2);
    ctx.fillRect(x + w / 2 + 4, y - h + 22, 4, 2);
  }

  private drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
    ctx.fillStyle = NES_COLORS.HILL_GREEN;
    ctx.beginPath();
    ctx.arc(x + 8, y - 6, 8, 0, Math.PI * 2);
    ctx.arc(x + w / 2, y - 10, 10, 0, Math.PI * 2);
    ctx.arc(x + w - 8, y - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x, y - 6, w, 6);
  }

  private renderTiles(ctx: CanvasRenderingContext2D) {
    const camX = this.camera.renderX;
    const startTX = Math.max(0, Math.floor(camX / GameEngine.TILE_SIZE));
    const endTX = Math.min(this.level.width - 1, Math.ceil((camX + GameEngine.NES_WIDTH) / GameEngine.TILE_SIZE));

    const qFrame = Math.floor((Date.now() / 150) % 4);

    for (let ty = 0; ty < this.level.height; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const block = this.level.tiles[ty][tx];
        if (!block || (block.invisible && block.bumpOffset === 0)) continue;

        const screenX = tx * GameEngine.TILE_SIZE - camX;
        const screenY = Math.round(ty * GameEngine.TILE_SIZE + block.bumpOffset);

        switch (block.type) {
          case 'ground':
            ctx.drawImage(this.atlas.tileGround, screenX, screenY);
            break;
          case 'underground_ground':
            ctx.drawImage(this.atlas.tileGroundUnderground, screenX, screenY);
            break;
          case 'brick': {
            const isTempPSwitchBrick =
              this.pSwitchBlueTimer > 0 &&
              this.pSwitchBlueTimer < 120 &&
              this.pSwitchTransformedBlocks.some(b => b.tx === tx && b.ty === ty);
            if (isTempPSwitchBrick && Math.floor(this.pSwitchBlueTimer / 6) % 2 === 0) {
              ctx.save();
              ctx.globalAlpha = 0.45;
              ctx.drawImage(this.atlas.tileBrick, screenX, screenY);
              ctx.restore();
            } else {
              ctx.drawImage(this.atlas.tileBrick, screenX, screenY);
            }
            break;
          }
          case 'underground_brick':
            ctx.drawImage(this.atlas.tileBrickUnderground, screenX, screenY);
            break;
          case 'coral':
            ctx.drawImage(this.atlas.tileCoral, screenX, screenY);
            break;
          case 'sea_ground':
            ctx.drawImage(this.atlas.tileSeaGround, screenX, screenY);
            break;
          case 'ghost_floor':
            ctx.drawImage(this.atlas.tileGhostFloor, screenX, screenY);
            break;
          case 'ghost_brick':
            ctx.drawImage(this.atlas.tileGhostBrick, screenX, screenY);
            break;
          case 'question':
            ctx.drawImage(this.atlas.tileQuestionFrames[qFrame], screenX, screenY);
            break;
          case 'question_empty':
            ctx.drawImage(this.atlas.tileQuestionEmpty, screenX, screenY);
            break;
          case 'exclam_yellow':
            ctx.drawImage(
              this.yellowSwitchUnlocked
                ? this.atlas.tileExclamYellowActive
                : this.atlas.tileExclamYellowLocked,
              screenX,
              screenY
            );
            break;
          case 'exclam_green':
            ctx.drawImage(
              this.greenSwitchUnlocked
                ? this.atlas.tileExclamGreenActive
                : this.atlas.tileExclamGreenLocked,
              screenX,
              screenY
            );
            break;
          case 'exclam_red':
            ctx.drawImage(
              this.redSwitchUnlocked
                ? this.atlas.tileExclamRedActive
                : this.atlas.tileExclamRedLocked,
              screenX,
              screenY
            );
            break;
          case 'exclam_pink':
            ctx.drawImage(
              this.pinkSwitchUnlocked
                ? this.atlas.tileExclamPinkActive
                : this.atlas.tileExclamPinkLocked,
              screenX,
              screenY
            );
            break;
          case 'exclam_blue':
            ctx.drawImage(
              this.blueSwitchUnlocked
                ? this.atlas.tileExclamBlueActive
                : this.atlas.tileExclamBlueLocked,
              screenX,
              screenY
            );
            break;
          case 'yellow_switch':
            ctx.drawImage(this.atlas.tileYellowSwitch, screenX, screenY);
            break;
          case 'yellow_switch_pressed':
            ctx.drawImage(this.atlas.tileYellowSwitchPressed, screenX, screenY);
            break;
          case 'green_switch':
            ctx.drawImage(this.atlas.tileGreenSwitch, screenX, screenY);
            break;
          case 'green_switch_pressed':
            ctx.drawImage(this.atlas.tileGreenSwitchPressed, screenX, screenY);
            break;
          case 'red_switch':
            ctx.drawImage(this.atlas.tileRedSwitch, screenX, screenY);
            break;
          case 'red_switch_pressed':
            ctx.drawImage(this.atlas.tileRedSwitchPressed, screenX, screenY);
            break;
          case 'pink_switch':
            ctx.drawImage(this.atlas.tilePinkSwitch, screenX, screenY);
            break;
          case 'pink_switch_pressed':
            ctx.drawImage(this.atlas.tilePinkSwitchPressed, screenX, screenY);
            break;
          case 'blue_switch':
            ctx.drawImage(this.atlas.tileBlueSwitch, screenX, screenY);
            break;
          case 'blue_switch_pressed':
            ctx.drawImage(this.atlas.tileBlueSwitchPressed, screenX, screenY);
            break;
          case 'hard_block':
            ctx.drawImage(this.atlas.tileHardBlock, screenX, screenY);
            break;
          case 'pipe_top_left':
            ctx.drawImage(this.atlas.pipeTopLeft, screenX, screenY);
            break;
          case 'pipe_warp_top_left':
            ctx.drawImage(this.atlas.pipeTopLeft, screenX, screenY);
            if (this.level.isCustom && this.keyCavePipeLipKeys.has(`${tx},${ty}`)) {
              ctx.drawImage(this.atlas.itemKey, screenX + 11, screenY + 3, 10, 10);
            }
            break;
          case 'pipe_top_right':
          case 'pipe_warp_top_right':
            ctx.drawImage(this.atlas.pipeTopRight, screenX, screenY);
            break;
          case 'pipe_body_left':
            ctx.drawImage(this.atlas.pipeBodyLeft, screenX, screenY);
            break;
          case 'pipe_body_right':
            ctx.drawImage(this.atlas.pipeBodyRight, screenX, screenY);
            break;
          case 'castle_brick':
          case 'castle_stone':
            ctx.drawImage(this.atlas.castleBrick, screenX, screenY);
            break;
          case 'castle_door':
            ctx.drawImage(this.atlas.castleDoor, screenX, screenY);
            break;
          case 'castle_crenel':
            ctx.drawImage(this.atlas.castleBrick, screenX, screenY);
            break;
          case 'pole':
            ctx.drawImage(this.atlas.flagPoleBody, screenX, screenY);
            break;
          case 'pole_top':
            ctx.drawImage(this.atlas.flagPoleTop, screenX, screenY);
            break;
          case 'lava': {
            const lavaFrame = Math.floor((Date.now() / 220) % 2);
            ctx.drawImage(this.atlas.tileLavaFrames[lavaFrame], screenX, screenY);
            break;
          }
          case 'bridge':
            ctx.drawImage(this.atlas.tileBridge, screenX, screenY);
            break;
          case 'axe': {
            const axeFrame = Math.floor((Date.now() / 160) % 2);
            ctx.drawImage(this.atlas.tileAxeFrames[axeFrame], screenX, screenY);
            break;
          }
        }
      }
    }
  }

  private renderFloatingPlatforms(ctx: CanvasRenderingContext2D) {
    if (this.floatingPlatforms.length === 0) return;
    const camX = this.camera.renderX;
    const pulse = (Math.sin(Date.now() / 180) + 1) * 0.5;

    for (const plat of this.floatingPlatforms) {
      const sx = Math.round(plat.x - camX);
      const sy = Math.round(plat.y);
      if (sx + plat.width < -16 || sx > GameEngine.NES_WIDTH + 16) continue;

      // Spectral purple aura beneath platform
      ctx.fillStyle = `rgba(168, 120, 255, ${(0.18 + pulse * 0.14).toFixed(2)})`;
      ctx.fillRect(sx + 2, sy + plat.height, plat.width - 4, 4);
      ctx.fillRect(sx + 6, sy + plat.height + 4, plat.width - 12, 2);

      // Dark wood/stone haunted platform body
      ctx.fillStyle = '#180c28';
      ctx.fillRect(sx, sy, plat.width, plat.height);
      ctx.fillStyle = '#483068';
      ctx.fillRect(sx + 1, sy + 1, plat.width - 2, plat.height - 2);

      // Top plank highlight
      ctx.fillStyle = '#9070c8';
      ctx.fillRect(sx + 1, sy + 1, plat.width - 2, 2);

      // Plank seams & glowing rivets
      ctx.fillStyle = '#241438';
      for (let px = 12; px < plat.width - 4; px += 12) {
        ctx.fillRect(sx + px, sy + 1, 1, plat.height - 2);
      }
      ctx.fillStyle = '#e8c8ff';
      ctx.fillRect(sx + 3, sy + 4, 2, 2);
      ctx.fillRect(sx + plat.width - 5, sy + 4, 2, 2);
    }
  }

  private getGoalFrontPostGroundY(): number {
    const T = GameEngine.TILE_SIZE;
    const frontCenterTx = Math.floor((this.level.flagX + 28) / T);
    for (let ty = 12; ty < this.level.height; ty++) {
      const tile = this.level.tiles[ty]?.[frontCenterTx];
      if (tile && tile.type !== 'lava' && this.isSolidTile(tile.type)) {
        return ty * T;
      }
    }
    return 13 * T;
  }

  private renderFlagpole(ctx: CanvasRenderingContext2D) {
    if (!this.hasGoalPointsPost()) return;
    const poleScreenX = Math.round(this.level.flagX - this.camera.renderX);
    if (poleScreenX < -44 || poleScreenX > GameEngine.NES_WIDTH + 44) return;

    const T = GameEngine.TILE_SIZE;

    // Back pillar pedestal collar resting on its base block (row 12 = y:192)
    ctx.fillStyle = '#181828';
    ctx.fillRect(poleScreenX + 2, 12 * T - 5, 12, 5);
    ctx.fillStyle = '#8494b0';
    ctx.fillRect(poleScreenX + 3, 12 * T - 4, 10, 1);
    ctx.fillStyle = '#4e5c78';
    ctx.fillRect(poleScreenX + 3, 12 * T - 3, 10, 2);
    ctx.fillStyle = '#f8d838';
    ctx.fillRect(poleScreenX + 4, 12 * T - 4, 2, 1);

    // 2.5D angled top crossbeam arch connecting back cap (x+8, y:39) to front cap (x+28, y:45)
    const archStartX = poleScreenX + 9;
    const archStartY = 2 * T + 7; // 39
    const archSteps = 20;
    for (let i = 0; i <= archSteps; i++) {
      const px = archStartX + i;
      const py = archStartY + Math.round((i / archSteps) * 6);
      // Crisp 1px top & bottom border
      ctx.fillStyle = '#181828';
      ctx.fillRect(px, py - 1, 1, 7);
      // Silver-white beveled arch bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, py, 1, 1);
      ctx.fillStyle = '#dce4f2';
      ctx.fillRect(px, py + 1, 1, 2);
      ctx.fillStyle = '#647490';
      ctx.fillRect(px, py + 3, 1, 2);
    }

    // Centered SMW Golden Goal Crest / Checkered Header Plaque on top arch
    const crestX = poleScreenX + 14;
    const crestY = 2 * T + 5;
    ctx.fillStyle = '#181828';
    ctx.fillRect(crestX, crestY, 10, 9);
    ctx.fillStyle = '#f8d838';
    ctx.fillRect(crestX + 1, crestY + 1, 8, 7);
    ctx.fillStyle = '#182444';
    ctx.fillRect(crestX + 2, crestY + 2, 6, 5);
    // Checkered diamond/star emblem inside plaque
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(crestX + 4, crestY + 2, 2, 5);
    ctx.fillRect(crestX + 2, crestY + 4, 6, 1);
    ctx.fillStyle = '#fce078';
    ctx.fillRect(crestX + 4, crestY + 4, 2, 1);

    // Moving SMW Goal Tape (checkered white & gold ribbon spanning between both pillars)
    const tapeY = Math.round(this.goalTapeY);
    if (!this.goalTapeCut) {
      const shimmerPhase = Math.floor(Date.now() / 120) % 4;
      // Back slider ring on left pillar
      ctx.fillStyle = '#181828';
      ctx.fillRect(poleScreenX + 4, tapeY - 1, 7, 6);
      ctx.fillStyle = '#f8d038';
      ctx.fillRect(poleScreenX + 5, tapeY, 5, 4);

      // Diagonal 2.5D ribbon connecting back slider (x+10, tapeY) to front slider (x+25, tapeY+3)
      const tapeSpan = 16;
      for (let i = 0; i < tapeSpan; i++) {
        const rx = poleScreenX + 10 + i;
        const ry = tapeY + Math.round((i / tapeSpan) * 3);
        ctx.fillStyle = '#181828';
        ctx.fillRect(rx, ry - 1, 1, 6);
        const isLightSeg = ((i + shimmerPhase) >> 1) % 2 === 0;
        ctx.fillStyle = isLightSeg ? '#ffffff' : '#fce078';
        ctx.fillRect(rx, ry, 1, 2);
        ctx.fillStyle = isLightSeg ? '#dce4f2' : '#e8a820';
        ctx.fillRect(rx, ry + 2, 1, 2);
      }
    } else {
      // Subtle cut ribbon stub remaining on back slider clip
      ctx.fillStyle = '#181828';
      ctx.fillRect(poleScreenX + 4, tapeY - 1, 7, 5);
      ctx.fillStyle = '#f8d038';
      ctx.fillRect(poleScreenX + 5, tapeY, 5, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(poleScreenX + 10, tapeY, 3, 2);
    }
  }

  private renderFlagpoleForeground(ctx: CanvasRenderingContext2D) {
    if (!this.hasGoalPointsPost()) return;
    const poleScreenX = Math.round(this.level.flagX - this.camera.renderX);
    if (poleScreenX < -44 || poleScreenX > GameEngine.NES_WIDTH + 44) return;

    const T = GameEngine.TILE_SIZE;
    const frontPostX = poleScreenX + 20;
    const frontCapY = 2 * T + 6; // 38 (6px lower than back cap for 2.5D perspective)
    const shaftTopY = frontCapY + T; // 54
    const groundY = this.getGoalFrontPostGroundY();
    const shaftBottomY = Math.max(shaftTopY, groundY - 5);

    // Front cylindrical pillar shaft extending cleanly down to ground pedestal
    for (let y = shaftTopY; y < shaftBottomY; y += T) {
      const remaining = shaftBottomY - y;
      if (remaining >= T) {
        ctx.drawImage(this.atlas.flagPoleBody, frontPostX, y);
      } else {
        ctx.drawImage(this.atlas.flagPoleBody, 0, 0, T, remaining, frontPostX, y, T, remaining);
      }
    }

    // Front dome finial cap
    ctx.drawImage(this.atlas.flagPoleTop, frontPostX, frontCapY);

    // Front slider ring on tape height
    const tapeY = Math.round(this.goalTapeY) + 3;
    if (tapeY >= shaftTopY && tapeY <= shaftBottomY - 4) {
      ctx.fillStyle = '#181828';
      ctx.fillRect(frontPostX + 4, tapeY - 1, 8, 6);
      ctx.fillStyle = '#f8d038';
      ctx.fillRect(frontPostX + 5, tapeY, 6, 4);
      ctx.fillStyle = '#fff8c8';
      ctx.fillRect(frontPostX + 6, tapeY + 1, 2, 2);
    }

    // Solid stepped stone & iron pedestal base resting cleanly on groundY (no floating pillar)
    ctx.fillStyle = '#181828';
    ctx.fillRect(frontPostX + 2, groundY - 6, 12, 6);
    ctx.fillRect(frontPostX + 1, groundY - 4, 14, 4);
    ctx.fillStyle = '#dce4f2';
    ctx.fillRect(frontPostX + 3, groundY - 5, 10, 1);
    ctx.fillStyle = '#8494b0';
    ctx.fillRect(frontPostX + 2, groundY - 3, 12, 1);
    ctx.fillStyle = '#4e5c78';
    ctx.fillRect(frontPostX + 2, groundY - 2, 12, 1);
    ctx.fillStyle = '#f8d838';
    ctx.fillRect(frontPostX + 4, groundY - 5, 2, 1);

    // Refined height tick markers & compact SMW point tags (50 / 30 / 10)
    const markers: { label: string; y: number; color: string }[] = [
      { label: '50', y: 56, color: '#fce078' },
      { label: '30', y: 110, color: '#ffffff' },
      { label: '10', y: 162, color: '#d8e4f4' },
    ];
    ctx.save();
    ctx.font = '5px "Press Start 2P", monospace';
    for (const m of markers) {
      if (m.y >= groundY - 10) continue;
      // Subtle gold-rimmed tick notch on the front pillar
      ctx.fillStyle = '#181828';
      ctx.fillRect(frontPostX + 11, m.y - 3, 4, 3);
      ctx.fillStyle = m.color;
      ctx.fillRect(frontPostX + 11, m.y - 2, 3, 1);
      // Compact translucent backing for crisp legibility against any sky/scenery
      ctx.fillStyle = 'rgba(16, 20, 36, 0.55)';
      ctx.fillRect(frontPostX + 14, m.y - 6, 13, 8);
      ctx.fillStyle = '#000000';
      ctx.fillText(m.label, frontPostX + 16, m.y + 1);
      ctx.fillStyle = m.color;
      ctx.fillText(m.label, frontPostX + 15, m.y);
    }
    ctx.restore();
  }

  private renderBonusStage(ctx: CanvasRenderingContext2D) {
    // 1. SMW Indigo Bonus Room Backdrop with diamond checker pattern
    this.renderBonusBackdrop(ctx, 0);

    // 2. Bonus Stage Banner
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#000000';
    ctx.fillText('BONUS STAGE · VIDAS & POWER-UPS', GameEngine.NES_WIDTH / 2 + 1, 45);
    ctx.fillStyle = '#fce078';
    ctx.fillText('BONUS STAGE · VIDAS & POWER-UPS', GameEngine.NES_WIDTH / 2, 44);
    const rem = this.bonusStageBlocks.filter(b => !b.resolved).length;
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#58f898';
    if (this.bonusStageFinishDelay > 0) {
      const doneMsg =
        this.bonusStageLivesWon > 0
          ? `BONUS CONCLUIDO! +${this.bonusStageLivesWon} VIDAS`
          : 'BONUS CONCLUIDO!';
      ctx.fillText(doneMsg, GameEngine.NES_WIDTH / 2, 55);
    } else {
      ctx.fillText(`RESTAM: ${rem}/9   VIDAS GANHAS: +${this.bonusStageLivesWon}`, GameEngine.NES_WIDTH / 2, 55);
    }
    ctx.restore();

    // 3. Floor & spent tiles
    this.renderTiles(ctx);

    // 4. Active 3x3 rotating SMW Bonus Blocks
    const resolvedTags: Record<BonusBlockFace, { label: string; color: string }> = {
      '1up': { label: '1UP', color: '#58f898' },
      mushroom: { label: 'SUP', color: '#ff6868' },
      flower: { label: 'FIR', color: '#ffa848' },
      feather: { label: 'PEN', color: '#58f8f8' },
      leaf: { label: 'TAN', color: '#f0b868' },
      femboy: { label: 'FEM', color: '#ff80d8' },
    };
    for (const b of this.bonusStageBlocks) {
      const tile = this.level.tiles[b.ty]?.[b.tx];
      const bump = tile ? Math.round(tile.bumpOffset) : 0;
      const bx = b.x;
      const by = b.y + bump;

      if (b.resolved) {
        if (b.result) {
          const tag = resolvedTags[b.result];
          ctx.save();
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = tag.color;
          ctx.fillText(tag.label, bx + 8, by + 11);
          ctx.restore();
        }
        continue;
      }

      // Gleaming SMW roulette box
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx, by, 16, 16);
      ctx.fillStyle = '#fce078';
      ctx.fillRect(bx + 1, by + 1, 14, 14);
      ctx.fillStyle = '#182448';
      ctx.fillRect(bx + 2, by + 2, 12, 12);

      const face = GameEngine.BONUS_BLOCK_FACES[b.faceIndex % GameEngine.BONUS_BLOCK_FACES.length];
      const sprite =
        face === '1up'
          ? this.atlas.itemMushroom1Up
          : face === 'mushroom'
          ? this.atlas.itemMushroomSuper
          : face === 'flower'
          ? this.atlas.itemFireFlowerFrames[0]
          : face === 'feather'
          ? this.atlas.itemFeather
          : face === 'leaf'
          ? this.atlas.itemSuperLeaf
          : this.atlas.itemFemboy;
      if (sprite) {
        ctx.drawImage(sprite, bx + 2, by + 2, 12, 12);
      }
    }

    // 5. Mario & Particles & HUD
    this.renderMario(ctx);
    this.particleSystem.render(ctx, 0, GameEngine.NES_WIDTH, this.atlas);
    this.renderInCanvasHUD(ctx);

    // 6. SMW Circular Iris-Out Closing Curtain
    if (this.bonusStageIrisProgress > 0) {
      const centerX = Math.round(this.marioX + 8);
      const centerY = Math.round(this.marioY + this.getMarioHeight() / 2);
      const maxRadius = 280;
      const radius = Math.max(0, maxRadius * (1 - this.bonusStageIrisProgress));
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.rect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
      if (radius > 0.5) {
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
      }
      ctx.fill('evenodd');
      ctx.restore();
    }
  }

  private renderItems(ctx: CanvasRenderingContext2D) {
    const camX = this.camera.renderX;
    const coinFrame = Math.floor((Date.now() / 120) % 4);
    const flowerFrame = Math.floor((Date.now() / 100) % 4);
    const starFrame = Math.floor((Date.now() / 70) % Math.max(1, this.atlas.itemStarFrames.length));

    this.items.forEach(item => {
      const ix = Math.round(item.x - camX);
      const iy = Math.round(item.y);
      if (ix < -24 || ix > GameEngine.NES_WIDTH + 24) return;

      // R1.16.OV.4: Giant Floating "W" Coin rendering
      if (item.type === 'w_coin') {
        const bobY = Math.round(Math.sin(Date.now() / 220 + (item.wCoinIndex ?? 0) * 1.4) * 3);
        const spinScale = Math.max(0.3, Math.abs(Math.cos(Date.now() / 320 + (item.wCoinIndex ?? 0) * 0.9)));
        const cx = ix + 10;
        const cy = iy + 13 + bobY;
        const rx = Math.max(3, Math.round(10 * spinScale));
        const ry = 13;

        ctx.save();
        // Outer golden rim
        ctx.fillStyle = '#683800';
        ctx.fillRect(cx - rx - 1, cy - ry + 2, (rx + 1) * 2, ry * 2 - 4);
        ctx.fillRect(cx - rx + 1, cy - ry, Math.max(2, (rx - 1) * 2), ry * 2);

        // Main bright gold coin face
        ctx.fillStyle = '#f8c818';
        ctx.fillRect(cx - rx, cy - ry + 2, rx * 2, ry * 2 - 4);
        ctx.fillRect(cx - Math.max(1, rx - 2), cy - ry + 1, Math.max(2, (rx - 2) * 2), ry * 2 - 2);

        // Highlight & bevel
        ctx.fillStyle = '#fff59d';
        ctx.fillRect(cx - Math.max(1, rx - 2), cy - ry + 2, Math.max(2, rx), 2);
        ctx.fillStyle = '#d48200';
        ctx.fillRect(cx - Math.max(1, rx - 2), cy + ry - 4, Math.max(2, (rx - 2) * 2), 2);

        // Crisp embossed "W" letter when coin faces camera
        if (spinScale > 0.48) {
          ctx.fillStyle = '#8c4800';
          ctx.fillRect(cx - 5, cy - 5, 2, 8);
          ctx.fillRect(cx - 3, cy + 1, 2, 4);
          ctx.fillRect(cx - 1, cy - 2, 2, 4);
          ctx.fillRect(cx + 1, cy + 1, 2, 4);
          ctx.fillRect(cx + 3, cy - 5, 2, 8);

          ctx.fillStyle = '#fff9c4';
          ctx.fillRect(cx - 5, cy - 6, 2, 7);
          ctx.fillRect(cx + 3, cy - 6, 2, 7);
        }
        ctx.restore();
        return;
      }

      let sprite: HTMLCanvasElement | null = null;
      if (item.type === 'leaf') {
        sprite = this.atlas.itemSuperLeaf;
      } else if (item.type === 'feather') {
        sprite = this.atlas.itemFeather;
      } else if (item.type === 'mushroom') {
        sprite = this.atlas.itemMushroomSuper;
      } else if (item.type === '1up') {
        sprite = this.atlas.itemMushroom1Up;
      } else if (item.type === 'fireflower') {
        sprite = this.atlas.itemFireFlowerFrames[flowerFrame];
      } else if (item.type === 'coin') {
        sprite = this.atlas.itemCoinFrames[coinFrame];
      } else if (item.type === 'star') {
        sprite = this.atlas.itemStarFrames[starFrame] ?? this.atlas.itemFireFlowerFrames[flowerFrame];
      } else if (item.type === 'femboy') {
        sprite = this.atlas.itemFemboy;
      }

      if (!sprite) return;

      if (item.emerging) {
        // Clip emerging item neatly at the top lip of the ? block so it rises out from inside
        const blockTopY = item.emergeY + 16;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ix - 2, 0, 20, Math.max(0, blockTopY));
        ctx.clip();
        ctx.drawImage(sprite, ix, iy);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, ix, iy);
      }
    });
  }

  private renderYoshis(ctx: CanvasRenderingContext2D) {
    if (this.yoshis.length === 0) return;
    const camX = this.camera.renderX;
    this.yoshis.forEach(yoshi => {
      const yx = Math.round(yoshi.x - camX);
      const yy = Math.round(yoshi.y);
      if (yx < -28 || yx > GameEngine.NES_WIDTH + 28) return;
      const sprite =
        yoshi.state === 'runaway' && yoshi.animFrame === 1 ? this.atlas.yoshiWalk : this.atlas.yoshiIdle;
      ctx.save();
      if (yoshi.facing === 'left') {
        ctx.translate(yx + yoshi.width, yy);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0);
      } else {
        ctx.drawImage(sprite, yx, yy);
      }
      ctx.restore();
    });
  }

  private traceSmwKeyholePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
    const r = 6.2 * scale;
    const headCy = cy - 3.5 * scale;
    const neckAngle = Math.PI * 0.28;
    const rightStartAngle = neckAngle;
    const leftEndAngle = Math.PI - neckAngle;
    const bottomY = cy + 10.5 * scale;
    const bottomHalfW = 5.2 * scale;
    ctx.arc(cx, headCy, r, rightStartAngle, leftEndAngle, true);
    ctx.lineTo(cx - bottomHalfW, bottomY);
    ctx.lineTo(cx + bottomHalfW, bottomY);
    ctx.closePath();
  }

  private renderKeyholeClearTransition(ctx: CanvasRenderingContext2D, camX: number) {
    const activeKh = this.keyholes.find(k => k.id === this.activeKeyholeId);
    const khScreenX = activeKh ? Math.round(activeKh.x + 8 - camX) : Math.round(this.marioX + 8 - camX);
    const khScreenY = activeKh ? Math.round(activeKh.y + 12) : Math.round(this.marioY + 12);
    const t = Math.max(1, this.keyholeTotalTimer);
    const irisProg = Math.min(1, Math.max(0, (t - 15) / 62));

    // Pitch-black hold after the keyhole iris finishes closing (no bright flash before leaving the stage)
    if (irisProg >= 0.99) {
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
      ctx.restore();
      return;
    }

    // 1. Growing SMW keyhole emblem + golden key sliding/locking inside it
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    let emblemScale = 1;
    if (t <= 14) {
      // Crisp lock-in bounce when key snaps into keyhole
      emblemScale = t < 10 ? 1 : 1 + Math.sin(((t - 10) / 4) * Math.PI) * 0.28;
    } else {
      emblemScale = 1.08 + Math.min(3.1, (t - 15) * 0.08);
    }

    ctx.save();
    ctx.translate(khScreenX, khScreenY);
    ctx.scale(emblemScale, emblemScale);
    ctx.drawImage(this.atlas.itemKeyhole, -8, -12);
    ctx.restore();

    // Draw golden Key sliding into the keyhole slot and turning/disappearing inside the lock
    if (t <= 26) {
      const keyScreenX = Math.round(this.keyholeKeyX - camX) + 8;
      const keyScreenY = Math.round(this.keyholeKeyY) + 8;
      let keyScale = 1;
      let keyAngle = 0;
      let keyAlpha = 1;
      if (t > 10 && t <= 15) {
        const turnT = (t - 10) / 5;
        keyAngle = Math.sin(turnT * Math.PI) * 0.42;
        keyScale = 1 - turnT * 0.14;
      } else if (t > 15) {
        const absorbT = Math.min(1, (t - 15) / 11);
        keyScale = Math.max(0.15, 0.86 * (1 - absorbT));
        keyAlpha = Math.max(0, 1 - absorbT);
      }

      ctx.save();
      ctx.globalAlpha = keyAlpha;
      ctx.translate(keyScreenX, keyScreenY);
      if (keyAngle !== 0) ctx.rotate(keyAngle);
      ctx.scale(keyScale, keyScale);
      ctx.drawImage(this.atlas.itemKey, -8, -8);
      ctx.restore();
    }
    ctx.restore();

    // 2. Iconic SMW keyhole-shaped black iris curtain sweeping inward around (khScreenX, khScreenY)
    if (irisProg > 0) {
      const apertureScale = 34 * Math.pow(1 - irisProg, 1.55);
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.rect(0, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
      if (apertureScale > 0.25) {
        this.traceSmwKeyholePath(ctx, khScreenX, khScreenY, apertureScale);
      }
      ctx.fill('evenodd');

      if (apertureScale > 0.45 && apertureScale < 26) {
        ctx.beginPath();
        this.traceSmwKeyholePath(ctx, khScreenX, khScreenY, apertureScale);
        ctx.strokeStyle = '#f8d038';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderKeyholes(ctx: CanvasRenderingContext2D) {
    if (this.keyholes.length === 0) return;
    const camX = this.camera.renderX;
    for (const kh of this.keyholes) {
      if (this.keyholeTransitionActive && kh.id === this.activeKeyholeId) {
        // Active keyhole is rendered cleanly in renderKeyholeClearTransition inside the keyhole curtain
        continue;
      }
      const kx = Math.round(kh.x - camX);
      const ky = Math.round(kh.y);
      if (kx < -24 || kx > GameEngine.NES_WIDTH + 24) continue;
      ctx.save();
      if (kh.activated && kh.animTimer > 0) {
        const scale = 1 + Math.min(2.2, kh.animTimer * 0.08);
        ctx.translate(kx + 8, ky + 12);
        ctx.scale(scale, scale);
        ctx.drawImage(this.atlas.itemKeyhole, -8, -12);
      } else {
        ctx.drawImage(this.atlas.itemKeyhole, kx, ky);
      }
      ctx.restore();
    }
  }

  private renderCarryables(ctx: CanvasRenderingContext2D, heldOnly: boolean) {
    if (this.carryables.length === 0) return;
    const camX = this.camera.renderX;
    for (const obj of this.carryables) {
      if (obj.consumed) continue;
      const isHeld = this.heldCarryableId === obj.id;
      if (isHeld !== heldOnly) continue;

      const sx = Math.round(obj.x - camX);
      const sy = Math.round(obj.y);
      if (sx < -24 || sx > GameEngine.NES_WIDTH + 24) continue;

      let sprite = this.atlas.itemKey;
      if (obj.kind === 'p_switch_blue') {
        sprite = obj.pressed ? this.atlas.itemPSwitchBluePressed : this.atlas.itemPSwitchBlue;
      } else if (obj.kind === 'p_switch_cyan') {
        sprite = obj.pressed ? this.atlas.itemPSwitchCyanPressed : this.atlas.itemPSwitchCyan;
      }

      ctx.save();
      if (obj.kind === 'key' && isHeld && this.marioFacing === 'left') {
        ctx.translate(sx + 16, sy);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0);
      } else {
        ctx.drawImage(sprite, sx, sy);
      }
      ctx.restore();
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    const camX = this.camera.renderX;
    this.enemies.forEach(e => {
      const ex = Math.round(e.x - camX);
      if (ex < -32 || ex > GameEngine.NES_WIDTH + 32) return;

      ctx.save();
      if (e.state === 'flipped') {
        // Upside down flipped enemy
        ctx.translate(ex + e.width / 2, e.y + e.height / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-(ex + e.width / 2), -(e.y + e.height / 2));
      }

      if (e.type === 'goomba') {
        if (e.state === 'squashed') {
          ctx.drawImage(this.atlas.goombaSquashed, ex, Math.round(e.y + 1));
        } else {
          const frame = e.animFrame === 0 ? this.atlas.goombaWalk1 : this.atlas.goombaWalk2;
          ctx.drawImage(frame, ex, Math.round(e.y));
        }
      } else if (e.type === 'koopa' || e.type === 'red_koopa') {
        const isRed = e.type === 'red_koopa';
        if (e.state === 'shell_idle' || e.state === 'shell_moving') {
          const shakeX =
            e.state === 'shell_idle' && e.stateTimer > 0 && e.stateTimer < 60 && Math.floor(e.stateTimer / 3) % 2 === 0
              ? 1
              : 0;
          ctx.drawImage(isRed ? this.atlas.redKoopaShell : this.atlas.koopaShell, ex + shakeX, Math.round(e.y + 2));
        } else {
          const frame = isRed
            ? e.animFrame === 0
              ? this.atlas.redKoopaWalk1
              : this.atlas.redKoopaWalk2
            : e.animFrame === 0
            ? this.atlas.koopaWalk1
            : this.atlas.koopaWalk2;
          if (e.facing === 'right') {
            ctx.translate(ex + 16, Math.round(e.y));
            ctx.scale(-1, 1);
            ctx.drawImage(frame, 0, 0);
          } else {
            ctx.drawImage(frame, ex, Math.round(e.y));
          }
        }
      } else if (e.type === 'paratroopa') {
        const frame = e.animFrame === 0 ? this.atlas.paratroopa1 : this.atlas.paratroopa2;
        if (e.facing === 'right') {
          ctx.translate(ex + 16, e.y);
          ctx.scale(-1, 1);
          ctx.drawImage(frame, 0, 0);
        } else {
          ctx.drawImage(frame, ex, e.y);
        }
      } else if (e.type === 'hammer_bro') {
        const isWindingUp = e.fireTimer !== undefined && e.fireTimer <= 16;
        const frame = isWindingUp
          ? this.atlas.hammerBroThrow
          : e.animFrame === 0
          ? this.atlas.hammerBroWalk1
          : this.atlas.hammerBroWalk2;
        if (e.facing === 'right') {
          ctx.translate(ex + 16, e.y);
          ctx.scale(-1, 1);
          ctx.drawImage(frame, 0, 0);
        } else {
          ctx.drawImage(frame, ex, e.y);
        }
      } else if (e.type === 'piranha') {
        // Only render if protruding outside the pipe
        if (e.pipeOriginY === undefined || e.y < e.pipeOriginY - 2) {
          const frame = e.animFrame === 0 ? this.atlas.piranha1 : this.atlas.piranha2;
          ctx.save();
          if (e.pipeOriginY !== undefined) {
            ctx.beginPath();
            ctx.rect(ex - 8, 0, 32, e.pipeOriginY);
            ctx.clip();
          }
          ctx.drawImage(frame, ex - 4, e.y);
          ctx.restore();
        }
      } else if (e.type === 'blooper') {
        const frame = e.animFrame === 0 ? this.atlas.blooper1 : this.atlas.blooper2;
        ctx.drawImage(frame, ex, e.y);
      } else if (e.type === 'cheep_cheep' || e.type === 'fast_cheep') {
        const frame =
          e.type === 'fast_cheep'
            ? e.animFrame === 0
              ? this.atlas.fastCheep1
              : this.atlas.fastCheep2
            : e.animFrame === 0
            ? this.atlas.cheepCheep1
            : this.atlas.cheepCheep2;
        if (e.facing === 'right') {
          ctx.translate(ex + 16, e.y);
          ctx.scale(-1, 1);
          ctx.drawImage(frame, 0, 0);
        } else {
          ctx.drawImage(frame, ex, e.y);
        }
      } else if (e.type === 'bullet_bill') {
        if (e.facing === 'right') {
          ctx.translate(ex + 16, e.y);
          ctx.scale(-1, 1);
          ctx.drawImage(this.atlas.bulletBill, 0, 0);
        } else {
          ctx.drawImage(this.atlas.bulletBill, ex, e.y);
        }
      } else if (e.type === 'lava_bubble') {
        const frame = e.animFrame === 0 ? this.atlas.lavaBubble1 : this.atlas.lavaBubble2;
        ctx.drawImage(frame, ex, e.y);
      } else if (e.type === 'bowser') {
        if (!e.hitFlashTimer || Math.floor(e.hitFlashTimer / 2) % 2 === 0) {
          const frame = e.animFrame === 0 ? this.atlas.bowser1 : this.atlas.bowser2;
          if (e.facing === 'right') {
            ctx.translate(ex + 24, e.y);
            ctx.scale(-1, 1);
            ctx.drawImage(frame, 0, 0);
          } else {
            ctx.drawImage(frame, ex, e.y);
          }
        }
        if (e.alive && e.bossName) {
          ctx.restore();
          ctx.save();
          const label = e.bossName.toUpperCase();
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.textAlign = 'center';
          const tw = ctx.measureText(label).width;
          const bw = tw + 6;
          const bx = Math.round(ex + 12 - bw / 2);
          const by = Math.max(26, Math.round(e.y - 12));
          ctx.fillStyle = 'rgba(20, 4, 8, 0.88)';
          ctx.fillRect(bx, by, bw, 9);
          ctx.strokeStyle = '#fce078';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 8);
          ctx.fillStyle = '#fce078';
          ctx.fillText(label, ex + 12, by + 7);
        }
      } else if (e.type === 'boo') {
        ctx.globalAlpha = 0.92;
        const frame = e.animFrame === 1 ? this.atlas.booShy : this.atlas.booChase;
        if (e.facing === 'right') {
          ctx.translate(ex + 16, e.y);
          ctx.scale(-1, 1);
          ctx.drawImage(frame, 0, 0);
        } else {
          ctx.drawImage(frame, ex, e.y);
        }
      } else if (e.type === 'dry_bones') {
        if (e.state === 'shell_idle') {
          const shakeX = e.stateTimer < 45 && Math.floor(e.stateTimer / 3) % 2 === 0 ? 1 : 0;
          ctx.drawImage(this.atlas.dryBonesCrumbled, ex + shakeX, Math.round(e.y));
        } else {
          const frame = e.animFrame === 0 ? this.atlas.dryBonesWalk1 : this.atlas.dryBonesWalk2;
          if (e.facing === 'right') {
            ctx.translate(ex + 16, Math.round(e.y));
            ctx.scale(-1, 1);
            ctx.drawImage(frame, 0, 0);
          } else {
            ctx.drawImage(frame, ex, Math.round(e.y));
          }
        }
      }

      ctx.restore();
    });
  }

  private renderFireballs(ctx: CanvasRenderingContext2D) {
    const camX = this.camera.renderX;
    const frame = Math.floor((Date.now() / 60) % 4);
    this.fireballs.forEach(fb => {
      const fx = Math.round(fb.x - camX);
      if (fx < -8 || fx > GameEngine.NES_WIDTH + 8) return;
      const frames = fb.color === 'white' ? this.atlas.whiteFireballFrames : this.atlas.fireballFrames;
      if (fb.exploding) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - fb.explodeTimer / 10);
        ctx.drawImage(frames[frame], fx, Math.round(fb.y));
        ctx.restore();
      } else {
        ctx.drawImage(frames[frame], fx, Math.round(fb.y));
      }
    });

    this.bossFireballs.forEach(bf => {
      const bx = Math.round(bf.x - camX);
      const by = Math.round(bf.y);
      if (bx < -20 || bx > GameEngine.NES_WIDTH + 20) return;
      const bFrame = Math.floor(bf.animTimer / 4) % 2;
      ctx.save();
      if (bf.vx > 0) {
        ctx.translate(bx + 16, by);
        ctx.scale(-1, 1);
        ctx.drawImage(this.atlas.bowserFireFrames[bFrame], 0, 0);
      } else {
        ctx.drawImage(this.atlas.bowserFireFrames[bFrame], bx, by);
      }
      ctx.restore();
    });

    this.hammerProjectiles.forEach(h => {
      const hx = Math.round(h.x - camX);
      const hy = Math.round(h.y);
      if (hx < -16 || hx > GameEngine.NES_WIDTH + 16 || hy > GameEngine.NES_HEIGHT + 16) return;
      const hFrame = Math.floor(h.animTimer / 3) % this.atlas.hammerFrames.length;
      const sprite = this.atlas.hammerFrames[hFrame];
      ctx.save();
      if (h.vx > 0) {
        ctx.translate(hx + 12, hy);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0);
      } else {
        ctx.drawImage(sprite, hx, hy);
      }
      ctx.restore();
    });
  }

  private renderCastleToodle(ctx: CanvasRenderingContext2D) {
    if (!this.castleToodleActive) return;

    const tx = Math.round(this.castleToodleX - this.camera.renderX);
    if (tx < -24 || tx > GameEngine.NES_WIDTH + 24) return;

    const isTalking = this.marioState === 'castle_entered';
    const cheerStep = isTalking ? Math.floor(this.castleToodleDialogueTimer / 14) % 2 : 0;
    const bounceY = cheerStep === 1 ? -2 : 0;
    const ty = Math.round(this.castleToodleY + bounceY);

    const sprite = cheerStep === 1 ? this.atlas.toodleHappySprite : this.atlas.toodleSprite;
    ctx.drawImage(sprite, tx, ty);
  }

  private renderCastleToodleDialogue(ctx: CanvasRenderingContext2D) {
    if (!this.castleToodleActive || this.marioState !== 'castle_entered') return;

    const boxX = 10;
    const boxY = 64;
    const boxW = GameEngine.NES_WIDTH - 20; // 236px
    const boxH = 58;

    const toodleScreenX = Math.round(this.castleToodleX - this.camera.renderX) + 8;
    const pointerX = Math.max(boxX + 16, Math.min(boxX + boxW - 24, toodleScreenX));

    ctx.save();

    // Classic NES double-bordered dialogue panel
    ctx.fillStyle = 'rgba(8, 8, 22, 0.94)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Outer white pixel frame
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);

    // Inner crimson NES accent frame
    ctx.strokeStyle = '#d82800';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 3, boxY + 3, boxW - 6, boxH - 6);

    // Speech tail pointing toward Toodle
    ctx.fillStyle = 'rgba(8, 8, 22, 0.94)';
    ctx.beginPath();
    ctx.moveTo(pointerX - 6, boxY + boxH - 1);
    ctx.lineTo(pointerX + 6, boxY + boxH - 1);
    ctx.lineTo(pointerX, boxY + boxH + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pointerX - 6, boxY + boxH);
    ctx.lineTo(pointerX, boxY + boxH + 8);
    ctx.lineTo(pointerX + 6, boxY + boxH);
    ctx.stroke();

    // Speaker badge: TOODLE
    ctx.fillStyle = '#d82800';
    ctx.fillRect(boxX + 10, boxY - 6, 54, 11);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 10, boxY - 6, 54, 11);
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#fce078';
    ctx.textAlign = 'left';
    ctx.fillText('TOODLE', boxX + 16, boxY + 2);

    // Typewriter dialogue lines
    const heroName = this.playerCharacter === 'wazzima' ? 'WAZZIMAGIYGG' : 'MARIO';
    const isWikiCastle = this.level.smwNodeId === 'wiki-5-castelo';
    const bossUpper = this.getBossDisplayName().toUpperCase();
    const line1 = `OBRIGADO, ${heroName}!`;
    const line2 = isWikiCastle ? 'CASTELO DE JOHANNNNES89' : 'MAS A NOSSA PRINCESA';
    const line3 = isWikiCastle ? `LIVRE DE ${bossUpper}!` : 'ESTÁ EM OUTRO CASTELO!';
    const fullChars = line1.length + line2.length + line3.length;
    const revealedChars = Math.min(fullChars, Math.floor(this.castleToodleDialogueTimer * 1.6));

    const vis1 = line1.slice(0, revealedChars);
    const rem1 = Math.max(0, revealedChars - line1.length);
    const vis2 = line2.slice(0, rem1);
    const rem2 = Math.max(0, rem1 - line2.length);
    const vis3 = line3.slice(0, rem2);

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const centerX = GameEngine.NES_WIDTH / 2;

    const drawTextLine = (text: string, y: number, color: string) => {
      if (!text) return;
      ctx.fillStyle = '#000000';
      ctx.fillText(text, centerX + 1, y + 1);
      ctx.fillStyle = color;
      ctx.fillText(text, centerX, y);
    };

    drawTextLine(vis1, boxY + 21, '#fce078');
    drawTextLine(vis2, boxY + 35, '#ffffff');
    drawTextLine(vis3, boxY + 49, '#ffffff');

    ctx.restore();
  }

  private renderCastlePrincess(ctx: CanvasRenderingContext2D) {
    if (!this.castlePrincessActive) return;

    const px = Math.round(this.castlePrincessX - this.camera.renderX);
    if (px < -24 || px > GameEngine.NES_WIDTH + 24) return;

    const isTalking = this.marioState === 'castle_entered';
    const cheerStep = isTalking ? Math.floor(this.castlePrincessDialogueTimer / 14) % 2 : 0;
    const bounceY = cheerStep === 1 ? -2 : 0;
    const py = Math.round(this.castlePrincessY + bounceY);

    const sprite = cheerStep === 1 ? this.atlas.princessFemboyHappySprite : this.atlas.princessFemboySprite;
    ctx.drawImage(sprite, px, py);
  }

  private renderCastlePrincessDialogue(ctx: CanvasRenderingContext2D) {
    if (!this.castlePrincessActive || this.marioState !== 'castle_entered') return;

    const boxX = 10;
    const boxY = 60;
    const boxW = GameEngine.NES_WIDTH - 20; // 236px
    const boxH = 62;

    const princessScreenX = Math.round(this.castlePrincessX - this.camera.renderX) + 8;
    const pointerX = Math.max(boxX + 16, Math.min(boxX + boxW - 24, princessScreenX));

    ctx.save();

    // NES double-bordered dialogue panel with pastel pink royal accent
    ctx.fillStyle = 'rgba(20, 6, 26, 0.95)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);

    ctx.strokeStyle = '#ff66b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 3, boxY + 3, boxW - 6, boxH - 6);

    // Speech tail pointing toward Princesa Femboy
    ctx.fillStyle = 'rgba(20, 6, 26, 0.95)';
    ctx.beginPath();
    ctx.moveTo(pointerX - 6, boxY + boxH - 1);
    ctx.lineTo(pointerX + 6, boxY + boxH - 1);
    ctx.lineTo(pointerX, boxY + boxH + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pointerX - 6, boxY + boxH);
    ctx.lineTo(pointerX, boxY + boxH + 8);
    ctx.lineTo(pointerX + 6, boxY + boxH);
    ctx.stroke();

    // Speaker badge: PRINCESA FEMBOY
    ctx.fillStyle = '#d82878';
    ctx.fillRect(boxX + 10, boxY - 6, 118, 11);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX + 10, boxY - 6, 118, 11);
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd6ee';
    ctx.textAlign = 'left';
    ctx.fillText('PRINCESA FEMBOY', boxX + 15, boxY + 2);

    const heroName = this.playerCharacter === 'wazzima' ? 'WAZZIMAGIYGG' : 'MARIO';
    const line1 = `OBRIGADO, ${heroName}!`;
    const line2 = 'VOCÊ VENCEU OS 7 MUNDOS!';
    const line3 = 'BEM-VINDO AO CASTELO FINAL!';
    const fullChars = line1.length + line2.length + line3.length;
    const revealedChars = Math.min(fullChars, Math.floor(this.castlePrincessDialogueTimer * 1.5));

    const vis1 = line1.slice(0, revealedChars);
    const rem1 = Math.max(0, revealedChars - line1.length);
    const vis2 = line2.slice(0, rem1);
    const rem2 = Math.max(0, rem1 - line2.length);
    const vis3 = line3.slice(0, rem2);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const centerX = GameEngine.NES_WIDTH / 2;

    const drawTextLine = (text: string, y: number, color: string) => {
      if (!text) return;
      ctx.fillStyle = '#000000';
      ctx.fillText(text, centerX + 1, y + 1);
      ctx.fillStyle = color;
      ctx.fillText(text, centerX, y);
    };

    drawTextLine(vis1, boxY + 22, '#ff99d6');
    drawTextLine(vis2, boxY + 37, '#fce078');
    drawTextLine(vis3, boxY + 52, '#ffffff');

    ctx.restore();
  }

  private renderDebugCursor(ctx: CanvasRenderingContext2D) {
    const spec = this.getCurrentDebugPlaceable();
    const cx = Math.round(this.marioX - this.camera.renderX);
    const cy = Math.round(this.marioY);
    const coinFrame = Math.floor((Date.now() / 120) % 4);
    const flowerFrame = Math.floor((Date.now() / 100) % 4);
    const blink = Math.floor(Date.now() / 130) % 2 === 0;

    ctx.save();
    // Draw sprite preview of the currently selected Sonic debug item
    let sprite: HTMLCanvasElement | null = null;
    let drawY = cy;
    switch (spec.id) {
      case 'coin':
        sprite = this.atlas.itemCoinFrames[coinFrame];
        break;
      case 'mushroom':
        sprite = this.atlas.itemMushroomSuper;
        break;
      case 'fireflower':
      case 'star':
        sprite = this.atlas.itemFireFlowerFrames[flowerFrame];
        break;
      case 'leaf':
        sprite = this.atlas.itemSuperLeaf;
        break;
      case 'feather':
        sprite = this.atlas.itemFeather;
        break;
      case 'femboy':
        sprite = this.atlas.itemFemboy;
        break;
      case '1up':
        sprite = this.atlas.itemMushroom1Up;
        break;
      case 'question_coin':
        sprite = this.atlas.tileQuestionFrames[Math.floor((Date.now() / 180) % 3)];
        break;
      case 'exclam_yellow':
        sprite = this.yellowSwitchUnlocked
          ? this.atlas.tileExclamYellowActive
          : this.atlas.tileExclamYellowLocked;
        break;
      case 'exclam_green':
        sprite = this.greenSwitchUnlocked
          ? this.atlas.tileExclamGreenActive
          : this.atlas.tileExclamGreenLocked;
        break;
      case 'exclam_red':
        sprite = this.redSwitchUnlocked
          ? this.atlas.tileExclamRedActive
          : this.atlas.tileExclamRedLocked;
        break;
      case 'exclam_pink':
        sprite = this.pinkSwitchUnlocked
          ? this.atlas.tileExclamPinkActive
          : this.atlas.tileExclamPinkLocked;
        break;
      case 'exclam_blue':
        sprite = this.blueSwitchUnlocked
          ? this.atlas.tileExclamBlueActive
          : this.atlas.tileExclamBlueLocked;
        break;
      case 'brick':
        sprite = this.atlas.tileBrick;
        break;
      case 'hard_block':
        sprite = this.atlas.tileHardBlock;
        break;
      case 'goomba':
        sprite = this.atlas.goombaWalk1;
        break;
      case 'koopa':
        sprite = this.atlas.koopaWalk1;
        drawY = cy - 8;
        break;
      case 'red_koopa':
        sprite = this.atlas.redKoopaWalk1;
        drawY = cy - 8;
        break;
      case 'paratroopa':
        sprite = this.atlas.paratroopa1;
        drawY = cy - 8;
        break;
      case 'hammer_bro':
        sprite = this.atlas.hammerBroWalk1;
        drawY = cy - 8;
        break;
      case 'boo':
        sprite = this.atlas.booChase;
        break;
      case 'dry_bones':
        sprite = this.atlas.dryBonesWalk1;
        drawY = cy - 8;
        break;
      case 'yoshi':
        sprite = this.atlas.yoshiIdle;
        drawY = cy - 4;
        break;
      case 'key':
        sprite = this.atlas.itemKey;
        break;
      case 'keyhole':
        sprite = this.atlas.itemKeyhole;
        break;
      case 'p_switch_blue':
        sprite = this.atlas.itemPSwitchBlue;
        break;
      case 'p_switch_cyan':
        sprite = this.atlas.itemPSwitchCyan;
        break;
    }

    if (sprite) {
      ctx.globalAlpha = blink ? 1 : 0.72;
      ctx.drawImage(sprite, cx, drawY);
    }

    // Sonic-style pixel crosshair corners
    ctx.globalAlpha = 1;
    ctx.strokeStyle = blink ? '#58f8f8' : '#fce078';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 1.5, cy - 1.5, 19, 19);

    // Compact floating label above cursor
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const labelW = ctx.measureText(spec.label).width + 6;
    const labelX = Math.max(4, Math.min(GameEngine.NES_WIDTH - labelW - 4, cx + 8 - labelW / 2));
    const labelY = Math.max(42, drawY - 11);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(labelX, labelY, labelW, 8);
    ctx.fillStyle = '#58f8f8';
    ctx.fillText(spec.label, labelX + labelW / 2, labelY + 6);
    ctx.restore();
  }

  private renderIllegalInstructionGlitch(ctx: CanvasRenderingContext2D) {
    const t = this.illegalInstructionTimer;
    const canvas = ctx.canvas;

    // 1. Horizontal scanline tearing & corrupted VRAM slices
    const sliceSeed = Math.floor(t / 2);
    for (let i = 0; i < 14; i++) {
      const pseudo = Math.sin(sliceSeed * 12.9898 + i * 78.233) * 43758.5453;
      const frac = pseudo - Math.floor(pseudo);
      const sy = Math.floor(frac * (GameEngine.NES_HEIGHT - 16));
      const sh = 3 + (i % 4) * 3;
      const shiftX = Math.round(Math.sin(sliceSeed * 3.7 + i * 1.9) * 14);
      ctx.drawImage(canvas, 0, sy, GameEngine.NES_WIDTH, sh, shiftX, sy, GameEngine.NES_WIDTH, sh);
    }

    // 2. Garbled 8-bit color blocks & corrupted sprite static
    const glitchColors = ['#ff0055', '#00ffff', '#fce078', '#00ff66', '#ff00ff', '#000000', '#ffffff'];
    for (let i = 0; i < 24; i++) {
      const p1 = Math.sin((sliceSeed + 1) * 91.7 + i * 17.3) * 19381.1;
      const p2 = Math.cos((sliceSeed + 3) * 43.1 + i * 29.7) * 28173.9;
      const gx = Math.floor((p1 - Math.floor(p1)) * GameEngine.NES_WIDTH);
      const gy = Math.floor((p2 - Math.floor(p2)) * GameEngine.NES_HEIGHT);
      const gw = 4 + (i % 5) * 6;
      const gh = 2 + (i % 3) * 2;
      ctx.fillStyle = glitchColors[(i + sliceSeed) % glitchColors.length];
      ctx.globalAlpha = 0.72;
      ctx.fillRect(gx, gy, gw, gh);
    }
    ctx.globalAlpha = 1;

    // Occasional inverted scan band flash
    if (Math.floor(t / 4) % 5 === 0) {
      ctx.fillStyle = 'rgba(255, 0, 70, 0.16)';
      ctx.fillRect(0, (t * 7) % GameEngine.NES_HEIGHT, GameEngine.NES_WIDTH, 18);
    }

    // 3. Classic Motorola 68000 / Sega crash banner: "ILLEGAL INSTRUCTION"
    ctx.save();
    const boxX = 14;
    const boxY = 74;
    const boxW = GameEngine.NES_WIDTH - 28;
    const boxH = 88;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = Math.floor(t / 6) % 2 === 0 ? '#ff2244' : '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);

    const hexX = Math.max(0, Math.round(this.marioX)).toString(16).toUpperCase().padStart(4, '0');
    const hexY = Math.max(0, Math.round(this.marioY)).toString(16).toUpperCase().padStart(4, '0');

    ctx.textAlign = 'center';
    // Chromatic aberration split on ILLEGAL INSTRUCTION
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#00ffff';
    ctx.fillText('ILLEGAL INSTRUCTION', GameEngine.NES_WIDTH / 2 - 1, boxY + 26);
    ctx.fillStyle = '#ff2244';
    ctx.fillText('ILLEGAL INSTRUCTION', GameEngine.NES_WIDTH / 2 + 1, boxY + 27);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ILLEGAL INSTRUCTION', GameEngine.NES_WIDTH / 2, boxY + 26);

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#ff6688';
    ctx.fillText(`TRAP #04  PC:$00FF${hexX}  A7:$${hexY}`, GameEngine.NES_WIDTH / 2, boxY + 46);
    ctx.fillStyle = '#fce078';
    ctx.fillText('SYSTEM HALTED - SCREEN CORRUPTED', GameEngine.NES_WIDTH / 2, boxY + 60);

    if (Math.floor(t / 14) % 2 === 0) {
      ctx.fillStyle = '#58f898';
      ctx.fillText('PRESSIONE BOTÃO DO DESENVOLVEDOR', GameEngine.NES_WIDTH / 2, boxY + 76);
    }
    ctx.restore();
  }

  private renderMario(ctx: CanvasRenderingContext2D) {
    // Mario has entered the castle door - hidden from view inside (unless standing with Toodle or Princesa Femboy)
    if (
      this.marioState === 'castle_entered' &&
      !this.castleToodleActive &&
      !this.castlePrincessActive &&
      !this.switchPalaceActivated &&
      !this.keyholeTransitionActive
    ) {
      return;
    }

    // Blinking during temporary post-damage invulnerability (only after growth/shrink freeze and when Starman is inactive)
    if (
      this.marioStarTimer <= 0 &&
      this.marioGrowthTimer <= 0 &&
      this.marioShrinkTimer <= 0 &&
      this.marioInvulnerableTimer > 0 &&
      Math.floor(this.marioInvulnerableTimer / 3) % 2 === 0
    ) {
      return;
    }

    // Subtract smooth float camera before rounding so Mario stays rock-steady during high-speed tracking
    const mx = Math.round(this.marioX - this.camera.x);
    const my = Math.round(this.marioY);

    ctx.save();
    if (this.isDebugMode && this.isDebugPlacementActive) {
      ctx.globalAlpha = 0.28;
    }

    // R02.16.PG.4: SMW Castle doorway entry depth-scale & archway fade as Mario steps inside
    if (
      this.smwCastleEntryActive &&
      this.marioState === 'castle_walk' &&
      !this.castleToodleActive &&
      !this.castlePrincessActive &&
      this.smwCastleEntryTimer > 14
    ) {
      const progress = Math.min(1, (this.smwCastleEntryTimer - 14) / 30);
      const scale = 1 - progress * 0.28;
      const footY = my + this.getMarioHeight();
      const centerX = mx + 8;
      ctx.globalAlpha = Math.max(0.15, 1 - progress * 0.8);
      ctx.translate(centerX, footY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -footY);
    }

    // Authentic NES Pipe Entering / Exiting Clipping:
    // Mario visually sinks INSIDE the pipe rather than rendering on top of the rim!
    if (this.marioState === 'pipe_entering' || this.marioState === 'pipe_exiting') {
      if (this.pipeClipLipY !== null) {
        ctx.beginPath();
        if (this.marioState === 'pipe_exiting' && this.pipeExitDir === 'down') {
          // Exiting down from ceiling: clip to below lip
          ctx.rect(0, this.pipeClipLipY, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT - this.pipeClipLipY);
        } else {
          // Entering down or exiting up: clip strictly above pipe rim
          ctx.rect(0, 0, GameEngine.NES_WIDTH, this.pipeClipLipY);
        }
        ctx.clip();
      } else if (this.pipeClipLipX !== null) {
        const lipScreenX = Math.round(this.pipeClipLipX - this.camera.renderX);
        ctx.beginPath();
        if (this.marioState === 'pipe_entering' && this.warpDir === 'right') {
          // Entering horizontally to the right: hide everything past the pipe opening
          ctx.rect(0, 0, Math.max(0, lipScreenX), GameEngine.NES_HEIGHT);
        } else {
          ctx.rect(Math.max(0, lipScreenX), 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
        }
        ctx.clip();
      }
    }

    // Facing Left Flip
    if (this.marioFacing === 'left') {
      ctx.translate(mx + 16, my);
      ctx.scale(-1, 1);
      ctx.translate(-mx, -my);
    }

    const getIdlePowerSprite = (power: MarioPower): HTMLCanvasElement => {
      return this.atlas.getCharacterSprite(this.playerCharacter, power, 'idle', 0);
    };

    // Authentic NES Growth & Power-Up Flash Transitions
    if (this.marioGrowthTimer > 0) {
      if (this.marioTransitionKind === 'power_flash') {
        const currentSprite = this.atlas.getCharacterSprite(
          this.playerCharacter,
          this.marioPower,
          this.marioState,
          this.marioAnimFrame,
          {
            isStatue: this.isStatue,
            tailWhipTimer: this.tailWhipTimer,
            isFluttering: this.isFluttering,
            marioVx: this.marioVx,
          }
        );
        const phase = Math.floor(this.marioGrowthTimer / 2);
        const flashed = phase % 2 === 0 ? currentSprite : this.atlas.getStarmanSprite(currentSprite, phase);
        ctx.drawImage(flashed, mx, my);
      } else {
        const isSmallFlicker = Math.floor(this.marioGrowthTimer / 4) % 2 === 1;
        const sprite = isSmallFlicker ? getIdlePowerSprite('small') : getIdlePowerSprite(this.marioPower);
        const drawY = isSmallFlicker ? my + 16 : my;
        ctx.drawImage(sprite, mx, drawY);
      }
      ctx.restore();
      return;
    }

    // Authentic NES Shrink Transition (Flickering between previous Big sprite and new state with anchored feet)
    if (this.marioShrinkTimer > 0) {
      const showPrevBig = Math.floor(this.marioShrinkTimer / 4) % 2 === 1;
      const fromPower = this.marioTransitionFrom !== 'small' ? this.marioTransitionFrom : 'super';
      if (this.marioPower === 'small') {
        const sprite = showPrevBig ? getIdlePowerSprite(fromPower) : getIdlePowerSprite('small');
        const drawY = showPrevBig ? my - 16 : my;
        ctx.drawImage(sprite, mx, drawY);
      } else {
        const sprite = showPrevBig ? getIdlePowerSprite(fromPower) : getIdlePowerSprite(this.marioPower);
        ctx.drawImage(sprite, mx, my);
      }
      ctx.restore();
      return;
    }

    // Get current character sprite (Mario or WazzimaGiygg)
    const effectiveState =
      this.switchPalaceActivated && this.marioState === 'castle_entered'
        ? 'idle'
        : this.marioFireThrowTimer > 0 && this.marioPower === 'fire' && this.marioGrounded && Math.abs(this.marioVx) < 0.2
        ? 'running'
        : this.marioState;
    const effectiveFrame = this.marioFireThrowTimer > 0 && this.marioPower === 'fire' ? 1 : this.marioAnimFrame;

    const activeSpin =
      this.isSpinJumping &&
      !this.marioOnYoshi &&
      !this.isStatue &&
      this.marioState !== 'dead' &&
      this.marioState !== 'pipe_entering' &&
      this.marioState !== 'pipe_exiting';

    let spriteCanvas = this.atlas.getCharacterSprite(
      this.playerCharacter,
      this.marioPower,
      effectiveState,
      effectiveFrame,
      {
        isStatue: this.isStatue,
        tailWhipTimer: this.tailWhipTimer,
        isFluttering: this.isFluttering,
        marioVx: this.marioVx,
        isSpinning: activeSpin,
        spinTimer: this.spinJumpTimer,
      }
    );

    if (spriteCanvas && this.marioStarTimer > 0) {
      // Rapid rainbow palette cycling; slows & alternates base colors in the final 2 seconds to warn expiration
      const isExpiring = this.marioStarTimer < 120;
      const stepDivisor = isExpiring ? 5 : 3;
      const tick = Math.floor(this.marioStarTimer / stepDivisor);
      if (!isExpiring || tick % 2 === 0) {
        spriteCanvas = this.atlas.getStarmanSprite(spriteCanvas, tick);
      }
    }

    if (this.marioOnYoshi) {
      const yoshiSprite =
        this.yoshiTongueTimer > 0
          ? this.atlas.yoshiTongue
          : Math.abs(this.marioVx) > 0.2 && Math.floor(Date.now() / 110) % 2 === 1
          ? this.atlas.yoshiWalk
          : this.atlas.yoshiIdle;
      const yoshiDrawY = my + this.getMarioHeight() - 20;
      if (spriteCanvas) {
        ctx.drawImage(spriteCanvas, mx, my - 7);
      }
      ctx.drawImage(yoshiSprite, mx - 2, yoshiDrawY);
      if (this.yoshiTongueTimer > 0) {
        const tongueProgress = Math.sin(((14 - this.yoshiTongueTimer) / 14) * Math.PI);
        const reach = Math.max(4, Math.round(26 * tongueProgress));
        const tongueY = yoshiDrawY + 7;
        ctx.fillStyle = '#ff5a96';
        ctx.fillRect(mx + 17, tongueY, reach, 3);
        ctx.fillStyle = '#ff2870';
        ctx.fillRect(mx + 17 + reach - 3, tongueY - 1, 4, 5);
      }
    } else if (spriteCanvas) {
      if (activeSpin) {
        const spinStep = Math.floor(this.spinJumpTimer / 3) % 4;
        const spinScales =
          this.marioPower === 'cape' || this.marioPower === 'tanooki'
            ? [1, 0.86, -1, -0.86]
            : [1, 0.58, -1, -0.58];
        ctx.save();
        ctx.translate(mx + 8, my);
        ctx.scale(spinScales[spinStep], 1);
        ctx.translate(-(mx + 8), -my);
        ctx.drawImage(spriteCanvas, mx, my);
        ctx.restore();
      } else {
        ctx.drawImage(spriteCanvas, mx, my);
      }
    }

    ctx.restore();

    // If multiplayer has connected players, render local overhead name badge too
    if (this.remotePlayers.size > 0) {
      ctx.save();
      const badgeY = my - 8;
      const isW = this.playerCharacter === 'wazzima';
      const badgeColor = isW ? '#00a800' : '#d82800';
      const nameText = isW ? 'WazzimaGiygg' : 'MARIO';

      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const textWidth = ctx.measureText(nameText).width;
      const bgW = Math.max(26, textWidth + 6);
      const bgX = mx + 8 - bgW / 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(bgX, badgeY - 6, bgW, 8);
      ctx.fillStyle = badgeColor;
      ctx.fillRect(bgX, badgeY - 6, bgW, 1);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(nameText, mx + 8, badgeY);
      ctx.restore();
    }
  }

  // --- MULTIPLAYER REMOTE PLAYERS RENDERING (Velocity-Assisted Dead-Reckoning & Interpolation) ---
  private renderRemotePlayers(ctx: CanvasRenderingContext2D) {
    if (this.remotePlayers.size === 0) return;

    const now = Date.now();
    this.remotePlayers.forEach(rp => {
      const elapsedMs = now - rp.lastUpdated;
      // Discard stale players (no updates in 15 seconds)
      if (elapsedMs > 15000) return;
      if (rp.state === 'castle_entered') return;

      // Velocity-assisted prediction bounded to 180ms so 8-20 Hz adaptive packets glide smoothly
      const leadFrames = Math.max(0, Math.min(180, elapsedMs)) / 16.67;
      const targetX = rp.x + rp.vx * leadFrames * 0.54;
      const targetY = rp.y + rp.vy * leadFrames * 0.36;
      rp.targetX = targetX;
      rp.targetY = targetY;

      // Smooth exponential interpolation toward predicted network target (snap on pipe warp / respawn > 96px)
      if (rp.renderX === undefined || Math.abs(targetX - rp.renderX) > 96) {
        rp.renderX = rp.x;
      } else {
        rp.renderX += (targetX - rp.renderX) * 0.28;
      }
      if (rp.renderY === undefined || Math.abs(targetY - rp.renderY) > 96) {
        rp.renderY = rp.y;
      } else {
        rp.renderY += (targetY - rp.renderY) * 0.28;
      }

      const px = Math.round(rp.renderX - this.camera.renderX);
      const py = Math.round(rp.renderY);
      if (px < -32 || px > GameEngine.NES_WIDTH + 32) return;

      ctx.save();

      // Facing left flip
      if (rp.facing === 'left') {
        ctx.translate(px + 16, py);
        ctx.scale(-1, 1);
        ctx.translate(-px, -py);
      }

      // Blinking if invulnerable
      if (rp.invulnerable && Math.floor(now / 80) % 2 === 0) {
        ctx.restore();
        return;
      }

      // Interpolate walk animation frame smoothly at 60 FPS between network packets
      const effectiveAnimFrame =
        Math.abs(rp.vx) > 0.2 && (rp.state === 'running' || rp.state === 'idle')
          ? (rp.animFrame + Math.floor(Math.max(0, elapsedMs) / 85)) % 3
          : rp.animFrame;

      const spriteCanvas = this.atlas.getCharacterSprite(
        rp.character,
        rp.power,
        rp.state,
        effectiveAnimFrame,
        {
          isStatue: rp.isStatue,
          tailWhipTimer: rp.tailWhipTimer,
          isFluttering: rp.isFluttering,
          marioVx: rp.vx,
        }
      );

      if (spriteCanvas) {
        ctx.drawImage(spriteCanvas, px, py);
      }

      ctx.restore();

      // Overhead player tag with cached width measurement for 8-16 player efficiency
      ctx.save();
      const badgeY = py - 8;
      const isW = rp.character === 'wazzima';
      const badgeColor = isW ? '#00a800' : '#d82800';
      const nameText = (rp.name || (isW ? 'WazzimaGiygg' : 'Mario')).substring(0, 12);

      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      let textWidth = this.remoteBadgeWidthCache.get(nameText);
      if (textWidth === undefined) {
        textWidth = ctx.measureText(nameText).width;
        if (this.remoteBadgeWidthCache.size >= 64) {
          this.remoteBadgeWidthCache.clear();
        }
        this.remoteBadgeWidthCache.set(nameText, textWidth);
      }
      const bgW = Math.max(28, textWidth + 6);
      const bgX = px + 8 - bgW / 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(bgX, badgeY - 6, bgW, 8);
      ctx.fillStyle = badgeColor;
      ctx.fillRect(bgX, badgeY - 6, bgW, 1);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(nameText, px + 8, badgeY);

      ctx.restore();
    });
  }
}
