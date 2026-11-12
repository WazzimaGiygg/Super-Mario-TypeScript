/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelData, BlockTile, Point, EnemyType } from './types.ts';

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

// Procedural Endless Level Generator
export function createEndlessLevel(seed: number = Date.now()): LevelData {
  const width = 250;
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];

  // Deterministic PRNG
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  let x = 0;
  // Starting safe zone
  for (; x < 18; x++) {
    grid[13][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Generation loop
  while (x < width - 25) {
    const chunkType = Math.floor(rand() * 5);

    if (chunkType === 0) {
      // Flat ground with random blocks and enemies
      const len = 8 + Math.floor(rand() * 6);
      for (let i = 0; i < len; i++) {
        grid[13][x + i] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[14][x + i] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      // Add blocks
      const mid = x + Math.floor(len / 2);
      grid[9][mid - 1] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[9][mid] = { type: 'question', content: rand() > 0.5 ? 'coin' : 'mushroom', bumpOffset: 0, bumpVel: 0 };
      grid[9][mid + 1] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

      // Occasional hidden mystery block in mid-air
      if (rand() > 0.65) {
        const hContent = rand() > 0.6 ? '1up' : rand() > 0.5 ? 'star' : 'coin';
        grid[5][x + 1] = { type: 'question', content: hContent, bumpOffset: 0, bumpVel: 0, invisible: true };
      }

      // Add enemy
      if (rand() > 0.3) {
        enemies.push({
          type: rand() > 0.4 ? 'goomba' : 'koopa',
          x: (x + 2) * 16,
          y: 12 * 16,
        });
      }
      x += len;
    } else if (chunkType === 1) {
      // Pipe obstacle
      const pLen = 6;
      for (let i = 0; i < pLen; i++) {
        grid[13][x + i] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[14][x + i] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      const pipeH = 2 + Math.floor(rand() * 3);
      placePipe(grid, x + 2, 12, pipeH);
      if (pipeH >= 3 && rand() > 0.5) {
        enemies.push({
          type: 'piranha',
          x: (x + 2) * 16 + 8,
          y: (13 - pipeH) * 16,
        });
      }
      x += pLen;
    } else if (chunkType === 2) {
      // Pit gap
      const gap = 2 + Math.floor(rand() * 2);

      // Secret hidden mystery block near pit
      if (rand() > 0.6) {
        grid[8][x - 1] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };
      }

      // Pit has no ground
      x += gap;
      // Landing safe block
      grid[13][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      x += 2;
    } else if (chunkType === 3) {
      // Staircase pyramid
      const stSize = 3 + Math.floor(rand() * 2);
      for (let i = 0; i < stSize * 2 + 2; i++) {
        grid[13][x + i] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[14][x + i] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      // up
      for (let s = 1; s <= stSize; s++) {
        for (let sy = 13 - s; sy <= 12; sy++) {
          grid[sy][x + s] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
        }
      }
      // down
      for (let s = stSize; s >= 1; s--) {
        for (let sy = 13 - s; sy <= 12; sy++) {
          grid[sy][x + stSize + (stSize - s + 1)] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
        }
      }
      x += stSize * 2 + 2;
    } else {
      // High coin bridge
      const bLen = 8;
      for (let i = 0; i < bLen; i++) {
        grid[13][x + i] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[14][x + i] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[7][x + i] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
        coins.push({ x: (x + i) * 16 + 8, y: 5 * 16 });
      }
      x += bLen;
    }
  }

  // End castle area
  for (; x < width; x++) {
    grid[13][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
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

  return {
    id: `endless-${seed}`,
    name: 'ENDLESS RUN',
    theme: 'overworld',
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    marioStart: { x: 40, y: 192 },
    flagX: flagXTile * 16,
    castleX: (castleXTile + 2) * 16,
    bgColor: '#5c94fc',
    timeLimit: 500,
    checkpoints: [
      { x: 80 * 16, respawnPos: { x: 82 * 16, y: 192 } },
      { x: 160 * 16, respawnPos: { x: 162 * 16, y: 192 } },
    ],
  };
}
