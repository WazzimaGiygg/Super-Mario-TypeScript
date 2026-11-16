/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Enemy, EnemyType, LevelData, TileType } from './types.ts';

export interface SpawnDifficultyProfile {
  stage: number;
  cycleNumber: number;
  theme: LevelData['theme'];
  speedMultiplier: number;
  baseSpawnChance: number;
  clusterChance: number;
  piranhaChance: number;
  dynamicIntervalFrames: number;
  maxDynamicActive: number;
  unlockedTypes: EnemyType[];
}

export interface DynamicSpawnContext {
  level: LevelData;
  cameraX: number;
  nesWidth: number;
  tileSize: number;
  marioX: number;
  marioY: number;
  enemies: Enemy[];
  isSolidTile: (type: TileType) => boolean;
  nextId: () => number;
}

export class EnemySpawnManager {
  private spawnTimer: number = 0;
  private waveCount: number = 0;
  private stage: number = 0;
  private theme: LevelData['theme'] = 'overworld';

  public reset(stage: number = 0, theme: LevelData['theme'] = 'overworld') {
    this.stage = Math.max(0, Math.floor(stage));
    this.theme = theme;
    this.spawnTimer = 0;
    this.waveCount = 0;
  }

  public getProfile(): SpawnDifficultyProfile {
    return EnemySpawnManager.getProfile(Math.max(1, this.stage || 1), this.theme);
  }

  public static getCycleNumber(stage: number): number {
    const safeStage = Math.max(1, Math.floor(stage));
    return Math.floor((safeStage - 1) / 4) + 1;
  }

  public static getProfile(stage: number, theme: LevelData['theme']): SpawnDifficultyProfile {
    const safeStage = Math.max(1, Math.floor(stage));
    const cycleNumber = EnemySpawnManager.getCycleNumber(safeStage);
    const diffRatio = Math.min(1, (safeStage - 1) / 14);

    // Speed ramps up steadily with both stage and cycle
    const speedMultiplier = Number((1 + Math.min(1.25, (safeStage - 1) * 0.085 + (cycleNumber - 1) * 0.04)).toFixed(2));

    // Spawn density & pack frequency grow each cycle
    const baseSpawnChance = Math.min(0.97, 0.58 + (cycleNumber - 1) * 0.11 + diffRatio * 0.12);
    const clusterChance = Math.min(0.82, 0.22 + (cycleNumber - 1) * 0.16 + diffRatio * 0.18);
    const piranhaChance = Math.min(0.95, 0.35 + (cycleNumber - 1) * 0.16 + diffRatio * 0.25);

    // Runtime dynamic spawn frequency increases (shorter cooldown frames as cycle increases)
    // Cycle 1: ~360-300 frames (5-6s), Cycle 2: ~240 frames (4s), Cycle 3: ~165 frames (2.75s), Cycle 4+: ~110 frames (~1.8s)
    const dynamicIntervalFrames = Math.max(
      105,
      Math.round(375 - (cycleNumber - 1) * 78 - ((safeStage - 1) % 4) * 14)
    );

    const maxDynamicActive = Math.min(12, 4 + cycleNumber * 2);

    // Progressive enemy roster: faster types unlock as the cycle advances
    const unlockedTypes: EnemyType[] = [];
    if (theme === 'underwater') {
      unlockedTypes.push('cheep_cheep', 'blooper');
      if (cycleNumber >= 2 || safeStage >= 3) {
        unlockedTypes.push('fast_cheep');
      }
    } else if (theme === 'ghost_house') {
      unlockedTypes.push('boo', 'dry_bones');
    } else {
      unlockedTypes.push('goomba', 'koopa', 'paratroopa');
      if (cycleNumber >= 2 || safeStage >= 3) {
        unlockedTypes.push('red_koopa');
      }
      if (cycleNumber >= 2 || safeStage >= 2 || theme === 'castle') {
        unlockedTypes.push('hammer_bro');
      }
      if (cycleNumber >= 3 || (cycleNumber >= 2 && theme === 'castle')) {
        unlockedTypes.push('bullet_bill');
      }
    }

    return {
      stage: safeStage,
      cycleNumber,
      theme,
      speedMultiplier,
      baseSpawnChance,
      clusterChance,
      piranhaChance,
      dynamicIntervalFrames,
      maxDynamicActive,
      unlockedTypes,
    };
  }

