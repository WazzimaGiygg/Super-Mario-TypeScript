/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine.ts';
import { RetroHUD } from './RetroHUD.tsx';
import { TouchControls } from './TouchControls.tsx';
import { SettingsModal } from './SettingsModal.tsx';
import { LeaderboardModal } from './LeaderboardModal.tsx';
import { CheatMenuModal } from './CheatMenuModal.tsx';
import { MultiplayerModal } from './MultiplayerModal.tsx';
import { LevelEditorModal } from './LevelEditorModal.tsx';
import { UpdatesModal, UpdatesModalFilter } from './UpdatesModal.tsx';
import { AchievementsModal } from './AchievementsModal.tsx';
import { SmwOverworldMap } from './SmwOverworldMap.tsx';
import { WazzimaCommercialOverlay } from './WazzimaCommercialOverlay.tsx';
import {
  LAST_COMMERCIAL_STORAGE_KEY,
  WazzimaCommercial,
  getNextCommercialInRotation,
} from '../game/commercials.ts';
import { multiplayerClient } from '../game/multiplayer.ts';
import { SpriteAtlas } from '../game/sprites.ts';
import { SoundEngine } from '../game/audio.ts';
import { BlockTile, Enemy, GamepadControls, GameStats, ItemContent, LevelData, MarioPower, MarioState, Rect, TileType, GameDifficulty, ResolutionScale, MultiplayerMatchResult, MultiplayerLogoffEvent, SmwSwitchColor } from '../game/types.ts';
import {
  AchievementManager,
  AchievementProgressView,
  AchievementUnlockEvent,
} from '../game/achievements.ts';
import {
  SMW_WIKIWORLD_NODES,
  SMW_DEV_ONLY_SWITCH_PALACES,
  SmwBetaProgress,
  SmwSaveSlotData,
  createSmwWikiWorldStage,
  loadSmwBetaProgress,
  isSmwNodeUnlocked,
  isSmwNodeCompletedAndLocked,
  canEnterSmwNode,
  loadSmwSaveSlots,
  saveSmwToSlot,
  deleteSmwSlot,
  applySmwSlotToProgress,
  canExitSmwStageWithSelect,
} from '../game/smwWorldMap.ts';
import { getTopScore } from '../game/scoreboard.ts';
import {
  sanitizeCustomLevelEntities,
  createWorld1_1,
  createSecretVault,
  createWorld1_2,
  createWorld2_2,
  createWorldGhostHouse,
  createWorld1_4,
} from '../game/levels.ts';
import { isSmartTvUserAgent, moveFocusWithDpad, resolveTvRemoteAction } from '../game/smartTv.ts';
import {
  isModeAndEditorLocked as isModeAndEditorLockedPolicy,
  canOpenLevelEditor,
  canSwitchGameMode,
  canExitToMainMenu,
} from '../game/modePolicy.ts';
import { Award, Settings, Play, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, Trophy, Flame, Users, Crown, Clock, CheckCircle2, WifiOff, Hammer, ShieldAlert, Shield, ScrollText, Heart, Map as MapIcon, Bug, Crosshair, ChevronLeft, ChevronRight, Plus, Tv, Wrench, FolderOpen, Lock, Home } from 'lucide-react';

export interface PlayerPhysicsStepOptions {
  isUnderwater?: boolean;
  groundY?: number;
}

/**
 * Core Player physics model matching the original NES Super Mario Bros.
 * movement velocity, skidding, friction, split ascending/descending gravity,
 * and variable-height jumping impulses.
 */
export class Player {
  // NES Sprite Hitbox Dimensions (16px tile scale)
  public static readonly WIDTH = 16;
  public static readonly SMALL_HEIGHT = 16;
  public static readonly BIG_HEIGHT = 30;
  public static readonly CROUCH_HEIGHT = 20;

  // Horizontal Movement Constants (NES-calibrated px/frame at 60 FPS)
  public static readonly WALK_MAX_SPEED = 2.0;
  public static readonly RUN_MAX_SPEED = 3.4;
  public static readonly WALK_ACCEL = 0.16;
  public static readonly RUN_ACCEL = 0.22;
  public static readonly SKID_DECEL = 0.45;
  public static readonly GROUND_FRICTION = 0.72;
  public static readonly AIR_FRICTION = 0.90;
  public static readonly STOP_THRESHOLD = 0.25;
  public static readonly CROUCH_BRAKE_FACTOR = 0.5;
  public static readonly STAR_SPEED_BOOST = 1.15;

  // Jumping & Gravity Constants (NES variable jump + split arc gravity)
  public static readonly WALK_JUMP_IMPULSE = -7.4;
  public static readonly RUN_JUMP_IMPULSE = -8.4;
  public static readonly SPIN_WALK_IMPULSE = -6.8;
  public static readonly SPIN_RUN_IMPULSE = -7.6;
  public static readonly VARIABLE_JUMP_CUT_VY = -2.5;
  public static readonly GRAVITY_ASCENDING = 0.38;
  public static readonly GRAVITY_DESCENDING = 0.62;
  public static readonly MAX_FALL_SPEED = 7.0;

  // Power-Up Glide & Underwater Physics Constants
  public static readonly TANOOKI_GLIDE_MAX_VY = 1.15;
  public static readonly TANOOKI_GLIDE_GRAVITY = 0.08;
  public static readonly CAPE_GLIDE_MAX_VY = 0.85;
  public static readonly CAPE_GLIDE_GRAVITY = 0.05;
  public static readonly CAPE_DIVE_ACCEL = 0.22;
  public static readonly UNDERWATER_WALK_MAX_SPEED = 1.55;
  public static readonly UNDERWATER_RUN_MAX_SPEED = 2.2;
  public static readonly UNDERWATER_ACCEL = 0.13;
  public static readonly UNDERWATER_SKID_DECEL = 0.25;
  public static readonly UNDERWATER_GROUND_FRICTION = 0.78;
  public static readonly UNDERWATER_AIR_FRICTION = 0.92;
  public static readonly UNDERWATER_SWIM_IMPULSE = -2.55;
  public static readonly UNDERWATER_RUN_SWIM_IMPULSE = -2.9;
  public static readonly UNDERWATER_GRAVITY = 0.085;
  public static readonly UNDERWATER_MAX_FALL = 1.65;
  public static readonly UNDERWATER_SWIM_HELD_MAX_FALL = 1.1;

  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public power: MarioPower;
  public state: MarioState = 'idle';
  public facing: 'left' | 'right' = 'right';
  public grounded: boolean = false;
  public isSpinJumping: boolean = false;
  public spinJumpTimer: number = 0;
  public isFluttering: boolean = false;
  public isStatue: boolean = false;
  public starTimer: number = 0;
  public tailWhipTimer: number = 0;
  public animFrame: number = 0;
  public animTimer: number = 0;
  public prevJumpHeld: boolean = false;
  public prevSpinHeld: boolean = false;

  constructor(x: number = 40, y: number = 192, power: MarioPower = 'small') {
    this.x = x;
    this.y = y;
    this.power = power;
  }

  public getHeight(): number {
    if (this.power === 'small') return Player.SMALL_HEIGHT;
    if (this.state === 'crouching') return Player.CROUCH_HEIGHT;
    return Player.BIG_HEIGHT;
  }

  public getHitbox(): Rect {
    return {
      x: this.x + 2,
      y: this.y,
      width: Player.WIDTH - 4,
      height: this.getHeight(),
    };
  }

  public reset(x: number = 40, y: number = 192, power: MarioPower = 'small'): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.power = power;
    this.state = 'idle';
    this.facing = 'right';
    this.grounded = false;
    this.isSpinJumping = false;
    this.spinJumpTimer = 0;
    this.isFluttering = false;
    this.isStatue = false;
    this.starTimer = 0;
    this.tailWhipTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.prevJumpHeld = false;
    this.prevSpinHeld = false;
  }

  public applyHorizontalVelocity(
    controls: Partial<GamepadControls>,
    options: PlayerPhysicsStepOptions = {}
  ): void {
    const isUnderwater = Boolean(options.isUnderwater);
    const isRunning = Boolean(controls.run);
    const starBoost = this.starTimer > 0 ? Player.STAR_SPEED_BOOST : 1;
    const maxSpeed =
      (isUnderwater
        ? isRunning
          ? Player.UNDERWATER_RUN_MAX_SPEED
          : Player.UNDERWATER_WALK_MAX_SPEED
        : isRunning
        ? Player.RUN_MAX_SPEED
        : Player.WALK_MAX_SPEED) * starBoost;
    const accel = isUnderwater
      ? Player.UNDERWATER_ACCEL
      : isRunning
      ? Player.RUN_ACCEL
      : Player.WALK_ACCEL;
    const skidDecel = isUnderwater ? Player.UNDERWATER_SKID_DECEL : Player.SKID_DECEL;
    const friction = isUnderwater
      ? this.grounded
        ? Player.UNDERWATER_GROUND_FRICTION
        : Player.UNDERWATER_AIR_FRICTION
      : this.grounded
      ? Player.GROUND_FRICTION
      : Player.AIR_FRICTION;

    this.isStatue = this.power === 'tanooki' && Boolean(controls.down) && this.grounded;

    if (!this.isStatue && controls.left && !controls.right) {
      this.facing = 'left';
      if (this.vx > 0.3) {
        this.vx -= skidDecel;
        this.state = 'skidding';
      } else {
        this.vx -= accel;
        if (this.vx < -maxSpeed) this.vx = -maxSpeed;
        if (this.tailWhipTimer <= 0) this.state = 'running';
      }
    } else if (!this.isStatue && controls.right && !controls.left) {
      this.facing = 'right';
      if (this.vx < -0.3) {
        this.vx += skidDecel;
        this.state = 'skidding';
      } else {
        this.vx += accel;
        if (this.vx > maxSpeed) this.vx = maxSpeed;
        if (this.tailWhipTimer <= 0) this.state = 'running';
      }
    } else {
      this.vx *= friction;
      if (Math.abs(this.vx) < Player.STOP_THRESHOLD) {
        this.vx = 0;
        if (this.grounded && this.tailWhipTimer <= 0) {
          this.state = 'idle';
        }
      }
    }

    const isCrouching = Boolean(controls.down) && this.grounded && this.power !== 'small';
    if (isCrouching) {
      this.state = 'crouching';
      this.vx *= Player.CROUCH_BRAKE_FACTOR;
      if (Math.abs(this.vx) < 0.2) this.vx = 0;
    }
  }

  public applyJumpAndGravity(
    controls: Partial<GamepadControls>,
    options: PlayerPhysicsStepOptions = {}
  ): void {
    const isUnderwater = Boolean(options.isUnderwater);
    const isRunning = Boolean(controls.run);
    const jumpHeld = Boolean(controls.jump);
    const spinHeld = Boolean(controls.spinJump);
    const jumpPressed = jumpHeld && !this.prevJumpHeld;
    const spinPressed = spinHeld && !this.prevSpinHeld;
    const jumpMult = this.power === 'femboy' ? Math.SQRT2 : 1;

    if (isUnderwater) {
      this.isSpinJumping = false;
      this.spinJumpTimer = 0;
      this.isFluttering = false;

      if ((jumpPressed || spinPressed) && !this.isStatue) {
        this.vy =
          (isRunning ? Player.UNDERWATER_RUN_SWIM_IMPULSE : Player.UNDERWATER_SWIM_IMPULSE) *
          jumpMult;
        this.grounded = false;
        this.state = 'jumping';
      }

      this.vy += Player.UNDERWATER_GRAVITY;
      const maxUnderwaterFall =
        jumpHeld || spinHeld
          ? Player.UNDERWATER_SWIM_HELD_MAX_FALL
          : Player.UNDERWATER_MAX_FALL;
      if (this.vy > maxUnderwaterFall) {
        this.vy = maxUnderwaterFall;
      }
    } else {
      if (spinPressed && this.grounded && !this.isStatue) {
        const capeLaunchMult =
          this.power === 'cape' && Math.abs(this.vx) >= 2.5 ? 1.08 : 1;
        this.vy =
          (isRunning ? Player.SPIN_RUN_IMPULSE : Player.SPIN_WALK_IMPULSE) *
          jumpMult *
          capeLaunchMult;
        this.grounded = false;
        this.state = 'jumping';
        this.isSpinJumping = true;
        this.spinJumpTimer = 0;
      } else if (jumpPressed && this.grounded && !this.isStatue) {
        const capeLaunchMult =
          this.power === 'cape' && Math.abs(this.vx) >= 2.5 ? 1.12 : 1;
        this.vy =
          (isRunning ? Player.RUN_JUMP_IMPULSE : Player.WALK_JUMP_IMPULSE) *
          jumpMult *
          capeLaunchMult;
        this.grounded = false;
        this.state = 'jumping';
        this.isSpinJumping = false;
        this.spinJumpTimer = 0;
      }

      if (!this.grounded && this.isSpinJumping) {
        this.spinJumpTimer++;
      }

      this.isFluttering = false;
      if (!this.isSpinJumping && this.power === 'cape' && !this.grounded && jumpHeld && this.vy > 0.25) {
        this.isFluttering = true;
        this.vy = Math.min(this.vy, Player.CAPE_GLIDE_MAX_VY);
      } else if (
        !this.isSpinJumping &&
        this.power === 'tanooki' &&
        !this.grounded &&
        jumpHeld &&
        this.vy > 0.5
      ) {
        this.isFluttering = true;
        this.vy = Math.min(this.vy, Player.TANOOKI_GLIDE_MAX_VY);
      } else if (this.power === 'cape' && !this.grounded && controls.down) {
        this.vy = Math.min(Player.MAX_FALL_SPEED, this.vy + Player.CAPE_DIVE_ACCEL);
      }

      // Variable jump height cut when jump/spin button is released early
      if (!jumpHeld && !spinHeld && this.vy < Player.VARIABLE_JUMP_CUT_VY) {
        this.vy = Player.VARIABLE_JUMP_CUT_VY;
      }

      const glideGravity =
        this.power === 'cape' ? Player.CAPE_GLIDE_GRAVITY : Player.TANOOKI_GLIDE_GRAVITY;
      const gravity = this.isFluttering
        ? glideGravity
        : this.vy < 0
        ? Player.GRAVITY_ASCENDING
        : Player.GRAVITY_DESCENDING;

      this.vy += gravity;
      if (this.vy > Player.MAX_FALL_SPEED) {
        this.vy = Player.MAX_FALL_SPEED;
      }
    }

    this.prevJumpHeld = jumpHeld;
    this.prevSpinHeld = spinHeld;
  }

  public update(
    controls: Partial<GamepadControls>,
    options: PlayerPhysicsStepOptions = {}
  ): void {
    this.applyHorizontalVelocity(controls, options);
    this.applyJumpAndGravity(controls, options);

    this.x += this.vx;
    this.y += this.vy;

    if (options.groundY !== undefined) {
      const floorTop = options.groundY - this.getHeight();
      if (this.y >= floorTop && this.vy >= 0) {
        this.y = floorTop;
        this.vy = 0;
        this.grounded = true;
        this.isSpinJumping = false;
        this.spinJumpTimer = 0;
        this.isFluttering = false;
      } else if (this.y < floorTop) {
        this.grounded = false;
      }
    }

    if (this.grounded) {
      if (Math.abs(this.vx) > 0.1) {
        const frameInterval = controls.run ? 4 : 7;
        this.animTimer++;
        if (this.animTimer >= frameInterval) {
          this.animTimer = 0;
          this.animFrame = (this.animFrame + 1) % 3;
        }
      } else {
        this.animFrame = 0;
        this.animTimer = 0;
      }
      if (
        this.state !== 'crouching' &&
        this.state !== 'skidding' &&
        this.tailWhipTimer <= 0
      ) {
        this.state = Math.abs(this.vx) > 0.1 ? 'running' : 'idle';
      }
    } else if (this.tailWhipTimer <= 0) {
      this.state = this.vy < 0 ? 'jumping' : 'falling';
    }
  }

  public syncFromEngine(engine: GameEngine): void {
    this.x = engine.marioX;
    this.y = engine.marioY;
    this.vx = engine.marioVx;
    this.vy = engine.marioVy;
    this.power = engine.marioPower;
    this.state = engine.marioState;
    this.facing = engine.marioFacing;
    this.grounded = engine.marioGrounded;
    this.isSpinJumping = engine.isSpinJumping;
    this.spinJumpTimer = engine.spinJumpTimer;
    this.isFluttering = engine.isFluttering;
    this.isStatue = engine.isStatue;
    this.starTimer = engine.marioStarTimer;
    this.tailWhipTimer = engine.tailWhipTimer;
    this.animFrame = engine.marioAnimFrame;
    this.animTimer = engine.marioAnimTimer;
    this.prevJumpHeld = Boolean(engine.controls.jump);
    this.prevSpinHeld = Boolean(engine.controls.spinJump);
  }
}

export interface TileHitInfo {
  tileX: number;
  tileY: number;
  tile: BlockTile;
}

export interface TileMapCollisionResult {
  hitWall: boolean;
  landed: boolean;
  hitCeiling: boolean;
  collidedTiles: TileHitInfo[];
  revealedHiddenBlocks: TileHitInfo[];
}

export interface TileMapSwitchState {
  yellow?: boolean;
  green?: boolean;
  red?: boolean;
  pink?: boolean;
  blue?: boolean;
}

/**
 * TileMap system managing level tile loading, visibility-culled static block
 * rendering via SpriteAtlas, and horizontal/vertical AABB collision detection
 * between Mario (Player) and the environment.
 */
export class TileMap {
  public static readonly DEFAULT_TILE_SIZE = 16;

  public level: LevelData | null = null;
  public width: number = 0;
  public height: number = 0;
  public tileSize: number;
  public tiles: (BlockTile | null)[][] = [];
  public switchStates: Record<SmwSwitchColor, boolean> = {
    yellow: false,
    green: false,
    red: false,
    pink: false,
    blue: false,
  };
  private atlas: SpriteAtlas | null = null;

  constructor(level?: LevelData, tileSize: number = TileMap.DEFAULT_TILE_SIZE) {
    this.tileSize = tileSize;
    if (level) {
      this.loadLevel(level);
    }
  }

  public loadLevel(level: LevelData, cloneTiles: boolean = true): void {
    this.level = level;
    this.width = level.width;
    this.height = level.height;
    this.tiles = cloneTiles
      ? level.tiles.map(row =>
          row.map(cell => (cell ? { ...cell } : null))
        )
      : level.tiles;
  }

  public setSwitchStates(states: TileMapSwitchState): void {
    if (states.yellow !== undefined) this.switchStates.yellow = states.yellow;
    if (states.green !== undefined) this.switchStates.green = states.green;
    if (states.red !== undefined) this.switchStates.red = states.red;
    if (states.pink !== undefined) this.switchStates.pink = states.pink;
    if (states.blue !== undefined) this.switchStates.blue = states.blue;
  }

  public getTileAt(tx: number, ty: number): BlockTile | null {
    if (ty < 0 || ty >= this.height || tx < 0 || tx >= this.width) {
      return null;
    }
    return this.tiles[ty]?.[tx] ?? null;
  }

  public setTileAt(tx: number, ty: number, tile: BlockTile | null): boolean {
    if (ty < 0 || ty >= this.height || tx < 0 || tx >= this.width) {
      return false;
    }
    if (!this.tiles[ty]) return false;
    this.tiles[ty][tx] = tile;
    return true;
  }

  public isSolidTile(type: TileType): boolean {
    if (
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
      type === 'bonus_block' ||
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
    ) {
      return true;
    }
    if (type === 'exclam_yellow') return this.switchStates.yellow;
    if (type === 'exclam_green') return this.switchStates.green;
    if (type === 'exclam_red') return this.switchStates.red;
    if (type === 'exclam_pink') return this.switchStates.pink;
    if (type === 'exclam_blue') return this.switchStates.blue;
    return false;
  }

