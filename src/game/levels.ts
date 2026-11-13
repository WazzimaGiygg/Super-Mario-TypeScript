/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelData, BlockTile, TileType, Point, EnemyType } from './types.ts';

// Helper to create empty grid
function createEmptyGrid(width: number, height: number): (BlockTile | null)[][] {
  const grid: (BlockTile | null)[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = null;
    }
  }
  return grid;
}

// Helper to build standard pipe
function placePipe(
  grid: (BlockTile | null)[][],
  x: number,
  bottomY: number,
  height: number,
  isWarp = false
) {
  const topY = bottomY - height + 1;
  // Pipe Head (Top Lip)
  grid[topY][x] = {
    type: isWarp ? 'pipe_warp_top_left' : 'pipe_top_left',
    content: 'none',
    bumpOffset: 0,
    bumpVel: 0,
  };
  grid[topY][x + 1] = {
    type: isWarp ? 'pipe_warp_top_right' : 'pipe_top_right',
    content: 'none',
    bumpOffset: 0,
    bumpVel: 0,
  };

  // Pipe Body
  for (let y = topY + 1; y <= bottomY; y++) {
    grid[y][x] = {
      type: 'pipe_body_left',
      content: 'none',
      bumpOffset: 0,
      bumpVel: 0,
    };
    grid[y][x + 1] = {
      type: 'pipe_body_right',
      content: 'none',
      bumpOffset: 0,
      bumpVel: 0,
    };
  }
}