  public static getInitialVelocity(type: EnemyType, speedMult: number, direction: -1 | 1 = -1): number {
    let baseSpeed = 0.7;
    switch (type) {
      case 'goomba':
        baseSpeed = 0.72;
        break;
      case 'koopa':
        baseSpeed = 0.78;
        break;
      case 'red_koopa':
        baseSpeed = 1.28;
        break;
      case 'paratroopa':
        baseSpeed = 1.18;
        break;
      case 'hammer_bro':
        baseSpeed = 0.52;
        break;
      case 'cheep_cheep':
        baseSpeed = 0.82;
        break;
      case 'fast_cheep':
        baseSpeed = 1.52;
        break;
      case 'blooper':
        baseSpeed = 0.85;
        break;
      case 'bullet_bill':
        baseSpeed = 2.2;
        break;
      case 'bowser':
        baseSpeed = 0.45;
        break;
      case 'boo':
        baseSpeed = 0.78;
        break;
      case 'dry_bones':
        baseSpeed = 0.75;
        break;
      default:
        baseSpeed = 0.7;
        break;
    }
    return Number((direction * baseSpeed * speedMult).toFixed(3));
  }

  public static pickEnemyType(
    stage: number,
    theme: LevelData['theme'],
    rand: () => number,
    options: { allowAerial?: boolean; forDynamicWave?: boolean } = {}
  ): EnemyType {
    const profile = EnemySpawnManager.getProfile(stage, theme);
    const { cycleNumber } = profile;
    const allowAerial = options.allowAerial ?? true;
    const forDynamic = options.forDynamicWave ?? false;

    if (theme === 'underwater') {
      const r = rand();
      const fastCheepWeight = cycleNumber >= 2 ? Math.min(0.48, 0.18 + (cycleNumber - 2) * 0.14) : stage >= 3 ? 0.14 : 0;
      const blooperWeight = Math.min(0.38, 0.25 + (cycleNumber - 1) * 0.04);
      if (r < fastCheepWeight) return 'fast_cheep';
      if (r < fastCheepWeight + blooperWeight) return 'blooper';
      return 'cheep_cheep';
    }

    if (theme === 'ghost_house') {
      return allowAerial && rand() < 0.55 ? 'boo' : 'dry_bones';
    }

    const r = rand();
    // Bullet Bill: fast horizontal threat unlocked in Cycle 3+ (and Cycle 2 Castle)
    const bulletChance =
      allowAerial && profile.unlockedTypes.includes('bullet_bill')
        ? (forDynamic ? Math.min(0.34, 0.18 + (cycleNumber - 2) * 0.06) : Math.min(0.22, 0.10 + (cycleNumber - 2) * 0.04))
        : 0;

    // Paratroopa: winged bouncing Koopa
    const paratroopaChance =
      allowAerial && profile.unlockedTypes.includes('paratroopa')
        ? Math.min(0.28, 0.14 + (cycleNumber - 1) * 0.05)
        : 0;

    // Hammer Brother: hammer-throwing Koopa elite
    const hammerBroChance = profile.unlockedTypes.includes('hammer_bro')
      ? Math.min(0.22, 0.12 + (cycleNumber - 1) * 0.04)
      : 0;

    // Red Koopa: fast ground runner unlocked from Stage 3+ / Cycle 2+
    const redKoopaChance = profile.unlockedTypes.includes('red_koopa')
      ? Math.min(0.30, 0.15 + (cycleNumber - 1) * 0.06)
      : 0;

    // Classic Green Koopa
    const koopaChance = Math.max(0.14, 0.25 - (cycleNumber - 1) * 0.03);

    if (r < bulletChance) return 'bullet_bill';
    if (r < bulletChance + paratroopaChance) return 'paratroopa';
    if (r < bulletChance + paratroopaChance + hammerBroChance) return 'hammer_bro';
    if (r < bulletChance + paratroopaChance + hammerBroChance + redKoopaChance) return 'red_koopa';
    if (r < bulletChance + paratroopaChance + hammerBroChance + redKoopaChance + koopaChance) return 'koopa';
    return 'goomba';
  }