  public getTilesIntersecting(rect: Rect): TileHitInfo[] {
    const hits: TileHitInfo[] = [];
    const minTX = Math.floor(rect.x / this.tileSize);
    const maxTX = Math.floor((rect.x + rect.width - 0.01) / this.tileSize);
    const minTY = Math.floor(rect.y / this.tileSize);
    const maxTY = Math.floor((rect.y + rect.height - 0.01) / this.tileSize);

    for (let ty = minTY; ty <= maxTY; ty++) {
      if (ty < 0 || ty >= this.height) continue;
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (tx < 0 || tx >= this.width) continue;
        const tile = this.tiles[ty]?.[tx];
        if (tile && (!tile.invisible || tile.bumpOffset !== 0)) {
          hits.push({ tileX: tx, tileY: ty, tile });
        }
      }
    }
    return hits;
  }

  public resolvePlayerCollision(
    player: Player,
    callbacks?: {
      onBlockHit?: (hit: TileHitInfo) => void;
    }
  ): TileMapCollisionResult {
    const result: TileMapCollisionResult = {
      hitWall: false,
      landed: false,
      hitCeiling: false,
      collidedTiles: [],
      revealedHiddenBlocks: [],
    };
    if (this.width <= 0 || this.height <= 0) return result;

    const collisionWidth = 14;
    const height = player.getHeight();

    // 1. Horizontal movement + level bounds clamp + wall collision
    player.x += player.vx;
    if (player.x < 0) {
      player.x = 0;
      player.vx = 0;
      result.hitWall = true;
    }
    const maxPlayerX = this.width * this.tileSize - Player.WIDTH;
    if (player.x > maxPlayerX) {
      player.x = maxPlayerX;
      player.vx = 0;
      result.hitWall = true;
    }

    const horizBox: Rect = {
      x: player.x + 1,
      y: player.y,
      width: collisionWidth,
      height: height - 2,
    };
    for (const hit of this.getTilesIntersecting(horizBox)) {
      if (this.isSolidTile(hit.tile.type)) {
        if (player.vx > 0) {
          player.x = hit.tileX * this.tileSize - (collisionWidth + 1);
        } else if (player.vx < 0) {
          player.x = (hit.tileX + 1) * this.tileSize - 1;
        }
        player.vx = 0;
        result.hitWall = true;
        result.collidedTiles.push(hit);
        break;
      }
    }

    // 2. Vertical movement + hidden block reveal + floor/ceiling collision
    const prevY = player.y;
    player.y += player.vy;
    player.grounded = false;

    if (player.vy < 0) {
      const currHeadTY = Math.floor(player.y / this.tileSize);
      const prevHeadTY = Math.floor(prevY / this.tileSize);
      const minTX = Math.floor((player.x + 2) / this.tileSize);
      const maxTX = Math.floor((player.x + collisionWidth - 2) / this.tileSize);

      let foundHidden = false;
      for (let ty = prevHeadTY; ty >= currHeadTY && !foundHidden; ty--) {
        if (ty < 0 || ty >= this.height) continue;
        for (let tx = minTX; tx <= maxTX; tx++) {
          if (tx < 0 || tx >= this.width) continue;
          const block = this.tiles[ty]?.[tx];
          if (block && block.invisible) {
            const blockBottomY = (ty + 1) * this.tileSize;
            if (prevY >= blockBottomY - 4) {
              block.invisible = false;
              player.y = blockBottomY;
              player.vy = 0;
              const hitInfo: TileHitInfo = { tileX: tx, tileY: ty, tile: block };
              result.hitCeiling = true;
              result.revealedHiddenBlocks.push(hitInfo);
              result.collidedTiles.push(hitInfo);
              callbacks?.onBlockHit?.(hitInfo);
              foundHidden = true;
              break;
            }
          }
        }
      }
    }

    const vertBox: Rect = {
      x: player.x + 1,
      y: player.y,
      width: collisionWidth,
      height,
    };
    for (const hit of this.getTilesIntersecting(vertBox)) {
      if (this.isSolidTile(hit.tile.type)) {
        if (player.vy > 0) {
          player.y = hit.tileY * this.tileSize - height;
          player.vy = 0;
          player.grounded = true;
          player.isSpinJumping = false;
          player.spinJumpTimer = 0;
          player.isFluttering = false;
          if (player.state === 'jumping' || player.state === 'falling') {
            player.state = Math.abs(player.vx) > 0.1 ? 'running' : 'idle';
          }
          result.landed = true;
          result.collidedTiles.push(hit);
        } else if (player.vy < 0) {
          player.y = (hit.tileY + 1) * this.tileSize;
          player.vy = 0;
          result.hitCeiling = true;
          result.collidedTiles.push(hit);
          callbacks?.onBlockHit?.(hit);
        }
        break;
      }
    }

    return result;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    viewportWidth: number = GameEngine.NES_WIDTH
  ): void {
    if (this.width <= 0 || this.height <= 0) return;
    if (!this.atlas) {
      this.atlas = SpriteAtlas.get();
    }
    const atlas = this.atlas;
    const startTX = Math.max(0, Math.floor(cameraX / this.tileSize));
    const endTX = Math.min(this.width - 1, Math.ceil((cameraX + viewportWidth) / this.tileSize));
    const qFrame = Math.floor((Date.now() / 150) % 4);
    const lavaFrame = Math.floor((Date.now() / 220) % 2);
    const axeFrame = Math.floor((Date.now() / 160) % 2);

    for (let ty = 0; ty < this.height; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const block = this.tiles[ty]?.[tx];
        if (!block || (block.invisible && block.bumpOffset === 0)) continue;

        const screenX = tx * this.tileSize - cameraX;
        const screenY = Math.round(ty * this.tileSize + block.bumpOffset);

        switch (block.type) {
          case 'ground':
            ctx.drawImage(atlas.tileGround, screenX, screenY);
            break;
          case 'underground_ground':
            ctx.drawImage(atlas.tileGroundUnderground, screenX, screenY);
            break;
          case 'brick':
            ctx.drawImage(atlas.tileBrick, screenX, screenY);
            break;
          case 'underground_brick':
            ctx.drawImage(atlas.tileBrickUnderground, screenX, screenY);
            break;
          case 'coral':
            ctx.drawImage(atlas.tileCoral, screenX, screenY);
            break;
          case 'sea_ground':
            ctx.drawImage(atlas.tileSeaGround, screenX, screenY);
            break;
          case 'ghost_floor':
            ctx.drawImage(atlas.tileGhostFloor, screenX, screenY);
            break;
          case 'ghost_brick':
            ctx.drawImage(atlas.tileGhostBrick, screenX, screenY);
            break;
          case 'question':
            ctx.drawImage(atlas.tileQuestionFrames[qFrame], screenX, screenY);
            break;
          case 'question_empty':
            ctx.drawImage(atlas.tileQuestionEmpty, screenX, screenY);
            break;
          case 'exclam_yellow':
            ctx.drawImage(
              this.switchStates.yellow ? atlas.tileExclamYellowActive : atlas.tileExclamYellowLocked,
              screenX,
              screenY
            );
            break;
          case 'exclam_green':
            ctx.drawImage(
              this.switchStates.green ? atlas.tileExclamGreenActive : atlas.tileExclamGreenLocked,
              screenX,
              screenY
            );
            break;
          case 'exclam_red':
            ctx.drawImage(
              this.switchStates.red ? atlas.tileExclamRedActive : atlas.tileExclamRedLocked,
              screenX,
              screenY
            );
            break;
          case 'exclam_pink':
            ctx.drawImage(
              this.switchStates.pink ? atlas.tileExclamPinkActive : atlas.tileExclamPinkLocked,
              screenX,
              screenY
            );
            break;
          case 'exclam_blue':
            ctx.drawImage(
              this.switchStates.blue ? atlas.tileExclamBlueActive : atlas.tileExclamBlueLocked,
              screenX,
              screenY
            );
            break;
          case 'yellow_switch':
            ctx.drawImage(atlas.tileYellowSwitch, screenX, screenY);
            break;
          case 'yellow_switch_pressed':
            ctx.drawImage(atlas.tileYellowSwitchPressed, screenX, screenY);
            break;
          case 'green_switch':
            ctx.drawImage(atlas.tileGreenSwitch, screenX, screenY);
            break;
          case 'green_switch_pressed':
            ctx.drawImage(atlas.tileGreenSwitchPressed, screenX, screenY);
            break;
          case 'red_switch':
            ctx.drawImage(atlas.tileRedSwitch, screenX, screenY);
            break;
          case 'red_switch_pressed':
            ctx.drawImage(atlas.tileRedSwitchPressed, screenX, screenY);
            break;
          case 'pink_switch':
            ctx.drawImage(atlas.tilePinkSwitch, screenX, screenY);
            break;
          case 'pink_switch_pressed':
            ctx.drawImage(atlas.tilePinkSwitchPressed, screenX, screenY);
            break;
          case 'blue_switch':
            ctx.drawImage(atlas.tileBlueSwitch, screenX, screenY);
            break;
          case 'blue_switch_pressed':
            ctx.drawImage(atlas.tileBlueSwitchPressed, screenX, screenY);
            break;
          case 'hard_block':
            ctx.drawImage(atlas.tileHardBlock, screenX, screenY);
            break;
          case 'pipe_top_left':
          case 'pipe_warp_top_left':
            ctx.drawImage(atlas.pipeTopLeft, screenX, screenY);
            break;
          case 'pipe_top_right':
          case 'pipe_warp_top_right':
            ctx.drawImage(atlas.pipeTopRight, screenX, screenY);
            break;
          case 'pipe_body_left':
            ctx.drawImage(atlas.pipeBodyLeft, screenX, screenY);
            break;
          case 'pipe_body_right':
            ctx.drawImage(atlas.pipeBodyRight, screenX, screenY);
            break;
          case 'castle_brick':
          case 'castle_stone':
          case 'castle_crenel':
            ctx.drawImage(atlas.castleBrick, screenX, screenY);
            break;
          case 'castle_door':
            ctx.drawImage(atlas.castleDoor, screenX, screenY);
            break;
          case 'pole':
            ctx.drawImage(atlas.flagPoleBody, screenX, screenY);
            break;
          case 'pole_top':
            ctx.drawImage(atlas.flagPoleTop, screenX, screenY);
            break;
          case 'lava':
            ctx.drawImage(atlas.tileLavaFrames[lavaFrame], screenX, screenY);
            break;
          case 'bridge':
            ctx.drawImage(atlas.tileBridge, screenX, screenY);
            break;
          case 'axe':
            ctx.drawImage(atlas.tileAxeFrames[axeFrame], screenX, screenY);
            break;
        }
      }
    }
  }

  public syncFromEngine(engine: GameEngine): void {
    if (engine.level) {
      if (this.level !== engine.level) {
        this.loadLevel(engine.level, false);
      } else {
        this.width = engine.level.width;
        this.height = engine.level.height;
        this.tiles = engine.level.tiles;
      }
    }
    this.setSwitchStates({
      yellow: engine.yellowSwitchUnlocked,
      green: engine.greenSwitchUnlocked,
      red: engine.redSwitchUnlocked,
      pink: engine.pinkSwitchUnlocked,
      blue: engine.blueSwitchUnlocked,
    });
  }

  public getQuestionBlocks(): QuestionBlock[] {
    const blocks: QuestionBlock[] = [];
    for (let ty = 0; ty < this.height; ty++) {
      const row = this.tiles[ty];
      if (!row) continue;
      for (let tx = 0; tx < this.width; tx++) {
        const tile = row[tx];
        if (tile && (tile.type === 'question' || tile.type === 'question_empty')) {
          blocks.push(QuestionBlock.fromTile(tx, ty, tile, this.tileSize));
        }
      }
    }
    return blocks;
  }
}

export type GoombaCollisionOutcome = 'none' | 'stomped' | 'hurt_player' | 'star_defeat';

export interface GoombaUpdateResult {
  turnedAround: boolean;
  hitPipe: boolean;
  hitWall: boolean;
  hitWorldBound: boolean;
  landed: boolean;
  collidedTiles: TileHitInfo[];
}

/**
 * Classic Goomba enemy implementing horizontal patrol velocity, gravity,
 * pipe and solid tile collision reversal, Mario stomp/hurt/starman interaction,
 * and SpriteAtlas canvas rendering.
 */
export class Goomba {
  public static readonly WIDTH = 16;
  public static readonly HEIGHT = 16;
  public static readonly DEFAULT_SPEED = 0.72;
  public static readonly GRAVITY = 0.35;
  public static readonly MAX_FALL_SPEED = 6.0;
  public static readonly ANIM_INTERVAL = 10;
  public static readonly SQUASH_DURATION = 30;
  public static readonly STOMP_BOUNCE_VY = -6.0;
  public static readonly SPIN_STOMP_BOUNCE_VY = -5.4;
  public static readonly STAR_FLIP_VY = -5.0;

  public id: number;
  public readonly type = 'goomba' as const;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number = 0;
  public width: number = Goomba.WIDTH;
  public height: number = Goomba.HEIGHT;
  public alive: boolean = true;
  public state: 'walk' | 'squashed' | 'flipped' = 'walk';
  public stateTimer: number = 0;
  public facing: 'left' | 'right';
  public grounded: boolean = false;
  public animFrame: number = 0;
  public animTimer: number = 0;

  constructor(
    x: number = 0,
    y: number = 0,
    initialVx: number = -Goomba.DEFAULT_SPEED,
    id: number = 0
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = initialVx;
    this.facing = initialVx > 0 ? 'right' : 'left';
  }

  public static isPipeTile(type: TileType): boolean {
    return (
      type === 'pipe_top_left' ||
      type === 'pipe_top_right' ||
      type === 'pipe_body_left' ||
      type === 'pipe_body_right' ||
      type === 'pipe_warp_top_left' ||
      type === 'pipe_warp_top_right' ||
      type === 'pipe_horiz_top' ||
      type === 'pipe_horiz_bottom'
    );
  }

  public getHitbox(): Rect {
    return {
      x: this.x + 1,
      y: this.y + 1,
      width: this.width - 2,
      height: this.height - 1,
    };
  }

  public isExpired(levelPixelHeight: number = 240): boolean {
    if (this.state === 'squashed') {
      return this.stateTimer >= Goomba.SQUASH_DURATION;
    }
    if (this.state === 'flipped') {
      return this.y > levelPixelHeight + 48;
    }
    return !this.alive;
  }

  public update(tileMap?: TileMap): GoombaUpdateResult {
    const result: GoombaUpdateResult = {
      turnedAround: false,
      hitPipe: false,
      hitWall: false,
      hitWorldBound: false,
      landed: false,
      collidedTiles: [],
    };

    if (this.state === 'squashed') {
      this.stateTimer++;
      return result;
    }

    if (this.state === 'flipped') {
      this.vy = Math.min(Goomba.MAX_FALL_SPEED, this.vy + Goomba.GRAVITY);
      this.x += this.vx;
      this.y += this.vy;
      this.stateTimer++;
      return result;
    }

    // Walking animation toggle every 10 frames (matching NES Goomba stride)
    this.animTimer++;
    if (this.animTimer % Goomba.ANIM_INTERVAL === 0) {
      this.animFrame = (this.animFrame + 1) % 2;
    }

    // Horizontal patrol step
    this.x += this.vx;

    if (tileMap) {
      const tileSize = tileMap.tileSize;
      const levelPixelWidth = tileMap.width * tileSize;

      // World horizontal boundary check
      if (this.x < 0) {
        this.x = 0;
        this.vx = Math.abs(this.vx) || Goomba.DEFAULT_SPEED;
        this.facing = 'right';
        result.hitWorldBound = true;
        result.turnedAround = true;
      } else if (levelPixelWidth > 0 && this.x + this.width > levelPixelWidth) {
        this.x = levelPixelWidth - this.width;
        this.vx = -(Math.abs(this.vx) || Goomba.DEFAULT_SPEED);
        this.facing = 'left';
        result.hitWorldBound = true;
        result.turnedAround = true;
      }

      // Horizontal wall and pipe collision check with exact boundary snapping
      const boxH: Rect = {
        x: this.x,
        y: this.y + 1,
        width: this.width,
        height: this.height - 3,
      };
      const tilesH = tileMap.getTilesIntersecting(boxH);
      for (const hit of tilesH) {
        if (tileMap.isSolidTile(hit.tile.type)) {
          if (this.vx > 0) {
            this.x = hit.tileX * tileSize - this.width;
          } else if (this.vx < 0) {
            this.x = (hit.tileX + 1) * tileSize;
          }
          this.vx = -this.vx;
          this.facing = this.vx > 0 ? 'right' : 'left';
          result.hitWall = true;
          result.hitPipe = Goomba.isPipeTile(hit.tile.type);
          result.turnedAround = true;
          result.collidedTiles.push(hit);
          break;
        }
      }
    }

    // Vertical gravity & ground/pipe-top collision
    this.vy = Math.min(Goomba.MAX_FALL_SPEED, this.vy + Goomba.GRAVITY);
    this.y += this.vy;
    this.grounded = false;

    if (tileMap) {
      const tileSize = tileMap.tileSize;
      const boxV: Rect = {
        x: this.x + 1,
        y: this.y,
        width: this.width - 2,
        height: this.height,
      };
      const tilesV = tileMap.getTilesIntersecting(boxV);
      for (const hit of tilesV) {
        if (tileMap.isSolidTile(hit.tile.type)) {
          if (this.vy > 0) {
            this.y = hit.tileY * tileSize - this.height;
            this.vy = 0;
            this.grounded = true;
            result.landed = true;
            result.collidedTiles.push(hit);
          } else if (this.vy < 0) {
            this.y = (hit.tileY + 1) * tileSize;
            this.vy = 0;
            result.collidedTiles.push(hit);
          }
          break;
        }
      }
    }

    return result;
  }

  public checkPlayerCollision(player: Player): GoombaCollisionOutcome {
    if (!this.alive || this.state !== 'walk') {
      return 'none';
    }

    if (
      player.state === 'dead' ||
      player.state === 'pipe_entering' ||
      player.state === 'pipe_exiting' ||
      player.state === 'pole_slide' ||
      player.state === 'castle_walk' ||
      player.state === 'castle_entered'
    ) {
      return 'none';
    }

    const marioBox = player.getHitbox();
    const goombaBox = this.getHitbox();
    const overlaps =
      marioBox.x < goombaBox.x + goombaBox.width &&
      marioBox.x + marioBox.width > goombaBox.x &&
      marioBox.y < goombaBox.y + goombaBox.height &&
      marioBox.y + marioBox.height > goombaBox.y;

    if (!overlaps) {
      return 'none';
    }

    if (player.starTimer > 0) {
      this.alive = false;
      this.state = 'flipped';
      this.vy = Goomba.STAR_FLIP_VY;
      return 'star_defeat';
    }

    const prevMarioBottom = marioBox.y + marioBox.height - player.vy;
    const isStomp = player.vy > 0 && prevMarioBottom <= this.y + (player.isSpinJumping ? 13 : 9);

    if (isStomp) {
      this.alive = false;
      this.state = 'squashed';
      this.vx = 0;
      this.vy = 0;
      this.stateTimer = 0;
      player.grounded = false;
      player.state = 'jumping';
      player.vy = player.isSpinJumping ? Goomba.SPIN_STOMP_BOUNCE_VY : Goomba.STOMP_BOUNCE_VY;
      return 'stomped';
    }

    return 'hurt_player';
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const screenX = Math.round(this.x - cameraX);
    if (screenX < -32 || screenX > 288) {
      return;
    }

    const atlas = SpriteAtlas.get();
    if (this.state === 'squashed') {
      ctx.drawImage(atlas.goombaSquashed, screenX, Math.round(this.y + 1));
      return;
    }

    if (this.state === 'flipped') {
      ctx.save();
      ctx.translate(screenX + this.width / 2, Math.round(this.y) + this.height / 2);
      ctx.scale(1, -1);
      ctx.drawImage(atlas.goombaWalk1, -this.width / 2, -this.height / 2);
      ctx.restore();
      return;
    }

    const frame = this.animFrame % 2 === 0 ? atlas.goombaWalk1 : atlas.goombaWalk2;
    ctx.drawImage(frame, screenX, Math.round(this.y));
  }

  public syncFromEnemy(enemy: Enemy): void {
    this.id = enemy.id;
    this.x = enemy.x;
    this.y = enemy.y;
    this.vx = enemy.vx;
    this.vy = enemy.vy;
    this.width = enemy.width;
    this.height = enemy.height;
    this.alive = enemy.alive;
    this.state =
      enemy.state === 'squashed' || enemy.state === 'flipped' ? enemy.state : 'walk';
    this.stateTimer = enemy.stateTimer;
    this.facing = enemy.facing;
    this.animFrame = enemy.animFrame;
    this.animTimer = enemy.animTimer;
  }

  public static fromEnemy(enemy: Enemy): Goomba {
    const goomba = new Goomba(enemy.x, enemy.y, enemy.vx, enemy.id);
    goomba.syncFromEnemy(enemy);
    return goomba;
  }
}

export interface QuestionBlockBumpResult {
  bumped: boolean;
  spent: boolean;
  revealedInvisible: boolean;
  spawnedItem: ItemContent;
  coinAwarded: boolean;
  depletedToEmpty: boolean;
}

export interface QuestionBlockOptions {
  type?: 'question' | 'question_empty';
  coinsLeft?: number;
  invisible?: boolean;
  tileSize?: number;
}

/**
 * Interactive Question Block (?) containing coins or power-ups when bumped
 * from below by Mario. Supports classic Mario power-dependent progression
 * (mushroom -> fireflower when already Super+), multi-coin blocks, invisible
 * hidden blocks, spring bump animation, and SpriteAtlas rendering.
 */
export class QuestionBlock {
  public static readonly WIDTH = 16;
  public static readonly HEIGHT = 16;
  public static readonly BUMP_INITIAL_VY = -4;
  public static readonly BUMP_GRAVITY = 0.8;

  public tileX: number;
  public tileY: number;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public type: 'question' | 'question_empty';
  public content: ItemContent;
  public bumpOffset: number = 0;
  public bumpVel: number = 0;
  public coinsLeft: number;
  public invisible: boolean;

  constructor(
    tileX: number = 0,
    tileY: number = 0,
    content: ItemContent = 'coin',
    options?: QuestionBlockOptions
  ) {
    const tileSize = options?.tileSize ?? QuestionBlock.WIDTH;
    this.tileX = tileX;
    this.tileY = tileY;
    this.x = tileX * tileSize;
    this.y = tileY * tileSize;
    this.width = tileSize;
    this.height = tileSize;
    this.type = options?.type ?? (content === 'none' ? 'question_empty' : 'question');
    this.content = this.type === 'question_empty' ? 'none' : content;
    this.coinsLeft =
      options?.coinsLeft ?? (this.content === 'coin' && this.type === 'question' ? 1 : 0);
    this.invisible = Boolean(options?.invisible);
  }

  public isEmpty(): boolean {
    return this.type === 'question_empty' || this.content === 'none';
  }

  public isSolid(): boolean {
    return !this.invisible || this.bumpOffset !== 0;
  }

  public getHitbox(): Rect {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Resolves which item should emerge given Mario's current power state,
   * matching classic SMB progressive upgrade behavior for mushroom blocks.
   */
  public resolveDispensedItem(playerPower: MarioPower = 'small'): ItemContent {
    if (this.isEmpty()) {
      return 'none';
    }
    if (this.content === 'mushroom') {
      return playerPower === 'small' ? 'mushroom' : 'fireflower';
    }
    return this.content;
  }

  /**
   * Triggers a bump from below, revealing hidden blocks, starting the spring
   * bounce animation, dispensing a coin or power-up, and transitioning to
   * 'question_empty' once exhausted.
   */
  public bumpFromBelow(player?: Player): QuestionBlockBumpResult {
    if (this.bumpOffset !== 0 || this.bumpVel !== 0) {
      return {
        bumped: false,
        spent: this.isEmpty(),
        revealedInvisible: false,
        spawnedItem: 'none',
        coinAwarded: false,
        depletedToEmpty: false,
      };
    }

    if (this.isEmpty()) {
      return {
        bumped: false,
        spent: true,
        revealedInvisible: false,
        spawnedItem: 'none',
        coinAwarded: false,
        depletedToEmpty: false,
      };
    }

    const revealedInvisible = this.invisible;
    this.invisible = false;
    this.bumpOffset = 0;
    this.bumpVel = QuestionBlock.BUMP_INITIAL_VY;

    const spawnedItem = this.resolveDispensedItem(player?.power ?? 'small');
    const coinAwarded = spawnedItem === 'coin';
    let depletedToEmpty = false;

    if (this.content === 'coin' && this.coinsLeft > 1) {
      this.coinsLeft -= 1;
    } else {
      this.coinsLeft = 0;
      this.type = 'question_empty';
      this.content = 'none';
      depletedToEmpty = true;
    }

    return {
      bumped: true,
      spent: false,
      revealedInvisible,
      spawnedItem,
      coinAwarded,
      depletedToEmpty,
    };
  }

  /**
   * Checks whether an upward-moving Player bumps the bottom face of this
   * QuestionBlock, snaps Player's head beneath the block, zeroes vy, and
   * dispenses the block's contents.
   */
  public checkPlayerBumpFromBelow(player: Player): QuestionBlockBumpResult {
    const emptyResult: QuestionBlockBumpResult = {
      bumped: false,
      spent: this.isEmpty(),
      revealedInvisible: false,
      spawnedItem: 'none',
      coinAwarded: false,
      depletedToEmpty: false,
    };

    if (
      player.vy >= 0 ||
      player.state === 'dead' ||
      player.state === 'pipe_entering' ||
      player.state === 'pipe_exiting' ||
      player.state === 'pole_slide' ||
      player.state === 'castle_walk' ||
      player.state === 'castle_entered'
    ) {
      return emptyResult;
    }

    const playerBox = player.getHitbox();
    const blockBottom = this.y + this.height;
    const prevTop = playerBox.y - player.vy;
    const horizOverlap =
      playerBox.x < this.x + this.width && playerBox.x + playerBox.width > this.x;
    const hitBottomFromBelow =
      horizOverlap &&
      playerBox.y <= blockBottom &&
      prevTop >= blockBottom - 4 &&
      playerBox.y + playerBox.height > this.y;

    if (!hitBottomFromBelow) {
      return emptyResult;
    }

    player.y = blockBottom;
    player.vy = 0;
    return this.bumpFromBelow(player);
  }

  /**
   * Advances the block's vertical bump bounce animation by one frame (60 FPS).
   */
  public update(): void {
    if (this.bumpOffset !== 0 || this.bumpVel !== 0) {
      this.bumpOffset += this.bumpVel;
      this.bumpVel += QuestionBlock.BUMP_GRAVITY;
      if (this.bumpOffset >= 0) {
        this.bumpOffset = 0;
        this.bumpVel = 0;
      }
    }
  }

  public syncFromTile(tile: BlockTile): void {
    this.type = tile.type === 'question_empty' ? 'question_empty' : 'question';
    this.content = this.type === 'question_empty' ? 'none' : tile.content;
    this.bumpOffset = tile.bumpOffset;
    this.bumpVel = tile.bumpVel;
    this.coinsLeft =
      tile.coinsLeft ?? (this.content === 'coin' && this.type === 'question' ? 1 : 0);
    this.invisible = Boolean(tile.invisible);
  }

  public syncToTile(tile: BlockTile): void {
    tile.type = this.type;
    tile.content = this.content;
    tile.bumpOffset = this.bumpOffset;
    tile.bumpVel = this.bumpVel;
    tile.coinsLeft = this.coinsLeft;
    tile.invisible = this.invisible;
  }

  public toTile(): BlockTile {
    return {
      type: this.type,
      content: this.content,
      bumpOffset: this.bumpOffset,
      bumpVel: this.bumpVel,
      coinsLeft: this.coinsLeft,
      invisible: this.invisible,
    };
  }

  public static fromTile(
    tileX: number,
    tileY: number,
    tile: BlockTile,
    tileSize: number = QuestionBlock.WIDTH
  ): QuestionBlock {
    const qb = new QuestionBlock(tileX, tileY, tile.content, {
      type: tile.type === 'question_empty' ? 'question_empty' : 'question',
      coinsLeft: tile.coinsLeft,
      invisible: tile.invisible,
      tileSize,
    });
    qb.syncFromTile(tile);
    return qb;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    animTickMs: number = Date.now()
  ): void {
    if (this.invisible && this.bumpOffset === 0) {
      return;
    }

    const screenX = Math.round(this.x - cameraX);
    if (screenX < -32 || screenX > 288) {
      return;
    }

    const atlas = SpriteAtlas.get();
    const screenY = Math.round(this.y + this.bumpOffset);
    if (this.type === 'question_empty') {
      ctx.drawImage(atlas.tileQuestionEmpty, screenX, screenY);
    } else {
      const qFrame = Math.floor((animTickMs / 150) % atlas.tileQuestionFrames.length);
      ctx.drawImage(atlas.tileQuestionFrames[qFrame], screenX, screenY);
    }
  }
}

export type KoopaVariant = 'koopa' | 'red_koopa';
export type KoopaState = 'walk' | 'shell_idle' | 'shell_moving' | 'flipped';
export type KoopaCollisionOutcome =
  | 'none'
  | 'entered_shell'
  | 'kicked_shell'
  | 'stopped_shell'
  | 'hurt_player'
  | 'star_defeat'
  | 'spin_defeat';

export interface KoopaUpdateResult {
  turnedAround: boolean;
  turnedAtLedge: boolean;
  hitPipe: boolean;
  hitWall: boolean;
  hitWorldBound: boolean;
  landed: boolean;
  wokeUp: boolean;
  collidedTiles: TileHitInfo[];
}

export interface KoopaEnemyCollisionResult {
  defeatedOther: boolean;
  turnedAround: boolean;
  bouncedBothShells: boolean;
}

/**
 * Classic Koopa Troopa (Green & Red) supporting horizontal patrol, Red Koopa
 * platform ledge reversal, retreat-into-shell stomp mechanics, sliding shell
 * physics (wall/pipe rebound, enemy sweeping combos, stomp-to-stop, kick-to-slide),
 * idle shell wake-up recovery, and SpriteAtlas rendering.
 */
export class KoopaTroopa {
  public static readonly WIDTH = 16;
  public static readonly WALK_HEIGHT = 24;
  public static readonly SHELL_HEIGHT = 16;
  public static readonly GREEN_SPEED = 0.78;
  public static readonly RED_SPEED = 1.28;
  public static readonly SHELL_SLIDE_SPEED = 4.8;
  public static readonly SHELL_STOMP_KICK_SPEED = 4.2;
  public static readonly GRAVITY = 0.35;
  public static readonly MAX_FALL_SPEED = 6.0;
  public static readonly ANIM_INTERVAL = 10;
  public static readonly SHELL_REVIVE_TIME = 330;
  public static readonly KICK_GRACE_FRAMES = 8;
  public static readonly STOMP_BOUNCE_VY = -6.0;
  public static readonly SHELL_STOP_BOUNCE_VY = -5.5;
  public static readonly SHELL_KICK_BOUNCE_VY = -5.0;
  public static readonly STAR_FLIP_VY = -5.0;