// Build World 1-1 (Authentic NES reproduction)
export function createWorld1_1(): LevelData {
  const width = 214;
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];

  // 1. Ground tiles (y = 13 and 14) with pits at standard NES locations
  const pits = [
    [69, 70],
    [86, 88],
    [153, 154],
  ];

  for (let x = 0; x < width; x++) {
    const isPit = pits.some(([pStart, pEnd]) => x >= pStart && x <= pEnd);
    if (!isPit) {
      grid[13][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // 2. Initial Blocks & Questions
  // Tile 16: ? (Coin)
  grid[9][16] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };

  // Tile 20-24: [Brick] [? (Mushroom)] [Brick] [? (Coin)] [Brick]
  grid[9][20] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][21] = { type: 'question', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };
  grid[9][22] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][23] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  grid[9][24] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Higher ? block at tile 22
  grid[5][22] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };

  // Goomba 1
  enemies.push({ type: 'goomba', x: 22 * 16, y: 12 * 16 });

  // 3. Pipes
  // Tile 28: 2-tile high pipe
  placePipe(grid, 28, 12, 2);

  // Tile 38: 3-tile high pipe
  placePipe(grid, 38, 12, 3);
  enemies.push({ type: 'goomba', x: 40 * 16, y: 12 * 16 });

  // Tile 46: 4-tile high pipe with Piranha plant
  placePipe(grid, 46, 12, 4);
  enemies.push({ type: 'piranha', x: 46 * 16 + 8, y: (12 - 4 + 1) * 16 });

  // Goomba pair
  enemies.push({ type: 'goomba', x: 51 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 53 * 16, y: 12 * 16 });

  // Tile 57: Warp Pipe to secret underground coin vault!
  placePipe(grid, 57, 12, 4, true);

  // Hidden 1-UP Block (at tile 64, y=8 - authentic NES secret)
  grid[8][64] = { type: 'brick', content: '1up', bumpOffset: 0, bumpVel: 0, invisible: true };

  // 4. Area after first pit (Pit at 69-70)
  // Tile 77: [Brick] [? (mushroom/flower)] [Brick]
  grid[9][77] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][78] = { type: 'question', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };
  grid[9][79] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // High brick platform (Tile 80-87, y=5)
  for (let bx = 80; bx <= 87; bx++) {
    grid[5][bx] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Goombas patrolling under platform
  enemies.push({ type: 'goomba', x: 82 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 84 * 16, y: 12 * 16 });

  // Authentic NES Hidden Coin Block in mid-air gap (Tile 89, y=5)
  grid[5][89] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };

  // Area after second pit (Pit at 86-88)
  // Tile 91-94: Brick row with 10-coin multi-hit block!
  grid[9][91] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][92] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][93] = { type: 'brick', content: 'coin', bumpOffset: 0, bumpVel: 0, coinsLeft: 5 };
  grid[9][94] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Starman question block at tile 101, y=9
  grid[9][100] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][101] = { type: 'question', content: 'star', bumpOffset: 0, bumpVel: 0 };
  grid[9][102] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Koopa Troopa patrolling at tile 107
  enemies.push({ type: 'koopa', x: 107 * 16, y: 11 * 16 });

  // Question blocks at tile 109 & 112
  grid[9][109] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  grid[9][112] = { type: 'question', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };
  grid[5][112] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };

  // Goombas at tile 115
  enemies.push({ type: 'goomba', x: 115 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 117 * 16, y: 12 * 16 });

  // 5. First Staircase (Tile 124-128 up, 130-134 down)
  // Up steps:
  for (let s = 1; s <= 4; s++) {
    const sx = 123 + s;
    for (let sy = 13 - s; sy <= 12; sy++) {
      grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  // Down steps:
  for (let s = 4; s >= 1; s--) {
    const sx = 128 + (4 - s + 1);
    for (let sy = 13 - s; sy <= 12; sy++) {
      grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // 6. Second Staircase with Pit (Tile 138-142 up, Pit at 143-144, 145-148 down)
  for (let s = 1; s <= 4; s++) {
    const sx = 137 + s;
    for (let sy = 13 - s; sy <= 12; sy++) {
      grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  for (let s = 4; s >= 1; s--) {
    const sx = 144 + (4 - s + 1);
    for (let sy = 13 - s; sy <= 12; sy++) {
      grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // 7. Pipe exit from underground (Tile 163)
  placePipe(grid, 163, 12, 2);

  // Brick platforms with Goombas
  grid[9][168] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][169] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][170] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  grid[9][171] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  enemies.push({ type: 'goomba', x: 174 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 176 * 16, y: 12 * 16 });

  // Koopa at 178
  enemies.push({ type: 'koopa', x: 178 * 16, y: 11 * 16 });

  // Authentic NES Hidden Coin Block before the final staircase (Tile 179, y=9)
  grid[9][179] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };

  // 8. Grand Final Staircase (Tile 181-188) leading to Flagpole
  for (let s = 1; s <= 8; s++) {
    const sx = 180 + s;
    for (let sy = 13 - s; sy <= 12; sy++) {
      grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // Single landing block at 189
  grid[12][189] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // 9. Flagpole at tile 198 (base at y=12, top at y=2)
  grid[12][198] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  for (let y = 3; y <= 11; y++) {
    grid[y][198] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  grid[2][198] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // 10. Castle at tiles 202 - 208
  for (let cx = 202; cx <= 207; cx++) {
    for (let cy = 8; cy <= 12; cy++) {
      grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    // Crenels on top
    if (cx % 2 === 0) {
      grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  // Castle door
  grid[11][204] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][204] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };

  return {
    id: 'world-1-1',
    name: 'WORLD 1-1',
    theme: 'overworld',
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    marioStart: { x: 40, y: 192 },
    flagX: 198 * 16,
    castleX: 204 * 16,
    bgColor: '#5c94fc',
    timeLimit: 400,
    checkpoints: [
      {
        x: 100 * 16, // Halfway checkpoint at tile 100 (after 2nd pit)
        respawnPos: { x: 102 * 16, y: 192 },
      },
    ],
    pipeWarps: [
      {
        from: { x: 57 * 16, y: 8 * 16, width: 32, height: 16 },
        toLevel: 'secret-vault',
        toPos: { x: 32, y: 64 },
        type: 'down',
      },
    ],
  };
}

// Build World 1-1 Secret Underground Coin Vault
export function createSecretVault(): LevelData {
  const width = 24;
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const coins: Point[] = [];

  // Underground ceiling & floor
  for (let x = 0; x < width; x++) {
    grid[0][x] = { type: 'underground_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[1][x] = { type: 'underground_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[13][x] = { type: 'underground_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][x] = { type: 'underground_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Left wall
  for (let y = 0; y < 13; y++) {
    grid[y][0] = { type: 'underground_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Coin field (3 rows of coins)
  for (let cx = 5; cx <= 16; cx++) {
    coins.push({ x: cx * 16 + 8, y: 7 * 16 });
    coins.push({ x: cx * 16 + 8, y: 9 * 16 });
    coins.push({ x: cx * 16 + 8, y: 11 * 16 });
  }

  // Hidden 1-UP Block in Secret Vault (Tile 3, y=8)
  grid[8][3] = { type: 'brick', content: '1up', bumpOffset: 0, bumpVel: 0, invisible: true };

  // Exit pipe at right
  placePipe(grid, 20, 12, 4);

  return {
    id: 'secret-vault',
    name: 'SECRET VAULT',
    theme: 'underground',
    width,
    height,
    tiles: grid,
    enemies: [],
    coins,
    marioStart: { x: 32, y: 64 },
    flagX: -9999, // FIX: No flagpole in secret vault!
    castleX: -9999, // FIX: No castle in secret vault!
    bgColor: '#000000',
    timeLimit: 400,
    pipeWarps: [
      {
        from: { x: 20 * 16 - 4, y: 7 * 16, width: 36, height: 24 },
        toLevel: 'world-1-1',
        toPos: { x: 163 * 16 + 8, y: 11 * 16 - 16 },
        type: 'down',
      },
      {
        from: { x: 20 * 16 - 8, y: 8 * 16, width: 24, height: 64 },
        toLevel: 'world-1-1',
        toPos: { x: 163 * 16 + 8, y: 11 * 16 - 16 },
        type: 'right',
      },
    ],
  };
}

// Build World 1-2 Underground Level
export function createWorld1_2(): LevelData {
  const width = 180;
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];

  // Blue brick ceiling & floor for underground portion (tiles 0-144)
  for (let x = 0; x < 145; x++) {
    grid[0][x] = { type: 'underground_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[1][x] = { type: 'underground_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    if (x < 70 || x > 74) {
      grid[13][x] = { type: 'underground_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: 'underground_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // Outdoor surface ground (tiles 145-180) - opens to sky
  for (let x = 145; x < width; x++) {
    grid[13][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Initial drop pipe
  placePipe(grid, 2, 12, 10);

  // Hidden 1-UP Block near the entrance (Tile 10, y=9)
  grid[9][10] = { type: 'brick', content: '1up', bumpOffset: 0, bumpVel: 0, invisible: true };

  // Enemies and platforms
  enemies.push({ type: 'goomba', x: 20 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 24 * 16, y: 12 * 16 });
  enemies.push({ type: 'koopa', x: 36 * 16, y: 11 * 16 });

  // Hidden Coin Block in upper platform gap (Tile 44, y=5)
  grid[5][44] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };

  // Brick platforms with coins
  for (let bx = 18; bx <= 28; bx++) {
    grid[8][bx] = { type: 'underground_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  grid[8][23] = { type: 'question', content: 'mushroom', bumpOffset: 0, bumpVel: 0 };

  // Hidden Starman Block at tile 85, y=9
  grid[9][85] = { type: 'question', content: 'star', bumpOffset: 0, bumpVel: 0, invisible: true };

  // Underground exit pipe (Tile 145, 4 tiles high)
  placePipe(grid, 145, 12, 4);

  // Surface emergence pipe (Tile 154, 2 tiles high)
  placePipe(grid, 154, 12, 2);

  // Outdoor surface staircase leading to Flagpole (Tiles 160-167)
  for (let s = 1; s <= 8; s++) {
    const sx = 159 + s;
    for (let sy = 13 - s; sy <= 12; sy++) {
      grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // Landing block at tile 168
  grid[12][168] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Flagpole at tile 171
  grid[12][171] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  for (let y = 3; y <= 11; y++) {
    grid[y][171] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  grid[2][171] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Castle at tiles 174-179
  for (let cx = 174; cx <= 179; cx++) {
    for (let cy = 8; cy <= 12; cy++) {
      grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    if (cx % 2 === 0) {
      grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  grid[11][176] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][176] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };

  return {
    id: 'world-1-2',
    name: 'WORLD 1-2',
    theme: 'underground',
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    marioStart: { x: 64, y: 192 },
    flagX: 171 * 16,
    castleX: 176 * 16,
    bgColor: '#000000',
    timeLimit: 400,
    checkpoints: [
      {
        x: 75 * 16,
        respawnPos: { x: 75 * 16, y: 192 },
      },
    ],
    pipeWarps: [
      {
        from: { x: 145 * 16 - 4, y: 7 * 16, width: 36, height: 24 },
        toLevel: 'world-1-2',
        toPos: { x: 154 * 16 + 8, y: 11 * 16 - 16 },
        type: 'down',
      },
    ],
  };
}

// Procedural Endless Level Generator with Progressive Difficulty & Random Biomes
export function createEndlessLevel(
  seed: number = Date.now(),
  endlessStage: number = 1
): LevelData {
  const stage = Math.max(1, Math.floor(endlessStage));
  const normalizedSeed = Math.abs(Math.floor(seed)) % 10000000;
  const diffRatio = Math.min(1, (stage - 1) / 8); // Scales smoothly from 0.0 (stage 1) to 1.0 (stage 9+)

  // Deterministic PRNG (Mulberry32-style mixed with seed + stage)
  let s = (normalizedSeed + stage * 7919) >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Pick random world theme (Stage 1 can be overworld/underground; Stage 2+ rotates freely among all 3 biomes)
  const themeRoll = rand();
  const theme: 'overworld' | 'underground' | 'castle' =
    stage === 1
      ? themeRoll > 0.3 ? 'overworld' : 'underground'
      : themeRoll < 0.42
      ? 'overworld'
      : themeRoll < 0.74
      ? 'underground'
      : 'castle';

  const bgColor =
    theme === 'overworld'
      ? '#5c94fc'
      : theme === 'underground'
      ? '#000000'
      : '#1c0a0d';

  const groundTileType: TileType =
    theme === 'underground'
      ? 'underground_ground'
      : theme === 'castle'
      ? 'castle_brick'
      : 'ground';

  const brickTileType: TileType =
    theme === 'underground'
      ? 'underground_brick'
      : theme === 'castle'
      ? 'hard_block'
      : 'brick';

  const width = Math.min(340, 210 + (stage - 1) * 14);
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];

  const placeGroundSpan = (startX: number, spanLen: number) => {
    for (let i = 0; i < spanLen && startX + i < width; i++) {
      grid[13][startX + i] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][startX + i] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      if (theme === 'underground' || (theme === 'castle' && rand() > 0.25)) {
        grid[0][startX + i] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        if (theme === 'underground') {
          grid[1][startX + i] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        }
      }
    }
  };

  const pickPowerUp = (): 'mushroom' | 'fireflower' | 'leaf' | 'coin' => {
    const r = rand();
    // Power-ups become slightly scarcer on higher stages
    const powerChance = 0.55 - diffRatio * 0.28;
    if (r > powerChance) return 'coin';
    const typeRoll = rand();
    if (typeRoll < 0.42) return 'mushroom';
    if (typeRoll < 0.72) return 'fireflower';
    return 'leaf';
  };

  const spawnEnemy = (tx: number, tyTile: number, forceType?: EnemyType) => {
    const koopaChance = 0.25 + diffRatio * 0.4;
    const type: EnemyType = forceType ?? (rand() < koopaChance ? 'koopa' : 'goomba');
    enemies.push({
      type,
      x: tx * 16,
      y: type === 'koopa' ? (tyTile - 1) * 16 + 8 : tyTile * 16,
    });
  };

  let x = 0;
  // Starting safe zone
  placeGroundSpan(0, 16);
  x = 16;

  const finishZoneStart = width - 26;

  // Weighted chunk selection that scales hazard complexity with stage
  while (x < finishZoneStart) {
    const remaining = finishZoneStart - x;
    if (remaining < 10) {
      placeGroundSpan(x, remaining);
      x += remaining;
      break;
    }

    const r = rand();
    // Early stages favor flat terrain/bridges; higher stages increase pits, stepping stones & split stairs
    let chunkType: number;
    if (r < 0.24 - diffRatio * 0.1) chunkType = 0; // Flat terrain + blocks + patrols
    else if (r < 0.42) chunkType = 1; // Pipe obstacle(s) + Piranha
    else if (r < 0.56 + diffRatio * 0.08) chunkType = 2; // Abyss / Pit jump
    else if (r < 0.68 + diffRatio * 0.12) chunkType = 3; // Stepping stone pillars over abyss
    else if (r < 0.82) chunkType = 4; // Staircase / Split Canyon
    else if (r < 0.92) chunkType = 5; // Two-tier sky bridge
    else chunkType = 6; // Elevated platforms over abyss

    if (chunkType === 0) {
      // Flat terrain with blocks & enemy patrols
      const len = Math.min(remaining, 8 + Math.floor(rand() * 6));
      placeGroundSpan(x, len);

      const mid = x + Math.floor(len / 2);
      if (len >= 7) {
        grid[9][mid - 1] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[9][mid] = { type: 'question', content: pickPowerUp(), bumpOffset: 0, bumpVel: 0 };
        grid[9][mid + 1] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      }

      if (rand() > 0.72) {
        const hContent = rand() > 0.72 ? '1up' : rand() > 0.45 ? 'star' : 'coin';
        grid[5][x + 2] = { type: 'question', content: hContent, bumpOffset: 0, bumpVel: 0, invisible: true };
      }

      // Enemy count scales with stage (1 to 3 enemies)
      const enemyChance = 0.55 + diffRatio * 0.35;
      if (rand() < enemyChance) {
        spawnEnemy(x + 2, 12);
        if (len >= 9 && rand() < 0.3 + diffRatio * 0.5) {
          spawnEnemy(x + len - 3, 12);
        }
        if (len >= 11 && diffRatio > 0.45 && rand() < diffRatio * 0.6) {
          spawnEnemy(mid, 8);
        }
      }
      x += len;
    } else if (chunkType === 1) {
      // Pipe corridor (1 or 2 pipes on higher stages)
      const doublePipe = remaining >= 12 && rand() < 0.2 + diffRatio * 0.5;
      const pLen = doublePipe ? 11 : 7;
      placeGroundSpan(x, pLen);

      const pipeH1 = 2 + Math.floor(rand() * 3);
      placePipe(grid, x + 2, 12, pipeH1);
      const piranhaChance = 0.35 + diffRatio * 0.55;
      if (pipeH1 >= 2 && rand() < piranhaChance) {
        enemies.push({
          type: 'piranha',
          x: (x + 2) * 16 + 8,
          y: (13 - pipeH1) * 16,
        });
      }

      if (doublePipe) {
        const pipeH2 = 2 + Math.floor(rand() * 3);
        placePipe(grid, x + 7, 12, pipeH2);
        if (rand() < piranhaChance) {
          enemies.push({
            type: 'piranha',
            x: (x + 7) * 16 + 8,
            y: (13 - pipeH2) * 16,
          });
        }
        // Extra Goomba between pipes on harder levels
        if (rand() < 0.3 + diffRatio * 0.5) {
          spawnEnemy(x + 5, 12);
        }
      }
      x += pLen;
    } else if (chunkType === 2) {
      // Abyss / Pit jump (wider gaps as stages increase, max 5 tiles so always clearable)
      const maxGap = stage >= 5 ? 5 : stage >= 2 ? 4 : 3;
      const minGap = stage >= 4 ? 3 : 2;
      const gap = Math.min(remaining - 4, minGap + Math.floor(rand() * (maxGap - minGap + 1)));

      if (gap >= 2) {
        // Coin arc over pit
        for (let c = 0; c < gap; c++) {
          coins.push({ x: (x + c) * 16 + 8, y: 9 * 16 });
        }
        if (rand() > 0.68) {
          grid[8][x - 1] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };
        }
        x += gap;
        // Landing platform (2-3 tiles)
        const landLen = Math.min(remaining - gap, 3);
        placeGroundSpan(x, landLen);
        if (diffRatio > 0.35 && rand() < diffRatio * 0.65) {
          spawnEnemy(x + 1, 12);
        }
        x += landLen;
      } else {
        placeGroundSpan(x, 4);
        x += 4;
      }
    } else if (chunkType === 3) {
      // Stepping-stone pillars over lethal pit
      const pillarCount = Math.min(3 + Math.floor(diffRatio * 2), Math.floor(remaining / 5));
      if (pillarCount >= 2) {
        for (let p = 0; p < pillarCount; p++) {
          const gap = 2 + (diffRatio > 0.4 && rand() > 0.4 ? 1 : 0);
          x += gap;
          const pillarW = diffRatio > 0.55 && rand() > 0.4 ? 1 : 2;
          const pillarY = 10 + Math.floor(rand() * 3); // rows 10..12
          for (let px = 0; px < pillarW && x + px < finishZoneStart; px++) {
            for (let py = pillarY; py <= 14; py++) {
              grid[py][x + px] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
            }
          }
          coins.push({ x: x * 16 + 8, y: (pillarY - 2) * 16 });
          x += pillarW;
        }
        // Safe landing span
        const safeSpan = Math.min(4, finishZoneStart - x);
        if (safeSpan > 0) {
          placeGroundSpan(x, safeSpan);
          x += safeSpan;
        }
      } else {
        placeGroundSpan(x, 5);
        x += 5;
      }
    } else if (chunkType === 4) {
      // Staircase pyramid (with optional lethal abyss gap in the center at higher stages!)
      const stSize = Math.min(3 + Math.floor(rand() * (2 + diffRatio)), 5);
      const hasCenterPit = stage >= 2 && rand() < 0.25 + diffRatio * 0.55;
      const pitW = hasCenterPit ? (diffRatio > 0.5 ? 3 : 2) : 0;
      const totalNeeded = stSize * 2 + pitW + 3;

      if (totalNeeded <= remaining) {
        // Ascending stairs
        placeGroundSpan(x, stSize + 1);
        for (let sIdx = 1; sIdx <= stSize; sIdx++) {
          for (let sy = 13 - sIdx; sy <= 12; sy++) {
            grid[sy][x + sIdx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
          }
        }
        x += stSize + 1;

        // Center gap (no ground!)
        if (pitW > 0) {
          for (let c = 0; c < pitW; c++) {
            coins.push({ x: (x + c) * 16 + 8, y: (11 - stSize) * 16 });
          }
          x += pitW;
        }

        // Descending stairs
        placeGroundSpan(x, stSize + 2);
        for (let sIdx = stSize; sIdx >= 1; sIdx--) {
          const col = x + (stSize - sIdx);
          for (let sy = 13 - sIdx; sy <= 12; sy++) {
            grid[sy][col] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
          }
        }
        if (rand() < 0.4 + diffRatio * 0.4) {
          spawnEnemy(x + stSize, 12);
        }
        x += stSize + 2;
      } else {
        placeGroundSpan(x, remaining);
        x += remaining;
      }
    } else if (chunkType === 5) {
      // Two-tier sky bridge with upper and lower threats
      const bLen = Math.min(remaining, 9 + Math.floor(rand() * 4));
      placeGroundSpan(x, bLen);
      for (let i = 1; i < bLen - 1; i++) {
        const isQ = i === Math.floor(bLen / 2);
        grid[8][x + i] = {
          type: isQ ? 'question' : brickTileType,
          content: isQ ? pickPowerUp() : 'none',
          bumpOffset: 0,
          bumpVel: 0,
        };
        coins.push({ x: (x + i) * 16 + 8, y: 6 * 16 });
      }
      spawnEnemy(x + 2, 12);
      if (diffRatio > 0.25) {
        spawnEnemy(x + Math.floor(bLen / 2), 7);
      }
      if (diffRatio > 0.55 && bLen >= 10) {
        spawnEnemy(x + bLen - 3, 12);
      }
      x += bLen;
    } else {
      // Elevated platforms over abyss
      const platCount = Math.min(3, Math.floor((remaining - 3) / 6));
      if (platCount >= 2) {
        // Entry ground step
        placeGroundSpan(x, 2);
        x += 2;
        for (let p = 0; p < platCount; p++) {
          x += 2; // Gap
          const pW = 4;
          const pY = p % 2 === 0 ? 10 : 8;
          for (let i = 0; i < pW && x + i < finishZoneStart; i++) {
            grid[pY][x + i] = {
              type: i === 1 && rand() > 0.5 ? 'question' : brickTileType,
              content: i === 1 ? 'coin' : 'none',
              bumpOffset: 0,
              bumpVel: 0,
            };
          }
          if (diffRatio > 0.35 && rand() < 0.35 + diffRatio * 0.45) {
            spawnEnemy(x + 2, pY - 1);
          }
          x += pW;
        }
        const tailLen = Math.min(3, finishZoneStart - x);
        if (tailLen > 0) {
          placeGroundSpan(x, tailLen);
          x += tailLen;
        }
      } else {
        placeGroundSpan(x, 5);
        x += 5;
      }
    }
  }

  // End castle area (always safe ground)
  for (; x < width; x++) {
    grid[13][x] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][x] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Flagpole
  const flagXTile = width - 18;
  grid[12][flagXTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  for (let y = 3; y <= 11; y++) {
    grid[y][flagXTile] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  grid[2][flagXTile] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Castle
  const castleXTile = width - 12;
  for (let cx = castleXTile; cx <= castleXTile + 5; cx++) {
    for (let cy = 8; cy <= 12; cy++) {
      grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    if (cx % 2 === 0) {
      grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  grid[11][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Safe checkpoints guaranteed on solid ground
  const findSafeCheckpointX = (targetTile: number): number => {
    for (let offset = 0; offset < 25; offset++) {
      const tx = Math.min(finishZoneStart - 4, targetTile + offset);
      if (grid[13][tx] && grid[13][tx + 1] && !grid[12][tx]) {
        return tx;
      }
    }
    return 4;
  };

  const cp1 = findSafeCheckpointX(Math.floor(width * 0.35));
  const cp2 = findSafeCheckpointX(Math.floor(width * 0.68));

  const timeLimit = Math.max(200, 440 - (stage - 1) * 20);
  const enemySpeedMultiplier = Number((1 + Math.min(0.85, (stage - 1) * 0.09)).toFixed(2));

  return {
    id: `endless-${stage}-${normalizedSeed}`,
    name: `INF-${stage}`,
    theme,
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    marioStart: { x: 40, y: 192 },
    flagX: flagXTile * 16,
    castleX: (castleXTile + 2) * 16,
    bgColor,
    timeLimit,
    endlessStage: stage,
    seed: normalizedSeed,
    enemySpeedMultiplier,
    checkpoints: [
      { x: cp1 * 16, respawnPos: { x: cp1 * 16, y: 192 } },
      { x: cp2 * 16, respawnPos: { x: cp2 * 16, y: 192 } },
    ],
  };
}