  public static createSpawnSpec(
    type: EnemyType,
    tx: number,
    tyTile: number,
    rand: () => number = Math.random
  ): { type: EnemyType; x: number; y: number } {
    if (type === 'cheep_cheep' || type === 'fast_cheep' || type === 'blooper') {
      const swimY = (4 + Math.floor(rand() * 7)) * 16;
      return {
        type,
        x: tx * 16,
        y: Math.min(swimY, (tyTile - 1) * 16),
      };
    }

    if (type === 'bullet_bill') {
      const flightRow = Math.max(4, Math.min(11, tyTile - 2 - Math.floor(rand() * 3)));
      return {
        type,
        x: tx * 16,
        y: flightRow * 16,
      };
    }

    if (type === 'boo') {
      const floatRow = Math.max(3, Math.min(9, tyTile - 3 - Math.floor(rand() * 4)));
      return {
        type,
        x: tx * 16,
        y: floatRow * 16,
      };
    }

    if (
      type === 'koopa' ||
      type === 'red_koopa' ||
      type === 'paratroopa' ||
      type === 'hammer_bro' ||
      type === 'dry_bones'
    ) {
      return {
        type,
        x: tx * 16,
        y: type === 'paratroopa' ? (tyTile - 2) * 16 : (tyTile - 1) * 16 + 8,
      };
    }

    return {
      type,
      x: tx * 16,
      y: tyTile * 16,
    };
  }

  /**
   * Generates static enemy placements for a procedural endless chunk based on the current level cycle.
   */
  public static generateChunkSpawns(
    stage: number,
    theme: LevelData['theme'],
    rand: () => number,
    txOptions: number[],
    tyTile: number
  ): { type: EnemyType; x: number; y: number }[] {
    const profile = EnemySpawnManager.getProfile(stage, theme);
    if (rand() >= profile.baseSpawnChance || txOptions.length === 0) {
      return [];
    }

    const spawned: { type: EnemyType; x: number; y: number }[] = [];
    const primaryType = EnemySpawnManager.pickEnemyType(stage, theme, rand, { allowAerial: true });
    spawned.push(EnemySpawnManager.createSpawnSpec(primaryType, txOptions[0], tyTile, rand));

    // Additional cluster enemies as cycles progress
    if (txOptions.length >= 2 && rand() < profile.clusterChance) {
      const secondType = EnemySpawnManager.pickEnemyType(stage, theme, rand, { allowAerial: true });
      spawned.push(EnemySpawnManager.createSpawnSpec(secondType, txOptions[1], tyTile, rand));
    }

    if (txOptions.length >= 3 && profile.cycleNumber >= 2 && rand() < profile.clusterChance * 0.65) {
      const thirdType = EnemySpawnManager.pickEnemyType(stage, theme, rand, { allowAerial: true });
      spawned.push(EnemySpawnManager.createSpawnSpec(thirdType, txOptions[2], tyTile, rand));
    }

    return spawned;
  }

  /**
   * Runtime dynamic wave spawner: feeds faster enemy waves from just beyond the right edge
   * of the camera as the endless cycle advances.
   */
  public update(ctx: DynamicSpawnContext): Enemy[] {
    const { level, cameraX, nesWidth, tileSize, marioX, marioY, enemies, isSolidTile, nextId } = ctx;

    // Only run dynamic reinforcement waves in endless stages and outside boss/finish zones
    if (!level.endlessStage || level.endlessStage < 1 || level.id === 'secret-vault') {
      return [];
    }

    this.stage = level.endlessStage;
    this.theme = level.theme;
    const profile = this.getProfile();

    const spawnX = cameraX + nesWidth + 12;
    const finishCutoffX =
      level.theme === 'castle'
        ? (level.width - 34) * tileSize
        : (level.dryFinishStartX ?? level.flagX) - 96;

    if (spawnX >= finishCutoffX) {
      return [];
    }

    this.spawnTimer++;
    if (this.spawnTimer < profile.dynamicIntervalFrames) {
      return [];
    }
    this.spawnTimer = 0;

    // Cap nearby active enemies so the screen stays challenging but fair
    const activeNearScreen = enemies.filter(
      e => e.alive && e.x >= cameraX - 32 && e.x <= cameraX + nesWidth + 48
    ).length;
    if (activeNearScreen >= profile.maxDynamicActive) {
      return [];
    }

    this.waveCount++;
    const rand = Math.random;
    const spawned: Enemy[] = [];
    const waveSize =
      profile.cycleNumber >= 3 && rand() < profile.clusterChance * 0.65
        ? 2
        : 1;

    for (let i = 0; i < waveSize; i++) {
      if (activeNearScreen + spawned.length >= profile.maxDynamicActive) break;

      const candidateX = spawnX + i * 24;
      if (candidateX >= finishCutoffX) break;

      const type = EnemySpawnManager.pickEnemyType(this.stage, this.theme, rand, {
        allowAerial: true,
        forDynamicWave: true,
      });

      const enemy = this.tryBuildDynamicEnemy(type, candidateX, level, tileSize, marioY, profile.speedMultiplier, isSolidTile, nextId);
      if (enemy && Math.abs(enemy.x - marioX) > 72) {
        spawned.push(enemy);
      }
    }

    return spawned;
  }