  public id: number;
  public type: KoopaVariant;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number = 0;
  public width: number = KoopaTroopa.WIDTH;
  public height: number = KoopaTroopa.WALK_HEIGHT;
  public alive: boolean = true;
  public state: KoopaState = 'walk';
  public stateTimer: number = 0;
  public facing: 'left' | 'right';
  public grounded: boolean = false;
  public animFrame: number = 0;
  public animTimer: number = 0;
  public shellKillStreak: number = 0;

  constructor(
    x: number = 0,
    y: number = 0,
    variant: KoopaVariant = 'koopa',
    initialVx?: number,
    id: number = 0
  ) {
    this.id = id;
    this.type = variant;
    this.x = x;
    this.y = y;
    const defaultSpeed =
      variant === 'red_koopa' ? KoopaTroopa.RED_SPEED : KoopaTroopa.GREEN_SPEED;
    this.vx = initialVx !== undefined ? initialVx : -defaultSpeed;
    this.facing = this.vx > 0 ? 'right' : 'left';
  }

  public isShell(): boolean {
    return this.state === 'shell_idle' || this.state === 'shell_moving';
  }

  public getHitbox(): Rect {
    return {
      x: this.x + 1,
      y: this.y + 1,
      width: this.width - 2,
      height: this.height - 1,
    };
  }

  public isExpired(levelPixelHeight: number = 240): boolean {
    if (this.state === 'flipped') {
      return this.y > levelPixelHeight + 48;
    }
    return !this.alive;
  }

  public enterShell(reviveTime: number = KoopaTroopa.SHELL_REVIVE_TIME): void {
    if (this.state === 'walk') {
      this.y += KoopaTroopa.WALK_HEIGHT - KoopaTroopa.SHELL_HEIGHT;
    }
    this.state = 'shell_idle';
    this.height = KoopaTroopa.SHELL_HEIGHT;
    this.vx = 0;
    this.stateTimer = reviveTime;
    this.shellKillStreak = 0;
  }

  public stopShell(reviveTime: number = KoopaTroopa.SHELL_REVIVE_TIME): void {
    this.state = 'shell_idle';
    this.height = KoopaTroopa.SHELL_HEIGHT;
    this.vx = 0;
    this.stateTimer = reviveTime;
    this.shellKillStreak = 0;
  }

  public kickShell(
    direction: -1 | 1,
    speed: number = KoopaTroopa.SHELL_SLIDE_SPEED
  ): void {
    if (this.state === 'walk') {
      this.y += KoopaTroopa.WALK_HEIGHT - KoopaTroopa.SHELL_HEIGHT;
    }
    this.state = 'shell_moving';
    this.height = KoopaTroopa.SHELL_HEIGHT;
    this.vx = direction * Math.abs(speed);
    this.facing = direction > 0 ? 'right' : 'left';
    this.stateTimer = KoopaTroopa.KICK_GRACE_FRAMES;
    this.shellKillStreak = 0;
  }

  public update(tileMap?: TileMap, targetX?: number): KoopaUpdateResult {
    const result: KoopaUpdateResult = {
      turnedAround: false,
      turnedAtLedge: false,
      hitPipe: false,
      hitWall: false,
      hitWorldBound: false,
      landed: false,
      wokeUp: false,
      collidedTiles: [],
    };

    if (this.state === 'flipped') {
      this.vy = Math.min(KoopaTroopa.MAX_FALL_SPEED, this.vy + KoopaTroopa.GRAVITY);
      this.x += this.vx;
      this.y += this.vy;
      this.stateTimer++;
      return result;
    }

    if (this.state === 'shell_idle') {
      if (this.stateTimer > 0) {
        this.stateTimer--;
        if (this.stateTimer <= 0) {
          const speed =
            this.type === 'red_koopa'
              ? KoopaTroopa.RED_SPEED
              : KoopaTroopa.GREEN_SPEED;
          const dir: -1 | 1 =
            targetX !== undefined
              ? targetX >= this.x
                ? 1
                : -1
              : this.facing === 'right'
              ? 1
              : -1;
          this.state = 'walk';
          this.height = KoopaTroopa.WALK_HEIGHT;
          this.y -= KoopaTroopa.WALK_HEIGHT - KoopaTroopa.SHELL_HEIGHT;
          this.facing = dir > 0 ? 'right' : 'left';
          this.vx = speed * dir;
          result.wokeUp = true;
        }
      }
    } else if (this.state === 'shell_moving') {
      if (this.stateTimer > 0) {
        this.stateTimer--;
      }
    } else {
      // Walking patrol stride every 10 frames
      this.animTimer++;
      if (this.animTimer % KoopaTroopa.ANIM_INTERVAL === 0) {
        this.animFrame = (this.animFrame + 1) % 2;
      }
    }

    // Horizontal step (walk or sliding shell)
    this.x += this.vx;

    if (tileMap) {
      const tileSize = tileMap.tileSize;
      const levelPixelWidth = tileMap.width * tileSize;

      // World boundary bounce
      if (this.x < 0) {
        this.x = 0;
        if (this.vx !== 0) {
          this.vx = Math.abs(this.vx);
          this.facing = 'right';
          result.hitWorldBound = true;
          result.turnedAround = true;
        }
      } else if (levelPixelWidth > 0 && this.x + this.width > levelPixelWidth) {
        this.x = levelPixelWidth - this.width;
        if (this.vx !== 0) {
          this.vx = -Math.abs(this.vx);
          this.facing = 'left';
          result.hitWorldBound = true;
          result.turnedAround = true;
        }
      }

      // Horizontal pipe/wall collision reversal (applies to both walk and sliding shell)
      if (this.vx !== 0) {
        const boxH: Rect = {
          x: this.x,
          y: this.y + 1,
          width: this.width,
          height: this.height - 3,
        };
        const tilesH = tileMap.getTilesIntersecting(boxH);
        for (const hit of tilesH) {
          if (tileMap.isSolidTile(hit.tile.type)) {
            if (this.vx > 0) {
              this.x = hit.tileX * tileSize - this.width;
            } else if (this.vx < 0) {
              this.x = (hit.tileX + 1) * tileSize;
            }
            this.vx = -this.vx;
            this.facing = this.vx > 0 ? 'right' : 'left';
            result.hitWall = true;
            result.hitPipe = Goomba.isPipeTile(hit.tile.type);
            result.turnedAround = true;
            result.collidedTiles.push(hit);
            break;
          }
        }
      }
    }

    // Vertical gravity & ground collision
    this.vy = Math.min(KoopaTroopa.MAX_FALL_SPEED, this.vy + KoopaTroopa.GRAVITY);
    this.y += this.vy;
    this.grounded = false;

    if (tileMap) {
      const tileSize = tileMap.tileSize;
      const boxV: Rect = {
        x: this.x + 1,
        y: this.y,
        width: this.width - 2,
        height: this.height,
      };
      const tilesV = tileMap.getTilesIntersecting(boxV);
      for (const hit of tilesV) {
        if (tileMap.isSolidTile(hit.tile.type)) {
          if (this.vy > 0) {
            this.y = hit.tileY * tileSize - this.height;
            this.vy = 0;
            this.grounded = true;
            result.landed = true;
            result.collidedTiles.push(hit);
          } else if (this.vy < 0) {
            this.y = (hit.tileY + 1) * tileSize;
            this.vy = 0;
            result.collidedTiles.push(hit);
          }
          break;
        }
      }

      // Red Koopa smart ledge-turn AI while walking on solid ground
      if (this.type === 'red_koopa' && this.state === 'walk' && this.grounded && this.vx !== 0) {
        const probeX = this.vx > 0 ? this.x + this.width + 2 : this.x - 2;
        const probeTX = Math.floor(probeX / tileSize);
        const footTY = Math.floor((this.y + this.height + 2) / tileSize);
        if (
          probeTX >= 0 &&
          probeTX < tileMap.width &&
          footTY >= 0 &&
          footTY < tileMap.height
        ) {
          const groundAhead = tileMap.getTileAt(probeTX, footTY);
          if (!groundAhead || !tileMap.isSolidTile(groundAhead.type)) {
            this.vx = -this.vx;
            this.facing = this.vx > 0 ? 'right' : 'left';
            result.turnedAtLedge = true;
            result.turnedAround = true;
          }
        }
      }
    }

    return result;
  }

  public checkPlayerCollision(player: Player): KoopaCollisionOutcome {
    if (!this.alive || this.state === 'flipped') {
      return 'none';
    }

    if (
      player.state === 'dead' ||
      player.state === 'pipe_entering' ||
      player.state === 'pipe_exiting' ||
      player.state === 'pole_slide' ||
      player.state === 'castle_walk' ||
      player.state === 'castle_entered'
    ) {
      return 'none';
    }

    const marioBox = player.getHitbox();
    const koopaBox = this.getHitbox();
    const overlaps =
      marioBox.x < koopaBox.x + koopaBox.width &&
      marioBox.x + marioBox.width > koopaBox.x &&
      marioBox.y < koopaBox.y + koopaBox.height &&
      marioBox.y + marioBox.height > koopaBox.y;

    if (!overlaps) {
      return 'none';
    }

    if (player.starTimer > 0) {
      this.alive = false;
      this.state = 'flipped';
      this.vy = KoopaTroopa.STAR_FLIP_VY;
      return 'star_defeat';
    }

    const prevMarioBottom = marioBox.y + marioBox.height - player.vy;
    const isShell = this.isShell();
    const isStomp =
      player.vy > 0 &&
      prevMarioBottom <= this.y + (isShell ? 12 : player.isSpinJumping ? 13 : 9);

    if (this.state === 'shell_moving' && this.stateTimer > 0 && !isStomp) {
      return 'none';
    }

    if (isStomp) {
      if (player.isSpinJumping) {
        this.alive = false;
        this.state = 'flipped';
        this.vx = 0;
        this.vy = -4.2;
        player.grounded = false;
        player.state = 'jumping';
        player.vy = Goomba.SPIN_STOMP_BOUNCE_VY;
        return 'spin_defeat';
      }

      if (this.state === 'walk') {
        this.enterShell();
        player.grounded = false;
        player.state = 'jumping';
        player.y = Math.min(player.y, this.y - player.getHeight());
        player.vy = KoopaTroopa.STOMP_BOUNCE_VY;
        return 'entered_shell';
      }

      if (this.state === 'shell_moving') {
        this.stopShell();
        player.grounded = false;
        player.state = 'jumping';
        player.y = Math.min(player.y, this.y - player.getHeight());
        player.vy = KoopaTroopa.SHELL_STOP_BOUNCE_VY;
        return 'stopped_shell';
      }

      // Stationary shell stomped from above -> kick sliding shell
      const dir: -1 | 1 = player.x + 7 < this.x + 8 ? 1 : -1;
      this.kickShell(dir, KoopaTroopa.SHELL_STOMP_KICK_SPEED);
      player.grounded = false;
      player.state = 'jumping';
      player.y = Math.min(player.y, this.y - player.getHeight());
      player.vy = KoopaTroopa.SHELL_KICK_BOUNCE_VY;
      return 'kicked_shell';
    }

    // Side contact
    if (this.state === 'shell_idle') {
      const dir: -1 | 1 = player.x < this.x ? 1 : -1;
      this.kickShell(dir, KoopaTroopa.SHELL_SLIDE_SPEED);
      return 'kicked_shell';
    }

    return 'hurt_player';
  }

  /**
   * Resolves shell-sweep or walking patrol collision against another enemy.
   */
  public checkEnemyCollision(other: KoopaTroopa | Goomba): KoopaEnemyCollisionResult {
    const result: KoopaEnemyCollisionResult = {
      defeatedOther: false,
      turnedAround: false,
      bouncedBothShells: false,
    };

    if (!this.alive || !other.alive || other === this) {
      return result;
    }

    const overlaps =
      this.x < other.x + other.width &&
      this.x + this.width > other.x &&
      this.y < other.y + other.height &&
      this.y + this.height > other.y;

    if (!overlaps) {
      return result;
    }

    if (this.state === 'shell_moving') {
      const otherWasMovingShell = other.state === 'shell_moving';
      other.alive = false;
      other.state = 'flipped';
      other.vy = -5;
      this.shellKillStreak++;
      result.defeatedOther = true;
      if (otherWasMovingShell) {
        this.alive = false;
        this.state = 'flipped';
        this.vy = -5;
        result.bouncedBothShells = true;
      }
      return result;
    }

    if (
      this.state === 'walk' &&
      (other.state === 'walk' || other.state === 'shell_idle')
    ) {
      const overlapX =
        Math.min(this.x + this.width, other.x + other.width) -
        Math.max(this.x, other.x);
      const overlapY =
        Math.min(this.y + this.height, other.y + other.height) -
        Math.max(this.y, other.y);
      if (overlapX > 0 && overlapY > 2) {
        const thisCenter = this.x + this.width / 2;
        const otherCenter = other.x + other.width / 2;
        const thisLeft = thisCenter <= otherCenter;
        if (other.state === 'walk') {
          const halfPush = overlapX / 2;
          this.x += thisLeft ? -halfPush : halfPush;
          other.x += thisLeft ? halfPush : -halfPush;
          this.vx = thisLeft ? -Math.abs(this.vx) : Math.abs(this.vx);
          this.facing = this.vx > 0 ? 'right' : 'left';
          other.vx = thisLeft ? Math.abs(other.vx) : -Math.abs(other.vx);
          other.facing = other.vx > 0 ? 'right' : 'left';
        } else {
          this.x = thisLeft ? other.x - this.width : other.x + other.width;
          this.vx = thisLeft ? -Math.abs(this.vx) : Math.abs(this.vx);
          this.facing = this.vx > 0 ? 'right' : 'left';
        }
        result.turnedAround = true;
      }
    }

    return result;
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const screenX = Math.round(this.x - cameraX);
    if (screenX < -32 || screenX > 288) {
      return;
    }

    const atlas = SpriteAtlas.get();
    const isRed = this.type === 'red_koopa';

    if (this.state === 'flipped') {
      ctx.save();
      ctx.translate(
        screenX + this.width / 2,
        Math.round(this.y) + this.height / 2
      );
      ctx.scale(1, -1);
      const sprite = isRed ? atlas.redKoopaShell : atlas.koopaShell;
      ctx.drawImage(sprite, -this.width / 2, -sprite.height / 2);
      ctx.restore();
      return;
    }

    if (this.state === 'shell_idle' || this.state === 'shell_moving') {
      const shakeX =
        this.state === 'shell_idle' &&
        this.stateTimer > 0 &&
        this.stateTimer < 60 &&
        Math.floor(this.stateTimer / 3) % 2 === 0
          ? 1
          : 0;
      const shellSprite = isRed ? atlas.redKoopaShell : atlas.koopaShell;
      ctx.drawImage(shellSprite, screenX + shakeX, Math.round(this.y + 2));
      return;
    }

    const walkSprite = isRed
      ? this.animFrame % 2 === 0
        ? atlas.redKoopaWalk1
        : atlas.redKoopaWalk2
      : this.animFrame % 2 === 0
      ? atlas.koopaWalk1
      : atlas.koopaWalk2;

    if (this.facing === 'right') {
      ctx.save();
      ctx.translate(screenX + this.width, Math.round(this.y));
      ctx.scale(-1, 1);
      ctx.drawImage(walkSprite, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(walkSprite, screenX, Math.round(this.y));
    }
  }

  public syncFromEnemy(enemy: Enemy): void {
    this.id = enemy.id;
    this.type = enemy.type === 'red_koopa' ? 'red_koopa' : 'koopa';
    this.x = enemy.x;
    this.y = enemy.y;
    this.vx = enemy.vx;
    this.vy = enemy.vy;
    this.width = enemy.width;
    this.height = enemy.height;
    this.alive = enemy.alive;
    this.state =
      enemy.state === 'shell_idle' ||
      enemy.state === 'shell_moving' ||
      enemy.state === 'flipped'
        ? enemy.state
        : 'walk';
    this.stateTimer = enemy.stateTimer;
    this.facing = enemy.facing;
    this.animFrame = enemy.animFrame;
    this.animTimer = enemy.animTimer;
    this.shellKillStreak = enemy.shellKillStreak ?? 0;
  }

  public toEnemy(): Enemy {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      width: this.width,
      height: this.height,
      alive: this.alive,
      state: this.state,
      stateTimer: this.stateTimer,
      facing: this.facing,
      animFrame: this.animFrame,
      animTimer: this.animTimer,
      shellKillStreak: this.shellKillStreak,
    };
  }

  public static fromEnemy(enemy: Enemy): KoopaTroopa {
    const koopa = new KoopaTroopa(
      enemy.x,
      enemy.y,
      enemy.type === 'red_koopa' ? 'red_koopa' : 'koopa',
      enemy.vx,
      enemy.id
    );
    koopa.syncFromEnemy(enemy);
    return koopa;
  }
}

export type PiranhaPhase = 'hidden' | 'emerging' | 'retracting' | 'flipped';
export type PiranhaCollisionOutcome = 'none' | 'hurt_player' | 'star_defeat' | 'spin_bounce';

export interface PiranhaUpdateResult {
  phase: PiranhaPhase;
  protrudingHeight: number;
  isExposed: boolean;
  blockedByProximity: boolean;
}

/**
 * Classic Piranha Plant emerging vertically from green pipe obstacles on a
 * timed interval (60-frame rise window within a 180-frame cycle), pausing
 * inside the pipe when Mario stands nearby, clipping below the pipe rim when
 * rendered, and only damaging Mario once sufficiently exposed above the pipe.
 */
export class PiranhaPlant {
  public static readonly WIDTH = 16;
  public static readonly HEIGHT = 16;
  public static readonly HITBOX_WIDTH = 14;
  public static readonly MAX_RISE_HEIGHT = 24;
  public static readonly VERTICAL_SPEED = 0.5;
  public static readonly CYCLE_DURATION = 180;
  public static readonly EMERGE_WINDOW = 60;
  public static readonly SAFE_PROTRUDE_THRESHOLD = 6;
  public static readonly RENDER_PROTRUDE_THRESHOLD = 2;
  public static readonly PROXIMITY_THRESHOLD = 28;
  public static readonly ANIM_INTERVAL = 8;
  public static readonly GRAVITY = 0.35;
  public static readonly MAX_FALL_SPEED = 6.0;
  public static readonly STAR_FLIP_VY = -5.0;

  public id: number;
  public readonly type = 'piranha' as const;
  public x: number;
  public y: number;
  public pipeOriginY: number;
  public vx: number = 0;
  public vy: number = 0;
  public width: number = PiranhaPlant.WIDTH;
  public height: number = PiranhaPlant.HEIGHT;
  public alive: boolean = true;
  public state: 'walk' | 'flipped' = 'walk';
  public phase: PiranhaPhase = 'hidden';
  public stateTimer: number;
  public facing: 'left' | 'right' = 'left';
  public animFrame: number = 0;
  public animTimer: number = 0;

  constructor(
    x: number = 0,
    pipeOriginY: number = 0,
    id: number = 0,
    initialStateTimer: number = 0
  ) {
    this.id = id;
    this.x = x;
    this.y = pipeOriginY;
    this.pipeOriginY = pipeOriginY;
    this.stateTimer = initialStateTimer;
  }

  public getProtrudingHeight(): number {
    return Math.max(0, this.pipeOriginY - this.y);
  }

  public isExposed(): boolean {
    return (
      this.alive &&
      this.state !== 'flipped' &&
      this.y < this.pipeOriginY - PiranhaPlant.SAFE_PROTRUDE_THRESHOLD
    );
  }

  public isVisibleAbovePipe(): boolean {
    if (this.state === 'flipped') {
      return true;
    }
    return this.y < this.pipeOriginY - PiranhaPlant.RENDER_PROTRUDE_THRESHOLD;
  }

  public isPlayerNearby(player?: Player): boolean {
    if (!player) {
      return false;
    }
    const marioCenter = player.x + 7;
    return Math.abs(marioCenter - this.x) < PiranhaPlant.PROXIMITY_THRESHOLD;
  }

  public getHitbox(): Rect | null {
    if (!this.isExposed()) {
      return null;
    }
    const protrudingHeight = Math.max(4, this.pipeOriginY - this.y);
    return {
      x: this.x - 7,
      y: this.y,
      width: PiranhaPlant.HITBOX_WIDTH,
      height: protrudingHeight,
    };
  }

  public isExpired(levelPixelHeight: number = 240): boolean {
    if (this.state === 'flipped') {
      return this.y > levelPixelHeight + 48;
    }
    return !this.alive;
  }

