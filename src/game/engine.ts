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
  Item,
  Fireball,
  Particle,
  LevelData,
  GameStats,
  GamepadControls,
  TileType,
  GameDifficulty,
  PlayerCharacter,
  RemotePlayerState,
  MultiplayerMatchPlayerStanding,
  MultiplayerMatchResult,
} from './types.ts';
import { SpriteAtlas, NES_COLORS } from './sprites.ts';
import { SoundEngine } from './audio.ts';
import { createWorld1_1, createSecretVault, createWorld1_2, createWorld2_2, createWorld1_4, createEndlessLevel } from './levels.ts';

export class GameEngine {
  // Screen Dimensions (NES native 256x240)
  public static readonly NES_WIDTH = 256;
  public static readonly NES_HEIGHT = 240;
  public static readonly TILE_SIZE = 16;

  // Level State
  public level!: LevelData;
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

  // Tanooki Suit State
  public tailWhipTimer: number = 0;
  public isFluttering: boolean = false;
  public isStatue: boolean = false;

  // Screen-Shake Effect (Heavy Landings, Explosions, Boss/Ground Pounds)
  public screenShakeTimer: number = 0;
  public screenShakeIntensity: number = 0;
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
  public particles: Particle[] = [];

  // Castle Axe & Bridge Collapse State
  public bridgeCollapseQueue: { tx: number; ty: number }[] = [];
  public bridgeCollapseTimer: number = 0;

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
    highScore: 10000,
    difficulty: 'normal',
  };

  // Cheat Mode State (Unlocked with "lula132026")
  public isCheatActive: boolean = false;
  public infiniteLives: boolean = false;

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
    this.level = newLevel;
    this.isStageClear = false;
    this.isGameOver = false;
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
    this.pipeClipLipY = null;
    this.pipeClipLipX = null;
    this.bridgeCollapseQueue = [];
    this.bridgeCollapseTimer = 0;
    this.bossFireballs = [];
    if (newLevel.endlessStage !== undefined) {
      this.endlessStage = newLevel.endlessStage;
    } else if (
      newLevel.id === 'world-1-1' ||
      newLevel.id === 'world-1-2' ||
      newLevel.id === 'world-2-2' ||
      newLevel.id === 'world-1-4'
    ) {
      this.endlessStage = 0;
    }

    if (!isRespawn) {
      // Fresh stage entry: clear checkpoints and start at initial position
      this.activeCheckpoint = null;
      this.activatedCheckpointIndices.clear();
      this.cameraX = 0;
      this.marioX = newLevel.marioStart.x;
      this.marioY = newLevel.marioStart.y - (this.getMarioHeight() - 16);
    } else {
      // Respawn after death: strip power-ups (always return as Small Mario)
      this.marioPower = 'small';
      this.marioStarTimer = 0;
      if (this.activeCheckpoint) {
        this.marioX = this.activeCheckpoint.x;
        this.marioY = this.activeCheckpoint.y;
        this.cameraX = Math.max(0, this.activeCheckpoint.x - 80);
      } else {
        this.marioX = newLevel.marioStart.x;
        this.marioY = newLevel.marioStart.y;
        this.cameraX = 0;
      }
    }

    // Ensure camera stays within stage boundaries
    const maxCamX = this.level.width * GameEngine.TILE_SIZE - GameEngine.NES_WIDTH;
    if (this.cameraX > maxCamX) {
      this.cameraX = Math.max(0, maxCamX);
    }

    this.marioVx = 0;
    this.marioVy = 0;
    this.marioGrounded = false;
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
        : newLevel.id === 'world-1-4'
        ? '1-4'
        : newLevel.name;
    const timeBonus = this.difficulty === 'easy' ? 80 : this.difficulty === 'hard' ? -80 : 0;
    this.stats.time = Math.max(150, newLevel.timeLimit + timeBonus);
    this.stats.difficulty = this.difficulty;
    this.flagY = 3 * GameEngine.TILE_SIZE;

    const speedMult = newLevel.enemySpeedMultiplier ?? 1;
    const bowserHp = 5 + Math.floor(((newLevel.endlessStage || 1) - 1) / 4) * 2;

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
        vx: e.type === 'bowser' ? -0.45 * speedMult : -0.7 * speedMult,
        vy: 0,
        width: e.type === 'bowser' ? 24 : 16,
        height: e.type === 'bowser' ? 24 : e.type === 'koopa' ? 24 : 16,
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
        fireTimer: e.type === 'bowser' ? 50 : undefined,
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
    this.particles = [];
    this.generateBackgroundScenery();

    // Start background music
    if (newLevel.theme === 'underground') {
      this.sound.playMusic('underground');
    } else if (newLevel.theme === 'castle') {
      this.sound.playMusic('castle');
    } else if (newLevel.theme === 'underwater') {
      this.sound.playMusic('underwater');
    } else {
      this.sound.playMusic('overworld');
    }

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

    // Timer countdown (only counts down when the player has actually started the game!)
    if (this.isGameStarted && !this.isStageClear && this.marioState !== 'dead') {
      this.timeAccumulator += deltaMs;
      if (this.timeAccumulator >= 600) {
        this.timeAccumulator = 0;
        if (this.stats.time > 0) {
          this.stats.time--;
          if (this.stats.time === 0) {
            this.killMario();
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
          this.particles.push({
            id: this.nextEntityId++,
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
      this.updateParticles();
      this.prevControls = { ...this.controls };
      return;
    }

    // Update Mario
    this.updateMario(deltaMs);

    // Update Enemies
    this.updateEnemies();

    // Update Items
    this.updateItems();

    // Update Fireballs
    this.updateFireballs();
    this.updateBossFireballs();

    // Update Particles
    this.updateParticles();

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

    // 4. Pipe entering animation (sinking into pipe)
    if (this.marioState === 'pipe_entering') {
      this.warpTimer++;
      if (this.warpDir === 'down') {
        this.marioY += 0.7;
      } else {
        this.marioX += 0.7;
      }
      if (this.warpTimer >= 48) {
        this.finishPipeWarp();
      }
      return;
    }

    // 4b. Pipe exiting animation (rising smoothly out of pipe)
    if (this.marioState === 'pipe_exiting') {
      this.warpTimer++;
      if (this.pipeExitDir === 'up') {
        this.marioY -= 0.7;
      } else if (this.pipeExitDir === 'down') {
        this.marioY += 0.7;
      } else {
        this.marioX += 0.7;
      }
      if (this.warpTimer >= 48) {
        this.marioState = 'idle';
        this.pipeClipLipY = null;
        this.pipeClipLipX = null;
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

      // Enter castle door
      if (this.marioX >= this.level.castleX) {
        this.finishStage();
      }
      return;
    }

    // 7. Castle entered & stage clear time tally countdown sequence
    if (this.marioState === 'castle_entered') {
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
        if (!this.isCheatActive && this.stats.score > this.stats.highScore) {
          this.stats.highScore = this.stats.score;
        }

        this.timeCountTickCounter++;
        if (this.timeCountTickCounter % 2 === 0 || dec > 1) {
          this.sound.playCountTick();
        }

        // Establish post-countdown delay once time points reach 0
        if (this.stats.time === 0) {
          this.stageClearDelayTimer = 90; // ~1.5 seconds post-tally delay to admire final score
        }
        return;
      }

      // If time was already 0 before entering castle, wait 60 frames once
      if (this.stageClearDelayTimer === 0) {
        this.stageClearDelayTimer = 60;
        return;
      }

      this.stageClearDelayTimer--;
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
        this.particles.push({
          id: this.nextEntityId++,
          type: 'bubble',
          x: this.marioX + (this.marioFacing === 'right' ? 12 : 2),
          y: this.marioY + 4,
          vx: 0,
          vy: -0.65,
          life: 0,
          maxLife: 90,
          size: 3,
        });
      }

      // Gentle ambient bubbles while swimming
      if (Math.random() < 0.03) {
        this.particles.push({
          id: this.nextEntityId++,
          type: 'bubble',
          x: this.marioX + (this.marioFacing === 'right' ? 12 : 2),
          y: this.marioY + 4,
          vx: 0,
          vy: -0.5,
          life: 0,
          maxLife: 80,
          size: 2,
        });
      }

      // Buoyant underwater gravity
      this.isFluttering = false;
      this.marioVy += 0.085;
      const maxUnderwaterFall = this.controls.jump ? 1.1 : 1.65;
      if (this.marioVy > maxUnderwaterFall) this.marioVy = maxUnderwaterFall;
    } else {
      if (jumpPressed && this.marioGrounded && !this.isStatue) {
        const jumpImpulse = (isRunning ? -8.4 : -7.4) * jumpMult;
        this.marioVy = jumpImpulse;
        this.marioGrounded = false;
        this.marioState = 'jumping';

        if (this.marioPower === 'small') {
          this.sound.playJumpSmall();
        } else {
          this.sound.playJumpSuper();
        }
      }

      // Tanooki Flutter / Slow Fall: holding or tapping jump while descending flutters tail and limits fall speed
      this.isFluttering = false;
      if (this.marioPower === 'tanooki' && !this.marioGrounded && this.controls.jump && this.marioVy > 0.5) {
        this.isFluttering = true;
        this.marioVy = Math.min(this.marioVy, 1.15); // gentle glide / flutter fall
      }

      // Variable jump height: cut ascent when releasing jump button
      if (!this.controls.jump && this.marioVy < -2.5) {
        this.marioVy = -2.5;
      }

      // Gravity
      const gravity = this.isFluttering ? 0.08 : (this.marioVy < 0 ? 0.38 : 0.62);
      this.marioVy += gravity;
      if (this.marioVy > 7.0) this.marioVy = 7.0; // Terminal velocity
    }

    // Check Pipe Warp: Down key on vertical pipe or Right key against horizontal pipe
    if (this.marioGrounded && (this.controls.down || this.controls.right)) {
      this.checkPipeWarp();
    }

    // Action button pressed (Run button):
    const runPressed = this.controls.run && !this.prevControls.run;
    if (runPressed) {
      if (this.marioPower === 'fire' && this.fireballs.length < 2) {
        this.shootFireball();
      } else if (this.marioPower === 'tanooki' && this.tailWhipTimer <= 0) {
        // Tanooki Tail Whip 360 Spin!
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
          this.particles.push({
            id: this.nextEntityId++,
            type: 'score_text',
            text: 'CHECKPOINT!',
            x: this.marioX - 24,
            y: this.marioY - 20,
            vx: 0,
            vy: -1.0,
            life: 0,
            maxLife: 60,
          });
        }
      });
    }

    // Check Pit Fall Death (Abyss)
    if (this.marioY > GameEngine.NES_HEIGHT + 16) {
      this.killMario(true);
    }
  }

  // --- COLLISION RESOLUTION ---
  private moveMarioWithCollision() {
    const width = 14;
    const height = this.getMarioHeight();

    // Horizontal Movement
    this.marioX += this.marioVx;

    // Prevent moving backwards past the camera left edge
    if (this.marioX < this.cameraX) {
      this.marioX = this.cameraX;
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

          // Heavy Landing Screen-Shake: triggers when falling from high drops (impactVy >= 5.5) or slamming down as Tanooki Statue
          if (impactVy >= 5.5 || this.isStatue) {
            const intensity = this.isStatue ? 4.5 : Math.min(5.0, (impactVy - 4.5) * 2.2);
            this.triggerScreenShake(intensity, 12);
            this.sound.playBump();
            // Emit landing dust/impact particles
            this.particles.push({
              id: this.nextEntityId++,
              type: 'smoke',
              x: this.marioX - 4,
              y: this.marioY + height - 4,
              vx: -1.2,
              vy: -0.5,
              life: 0,
              maxLife: 15,
            });
            this.particles.push({
              id: this.nextEntityId++,
              type: 'smoke',
              x: this.marioX + 12,
              y: this.marioY + height - 4,
              vx: 1.2,
              vy: -0.5,
              life: 0,
              maxLife: 15,
            });
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
        this.spawnEnemyDefeatParticles(e.x, e.y);
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
        this.particles.push({
          id: this.nextEntityId++,
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

    if (block.type === 'brick' || block.type === 'underground_brick') {
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
    this.particles.push({
      id: this.nextEntityId++,
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
    const velocities = [
      { vx: -2.2, vy: -5.2, rot: -0.16 },
      { vx: 2.2, vy: -5.2, rot: 0.16 },
      { vx: -1.4, vy: -3.2, rot: -0.11 },
      { vx: 1.4, vy: -3.2, rot: 0.11 },
    ];

    velocities.forEach(v => {
      this.particles.push({
        id: this.nextEntityId++,
        type: 'brick_piece',
        x: x + 4,
        y: y + 4,
        vx: v.vx,
        vy: v.vy,
        life: 0,
        maxLife: 42,
        rotation: 0,
        rotSpeed: v.rot,
        gravity: 0.38,
      });
    });

    // Dust and smoke puffs around shattered brick
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      this.particles.push({
        id: this.nextEntityId++,
        type: 'smoke',
        x: x + 6,
        y: y + 6,
        vx: Math.cos(angle) * 1.5,
        vy: Math.sin(angle) * 1.5 - 0.4,
        life: 0,
        maxLife: 18,
        size: 3 + (i % 2),
      });
    }
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
        return;
      }

      // Cheep-Cheep (Swimming fish AI)
      if (e.type === 'cheep_cheep') {
        e.stateTimer++;
        e.animTimer++;
        if (e.animTimer % 10 === 0) {
          e.animFrame = (e.animFrame + 1) % 2;
        }
        e.x += e.vx;
        e.y += Math.sin(e.stateTimer * 0.06) * 0.35;
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

      // Walking enemy animation (Goomba & Koopa)
      e.animTimer++;
      if (e.animTimer % 10 === 0) {
        e.animFrame = (e.animFrame + 1) % 2;
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
          e.facing = e.vx > 0 ? 'right' : 'left';
          break;
        }
      }

      // Apply Gravity
      e.vy += 0.35;
      if (e.vy > 6.0) e.vy = 6.0;
      e.y += e.vy;

      // Vertical floor/pipe-top/ceiling collision check
      const enemyBoxV: Rect = { x: e.x + 1, y: e.y, width: e.width - 2, height: e.height };
      const tilesV = this.getTilesIntersecting(enemyBoxV);
      for (const t of tilesV) {
        if (this.isSolidTile(t.tile.type)) {
          if (e.vy > 0) {
            e.y = t.tileY * GameEngine.TILE_SIZE - e.height;
            e.vy = 0;
            break;
          } else if (e.vy < 0) {
            e.y = (t.tileY + 1) * GameEngine.TILE_SIZE;
            e.vy = 0;
            break;
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
        // Moving shell kills other enemies with impact screen-shake
        const shellBox: Rect = { x: e.x, y: e.y, width: e.width, height: e.height };
        this.enemies.forEach(other => {
          if (other.id !== e.id && other.alive && this.rectsIntersect(shellBox, { x: other.x, y: other.y, width: other.width, height: other.height })) {
            other.alive = false;
            other.state = 'flipped';
            other.vy = -5;
            this.sound.playKick();
            this.triggerScreenShake(3.0, 7);
            this.spawnEnemyDefeatParticles(other.x, other.y);
            this.addScore(200, other.x, other.y);
          }
        });
      } else if (e.state === 'walk') {
        // Walking Goombas & Koopas bump and reverse direction on contact with each other or idle shells
        for (const other of this.enemies) {
          if (
            other.id === e.id ||
            !other.alive ||
            (other.state !== 'walk' && other.state !== 'shell_idle') ||
            other.type === 'piranha' ||
            other.type === 'blooper' ||
            other.type === 'cheep_cheep'
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

      if (canCollideWithMario) {
        const currentMarioBox = this.getMarioHitbox();
        const enemyHitbox: Rect = { x: e.x + 1, y: e.y + 1, width: e.width - 2, height: e.height - 1 };
        if (this.rectsIntersect(currentMarioBox, enemyHitbox)) {
          // Is Mario jumping/falling down on top of enemy?
          const prevMarioBottom = currentMarioBox.y + currentMarioBox.height - this.marioVy;
          const isStomp = this.marioVy > 0 && prevMarioBottom <= e.y + 8;
          this.marioHitEnemy(e, isStomp);
        }
      }
    });

    // Cleanup squashed and fallen offscreen dead enemies
    this.enemies = this.enemies.filter(
      e => (e.state !== 'squashed' || e.stateTimer < 30) && (e.state !== 'flipped' || e.y <= GameEngine.NES_HEIGHT + 48)
    );
  }

  private marioHitEnemy(e: Enemy, isStomp: boolean) {
    // Starman kills everything except lava sparks
    if (this.marioStarTimer > 0) {
      if (e.type === 'lava_bubble') return;
      e.alive = false;
      e.state = 'flipped';
      e.vy = -5;
      this.sound.playKick();
      this.triggerScreenShake(3.5, 8);
      this.spawnEnemyDefeatParticles(e.x, e.y);
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
        this.spawnEnemyDefeatParticles(e.x, e.y);
        this.addScore(100, e.x, e.y);
      } else if (e.type === 'koopa') {
        if (e.state === 'walk') {
          // Retreat into shell
          e.state = 'shell_idle';
          e.vx = 0;
          e.height = 16;
          this.sound.playStomp();
          this.marioVy = -6.0;
          this.triggerScreenShake(1.8, 5);
          this.spawnEnemyDefeatParticles(e.x, e.y);
          this.addScore(100, e.x, e.y);
        } else if (e.state === 'shell_moving') {
          // Stop moving shell
          e.state = 'shell_idle';
          e.vx = 0;
          this.sound.playStomp();
          this.marioVy = -6.0;
          this.triggerScreenShake(2.5, 6);
          this.spawnEnemyDefeatParticles(e.x, e.y);
        } else if (e.state === 'shell_idle') {
          // Kick stationary shell
          e.state = 'shell_moving';
          e.vx = this.marioX < e.x ? 5.5 : -5.5;
          this.sound.playKick();
          this.marioVy = -5.0;
          this.triggerScreenShake(3.0, 7);
          this.spawnEnemyDefeatParticles(e.x, e.y);
          this.addScore(400, e.x, e.y);
        }
      }
    } else {
      // Hit from side
      if (e.type === 'koopa' && e.state === 'shell_idle') {
        // Kick shell
        e.state = 'shell_moving';
        e.vx = this.marioX < e.x ? 5.5 : -5.5;
        this.sound.playKick();
        this.triggerScreenShake(3.0, 7);
        this.spawnEnemyDefeatParticles(e.x, e.y);
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

    if (this.marioPower === 'tanooki' || this.marioPower === 'femboy') {
      // Tanooki and Femboy power-ups downgrade to Super Mario on damage
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
      this.onMultiplayerSyncNeeded?.();
      this.evaluateMultiplayerMatchEnd();
      if (!this.isMultiplayerMatchOver) {
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

      // Super Leaf floating physics: gentle side-to-side oscillation and slow fall
      if (item.type === 'leaf') {
        item.x += Math.sin(Date.now() / 200) * 1.2;
        item.y += 0.75; // gentle descent
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
    const colors = ['#ffffff', '#fc5454', '#fce078', '#5c94fc'];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.particles.push({
        id: this.nextEntityId++,
        type: 'sparkle',
        x: x + 8,
        y: y + 16,
        vx: Math.cos(angle) * 1.6,
        vy: Math.sin(angle) * 1.6 - 0.5,
        life: 0,
        maxLife: 26,
        color: colors[i % colors.length],
        size: 3,
      });
    }
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
          if (e.type === 'bowser') {
            e.hp = (e.hp ?? 5) - 1;
            e.hitFlashTimer = 10;
            this.sound.playKick();
            this.spawnEnemyDefeatParticles(fb.x, fb.y);
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
          this.spawnEnemyDefeatParticles(e.x, e.y);
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

    // Drop Bowser into the lava
    this.enemies.forEach(e => {
      if (e.type === 'bowser' && e.alive) {
        e.alive = false;
        e.state = 'flipped';
        e.vy = -1.5;
        e.vx = 0;
        this.spawnEnemyDefeatParticles(e.x, e.y);
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
  private updateParticles() {
    this.particles.forEach(p => {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;

      if (p.rotation !== undefined && p.rotSpeed !== undefined) {
        p.rotation += p.rotSpeed;
      }

      if (p.gravity !== undefined) {
        p.vy += p.gravity;
      } else if (p.type === 'brick_piece') {
        p.vy += 0.38; // Classic gravity on debris
      } else if (p.type === 'coin_glint') {
        p.vy += 0.08;
      } else if (p.type === 'smoke') {
        p.vy *= 0.94;
        p.vx *= 0.94;
      } else if (p.type === 'bubble') {
        p.x += Math.sin(p.life * 0.22) * 0.2;
        if (p.y <= 26) {
          p.life = p.maxLife;
        }
      } else if (p.type === 'heart') {
        p.x += Math.sin(p.life * 0.18) * 0.22;
        p.vy *= 0.985;
      }
    });

    this.particles = this.particles.filter(p => p.life < p.maxLife);
  }

  private spawnFemboyHeartParticle(x: number, y: number) {
    this.particles.push({
      id: this.nextEntityId++,
      type: 'heart',
      x,
      y,
      vx: 0,
      vy: -0.95,
      life: 0,
      maxLife: 46,
      color: '#ff4d94',
    });
  }

  // Helper to spawn glittering sparkles on coin collection
  public spawnCoinParticles(x: number, y: number) {
    const colors = ['#ffffff', '#fce078', '#fc9838', '#f8d838'];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() * 0.4 - 0.2);
      const speed = 1.4 + Math.random() * 1.8;
      this.particles.push({
        id: this.nextEntityId++,
        type: 'coin_glint',
        x: x + 6,
        y: y + 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.0,
        life: 0,
        maxLife: 24 + Math.floor(Math.random() * 10),
        color: colors[i % colors.length],
        size: 2 + (i % 2),
        gravity: 0.12,
      });
    }
  }

  // Helper to spawn impact stars and poof clouds when defeating an enemy
  public spawnEnemyDefeatParticles(x: number, y: number, color: string = '#ffffff') {
    // 1. Star bursts
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const speed = 1.8 + Math.random() * 1.6;
      this.particles.push({
        id: this.nextEntityId++,
        type: 'star_burst',
        x: x + 8,
        y: y + 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        life: 0,
        maxLife: 18 + Math.floor(Math.random() * 8),
        color: i % 2 === 0 ? '#fffa50' : '#ffffff',
        size: 3,
        rotation: 0,
        rotSpeed: 0.2,
      });
    }
    // 2. Poof cloud
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        id: this.nextEntityId++,
        type: 'smoke',
        x: x + 4 + (i % 2) * 8,
        y: y + 4 + Math.floor(i / 2) * 8,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -0.6 - Math.random() * 0.8,
        life: 0,
        maxLife: 20,
        size: 4 + Math.floor(Math.random() * 3),
      });
    }
  }

  private addScore(points: number, x: number, y: number, customText?: string) {
    this.stats.score += points;
    // Cheaters cannot update high score!
    if (!this.isCheatActive && this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
    }

    this.particles.push({
      id: this.nextEntityId++,
      type: 'score_text',
      text: customText || `${points}`,
      x,
      y: y - 8,
      vx: 0,
      vy: -0.8,
      life: 0,
      maxLife: 30,
    });
  }

  // --- CHEAT ENGINE METHODS ("lula132026") ---
  public activateCheatMode() {
    this.isCheatActive = true;
    this.infiniteLives = true;
    this.stats.lives = 99;
    this.sound.playPowerUpEat();
    this.particles.push({
      id: this.nextEntityId++,
      type: 'score_text',
      text: 'CHEAT ON!',
      x: this.marioX,
      y: this.marioY - 16,
      vx: 0,
      vy: -1.2,
      life: 0,
      maxLife: 45,
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
    this.particles.push({
      id: this.nextEntityId++,
      type: 'score_text',
      text: `+${points}`,
      x: this.marioX,
      y: this.marioY - 14,
      vx: 0,
      vy: -1.2,
      life: 0,
      maxLife: 35,
    });
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
    this.screenShakeTimer = Math.max(this.screenShakeTimer, durationFrames);
  }

  // --- CAMERA & SCREEN SHAKE UPDATE ---
  private updateCamera() {
    const targetX = this.marioX - GameEngine.NES_WIDTH * 0.35;
    if (targetX > this.cameraX) {
      this.cameraX = targetX;
    }
    // Max level boundary
    const maxCamX = this.level.width * GameEngine.TILE_SIZE - GameEngine.NES_WIDTH;
    if (this.cameraX > maxCamX) {
      this.cameraX = maxCamX;
    }

    // Process screen-shake decay and pseudo-random displacement
    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer--;
      const currentIntensity = this.screenShakeIntensity * (this.screenShakeTimer / 12);
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
  private checkPipeWarp() {
    if (!this.level.pipeWarps) return;
    const marioBox = this.getMarioHitbox();

    for (const pw of this.level.pipeWarps) {
      if (this.rectsIntersect(marioBox, pw.from)) {
        // Must press down for down pipe or right for right pipe
        if (pw.type === 'down' && !this.controls.down) continue;
        if (pw.type === 'right' && !this.controls.right) continue;

        this.marioState = 'pipe_entering';
        this.warpTimer = 0;
        this.warpTarget = { toLevel: pw.toLevel, toPos: pw.toPos };
        this.warpDir = pw.type;

        // Visual clip lip: Mario sinks directly inside this pipe opening!
        if (pw.type === 'down') {
          this.pipeClipLipY = pw.from.y;
          this.pipeClipLipX = null;
        } else {
          this.pipeClipLipX = pw.from.x;
          this.pipeClipLipY = null;
        }

        this.sound.playPipe();
        break;
      }
    }
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
      this.cameraX = 0;
      // Mario smoothly drops down out of vault pipe ceiling
      this.marioState = 'pipe_exiting';
      this.pipeExitDir = 'down';
      this.warpTimer = 20;
      this.pipeClipLipY = 4 * GameEngine.TILE_SIZE;
      this.pipeClipLipX = null;
    } else if (targetLevelId === 'world-1-1') {
      const overworld = createWorld1_1();
      this.loadLevel(overworld, false, false, !returningFromSubArea);
      this.marioX = destPos.x;
      // Start inside the pipe and rise smoothly up out of it
      this.marioY = destPos.y + 16;
      this.cameraX = Math.max(0, this.marioX - 80);
      this.marioState = 'pipe_exiting';
      this.pipeExitDir = 'up';
      this.warpTimer = 0;
      this.pipeClipLipY = destPos.y;
      this.pipeClipLipX = null;
    } else if (targetLevelId === 'world-1-2') {
      const lvl = createWorld1_2();
      this.loadLevel(lvl, false, false, true);
      this.marioX = destPos.x;
      this.marioY = destPos.y + 16;
      this.cameraX = Math.max(0, this.marioX - 80);
      this.marioState = 'pipe_exiting';
      this.pipeExitDir = 'up';
      this.warpTimer = 0;
      this.pipeClipLipY = destPos.y;
      this.pipeClipLipX = null;
    } else if (targetLevelId === 'world-2-2') {
      if (this.level.id !== 'world-2-2') {
        this.loadLevel(createWorld2_2(), false, false, true);
      }
      this.marioX = destPos.x;
      this.marioY = destPos.y + 16;
      this.cameraX = Math.max(0, this.marioX - 80);
      this.marioState = 'pipe_exiting';
      this.pipeExitDir = 'up';
      this.warpTimer = 0;
      this.pipeClipLipY = destPos.y;
      this.pipeClipLipX = null;
    }

    this.sound.playPipe();
    this.warpTarget = null;
  }

  // Tanooki 360-degree Tail Whip: hits enemies in a 36-pixel circle and bumps adjacent blocks
  private checkTailWhipCollisions() {
    const whipBox: Rect = {
      x: this.marioX - 10,
      y: this.marioY + 4,
      width: 36,
      height: 24,
    };

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
          this.spawnEnemyDefeatParticles(e.x, e.y);
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
        this.spawnEnemyDefeatParticles(e.x, e.y);
        this.addScore(200, e.x, e.y);
      }
    });

    // Bump or break adjacent blocks with tail
    const hitTileX = Math.floor((this.marioFacing === 'right' ? this.marioX + 18 : this.marioX - 6) / GameEngine.TILE_SIZE);
    const hitTileY = Math.floor((this.marioY + 12) / GameEngine.TILE_SIZE);
    if (hitTileX >= 0 && hitTileX < this.level.width && hitTileY >= 0 && hitTileY < this.level.height) {
      const block = this.level.tiles[hitTileY][hitTileX];
      if (block && (block.type === 'brick' || block.type === 'underground_brick' || block.type === 'question')) {
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
    if (this.level.id === 'world-1-1') {
      this.loadLevel(createWorld1_2(), true, false);
    } else if (this.level.id === 'world-1-2') {
      this.loadLevel(createWorld2_2(), true, false);
    } else if (this.level.id === 'world-2-2') {
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

    this.stats = {
      score: 0,
      coins: 0,
      world: '1-1',
      time: initialTime,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: Math.max(this.stats.score, this.stats.highScore),
      difficulty: this.difficulty,
    };

    this.isGameStarted = true;
    this.endlessStage = targetLevel?.endlessStage || 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    this.loadLevel(targetLevel || createWorld1_1(), true, false, notifyNetwork);
    this.onMultiplayerSyncNeeded?.();
  }

  public restartGame() {
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

    this.stats = {
      score: 0,
      coins: 0,
      world: '1-1',
      time: initialTime,
      lives: this.infiniteLives ? 99 : initialLives,
      highScore: Math.max(this.stats.score, this.stats.highScore),
      difficulty: this.difficulty,
    };

    this.isGameStarted = true;
    this.endlessStage = 0;
    this.marioPower = this.difficulty === 'easy' ? 'super' : 'small';
    this.marioStarTimer = 0;
    this.loadLevel(createWorld1_1(), true, false);
  }

  public togglePause() {
    this.isPaused = !this.isPaused;
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
      type === 'castle_stone'
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

    // 1. Background Fill (Split ocean/sky smoothly at dryFinishStartX on underwater levels)
    if (this.level.theme === 'underwater' && this.level.dryFinishStartX !== undefined) {
      const splitScreenX = Math.round(this.level.dryFinishStartX - this.cameraX);
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

    // 3. Tilemap
    this.renderTiles(ctx);

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

    // 9. Mario / WazzimaGiygg (Local Player)
    this.renderMario(ctx);

    // 10. Particles & Floating Scores
    this.renderParticles(ctx);

    ctx.restore();

    // 11. In-Canvas Pixel HUD (Stationary, rendered above screen shake)
    this.renderInCanvasHUD(ctx);
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

    // 1. SCORE COLUMN (X: 16) - Shows WAZZIMA if playing as WazzimaGiygg!
    const charName = this.playerCharacter === 'wazzima' ? 'WAZZIMA' : 'MARIO';
    const charColor = this.playerCharacter === 'wazzima' ? '#38f838' : '#ffffff';
    drawShadowText(charName, 16, 12, charColor);
    drawShadowText(String(this.stats.score).padStart(6, '0'), 16, 21, '#ffffff');

    // 2. MULTIPLAYER BADGE (If other players connected via IP)
    if (this.remotePlayers.size > 0) {
      drawShadowText('2P ON', 84, 12, '#38f838');
    }

    // CHEAT USE warning badge if active
    if (this.isCheatActive) {
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#000000';
      ctx.fillText('CHEAT USE', 17, 30);
      ctx.fillStyle = '#ff3333';
      ctx.fillText('CHEAT USE', 16, 29);
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
    const livesLabel = this.infiniteLives || this.stats.lives >= 99 ? 'x∞' : `x${this.stats.lives}`;
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
    if (this.level.theme === 'underwater') {
      const waterEndScreenX =
        this.level.dryFinishStartX !== undefined
          ? Math.min(GameEngine.NES_WIDTH, Math.round(this.level.dryFinishStartX - this.cameraX))
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
        const sx = s.x - this.cameraX;
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

    if (this.level.theme !== 'overworld') return;

    this.sceneries.forEach(s => {
      const sx = s.x - this.cameraX;
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
    const startTX = Math.max(0, Math.floor(this.cameraX / GameEngine.TILE_SIZE));
    const endTX = Math.min(this.level.width - 1, Math.ceil((this.cameraX + GameEngine.NES_WIDTH) / GameEngine.TILE_SIZE));

    const qFrame = Math.floor((Date.now() / 150) % 4);

    for (let ty = 0; ty < this.level.height; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const block = this.level.tiles[ty][tx];
        if (!block || (block.invisible && block.bumpOffset === 0)) continue;

        const screenX = tx * GameEngine.TILE_SIZE - this.cameraX;
        const screenY = ty * GameEngine.TILE_SIZE + block.bumpOffset;

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

  private renderFlagpole(ctx: CanvasRenderingContext2D) {
    const poleScreenX = this.level.flagX - this.cameraX;
    if (poleScreenX < -32 || poleScreenX > GameEngine.NES_WIDTH + 32) return;

    // Draw Flag attached to pole
    ctx.drawImage(this.atlas.flagTriangle, poleScreenX - 14, this.flagY);
  }

  private renderItems(ctx: CanvasRenderingContext2D) {
    const coinFrame = Math.floor((Date.now() / 120) % 4);
    const flowerFrame = Math.floor((Date.now() / 100) % 4);

    this.items.forEach(item => {
      const ix = item.x - this.cameraX;
      if (ix < -16 || ix > GameEngine.NES_WIDTH + 16) return;

      if (item.type === 'leaf') {
        ctx.drawImage(this.atlas.itemSuperLeaf, ix, item.y);
      } else if (item.type === 'mushroom') {
        ctx.drawImage(this.atlas.itemMushroomSuper, ix, item.y);
      } else if (item.type === '1up') {
        ctx.drawImage(this.atlas.itemMushroom1Up, ix, item.y);
      } else if (item.type === 'fireflower') {
        ctx.drawImage(this.atlas.itemFireFlowerFrames[flowerFrame], ix, item.y);
      } else if (item.type === 'coin') {
        ctx.drawImage(this.atlas.itemCoinFrames[coinFrame], ix, item.y);
      } else if (item.type === 'star') {
        ctx.drawImage(this.atlas.itemFireFlowerFrames[flowerFrame], ix, item.y);
      } else if (item.type === 'femboy') {
        ctx.drawImage(this.atlas.itemFemboy, ix, item.y);
      }
    });
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    this.enemies.forEach(e => {
      const ex = e.x - this.cameraX;
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
          ctx.drawImage(this.atlas.goombaSquashed, ex, e.y + 8);
        } else {
          const frame = e.animFrame === 0 ? this.atlas.goombaWalk1 : this.atlas.goombaWalk2;
          ctx.drawImage(frame, ex, e.y);
        }
      } else if (e.type === 'koopa') {
        if (e.state === 'shell_idle' || e.state === 'shell_moving') {
          ctx.drawImage(this.atlas.koopaShell, ex, e.y + 8);
        } else {
          const frame = e.animFrame === 0 ? this.atlas.koopaWalk1 : this.atlas.koopaWalk2;
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
      } else if (e.type === 'cheep_cheep') {
        const frame = e.animFrame === 0 ? this.atlas.cheepCheep1 : this.atlas.cheepCheep2;
        if (e.facing === 'right') {
          ctx.translate(ex + 16, e.y);
          ctx.scale(-1, 1);
          ctx.drawImage(frame, 0, 0);
        } else {
          ctx.drawImage(frame, ex, e.y);
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
      }

      ctx.restore();
    });
  }

  private renderFireballs(ctx: CanvasRenderingContext2D) {
    const frame = Math.floor((Date.now() / 60) % 4);
    this.fireballs.forEach(fb => {
      const fx = fb.x - this.cameraX;
      if (fx < -8 || fx > GameEngine.NES_WIDTH + 8) return;
      const frames = fb.color === 'white' ? this.atlas.whiteFireballFrames : this.atlas.fireballFrames;
      if (fb.exploding) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - fb.explodeTimer / 10);
        ctx.drawImage(frames[frame], fx, fb.y);
        ctx.restore();
      } else {
        ctx.drawImage(frames[frame], fx, fb.y);
      }
    });

    this.bossFireballs.forEach(bf => {
      const bx = bf.x - this.cameraX;
      if (bx < -20 || bx > GameEngine.NES_WIDTH + 20) return;
      const bFrame = Math.floor(bf.animTimer / 4) % 2;
      ctx.save();
      if (bf.vx > 0) {
        ctx.translate(bx + 16, bf.y);
        ctx.scale(-1, 1);
        ctx.drawImage(this.atlas.bowserFireFrames[bFrame], 0, 0);
      } else {
        ctx.drawImage(this.atlas.bowserFireFrames[bFrame], bx, bf.y);
      }
      ctx.restore();
    });
  }

  private renderMario(ctx: CanvasRenderingContext2D) {
    // Mario has entered the castle door - hidden from view inside
    if (this.marioState === 'castle_entered') {
      return;
    }

    // Blinking during invulnerability
    if (this.marioInvulnerableTimer > 0 && Math.floor(this.marioInvulnerableTimer / 4) % 2 === 0) {
      return;
    }

    const mx = this.marioX - this.cameraX;
    const my = this.marioY;

    ctx.save();

    // Authentic NES Pipe Entering / Exiting Clipping:
    // Mario visually sinks INSIDE the pipe rather than rendering on top of the rim!
    if ((this.marioState === 'pipe_entering' || this.marioState === 'pipe_exiting')) {
      if (this.pipeClipLipY !== null) {
        ctx.beginPath();
        if (this.pipeExitDir === 'down') {
          // Exiting down from ceiling: clip to below lip
          ctx.rect(0, this.pipeClipLipY, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT - this.pipeClipLipY);
        } else {
          // Entering down or exiting up: clip to above pipe rim
          ctx.rect(0, 0, GameEngine.NES_WIDTH, this.pipeClipLipY);
        }
        ctx.clip();
      } else if (this.pipeClipLipX !== null) {
        const lipScreenX = this.pipeClipLipX - this.cameraX;
        ctx.beginPath();
        ctx.rect(lipScreenX, 0, GameEngine.NES_WIDTH, GameEngine.NES_HEIGHT);
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
      const nameText = isW ? 'WAZZIMA' : 'MARIO';

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

      const px = rp.renderX - this.cameraX;
      const py = rp.renderY;
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
      const nameText = (rp.name || (isW ? 'Wazzima' : 'Mario')).substring(0, 12).toUpperCase();

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

  private renderParticles(ctx: CanvasRenderingContext2D) {
    this.particles.forEach(p => {
      const px = p.x - this.cameraX;
      if (px < -30 || px > GameEngine.NES_WIDTH + 30) return;

      if (p.type === 'brick_piece') {
        if (p.rotation !== undefined) {
          ctx.save();
          ctx.translate(px + 4, p.y + 4);
          ctx.rotate(p.rotation);
          ctx.drawImage(this.atlas.brickDebris, -4, -4);
          ctx.restore();
        } else {
          ctx.drawImage(this.atlas.brickDebris, px, p.y);
        }
      } else if (p.type === 'coin_glint') {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color || '#fce078';
        const sz = p.size || 2;
        ctx.fillRect(px - sz, p.y, sz * 2 + 1, 1);
        ctx.fillRect(px, p.y - sz, 1, sz * 2 + 1);
        ctx.fillRect(px - 1, p.y - 1, 3, 3);
        ctx.restore();
      } else if (p.type === 'star_burst') {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(px, p.y);
        if (p.rotation !== undefined) {
          ctx.rotate(p.rotation);
        }
        ctx.fillStyle = p.color || '#fffa50';
        const sz = p.size || 3;
        ctx.fillRect(-sz * 1.8, -1, sz * 3.6, 2);
        ctx.fillRect(-1, -sz * 1.8, 2, sz * 3.6);
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      } else if (p.type === 'smoke' || p.type === 'enemy_poof') {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        const sz = (p.size || 4) + (p.life / p.maxLife) * 3;
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = p.color || '#f8f8f8';
        ctx.fillRect(px - sz / 2, p.y - sz / 2, sz, sz);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - sz / 4, p.y - sz / 4, sz / 2, sz / 2);
        ctx.restore();
      } else if (p.type === 'sparkle') {
        ctx.fillStyle = p.color || '#fce078';
        ctx.fillRect(px, p.y, p.size || 4, p.size || 4);
      } else if (p.type === 'bubble') {
        const sz = p.size || 3;
        ctx.fillStyle = '#88e8ff';
        ctx.fillRect(px, p.y, sz, sz);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px, p.y, 1, 1);
      } else if (p.type === 'heart') {
        const alpha = p.life > p.maxLife * 0.65
          ? Math.max(0, 1 - (p.life - p.maxLife * 0.65) / (p.maxLife * 0.35))
          : 1;
        const hx = Math.round(px) - 4;
        const hy = Math.round(p.y) - 4;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Clean symmetrical 1px dark outline around the 9x8 pixel heart
        ctx.fillStyle = '#4a0020';
        ctx.fillRect(hx + 1, hy - 1, 2, 1);
        ctx.fillRect(hx + 6, hy - 1, 2, 1);
        ctx.fillRect(hx, hy, 4, 1);
        ctx.fillRect(hx + 5, hy, 4, 1);
        ctx.fillRect(hx - 1, hy + 1, 11, 3);
        ctx.fillRect(hx, hy + 4, 9, 1);
        ctx.fillRect(hx + 1, hy + 5, 7, 1);
        ctx.fillRect(hx + 2, hy + 6, 5, 1);
        ctx.fillRect(hx + 3, hy + 7, 3, 1);
        ctx.fillRect(hx + 4, hy + 8, 1, 1);
        // Pink heart body (9x8 pixel-art)
        ctx.fillStyle = p.color || '#ff4d94';
        ctx.fillRect(hx + 1, hy, 2, 1);
        ctx.fillRect(hx + 6, hy, 2, 1);
        ctx.fillRect(hx, hy + 1, 4, 1);
        ctx.fillRect(hx + 5, hy + 1, 4, 1);
        ctx.fillRect(hx, hy + 2, 9, 2);
        ctx.fillRect(hx + 1, hy + 4, 7, 1);
        ctx.fillRect(hx + 2, hy + 5, 5, 1);
        ctx.fillRect(hx + 3, hy + 6, 3, 1);
        ctx.fillRect(hx + 4, hy + 7, 1, 1);
        // Cute highlight glint
        ctx.fillStyle = '#ffd6eb';
        ctx.fillRect(hx + 1, hy + 1, 1, 2);
        ctx.restore();
      } else if (p.type === 'score_text' && p.text) {
        const alpha = Math.max(0, 1 - (p.life / p.maxLife) * 0.5);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#000000';
        ctx.fillText(p.text, px + 1, p.y + 1);
        ctx.fillStyle = p.color || '#ffffff';
        ctx.fillText(p.text, px, p.y);
        ctx.restore();
      }
    });
  }
}