  private tryBuildDynamicEnemy(
    type: EnemyType,
    spawnX: number,
    level: LevelData,
    tileSize: number,
    marioY: number,
    speedMult: number,
    isSolidTile: DynamicSpawnContext['isSolidTile'],
    nextId: () => number
  ): Enemy | null {
    const tx = Math.floor(spawnX / tileSize);
    if (tx < 2 || tx >= level.width - 4) return null;

    const width = 16;
    const height =
      type === 'koopa' ||
      type === 'red_koopa' ||
      type === 'paratroopa' ||
      type === 'hammer_bro' ||
      type === 'dry_bones'
        ? 24
        : 16;
    const vx = EnemySpawnManager.getInitialVelocity(type, speedMult, -1);

    if (type === 'cheep_cheep' || type === 'fast_cheep' || type === 'blooper') {
      const minY = 48;
      const maxY = 10 * tileSize;
      const clampedMarioY = Math.max(minY, Math.min(maxY, marioY));
      const offsetY = (Math.random() - 0.5) * 48;
      const y = Math.max(minY, Math.min(maxY, Math.round(clampedMarioY + offsetY)));
      return {
        id: nextId(),
        type,
        x: spawnX,
        y,
        vx,
        vy: 0,
        width,
        height,
        alive: true,
        state: 'walk',
        stateTimer: Math.floor(Math.random() * 40),
        facing: 'left',
        animFrame: 0,
        animTimer: 0,
      };
    }

    if (type === 'bullet_bill' || type === 'boo') {
      const targetY = Math.max(56, Math.min(11 * tileSize, Math.round(marioY - 4 + (Math.random() - 0.5) * 28)));
      return {
        id: nextId(),
        type,
        x: spawnX,
        y: targetY,
        vx,
        vy: 0,
        width,
        height,
        alive: true,
        state: 'walk',
        stateTimer: 0,
        facing: 'left',
        animFrame: 0,
        animTimer: 0,
      };
    }

    // Ground & hopping enemies must find a solid surface without spawning inside solid blocks
    let surfaceRow = -1;
    for (let ty = 3; ty < level.height; ty++) {
      const tile = level.tiles[ty]?.[tx];
      const above1 = level.tiles[ty - 1]?.[tx];
      const above2 = level.tiles[ty - 2]?.[tx];
      if (
        tile &&
        isSolidTile(tile.type) &&
        (!above1 || !isSolidTile(above1.type)) &&
        (!above2 || !isSolidTile(above2.type))
      ) {
        surfaceRow = ty;
        break;
      }
    }

    if (surfaceRow === -1) {
      // Fallback: if over a pit/lava in Cycle 2+, spawn a paratroopa/bullet_bill instead of dropping a walker in void
      return null;
    }

    const spawnY =
      type === 'paratroopa'
        ? Math.max(48, surfaceRow * tileSize - height - 18)
        : surfaceRow * tileSize - height;

    return {
      id: nextId(),
      type,
      x: spawnX,
      y: spawnY,
      vx,
      vy: type === 'paratroopa' ? -2.8 : 0,
      width,
      height,
      alive: true,
      state: 'walk',
      stateTimer: 0,
      facing: 'left',
      animFrame: 0,
      animTimer: 0,
      originX: spawnX,
      fireTimer: type === 'hammer_bro' ? 42 : undefined,
    };
  }
}