  public update(player?: Player): PiranhaUpdateResult {
    if (!this.alive || this.state === 'flipped') {
      if (this.state === 'flipped') {
        this.vy = Math.min(
          PiranhaPlant.MAX_FALL_SPEED,
          this.vy + PiranhaPlant.GRAVITY
        );
        this.x += this.vx;
        this.y += this.vy;
        this.stateTimer++;
      }
      this.phase = 'flipped';
      return {
        phase: 'flipped',
        protrudingHeight: 0,
        isExposed: false,
        blockedByProximity: false,
      };
    }

    // Chomp jaw animation every 8 frames
    this.animTimer++;
    if (this.animTimer % PiranhaPlant.ANIM_INTERVAL === 0) {
      this.animFrame = (this.animFrame + 1) % 2;
    }

    const blockedByProximity = this.isPlayerNearby(player);

    // Timed pipe emergence/retraction cycle (0..59 rise if player not standing near pipe, 60..179 retract)
    this.stateTimer++;
    const cycle = this.stateTimer % PiranhaPlant.CYCLE_DURATION;
    if (cycle < PiranhaPlant.EMERGE_WINDOW && !blockedByProximity) {
      this.y = Math.max(
        this.pipeOriginY - PiranhaPlant.MAX_RISE_HEIGHT,
        this.y - PiranhaPlant.VERTICAL_SPEED
      );
      this.phase = 'emerging';
    } else {
      this.y = Math.min(this.pipeOriginY, this.y + PiranhaPlant.VERTICAL_SPEED);
      this.phase = this.y >= this.pipeOriginY ? 'hidden' : 'retracting';
    }

    return {
      phase: this.phase,
      protrudingHeight: this.getProtrudingHeight(),
      isExposed: this.isExposed(),
      blockedByProximity,
    };
  }

