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
  PlayerCharacter,
  RemotePlayerState,
  MultiplayerMatchPlayerStanding,
  MultiplayerMatchResult,
  DebugPlaceableId,
  DebugPlaceableSpec,
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
} from './levels.ts';
import { createSmwWikiWorldStage } from './smwWorldMap.ts';
import { getTopScore, updateTopScore, saveNewScore, getLastPlayerName } from './scoreboard.ts';

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
  public remotePlayers: Map<string, RemotePlayerState> = new Map();

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
  private stompComboCount: number = 0;
  private static readonly STOMP_COMBO_SCORES = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000] as const;
  private static readonly SHELL_STREAK_SCORES = [500, 800, 1000, 2000, 4000, 5000, 8000] as const;

  // Tanooki Suit State
  public tailWhipTimer: number = 0;
  public isFluttering: boolean = false;
  public isStatue: boolean = false;

  // Screen-Shake Effect (Heavy Landings, Large Enemy Stomps, Pipe Entry, Boss Impacts)
  public screenShakeTimer: number = 0;
  public screenShakeIntensity: number = 0;
  private screenShakeMaxDuration: number = 12;
  public screenShakeOffsetX: number = 0;
  public screenShakeOffsetY: number = 0;

  // Pipe Warp State & Authentic In-Pipe Visual Clipping
  public warpTimer: number = 0;
  public warpTarget: { toLevel: string; toPos: Point } | null = null;
  public warpDir: 'down' | 'right' = 'down';
  public pipeExitDir: 'up' | 'down' | 'right' = 'up';
  public pipeClipLipY: number | null = null;
  public pipeClipLipX: number | null = null;

  // Flagpole & Stage Clear State
  public poleSlideY: number = 0;
  public flagY: number = 0;
  public castleWalkTargetX: number = 0;
  public stageClearTallyDelay: number = 0;
  public stageClearDelayTimer: number = 0;
  public timeCountTickCounter: number = 0;

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
  public onSmwStageCompleted?: (nodeId: string) => void;

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
  private ceilingTileColumns: boolean[] = [];

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
    { id: 'question_mushroom', label: 'BLOCO ? POWER', category: 'tile' },
    { id: 'brick', label: 'TIJOLO', category: 'tile' },
    { id: 'hard_block', label: 'BLOCO DURO', category: 'tile' },
    { id: 'goomba', label: 'GOOMBA', category: 'enemy' },
    { id: 'koopa', label: 'KOOPA VERDE', category: 'enemy' },
    { id: 'red_koopa', label: 'KOOPA VERMELHO', category: 'enemy' },
    { id: 'paratroopa', label: 'PARATROOPA', category: 'enemy' },
    { id: 'hammer_bro', label: 'HAMMER BRO', category: 'enemy' },
    { id: 'boo', label: 'FANTASMA BOO', category: 'enemy' },
    { id: 'dry_bones', label: 'DRY BONES', category: 'enemy' },
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
    if (resolvedLevel.isCustom) {
      if (!isRespawn) {
        this.customLevelTemplate = cloneLevelData(resolvedLevel);
        resolvedLevel = cloneLevelData(resolvedLevel);
      } else if (this.customLevelTemplate) {
        resolvedLevel = cloneLevelData(this.customLevelTemplate);
      }
    } else if (!isRespawn) {
      this.customLevelTemplate = null;
      this.isEditorImmortality = false;
      this.infiniteLives = this.isCheatActive;
    }
    this.level = resolvedLevel;
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
    if (!isRespawn) {
      this.isCampaignVictory = false;
    }
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
      this.marioX = newLevel.marioStart.x;
      this.marioY = newLevel.marioStart.y - (this.getMarioHeight() - 16);
      this.camera.snapTo(0, levelWidthPx);
    } else {
      // Respawn after death: strip power-ups (always return as Small Mario)
      this.marioPower = 'small';
      this.marioStarTimer = 0;
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
    this.marioState = 'idle';
    this.marioFacing = 'right';
    this.marioInvulnerableTimer = isRespawn ? 40 : 0;
    this.stats.world =
      newLevel.id === 'world-1-1'
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
      }));

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

    // Start background music
    this.startLevelMusic(newLevel.theme);

    if (!isRespawn && notifyNetwork && newLevel.id !== 'secret-vault' && this.onLevelChanged) {
      this.onLevelChanged(newLevel);
    }
  }

  private generateBackgroundScenery() {
    this.sceneries = [];
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

    // Sonic-Style Debug Mode Object Placement Cursor (free flying + manual item placement)
    if (
      this.isDebugMode &&
      this.isDebugPlacementActive &&
      this.isGameStarted &&
      !this.isStageClear &&
      !this.isGameOver &&
      this.marioState !== 'dead'
    ) {
      this.updateDebugPlacementCursor();
      this.particleSystem.update();
      this.updateCamera();
      this.prevControls = { ...this.controls };
      return;
    }

    // Timer countdown (only counts down when the player has actually started the game!)
    if (this.isGameStarted && !this.isStageClear && this.marioState !== 'dead') {
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

    // Update Floating Platforms (and carry Mario smoothly if riding one)
    this.updateFloatingPlatforms();

    // Update Mario
    this.updateMario(deltaMs);

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

    // Update Items
    this.updateItems();

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
    // 1. Invulnerability timer
    if (this.marioInvulnerableTimer > 0) {
      this.marioInvulnerableTimer--;
    }
    if (this.marioStarTimer > 0) {
      this.marioStarTimer--;
    }

    // 2. Growth / Shrink freeze animations
    if (this.marioGrowthTimer > 0) {
      this.marioGrowthTimer--;
      return;
    }
    if (this.marioShrinkTimer > 0) {
      this.marioShrinkTimer--;
      return;
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

    // 6. Castle walk animation
    if (this.marioState === 'castle_walk') {
      const targetFloorY = 13 * GameEngine.TILE_SIZE - this.getMarioHeight();
      if (this.marioY < targetFloorY) {
        this.marioY = Math.min(targetFloorY, this.marioY + 2.0);
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
      const targetStopX = this.castlePrincessActive && this.level.theme === 'castle'
        ? this.castlePrincessX - 24
        : this.castleToodleActive && this.level.theme === 'castle'
        ? this.castleToodleX - 24
        : this.level.castleX;
      if (this.marioX >= targetStopX) {
        if (hasCastleGreeter) {
          this.marioX = targetStopX;
        }
        this.marioVx = 0;
        this.finishStage();
      }
      return;
    }

    // 7. Castle entered & stage clear time tally countdown sequence
    if (this.marioState === 'castle_entered') {
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
          this.stageClearDelayTimer = this.castlePrincessActive ? 260 : this.castleToodleActive ? 210 : 90;
        }
        return;
      }

      // If time was already 0 before entering castle, wait once
      if (this.stageClearDelayTimer === 0) {
        this.stageClearDelayTimer = this.castlePrincessActive ? 260 : this.castleToodleActive ? 210 : 60;
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

      if (this.stageClearDelayTimer <= 0) {
        this.handleStageClearReadyToAdvance();
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
    const maxSpeed = isUnderwater ? (isRunning ? 2.2 : 1.55) : (isRunning ? 3.4 : 2.0);
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

    // Jumping / Swimming
    const jumpPressed = this.controls.jump && !this.prevControls.jump;
    const jumpMult = this.marioPower === 'femboy' ? Math.SQRT2 : 1;
    if (isUnderwater) {
      if (jumpPressed && !this.isStatue) {
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
      const maxUnderwaterFall = this.controls.jump ? 1.1 : 1.65;
      if (this.marioVy > maxUnderwaterFall) this.marioVy = maxUnderwaterFall;
    } else {
      if (jumpPressed && this.marioGrounded && !this.isStatue) {
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

        if (this.marioPower === 'small') {
          this.sound.playJumpSmall();
        } else {
          this.sound.playJumpSuper();
        }
      }

      // Tanooki Flutter & Cape Glide: holding jump while descending slows fall speed cleanly
      this.isFluttering = false;
      if (this.marioPower === 'cape' && !this.marioGrounded && this.controls.jump && this.marioVy > 0.25) {
        this.isFluttering = true;
        this.marioVy = Math.min(this.marioVy, 0.85); // wide buoyant cape glide
      } else if (this.marioPower === 'tanooki' && !this.marioGrounded && this.controls.jump && this.marioVy > 0.5) {
        this.isFluttering = true;
        this.marioVy = Math.min(this.marioVy, 1.15); // gentle glide / flutter fall
      } else if (this.marioPower === 'cape' && !this.marioGrounded && this.controls.down) {
        // Cape Dive: pressing Down in midair accelerates descent
        this.marioVy = Math.min(7.0, this.marioVy + 0.22);
      }

      // Variable jump height: cut ascent when releasing jump button
      if (!this.controls.jump && this.marioVy < -2.5) {
        this.marioVy = -2.5;
      }

      // Gravity
      const glideGravity = this.marioPower === 'cape' ? 0.05 : 0.08;
      const gravity = this.isFluttering ? glideGravity : (this.marioVy < 0 ? 0.38 : 0.62);
      this.marioVy += gravity;
      if (this.marioVy > 7.0) this.marioVy = 7.0; // Terminal velocity
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

    // Action button pressed (Run button):
    const runPressed = this.controls.run && !this.prevControls.run;
    if (runPressed) {
      if (this.marioPower === 'fire' && this.fireballs.length < 2) {
        this.shootFireball();
      } else if ((this.marioPower === 'tanooki' || this.marioPower === 'cape') && this.tailWhipTimer <= 0) {
        // Tanooki Tail Whip / Cape Spin 360 Sweep!
        this.tailWhipTimer = 18;
        this.sound.playKick();
      }
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
      if (!this.isEditorImmortality && this.controls.run && !this.isStageClear) {
        // Easter Egg: Falling into the abyss while holding Run triggers "ILLEGAL INSTRUCTION" glitched screen
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
          this.marioY = t.tileY * GameEngine.TILE_SIZE - height;
          this.marioVy = 0;
          this.marioGrounded = true;
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

    if (block.type === 'brick' || block.type === 'underground_brick' || block.type === 'ghost_brick') {
      if (block.coinsLeft && block.coinsLeft > 0) {
        block.coinsLeft--;
        this.spawnCoin(tx * GameEngine.TILE_SIZE, (ty - 1) * GameEngine.TILE_SIZE);
        if (block.coinsLeft === 0) {
          block.type = 'question_empty';
        }
      } else if (this.marioPower !== 'small') {
        // Big Mario breaks brick!
        this.level.tiles[ty][tx] = null;
        this.sound.playBrickBreak();
        this.createBrickDebris(tx * GameEngine.TILE_SIZE, ty * GameEngine.TILE_SIZE);
        this.addScore(50, tx * GameEngine.TILE_SIZE, ty * GameEngine.TILE_SIZE);
        this.triggerScreenShake(2.5, 6);
      } else {
        // Small Mario bumps brick
        this.sound.playBump();
      }
    }
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
    } else if (content === 'mushroom') {
      // If Mario already has Super power or above, give Super Leaf / Tanooki or Fire Flower!
      let itemType: 'mushroom' | 'fireflower' | 'leaf' = 'mushroom';
      if (this.marioPower === 'small') {
        itemType = 'mushroom';
      } else if (this.marioPower === 'super') {
        itemType = 'leaf';
      } else {
        itemType = 'fireflower';
      }

      this.sound.playPowerUpAppear();
      this.items.push({
        id: this.nextEntityId++,
        type: itemType,
        x,
        y: y,
        vx: itemType === 'leaf' ? 0 : 1.2,
        vy: itemType === 'leaf' ? -2.0 : 0,
        width: 16,
        height: 16,
        grounded: false,
        collected: false,
        emerging: true,
        emergeY: itemType === 'leaf' ? y - 24 : y - 16,
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

  public createBrickDebris(x: number, y: number) {
    this.particleSystem.emitBrickBreak(x, y, this.level.theme);
  }

  // --- ENEMIES UPDATE ---
  private updateEnemies() {
    const marioBox = this.getMarioHitbox();

    this.enemies.forEach(e => {
      if (!e.alive && e.state !== 'flipped' && e.state !== 'squashed') return;

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
            this.marioHitEnemy(e, false);
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
            this.marioHitEnemy(e, false);
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
            e.y = t.tileY * GameEngine.TILE_SIZE - e.height;
            e.vy = 0;
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
          // Bowser cannot be stomped from above!
          this.marioHitEnemy(e, false);
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
          const isStomp = this.marioVy > 0 && prevMarioBottom <= e.y + (isShell ? 12 : 9);
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
    // Starman kills everything except lava sparks
    if (this.marioStarTimer > 0) {
      if (e.type === 'lava_bubble') return;
      e.alive = false;
      e.state = 'flipped';
      e.vy = -5;
      this.sound.playKick();
      this.triggerLargeEnemyImpactShake(e);
      this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
      if (e.type === 'bowser') {
        this.addScore(5000, e.x, e.y, 'BOWSER!');
      } else {
        this.addScore(200, e.x, e.y);
      }
      return;
    }

    if (isStomp) {
      if (e.type === 'goomba') {
        e.alive = false;
        e.state = 'squashed';
        this.sound.playStomp();
        this.marioVy = -6.0; // Stomp bounce
        this.triggerScreenShake(1.5, 4);
        this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
        this.awardStompCombo(e.x, e.y);
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

    if (this.marioPower === 'tanooki' || this.marioPower === 'femboy' || this.marioPower === 'cape') {
      // Tanooki, Femboy, and Cape power-ups downgrade to Super Mario on damage
      this.marioPower = 'super';
      this.marioInvulnerableTimer = 120;
      this.marioShrinkTimer = 25;
      this.sound.playPipe();
      this.triggerScreenShake(2.0, 6);
    } else if (this.marioPower === 'fire' || this.marioPower === 'super') {
      // Super Mario absorbs the hit, retains player life, and reverts to Small Mario
      this.marioPower = 'small';
      this.marioY += 16; // Anchors feet on ground so Mario does not hover
      this.marioInvulnerableTimer = 120; // 2 seconds flashing invulnerability
      this.marioShrinkTimer = 32; // Freeze frames for shrink animation
      this.sound.playPipe();
      this.triggerScreenShake(2.5, 7);
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
    this.marioState = 'dead';
    this.marioPower = 'small'; // Abyss or damage always removes power-ups
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
  }

  private handleLifeLost() {
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

      // Coin collected in air
      if (item.type === 'coin') {
        if (this.rectsIntersect(marioBox, { x: item.x, y: item.y, width: 16, height: 16 })) {
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
        }
        return;
      }

      // Super Leaf & Cape Feather floating physics: gentle side-to-side oscillation and slow fall
      if (item.type === 'leaf' || item.type === 'feather') {
        const swayFreq = item.type === 'feather' ? 175 : 200;
        const swayAmp = item.type === 'feather' ? 1.35 : 1.2;
        const fallSpeed = item.type === 'feather' ? 0.65 : 0.75;
        item.x += Math.sin(Date.now() / swayFreq) * swayAmp;
        item.y += fallSpeed;
      } else {
        // Moving items (Mushroom, Star, 1UP)
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
                item.vy = -5.5; // Star bounces high
              } else {
                item.vy = 0;
              }
              break;
            }
          }
        }
      }

      // Mario touches item
      if (this.rectsIntersect(marioBox, { x: item.x, y: item.y, width: 16, height: 16 })) {
        item.collected = true;
        this.collectItem(item);
      }
    });

    this.items = this.items.filter(i => !i.collected);
  }

  private collectItem(item: Item) {
    if (item.type === 'leaf') {
      this.sound.playPowerUpEat();
      const prevPower = this.marioPower;
      this.marioPower = 'tanooki';
      if (prevPower === 'small') {
        this.marioY -= 16;
      }
      this.marioGrowthTimer = 36;
      this.addScore(1000, item.x, item.y, 'TANOOKI!');
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
    } else if (item.type === 'feather') {
      this.sound.playPowerUpEat();
      const prevPower = this.marioPower;
      this.marioPower = 'cape';
      if (prevPower === 'small') {
        this.marioY -= 16;
      }
      this.marioGrowthTimer = 36;
      this.addScore(1000, item.x, item.y, 'PENA!');
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
    } else if (item.type === 'femboy') {
      this.sound.playPowerUpEat();
      const prevPower = this.marioPower;
      this.marioPower = 'femboy';
      if (prevPower === 'small') {
        this.marioY -= 16;
      }
      this.marioGrowthTimer = 36;
      this.addScore(1000, item.x, item.y, 'FEMBOY!');
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
    } else if (item.type === 'mushroom') {
      this.sound.playPowerUpEat();
      const prevPower = this.marioPower;
      this.marioPower = 'super';
      if (prevPower === 'small') {
        this.marioY -= 16; // Shift up 16px so feet remain anchored on the ground
      }
      this.marioGrowthTimer = 36;
      this.addScore(1000, item.x, item.y, 'SUPER!');
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
    } else if (item.type === 'fireflower') {
      this.sound.playPowerUpEat();
      const prevPower = this.marioPower;
      this.marioPower = 'fire';
      if (prevPower === 'small') {
        this.marioY -= 16;
      }
      this.marioGrowthTimer = 36;
      this.addScore(1000, item.x, item.y, 'FIRE!');
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
    } else if (item.type === 'star') {
      this.sound.playPowerUpEat();
      this.marioStarTimer = 600; // ~10 seconds of invincibility
      this.addScore(1000, item.x, item.y, 'STAR!');
      this.spawnPowerUpSparkles(this.marioX, this.marioY);
    } else if (item.type === '1up') {
      this.sound.playPowerUpEat();
      this.stats.lives++;
      this.addScore(1000, item.x, item.y, '1-UP');
    }
  }

  public spawnPowerUpSparkles(x: number, y: number) {
    this.particleSystem.emitPowerUpSparkles(x, y);
  }

  // --- FIREBALLS UPDATE ---
  private shootFireball() {
    this.sound.playFireball();
    const dir = this.marioFacing === 'right' ? 1 : -1;
    this.fireballs.push({
      id: this.nextEntityId++,
      x: this.marioFacing === 'right' ? this.marioX + 14 : this.marioX - 4,
      y: this.marioY + 8,
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
          if (e.type === 'boo') {
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
              this.addScore(5000, e.x, e.y, 'BOWSER!');
              if (fb.color === 'white') {
                this.spawnFemboyHeartParticle(e.x + e.width / 2, e.y + 4);
              }
            } else {
              this.addScore(100, e.x, e.y);
            }
            return;
          }
          e.alive = false;
          e.state = 'flipped';
          e.vy = -5;
          this.sound.playKick();
          this.spawnEnemyDefeatParticles(e.x, e.y, e.type);
          if (fb.color === 'white') {
            this.spawnFemboyHeartParticle(e.x + e.width / 2, e.y);
          }
          this.addScore(200, e.x, e.y);
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
        this.addScore(5000, e.x, e.y, 'BOWSER!');
      }
    });

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
  public spawnCoinParticles(x: number, y: number) {
    this.particleSystem.emitCoinSparkles(x, y);
  }

  // Helper to spawn impact stars, debris fragments, and poof clouds when defeating an enemy
  public spawnEnemyDefeatParticles(x: number, y: number, enemyType?: EnemyType) {
    this.particleSystem.emitEnemyDefeat(x, y, enemyType);
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
      this.sound.playPowerUpEat();
    } else {
      const prevPower = this.marioPower;
      this.marioPower = power;
      if (prevPower === 'small' && power !== 'small') {
        this.marioY -= 16;
      } else if (prevPower !== 'small' && power === 'small') {
        this.marioY += 16;
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

  public toggleDebugMode(force?: boolean): boolean {
    const next = force !== undefined ? force : !this.isDebugMode;
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
    if (!this.isDebugMode) {
      this.toggleDebugMode(true);
    }
    if (
      this.marioState === 'dead' ||
      this.isStageClear ||
      this.isGameOver ||
      this.isIllegalInstructionBug
    ) {
      this.isDebugPlacementActive = false;
      return false;
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
    const total = GameEngine.DEBUG_PLACEABLES.length;
    this.debugPlaceIndex = (this.debugPlaceIndex + delta + total) % total;
    this.sound.playDebugCycle();
    return this.getCurrentDebugPlaceable();
  }

  public placeDebugItemAt(worldX?: number, worldY?: number): boolean {
    if (!this.isDebugMode) return false;
    const spec = this.getCurrentDebugPlaceable();
    const maxPxX = Math.max(0, this.level.width * GameEngine.TILE_SIZE - 16);
    const px = Math.max(0, Math.min(maxPxX, Math.round(worldX ?? this.marioX)));
    const py = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 16, Math.round(worldY ?? this.marioY)));

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
      } else if (spec.id === 'question_mushroom') {
        newTile = { type: 'question', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };
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

        this.marioState = 'pipe_entering';
        this.isStatue = false;
        this.stompComboCount = 0;
        this.marioVx = 0;
        this.marioVy = 0;
        this.warpTimer = 0;
        this.warpTarget = { toLevel: pw.toLevel, toPos: pw.toPos };
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
    const returningFromSubArea = this.level.id === 'secret-vault';

    if (targetLevelId === 'secret-vault') {
      this.loadLevel(createSecretVault(), false, false, false);
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
      targetLevelId === 'world-2-2'
    ) {
      if (targetLevelId === 'world-1-1') {
        this.loadLevel(createWorld1_1(), false, false, !returningFromSubArea);
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
            this.addScore(5000, e.x, e.y, 'BOWSER!');
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
      }
    });

    // Bump or break adjacent blocks with tail
    const hitTileX = Math.floor((this.marioFacing === 'right' ? this.marioX + 18 : this.marioX - 6) / GameEngine.TILE_SIZE);
    const hitTileY = Math.floor((this.marioY + 12) / GameEngine.TILE_SIZE);
    if (hitTileX >= 0 && hitTileX < this.level.width && hitTileY >= 0 && hitTileY < this.level.height) {
      const block = this.level.tiles[hitTileY][hitTileX];
      if (block && (block.type === 'brick' || block.type === 'underground_brick' || block.type === 'ghost_brick' || block.type === 'question')) {
        this.hitBlock(hitTileX, hitTileY, block);
        this.triggerScreenShake(2.0, 5);
      }
    }
  }

  private checkFlagpoleCollision() {
    if (this.isStageClear || this.marioState === 'pole_slide' || this.marioState === 'castle_walk' || this.marioState === 'castle_entered') return;

    if (this.marioX >= this.level.flagX - 6 && this.marioX <= this.level.flagX + 8) {
      // Grab the flagpole!
      this.marioState = 'pole_slide';
      this.marioVx = 0;
      this.marioVy = 0;
      this.marioX = this.level.flagX - 4;
      this.sound.playFlagpole();

      // Points based on how high Mario grabbed pole
      const heightGrabbed = 12 * GameEngine.TILE_SIZE - this.marioY;
      const polePoints = heightGrabbed > 100 ? 5000 : heightGrabbed > 60 ? 2000 : 800;
      this.addScore(polePoints, this.level.flagX, this.marioY);
      this.onMultiplayerSyncNeeded?.();
    }
  }

  private finishStage() {
    if (this.marioState === 'castle_entered') return;
    this.isStageClear = true;
    this.marioState = 'castle_entered';
    this.stageClearTallyDelay = 40;
    this.stageClearDelayTimer = 0;
    this.timeCountTickCounter = 0;
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
    if (this.level.isCustom && this.customLevelTemplate) {
      this.loadLevel(cloneLevelData(this.customLevelTemplate), true, false);
      return;
    }
    if (this.gameMode === 'smw_world_map' && this.level.smwNodeId) {
      const clearedNodeId = this.level.smwNodeId;
      this.isStageClear = false;
      this.syncHighScore(true);
      this.persistRunScoreToRanking();
      this.sound.stopMusic();
      this.onSmwStageCompleted?.(clearedNodeId);
      return;
    }
    if (this.level.isFinalCastle) {
      this.isCampaignVictory = true;
      this.isStageClear = false;
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

    this.stats = {
      score: 0,
      coins: 0,
      world: '1-1',
      time: initialTime,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: topScore,
      difficulty: this.difficulty,
      isNewHighScore: false,
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

    this.stats = {
      score: 0,
      coins: 0,
      world: customLevel.name || 'CUSTOM',
      time: customLevel.timeLimit || 400,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: topScore,
      difficulty: this.difficulty,
      isNewHighScore: false,
    };

    this.isPaused = false;
    this.isGameStarted = true;
    this.endlessStage = 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    const prepared: LevelData = { ...cloneLevelData(customLevel), isCustom: true };
    this.loadLevel(prepared, true, false);
  }

  public startSingleplayerCampaign(world: number = 1, stage: number = 1) {
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
    };

    this.isPaused = false;
    this.isGameStarted = true;
    this.endlessStage = 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    this.loadLevel(firstLevel, true, false);
  }

  public startSmwStage(level: LevelData, resetSession: boolean = false) {
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
      this.stats = {
        score: 0,
        coins: 0,
        world: level.name,
        time: level.timeLimit,
        lives: this.infiniteLives ? 99 : initialLives,
        highScore: topScore,
        difficulty: this.difficulty,
        isNewHighScore: false,
      };
      this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    }

    this.isPaused = false;
    this.isGameStarted = true;
    this.isGameOver = false;
    this.endlessStage = 0;
    this.marioStarTimer = 0;
    this.loadLevel(level, true, false);
  }

  public restartGame() {
    if (this.level?.isCustom && this.customLevelTemplate) {
      this.playCustomLevel(this.customLevelTemplate, this.isEditorImmortality);
      return;
    }

    if (this.gameMode === 'smw_world_map' && this.level?.smwNodeId) {
      this.startSmwStage(createSmwWikiWorldStage(this.level.smwNodeId), true);
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

    this.stats = {
      score: 0,
      coins: 0,
      world: '1-1',
      time: initialTime,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: topScore,
      difficulty: this.difficulty,
      isNewHighScore: false,
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
    this.gameMode = 'classic';
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
      type === 'ghost_brick'
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

    // 4. Flagpole & Flag
    this.renderFlagpole(ctx);

    // 5. Items
    this.renderItems(ctx);

    // 6. Enemies
    this.renderEnemies(ctx);

    // 7. Fireballs
    this.renderFireballs(ctx);

    // 8. Remote Players (Multiplayer by IP)
    this.renderRemotePlayers(ctx);

    // 9. Toodle / Princesa Femboy (Castle Victory Chamber)
    this.renderCastleToodle(ctx);
    this.renderCastlePrincess(ctx);

    // 10. Mario / WazzimaGiygg (or Sonic Debug Placement Cursor)
    this.renderMario(ctx);
    if (this.isDebugMode && this.isDebugPlacementActive) {
      this.renderDebugCursor(ctx);
    }

    // 11. Particles & Floating Scores
    this.particleSystem.render(ctx, camX, GameEngine.NES_WIDTH, this.atlas);

    ctx.restore();

    // 12. Castle Dialogue Overlays + In-Canvas Pixel HUD
    this.renderCastleToodleDialogue(ctx);
    this.renderCastlePrincessDialogue(ctx);
    this.renderInCanvasHUD(ctx);

    // 13. Easter Egg: "ILLEGAL INSTRUCTION" Glitched Screen Effect
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

    // 2. MULTIPLAYER BADGE (If other players connected via IP)
    if (this.remotePlayers.size > 0) {
      drawShadowText('2P ON', 84, 12, '#38f838');
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

    ctx.restore();
  }

  private renderScenery(ctx: CanvasRenderingContext2D) {
    const camX = this.camera.renderX;
    if (this.level.theme === 'underwater') {
      const waterEndScreenX =
        this.level.dryFinishStartX !== undefined
          ? Math.min(GameEngine.NES_WIDTH, Math.round(this.level.dryFinishStartX - camX))
          : GameEngine.NES_WIDTH;

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
          this.drawCloud(ctx, sx, s.y, 32);
        } else if (s.type === 'bush_small') {
          this.drawBush(ctx, sx, s.y, 32);
        }
      });
      return;
    }

    if (this.level.theme === 'ghost_house') {
      const flicker = Math.floor(Date.now() / 140) % 2;
      const mistShift = Math.sin(Date.now() / 900) * 6;
      this.sceneries.forEach(s => {
        const sx = Math.round(s.x - camX);
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

    this.sceneries.forEach(s => {
      const sx = Math.round(s.x - camX);
      if (sx < -80 || sx > GameEngine.NES_WIDTH + 80) return;

      if (s.type === 'cloud_med') {
        this.drawCloud(ctx, sx, s.y, 32);
      } else if (s.type === 'cloud_large') {
        this.drawCloud(ctx, sx, s.y, 48);
      } else if (s.type === 'hill_large') {
        this.drawHill(ctx, sx, s.y, 48, 35);
      } else if (s.type === 'hill_small') {
        this.drawHill(ctx, sx, s.y, 32, 20);
      } else if (s.type === 'bush_large') {
        this.drawBush(ctx, sx, s.y, 48);
      } else if (s.type === 'bush_small') {
        this.drawBush(ctx, sx, s.y, 32);
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
          case 'brick':
            ctx.drawImage(this.atlas.tileBrick, screenX, screenY);
            break;
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
          case 'hard_block':
            ctx.drawImage(this.atlas.tileHardBlock, screenX, screenY);
            break;
          case 'pipe_top_left':
          case 'pipe_warp_top_left':
            ctx.drawImage(this.atlas.pipeTopLeft, screenX, screenY);
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

  private renderFlagpole(ctx: CanvasRenderingContext2D) {
    const poleScreenX = Math.round(this.level.flagX - this.camera.renderX);
    if (poleScreenX < -32 || poleScreenX > GameEngine.NES_WIDTH + 32) return;

    // Draw Flag attached to pole
    ctx.drawImage(this.atlas.flagTriangle, poleScreenX - 14, Math.round(this.flagY));
  }

  private renderItems(ctx: CanvasRenderingContext2D) {
    const camX = this.camera.renderX;
    const coinFrame = Math.floor((Date.now() / 120) % 4);
    const flowerFrame = Math.floor((Date.now() / 100) % 4);

    this.items.forEach(item => {
      const ix = Math.round(item.x - camX);
      const iy = Math.round(item.y);
      if (ix < -16 || ix > GameEngine.NES_WIDTH + 16) return;

      if (item.type === 'leaf') {
        ctx.drawImage(this.atlas.itemSuperLeaf, ix, iy);
      } else if (item.type === 'feather') {
        ctx.drawImage(this.atlas.itemFeather, ix, iy);
      } else if (item.type === 'mushroom') {
        ctx.drawImage(this.atlas.itemMushroomSuper, ix, iy);
      } else if (item.type === '1up') {
        ctx.drawImage(this.atlas.itemMushroom1Up, ix, iy);
      } else if (item.type === 'fireflower') {
        ctx.drawImage(this.atlas.itemFireFlowerFrames[flowerFrame], ix, iy);
      } else if (item.type === 'coin') {
        ctx.drawImage(this.atlas.itemCoinFrames[coinFrame], ix, iy);
      } else if (item.type === 'star') {
        ctx.drawImage(this.atlas.itemFireFlowerFrames[flowerFrame], ix, iy);
      } else if (item.type === 'femboy') {
        ctx.drawImage(this.atlas.itemFemboy, ix, iy);
      }
    });
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
    const line1 = `OBRIGADO, ${heroName}!`;
    const line2 = isWikiCastle ? 'CASTELO DE JOHANNNNES89' : 'MAS A NOSSA PRINCESA';
    const line3 = isWikiCastle ? 'ESTÁ LIVRE DE BOWSER!' : 'ESTÁ EM OUTRO CASTELO!';
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
      case 'question_mushroom':
        sprite = this.atlas.tileQuestionFrames[Math.floor((Date.now() / 180) % 3)];
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
    if (this.marioState === 'castle_entered' && !this.castleToodleActive && !this.castlePrincessActive) {
      return;
    }

    // Blinking during invulnerability (or translucent silhouette when using Sonic Debug Cursor)
    if (this.marioInvulnerableTimer > 0 && Math.floor(this.marioInvulnerableTimer / 4) % 2 === 0) {
      return;
    }

    // Subtract smooth float camera before rounding so Mario stays rock-steady during high-speed tracking
    const mx = Math.round(this.marioX - this.camera.x);
    const my = Math.round(this.marioY);

    ctx.save();
    if (this.isDebugMode && this.isDebugPlacementActive) {
      ctx.globalAlpha = 0.28;
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

    // Authentic NES Growth Animation (Flickering between small and super sprites with anchored feet)
    if (this.marioGrowthTimer > 0) {
      const isSmallFlicker = Math.floor(this.marioGrowthTimer / 4) % 2 === 1;
      const isW = this.playerCharacter === 'wazzima';
      const sprite = isSmallFlicker
        ? (isW ? this.atlas.wazzimaSmallIdle : this.atlas.marioSmallIdle)
        : (this.marioPower === 'tanooki'
            ? (isW ? this.atlas.wazzimaTanookiIdle : this.atlas.marioTanookiIdle)
            : this.marioPower === 'cape'
            ? (isW ? this.atlas.wazzimaCapeIdle : this.atlas.marioCapeIdle)
            : this.marioPower === 'femboy'
            ? (isW ? this.atlas.wazzimaFemboyIdle : this.atlas.marioFemboyIdle)
            : (isW ? this.atlas.wazzimaSuperIdle : this.atlas.marioSuperIdle));
      const drawY = isSmallFlicker ? my + 16 : my;
      ctx.drawImage(sprite, mx, drawY);
      ctx.restore();
      return;
    }

    // Authentic NES Shrink Animation (Flickering between super and small sprites with anchored feet)
    if (this.marioShrinkTimer > 0) {
      const isSuperFlicker = Math.floor(this.marioShrinkTimer / 4) % 2 === 1;
      const isW = this.playerCharacter === 'wazzima';
      const sprite = isSuperFlicker
        ? (isW ? this.atlas.wazzimaSuperIdle : this.atlas.marioSuperIdle)
        : (isW ? this.atlas.wazzimaSmallIdle : this.atlas.marioSmallIdle);
      const drawY = isSuperFlicker ? my - 16 : my;
      ctx.drawImage(sprite, mx, drawY);
      ctx.restore();
      return;
    }

    // Get current character sprite (Mario or WazzimaGiygg)
    const spriteCanvas = this.atlas.getCharacterSprite(
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

    if (spriteCanvas) {
      ctx.drawImage(spriteCanvas, mx, my);
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

  // --- MULTIPLAYER REMOTE PLAYERS RENDERING ---
  private renderRemotePlayers(ctx: CanvasRenderingContext2D) {
    if (this.remotePlayers.size === 0) return;

    this.remotePlayers.forEach(rp => {
      // Discard stale players (no updates in 15 seconds)
      if (Date.now() - rp.lastUpdated > 15000) return;
      if (rp.state === 'castle_entered') return;

      // Smooth interpolation toward latest network position
      if (rp.renderX === undefined || Math.abs(rp.x - rp.renderX) > 96) {
        rp.renderX = rp.x;
      } else {
        rp.renderX += (rp.x - rp.renderX) * 0.35;
      }
      if (rp.renderY === undefined || Math.abs(rp.y - rp.renderY) > 96) {
        rp.renderY = rp.y;
      } else {
        rp.renderY += (rp.y - rp.renderY) * 0.35;
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
      if (rp.invulnerable && Math.floor(Date.now() / 80) % 2 === 0) {
        ctx.restore();
        return;
      }

      const spriteCanvas = this.atlas.getCharacterSprite(
        rp.character,
        rp.power,
        rp.state,
        rp.animFrame,
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

      // Overhead player tag
      ctx.save();
      const badgeY = py - 8;
      const isW = rp.character === 'wazzima';
      const badgeColor = isW ? '#00a800' : '#d82800';
      const nameText = (rp.name || (isW ? 'WazzimaGiygg' : 'Mario')).substring(0, 12);

      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      const textWidth = ctx.measureText(nameText).width;
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