  public checkPlayerCollision(player: Player): PiranhaCollisionOutcome {
    if (!this.alive || this.state === 'flipped') {
      return 'none';
    }

    if (
      player.state === 'dead' ||
      player.state === 'pipe_entering' ||
      player.state === 'pipe_exiting' ||
      player.state === 'pole_slide' ||
      player.state === 'castle_walk' ||
      player.state === 'castle_entered'
    ) {
      return 'none';
    }

    const piranhaBox = this.getHitbox();
    if (!piranhaBox) {
      return 'none';
    }

    const marioBox = player.getHitbox();
    const overlaps =
      marioBox.x < piranhaBox.x + piranhaBox.width &&
      marioBox.x + marioBox.width > piranhaBox.x &&
      marioBox.y < piranhaBox.y + piranhaBox.height &&
      marioBox.y + marioBox.height > piranhaBox.y;

    if (!overlaps) {
      return 'none';
    }

    if (player.starTimer > 0) {
      this.alive = false;
      this.state = 'flipped';
      this.phase = 'flipped';
      this.vy = PiranhaPlant.STAR_FLIP_VY;
      return 'star_defeat';
    }

    const prevMarioBottom = marioBox.y + marioBox.height - player.vy;
    const isSpinBounce =
      player.isSpinJumping &&
      player.vy >= -0.6 &&
      prevMarioBottom <= this.y + 13;

    if (isSpinBounce) {
      player.y = Math.min(player.y, this.y - player.getHeight());
      player.grounded = false;
      player.state = 'jumping';
      player.vy = Goomba.SPIN_STOMP_BOUNCE_VY;
      return 'spin_bounce';
    }

    return 'hurt_player';
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number): void {
    if (!this.isVisibleAbovePipe()) {
      return;
    }

    const ex = Math.round(this.x - cameraX);
    if (ex < -32 || ex > 288) {
      return;
    }

    const atlas = SpriteAtlas.get();
    const frame = this.animFrame % 2 === 0 ? atlas.piranha1 : atlas.piranha2;

    if (this.state === 'flipped') {
      ctx.save();
      ctx.translate(ex + 4, Math.round(this.y) + this.height / 2);
      ctx.scale(1, -1);
      ctx.drawImage(frame, -this.width / 2, -this.height / 2);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(ex - 8, 0, 32, this.pipeOriginY);
    ctx.clip();
    ctx.drawImage(frame, ex - 4, Math.round(this.y));
    ctx.restore();
  }

  public syncFromEnemy(enemy: Enemy): void {
    this.id = enemy.id;
    this.x = enemy.x;
    this.y = enemy.y;
    this.pipeOriginY = enemy.pipeOriginY ?? enemy.y;
    this.vx = enemy.vx;
    this.vy = enemy.vy;
    this.width = enemy.width;
    this.height = enemy.height;
    this.alive = enemy.alive;
    this.state = enemy.state === 'flipped' ? 'flipped' : 'walk';
    this.stateTimer = enemy.stateTimer;
    this.facing = enemy.facing;
    this.animFrame = enemy.animFrame;
    this.animTimer = enemy.animTimer;
    if (this.state === 'flipped') {
      this.phase = 'flipped';
    } else if (this.y >= this.pipeOriginY) {
      this.phase = 'hidden';
    } else if (this.stateTimer % PiranhaPlant.CYCLE_DURATION < PiranhaPlant.EMERGE_WINDOW) {
      this.phase = 'emerging';
    } else {
      this.phase = 'retracting';
    }
  }

  public toEnemy(): Enemy {
    return {
      id: this.id,
      type: 'piranha',
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      width: this.width,
      height: this.height,
      alive: this.alive,
      state: this.state,
      stateTimer: this.stateTimer,
      facing: this.facing,
      animFrame: this.animFrame,
      animTimer: this.animTimer,
      pipeOriginY: this.pipeOriginY,
    };
  }

  public static fromEnemy(enemy: Enemy): PiranhaPlant {
    const piranha = new PiranhaPlant(
      enemy.x,
      enemy.pipeOriginY ?? enemy.y,
      enemy.id,
      enemy.stateTimer
    );
    piranha.syncFromEnemy(enemy);
    return piranha;
  }

  /**
   * Scans a green pipe column in a TileMap and constructs a PiranhaPlant
   * anchored at the top rim of that pipe, or null if no pipe top exists.
   */
  public static fromPipeTile(
    tileMap: TileMap,
    pipeLeftTileX: number,
    id: number = 0
  ): PiranhaPlant | null {
    for (let ty = 0; ty < tileMap.height; ty++) {
      const tile = tileMap.getTileAt(pipeLeftTileX, ty);
      if (
        tile &&
        (tile.type === 'pipe_top_left' || tile.type === 'pipe_warp_top_left')
      ) {
        const plantX = pipeLeftTileX * tileMap.tileSize + 8;
        const pipeOriginY = ty * tileMap.tileSize;
        return new PiranhaPlant(plantX, pipeOriginY, id);
      }
    }
    return null;
  }
}

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const playerRef = useRef<Player>(new Player());
  const tileMapRef = useRef<TileMap>(new TileMap());
  const goombasRef = useRef<Goomba[]>([]);
  const koopaTroopasRef = useRef<KoopaTroopa[]>([]);
  const piranhaPlantsRef = useRef<PiranhaPlant[]>([]);
  const questionBlocksRef = useRef<QuestionBlock[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const cheatBufferRef = useRef<string>('');

  // UI state for reactive updates
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    coins: 0,
    world: '1-1',
    time: 400,
    lives: 3,
    highScore: getTopScore(),
    isNewHighScore: false,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [lastSavedRank, setLastSavedRank] = useState<number | null>(null);
  const [marioPower, setMarioPower] = useState<MarioPower>('small');
  const [isStageClear, setIsStageClear] = useState(false);
  const [isKeyholeTransition, setIsKeyholeTransition] = useState(false);
  const [waitingForPlayersFinish, setWaitingForPlayersFinish] = useState(false);
  const [waitingPlayersNames, setWaitingPlayersNames] = useState<string[]>([]);
  const [stageArrivalNotice, setStageArrivalNotice] = useState('');
  const [allPlayersClearedReady, setAllPlayersClearedReady] = useState(false);
  const [localStageCleared, setLocalStageCleared] = useState(false);
  const [isCampaignVictory, setIsCampaignVictory] = useState(false);
  const [isMultiplayerMatchOver, setIsMultiplayerMatchOver] = useState(false);
  const [multiplayerMatchResult, setMultiplayerMatchResult] = useState<MultiplayerMatchResult | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isCheatMenuOpen, setIsCheatMenuOpen] = useState(false);
  const [isCheatActive, setIsCheatActive] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPlacementActive, setIsDebugPlacementActive] = useState(false);
  const [debugCoords, setDebugCoords] = useState<{ x: number; y: number }>({ x: 40, y: 192 });
  const [debugSelectedLabel, setDebugSelectedLabel] = useState('MOEDA');
  const [isIllegalInstructionBug, setIsIllegalInstructionBug] = useState(false);
  const [cheatToast, setCheatToast] = useState('');
  const [splashCheatInput, setSplashCheatInput] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [isCommercialOpen, setIsCommercialOpen] = useState(true);
  const [activeCommercial] = useState<WazzimaCommercial>(() => {
    try {
      const lastId = localStorage.getItem(LAST_COMMERCIAL_STORAGE_KEY);
      return getNextCommercialInRotation(lastId);
    } catch {
      return getNextCommercialInRotation(null);
    }
  });
  const [crtFilter, setCrtFilter] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_COMMERCIAL_STORAGE_KEY, activeCommercial.id);
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, [activeCommercial.id]);

  // Suspende completamente som e música do jogo enquanto o comercial estiver ativo
  useEffect(() => {
    const sound = SoundEngine.get();
    sound.setCommercialSuspended(isCommercialOpen);
    setSoundStatus(sound.getStatus());
    return () => {
      sound.setCommercialSuspended(false);
    };
  }, [isCommercialOpen]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wasNativeFullscreenRef = useRef(false);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isTvUa = isSmartTvUserAgent();
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      (!isTvUa && (navigator.maxTouchPoints > 0 || window.innerWidth < 768))
    );
  });
  const [smartTvMode, setSmartTvMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smb_smart_tv_mode');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return isSmartTvUserAgent();
  });
  const [smartTvJumpWithUp, setSmartTvJumpWithUp] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smb_smart_tv_jump_up');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [smartTvAutoRun, setSmartTvAutoRun] = useState<boolean>(() => {
    try {
      return localStorage.getItem('smb_smart_tv_autorun') === 'true';
    } catch {
      return false;
    }
  });
  const manualRunHeldRef = useRef(false);
  const splashOverlayRef = useRef<HTMLDivElement | null>(null);
  const pauseOverlayRef = useRef<HTMLDivElement | null>(null);
  const gameOverOverlayRef = useRef<HTMLDivElement | null>(null);
  const victoryOverlayRef = useRef<HTMLDivElement | null>(null);
  const multiplayerOverOverlayRef = useRef<HTMLDivElement | null>(null);
  const [touchOverlayOnCanvas, setTouchOverlayOnCanvas] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smb_touch_overlay_mode');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [difficulty, setDifficulty] = useState<GameDifficulty>('normal');
  const [resolutionScale, setResolutionScale] = useState<ResolutionScale>('fit');
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [isLevelEditorOpen, setIsLevelEditorOpen] = useState(false);
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false);
  const [updatesFilter, setUpdatesFilter] = useState<UpdatesModalFilter>('all');
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [achievements, setAchievements] = useState<AchievementProgressView[]>(() =>
    new AchievementManager().getViews()
  );
  const [achievementsSummary, setAchievementsSummary] = useState(() =>
    new AchievementManager().getSummary()
  );
  const [achievementToast, setAchievementToast] = useState<AchievementUnlockEvent | null>(null);
  const achievementToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSmwMapOpen, setIsSmwMapOpen] = useState(false);
  const [isSmwModeActive, setIsSmwModeActive] = useState(false);
  const [smwProgress, setSmwProgress] = useState<SmwBetaProgress>(() => loadSmwBetaProgress());
  const [smwJustClearedNodeId, setSmwJustClearedNodeId] = useState<string | null>(null);
  const [smwSaveSlots, setSmwSaveSlots] = useState<(SmwSaveSlotData | null)[]>(() => loadSmwSaveSlots());
  const [smwCastleSaveTitle, setSmwCastleSaveTitle] = useState<string | null>(null);
  const [smwOpenLoadSignal, setSmwOpenLoadSignal] = useState(0);
  const [customLevels, setCustomLevels] = useState<LevelData[]>([]);
  const [activeCustomLevelId, setActiveCustomLevelId] = useState<string | null>(null);
  const [customCampaignIds, setCustomCampaignIds] = useState<string[]>([]);
  const [editorImmortality, setEditorImmortality] = useState(false);
  const [isCustomLevelActive, setIsCustomLevelActive] = useState(false);
  const [multiplayerStatus, setMultiplayerStatus] = useState(() => multiplayerClient.getStatus());
  const [multiplayerNotice, setMultiplayerNotice] = useState<MultiplayerLogoffEvent | null>(null);

  const isDeveloperModeActive = isCheatActive || isDebugMode;
  const isUsingLevelEditor = isLevelEditorOpen || isCustomLevelActive;
  const isModeAndEditorLocked = isModeAndEditorLockedPolicy({
    hasStarted,
    isDeveloperMode: isDeveloperModeActive,
    isUsingEditor: isUsingLevelEditor,
    isCampaignVictory,
  });

  const getModePolicyInput = useCallback(
    () => ({
      hasStarted,
      isDeveloperMode: Boolean(
        isCheatActive ||
          isDebugMode ||
          engineRef.current?.isCheatActive ||
          engineRef.current?.isDebugMode
      ),
      isUsingEditor: Boolean(
        isLevelEditorOpen ||
          isCustomLevelActive ||
          engineRef.current?.level?.isCustom
      ),
      isCampaignVictory,
      isGameOver: isGameOver || Boolean(engineRef.current?.isGameOver),
    }),
    [hasStarted, isCheatActive, isDebugMode, isLevelEditorOpen, isCustomLevelActive, isCampaignVictory, isGameOver]
  );

  // Audio state
  const [soundStatus, setSoundStatus] = useState(() => SoundEngine.get().getStatus());
  const [activeSmwNodeId, setActiveSmwNodeId] = useState<string | null>(null);
  const prevGamepadSelectRef = useRef<boolean>(false);

  // Controls state for touch/gamepad
  const [controls, setControls] = useState<GamepadControls>({
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    spinJump: false,
    run: false,
    select: false,
    pause: false,
  });

  const isCurrentSmwStageCleared = canExitSmwStageWithSelect({
    isSmwModeActive,
    activeNodeId: activeSmwNodeId ?? smwProgress.selectedNodeId,
    progress: smwProgress,
  });

  // Subscribe to multiplayer client, logoff/inactivity events & check URL invite room
  useEffect(() => {
    const unsub = multiplayerClient.subscribe((status) => {
      setMultiplayerStatus(status);
      if (status.connected) {
        setHasStarted(true);
        if (engineRef.current) {
          engineRef.current.isGameStarted = true;
        }
      }
    });
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubLogoff = multiplayerClient.onLogoffEvent((evt) => {
      setMultiplayerNotice(evt);
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        setMultiplayerNotice(null);
      }, 5500);
    });
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room')) {
        setIsMultiplayerOpen(true);
      }
    }
    return () => {
      unsub();
      unsubLogoff();
      if (noticeTimer) clearTimeout(noticeTimer);
    };
  }, []);

  // Keep mobile/touch device detection reactive across resize & orientation changes
  useEffect(() => {
    const checkMobile = () => {
      const isTvUa = isSmartTvUserAgent();
      setIsMobileDevice(
        window.matchMedia('(pointer: coarse)').matches ||
          (!isTvUa && (navigator.maxTouchPoints > 0 || window.innerWidth < 768))
      );
    };
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  const toggleTouchOverlayMode = useCallback(() => {
    setTouchOverlayOnCanvas(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smb_touch_overlay_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleSmartTvMode = useCallback(() => {
    setSmartTvMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smb_smart_tv_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleSmartTvJumpWithUp = useCallback(() => {
    setSmartTvJumpWithUp(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smb_smart_tv_jump_up', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleSmartTvAutoRun = useCallback(() => {
    setSmartTvAutoRun(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smb_smart_tv_autorun', String(next));
      } catch {
        // ignore
      }
      if (!next && engineRef.current && !manualRunHeldRef.current) {
        engineRef.current.controls.run = false;
        setControls(c => ({ ...c, run: false }));
      }
      return next;
    });
  }, []);

  // Initialize engine once
  useEffect(() => {
    const engine = new GameEngine();
    engine.stats.highScore = getTopScore();
    setAchievements(engine.getAchievements());
    setAchievementsSummary(engine.getAchievementSummary());
    engine.onAchievementsChanged = (views) => {
      setAchievements(views);
      setAchievementsSummary(engine.getAchievementSummary());
    };
    engine.onAchievementUnlocked = (evt) => {
      setAchievements(engine.getAchievements());
      setAchievementsSummary(engine.getAchievementSummary());
      setStats({ ...engine.stats, isNewHighScore: engine.isNewHighScore });
      setAchievementToast(evt);
      if (achievementToastTimerRef.current) {
        clearTimeout(achievementToastTimerRef.current);
      }
      achievementToastTimerRef.current = setTimeout(() => {
        setAchievementToast(null);
      }, 4200);
    };
    const initialSmwProgress = loadSmwBetaProgress();
    engine.yellowSwitchUnlocked = initialSmwProgress.yellowSwitchUnlocked;
    engine.greenSwitchUnlocked = Boolean(initialSmwProgress.greenSwitchUnlocked);
    engine.redSwitchUnlocked = Boolean(initialSmwProgress.redSwitchUnlocked);
    engine.pinkSwitchUnlocked = Boolean(initialSmwProgress.pinkSwitchUnlocked);
    engine.blueSwitchUnlocked = Boolean(initialSmwProgress.blueSwitchUnlocked);
    engine.goalPointsWallet = initialSmwProgress.goalPointsWallet ?? 0;
    engine.stats.goalPointsWallet = engine.goalPointsWallet;
    engine.onSmwGoalWalletChanged = (wallet: number) => {
      if (engine.gameMode !== 'smw_world_map') return;
      setSmwProgress(prev => {
        if ((prev.goalPointsWallet ?? 0) === wallet) return prev;
        return {
          ...prev,
          goalPointsWallet: wallet,
        };
      });
    };
    engine.onSmwYellowSwitchActivated = () => {
      setSmwProgress(prev => {
        if (prev.yellowSwitchUnlocked) return prev;
        return {
          ...prev,
          yellowSwitchUnlocked: true,
        };
      });
    };
    engine.onSmwSwitchActivated = (color: SmwSwitchColor) => {
      setSmwProgress(prev => ({
        ...prev,
        yellowSwitchUnlocked: prev.yellowSwitchUnlocked || color === 'yellow',
        greenSwitchUnlocked: Boolean(prev.greenSwitchUnlocked) || color === 'green',
        redSwitchUnlocked: Boolean(prev.redSwitchUnlocked) || color === 'red',
        pinkSwitchUnlocked: Boolean(prev.pinkSwitchUnlocked) || color === 'pink',
        blueSwitchUnlocked: Boolean(prev.blueSwitchUnlocked) || color === 'blue',
      }));
    };
    engine.onSmwStageCompleted = (nodeId: string, meta?: { secretExit?: boolean }) => {
      const currNode = SMW_WIKIWORLD_NODES.find(n => n.id === nodeId);
      const isDevOnlyPalace = SMW_DEV_ONLY_SWITCH_PALACES.some(p => p.id === nodeId);
      const isW1SecretExit = Boolean(meta?.secretExit && nodeId === 'wiki-1-overworld');
      setSmwProgress(prev => {
        const prevSecret = prev.secretClearedNodeIds ?? [];
        const nextSecret =
          meta?.secretExit && !prevSecret.includes(nodeId)
            ? [...prevSecret, nodeId]
            : prevSecret;
        const nextCleared = isW1SecretExit
          ? prev.clearedNodeIds
          : prev.clearedNodeIds.includes(nodeId)
          ? prev.clearedNodeIds
          : [...prev.clearedNodeIds, nodeId];
        const nextNode =
          nodeId === 'wiki-switch-yellow'
            ? nextCleared.includes('wiki-1-overworld')
              ? SMW_WIKIWORLD_NODES.find(n => n.id === 'wiki-2-caverna')
              : SMW_WIKIWORLD_NODES.find(n => n.id === 'wiki-1-overworld')
            : currNode && currNode.order < 4
            ? SMW_WIKIWORLD_NODES[currNode.order + 1]
            : undefined;
        const yellowPalaceCompleted = Boolean(
          prev.yellowSwitchUnlocked || nextCleared.includes('wiki-switch-yellow')
        );
        const nextSelected = isDevOnlyPalace
          ? SMW_WIKIWORLD_NODES.some(n => n.id === prev.selectedNodeId)
            ? prev.selectedNodeId
            : 'wiki-1-overworld'
          : isW1SecretExit
          ? !yellowPalaceCompleted
            ? 'wiki-switch-yellow'
            : 'wiki-1-overworld'
          : nextNode && !nextCleared.includes(nextNode.id)
          ? nextNode.id
          : nodeId;
        return {
          ...prev,
          clearedNodeIds: nextCleared,
          secretClearedNodeIds: nextSecret,
          selectedNodeId: nextSelected,
          yellowSwitchUnlocked:
            prev.yellowSwitchUnlocked || nodeId === 'wiki-switch-yellow',
          greenSwitchUnlocked:
            Boolean(prev.greenSwitchUnlocked) || nodeId === 'wiki-switch-green',
          redSwitchUnlocked:
            Boolean(prev.redSwitchUnlocked) || nodeId === 'wiki-switch-red',
          pinkSwitchUnlocked:
            Boolean(prev.pinkSwitchUnlocked) || nodeId === 'wiki-switch-pink',
          blueSwitchUnlocked:
            Boolean(prev.blueSwitchUnlocked) || nodeId === 'wiki-switch-blue',
        };
      });
      if (currNode?.isCastle) {
        setSmwSaveSlots(loadSmwSaveSlots());
        setSmwCastleSaveTitle(currNode.title);
      } else {
        setSmwCastleSaveTitle(null);
      }
      setSmwJustClearedNodeId(nodeId);
      setActiveSmwNodeId(null);
      setIsStageClear(false);
      setIsPaused(false);
      setIsGameOver(false);
      setIsSmwModeActive(true);
      setIsSmwMapOpen(true);
      manualRunHeldRef.current = false;
      setControls({
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        spinJump: false,
        run: false,
        select: false,
        pause: false,
      });
      setStats({ ...engine.stats, isNewHighScore: engine.isNewHighScore });
    };
    engineRef.current = engine;
    tileMapRef.current.syncFromEngine(engine);
    playerRef.current.syncFromEngine(engine);
    goombasRef.current = engine.enemies
      .filter(enemy => enemy.type === 'goomba')
      .map(enemy => Goomba.fromEnemy(enemy));
    koopaTroopasRef.current = engine.enemies
      .filter(enemy => enemy.type === 'koopa' || enemy.type === 'red_koopa')
      .map(enemy => KoopaTroopa.fromEnemy(enemy));
    piranhaPlantsRef.current = engine.enemies
      .filter(enemy => enemy.type === 'piranha')
      .map(enemy => PiranhaPlant.fromEnemy(enemy));
    questionBlocksRef.current = tileMapRef.current.getQuestionBlocks();
    multiplayerClient.setEngine(engine);

    return () => {
      engine.onSmwStageCompleted = undefined;
      engine.onSmwYellowSwitchActivated = undefined;
      engine.onSmwGoalWalletChanged = undefined;
      engine.onAchievementUnlocked = undefined;
      engine.onAchievementsChanged = undefined;
      if (achievementToastTimerRef.current) {
        clearTimeout(achievementToastTimerRef.current);
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      SoundEngine.get().stopMusic();
    };
  }, []);

  const openUpdatesModal = useCallback((filter: UpdatesModalFilter = 'all') => {
    setUpdatesFilter(filter);
    setIsUpdatesOpen(true);
  }, []);

  const openAchievementsModal = useCallback(() => {
    if (engineRef.current) {
      setAchievements(engineRef.current.getAchievements());
      setAchievementsSummary(engineRef.current.getAchievementSummary());
    }
    setIsAchievementsOpen(true);
  }, []);

  // Update controls to engine (only during active gameplay; blocked in menus/overlays — R1.16.UF.4)
  const handleControlChange = useCallback(
    (key: keyof GamepadControls, active: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      const canControlGameplay =
        hasStarted &&
        engine.isGameStarted &&
        !isSmwMapOpen &&
        !isPaused &&
        !isGameOver &&
        !isCampaignVictory &&
        !isMultiplayerMatchOver &&
        !isSettingsOpen &&
        !isLeaderboardOpen &&
        !isCheatMenuOpen &&
        !isMultiplayerOpen &&
        !isLevelEditorOpen &&
        !isUpdatesOpen &&
        !isAchievementsOpen;
      if (!canControlGameplay) {
        engine.controls.left = false;
        engine.controls.right = false;
        engine.controls.up = false;
        engine.controls.down = false;
        engine.controls.jump = false;
        engine.controls.spinJump = false;
        engine.controls.run = false;
        engine.controls.select = false;
        setControls({
          left: false,
          right: false,
          up: false,
          down: false,
          jump: false,
          spinJump: false,
          run: false,
          select: false,
          pause: false,
        });
        return;
      }
      engine.controls[key] = active;
      setControls(prev => ({ ...prev, [key]: active }));
    },
    [
      hasStarted,
      isSmwMapOpen,
      isPaused,
      isGameOver,
      isCampaignVictory,
      isMultiplayerMatchOver,
      isSettingsOpen,
      isLeaderboardOpen,
      isCheatMenuOpen,
      isMultiplayerOpen,
      isLevelEditorOpen,
      isUpdatesOpen,
      isAchievementsOpen,
    ]
  );

  // Activate developer mode ("lula132026")
  const activateCheat = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.activateCheatMode();
    setIsCheatActive(true);
    setIsCheatMenuOpen(true);
    setCheatToast('PÁGINA DO DESENVOLVEDOR ATIVADA!');
    setTimeout(() => setCheatToast(''), 4500);
  }, []);

  const handleDeveloperButtonClick = useCallback(() => {
    const engine = engineRef.current;
    if (engine && engine.isIllegalInstructionBug) {
      engine.recoverFromIllegalInstruction();
      setIsIllegalInstructionBug(false);
      setCheatToast('TELA RESTAURADA PELO BOTÃO DO DESENVOLVEDOR!');
      setTimeout(() => setCheatToast(''), 4000);
      return;
    }
    setIsCheatMenuOpen(true);
  }, []);

  const handleToggleDebugMode = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.isDebugLockedAtStageEnd()) {
      engine.toggleDebugMode(false);
      setIsDebugMode(false);
      setIsDebugPlacementActive(false);
      setIsCheatActive(engine.isCheatActive);
      setCheatToast('Modo Debug bloqueado ao alcançar o final da fase!');
      setTimeout(() => setCheatToast(''), 3800);
      return;
    }
    const active = engine.toggleDebugMode();
    setIsDebugMode(active);
    setIsDebugPlacementActive(engine.isDebugPlacementActive);
    setIsCheatActive(engine.isCheatActive);
    setDebugCoords({ x: engine.marioX, y: engine.marioY });
    setDebugSelectedLabel(engine.getCurrentDebugPlaceable().label);
    setCheatToast(
      active
        ? 'MODO DEBUG (SONIC) ATIVADO! Pressione B para inserir itens.'
        : 'Modo Debug desativado.'
    );
    setTimeout(() => setCheatToast(''), 3800);
  }, []);

  const handleToggleDebugPlacement = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.isDebugLockedAtStageEnd()) {
      engine.toggleDebugPlacementCursor(false);
      setIsDebugMode(engine.isDebugMode);
      setIsDebugPlacementActive(false);
      setIsCheatActive(engine.isCheatActive);
      setCheatToast('Modo Debug bloqueado ao alcançar o final da fase!');
      setTimeout(() => setCheatToast(''), 3200);
      return;
    }
    const placing = engine.toggleDebugPlacementCursor();
    setIsDebugMode(engine.isDebugMode);
    setIsDebugPlacementActive(placing);
    setIsCheatActive(engine.isCheatActive);
    setDebugSelectedLabel(engine.getCurrentDebugPlaceable().label);
  }, []);

  const handleCycleDebugItem = useCallback((delta: -1 | 1) => {
    const engine = engineRef.current;
    if (!engine || engine.isDebugLockedAtStageEnd()) return;
    const spec = engine.cycleDebugPlaceable(delta);
    setDebugSelectedLabel(spec.label);
  }, []);

  const handlePlaceDebugItem = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engine.isDebugMode) return;
    if (engine.isDebugLockedAtStageEnd()) {
      engine.placeDebugItemAt();
      setIsDebugMode(engine.isDebugMode);
      setIsDebugPlacementActive(engine.isDebugPlacementActive);
      return;
    }
    engine.placeDebugItemAt();
  }, []);

  const handleCanvasDebugClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas || !engine.isDebugMode || !engine.isDebugPlacementActive) return;
    if (engine.isPaused || engine.isGameOver || engine.isIllegalInstructionBug) return;
    if (engine.isDebugLockedAtStageEnd()) {
      engine.toggleDebugMode(false);
      setIsDebugMode(false);
      setIsDebugPlacementActive(false);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scale = Math.min(rect.width / GameEngine.NES_WIDTH, rect.height / GameEngine.NES_HEIGHT);
    const renderW = GameEngine.NES_WIDTH * scale;
    const renderH = GameEngine.NES_HEIGHT * scale;
    const offsetX = rect.left + (rect.width - renderW) / 2;
    const offsetY = rect.top + (rect.height - renderH) / 2;

    const nesX = (e.clientX - offsetX) / scale;
    const nesY = (e.clientY - offsetY) / scale;
    if (nesX < 0 || nesX > GameEngine.NES_WIDTH || nesY < 0 || nesY > GameEngine.NES_HEIGHT) return;

    const worldX = Math.max(
      0,
      Math.min(engine.level.width * GameEngine.TILE_SIZE - 16, Math.round(nesX + engine.camera.renderX - 8))
    );
    const worldY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 16, Math.round(nesY - 8)));
    if (engine.isDebugPlacementBlockedAt(worldX)) {
      engine.placeDebugItemAt(worldX, worldY);
      return;
    }
    engine.marioX = worldX;
    engine.marioY = worldY;
    engine.placeDebugItemAt(worldX, worldY);
    setDebugCoords({ x: engine.marioX, y: engine.marioY });
  }, []);

  const handleReturnToSmwOverworld = useCallback(() => {
    SoundEngine.get().stopMusic();
    setIsPaused(false);
    setIsGameOver(false);
    setIsStageClear(false);
    setSmwJustClearedNodeId(null);
    setSmwCastleSaveTitle(null);
    setActiveSmwNodeId(null);
    setSmwSaveSlots(loadSmwSaveSlots());
    setIsSmwModeActive(true);
    setIsSmwMapOpen(true);
    manualRunHeldRef.current = false;
    setControls({
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      spinJump: false,
      run: false,
      select: false,
      pause: false,
    });
    if (engineRef.current) {
      engineRef.current.returnToSmwOverworldState();
    }
  }, []);

  const handleSelectAction = useCallback(() => {
    const engine = engineRef.current;
    if (
      !engine ||
      !hasStarted ||
      !engine.isGameStarted ||
      isSmwMapOpen ||
      isGameOver ||
      isCampaignVictory ||
      isMultiplayerMatchOver
    ) {
      return;
    }

    const currentNodeId = engine.getActiveSmwNodeId() ?? activeSmwNodeId ?? smwProgress.selectedNodeId;
    const canExitClearedStage = canExitSmwStageWithSelect({
      isSmwModeActive,
      activeNodeId: currentNodeId,
      progress: smwProgress,
    });

    if (engine.isPaused) {
      if (isSmwModeActive) {
        if (canExitClearedStage) {
          handleReturnToSmwOverworld();
        } else {
          setCheatToast('Fase ainda não passada! Conclua a fase antes de sair com Select.');
          setTimeout(() => setCheatToast(''), 3000);
        }
      }
      return;
    }

    if (engine.dropReservePowerUp(true)) {
      setStats({ ...engine.stats, isNewHighScore: engine.isNewHighScore });
      return;
    }

    if (canExitClearedStage) {
      setCheatToast('Carteira vazia! Pause (P/Esc) + Select (V) para sair da fase já passada.');
      setTimeout(() => setCheatToast(''), 3200);
    } else if (isSmwModeActive) {
      setCheatToast('Nenhum power-up na carteira! Conclua a fase para sair com Select.');
      setTimeout(() => setCheatToast(''), 3200);
    } else {
      setCheatToast('Nenhum power-up armazenado na carteira!');
      setTimeout(() => setCheatToast(''), 2500);
    }
  }, [
    hasStarted,
    isSmwMapOpen,
    isGameOver,
    isCampaignVictory,
    isMultiplayerMatchOver,
    isSmwModeActive,
    activeSmwNodeId,
    smwProgress,
    handleReturnToSmwOverworld,
  ]);

  const togglePauseGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !hasStarted || engine.isGameOver || engine.isMultiplayerMatchOver) return;
    engine.togglePause();
    setIsPaused(engine.isPaused);
    if (engine.isPaused) {
      setControls({
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        spinJump: false,
        run: false,
        select: false,
        pause: false,
      });
    }
  }, [hasStarted]);

  // Auto-focus primary menu button for 10-foot Smart TV D-Pad navigation
  useEffect(() => {
    if (!smartTvMode || isCommercialOpen) return;
    const timer = window.setTimeout(() => {
      if (isSettingsOpen || isLeaderboardOpen || isCheatMenuOpen || isMultiplayerOpen || isUpdatesOpen || isAchievementsOpen || isLevelEditorOpen) {
        const dialog = document.querySelector<HTMLElement>('.fixed.inset-0.z-50');
        const firstBtn = dialog?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
        return;
      }
      if (!hasStarted) {
        const firstBtn = splashOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      } else if (isPaused) {
        const firstBtn = pauseOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      } else if (isMultiplayerMatchOver) {
        const firstBtn = multiplayerOverOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      } else if (isGameOver) {
        const firstBtn = gameOverOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      } else if (isCampaignVictory) {
        const firstBtn = victoryOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [
    smartTvMode,
    isCommercialOpen,
    hasStarted,
    isPaused,
    isGameOver,
    isCampaignVictory,
    isMultiplayerMatchOver,
    isSettingsOpen,
    isLeaderboardOpen,
    isCheatMenuOpen,
    isMultiplayerOpen,
    isUpdatesOpen,
    isAchievementsOpen,
    isLevelEditorOpen,
  ]);

  // Keyboard & Smart TV Remote Event Listeners
  useEffect(() => {
    const clearAllInputs = () => {
      manualRunHeldRef.current = false;
      const engine = engineRef.current;
      if (engine) {
        engine.controls.left = false;
        engine.controls.right = false;
        engine.controls.up = false;
        engine.controls.down = false;
        engine.controls.jump = false;
        engine.controls.spinJump = false;
        engine.controls.run = false;
        engine.controls.select = false;
      }
      setControls({
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        spinJump: false,
        run: false,
        select: false,
        pause: false,
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommercialOpen) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const inputType = target?.tagName === 'INPUT' ? (target as HTMLInputElement).type.toLowerCase() : '';
      const isTextEntry = Boolean(
        target &&
          ((target.tagName === 'INPUT' &&
            !['button', 'submit', 'reset', 'checkbox', 'radio', 'range'].includes(inputType)) ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
      );
      const isRangeInput = Boolean(target && target.tagName === 'INPUT' && inputType === 'range');

      const tv = resolveTvRemoteAction(
        { code: e.code, key: e.key, keyCode: e.keyCode },
        { smartTvMode, jumpWithUp: smartTvJumpWithUp, autoRun: smartTvAutoRun }
      );

      // Inside text fields: only intercept dedicated non-Backspace Back keys (Esc / TV Return 461 / 10009)
      if (isTextEntry) {
        if (tv.isBack && e.code !== 'Backspace' && e.key !== 'Backspace' && e.keyCode !== 8) {
          e.preventDefault();
          target?.blur();
          if (isCheatMenuOpen) setIsCheatMenuOpen(false);
          else if (isAchievementsOpen) setIsAchievementsOpen(false);
          else if (isUpdatesOpen) setIsUpdatesOpen(false);
          else if (isLeaderboardOpen) setIsLeaderboardOpen(false);
          else if (isSettingsOpen) setIsSettingsOpen(false);
          else if (isMultiplayerOpen) setIsMultiplayerOpen(false);
          else if (isLevelEditorOpen) setIsLevelEditorOpen(false);
        }
        return;
      }

      const anyModalOpen =
        isMultiplayerOpen ||
        isSettingsOpen ||
        isLeaderboardOpen ||
        isLevelEditorOpen ||
        isUpdatesOpen ||
        isAchievementsOpen ||
        isCheatMenuOpen;

      if (anyModalOpen) {
        if (tv.isBack && !e.repeat) {
          e.preventDefault();
          if (isCheatMenuOpen) setIsCheatMenuOpen(false);
          else if (isAchievementsOpen) setIsAchievementsOpen(false);
          else if (isUpdatesOpen) setIsUpdatesOpen(false);
          else if (isLeaderboardOpen) setIsLeaderboardOpen(false);
          else if (isSettingsOpen) setIsSettingsOpen(false);
          else if (isMultiplayerOpen) setIsMultiplayerOpen(false);
          else if (isLevelEditorOpen) setIsLevelEditorOpen(false);
          return;
        }

        if (tv.isDirection) {
          const modalEl = document.querySelector<HTMLElement>('.fixed.inset-0.z-50');
          const dir = tv.actions.includes('up')
            ? 'up'
            : tv.actions.includes('down')
            ? 'down'
            : tv.actions.includes('left')
            ? 'left'
            : 'right';
          if (isRangeInput && (dir === 'left' || dir === 'right')) {
            return; // Let left/right adjust volume or sync rate sliders natively
          }
          if (modalEl && moveFocusWithDpad(modalEl, dir)) {
            e.preventDefault();
          }
          return;
        }

        if (
          tv.isConfirm &&
          target &&
          (target.tagName === 'BUTTON' || (target.tagName === 'INPUT' && inputType === 'checkbox')) &&
          (e.code === 'Select' || e.key === 'Select' || e.key === 'OK' || e.keyCode === 23)
        ) {
          e.preventDefault();
          target.click();
        }
        return;
      }

      // Secret Cheat Code Detection: "lula132026" (allowed both in-game and on SMW Overworld Map)
      if (e.key && e.key.length === 1) {
        cheatBufferRef.current = (cheatBufferRef.current + e.key.toLowerCase()).slice(-16);
        if (cheatBufferRef.current.endsWith('lula132026')) {
          activateCheat();
        }
      }

      if (isSmwMapOpen) {
        return;
      }

      // TV Info / Menu key opens Settings cleanly
      if (tv.isInfo && !e.repeat) {
        e.preventDefault();
        if (engineRef.current && hasStarted && !engineRef.current.isPaused && !isGameOver && !isMultiplayerMatchOver) {
          togglePauseGame();
        }
        setIsSettingsOpen(true);
        return;
      }

      // Menu / Overlay State: Splash, Pause, Game Over, Victory, Multiplayer Match Over
      const inMenuOverlay =
        !hasStarted || isPaused || isGameOver || isCampaignVictory || isMultiplayerMatchOver;

      if (inMenuOverlay) {
        if (isPaused && hasStarted && !isGameOver && !isMultiplayerMatchOver && (tv.isPause || tv.isBack)) {
          if (e.repeat) return;
          e.preventDefault();
          SoundEngine.get().resume();
          togglePauseGame();
          return;
        }
        if (
          isPaused &&
          hasStarted &&
          !isGameOver &&
          !isMultiplayerMatchOver &&
          tv.isSelect &&
          e.code !== 'Tab'
        ) {
          if (e.repeat) return;
          e.preventDefault();
          SoundEngine.get().resume();
          handleSelectAction();
          return;
        }

        const activeOverlayEl = !hasStarted
          ? splashOverlayRef.current
          : isPaused
          ? pauseOverlayRef.current
          : isMultiplayerMatchOver
          ? multiplayerOverOverlayRef.current
          : isGameOver
          ? gameOverOverlayRef.current
          : victoryOverlayRef.current;

        if (tv.isDirection && activeOverlayEl) {
          const dir = tv.actions.includes('up')
            ? 'up'
            : tv.actions.includes('down')
            ? 'down'
            : tv.actions.includes('left')
            ? 'left'
            : 'right';
          if (moveFocusWithDpad(activeOverlayEl, dir)) {
            e.preventDefault();
          }
          return;
        }

        if (tv.isConfirm || tv.actions.includes('jump')) {
          if (target && target.tagName === 'BUTTON' && activeOverlayEl?.contains(target)) {
            e.preventDefault();
            target.click();
            return;
          }
          if (!hasStarted) {
            e.preventDefault();
            handleStartGame();
            return;
          }
          if (isPaused && !isGameOver && !isMultiplayerMatchOver) {
            e.preventDefault();
            SoundEngine.get().resume();
            togglePauseGame();
            return;
          }
        }

        if (tv.actions.includes('restart') && !e.ctrlKey && !e.metaKey && hasStarted && engineRef.current) {
          SoundEngine.get().resume();
          if (multiplayerStatus.connected) {
            if (multiplayerStatus.transport === 'websocket' || multiplayerStatus.isHost) {
              multiplayerClient.startMultiplayerRematch();
              setIsGameOver(false);
              setIsStageClear(false);
              setIsPaused(false);
            }
          } else {
            engineRef.current.restartGame();
            setIsGameOver(false);
            setIsStageClear(false);
            setIsPaused(false);
          }
        }
        return;
      }

      // --- ACTIVE GAMEPLAY CONTROLS ---
      // Pause / Unpause on Escape, P, Media Play/Pause, or TV Back/Return
      if (tv.isPause || tv.isBack) {
        if (e.repeat) return;
        e.preventDefault();
        SoundEngine.get().resume();
        togglePauseGame();
        return;
      }

      // Prevent Enter/Space from accidentally clicking a focused HUD/toolbar button mid-jump
      if (target && target.tagName === 'BUTTON') {
        target.blur();
      }

      if (tv.shouldPreventDefault) {
        e.preventDefault();
      }

      SoundEngine.get().resume();

      const engine = engineRef.current;
      if (!engine || engine.isPaused) return;

      for (const action of tv.actions) {
        switch (action) {
          case 'left':
            engine.controls.left = true;
            if (smartTvMode && smartTvAutoRun) engine.controls.run = true;
            setControls(c => ({ ...c, left: true, ...(smartTvMode && smartTvAutoRun ? { run: true } : {}) }));
            break;
          case 'right':
            engine.controls.right = true;
            if (smartTvMode && smartTvAutoRun) engine.controls.run = true;
            setControls(c => ({ ...c, right: true, ...(smartTvMode && smartTvAutoRun ? { run: true } : {}) }));
            break;
          case 'up':
            engine.controls.up = true;
            setControls(c => ({ ...c, up: true }));
            break;
          case 'down':
            engine.controls.down = true;
            setControls(c => ({ ...c, down: true }));
            break;
          case 'jump':
            engine.controls.jump = true;
            setControls(c => ({ ...c, jump: true }));
            break;
          case 'spinJump':
            engine.controls.spinJump = true;
            setControls(c => ({ ...c, spinJump: true }));
            break;
          case 'run':
            manualRunHeldRef.current = true;
            if (smartTvMode && smartTvAutoRun && engine.controls.run && !e.repeat) {
              // Pulse rising edge so Fireball / Tail Whip triggers even while TV Auto-Run is active
              engine.controls.run = false;
              requestAnimationFrame(() => {
                if (engineRef.current && !engineRef.current.isPaused) {
                  engineRef.current.controls.run = true;
                }
              });
            } else {
              engine.controls.run = true;
            }
            setControls(c => ({ ...c, run: true }));
            break;
          case 'select':
            engine.controls.select = true;
            setControls(c => ({ ...c, select: true }));
            if (!e.repeat && !engine.reservePowerUp) {
              handleSelectAction();
            }
            break;
        }
      }

      // Preserve Debug Mode & Quick Restart keys
      if (e.code === 'KeyB' || e.code === 'KeyE') {
        if (!e.repeat && engine.isDebugMode && !engine.isDebugLockedAtStageEnd()) {
          e.preventDefault();
          engine.toggleDebugPlacementCursor();
          setIsDebugPlacementActive(engine.isDebugPlacementActive);
          setDebugSelectedLabel(engine.getCurrentDebugPlaceable().label);
        }
      } else if (e.code === 'BracketLeft' && engine.isDebugMode && !engine.isDebugLockedAtStageEnd()) {
        e.preventDefault();
        const spec = engine.cycleDebugPlaceable(-1);
        setDebugSelectedLabel(spec.label);
      } else if (e.code === 'BracketRight' && engine.isDebugMode && !engine.isDebugLockedAtStageEnd()) {
        e.preventDefault();
        const spec = engine.cycleDebugPlaceable(1);
        setDebugSelectedLabel(spec.label);
      } else if (tv.actions.includes('restart') && !e.ctrlKey && !e.metaKey) {
        if (multiplayerStatus.connected) {
          if (multiplayerStatus.transport === 'websocket' || multiplayerStatus.isHost) {
            multiplayerClient.startMultiplayerRematch();
            setIsGameOver(false);
            setIsStageClear(false);
          }
        } else {
          engine.restartGame();
          setIsGameOver(false);
          setIsStageClear(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      const tv = resolveTvRemoteAction(
        { code: e.code, key: e.key, keyCode: e.keyCode },
        { smartTvMode, jumpWithUp: smartTvJumpWithUp, autoRun: smartTvAutoRun }
      );

      for (const action of tv.actions) {
        switch (action) {
          case 'left':
            engine.controls.left = false;
            if (smartTvMode && smartTvAutoRun && !engine.controls.right && !manualRunHeldRef.current) {
              engine.controls.run = false;
              setControls(c => ({ ...c, left: false, run: false }));
            } else {
              setControls(c => ({ ...c, left: false }));
            }
            break;
          case 'right':
            engine.controls.right = false;
            if (smartTvMode && smartTvAutoRun && !engine.controls.left && !manualRunHeldRef.current) {
              engine.controls.run = false;
              setControls(c => ({ ...c, right: false, run: false }));
            } else {
              setControls(c => ({ ...c, right: false }));
            }
            break;
          case 'up':
            engine.controls.up = false;
            setControls(c => ({ ...c, up: false }));
            break;
          case 'down':
            engine.controls.down = false;
            setControls(c => ({ ...c, down: false }));
            break;
          case 'jump':
            engine.controls.jump = false;
            setControls(c => ({ ...c, jump: false }));
            break;
          case 'spinJump':
            engine.controls.spinJump = false;
            setControls(c => ({ ...c, spinJump: false }));
            break;
          case 'run':
            manualRunHeldRef.current = false;
            if (!(smartTvMode && smartTvAutoRun && (engine.controls.left || engine.controls.right))) {
              engine.controls.run = false;
              setControls(c => ({ ...c, run: false }));
            }
            break;
          case 'select':
            engine.controls.select = false;
            setControls(c => ({ ...c, select: false }));
            break;
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) clearAllInputs();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearAllInputs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    isCommercialOpen,
    hasStarted,
    isPaused,
    isGameOver,
    isCampaignVictory,
    isMultiplayerMatchOver,
    isCheatMenuOpen,
    isMultiplayerOpen,
    isSettingsOpen,
    isLeaderboardOpen,
    isLevelEditorOpen,
    isUpdatesOpen,
    isAchievementsOpen,
    isSmwMapOpen,
    smartTvMode,
    smartTvJumpWithUp,
    smartTvAutoRun,
    multiplayerStatus.connected,
    multiplayerStatus.isHost,
    multiplayerStatus.transport,
    activateCheat,
    togglePauseGame,
    handleSelectAction,
  ]);

  // Gamepad API Polling (blocked while in menus/overlays — R1.16.UF.4)
  const pollGamepad = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (!gp || !engineRef.current) return;

    const engine = engineRef.current;
    const anyModalOpen =
      isSettingsOpen ||
      isLeaderboardOpen ||
      isCheatMenuOpen ||
      isMultiplayerOpen ||
      isLevelEditorOpen ||
      isUpdatesOpen ||
      isAchievementsOpen;

    if (
      isCommercialOpen ||
      !hasStarted ||
      !engine.isGameStarted ||
      isSmwMapOpen ||
      isGameOver ||
      isCampaignVictory ||
      isMultiplayerMatchOver ||
      anyModalOpen
    ) {
      engine.controls.left = false;
      engine.controls.right = false;
      engine.controls.up = false;
      engine.controls.down = false;
      engine.controls.jump = false;
      engine.controls.spinJump = false;
      engine.controls.run = false;
      engine.controls.select = false;
      engine.controls.pause = false;
      prevGamepadSelectRef.current = false;
      return;
    }

    const btnStart = gp.buttons[9]?.pressed || false;
    const btnSelect = gp.buttons[8]?.pressed || false;
    if (btnStart && !engine.controls.pause) {
      engine.togglePause();
      setIsPaused(engine.isPaused);
    }

    if (engine.isPaused) {
      if (btnSelect && !prevGamepadSelectRef.current) {
        handleSelectAction();
      }
      prevGamepadSelectRef.current = btnSelect;
      engine.controls.left = false;
      engine.controls.right = false;
      engine.controls.up = false;
      engine.controls.down = false;
      engine.controls.jump = false;
      engine.controls.spinJump = false;
      engine.controls.run = false;
      engine.controls.select = false;
      engine.controls.pause = btnStart;
      return;
    }

    // D-Pad / Thumbstick
    const axisX = gp.axes[0] || 0;
    const axisY = gp.axes[1] || 0;
    const dpadLeft = gp.buttons[14]?.pressed || axisX < -0.4;
    const dpadRight = gp.buttons[15]?.pressed || axisX > 0.4;
    const dpadUp = gp.buttons[12]?.pressed || axisY < -0.4;
    const dpadDown = gp.buttons[13]?.pressed || axisY > 0.4;

    // A button (button 0), B button (button 1 or 2), Spin Jump (button 3), Select (button 8), Start (button 9)
    const btnA = gp.buttons[0]?.pressed || false;
    const btnB = gp.buttons[1]?.pressed || gp.buttons[2]?.pressed || false;
    const btnSpin = gp.buttons[3]?.pressed || false;

    prevGamepadSelectRef.current = btnSelect;
    engine.controls.left = dpadLeft;
    engine.controls.right = dpadRight;
    engine.controls.up = dpadUp;
    engine.controls.down = dpadDown;
    engine.controls.jump = btnA;
    engine.controls.spinJump = btnSpin;
    engine.controls.run = btnB;
    engine.controls.select = btnSelect;
    engine.controls.pause = btnStart;
  }, [
    isCommercialOpen,
    hasStarted,
    isSmwMapOpen,
    isGameOver,
    isCampaignVictory,
    isMultiplayerMatchOver,
    isSettingsOpen,
    isLeaderboardOpen,
    isCheatMenuOpen,
    isMultiplayerOpen,
    isLevelEditorOpen,
    isUpdatesOpen,
    isAchievementsOpen,
    handleSelectAction,
  ]);

  // Main Game Loop (60 FPS) — Freezes canvas rendering & RAF loop completely while paused
  useEffect(() => {
    if (isPaused) {
      // Keep listening only for Gamepad Start button while paused so controller users can unpause
      const gamepadPauseTimer = window.setInterval(() => {
        pollGamepad();
        if (engineRef.current && !engineRef.current.isPaused) {
          setIsPaused(false);
        }
      }, 120);
      return () => clearInterval(gamepadPauseTimer);
    }

    let animationFrameId: number;
    let uiTimer = 0;
    lastTimeRef.current = performance.now();

    const loop = (timestamp: number) => {
      const deltaMs = Math.min(32, timestamp - lastTimeRef.current);
      lastTimeRef.current = timestamp;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (engine && canvas) {
        // Poll Gamepad
        pollGamepad();

        if (engine.isPaused) {
          setIsPaused(true);
          return;
        }

        // Update Physics & Game State (freeze background stage loop while SMW Overworld Map is open)
        if (!isSmwMapOpen) {
          engine.update(deltaMs);
          tileMapRef.current.syncFromEngine(engine);
          playerRef.current.syncFromEngine(engine);
          goombasRef.current = engine.enemies
            .filter(enemy => enemy.type === 'goomba')
            .map(enemy => Goomba.fromEnemy(enemy));
          koopaTroopasRef.current = engine.enemies
            .filter(enemy => enemy.type === 'koopa' || enemy.type === 'red_koopa')
            .map(enemy => KoopaTroopa.fromEnemy(enemy));
          piranhaPlantsRef.current = engine.enemies
            .filter(enemy => enemy.type === 'piranha')
            .map(enemy => PiranhaPlant.fromEnemy(enemy));
          questionBlocksRef.current = tileMapRef.current.getQuestionBlocks();

          // Render Canvas
          const ctx = canvas.getContext('2d');
          if (ctx) {
            engine.render(ctx);
          }

          // Throttle UI React state updates to ~10 times per second for smooth DOM performance
          uiTimer += deltaMs;
          if (uiTimer >= 100) {
            uiTimer = 0;
            setStats({ ...engine.stats, isNewHighScore: engine.isNewHighScore });
            setLastSavedRank(engine.lastSavedRank);
            setMarioPower(engine.marioPower);
            setIsPaused(engine.isPaused);
            setIsGameOver(engine.isGameOver);
            setIsStageClear(engine.isStageClear);
            setIsKeyholeTransition(engine.keyholeTransitionActive);
            setWaitingForPlayersFinish(engine.waitingForPlayersFinish);
            setWaitingPlayersNames([...engine.waitingPlayersNames]);
            setStageArrivalNotice(engine.stageArrivalNotice);
            setAllPlayersClearedReady(engine.allPlayersClearedReady);
            setLocalStageCleared(engine.localStageCleared);
            setIsCampaignVictory(engine.isCampaignVictory);
            setIsSmwModeActive(engine.gameMode === 'smw_world_map');
            setActiveSmwNodeId(engine.getActiveSmwNodeId());
            setIsMultiplayerMatchOver(engine.isMultiplayerMatchOver);
            setMultiplayerMatchResult(engine.multiplayerMatchResult);
            setIsCustomLevelActive(Boolean(engine.level?.isCustom));
            setIsCheatActive(engine.isCheatActive);
            setIsDebugMode(engine.isDebugMode);
            setIsDebugPlacementActive(engine.isDebugPlacementActive);
            setDebugCoords({ x: engine.marioX, y: engine.marioY });
            setDebugSelectedLabel(engine.getCurrentDebugPlaceable().label);
            setIsIllegalInstructionBug(engine.isIllegalInstructionBug);
          }
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, isSmwMapOpen, pollGamepad]);

  // Audio Controls Handlers
  const toggleMute = () => {
    const sound = SoundEngine.get();
    sound.toggleMute();
    setSoundStatus(sound.getStatus());
  };

  const toggleMusic = () => {
    const sound = SoundEngine.get();
    sound.toggleMusic();
    setSoundStatus(sound.getStatus());
  };

  const handleVolumeChange = (vol: number) => {
    const sound = SoundEngine.get();
    sound.setVolume(vol);
    setSoundStatus(sound.getStatus());
  };

  const handleSelectLevel = (level: LevelData) => {
    if (!canSwitchGameMode(getModePolicyInput())) {
      setCheatToast('Troca de modo/fase bloqueada após iniciar a partida! Disponível apenas no Modo Desenvolvedor ou usando o Editor.');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    if (multiplayerStatus.connected && multiplayerStatus.transport === 'firebase' && !multiplayerStatus.isHost) {
      setCheatToast('Apenas o anfitrião pode escolher a fase da sala!');
      setTimeout(() => setCheatToast(''), 3000);
      return;
    }
    if (engineRef.current) {
      engineRef.current.isPaused = false;
      engineRef.current.gameMode = level.smwNodeId
        ? 'smw_world_map'
        : level.singleplayerWorld
        ? 'singleplayer'
        : 'classic';
      engineRef.current.loadLevel(level, true, false);
      setHasStarted(true);
      setIsCustomLevelActive(false);
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
      setIsCampaignVictory(false);
      setIsSmwMapOpen(false);
      setIsSmwModeActive(Boolean(level.smwNodeId));
    }
  };

  const handleWarpToSpecificStage = useCallback(
    (stageId: string) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (multiplayerStatus.connected && multiplayerStatus.transport === 'firebase' && !multiplayerStatus.isHost) {
        setCheatToast('Apenas o anfitrião pode trocar a fase da sala!');
        setTimeout(() => setCheatToast(''), 3000);
        return;
      }

      SoundEngine.get().resume();
      engine.activateCheatMode();
      setIsCheatActive(true);
      setIsSmwMapOpen(false);
      setSmwCastleSaveTitle(null);
      setSmwJustClearedNodeId(null);
      setIsCustomLevelActive(false);
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
      setIsCampaignVictory(false);
      setHasStarted(true);
      manualRunHeldRef.current = false;
      setControls({
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        spinJump: false,
        run: false,
        select: false,
        pause: false,
      });

      const isSmwStage =
        stageId.startsWith('wiki-') ||
        SMW_DEV_ONLY_SWITCH_PALACES.some(p => p.id === stageId);

      if (isSmwStage) {
        engine.yellowSwitchUnlocked = smwProgress.yellowSwitchUnlocked;
        engine.greenSwitchUnlocked = Boolean(smwProgress.greenSwitchUnlocked);
        engine.redSwitchUnlocked = Boolean(smwProgress.redSwitchUnlocked);
        engine.pinkSwitchUnlocked = Boolean(smwProgress.pinkSwitchUnlocked);
        engine.blueSwitchUnlocked = Boolean(smwProgress.blueSwitchUnlocked);
        engine.goalPointsWallet = smwProgress.goalPointsWallet ?? 0;
        engine.stats.goalPointsWallet = engine.goalPointsWallet;
        const smwStage = createSmwWikiWorldStage(stageId);
        engine.startSmwStage(smwStage, false);
        setIsSmwModeActive(true);
        setActiveSmwNodeId(stageId);
        setStats({ ...engine.stats, isNewHighScore: false });
        setMarioPower(engine.marioPower);
        setCheatToast(`Modo Dev: ${smwStage.biomeLabel || smwStage.name}`);
        setTimeout(() => setCheatToast(''), 3500);
        return;
      }

      let classicLevel: LevelData;
      switch (stageId) {
        case 'secret-vault':
          classicLevel = createSecretVault();
          break;
        case 'world-1-2':
          classicLevel = createWorld1_2();
          break;
        case 'world-2-2':
          classicLevel = createWorld2_2();
          break;
        case 'world-ghost':
          classicLevel = createWorldGhostHouse();
          break;
        case 'world-1-4':
          classicLevel = createWorld1_4();
          break;
        case 'world-1-1':
        default:
          classicLevel = createWorld1_1();
          break;
      }
      engine.isPaused = false;
      engine.gameMode = 'classic';
      engine.isGameStarted = true;
      engine.loadLevel(classicLevel, true, false);
      setIsSmwModeActive(false);
      setStats({ ...engine.stats, isNewHighScore: false });
      setMarioPower(engine.marioPower);
      setCheatToast(`Modo Dev: ${classicLevel.biomeLabel || classicLevel.name}`);
      setTimeout(() => setCheatToast(''), 3500);
    },
    [multiplayerStatus.connected, multiplayerStatus.isHost, multiplayerStatus.transport, smwProgress]
  );

  const openLevelEditor = useCallback(() => {
    if (!canOpenLevelEditor(getModePolicyInput())) {
      setCheatToast('Editor de Fases bloqueado após iniciar a partida! Disponível apenas no Modo Desenvolvedor ou usando o Editor.');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    const engine = engineRef.current;
    if (engine) {
      engine.controls = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        run: false,
        pause: false,
      };
      if (hasStarted && !engine.isPaused && !engine.isGameOver && !engine.isMultiplayerMatchOver) {
        engine.togglePause();
        setIsPaused(true);
      }
    }
    setControls({
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      run: false,
      pause: false,
    });
    setIsSettingsOpen(false);
    setIsUpdatesOpen(false);
    setIsLevelEditorOpen(true);
  }, [hasStarted, getModePolicyInput]);

  const handlePlayCustomLevel = useCallback(
    (level: LevelData, options?: { immortality?: boolean }) => {
      if (multiplayerStatus.connected) {
        setCheatToast('Saia da sala multiplayer para testar fases personalizadas!');
        setTimeout(() => setCheatToast(''), 3500);
        return;
      }
      const immortal = options?.immortality ?? editorImmortality;
      const sanitizedLevel = sanitizeCustomLevelEntities(level).level;
      setEditorImmortality(immortal);
      SoundEngine.get().resume();
      setIsLevelEditorOpen(false);
      setIsSettingsOpen(false);
      setIsUpdatesOpen(false);
      setIsCampaignVictory(false);
      setIsMultiplayerMatchOver(false);
      setHasStarted(true);
      setIsCustomLevelActive(true);
      setIsSmwMapOpen(false);
      setIsSmwModeActive(false);
      if (engineRef.current) {
        engineRef.current.playCustomLevel(sanitizedLevel, immortal);
        setIsPaused(false);
        setIsGameOver(false);
        setIsStageClear(false);
        setStats({ ...engineRef.current.stats, isNewHighScore: false });
        setMarioPower(engineRef.current.marioPower);
      }
    },
    [multiplayerStatus.connected, editorImmortality]
  );

  const handlePlayCustomCampaign = useCallback(
    (levels: LevelData[], options?: { immortality?: boolean }) => {
      if (multiplayerStatus.connected) {
        setCheatToast('Saia da sala multiplayer para jogar sua campanha personalizada!');
        setTimeout(() => setCheatToast(''), 3500);
        return;
      }
      if (!levels || levels.length === 0) return;
      const immortal = options?.immortality ?? editorImmortality;
      const sanitizedLevels = levels.map(l => sanitizeCustomLevelEntities(l).level);
      setEditorImmortality(immortal);
      SoundEngine.get().resume();
      setIsLevelEditorOpen(false);
      setIsSettingsOpen(false);
      setIsUpdatesOpen(false);
      setIsCampaignVictory(false);
      setIsMultiplayerMatchOver(false);
      setHasStarted(true);
      setIsCustomLevelActive(true);
      setIsSmwMapOpen(false);
      setIsSmwModeActive(false);
      if (engineRef.current) {
        engineRef.current.startCustomCampaign(sanitizedLevels, immortal);
        setIsPaused(false);
        setIsGameOver(false);
        setIsStageClear(false);
        setStats({ ...engineRef.current.stats, isNewHighScore: false });
        setMarioPower(engineRef.current.marioPower);
      }
    },
    [multiplayerStatus.connected, editorImmortality]
  );

  const handleReturnToMainMenu = useCallback(() => {
    if (!canExitToMainMenu(getModePolicyInput())) {
      setCheatToast('Troca de modo bloqueada após iniciar a partida! Disponível apenas no Modo Desenvolvedor ou usando o Editor.');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    setIsLevelEditorOpen(false);
    setIsSettingsOpen(false);
    setIsUpdatesOpen(false);
    setIsCheatMenuOpen(false);
    setIsSmwMapOpen(false);
    setIsSmwModeActive(false);
    setSmwJustClearedNodeId(null);
    setSmwCastleSaveTitle(null);
    setSmwSaveSlots(loadSmwSaveSlots());
    setIsPaused(false);
    setIsGameOver(false);
    setIsStageClear(false);
    setIsCampaignVictory(false);
    setHasStarted(false);
    setIsCustomLevelActive(false);
    manualRunHeldRef.current = false;
    setControls({
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      run: false,
      pause: false,
    });
    if (engineRef.current) {
      engineRef.current.exitToMainMenu();
      setStats({ ...engineRef.current.stats, isNewHighScore: false });
      setMarioPower(engineRef.current.marioPower);
    } else {
      SoundEngine.get().stopMusic();
    }
  }, [getModePolicyInput]);

  const handleRestart = () => {
    SoundEngine.get().resume();
    if (multiplayerStatus.connected) {
      if (multiplayerStatus.transport === 'websocket' || multiplayerStatus.isHost) {
        if (engineRef.current) engineRef.current.isPaused = false;
        multiplayerClient.startMultiplayerRematch();
        setIsPaused(false);
        setIsGameOver(false);
        setIsStageClear(false);
      } else {
        setCheatToast('Apenas o anfitrião pode reiniciar a partida da sala!');
        setTimeout(() => setCheatToast(''), 3000);
      }
      return;
    }
    if (engineRef.current) {
      engineRef.current.restartGame();
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
    }
  };

  useEffect(() => {
    const getFullscreenElement = () =>
      document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ||
      null;

    const handleFullscreenChange = () => {
      const activeNative = Boolean(getFullscreenElement());
      if (activeNative) {
        wasNativeFullscreenRef.current = true;
        setIsFullscreen(true);
      } else if (wasNativeFullscreenRef.current) {
        wasNativeFullscreenRef.current = false;
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const el = containerRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;

    const nativeFsEl = document.fullscreenElement || doc.webkitFullscreenElement;

    if (isFullscreen || nativeFsEl) {
      setIsFullscreen(false);
      wasNativeFullscreenRef.current = false;
      if (nativeFsEl) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
        }
      }
      return;
    }

    // Always activate immersive 100dvh fullscreen immediately (ensures full support on iOS Safari & mobile iframes)
    setIsFullscreen(true);

    if (el) {
      if (el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {
          // Fallback to CSS immersive mobile fullscreen already enabled above
        });
      } else if (el.webkitRequestFullscreen) {
        try {
          Promise.resolve(el.webkitRequestFullscreen()).catch(() => {});
        } catch {
          // Immersive CSS fullscreen remains active
        }
      }
    }
  }, [isFullscreen]);

  const handleStartGame = () => {
    if (!canSwitchGameMode(getModePolicyInput())) {
      setCheatToast('Troca de modo bloqueada após iniciar a partida! Disponível apenas no Modo Desenvolvedor ou usando o Editor.');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    SoundEngine.get().resume();
    setIsCampaignVictory(false);
    setIsSmwMapOpen(false);
    setIsSmwModeActive(false);
    setIsCustomLevelActive(false);
    setHasStarted(true);
    if (engineRef.current) {
      if (multiplayerStatus.connected) {
        engineRef.current.isGameStarted = true;
      } else {
        engineRef.current.gameMode = 'classic';
        engineRef.current.restartGame();
      }
    }
  };

  const handleStartSingleplayer = () => {
    if (!canSwitchGameMode(getModePolicyInput())) {
      setCheatToast('Troca de modo bloqueada após iniciar a partida! Disponível apenas no Modo Desenvolvedor ou usando o Editor.');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    if (multiplayerStatus.connected) {
      setCheatToast('Desconecte do multiplayer para jogar o modo Singleplayer (7 Mundos)!');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    SoundEngine.get().resume();
    setIsCampaignVictory(false);
    setIsSmwMapOpen(false);
    setIsSmwModeActive(false);
    setIsSettingsOpen(false);
    setIsLevelEditorOpen(false);
    setHasStarted(true);
    setIsCustomLevelActive(false);
    if (engineRef.current) {
      engineRef.current.startSingleplayerCampaign(1, 1);
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
      setStats({ ...engineRef.current.stats, isNewHighScore: false });
      setMarioPower(engineRef.current.marioPower);
    }
  };

  const handleReplaySingleplayerVictory = useCallback(() => {
    if (multiplayerStatus.connected) return;
    SoundEngine.get().resume();
    setIsCampaignVictory(false);
    setIsSmwMapOpen(false);
    setIsSmwModeActive(false);
    setIsSettingsOpen(false);
    setIsLevelEditorOpen(false);
    setHasStarted(true);
    setIsCustomLevelActive(false);
    if (engineRef.current) {
      engineRef.current.startSingleplayerCampaign(1, 1);
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
      setStats({ ...engineRef.current.stats, isNewHighScore: false });
      setMarioPower(engineRef.current.marioPower);
    }
  }, [multiplayerStatus.connected]);

  const handleOpenSmwWorldMap = useCallback(() => {
    if (!canSwitchGameMode(getModePolicyInput())) {
      setCheatToast('Troca de modo bloqueada após iniciar a partida! Disponível apenas no Modo Desenvolvedor ou usando o Editor.');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    if (multiplayerStatus.connected) {
      setCheatToast('Desconecte do multiplayer para explorar o Overworld (Beta V0.9)!');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    SoundEngine.get().stopMusic();
    setIsCampaignVictory(false);
    setIsSettingsOpen(false);
    setIsLevelEditorOpen(false);
    setIsUpdatesOpen(false);
    setIsPaused(false);
    setIsGameOver(false);
    setIsStageClear(false);
    setIsCustomLevelActive(false);
    setSmwJustClearedNodeId(null);
    setSmwCastleSaveTitle(null);
    setSmwSaveSlots(loadSmwSaveSlots());
    setHasStarted(true);
    setIsSmwModeActive(true);
    setIsSmwMapOpen(true);
    manualRunHeldRef.current = false;
    setControls({
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      run: false,
      pause: false,
    });
    if (engineRef.current) {
      engineRef.current.returnToSmwOverworldState();
    }
  }, [multiplayerStatus.connected, getModePolicyInput]);

  const handleOpenSmwLoadProgress = useCallback(() => {
    if (!canSwitchGameMode(getModePolicyInput())) {
      setCheatToast('Troca de modo bloqueada após iniciar a partida! Disponível apenas no Modo Desenvolvedor ou usando o Editor.');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    if (multiplayerStatus.connected) {
      setCheatToast('Desconecte do multiplayer para carregar o Modo World!');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    handleOpenSmwWorldMap();
    setSmwOpenLoadSignal(prev => prev + 1);
  }, [multiplayerStatus.connected, handleOpenSmwWorldMap, getModePolicyInput]);

  const handleEnterSmwStage = useCallback(
    (nodeId: string) => {
      const node = SMW_WIKIWORLD_NODES.find(n => n.id === nodeId);
      if (!node || !isSmwNodeUnlocked(node.id, smwProgress)) return;
      if (!canEnterSmwNode(node.id, smwProgress)) {
        if (isSmwNodeCompletedAndLocked(node.id, smwProgress)) {
          setCheatToast('Palácio Interruptor Amarelo já concluído!');
          setTimeout(() => setCheatToast(''), 3000);
        }
        return;
      }

      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const updated: SmwBetaProgress = {
        ...smwProgress,
        selectedNodeId: nodeId,
        storySeen: true,
      };
      setSmwProgress(updated);
      setSmwCastleSaveTitle(null);

      SoundEngine.get().resume();
      setIsSmwMapOpen(false);
      setIsSmwModeActive(true);
      setActiveSmwNodeId(nodeId);
      setSmwJustClearedNodeId(null);
      setHasStarted(true);
      setIsCustomLevelActive(false);
      manualRunHeldRef.current = false;
      setControls({
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        spinJump: false,
        run: false,
        select: false,
        pause: false,
      });
      if (engineRef.current) {
        engineRef.current.yellowSwitchUnlocked = updated.yellowSwitchUnlocked;
        engineRef.current.greenSwitchUnlocked = Boolean(updated.greenSwitchUnlocked);
        engineRef.current.redSwitchUnlocked = Boolean(updated.redSwitchUnlocked);
        engineRef.current.pinkSwitchUnlocked = Boolean(updated.pinkSwitchUnlocked);
        engineRef.current.blueSwitchUnlocked = Boolean(updated.blueSwitchUnlocked);
        engineRef.current.goalPointsWallet = updated.goalPointsWallet ?? 0;
        engineRef.current.stats.goalPointsWallet = engineRef.current.goalPointsWallet;
        engineRef.current.startSmwStage(createSmwWikiWorldStage(nodeId), false);
        setIsPaused(false);
        setIsGameOver(false);
        setIsStageClear(false);
        setStats({ ...engineRef.current.stats, isNewHighScore: false });
        setMarioPower(engineRef.current.marioPower);
      }
    },
    [smwProgress]
  );

  const handleSaveSmwSlot = useCallback(
    (slotIndex: number) => {
      const nextSlots = saveSmwToSlot(slotIndex, smwProgress, {
        stageName: smwCastleSaveTitle || 'Castelo de Johannnnes89',
        lives: engineRef.current?.stats.lives ?? stats.lives,
        score: engineRef.current?.stats.score ?? stats.score,
      });
      setSmwSaveSlots(nextSlots);
      setSmwCastleSaveTitle(null);
      setCheatToast(`Progresso salvo no Slot ${slotIndex + 1}!`);
      setTimeout(() => setCheatToast(''), 3000);
    },
    [smwProgress, smwCastleSaveTitle, stats.lives, stats.score]
  );

  const handleLoadSmwSlot = useCallback((slotIndex: number) => {
    const slots = loadSmwSaveSlots();
    const slot = slots[slotIndex];
    if (!slot) return;
    const loadedProgress = applySmwSlotToProgress(slot);
    setSmwProgress(loadedProgress);
    setSmwSaveSlots(slots);
    setSmwCastleSaveTitle(null);
    setSmwJustClearedNodeId(null);
    setIsGameOver(false);
    setIsPaused(false);
    setIsStageClear(false);
    setIsCampaignVictory(false);
    setHasStarted(true);
    setIsSmwModeActive(true);
    setIsSmwMapOpen(true);
    setActiveSmwNodeId(null);
    manualRunHeldRef.current = false;
    setControls({
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      spinJump: false,
      run: false,
      select: false,
      pause: false,
    });
    if (engineRef.current) {
      engineRef.current.returnToSmwOverworldState();
      if (!engineRef.current.currentRunId) {
        engineRef.current.currentRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      }
      engineRef.current.yellowSwitchUnlocked = loadedProgress.yellowSwitchUnlocked;
      engineRef.current.greenSwitchUnlocked = Boolean(loadedProgress.greenSwitchUnlocked);
      engineRef.current.redSwitchUnlocked = Boolean(loadedProgress.redSwitchUnlocked);
      engineRef.current.pinkSwitchUnlocked = Boolean(loadedProgress.pinkSwitchUnlocked);
      engineRef.current.blueSwitchUnlocked = Boolean(loadedProgress.blueSwitchUnlocked);
      engineRef.current.goalPointsWallet = loadedProgress.goalPointsWallet ?? 0;
      engineRef.current.stats.goalPointsWallet = engineRef.current.goalPointsWallet;
      engineRef.current.stats.lives = Math.max(1, slot.lives);
      engineRef.current.stats.score = Math.max(0, slot.score);
      setStats({ ...engineRef.current.stats, isNewHighScore: false });
    }
    setCheatToast(`Slot ${slotIndex + 1} carregado!`);
    setTimeout(() => setCheatToast(''), 3000);
  }, []);

  const handleDeleteSmwSlot = useCallback((slotIndex: number) => {
    const nextSlots = deleteSmwSlot(slotIndex);
    setSmwSaveSlots(nextSlots);
    setCheatToast(`Slot ${slotIndex + 1} apagado!`);
    setTimeout(() => setCheatToast(''), 2500);
  }, []);

  return (
    <div
      ref={containerRef}
      style={
        isFullscreen
          ? {
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
            }
          : undefined
      }
      className={
        isFullscreen
          ? `fixed inset-0 z-40 flex flex-col items-center justify-between w-screen h-[100dvh] bg-black select-none overflow-hidden ${
              smartTvMode ? 'p-3 sm:p-4' : ''
            }`
          : `relative flex flex-col items-center justify-start w-full min-h-screen bg-stone-950 select-none overflow-x-hidden ${
              smartTvMode ? 'px-4 py-2 sm:px-6 sm:py-3' : ''
            }`
      }
    >
      {/* Top HUD (Placar & Vidas) */}
      <RetroHUD
        stats={stats}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        isCheatActive={isCheatActive}
        isCustomLevel={isCustomLevelActive}
        isFemboy={marioPower === 'femboy'}
        onOpenCheatMenu={handleDeveloperButtonClick}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isDebugMode={isDebugMode}
        isDebugPlacementActive={isDebugPlacementActive}
        debugCoords={debugCoords}
        isIllegalInstructionBug={isIllegalInstructionBug}
        onToggleDebugPlacement={handleToggleDebugPlacement}
      />

      {/* Compact Sonic Debug Placement Bar when Debug Mode is active */}
      {hasStarted && isDebugMode && !isIllegalInstructionBug && !isSmwMapOpen && (
        <div className="w-full max-w-4xl px-2 sm:px-4 pt-1 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleDebugPlacement}
              className={`px-2 py-1 rounded border font-bold flex items-center gap-1 cursor-pointer transition ${
                isDebugPlacementActive
                  ? 'bg-cyan-600/80 border-cyan-300 text-white shadow'
                  : 'bg-stone-900 border-cyan-600/50 text-cyan-300 hover:bg-stone-800'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>{isDebugPlacementActive ? 'CURSOR: ON (B)' : 'CURSOR: OFF (B)'}</span>
            </button>

            <div className="flex items-center bg-stone-900 border border-stone-700 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => handleCycleDebugItem(-1)}
                title="Item anterior ([)"
                className="px-1.5 py-1 hover:bg-stone-800 text-amber-300 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 py-1 text-amber-200 font-bold tracking-wide min-w-[110px] text-center">
                {debugSelectedLabel}
              </span>
              <button
                type="button"
                onClick={() => handleCycleDebugItem(1)}
                title="Próximo item (] / Shift / X)"
                className="px-1.5 py-1 hover:bg-stone-800 text-amber-300 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePlaceDebugItem}
              className="px-2.5 py-1 rounded bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-400/70 text-white font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <Plus className="w-3 h-3" />
              <span>INSERIR (Espaço)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleDebugMode}
            className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-[9px] flex items-center gap-1 cursor-pointer"
          >
            <Bug className="w-3 h-3 text-cyan-400" />
            <span>SAIR DEBUG</span>
          </button>
        </div>
      )}

      {/* Main Arcade Frame / TV Screen Bezel */}
      <div
        className={`relative flex-1 min-h-0 w-full flex items-center justify-center ${
          isFullscreen ? 'p-0 overflow-hidden' : 'p-2 sm:p-4 overflow-auto'
        }`}
      >
        <div
          className={`relative bg-black overflow-hidden flex items-center justify-center transition-all duration-200 ${
            isFullscreen
              ? 'border-0 rounded-none shadow-none'
              : 'rounded-lg sm:rounded-2xl border-2 sm:border-8 border-stone-800 shadow-2xl'
          } ${
            resolutionScale === 'fit'
              ? isFullscreen
                ? 'w-full h-full max-w-none max-h-full'
                : isMobileDevice && touchOverlayOnCanvas
                ? 'w-full max-w-4xl aspect-[4/3] max-h-[76vh] sm:max-h-[75vh]'
                : 'w-full max-w-4xl aspect-[4/3] max-h-[46vh] sm:max-h-[68vh] md:max-h-[75vh]'
              : ''
          }`}
          style={
            resolutionScale !== 'fit'
              ? {
                  width:
                    resolutionScale === '0.5x'
                      ? 128
                      : resolutionScale === '0.75x'
                      ? 192
                      : resolutionScale === '1x'
                      ? 256
                      : resolutionScale === '1.25x'
                      ? 320
                      : resolutionScale === '1.5x'
                      ? 384
                      : 512,
                  height:
                    resolutionScale === '0.5x'
                      ? 120
                      : resolutionScale === '0.75x'
                      ? 180
                      : resolutionScale === '1x'
                      ? 240
                      : resolutionScale === '1.25x'
                      ? 300
                      : resolutionScale === '1.5x'
                      ? 360
                      : 480,
                }
              : undefined
          }
        >
          {/* HTML5 Canvas (Internal resolution 256x240, stretched with pixelated CSS) */}
          <canvas
            ref={canvasRef}
            width={GameEngine.NES_WIDTH}
            height={GameEngine.NES_HEIGHT}
            onClick={handleCanvasDebugClick}
            className={`w-full h-full object-contain image-rendering-pixelated ${
              isDebugMode && isDebugPlacementActive ? 'cursor-crosshair' : ''
            }`}
            style={{
              imageRendering: 'pixelated',
            }}
          />

          {/* CRT Scanline & Phosphor Overlay */}
          {crtFilter && (
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0px, rgba(0, 0, 0, 0.25) 1px, transparent 1px, transparent 2px)',
                boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.65)',
              }}
            />
          )}

          {/* Translucent On-Screen D-Pad & Action Buttons (A, B) Overlay on Canvas for Mobile Devices (hidden in Smart TV mode) */}
          {!smartTvMode && isMobileDevice && touchOverlayOnCanvas && hasStarted && !isSmwMapOpen && !isPaused && !isGameOver && !isMultiplayerMatchOver && (
            <TouchControls
              variant="canvas-overlay"
              controls={controls}
              onControlChange={handleControlChange}
              isPaused={isPaused}
              onTogglePause={togglePauseGame}
              onSelectAction={handleSelectAction}
              reservePowerUp={stats.reservePowerUp ?? null}
              canExitClearedWorldStage={isCurrentSmwStageCleared}
              isMuted={soundStatus.muted}
              onToggleMute={toggleMute}
              onRestart={handleRestart}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              multiplayerConnected={multiplayerStatus.connected}
            />
          )}

          {/* Start Screen Splash — Simplified & Clean Hierarchy (R1.16.7H.4 + R1.16.EG.4) */}
          {!hasStarted && (
            <div
              ref={splashOverlayRef}
              className="absolute inset-0 z-20 flex flex-col items-center justify-between bg-black/88 p-3 sm:p-6 text-center animate-in fade-in overflow-y-auto"
            >
              {/* Top Utility Strip: Compact 16+ Badge + Quick Display/TV Toggles */}
              <div className="w-full max-w-xl flex items-center justify-between gap-2">
                <div
                  title="Recomendado para maiores de 16 anos (pode haver mensagens sugestivas no jogo)."
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/70 text-[10px] sm:text-xs text-amber-200"
                >
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 font-['Press_Start_2P',monospace] text-[9px] font-extrabold">
                    16+
                  </span>
                  <span className="hidden sm:inline font-medium">
                    Recomendado 16+ · Mensagens sugestivas
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleSmartTvMode}
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      smartTvMode
                        ? 'bg-sky-900/90 border-sky-400 text-sky-100'
                        : 'bg-stone-900/90 hover:bg-stone-800 border-stone-700 text-stone-300'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5 text-sky-400" />
                    <span>{smartTvMode ? 'TV: ON' : 'TV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      isFullscreen
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                        : 'bg-stone-900/90 hover:bg-stone-800 border-stone-700 text-stone-200'
                    }`}
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
                  </button>
                </div>
              </div>

              {/* Center Hero & Focused Mode Selection */}
              <div className="w-full max-w-xl my-auto py-3 flex flex-col items-center">
                <span className="block text-amber-400 font-['Press_Start_2P',monospace] text-xl sm:text-3xl font-extrabold tracking-wider drop-shadow-md">
                  SUPER MARIO BROS.
                </span>
                <p className="mt-1.5 text-[11px] sm:text-xs text-stone-400 font-mono">
                  60 FPS Canvas · Clássico NES · Modo World · Campanha 7 Mundos
                </p>

                {/* Primary Play Actions (3 focused modes) */}
                <div className="mt-4 sm:mt-5 w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-['Press_Start_2P',monospace] text-white text-[10px] sm:text-xs font-bold shadow-xl shadow-red-950/50 transform hover:scale-[1.03] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white shrink-0" />
                    <span>JOGAR CLÁSSICO</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenSmwWorldMap}
                    className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 hover:from-emerald-600 hover:to-teal-500 border border-amber-300/70 font-['Press_Start_2P',monospace] text-white text-[10px] sm:text-xs font-bold shadow-xl shadow-emerald-950/50 transform hover:scale-[1.03] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MapIcon className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>MODO WORLD</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartSingleplayer}
                    className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 border border-pink-300/60 font-['Press_Start_2P',monospace] text-white text-[10px] sm:text-xs font-bold shadow-xl shadow-pink-950/50 transform hover:scale-[1.03] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Crown className="w-4 h-4 text-amber-200 shrink-0" />
                    <span>7 MUNDOS</span>
                  </button>
                </div>

                {/* Secondary Utilities (Compact single row) */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenSmwLoadProgress}
                    title="Carregar progresso salvo manualmente no Modo World"
                    className="px-3 py-2 rounded-lg bg-amber-950/90 hover:bg-amber-900 border border-amber-500/70 text-amber-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Carregar World ({smwSaveSlots.filter(Boolean).length}/3)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMultiplayerOpen(true)}
                    className="px-3 py-2 rounded-lg bg-emerald-950/85 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Multiplayer</span>
                  </button>

                  <button
                    type="button"
                    onClick={openLevelEditor}
                    className="px-3 py-2 rounded-lg bg-sky-950/85 hover:bg-sky-900 border border-sky-500/70 text-sky-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Hammer className="w-3.5 h-3.5 text-sky-400" />
                    <span>Editor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLeaderboardOpen(true)}
                    className="px-3 py-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 border border-amber-500/60 text-amber-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ranking{stats.highScore > 0 ? ` (${stats.highScore.toLocaleString()})` : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={openAchievementsModal}
                    className="px-3 py-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 border border-emerald-500/60 text-emerald-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0 tabular-nums"
                  >
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Conquistas ({achievementsSummary.unlockedCount}/{achievementsSummary.totalCount})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openUpdatesModal('fixes')}
                    className="px-3 py-2 rounded-lg bg-amber-950/85 hover:bg-amber-900 border border-amber-400/80 text-amber-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Correções Recentes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="px-3 py-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
                  >
                    <Settings className="w-3.5 h-3.5 text-stone-300" />
                    <span>Opções</span>
                  </button>
                </div>

                {/* Compact Controls Hint */}
                <div className="mt-3 text-[10px] sm:text-[11px] text-amber-300/90 font-mono">
                  {smartTvMode
                    ? '[◀▶▼] Mover • [OK / ▲ / Vermelho] Pular • [Azul / 0] Correr/Fogo • [Voltar] Pausar'
                    : '[Setas / WASD] Mover • [Espaço / Z] Pular • [C / Q] Pulo Carpado • [Shift / X] Correr/Fogo • [V / Tab] Select'}
                </div>
              </div>

              {/* Compact Footer Attribution + Hidden Cheat Trigger */}
              <div className="w-full max-w-xl flex flex-col items-center">
                <p className="text-[10px] text-stone-500 font-mono leading-snug">
                  Projeto não oficial de fãs (WazzimaGiygg). Jogo original pertence à Nintendo. Όχι, ο Χρόνος δεν είναι ο άρχοντας της γνώσης!
                </p>
                <input
                  type="text"
                  tabIndex={-1}
                  aria-hidden="true"
                  value={splashCheatInput}
                  onChange={e => {
                    const val = e.target.value;
                    setSplashCheatInput(val);
                    if (val.trim().toLowerCase() === 'lula132026') {
                      activateCheat();
                      setSplashCheatInput('');
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      if (splashCheatInput.trim().toLowerCase() === 'lula132026') {
                        activateCheat();
                        setSplashCheatInput('');
                      }
                    }
                  }}
                  className="opacity-0 w-1 h-1 pointer-events-none select-none absolute"
                />
              </div>
            </div>
          )}

          {/* Pause Overlay */}
          {isPaused && hasStarted && (
            <div
              ref={pauseOverlayRef}
              role="dialog"
              aria-label="PAUSED"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs p-4 text-center"
            >
              <h2 className="font-['Press_Start_2P',monospace] text-2xl sm:text-4xl text-amber-400 mb-3 tracking-widest drop-shadow-[0_3px_0_rgba(0,0,0,0.9)]">
                PAUSED
              </h2>
              <p className="text-stone-300 font-mono text-xs mb-6">
                {smartTvMode ? (
                  <>
                    Use as <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">SETAS</kbd> +{' '}
                    <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">OK</kbd> ou{' '}
                    <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">VOLTAR</kbd> para continuar
                  </>
                ) : (
                  <>
                    Pressione <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">ESC</kbd> ou{' '}
                    <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">P</kbd> para continuar
                  </>
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    togglePauseGame();
                  }}
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-['Press_Start_2P',monospace] text-xs shadow cursor-pointer"
                >
                  CONTINUAR
                </button>
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-5 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-amber-500/50 text-amber-300 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  RANKING
                </button>
                <button
                  type="button"
                  disabled={isModeAndEditorLocked}
                  onClick={openLevelEditor}
                  title={
                    isModeAndEditorLocked
                      ? 'Editor de Fases bloqueado após iniciar a partida (permitido no Modo Desenvolvedor ou usando o Editor)'
                      : 'Abrir Editor de Fases'
                  }
                  className="px-5 py-2.5 rounded-lg bg-sky-900 hover:bg-sky-800 border border-sky-400/60 text-sky-200 disabled:opacity-45 disabled:hover:bg-sky-900 disabled:cursor-not-allowed font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer"
                >
                  {isModeAndEditorLocked ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Hammer className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  EDITOR DE FASES
                </button>
                <button
                  type="button"
                  onClick={openAchievementsModal}
                  className="px-4 py-2.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-200 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  CONQUISTAS
                </button>
                <button
                  type="button"
                  onClick={() => openUpdatesModal('fixes')}
                  className="px-4 py-2.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-400/70 text-amber-200 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  CORREÇÕES
                </button>
                <button
                  type="button"
                  onClick={() => openUpdatesModal('all')}
                  className="px-5 py-2.5 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-500/60 text-purple-200 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ScrollText className="w-3.5 h-3.5 text-purple-300" />
                  NOVIDADES
                </button>
                {isCustomLevelActive && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !editorImmortality;
                      setEditorImmortality(next);
                      engineRef.current?.setEditorImmortality(next);
                      if (engineRef.current) {
                        setStats({ ...engineRef.current.stats, isNewHighScore: false });
                      }
                    }}
                    className={`px-4 py-2.5 rounded-lg border font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer ${
                      editorImmortality
                        ? 'bg-purple-900 hover:bg-purple-800 border-purple-400 text-purple-100'
                        : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-300'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-300" />
                    IMORTAL: {editorImmortality ? 'ON' : 'OFF'}
                  </button>
                )}
                {isSmwModeActive && (
                  <button
                    type="button"
                    disabled={!isCurrentSmwStageCleared}
                    onClick={handleSelectAction}
                    title={
                      isCurrentSmwStageCleared
                        ? 'Select (V): Sair desta fase já passada e voltar ao Mapa do Modo World'
                        : 'Select bloqueado: conclua esta fase ao menos uma vez antes de sair pelo Select'
                    }
                    className={`px-5 py-2.5 rounded-lg border font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                      isCurrentSmwStageCleared
                        ? 'bg-emerald-900 hover:bg-emerald-800 border-emerald-400/70 text-emerald-100 cursor-pointer'
                        : 'bg-stone-900/90 border-stone-700 text-stone-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {isCurrentSmwStageCleared ? (
                      <MapIcon className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-stone-500" />
                    )}
                    <span>
                      {isCurrentSmwStageCleared ? 'SELECT · OVERWORLD' : 'SELECT · PASSE A FASE'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleRestart();
                    setIsPaused(false);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-['Press_Start_2P',monospace] text-xs shadow cursor-pointer"
                >
                  REINICIAR
                </button>
              </div>
            </div>
          )}

          {/* Super Mario World Beta V0.9 Overworld Map (Ilha 1 WikiWorldWeb & Ilha 2 Terras de Chronus) */}
          <SmwOverworldMap
            isOpen={isSmwMapOpen && hasStarted && !isGameOver && !isMultiplayerMatchOver}
            progress={smwProgress}
            playerCharacter={engineRef.current?.playerCharacter || 'mario'}
            justClearedNodeId={smwJustClearedNodeId}
            saveSlots={smwSaveSlots}
            castleSavePromptNodeTitle={smwCastleSaveTitle}
            openLoadSignal={smwOpenLoadSignal}
            onSelectNode={nodeId => {
              setSmwProgress(prev => ({ ...prev, selectedNodeId: nodeId }));
            }}
            onSelectIsland={islandId => {
              setSmwProgress(prev => ({ ...prev, selectedIslandId: islandId }));
            }}
            onEnterStage={handleEnterSmwStage}
            onDismissStory={() => {
              setSmwProgress(prev => (prev.storySeen ? prev : { ...prev, storySeen: true }));
            }}
            onResetProgress={() => {
              const reset: SmwBetaProgress = {
                clearedNodeIds: [],
                selectedNodeId: 'wiki-1-overworld',
                selectedIslandId: 'wikiworld',
                storySeen: true,
                yellowSwitchUnlocked: false,
                greenSwitchUnlocked: false,
                redSwitchUnlocked: false,
                pinkSwitchUnlocked: false,
                blueSwitchUnlocked: false,
                goalPointsWallet: 0,
              };
              if (engineRef.current) {
                engineRef.current.yellowSwitchUnlocked = false;
                engineRef.current.greenSwitchUnlocked = false;
                engineRef.current.redSwitchUnlocked = false;
                engineRef.current.pinkSwitchUnlocked = false;
                engineRef.current.blueSwitchUnlocked = false;
                engineRef.current.goalPointsWallet = 0;
                engineRef.current.stats.goalPointsWallet = 0;
              }
              setSmwProgress(reset);
              setSmwJustClearedNodeId(null);
              setSmwCastleSaveTitle(null);
            }}
            onSaveToSlot={handleSaveSmwSlot}
            onLoadFromSlot={handleLoadSmwSlot}
            onDeleteSlot={handleDeleteSmwSlot}
            onDismissCastleSave={() => setSmwCastleSaveTitle(null)}
            onBackToMainMenu={handleReturnToMainMenu}
            isReturnToMenuLocked={isModeAndEditorLocked}
          />

          {/* Multiplayer Winner Overlay (when any player loses all lives) */}
          {isMultiplayerMatchOver && multiplayerMatchResult && (
            <div
              ref={multiplayerOverOverlayRef}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 p-4 sm:p-6 text-center animate-in zoom-in-95 overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 fill-amber-400 animate-bounce" />
                <h2 className="font-['Press_Start_2P',monospace] text-lg sm:text-2xl text-amber-400 tracking-wider drop-shadow-lg">
                  FIM DE PARTIDA!
                </h2>
              </div>

              <p className="text-red-400 font-mono text-[11px] sm:text-xs mb-3">
                {multiplayerMatchResult.loserNames.join(', ')} perdeu todas as vidas!
              </p>

              {/* Winner Highlight Card */}
              <div className="w-full max-w-md rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-950/70 via-stone-900 to-stone-950 p-3 sm:p-4 mb-3 shadow-[0_0_25px_rgba(245,158,11,0.3)]">
                <div className="text-[10px] font-['Press_Start_2P',monospace] text-amber-300 mb-1.5">
                  {multiplayerMatchResult.isTie ? 'EMPATE NO 1º LUGAR!' : 'JOGADOR VENCEDOR'}
                </div>
                <div className="flex items-center justify-center gap-3">
                  {multiplayerMatchResult.winner.photoUrl ? (
                    <img
                      src={multiplayerMatchResult.winner.photoUrl}
                      alt={multiplayerMatchResult.winner.name}
                      className="w-10 h-10 rounded-full border-2 border-amber-400"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full border-2 border-amber-400 flex items-center justify-center font-['Press_Start_2P',monospace] text-xs font-bold ${
                        multiplayerMatchResult.winner.character === 'wazzima'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-red-700 text-white'
                      }`}
                    >
                      {multiplayerMatchResult.winner.character === 'wazzima' ? 'W' : 'M'}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="font-['Press_Start_2P',monospace] text-xs sm:text-sm text-white">
                      {multiplayerMatchResult.winner.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                          multiplayerMatchResult.winner.character === 'wazzima'
                            ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-500/50'
                            : 'bg-red-900/90 text-red-200 border border-red-500/50'
                        }`}
                      >
                        {multiplayerMatchResult.winner.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario'}
                      </span>
                      <span className="font-['Press_Start_2P',monospace] text-xs text-amber-400">
                        {multiplayerMatchResult.winner.score} PTS
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ranked Standings */}
              <div className="w-full max-w-md bg-stone-900/90 border border-stone-700 rounded-xl p-2.5 sm:p-3 mb-4 space-y-1.5 text-left">
                {multiplayerMatchResult.standings.map((player, idx) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono ${
                      idx === 0
                        ? 'bg-amber-500/15 border border-amber-400/50 text-amber-100'
                        : 'bg-stone-950/70 border border-stone-800 text-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-['Press_Start_2P',monospace] text-[10px] text-amber-400 w-6">
                        {idx + 1}º
                      </span>
                      <span className="truncate font-bold">
                        {player.name}
                        {player.isLocal ? ' (Você)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          player.lives <= 0
                            ? 'bg-red-950 text-red-400 border border-red-700/60'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                        }`}
                      >
                        {player.lives <= 0 ? 'SEM VIDAS' : `x${player.lives}`}
                      </span>
                      <span className="font-bold text-amber-300">{player.score} pts</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rematch / Exit Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-center">
                {(!multiplayerStatus.connected || multiplayerStatus.transport === 'websocket' || multiplayerStatus.isHost) ? (
                  <button
                    type="button"
                    onClick={() => multiplayerClient.startMultiplayerRematch()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    NOVA PARTIDA
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-lg bg-stone-900 border border-amber-500/40 text-amber-300 font-mono text-xs animate-pulse">
                    Aguardando o anfitrião iniciar nova partida...
                  </div>
                )}

                {multiplayerStatus.connected && (
                  <button
                    type="button"
                    onClick={async () => {
                      await multiplayerClient.disconnect();
                      handleRestart();
                      setIsMultiplayerMatchOver(false);
                      setMultiplayerMatchResult(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 font-['Press_Start_2P',monospace] text-[10px] cursor-pointer"
                  >
                    SAIR DA SALA
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Solo Game Over Overlay */}
          {isGameOver && !isMultiplayerMatchOver && (
            <div
              ref={gameOverOverlayRef}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center animate-in zoom-in-95"
            >
              <h2 className="font-['Press_Start_2P',monospace] text-3xl sm:text-5xl text-red-600 mb-3 tracking-widest drop-shadow-lg">
                GAME OVER
              </h2>
              {stats.isNewHighScore && !isCheatActive && !isCustomLevelActive && (
                <div className="mb-3 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs animate-bounce flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>NOVO RECORDE LOCAL!</span>
                </div>
              )}
              <p className="text-stone-300 font-mono text-sm mb-2">
                {marioPower === 'femboy' ? 'LOVE POINTS FINAIS: ' : 'PONTUAÇÃO FINAL: '}
                <span className={`font-bold text-base ${marioPower === 'femboy' ? 'text-pink-400' : 'text-amber-400'}`}>
                  {stats.score.toLocaleString()}
                </span>
              </p>
              <p className="text-stone-400 font-mono text-xs mb-5">
                RECORDE MÁXIMO: <span className="text-amber-300 font-bold">{stats.highScore.toLocaleString()}</span>
                {lastSavedRank !== null && !isCheatActive && !isCustomLevelActive && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-bold">
                    #{lastSavedRank} NO RANKING
                  </span>
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRestart}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg transform hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  JOGAR NOVAMENTE
                </button>
                {isSmwModeActive && (
                  <button
                    type="button"
                    onClick={handleReturnToSmwOverworld}
                    className="px-5 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-400/70 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <MapIcon className="w-4 h-4 text-amber-300" />
                    OVERWORLD
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/50 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {!isCheatActive && !isCustomLevelActive && stats.score > 0 ? 'RANKING / NOME' : 'VER RANKING'}
                </button>
                <button
                  type="button"
                  onClick={handleReturnToMainMenu}
                  className="px-5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-600 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Home className="w-4 h-4 text-stone-300" />
                  TELA INICIAL
                </button>
              </div>
            </div>
          )}

          {/* Final Campaign Victory Overlay (7-World Singleplayer or Custom Editor Campaign) */}
          {isCampaignVictory && !isGameOver && !isMultiplayerMatchOver && (
            <div
              ref={victoryOverlayRef}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 p-5 sm:p-6 text-center animate-in zoom-in-95 overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-7 h-7 text-amber-400 fill-amber-400" />
                {!isCustomLevelActive && <Heart className="w-6 h-6 text-pink-400 fill-pink-500" />}
              </div>
              <h2 className="font-['Press_Start_2P',monospace] text-lg sm:text-2xl text-pink-300 mb-2 tracking-wider drop-shadow-lg">
                {isCustomLevelActive ? 'CAMPANHA CONCLUÍDA!' : '7 MUNDOS CONCLUÍDOS!'}
              </h2>
              <p className="text-amber-300 font-mono text-xs sm:text-sm font-bold mb-1">
                {isCustomLevelActive
                  ? 'Você venceu todas as fases da sua campanha personalizada!'
                  : 'Você salvou a Princesa Femboy no Castelo Final (7-5)!'}
              </p>
              <p className="text-stone-300 font-mono text-xs mb-3">
                Pontuação Final:{' '}
                <span className="font-bold text-amber-400 text-sm">{stats.score.toLocaleString()}</span>
                {' · '}
                Moedas: <span className="font-bold text-amber-300">{stats.coins}</span>
              </p>
              {stats.isNewHighScore && !isCheatActive && !isCustomLevelActive && (
                <div className="mb-3 px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>NOVO RECORDE LOCAL!</span>
                </div>
              )}
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                <button
                  type="button"
                  onClick={isCustomLevelActive ? handleRestart : handleReplaySingleplayerVictory}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  JOGAR NOVAMENTE
                </button>
                {isCustomLevelActive && (
                  <button
                    type="button"
                    onClick={openLevelEditor}
                    className="px-5 py-3 rounded-xl bg-sky-900 hover:bg-sky-800 text-sky-200 border border-sky-400/60 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Hammer className="w-4 h-4 text-sky-400" />
                    EDITOR
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/50 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {!isCheatActive && !isCustomLevelActive && stats.score > 0 ? 'RANKING / NOME' : 'VER RANKING'}
                </button>
                <button
                  type="button"
                  onClick={handleReturnToMainMenu}
                  className="px-5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-600 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  MENU INICIAL
                </button>
              </div>
            </div>
          )}

          {/* Stage Clear & Multiplayer Waiting Banner (kept clean during solo SMW Keyhole transition) */}
          {isStageClear &&
            !isCampaignVictory &&
            !isMultiplayerMatchOver &&
            (!isKeyholeTransition ||
              waitingForPlayersFinish ||
              allPlayersClearedReady ||
              Boolean(stageArrivalNotice)) && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 px-5 py-3 bg-black/92 border-2 border-amber-400 rounded-xl text-center shadow-2xl max-w-[92%]">
              <span className="block font-['Press_Start_2P',monospace] text-amber-400 text-xs sm:text-base">
                FASE CONCLUÍDA!
              </span>
              {stageArrivalNotice && (
                <div className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-400/70 flex items-center justify-center gap-1.5 text-emerald-200 font-mono text-[11px] sm:text-xs font-bold shadow">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{stageArrivalNotice}</span>
                </div>
              )}
              {waitingForPlayersFinish && (
                <div className="mt-2 flex items-center justify-center gap-2 text-amber-200 font-mono text-[11px] sm:text-xs animate-pulse">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>
                    Aguardando {waitingPlayersNames.join(', ')} terminar a fase...
                  </span>
                </div>
              )}
              {(allPlayersClearedReady || (!waitingForPlayersFinish && localStageCleared && multiplayerStatus.connected && multiplayerStatus.playerCount > 1)) && (
                <div className="mt-2 text-amber-300 font-mono text-[11px] sm:text-xs font-bold animate-pulse">
                  Todos terminaram! Avançando juntos para a próxima fase...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Toolbar (Audio, Settings, Fullscreen - for desktop/tablet, hidden during fullscreen) */}
      {!isFullscreen && (
        <div className="hidden sm:flex w-full max-w-4xl px-4 py-2 items-center justify-between text-stone-400 text-xs">
        <div className="flex items-center gap-2">
          {/* Mute SFX button */}
          <button
            type="button"
            onClick={toggleMute}
            title={soundStatus.muted ? 'Desmutar Som' : 'Mutar Som'}
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition"
          >
            {soundStatus.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Toggle Music */}
          <button
            type="button"
            onClick={toggleMusic}
            className={`px-3 py-1.5 rounded-lg border font-mono text-[11px] transition ${
              soundStatus.musicEnabled
                ? 'bg-stone-900 border-amber-600/50 text-amber-300'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
          >
            Música: {soundStatus.musicEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Toggle CRT lines */}
          <button
            type="button"
            onClick={() => setCrtFilter(!crtFilter)}
            className={`hidden sm:inline-block px-3 py-1.5 rounded-lg border font-mono text-[11px] transition ${
              crtFilter
                ? 'bg-stone-900 border-emerald-600/50 text-emerald-300'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
          >
            CRT: {crtFilter ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Restart */}
          <button
            type="button"
            onClick={handleRestart}
            title="Reiniciar jogo (R)"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Placar de Recordes */}
          <button
            type="button"
            onClick={() => setIsLeaderboardOpen(true)}
            title="Placar de Recordes (Hall da Fama)"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-amber-500/40 text-amber-300 hover:text-white transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline text-[11px]">Placar</span>
          </button>

          {/* Conquistas */}
          <button
            type="button"
            onClick={openAchievementsModal}
            title="Conquistas e Recompensas"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-emerald-500/45 text-emerald-300 hover:text-white transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
          >
            <Award className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline text-[11px]">
              Conquistas ({achievementsSummary.unlockedCount}/{achievementsSummary.totalCount})
            </span>
          </button>

          {/* Multiplayer Firebase (Login Google) */}
          <button
            type="button"
            onClick={() => setIsMultiplayerOpen(true)}
            title="Multiplayer Online com Login Google (Firebase)"
            className={`p-2 rounded-lg border text-xs transition flex items-center gap-1.5 cursor-pointer ${
              multiplayerStatus.connected
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                : 'bg-stone-900 hover:bg-stone-800 border-emerald-700/60 text-emerald-400 hover:text-emerald-200'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline text-[11px] font-bold">
              {multiplayerStatus.connected ? `ONLINE (${multiplayerStatus.playerCount})` : 'Multiplayer'}
            </span>
          </button>

          {/* Botão do Desenvolvedor (ativo com cheat, debug ou para restaurar ILLEGAL INSTRUCTION) */}
          {(isCheatActive || isDebugMode || isIllegalInstructionBug) && (
            <button
              type="button"
              onClick={handleDeveloperButtonClick}
              title={isIllegalInstructionBug ? 'Restaurar tela bugada (Botão do Desenvolvedor)' : 'Página do desenvolvedor'}
              className={`p-2 rounded-lg border transition flex items-center gap-1.5 animate-pulse cursor-pointer ${
                isIllegalInstructionBug
                  ? 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400 text-emerald-200'
                  : 'bg-red-950/80 hover:bg-red-900 border-red-500 text-red-300 hover:text-white'
              }`}
            >
              <Flame className={`w-4 h-4 ${isIllegalInstructionBug ? 'text-emerald-400' : 'text-red-400'}`} />
              <span className="hidden sm:inline text-[11px] font-bold">
                {isIllegalInstructionBug ? 'Restaurar (Dev)' : 'Dev'}
              </span>
            </button>
          )}

          {/* Editor de Fases (Memória Temporária) */}
          <button
            type="button"
            disabled={isModeAndEditorLocked}
            onClick={openLevelEditor}
            title={
              isModeAndEditorLocked
                ? 'Editor de Fases bloqueado após iniciar a partida (permitido no Modo Desenvolvedor ou usando o Editor)'
                : 'Editor de Fases (Memória Temporária)'
            }
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-sky-600/50 text-sky-300 hover:text-white disabled:opacity-45 disabled:hover:bg-stone-900 disabled:hover:text-sky-300 disabled:cursor-not-allowed transition flex items-center gap-1.5 cursor-pointer"
          >
            {isModeAndEditorLocked ? (
              <Lock className="w-4 h-4 text-amber-400" />
            ) : (
              <Hammer className="w-4 h-4 text-sky-400" />
            )}
            <span className="hidden sm:inline text-[11px] font-bold">Editor</span>
          </button>

          {/* Correções Recentes com UID */}
          <button
            type="button"
            onClick={() => openUpdatesModal('fixes')}
            title="Correções recentes com UID específica"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-amber-500/45 text-amber-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline text-[11px]">Correções</span>
          </button>

          {/* Novidades / Updates */}
          <button
            type="button"
            onClick={() => openUpdatesModal('all')}
            title="Novidades e atualizações recentes do jogo"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-purple-500/40 text-purple-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <ScrollText className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline text-[11px]">Novidades</span>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Configurações e Fases"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline text-[11px]">Menu</span>
          </button>

          {/* Smart TV Mode Quick Button */}
          <button
            type="button"
            onClick={toggleSmartTvMode}
            title="Modo Smart TV (Controle Remoto)"
            className={`p-2 rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
              smartTvMode
                ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-300 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline text-[11px]">TV</span>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Tela Cheia"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        </div>
      )}

      {/* Smart TV Compact Remote Control Legend Strip */}
      {smartTvMode && !isFullscreen && (
        <div className="w-full max-w-4xl px-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-sky-950/45 border border-sky-700/50 text-[11px] font-mono text-sky-100">
            <span className="flex items-center gap-1.5 font-bold text-sky-300">
              <Tv className="w-3.5 h-3.5 text-sky-400" />
              MODO SMART TV
            </span>
            <span className="text-stone-300">
              <strong className="text-amber-300">◀▶▼</strong> Mover/Cano •{' '}
              <strong className="text-amber-300">OK/Vermelho{smartTvJumpWithUp ? '/▲' : ''}</strong> Pular •{' '}
              <strong className="text-amber-300">Azul/Verde/Ch+/0</strong> Correr/Fogo •{' '}
              <strong className="text-amber-300">Voltar/Play-Pause</strong> Pausar
            </span>
          </div>
        </div>
      )}

      {/* Docked Touch Controls (Shown ONLY during active gameplay; blocked in menus — R1.16.UF.4) */}
      {!smartTvMode &&
        (!isMobileDevice || !touchOverlayOnCanvas) &&
        hasStarted &&
        !isSmwMapOpen &&
        !isPaused &&
        !isGameOver &&
        !isCampaignVictory &&
        !isMultiplayerMatchOver && (
        <TouchControls
          variant="docked"
          controls={controls}
          onControlChange={handleControlChange}
          isPaused={isPaused}
          onTogglePause={togglePauseGame}
          onSelectAction={handleSelectAction}
          reservePowerUp={stats.reservePowerUp ?? null}
          canExitClearedWorldStage={isCurrentSmwStageCleared}
          isMuted={soundStatus.muted}
          onToggleMute={toggleMute}
          onRestart={handleRestart}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          multiplayerConnected={multiplayerStatus.connected}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSelectLevel={handleSelectLevel}
        onRestart={handleRestart}
        isMuted={soundStatus.muted}
        onToggleMute={toggleMute}
        musicEnabled={soundStatus.musicEnabled}
        onToggleMusic={toggleMusic}
        volume={soundStatus.volume}
        onVolumeChange={handleVolumeChange}
        crtFilter={crtFilter}
        onToggleCrt={() => setCrtFilter(!crtFilter)}
        difficulty={difficulty}
        onSelectDifficulty={(diff: GameDifficulty) => {
          setDifficulty(diff);
          if (engineRef.current) {
            engineRef.current.setDifficulty(diff);
            setStats({ ...engineRef.current.stats });
          }
        }}
        resolutionScale={resolutionScale}
        onSelectResolution={(scale: ResolutionScale) => {
          setResolutionScale(scale);
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        touchOverlayOnCanvas={touchOverlayOnCanvas}
        onToggleTouchOverlay={toggleTouchOverlayMode}
        onOpenLevelEditor={openLevelEditor}
        onStartSingleplayer={handleStartSingleplayer}
        onStartSmwWorldMap={handleOpenSmwWorldMap}
        onLoadSmwWorldProgress={handleOpenSmwLoadProgress}
        smwSavedSlotsCount={smwSaveSlots.filter(Boolean).length}
        isDebugMode={isDebugMode}
        onToggleDebugMode={handleToggleDebugMode}
        smartTvMode={smartTvMode}
        onToggleSmartTvMode={toggleSmartTvMode}
        smartTvJumpWithUp={smartTvJumpWithUp}
        onToggleSmartTvJumpWithUp={toggleSmartTvJumpWithUp}
        smartTvAutoRun={smartTvAutoRun}
        onToggleSmartTvAutoRun={toggleSmartTvAutoRun}
        isModeAndEditorLocked={isModeAndEditorLocked}
      />

      {/* Leaderboard / Placar Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentScore={stats.score}
        currentCoins={stats.coins}
        currentWorld={stats.world}
        currentRunId={engineRef.current?.currentRunId}
        currentCharacter={engineRef.current?.playerCharacter || 'mario'}
        currentDifficulty={difficulty}
        isCheatActive={isCheatActive}
        isCustomLevel={isCustomLevelActive}
        onScoresCleared={() => {
          engineRef.current?.resetLocalHighScore();
          setLastSavedRank(null);
          setStats(prev => ({ ...prev, highScore: 0, isNewHighScore: false }));
        }}
        onScoreSaved={(rank) => {
          if (engineRef.current) {
            engineRef.current.lastSavedRank = rank;
          }
          setLastSavedRank(rank);
          setStats(prev => ({
            ...prev,
            highScore: getTopScore(),
          }));
        }}
      />

      {/* Cheat Menu Modal ("lula132026") */}
      <CheatMenuModal
        isOpen={isCheatMenuOpen}
        onClose={() => setIsCheatMenuOpen(false)}
        infiniteLives={engineRef.current?.infiniteLives || false}
        isFemboy={marioPower === 'femboy'}
        isDebugMode={isDebugMode}
        isDebugPlacementActive={isDebugPlacementActive}
        switchStates={{
          yellow: smwProgress.yellowSwitchUnlocked,
          green: Boolean(smwProgress.greenSwitchUnlocked),
          red: Boolean(smwProgress.redSwitchUnlocked),
          pink: Boolean(smwProgress.pinkSwitchUnlocked),
          blue: Boolean(smwProgress.blueSwitchUnlocked),
        }}
        onToggleInfiniteLives={() => {
          engineRef.current?.toggleInfiniteLives();
          setStats({ ...engineRef.current!.stats });
        }}
        onToggleDebugMode={handleToggleDebugMode}
        onToggleDebugPlacement={handleToggleDebugPlacement}
        onSetPowerUp={(power: MarioPower | 'star') => {
          engineRef.current?.setPowerUp(power);
          if (engineRef.current) {
            setMarioPower(engineRef.current.marioPower);
          }
        }}
        onAddScore={(pts: number) => {
          engineRef.current?.addCheatScore(pts);
          setStats({ ...engineRef.current!.stats });
        }}
        onTeleportToEnd={() => {
          engineRef.current?.teleportToStageEnd();
          if (engineRef.current) {
            setStats({ ...engineRef.current.stats });
          }
        }}
        onWarpToSpecificStage={handleWarpToSpecificStage}
      />

      {/* Multiplayer por IP Modal (WazzimaGiygg / Mario) */}
      <MultiplayerModal
        isOpen={isMultiplayerOpen}
        onClose={() => setIsMultiplayerOpen(false)}
      />

      {/* Editor de Fases Modal (Memória Temporária do Navegador) */}
      <LevelEditorModal
        isOpen={isLevelEditorOpen}
        onClose={() => setIsLevelEditorOpen(false)}
        customLevels={customLevels}
        activeCustomLevelId={activeCustomLevelId}
        onUpdateCustomLevels={(levels, activeId) => {
          setCustomLevels(levels);
          setActiveCustomLevelId(activeId);
        }}
        onPlayLevel={handlePlayCustomLevel}
        customCampaignIds={customCampaignIds}
        onUpdateCustomCampaignIds={setCustomCampaignIds}
        onPlayCampaign={handlePlayCustomCampaign}
        onBackToMainMenu={handleReturnToMainMenu}
        editorImmortality={editorImmortality}
        onToggleEditorImmortality={enabled => {
          setEditorImmortality(enabled);
          if (engineRef.current?.level?.isCustom) {
            engineRef.current.setEditorImmortality(enabled);
          }
        }}
      />

      {/* Updates / Correções Recentes Modal */}
      <UpdatesModal
        isOpen={isUpdatesOpen}
        initialFilter={updatesFilter}
        onClose={() => setIsUpdatesOpen(false)}
      />

      {/* Achievements Modal */}
      <AchievementsModal
        isOpen={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
        achievements={achievements}
        summary={achievementsSummary}
        onResetAchievements={() => {
          if (engineRef.current) {
            const next = engineRef.current.resetAchievements();
            setAchievements(next);
            setAchievementsSummary(engineRef.current.getAchievementSummary());
          }
        }}
      />

      {/* Achievement Unlock Toast Notification */}
      {achievementToast && (
        <div
          role="status"
          className="fixed top-14 right-4 z-50 px-4 py-3 rounded-xl bg-stone-900/95 border-2 border-emerald-400 text-stone-100 shadow-2xl flex items-center gap-3 max-w-xs sm:max-w-sm animate-in fade-in slide-in-from-top-2"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-amber-300" />
          </div>
          <div className="min-w-0 text-left">
            <div className="font-['Press_Start_2P',monospace] text-[9px] text-emerald-300">
              CONQUISTA DESBLOQUEADA!
            </div>
            <div className="mt-1 text-xs font-bold text-white truncate">
              {achievementToast.achievement.title}
            </div>
            <div className="text-[11px] font-mono text-amber-300 tabular-nums">
              +{achievementToast.rewardPoints.toLocaleString()} PTS
              {achievementToast.rewardLives > 0
                ? ` · +${achievementToast.rewardLives} ${achievementToast.rewardLives === 1 ? 'Vida' : 'Vidas'}`
                : ''}
            </div>
          </div>
        </div>
      )}

      {/* Multiplayer Logoff / Room Inactivity Toast Notification */}
      {multiplayerNotice && (
        <div
          className={`fixed top-14 z-50 px-4 py-2.5 rounded-xl border-2 font-mono text-xs shadow-2xl flex items-center gap-2 max-w-[92vw] ${
            multiplayerNotice.type === 'room_inactive'
              ? 'bg-amber-950/95 border-amber-400 text-amber-200'
              : 'bg-rose-950/95 border-rose-500 text-rose-100'
          }`}
        >
          {multiplayerNotice.type === 'room_inactive' ? (
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{multiplayerNotice.message}</span>
        </div>
      )}

      {/* Cheat Toast Notification */}
      {cheatToast && (
        <div className="fixed top-24 z-50 px-5 py-3 rounded-xl bg-red-950 border-2 border-red-500 text-amber-300 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs shadow-2xl animate-bounce flex items-center gap-2">
          <Flame className="w-4 h-4 text-red-500 fill-red-500" />
          <span>{cheatToast}</span>
        </div>
      )}

      {/* YouTube-Style WazzimaGiygg Ecosystem Pre-Roll Commercial (15s Skip Guard) */}
      <WazzimaCommercialOverlay
        isOpen={isCommercialOpen}
        commercial={activeCommercial}
        onSkipCommercial={() => {
          const sound = SoundEngine.get();
          sound.setCommercialSuspended(false);
          sound.resume();
          setSoundStatus(sound.getStatus());
          setIsCommercialOpen(false);
        }}
      />
    </div>
  );
};
