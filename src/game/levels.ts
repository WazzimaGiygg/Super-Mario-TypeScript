/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LevelData,
  BlockTile,
  TileType,
  Point,
  EnemyType,
  ItemContent,
  FloatingPlatformSpec,
  CarryableKind,
  CarryablePlacement,
  KeyholePlacement,
} from './types.ts';
import { EnemySpawnManager } from './enemySpawnManager.ts';

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

  // Tile 20-24: [Brick] [Brick] [Brick] [? (Coin)] [Brick]
  grid[9][20] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][21] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][22] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][23] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  grid[9][24] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

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

  // 4. Area after first pit (Pit at 69-70)
  // Tile 77-79: Brick row
  grid[9][77] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][78] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][79] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // High brick platform (Tile 80-87, y=5) guarded by a Hammer Brother
  for (let bx = 80; bx <= 87; bx++) {
    grid[5][bx] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'hammer_bro', x: 83 * 16, y: 5 * 16 - 24 });

  // Goombas patrolling under platform
  enemies.push({ type: 'goomba', x: 82 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 84 * 16, y: 12 * 16 });

  // Authentic NES Hidden Coin Block in mid-air gap (Tile 89, y=5)
  grid[5][89] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };

  // Area after second pit (Pit at 86-88)
  // Tile 91-94: Brick row with multi-hit coin block!
  grid[9][91] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][92] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][93] = { type: 'brick', content: 'coin', bumpOffset: 0, bumpVel: 0, coinsLeft: 5 };
  grid[9][94] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Brick row at tile 100-102
  grid[9][100] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][101] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][102] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Bouncing Paratroopa & Koopa Troopa patrolling
  enemies.push({ type: 'paratroopa', x: 105 * 16, y: 10 * 16 });
  enemies.push({ type: 'koopa', x: 107 * 16, y: 11 * 16 });

  // Question coin blocks at tile 109 & 112 (y=5)
  grid[9][109] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
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

  // Brick platforms with Goombas & Hammer Brother
  grid[9][168] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][169] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][170] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  grid[9][171] = { type: 'brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  enemies.push({ type: 'hammer_bro', x: 169 * 16 + 8, y: 9 * 16 - 24 });
  enemies.push({ type: 'goomba', x: 174 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 176 * 16, y: 12 * 16 });

  // Paratroopa & Koopa before final staircase
  enemies.push({ type: 'paratroopa', x: 159 * 16, y: 10 * 16 });
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

  // Exit pipe at right
  placePipe(grid, 20, 12, 4, true);

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
        from: { x: 20 * 16, y: 8 * 16, width: 32, height: 16 },
        toLevel: 'world-1-1',
        toPos: { x: 163 * 16 + 8, y: 11 * 16 - 16 },
        type: 'down',
      },
      {
        from: { x: 20 * 16 - 6, y: 9 * 16, width: 8, height: 64 },
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

  // Enemies and platforms
  enemies.push({ type: 'goomba', x: 20 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 24 * 16, y: 12 * 16 });
  enemies.push({ type: 'koopa', x: 36 * 16, y: 11 * 16 });

  // Hidden Coin Block in upper platform gap (Tile 44, y=5)
  grid[5][44] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };

  // Brick platforms
  for (let bx = 18; bx <= 28; bx++) {
    grid[8][bx] = { type: 'underground_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Underground Paratroopa & Hammer Brother guarding the exit passage
  enemies.push({ type: 'paratroopa', x: 96 * 16, y: 10 * 16 });
  enemies.push({ type: 'hammer_bro', x: 118 * 16, y: 13 * 16 - 24 });

  // Underground exit pipe (Tile 145, 4 tiles high)
  placePipe(grid, 145, 12, 4, true);

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
        from: { x: 145 * 16, y: 8 * 16, width: 32, height: 16 },
        toLevel: 'world-1-2',
        toPos: { x: 154 * 16 + 8, y: 11 * 16 - 16 },
        type: 'down',
      },
    ],
  };
}

// Build World 2-2 Underwater Stage
export function createWorld2_2(): LevelData {
  const width = 206;
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];

  const pits = [
    [42, 44],
    [88, 91],
    [134, 137],
  ];

  // Underwater floor (tiles 0-174)
  for (let x = 0; x < 175; x++) {
    const isPit = pits.some(([pStart, pEnd]) => x >= pStart && x <= pEnd);
    if (!isPit) {
      grid[13][x] = { type: 'sea_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: 'sea_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // Coin arcs above underwater abyss pits
  pits.forEach(([pStart, pEnd]) => {
    for (let cx = pStart; cx <= pEnd; cx++) {
      coins.push({ x: cx * 16 + 8, y: 9 * 16 });
      coins.push({ x: cx * 16 + 8, y: 11 * 16 });
    }
  });

  // 1. Coral reefs & starter blocks
  for (let x = 18; x <= 21; x++) {
    grid[11][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[12][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  coins.push({ x: 19 * 16 + 8, y: 8 * 16 });
  coins.push({ x: 20 * 16 + 8, y: 8 * 16 });

  // Starter coral & coin question block
  grid[8][26] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[8][27] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[8][28] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[8][29] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  grid[8][30] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Early underwater enemies
  enemies.push({ type: 'cheep_cheep', x: 28 * 16, y: 6 * 16 });
  enemies.push({ type: 'blooper', x: 35 * 16, y: 7 * 16 });

  // 2. Coral tunnel & ceiling formation (tiles 50-63)
  for (let x = 50; x <= 62; x++) {
    grid[4][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
    if (x >= 53 && x <= 59) {
      grid[5][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  for (let x = 52; x <= 60; x++) {
    grid[11][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[12][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  for (let cx = 53; cx <= 59; cx++) {
    coins.push({ x: cx * 16 + 8, y: 8 * 16 });
  }
  enemies.push({ type: 'cheep_cheep', x: 56 * 16, y: 9 * 16 });

  // Mid-sea floating coral platforms
  for (let x = 72; x <= 78; x++) {
    grid[9][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'blooper', x: 74 * 16, y: 5 * 16 });
  enemies.push({ type: 'cheep_cheep', x: 80 * 16, y: 11 * 16 });

  // 3. Second half (after checkpoint at tile 84)
  enemies.push({ type: 'cheep_cheep', x: 96 * 16, y: 6 * 16 });
  enemies.push({ type: 'blooper', x: 103 * 16, y: 8 * 16 });
  enemies.push({ type: 'cheep_cheep', x: 110 * 16, y: 10 * 16 });

  // High coral reefs + coins
  for (let x = 98; x <= 102; x++) {
    grid[10][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[11][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[12][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  for (let x = 118; x <= 126; x++) {
    grid[5][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
    coins.push({ x: x * 16 + 8, y: 8 * 16 });
  }
  enemies.push({ type: 'blooper', x: 122 * 16, y: 9 * 16 });
  enemies.push({ type: 'cheep_cheep', x: 129 * 16, y: 7 * 16 });

  // Final gauntlet before exit pipe
  for (let x = 144; x <= 150; x++) {
    grid[9][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'cheep_cheep', x: 146 * 16, y: 5 * 16 });
  enemies.push({ type: 'blooper', x: 155 * 16, y: 7 * 16 });
  enemies.push({ type: 'cheep_cheep', x: 160 * 16, y: 10 * 16 });

  // Underwater exit warp pipe (tile 167-168) + coin marker above it
  placePipe(grid, 167, 12, 3, true);
  coins.push({ x: 167 * 16 + 16, y: 8 * 16 });

  // Solid coral barrier wall dividing ocean from dry shore exit
  for (let x = 172; x <= 174; x++) {
    for (let y = 0; y <= 12; y++) {
      grid[y][x] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // Dry outdoor surface finish zone (tiles 175-205)
  for (let x = 175; x < width; x++) {
    grid[13][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][x] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Surface emergence pipe (tile 180)
  placePipe(grid, 180, 12, 2);

  // Small staircase (tiles 185-188)
  for (let s = 1; s <= 4; s++) {
    const sx = 184 + s;
    for (let sy = 13 - s; sy <= 12; sy++) {
      grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // Flagpole at tile 194
  grid[12][194] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  for (let y = 3; y <= 11; y++) {
    grid[y][194] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  grid[2][194] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Castle at tiles 198-203
  for (let cx = 198; cx <= 203; cx++) {
    for (let cy = 8; cy <= 12; cy++) {
      grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    if (cx % 2 === 0) {
      grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  grid[11][200] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][200] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };

  return {
    id: 'world-2-2',
    name: 'WORLD 2-2',
    theme: 'underwater',
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    marioStart: { x: 40, y: 144 },
    flagX: 194 * 16,
    castleX: 200 * 16,
    dryFinishStartX: 175 * 16,
    bgColor: '#1840b8',
    timeLimit: 400,
    checkpoints: [
      {
        x: 84 * 16,
        respawnPos: { x: 84 * 16, y: 160 },
      },
    ],
    pipeWarps: [
      {
        from: { x: 167 * 16, y: 9 * 16, width: 32, height: 16 },
        toLevel: 'world-2-2',
        toPos: { x: 180 * 16 + 8, y: 11 * 16 - 16 },
        type: 'down',
      },
    ],
  };
}

// Build World 1-4 Castle Stage with Lava, Podoboo, Bridge, Axe & Bowser Boss
export function createWorld1_4(): LevelData {
  const width = 162;
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];

  // Ceiling stone roof (rows 0..1)
  for (let x = 0; x < width; x++) {
    grid[0][x] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[1][x] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  const fillCastleFloor = (startX: number, span: number) => {
    for (let x = startX; x < startX + span && x < width; x++) {
      grid[13][x] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  };

  const fillLavaPit = (startX: number, span: number) => {
    for (let x = startX; x < startX + span && x < width; x++) {
      grid[13][x] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  };

  // Entrance chamber (0..15)
  fillCastleFloor(0, 16);
  for (let y = 2; y <= 12; y++) {
    grid[y][0] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  // Low stone archway ceiling
  for (let x = 8; x <= 14; x++) {
    grid[2][x] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[3][x] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // First lava pit (16..18) with Lava Bubble
  fillLavaPit(16, 3);
  enemies.push({ type: 'lava_bubble', x: 17 * 16, y: 13 * 16 });
  coins.push({ x: 16 * 16 + 8, y: 10 * 16 }, { x: 17 * 16 + 8, y: 9 * 16 }, { x: 18 * 16 + 8, y: 10 * 16 });

  // Corridor 1 (19..34)
  fillCastleFloor(19, 16);
  grid[9][23] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][24] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][25] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  enemies.push({ type: 'goomba', x: 26 * 16, y: 12 * 16 });
  enemies.push({ type: 'koopa', x: 30 * 16, y: 11 * 16 + 8 });

  // Wide lava pool 2 with stepping stone platforms (35..46)
  fillLavaPit(35, 12);
  for (let px = 37; px <= 38; px++) {
    grid[11][px] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  for (let px = 41; px <= 43; px++) {
    grid[10][px] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'lava_bubble', x: 39 * 16 + 8, y: 13 * 16 });
  enemies.push({ type: 'lava_bubble', x: 44 * 16 + 8, y: 13 * 16 });
  coins.push({ x: 37 * 16 + 8, y: 9 * 16 }, { x: 42 * 16 + 8, y: 8 * 16 });

  // Mid-castle hall (47..72)
  fillCastleFloor(47, 26);
  for (let x = 51; x <= 57; x++) {
    grid[9][x] = {
      type: 'castle_stone',
      content: 'none',
      bumpOffset: 0,
      bumpVel: 0,
    };
  }
  coins.push(
    { x: 52 * 16 + 8, y: 7 * 16 },
    { x: 54 * 16 + 8, y: 7 * 16 },
    { x: 56 * 16 + 8, y: 7 * 16 }
  );
  enemies.push({ type: 'goomba', x: 52 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 55 * 16, y: 12 * 16 });
  enemies.push({ type: 'koopa', x: 64 * 16, y: 11 * 16 + 8 });

  // Checkpoint area (68..72)
  grid[12][69] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][70] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Twin lava chasm with suspended bridge stones (73..90)
  fillLavaPit(73, 18);
  for (let px = 75; px <= 77; px++) {
    grid[11][px] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  for (let px = 80; px <= 83; px++) {
    grid[9][px] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  for (let px = 86; px <= 88; px++) {
    grid[11][px] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'lava_bubble', x: 78 * 16 + 8, y: 13 * 16 });
  enemies.push({ type: 'lava_bubble', x: 84 * 16 + 8, y: 13 * 16 });

  // Final guard corridor before Bowser (91..131)
  fillCastleFloor(91, 41);
  // Staircase / raised pillars
  for (let y = 11; y <= 12; y++) {
    grid[y][98] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  for (let y = 10; y <= 12; y++) {
    grid[y][108] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'goomba', x: 95 * 16, y: 12 * 16 });
  enemies.push({ type: 'paratroopa', x: 99 * 16, y: 10 * 16 });
  enemies.push({ type: 'koopa', x: 102 * 16, y: 11 * 16 + 8 });
  enemies.push({ type: 'goomba', x: 113 * 16, y: 12 * 16 });
  enemies.push({ type: 'goomba', x: 116 * 16, y: 12 * 16 });
  enemies.push({ type: 'hammer_bro', x: 120 * 16, y: 13 * 16 - 24 });
  enemies.push({ type: 'koopa', x: 124 * 16, y: 11 * 16 + 8 });

  // Step up onto Bowser's bridge (129..131)
  grid[12][129] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][130] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][131] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Bowser Boss Arena: Lava Pit (132..147) + Bridge (row 12) + Axe (147)
  fillLavaPit(132, 16);
  for (let bx = 132; bx <= 146; bx++) {
    grid[12][bx] = { type: 'bridge', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  // Overhead stone platform above Bowser for daring high jumps!
  for (let bx = 137; bx <= 142; bx++) {
    grid[7][bx] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  // Bridge anchor + Golden Axe at tile 147 (header wall above so player always hits axe)
  for (let wy = 2; wy <= 8; wy++) {
    grid[wy][147] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  grid[12][147] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[11][147] = { type: 'axe', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Bowser Boss standing on the bridge (24x24 -> y = 12*16 - 24 = 168)
  enemies.push({ type: 'bowser', x: 141 * 16, y: 12 * 16 - 24 });

  // Victory chamber past the axe (148..161)
  fillCastleFloor(148, 14);
  for (let cx = 154; cx <= 159; cx++) {
    for (let cy = 8; cy <= 12; cy++) {
      grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    if (cx % 2 === 0) {
      grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  grid[11][156] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][156] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
  for (let y = 2; y <= 12; y++) {
    grid[y][width - 1] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  return {
    id: 'world-1-4',
    name: '1-4',
    theme: 'castle',
    biomeLabel: 'CASTELO DO REI KOOPA',
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    marioStart: { x: 40, y: 192 },
    flagX: 999999,
    castleX: 156 * 16,
    bgColor: '#140406',
    timeLimit: 350,
    checkpoints: [
      {
        x: 68 * 16,
        respawnPos: { x: 68 * 16, y: 160 },
      },
    ],
  };
}

// World 3-G: Haunted Ghost House (Mansão de Fantasmas)
export function createWorldGhostHouse(): LevelData {
  const width = 195;
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];

  const fillGhostFloor = (startX: number, len: number) => {
    for (let x = startX; x < startX + len && x < width; x++) {
      grid[13][x] = { type: 'ghost_floor', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: 'ghost_floor', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  };

  // Haunted Mansion Roof / Upper Beams along the main interior (0..168)
  for (let x = 0; x <= 168; x++) {
    grid[0][x] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[1][x] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Entrance Pillar Framing
  for (let y = 2; y <= 12; y++) {
    grid[y][0] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // 1. Entrance Foyer (0..20)
  fillGhostFloor(0, 21);
  grid[9][10] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][11] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][12] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[9][13] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  coins.push(
    { x: 10 * 16 + 8, y: 7 * 16 },
    { x: 11 * 16 + 8, y: 7 * 16 },
    { x: 12 * 16 + 8, y: 7 * 16 }
  );
  enemies.push({ type: 'dry_bones', x: 16 * 16, y: 13 * 16 - 24 });

  // 2. Chasm Gallery & Floating Platforms (21..46)
  // Static ? blocks high above the floating platforms
  grid[6][24] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  grid[6][25] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0 };
  enemies.push({ type: 'boo', x: 20 * 16, y: 7 * 16 });
  enemies.push({ type: 'boo', x: 28 * 16, y: 6 * 16 });

  coins.push(
    { x: 30 * 16 + 8, y: 6 * 16 },
    { x: 31 * 16 + 8, y: 6 * 16 },
    { x: 32 * 16 + 8, y: 6 * 16 }
  );

  fillGhostFloor(35, 11);
  enemies.push({ type: 'dry_bones', x: 40 * 16, y: 13 * 16 - 24 });
  enemies.push({ type: 'boo', x: 44 * 16, y: 7 * 16 });

  // 3. Haunted Library Dual-Path (46..86)
  fillGhostFloor(46, 40);
  // Decorative gothic pillars framing the hall
  for (let y = 2; y <= 5; y++) {
    grid[y][49] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[y][67] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Upper attic walkway
  for (let px = 52; px <= 64; px++) {
    grid[8][px] = {
      type: 'ghost_brick',
      content: 'none',
      bumpOffset: 0,
      bumpVel: 0,
    };
  }
  coins.push(
    { x: 54 * 16 + 8, y: 6 * 16 },
    { x: 56 * 16 + 8, y: 6 * 16 },
    { x: 60 * 16 + 8, y: 6 * 16 },
    { x: 62 * 16 + 8, y: 6 * 16 }
  );
  enemies.push({ type: 'boo', x: 56 * 16, y: 5 * 16 });
  enemies.push({ type: 'dry_bones', x: 57 * 16, y: 13 * 16 - 24 });
  enemies.push({ type: 'dry_bones', x: 63 * 16, y: 13 * 16 - 24 });

  // Raised brick steps
  for (let px = 71; px <= 76; px++) {
    grid[9][px] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'boo', x: 75 * 16, y: 7 * 16 });
  enemies.push({ type: 'dry_bones', x: 78 * 16, y: 13 * 16 - 24 });

  // 4. Checkpoint Sanctuary (86..97)
  fillGhostFloor(86, 11);
  grid[12][89] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][90] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // 5. Abyss of Floating Platforms & Boos (97..137)
  coins.push(
    { x: 100 * 16 + 8, y: 8 * 16 },
    { x: 102 * 16 + 8, y: 7 * 16 },
    { x: 104 * 16 + 8, y: 8 * 16 }
  );
  enemies.push({ type: 'boo', x: 103 * 16, y: 6 * 16 });

  // Central haunted island
  fillGhostFloor(109, 10);
  for (let px = 112; px <= 116; px++) {
    grid[8][px] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'dry_bones', x: 113 * 16, y: 13 * 16 - 24 });
  enemies.push({ type: 'boo', x: 117 * 16, y: 7 * 16 });

  // Second floating platform abyss & high coin ridge
  enemies.push({ type: 'boo', x: 126 * 16, y: 5 * 16 });
  coins.push(
    { x: 131 * 16 + 8, y: 7 * 16 },
    { x: 132 * 16 + 8, y: 7 * 16 },
    { x: 133 * 16 + 8, y: 7 * 16 }
  );
  enemies.push({ type: 'boo', x: 135 * 16, y: 8 * 16 });

  // 6. Grand Ballroom Gauntlet & Exit Courtyard (137..194)
  fillGhostFloor(137, 58);

  // Pillar obstacles & Bone Guards
  for (let y = 10; y <= 12; y++) {
    grid[y][143] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[y][144] = { type: 'ghost_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  enemies.push({ type: 'dry_bones', x: 147 * 16, y: 13 * 16 - 24 });
  enemies.push({ type: 'boo', x: 152 * 16, y: 6 * 16 });
  enemies.push({ type: 'dry_bones', x: 156 * 16, y: 13 * 16 - 24 });

  // Final Mansion Staircase (162..167)
  for (let step = 0; step < 6; step++) {
    const sx = 162 + step;
    for (let y = 12 - step; y <= 12; y++) {
      grid[y][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  // Flagpole at tile 175
  const flagTile = 175;
  grid[12][flagTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
  for (let y = 3; y <= 11; y++) {
    grid[y][flagTile] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }
  grid[2][flagTile] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

  // Exit Mansion / Castle Gate (180..184)
  for (let cx = 180; cx <= 184; cx++) {
    for (let cy = 8; cy <= 12; cy++) {
      grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    if (cx % 2 === 0) {
      grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  grid[11][182] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
  grid[12][182] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };

  const floatingPlatforms: FloatingPlatformSpec[] = [
    // Chasm Gallery floating elevator + horizontal glider
    { x: 23 * 16, y: 10 * 16, width: 48, axis: 'vertical', range: 26, speed: 0.035, phase: 0 },
    { x: 30 * 16, y: 9 * 16, width: 48, axis: 'horizontal', range: 28, speed: 0.032, phase: 1.4 },
    // Library floating lift near raised steps
    { x: 80 * 16, y: 8 * 16, width: 40, axis: 'vertical', range: 30, speed: 0.036, phase: 0.6 },
    // Abyss crossing: twin haunted floating ferries
    { x: 101 * 16, y: 11 * 16, width: 48, axis: 'horizontal', range: 38, speed: 0.032, phase: 0 },
    { x: 122 * 16, y: 10 * 16, width: 48, axis: 'vertical', range: 24, speed: 0.038, phase: 1.0 },
    { x: 130 * 16, y: 9 * 16, width: 48, axis: 'horizontal', range: 32, speed: 0.034, phase: 2.1 },
    // Ballroom hovering ghost dais
    { x: 150 * 16, y: 9 * 16, width: 48, axis: 'bob', range: 14, speed: 0.044, phase: 0 },
  ];

  return {
    id: 'world-ghost',
    name: 'MANSÃO',
    theme: 'ghost_house',
    biomeLabel: 'MANSÃO DE FANTASMAS',
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    floatingPlatforms,
    marioStart: { x: 48, y: 192 },
    flagX: flagTile * 16,
    castleX: 182 * 16,
    bgColor: '#120822',
    timeLimit: 380,
    checkpoints: [
      {
        x: 89 * 16,
        respawnPos: { x: 89 * 16, y: 160 },
      },
    ],
  };
}

// Procedural Endless Level Generator with Cyclic Biomes (1 Overworld -> 2 Caverna -> 3 Água -> 4 Castelo com Boss) & Progressive Difficulty
export function createEndlessLevel(
  seed: number = Date.now(),
  endlessStage: number = 1
): LevelData {
  const stage = Math.max(1, Math.floor(endlessStage));
  const normalizedSeed = Math.abs(Math.floor(seed)) % 10000000;
  const cycleIndex = (stage - 1) % 4; // 0: Overworld, 1: Caverna, 2: Água, 3: Castelo
  const cycleNumber = Math.floor((stage - 1) / 4) + 1;
  const diffRatio = Math.min(1, (stage - 1) / 14); // Scales smoothly across cycles

  // Deterministic PRNG (Mulberry32-style mixed with seed + stage)
  let s = (normalizedSeed + stage * 7919) >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Strict infinite cycle: 1 Overworld -> 2 Caverna (underground) -> 3 Água (underwater) -> 4 Castelo (castle + boss) -> repeats harder!
  const theme: 'overworld' | 'underground' | 'underwater' | 'castle' =
    cycleIndex === 0
      ? 'overworld'
      : cycleIndex === 1
      ? 'underground'
      : cycleIndex === 2
      ? 'underwater'
      : 'castle';

  const biomeLabelMap = {
    overworld: 'OVERWORLD',
    underground: 'CAVERNA',
    underwater: 'ÁGUA',
    castle: 'CASTELO',
  } as const;

  const bgColor =
    theme === 'overworld'
      ? '#5c94fc'
      : theme === 'underground'
      ? '#000000'
      : theme === 'underwater'
      ? '#1840b8'
      : '#140406';

  const groundTileType: TileType =
    theme === 'underground'
      ? 'underground_ground'
      : theme === 'castle'
      ? 'castle_stone'
      : theme === 'underwater'
      ? 'sea_ground'
      : 'ground';

  const brickTileType: TileType =
    theme === 'underground'
      ? 'underground_brick'
      : theme === 'castle'
      ? 'hard_block'
      : theme === 'underwater'
      ? 'coral'
      : 'brick';

  const width = Math.min(340, 200 + (stage - 1) * 12);
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];

  const placeGroundSpan = (startX: number, spanLen: number) => {
    for (let i = 0; i < spanLen && startX + i < width; i++) {
      grid[13][startX + i] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][startX + i] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      if (theme === 'underground' || theme === 'castle') {
        grid[0][startX + i] = { type: theme === 'castle' ? 'castle_stone' : brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[1][startX + i] = { type: theme === 'castle' ? 'castle_stone' : brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
  };

  const placePit = (startX: number, gapLen: number) => {
    for (let i = 0; i < gapLen && startX + i < width; i++) {
      if (theme === 'castle') {
        grid[0][startX + i] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[1][startX + i] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[13][startX + i] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[14][startX + i] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
      } else if (theme === 'underground') {
        grid[0][startX + i] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[1][startX + i] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    if (theme === 'castle' && gapLen >= 2 && rand() < 0.6 + diffRatio * 0.35) {
      const bubbleX = startX + Math.floor(gapLen / 2);
      enemies.push({ type: 'lava_bubble', x: bubbleX * 16 + 8, y: 13 * 16 });
    }
  };

  const pickPowerUp = (): 'coin' => {
    return 'coin';
  };

  const spawnProfile = EnemySpawnManager.getProfile(stage, theme);

  const spawnEnemy = (tx: number, tyTile: number, forceType?: EnemyType) => {
    const type =
      forceType ??
      EnemySpawnManager.pickEnemyType(stage, theme, rand, { allowAerial: true });
    enemies.push(EnemySpawnManager.createSpawnSpec(type, tx, tyTile, rand));
  };

  const spawnEnemyPack = (txSlots: number[], tyTile: number) => {
    const specs = EnemySpawnManager.generateChunkSpawns(stage, theme, rand, txSlots, tyTile);
    enemies.push(...specs);
  };

  let x = 0;
  // Starting safe zone
  placeGroundSpan(0, 16);
  x = 16;

  const finishZoneStart =
    theme === 'castle' ? width - 30 : theme === 'underwater' ? width - 42 : width - 26;

  // Weighted chunk selection that scales hazard complexity with stage & cycle
  while (x < finishZoneStart) {
    const remaining = finishZoneStart - x;
    if (remaining < 10) {
      placeGroundSpan(x, remaining);
      x += remaining;
      break;
    }

    const r = rand();
    let chunkType: number;
    if (r < 0.24 - diffRatio * 0.1) chunkType = 0; // Flat terrain + blocks + patrols
    else if (r < 0.40) chunkType = 1; // Pipe obstacle(s) + Piranha
    else if (r < 0.56 + diffRatio * 0.08) chunkType = 2; // Abyss / Lava pit jump
    else if (r < 0.68 + diffRatio * 0.12) chunkType = 3; // Stepping stone pillars over abyss/lava
    else if (r < 0.82) chunkType = 4; // Staircase / Split Canyon
    else if (r < 0.92) chunkType = 5; // Two-tier sky bridge
    else chunkType = 6; // Elevated platforms over abyss/lava

    if (chunkType === 0) {
      const len = Math.min(remaining, 8 + Math.floor(rand() * 6));
      placeGroundSpan(x, len);

      const mid = x + Math.floor(len / 2);
      if (len >= 7) {
        grid[9][mid - 1] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[9][mid] = { type: 'question', content: pickPowerUp(), bumpOffset: 0, bumpVel: 0 };
        grid[9][mid + 1] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      }

      if (rand() > 0.72) {
        grid[5][x + 2] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };
      }

      const slots = len >= 9 ? [x + 2, x + len - 3, mid] : [x + 2, x + len - 2];
      if (len >= 11 && diffRatio > 0.3 && rand() < spawnProfile.clusterChance) {
        spawnEnemyPack([x + 2, x + len - 3], 12);
        if (rand() < spawnProfile.baseSpawnChance * 0.7) {
          spawnEnemy(mid, 8);
        }
      } else {
        spawnEnemyPack(slots, 12);
      }
      x += len;
    } else if (chunkType === 1) {
      const doublePipe = remaining >= 12 && rand() < 0.22 + diffRatio * 0.5;
      const pLen = doublePipe ? 11 : 7;
      placeGroundSpan(x, pLen);

      if (theme === 'castle') {
        // Castle pillars instead of green pipes
        const h1 = 2 + Math.floor(rand() * 2);
        for (let py = 13 - h1; py <= 12; py++) {
          grid[py][x + 2] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
          grid[py][x + 3] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
        }
        spawnEnemy(x + 5, 12);
      } else {
        const pipeH1 = 2 + Math.floor(rand() * 3);
        placePipe(grid, x + 2, 12, pipeH1);
        const piranhaChance = spawnProfile.piranhaChance;
        if (theme !== 'underwater' && pipeH1 >= 2 && rand() < piranhaChance) {
          enemies.push({
            type: 'piranha',
            x: (x + 2) * 16 + 8,
            y: (13 - pipeH1) * 16,
          });
        } else if (theme === 'underwater' && rand() < spawnProfile.baseSpawnChance) {
          spawnEnemy(x + 3, 9);
        }

        if (doublePipe) {
          const pipeH2 = 2 + Math.floor(rand() * 3);
          placePipe(grid, x + 7, 12, pipeH2);
          if (theme !== 'underwater' && rand() < piranhaChance) {
            enemies.push({
              type: 'piranha',
              x: (x + 7) * 16 + 8,
              y: (13 - pipeH2) * 16,
            });
          }
          if (rand() < spawnProfile.clusterChance) {
            spawnEnemy(x + 5, 12);
          }
        }
      }
      x += pLen;
    } else if (chunkType === 2) {
      const maxGap = stage >= 5 ? 5 : stage >= 2 ? 4 : 3;
      const minGap = stage >= 4 ? 3 : 2;
      const gap = Math.min(remaining - 4, minGap + Math.floor(rand() * (maxGap - minGap + 1)));

      if (gap >= 2) {
        placePit(x, gap);
        for (let c = 0; c < gap; c++) {
          coins.push({ x: (x + c) * 16 + 8, y: 9 * 16 });
        }
        if (rand() > 0.68) {
          grid[8][x - 1] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, invisible: true };
        }
        x += gap;
        const landLen = Math.min(remaining - gap, 3);
        placeGroundSpan(x, landLen);
        if (rand() < spawnProfile.baseSpawnChance * 0.78) {
          spawnEnemy(x + 1, 12);
        }
        x += landLen;
      } else {
        placeGroundSpan(x, 4);
        x += 4;
      }
    } else if (chunkType === 3) {
      const pillarCount = Math.min(3 + Math.floor(diffRatio * 2), Math.floor(remaining / 5));
      if (pillarCount >= 2) {
        for (let p = 0; p < pillarCount; p++) {
          const gap = 2 + (diffRatio > 0.35 && rand() > 0.4 ? 1 : 0);
          placePit(x, gap);
          x += gap;
          const pillarW = diffRatio > 0.5 && rand() > 0.4 ? 1 : 2;
          const pillarY = 10 + Math.floor(rand() * 3);
          placePit(x, pillarW);
          for (let px = 0; px < pillarW && x + px < finishZoneStart; px++) {
            for (let py = pillarY; py <= 14; py++) {
              grid[py][x + px] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
            }
          }
          coins.push({ x: x * 16 + 8, y: (pillarY - 2) * 16 });
          x += pillarW;
        }
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
      const stSize = Math.min(3 + Math.floor(rand() * (2 + diffRatio)), 5);
      const hasCenterPit = stage >= 2 && rand() < 0.25 + diffRatio * 0.55;
      const pitW = hasCenterPit ? (diffRatio > 0.45 ? 3 : 2) : 0;
      const totalNeeded = stSize * 2 + pitW + 3;

      if (totalNeeded <= remaining) {
        placeGroundSpan(x, stSize + 1);
        for (let sIdx = 1; sIdx <= stSize; sIdx++) {
          for (let sy = 13 - sIdx; sy <= 12; sy++) {
            grid[sy][x + sIdx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
          }
        }
        x += stSize + 1;

        if (pitW > 0) {
          placePit(x, pitW);
          for (let c = 0; c < pitW; c++) {
            coins.push({ x: (x + c) * 16 + 8, y: (11 - stSize) * 16 });
          }
          x += pitW;
        }

        placeGroundSpan(x, stSize + 2);
        for (let sIdx = stSize; sIdx >= 1; sIdx--) {
          const col = x + (stSize - sIdx);
          for (let sy = 13 - sIdx; sy <= 12; sy++) {
            grid[sy][col] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
          }
        }
        if (rand() < 0.45 + diffRatio * 0.4) {
          spawnEnemy(x + stSize, 12);
        }
        x += stSize + 2;
      } else {
        placeGroundSpan(x, remaining);
        x += remaining;
      }
    } else if (chunkType === 5) {
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
      if (cycleNumber >= 2 || rand() < spawnProfile.clusterChance) {
        spawnEnemy(x + Math.floor(bLen / 2), 7);
      }
      if (bLen >= 10 && rand() < spawnProfile.clusterChance) {
        spawnEnemy(x + bLen - 3, 12);
      }
      x += bLen;
    } else {
      const platCount = Math.min(3, Math.floor((remaining - 3) / 6));
      if (platCount >= 2) {
        placeGroundSpan(x, 2);
        x += 2;
        for (let p = 0; p < platCount; p++) {
          placePit(x, 2);
          x += 2;
          const pW = 4;
          const pY = p % 2 === 0 ? 10 : 8;
          placePit(x, pW);
          for (let i = 0; i < pW && x + i < finishZoneStart; i++) {
            grid[pY][x + i] = {
              type: i === 1 && rand() > 0.5 ? 'question' : brickTileType,
              content: i === 1 ? 'coin' : 'none',
              bumpOffset: 0,
              bumpVel: 0,
            };
          }
          if (rand() < spawnProfile.clusterChance * 0.75) {
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

  // Build Finish Area: Castle stages end with Bowser Bridge + Axe; others end with Flagpole + Castle!
  let flagXTile = width - 18;
  let castleXTile = width - 12;

  const levelId = `endless-${stage}-${normalizedSeed}`;
  let pipeWarps: LevelData['pipeWarps'] = undefined;
  let dryFinishStartX: number | undefined = undefined;

  if (theme === 'castle') {
    // Approach step up onto Boss Bridge
    const approachEnd = Math.min(width - 25, Math.max(x + 2, finishZoneStart + 3));
    placeGroundSpan(x, approachEnd - x + 1);
    for (let sx = Math.max(x, approachEnd - 2); sx <= approachEnd; sx++) {
      grid[12][sx] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }

    const bridgeStart = approachEnd + 1;
    const axeTile = width - 11;
    for (let bx = bridgeStart; bx < axeTile; bx++) {
      grid[0][bx] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[1][bx] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[12][bx] = { type: 'bridge', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[13][bx] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][bx] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    // Overhead platform above Bowser on bridge
    const platMid = Math.floor((bridgeStart + axeTile) / 2);
    for (let ox = platMid - 2; ox <= platMid + 2; ox++) {
      grid[7][ox] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    // Axe + solid anchor block & overhead doorway wall
    for (let wy = 0; wy <= 8; wy++) {
      grid[wy][axeTile] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    grid[12][axeTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[11][axeTile] = { type: 'axe', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[13][axeTile] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][axeTile] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };

    // Spawn Bowser Boss on the bridge!
    const bowserXTile = Math.max(bridgeStart + 5, axeTile - 6);
    enemies.push({ type: 'bowser', x: bowserXTile * 16, y: 12 * 16 - 24 });

    // Victory chamber after Axe
    placeGroundSpan(axeTile + 1, width - (axeTile + 1));
    castleXTile = width - 7;
    for (let cx = castleXTile; cx <= Math.min(width - 2, castleXTile + 4); cx++) {
      for (let cy = 8; cy <= 12; cy++) {
        grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      if (cx % 2 === 0) {
        grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    grid[11][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[12][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    for (let y = 2; y <= 12; y++) {
      grid[y][width - 1] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    flagXTile = 99999;
  } else if (theme === 'underwater') {
    // Underwater exit warp pipe -> coral barrier wall -> dry shore emergence pipe -> staircase -> flagpole -> castle
    const warpPipeTile = width - 38;
    const barrierStartTile = width - 33;
    const dryShoreStartTile = width - 30;
    const emergePipeTile = width - 25;
    const stairsStartTile = width - 21;
    flagXTile = width - 14;
    castleXTile = width - 10;
    dryFinishStartX = dryShoreStartTile * 16;

    // Clear any stray tiles in the finish zone (rows 0..12) so pipe & castle path stay unobstructed
    for (let cx = Math.min(x, warpPipeTile - 1); cx < width; cx++) {
      for (let cy = 0; cy <= 12; cy++) {
        grid[cy][cx] = null;
      }
    }

    // Underwater seabed up to the dry shore boundary
    for (let sx = x; sx < dryShoreStartTile; sx++) {
      grid[13][sx] = { type: 'sea_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][sx] = { type: 'sea_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }

    // Underwater warp pipe + coin guide above it
    placePipe(grid, warpPipeTile, 12, 3, true);
    coins.push({ x: warpPipeTile * 16 + 16, y: 8 * 16 });

    // Solid coral barrier wall dividing ocean from dry shore exit
    for (let bx = barrierStartTile; bx < dryShoreStartTile; bx++) {
      for (let by = 0; by <= 12; by++) {
        grid[by][bx] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }

    // Dry outdoor surface finish ground
    for (let gx = dryShoreStartTile; gx < width; gx++) {
      grid[13][gx] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][gx] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }

    // Surface emergence pipe on dry shore
    placePipe(grid, emergePipeTile, 12, 2);

    // Small staircase leading to flagpole
    for (let s = 1; s <= 4; s++) {
      const sx = stairsStartTile + (s - 1);
      for (let sy = 13 - s; sy <= 12; sy++) {
        grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }

    // Flagpole
    grid[12][flagXTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    for (let y = 3; y <= 11; y++) {
      grid[y][flagXTile] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    grid[2][flagXTile] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

    // Castle
    for (let cx = castleXTile; cx <= Math.min(width - 2, castleXTile + 5); cx++) {
      for (let cy = 8; cy <= 12; cy++) {
        grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      if (cx % 2 === 0) {
        grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    grid[11][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[12][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };

    pipeWarps = [
      {
        from: { x: warpPipeTile * 16, y: 9 * 16, width: 32, height: 16 },
        toLevel: levelId,
        toPos: { x: emergePipeTile * 16 + 8, y: 11 * 16 - 16 },
        type: 'down',
      },
    ];
  } else {
    // End castle area (always safe ground)
    for (; x < width; x++) {
      grid[13][x] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
    }

    // Flagpole
    flagXTile = width - 18;
    grid[12][flagXTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    for (let y = 3; y <= 11; y++) {
      grid[y][flagXTile] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    grid[2][flagXTile] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

    // Castle
    castleXTile = width - 12;
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
  }

  // Safe checkpoints guaranteed on solid ground
  const findSafeCheckpointX = (targetTile: number): number => {
    for (let offset = 0; offset < 25; offset++) {
      const tx = Math.min(finishZoneStart - 4, targetTile + offset);
      const curr = grid[13][tx];
      const next = grid[13][tx + 1];
      if (curr && curr.type !== 'lava' && next && next.type !== 'lava' && !grid[12][tx]) {
        return tx;
      }
    }
    return 4;
  };

  const cp1 = findSafeCheckpointX(Math.floor(width * 0.35));
  const cp2 = findSafeCheckpointX(Math.floor(width * 0.68));

  const timeLimit = Math.max(180, 420 - (cycleNumber - 1) * 30 - cycleIndex * 10);
  const enemySpeedMultiplier = spawnProfile.speedMultiplier;

  return {
    id: levelId,
    name: `INF-${stage}`,
    theme,
    biomeLabel: `CICLO ${cycleNumber} - ${biomeLabelMap[theme]}`,
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    marioStart: { x: 40, y: theme === 'underwater' ? 144 : 192 },
    flagX: flagXTile * 16,
    castleX: (castleXTile + 2) * 16,
    dryFinishStartX,
    pipeWarps,
    bgColor,
    timeLimit,
    endlessStage: stage,
    cycleNumber,
    seed: normalizedSeed,
    enemySpeedMultiplier,
    checkpoints: [
      { x: cp1 * 16, respawnPos: { x: cp1 * 16, y: theme === 'underwater' ? 160 : 192 } },
      { x: cp2 * 16, respawnPos: { x: cp2 * 16, y: theme === 'underwater' ? 160 : 192 } },
    ],
  };
}

export const SINGLEPLAYER_WORLD_COUNT = 7;
export const SINGLEPLAYER_STAGES_PER_WORLD = 5;

const SINGLEPLAYER_WORLD_THEMES: Record<number, [LevelData['theme'], LevelData['theme'], LevelData['theme'], LevelData['theme'], LevelData['theme']]> = {
  1: ['overworld', 'underground', 'overworld', 'ghost_house', 'castle'],
  2: ['overworld', 'underwater', 'underground', 'overworld', 'castle'],
  3: ['overworld', 'underwater', 'ghost_house', 'underground', 'castle'],
  4: ['underground', 'overworld', 'underwater', 'ghost_house', 'castle'],
  5: ['overworld', 'ghost_house', 'underground', 'underwater', 'castle'],
  6: ['ghost_house', 'underwater', 'underground', 'overworld', 'castle'],
  7: ['overworld', 'underground', 'underwater', 'ghost_house', 'castle'],
};

const SINGLEPLAYER_WORLD_NAMES: Record<number, string> = {
  1: 'PLANÍCIES INICIAIS',
  2: 'ARQUIPÉLAGO & GRUTAS',
  3: 'VALE ASSOMBRADO',
  4: 'CAVERNAS PROFUNDAS',
  5: 'TERRAS SOMBRIAS',
  6: 'ABISMO ESPECTRAL',
  7: 'REINO FINAL',
};

export interface SingleplayerLevelOverrides {
  seedOverride?: number;
  id?: string;
  name?: string;
  biomeLabel?: string;
  smwNodeId?: string;
  smwWorldName?: string;
  isFinalCastle?: boolean;
}

// Build a deterministic stage for Singleplayer 7-World x 5-Stage Campaign
export function createSingleplayerLevel(
  world: number = 1,
  stage: number = 1,
  overrides?: SingleplayerLevelOverrides
): LevelData {
  const w = Math.max(1, Math.min(SINGLEPLAYER_WORLD_COUNT, Math.floor(world)));
  const st = Math.max(1, Math.min(SINGLEPLAYER_STAGES_PER_WORLD, Math.floor(stage)));
  const overallIndex = (w - 1) * SINGLEPLAYER_STAGES_PER_WORLD + st; // 1..35
  const diffRatio = Math.min(1, (overallIndex - 1) / 34);

  const worldThemes = SINGLEPLAYER_WORLD_THEMES[w] || SINGLEPLAYER_WORLD_THEMES[1];
  const theme = worldThemes[st - 1] || 'overworld';
  const isFinalCastle =
    overrides?.isFinalCastle ?? (w === SINGLEPLAYER_WORLD_COUNT && st === SINGLEPLAYER_STAGES_PER_WORLD);

  // Deterministic Mulberry32 PRNG per (world, stage) or explicit seedOverride
  let s = (overrides?.seedOverride ?? (77000 + w * 1009 + st * 137)) >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const biomeLabelMap: Record<LevelData['theme'], string> = {
    overworld: 'SUPERFÍCIE',
    underground: 'CAVERNA',
    underwater: 'OCEANO',
    ghost_house: 'MANSÃO FANTASMA',
    castle: isFinalCastle ? 'CASTELO FINAL' : `CASTELO ${w}`,
  };

  const bgColor =
    theme === 'overworld'
      ? '#5c94fc'
      : theme === 'underground'
      ? '#000000'
      : theme === 'underwater'
      ? '#1840b8'
      : theme === 'ghost_house'
      ? '#120822'
      : '#140406';

  const groundTileType: TileType =
    theme === 'underground'
      ? 'underground_ground'
      : theme === 'castle'
      ? 'castle_stone'
      : theme === 'underwater'
      ? 'sea_ground'
      : theme === 'ghost_house'
      ? 'ghost_floor'
      : 'ground';

  const brickTileType: TileType =
    theme === 'underground'
      ? 'underground_brick'
      : theme === 'castle'
      ? 'hard_block'
      : theme === 'underwater'
      ? 'coral'
      : theme === 'ghost_house'
      ? 'ghost_brick'
      : 'brick';

  const width = Math.min(240, 155 + Math.floor(diffRatio * 80));
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const enemies: { type: EnemyType; x: number; y: number }[] = [];
  const coins: Point[] = [];
  const floatingPlatforms: FloatingPlatformSpec[] = [];

  const placeGroundSpan = (startX: number, spanLen: number) => {
    for (let i = 0; i < spanLen && startX + i < width; i++) {
      grid[13][startX + i] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][startX + i] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      if (theme === 'underground' || theme === 'castle' || theme === 'ghost_house') {
        const ceilType: TileType =
          theme === 'castle' ? 'castle_stone' : theme === 'ghost_house' ? 'ghost_brick' : 'underground_brick';
        grid[0][startX + i] = { type: ceilType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[1][startX + i] = { type: ceilType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
  };

  const placePit = (startX: number, gapLen: number) => {
    for (let i = 0; i < gapLen && startX + i < width; i++) {
      if (theme === 'castle') {
        grid[0][startX + i] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[1][startX + i] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[13][startX + i] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[14][startX + i] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
      } else if (theme === 'underground' || theme === 'ghost_house') {
        const ceilType: TileType = theme === 'ghost_house' ? 'ghost_brick' : 'underground_brick';
        grid[0][startX + i] = { type: ceilType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[1][startX + i] = { type: ceilType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    if (theme === 'castle' && gapLen >= 2 && rand() < 0.55 + diffRatio * 0.35) {
      const bubbleX = startX + Math.floor(gapLen / 2);
      enemies.push({ type: 'lava_bubble', x: bubbleX * 16 + 8, y: 13 * 16 });
    }
  };

  const pickPowerUp = (): 'coin' => {
    return 'coin';
  };

  const spawnProfile = EnemySpawnManager.getProfile(Math.max(1, Math.ceil(overallIndex / 2)), theme);

  const spawnEnemy = (tx: number, tyTile: number, forceType?: EnemyType) => {
    const type =
      forceType ?? EnemySpawnManager.pickEnemyType(Math.max(1, Math.ceil(overallIndex / 2)), theme, rand, { allowAerial: true });
    enemies.push(EnemySpawnManager.createSpawnSpec(type, tx, tyTile, rand));
  };

  let x = 0;
  placeGroundSpan(0, 15);
  // Decorative wall for ghost_house / castle entrance
  if (theme === 'ghost_house' || theme === 'castle') {
    for (let y = 2; y <= 12; y++) {
      grid[y][0] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }
  x = 15;

  const finishZoneStart =
    theme === 'castle' ? width - 30 : theme === 'underwater' ? width - 42 : width - 25;

  while (x < finishZoneStart) {
    const remaining = finishZoneStart - x;
    if (remaining < 10) {
      placeGroundSpan(x, remaining);
      x += remaining;
      break;
    }

    const r = rand();
    let chunkType: number;
    if (theme === 'ghost_house' && r > 0.45 && r < 0.72) {
      chunkType = 7; // Floating Ghost House platform bridge over abyss
    } else if (r < 0.25) chunkType = 0;
    else if (r < 0.42) chunkType = 1;
    else if (r < 0.58) chunkType = 2;
    else if (r < 0.72) chunkType = 3;
    else if (r < 0.85) chunkType = 4;
    else chunkType = 5;

    if (chunkType === 7 && remaining >= 12) {
      const gap = Math.min(remaining - 4, 8 + Math.floor(rand() * 3));
      placePit(x, gap);
      floatingPlatforms.push({
        x: (x + 2) * 16,
        y: (9 + Math.floor(rand() * 2)) * 16,
        width: 48,
        axis: rand() > 0.5 ? 'horizontal' : 'vertical',
        range: 24,
        speed: 0.033 + diffRatio * 0.01,
        phase: rand() * Math.PI,
      });
      if (gap >= 9) {
        floatingPlatforms.push({
          x: (x + gap - 4) * 16,
          y: 9 * 16,
          width: 48,
          axis: 'bob',
          range: 14,
          speed: 0.04,
          phase: 1.1,
        });
      }
      coins.push({ x: (x + Math.floor(gap / 2)) * 16 + 8, y: 6 * 16 });
      enemies.push({ type: 'boo', x: (x + Math.floor(gap / 2)) * 16, y: 6 * 16 });
      x += gap;
      const landLen = Math.min(remaining - gap, 4);
      placeGroundSpan(x, landLen);
      x += landLen;
    } else if (chunkType === 0) {
      const len = Math.min(remaining, 8 + Math.floor(rand() * 5));
      placeGroundSpan(x, len);
      const mid = x + Math.floor(len / 2);
      if (len >= 7) {
        grid[9][mid - 1] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        grid[9][mid] = { type: 'question', content: pickPowerUp(), bumpOffset: 0, bumpVel: 0 };
        grid[9][mid + 1] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      if (rand() > 0.76) {
        grid[5][x + 2] = {
          type: 'question',
          content: 'coin',
          bumpOffset: 0,
          bumpVel: 0,
          invisible: true,
        };
      }
      spawnEnemy(x + 2, 12);
      if (len >= 10 && rand() < 0.6 + diffRatio * 0.3) {
        spawnEnemy(x + len - 3, 12);
      }
      x += len;
    } else if (chunkType === 1) {
      const pLen = 8;
      placeGroundSpan(x, pLen);
      if (theme === 'castle' || theme === 'ghost_house') {
        const h1 = 2 + Math.floor(rand() * 2);
        for (let py = 13 - h1; py <= 12; py++) {
          grid[py][x + 2] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
          grid[py][x + 3] = { type: brickTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
        }
        spawnEnemy(x + 5, 12);
      } else {
        const pipeH = 2 + Math.floor(rand() * 2);
        placePipe(grid, x + 2, 12, pipeH);
        if (theme !== 'underwater' && rand() < spawnProfile.piranhaChance) {
          enemies.push({
            type: 'piranha',
            x: (x + 2) * 16 + 8,
            y: (13 - pipeH) * 16,
          });
        } else {
          spawnEnemy(x + 5, theme === 'underwater' ? 9 : 12);
        }
      }
      x += pLen;
    } else if (chunkType === 2) {
      const maxGap = w >= 4 ? 4 : 3;
      const gap = Math.min(remaining - 4, 2 + Math.floor(rand() * (maxGap - 1)));
      if (gap >= 2) {
        placePit(x, gap);
        for (let c = 0; c < gap; c++) {
          coins.push({ x: (x + c) * 16 + 8, y: 9 * 16 });
        }
        if (theme === 'ghost_house' && gap >= 4) {
          floatingPlatforms.push({
            x: (x + 1) * 16,
            y: 11 * 16,
            width: 36,
            axis: 'bob',
            range: 10,
            speed: 0.04,
            phase: 0.5,
          });
        }
        x += gap;
        const landLen = Math.min(remaining - gap, 3);
        placeGroundSpan(x, landLen);
        if (rand() < 0.65) {
          spawnEnemy(x + 1, 12);
        }
        x += landLen;
      } else {
        placeGroundSpan(x, 4);
        x += 4;
      }
    } else if (chunkType === 3) {
      const pillarCount = Math.min(3, Math.floor(remaining / 5));
      if (pillarCount >= 2) {
        for (let p = 0; p < pillarCount; p++) {
          const gap = 2 + (w >= 5 && rand() > 0.5 ? 1 : 0);
          placePit(x, gap);
          x += gap;
          const pillarW = 2;
          const pillarY = 10 + Math.floor(rand() * 2);
          placePit(x, pillarW);
          for (let px = 0; px < pillarW && x + px < finishZoneStart; px++) {
            for (let py = pillarY; py <= 14; py++) {
              grid[py][x + px] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
            }
          }
          coins.push({ x: x * 16 + 8, y: (pillarY - 2) * 16 });
          x += pillarW;
        }
        const safeSpan = Math.min(4, finishZoneStart - x);
        if (safeSpan > 0) {
          placeGroundSpan(x, safeSpan);
          x += safeSpan;
        }
      } else {
        placeGroundSpan(x, 4);
        x += 4;
      }
    } else if (chunkType === 4) {
      const stSize = Math.min(4, Math.floor((remaining - 3) / 2));
      if (stSize >= 2) {
        placeGroundSpan(x, stSize + 2);
        for (let step = 1; step <= stSize; step++) {
          for (let py = 13 - step; py <= 12; py++) {
            grid[py][x + step - 1] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
          }
        }
        spawnEnemy(x + stSize, 12);
        x += stSize + 2;
      } else {
        placeGroundSpan(x, remaining);
        x += remaining;
      }
    } else {
      const bLen = Math.min(remaining, 9 + Math.floor(rand() * 3));
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
      x += bLen;
    }
  }

  let flagXTile = width - 17;
  let castleXTile = width - 11;
  const levelId = overrides?.id ?? `sp-${w}-${st}`;
  let pipeWarps: LevelData['pipeWarps'] = undefined;
  let dryFinishStartX: number | undefined = undefined;

  if (theme === 'castle') {
    const approachEnd = Math.min(width - 25, Math.max(x + 2, finishZoneStart + 3));
    placeGroundSpan(x, approachEnd - x + 1);
    for (let sx = Math.max(x, approachEnd - 2); sx <= approachEnd; sx++) {
      grid[12][sx] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }

    const bridgeStart = approachEnd + 1;
    const axeTile = width - 11;
    for (let bx = bridgeStart; bx < axeTile; bx++) {
      grid[0][bx] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[1][bx] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[12][bx] = { type: 'bridge', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[13][bx] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][bx] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }

    const platMid = Math.floor((bridgeStart + axeTile) / 2);
    for (let ox = platMid - 2; ox <= platMid + 2; ox++) {
      grid[7][ox] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    for (let wy = 0; wy <= 8; wy++) {
      grid[wy][axeTile] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    grid[12][axeTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[11][axeTile] = { type: 'axe', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[13][axeTile] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][axeTile] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };

    const bowserXTile = Math.max(bridgeStart + 5, axeTile - 6);
    enemies.push({ type: 'bowser', x: bowserXTile * 16, y: 12 * 16 - 24 });

    placeGroundSpan(axeTile + 1, width - (axeTile + 1));
    castleXTile = width - 7;
    for (let cx = castleXTile; cx <= Math.min(width - 2, castleXTile + 4); cx++) {
      for (let cy = 8; cy <= 12; cy++) {
        grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      if (cx % 2 === 0) {
        grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    grid[11][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[12][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    for (let y = 2; y <= 12; y++) {
      grid[y][width - 1] = { type: 'castle_stone', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    flagXTile = 99999;
  } else if (theme === 'underwater') {
    const warpPipeTile = width - 38;
    const barrierStartTile = width - 33;
    const dryShoreStartTile = width - 30;
    const emergePipeTile = width - 25;
    const stairsStartTile = width - 21;
    flagXTile = width - 14;
    castleXTile = width - 10;
    dryFinishStartX = dryShoreStartTile * 16;

    for (let cx = Math.min(x, warpPipeTile - 1); cx < width; cx++) {
      for (let cy = 0; cy <= 12; cy++) {
        grid[cy][cx] = null;
      }
    }
    for (let sx = x; sx < dryShoreStartTile; sx++) {
      grid[13][sx] = { type: 'sea_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][sx] = { type: 'sea_ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    placePipe(grid, warpPipeTile, 12, 3, true);
    coins.push({ x: warpPipeTile * 16 + 16, y: 8 * 16 });
    for (let bx = barrierStartTile; bx < dryShoreStartTile; bx++) {
      for (let by = 0; by <= 12; by++) {
        grid[by][bx] = { type: 'coral', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    for (let gx = dryShoreStartTile; gx < width; gx++) {
      grid[13][gx] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][gx] = { type: 'ground', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    placePipe(grid, emergePipeTile, 12, 2);
    for (let step = 1; step <= 4; step++) {
      const sx = stairsStartTile + (step - 1);
      for (let sy = 13 - step; sy <= 12; sy++) {
        grid[sy][sx] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    grid[12][flagXTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    for (let y = 3; y <= 11; y++) {
      grid[y][flagXTile] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    grid[2][flagXTile] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };
    for (let cx = castleXTile; cx <= Math.min(width - 2, castleXTile + 5); cx++) {
      for (let cy = 8; cy <= 12; cy++) {
        grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      if (cx % 2 === 0) {
        grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    grid[11][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[12][castleXTile + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    pipeWarps = [
      {
        from: { x: warpPipeTile * 16, y: 9 * 16, width: 32, height: 16 },
        toLevel: levelId,
        toPos: { x: emergePipeTile * 16 + 8, y: 11 * 16 - 16 },
        type: 'down',
      },
    ];
  } else {
    // Open sky near flagpole & exit castle
    for (; x < width; x++) {
      grid[13][x] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][x] = { type: groundTileType, content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    flagXTile = width - 17;
    grid[12][flagXTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    for (let y = 3; y <= 11; y++) {
      grid[y][flagXTile] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    grid[2][flagXTile] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

    castleXTile = width - 11;
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
  }

  const findSafeCheckpointX = (targetTile: number): number => {
    for (let offset = 0; offset < 25; offset++) {
      const tx = Math.min(finishZoneStart - 4, targetTile + offset);
      const curr = grid[13][tx];
      const next = grid[13][tx + 1];
      if (curr && curr.type !== 'lava' && next && next.type !== 'lava' && !grid[12][tx]) {
        return tx;
      }
    }
    return 4;
  };

  const cp1 = findSafeCheckpointX(Math.floor(width * 0.36));
  const cp2 = findSafeCheckpointX(Math.floor(width * 0.68));
  const timeLimit = Math.max(240, 420 - w * 15);
  const enemySpeedMultiplier = 1 + diffRatio * 0.35;

  const defaultId = `sp-${w}-${st}`;
  const defaultName = `${w}-${st}`;
  const defaultBiomeLabel = `MUNDO ${w} (${SINGLEPLAYER_WORLD_NAMES[w]}) · ${biomeLabelMap[theme]}`;

  return {
    id: overrides?.id ?? defaultId,
    name: overrides?.name ?? defaultName,
    theme,
    biomeLabel: overrides?.biomeLabel ?? defaultBiomeLabel,
    width,
    height,
    tiles: grid,
    enemies,
    coins,
    floatingPlatforms: floatingPlatforms.length > 0 ? floatingPlatforms : undefined,
    marioStart: { x: 40, y: theme === 'underwater' ? 144 : 192 },
    flagX: flagXTile * 16,
    castleX: (castleXTile + 2) * 16,
    dryFinishStartX,
    pipeWarps,
    bgColor,
    timeLimit,
    seed: s,
    enemySpeedMultiplier,
    singleplayerWorld: w,
    singleplayerStage: st,
    isFinalCastle,
    smwNodeId: overrides?.smwNodeId,
    smwWorldName: overrides?.smwWorldName,
    checkpoints: [
      { x: cp1 * 16, respawnPos: { x: cp1 * 16, y: theme === 'underwater' ? 160 : 192 } },
      { x: cp2 * 16, respawnPos: { x: cp2 * 16, y: theme === 'underwater' ? 160 : 192 } },
    ],
  };
}

export const EDITOR_MAX_ENEMIES = 60;
export const EDITOR_MAX_COINS = 120;
export const EDITOR_MAX_FLOATING_PLATFORMS = 16;
export const EDITOR_MAX_YOSHIS = 4;
export const EDITOR_MAX_CARRYABLES = 16;
export const EDITOR_MAX_KEYHOLES = 4;
export const EDITOR_MAX_TOTAL_ENTITIES = 180;
export const EDITOR_MAX_CUSTOM_LEVELS = 10;

export function isCastleStageForYoshi(
  level: Pick<LevelData, 'theme' | 'isFinalCastle'> | null | undefined
): boolean {
  if (!level) return false;
  return level.theme === 'castle' || Boolean(level.isFinalCastle);
}

export interface CustomLevelEntityCounts {
  enemies: number;
  coins: number;
  floatingPlatforms: number;
  yoshis: number;
  carryables: number;
  keyholes: number;
  total: number;
}

export function getCustomLevelEntityCounts(level: LevelData): CustomLevelEntityCounts {
  const enemies = Array.isArray(level.enemies) ? level.enemies.length : 0;
  const coins = Array.isArray(level.coins) ? level.coins.length : 0;
  const floatingPlatforms = Array.isArray(level.floatingPlatforms) ? level.floatingPlatforms.length : 0;
  const yoshis = Array.isArray(level.yoshis) ? level.yoshis.length : 0;
  const carryables = Array.isArray(level.carryables) ? level.carryables.length : 0;
  const keyholes = Array.isArray(level.keyholes) ? level.keyholes.length : 0;
  return {
    enemies,
    coins,
    floatingPlatforms,
    yoshis,
    carryables,
    keyholes,
    total: enemies + coins + floatingPlatforms + yoshis + carryables + keyholes,
  };
}

export const STAGE_W_COINS_COUNT = 4;

function isSolidOrHazardForWCoin(tile: BlockTile | null | undefined): boolean {
  if (!tile) return false;
  return tile.type !== 'pole' && tile.type !== 'pole_top';
}

/**
 * Computes 4 well-spaced giant floating "W" Coin positions across playable stage terrain
 * (R1.16.OV.4), safely clear of spawn, solid blocks, hazards, and stage exits.
 */
export function computeStageWCoins(level: LevelData): { x: number; y: number }[] {
  if (level.wCoins && level.wCoins.length > 0) {
    return level.wCoins.slice(0, STAGE_W_COINS_COUNT).map(c => ({ ...c }));
  }

  const width = level.width;
  const height = level.height;
  if (width < 28 || height < 12) return [];

  let endTile = width - 10;
  if (level.flagX > 0 && level.flagX < 99000) {
    endTile = Math.min(endTile, Math.floor(level.flagX / 16) - 8);
  }
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const t = level.tiles[ty]?.[tx]?.type;
      if (t === 'axe' || t === 'yellow_switch' || t === 'yellow_switch_pressed') {
        endTile = Math.min(endTile, tx - 6);
      }
    }
  }

  const startTile = Math.max(15, Math.floor((level.marioStart?.x || 40) / 16) + 12);
  const span = Math.max(16, endTile - startTile);
  const ratios = [0.15, 0.4, 0.65, 0.88];
  const rowCandidates = level.theme === 'underwater' ? [6, 7, 5, 8, 9, 4] : [8, 7, 9, 6, 10, 5];

  const placed: { x: number; y: number }[] = [];

  for (const ratio of ratios) {
    const baseTx = Math.max(startTile, Math.min(endTile, Math.round(startTile + span * ratio)));
    let chosen: { x: number; y: number } | null = null;

    for (let radius = 0; radius <= 12 && !chosen; radius++) {
      const colOffsets = radius === 0 ? [0] : [radius, -radius];
      for (const dx of colOffsets) {
        if (chosen) break;
        const tx = baseTx + dx;
        if (tx < startTile - 2 || tx > endTile + 1 || tx + 1 >= width) continue;
        if (placed.some(p => Math.abs(p.x - tx * 16) < 48)) continue;

        const hasLavaAtCol =
          level.tiles[13]?.[tx]?.type === 'lava' ||
          level.tiles[14]?.[tx]?.type === 'lava' ||
          level.tiles[13]?.[tx + 1]?.type === 'lava';
        const hasFloorSupport =
          level.theme === 'underwater' ||
          Boolean(
            level.tiles[13]?.[tx] ||
              level.tiles[14]?.[tx] ||
              level.tiles[12]?.[tx] ||
              level.tiles[11]?.[tx]
          );
        if (hasLavaAtCol || !hasFloorSupport) continue;

        for (const ty of rowCandidates) {
          if (ty < 2 || ty + 1 >= height) continue;
          const clear2x2 =
            !isSolidOrHazardForWCoin(level.tiles[ty]?.[tx]) &&
            !isSolidOrHazardForWCoin(level.tiles[ty]?.[tx + 1]) &&
            !isSolidOrHazardForWCoin(level.tiles[ty + 1]?.[tx]) &&
            !isSolidOrHazardForWCoin(level.tiles[ty + 1]?.[tx + 1]);
          if (clear2x2) {
            chosen = { x: tx * 16 - 2, y: ty * 16 - 2 };
            break;
          }
        }
      }
    }

    if (!chosen) {
      chosen = { x: baseTx * 16 - 2, y: 7 * 16 - 2 };
    }
    placed.push(chosen);
  }

  return placed;
}

/**
 * Enforces safe entity caps on custom levels so browser volatile memory
 * and 60 FPS canvas/physics loops never overflow during editing or testing.
 */
export function sanitizeCustomLevelEntities(level: LevelData): {
  level: LevelData;
  truncated: boolean;
} {
  const cloned = cloneLevelData(level);
  const rawEnemies = Array.isArray(cloned.enemies) ? cloned.enemies : [];
  const rawCoins = Array.isArray(cloned.coins) ? cloned.coins : [];
  const rawPlatforms = Array.isArray(cloned.floatingPlatforms) ? cloned.floatingPlatforms : [];
  const rawYoshis = isCastleStageForYoshi(cloned)
    ? []
    : Array.isArray(cloned.yoshis)
    ? cloned.yoshis
    : [];
  const rawCarryables = Array.isArray(cloned.carryables) ? cloned.carryables : [];
  const rawKeyholes = Array.isArray(cloned.keyholes) ? cloned.keyholes : [];

  let truncated = false;
  if (isCastleStageForYoshi(cloned) && Array.isArray(level.yoshis) && level.yoshis.length > 0) {
    truncated = true;
  }

  let floatingPlatforms = rawPlatforms.slice(0, EDITOR_MAX_FLOATING_PLATFORMS);
  if (rawPlatforms.length > floatingPlatforms.length) truncated = true;

  let yoshis = rawYoshis.slice(0, EDITOR_MAX_YOSHIS);
  if (rawYoshis.length > yoshis.length) truncated = true;

  let carryables = rawCarryables.slice(0, EDITOR_MAX_CARRYABLES);
  if (rawCarryables.length > carryables.length) truncated = true;

  let keyholes = rawKeyholes.slice(0, EDITOR_MAX_KEYHOLES);
  if (rawKeyholes.length > keyholes.length) truncated = true;

  let enemies = rawEnemies.slice(0, EDITOR_MAX_ENEMIES);
  if (rawEnemies.length > enemies.length) truncated = true;

  let coins = rawCoins.slice(0, EDITOR_MAX_COINS);
  if (rawCoins.length > coins.length) truncated = true;

  // Enforce combined entity budget cleanly
  let remainingTotal = EDITOR_MAX_TOTAL_ENTITIES;
  if (floatingPlatforms.length > remainingTotal) {
    floatingPlatforms = floatingPlatforms.slice(0, remainingTotal);
    truncated = true;
  }
  remainingTotal -= floatingPlatforms.length;

  if (yoshis.length > remainingTotal) {
    yoshis = yoshis.slice(0, remainingTotal);
    truncated = true;
  }
  remainingTotal -= yoshis.length;

  if (carryables.length > remainingTotal) {
    carryables = carryables.slice(0, remainingTotal);
    truncated = true;
  }
  remainingTotal -= carryables.length;

  if (keyholes.length > remainingTotal) {
    keyholes = keyholes.slice(0, remainingTotal);
    truncated = true;
  }
  remainingTotal -= keyholes.length;

  if (enemies.length > remainingTotal) {
    enemies = enemies.slice(0, remainingTotal);
    truncated = true;
  }
  remainingTotal -= enemies.length;

  if (coins.length > remainingTotal) {
    coins = coins.slice(0, remainingTotal);
    truncated = true;
  }

  cloned.enemies = enemies;
  cloned.coins = coins;
  cloned.yoshis = yoshis.length > 0 ? yoshis : undefined;
  cloned.carryables = carryables.length > 0 ? carryables : undefined;
  cloned.keyholes = keyholes.length > 0 ? keyholes : undefined;
  if (Array.isArray(cloned.wCoins)) {
    cloned.wCoins = cloned.wCoins.slice(0, STAGE_W_COINS_COUNT);
  }
  cloned.floatingPlatforms = floatingPlatforms.length > 0 ? floatingPlatforms : undefined;
  if (Array.isArray(cloned.pipeWarps)) {
    cloned.pipeWarps = cloned.pipeWarps.filter(
      pw =>
        pw &&
        typeof pw.toLevel === 'string' &&
        pw.from.x >= 0 &&
        pw.from.x + pw.from.width <= cloned.width * 16 &&
        pw.from.y >= 0 &&
        pw.from.y + pw.from.height <= cloned.height * 16
    );
    pruneKeyCavePipeWarps(cloned);
    if (cloned.pipeWarps.length === 0) {
      cloned.pipeWarps = undefined;
    }
  }

  return { level: cloned, truncated };
}

export const KEY_CAVE_PIPE_TARGET = 'smw-wiki-1-secret' as const;

export function pruneKeyCavePipeWarps(level: LevelData): void {
  if (!level.pipeWarps || level.pipeWarps.length === 0) return;
  level.pipeWarps = level.pipeWarps.filter(pw => {
    if (pw.toLevel !== KEY_CAVE_PIPE_TARGET || pw.type !== 'down') return true;
    const lipTx = Math.floor(pw.from.x / 16);
    const lipTy = Math.floor((pw.from.y + pw.from.height) / 16);
    const leftTile = level.tiles[lipTy]?.[lipTx];
    const rightTile = level.tiles[lipTy]?.[lipTx + 1];
    return (
      leftTile?.type === 'pipe_warp_top_left' &&
      rightTile?.type === 'pipe_warp_top_right'
    );
  });
  if (level.pipeWarps.length === 0) {
    level.pipeWarps = undefined;
  }
}

export function placeKeyCavePipeInLevel(
  level: LevelData,
  tx: number,
  ty: number,
  pipeHeight: 2 | 3 | 4 = 2
): boolean {
  if (tx < 0 || tx + 1 >= level.width || ty < 0 || ty >= level.height) {
    return false;
  }
  const bottomY = Math.min(12, Math.max(3, ty));
  const topY = Math.max(2, bottomY - pipeHeight + 1);

  level.tiles[topY][tx] = { type: 'pipe_warp_top_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
  level.tiles[topY][tx + 1] = { type: 'pipe_warp_top_right', content: 'none', bumpOffset: 0, bumpVel: 0 };
  for (let py = topY + 1; py <= bottomY; py++) {
    level.tiles[py][tx] = { type: 'pipe_body_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
    level.tiles[py][tx + 1] = { type: 'pipe_body_right', content: 'none', bumpOffset: 0, bumpVel: 0 };
  }

  // Keep mouth unobstructed by Piranha Plants
  level.enemies = level.enemies.filter(
    e => !(e.type === 'piranha' && Math.abs(e.x - (tx * 16 + 8)) < 16)
  );

  const pipeLeftPx = tx * 16;
  const pipeRightPx = (tx + 2) * 16;
  const nextWarps = (level.pipeWarps || []).filter(
    pw => !(pw.type === 'down' && pw.from.x < pipeRightPx && pw.from.x + pw.from.width > pipeLeftPx)
  );
  nextWarps.push({
    from: { x: pipeLeftPx, y: (topY - 1) * 16, width: 32, height: 16 },
    toLevel: KEY_CAVE_PIPE_TARGET,
    toPos: { x: 2 * 16 + 8, y: 4 * 16 },
    type: 'down',
  });
  level.pipeWarps = nextWarps;
  pruneKeyCavePipeWarps(level);
  return true;
}

export function cloneLevelData(level: LevelData): LevelData {
  return {
    ...level,
    tiles: level.tiles.map(row => row.map(tile => (tile ? { ...tile } : null))),
    enemies: level.enemies.map(e => ({ ...e })),
    coins: level.coins.map(c => ({ ...c })),
    wCoins: level.wCoins ? level.wCoins.map(c => ({ ...c })) : undefined,
    marioStart: { ...level.marioStart },
    yoshis: level.yoshis ? level.yoshis.map(y => ({ ...y })) : undefined,
    carryables: level.carryables ? level.carryables.map(c => ({ ...c })) : undefined,
    keyholes: level.keyholes ? level.keyholes.map(k => ({ ...k })) : undefined,
    checkpoints: level.checkpoints
      ? level.checkpoints.map(cp => ({ x: cp.x, respawnPos: { ...cp.respawnPos } }))
      : undefined,
    floatingPlatforms: level.floatingPlatforms
      ? level.floatingPlatforms.map(fp => ({ ...fp }))
      : undefined,
    pipeWarps: level.pipeWarps
      ? level.pipeWarps.map(pw => ({
          ...pw,
          from: { ...pw.from },
          toPos: { ...pw.toPos },
        }))
      : undefined,
  };
}

export function createBlankCustomLevel(
  name: string = 'MINHA FASE 1',
  theme: LevelData['theme'] = 'overworld',
  widthTiles: number = 100,
  id?: string
): LevelData {
  const width = Math.max(40, Math.min(240, Math.floor(widthTiles)));
  const height = 15;
  const grid = createEmptyGrid(width, height);
  const groundType: TileType =
    theme === 'underground'
      ? 'underground_ground'
      : theme === 'underwater'
      ? 'sea_ground'
      : theme === 'castle'
      ? 'castle_stone'
      : theme === 'ghost_house'
      ? 'ghost_floor'
      : 'ground';

  const ceilingType: TileType =
    theme === 'castle' ? 'castle_stone' : theme === 'ghost_house' ? 'ghost_brick' : 'underground_brick';

  for (let x = 0; x < width; x++) {
    grid[13][x] = { type: groundType, content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[14][x] = { type: groundType, content: 'none', bumpOffset: 0, bumpVel: 0 };
    if (theme === 'underground' || theme === 'castle' || theme === 'ghost_house') {
      grid[0][x] = { type: ceilingType, content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[1][x] = { type: ceilingType, content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
  }

  const bgColor =
    theme === 'overworld'
      ? '#5c94fc'
      : theme === 'underground'
      ? '#000000'
      : theme === 'underwater'
      ? '#1840b8'
      : theme === 'ghost_house'
      ? '#120822'
      : '#140406';

  let flagX = (width - 12) * 16;
  let castleX = (width - 7) * 16;

  if (theme === 'castle') {
    const axeTile = width - 12;
    for (let bx = Math.max(10, axeTile - 10); bx < axeTile; bx++) {
      grid[12][bx] = { type: 'bridge', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[13][bx] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
      grid[14][bx] = { type: 'lava', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    grid[12][axeTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[11][axeTile] = { type: 'axe', content: 'none', bumpOffset: 0, bumpVel: 0 };
    flagX = 999999;
    castleX = (width - 4) * 16;
  } else {
    const flagTile = width - 12;
    grid[12][flagTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
    for (let y = 3; y <= 11; y++) {
      grid[y][flagTile] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
    }
    grid[2][flagTile] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };

    const cStart = width - 9;
    for (let cx = cStart; cx <= Math.min(width - 2, cStart + 4); cx++) {
      for (let cy = 8; cy <= 12; cy++) {
        grid[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
      if (cx % 2 === 0) {
        grid[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
      }
    }
    grid[11][cStart + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    grid[12][cStart + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
    flagX = flagTile * 16;
    castleX = (cStart + 2) * 16;
  }

  return {
    id: id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.toUpperCase().slice(0, 16) || 'CUSTOM',
    theme,
    biomeLabel: 'FASE DO JOGADOR',
    width,
    height,
    tiles: grid,
    enemies: [],
    coins: [],
    marioStart: { x: 48, y: theme === 'underwater' ? 144 : 192 },
    flagX,
    castleX,
    bgColor,
    timeLimit: 400,
    isCustom: true,
  };
}

const VALID_THEMES = new Set<LevelData['theme']>([
  'overworld',
  'underground',
  'castle',
  'underwater',
  'ghost_house',
]);

const THEME_DEFAULT_BG: Record<LevelData['theme'], string> = {
  overworld: '#5c94fc',
  underground: '#000000',
  underwater: '#1840b8',
  castle: '#140406',
  ghost_house: '#120822',
};

const VALID_TILE_TYPES = new Set<TileType>([
  'empty',
  'ground',
  'brick',
  'question',
  'question_empty',
  'hard_block',
  'pipe_top_left',
  'pipe_top_right',
  'pipe_body_left',
  'pipe_body_right',
  'pipe_warp_top_left',
  'pipe_warp_top_right',
  'pipe_horiz_top',
  'pipe_horiz_bottom',
  'pole',
  'pole_top',
  'castle_brick',
  'castle_stone',
  'castle_crenel',
  'castle_door',
  'castle_window',
  'underground_ground',
  'underground_brick',
  'coral',
  'sea_ground',
  'lava',
  'bridge',
  'axe',
  'ghost_floor',
  'ghost_brick',
  'exclam_yellow',
  'exclam_green',
  'exclam_red',
  'exclam_pink',
  'exclam_blue',
  'yellow_switch',
  'yellow_switch_pressed',
  'green_switch',
  'green_switch_pressed',
  'red_switch',
  'red_switch_pressed',
  'pink_switch',
  'pink_switch_pressed',
  'blue_switch',
  'blue_switch_pressed',
]);

const VALID_ITEM_CONTENTS = new Set<ItemContent>([
  'coin',
  'mushroom',
  'fireflower',
  'leaf',
  'feather',
  'femboy',
  'star',
  '1up',
  'none',
]);

export function isPowerUpBoxContent(content: ItemContent | undefined): boolean {
  return (
    content === 'mushroom' ||
    content === 'fireflower' ||
    content === 'leaf' ||
    content === 'feather' ||
    content === 'femboy' ||
    content === 'star' ||
    content === '1up'
  );
}

export function isSmwExclamTileType(type: TileType | undefined): boolean {
  return (
    type === 'exclam_yellow' ||
    type === 'exclam_green' ||
    type === 'exclam_red' ||
    type === 'exclam_pink' ||
    type === 'exclam_blue'
  );
}

/**
 * Remove todas as caixas de power-up (blocos com conteúdo de power-up),
 * preservando exclusivamente as caixas "[!]" do Modo Super Mario World (exclam_*).
 */
export function stripNonSmwPowerUpBoxes(level: LevelData): LevelData {
  for (let y = 0; y < level.tiles.length; y++) {
    const row = level.tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (!tile) continue;
      if (!isSmwExclamTileType(tile.type) && isPowerUpBoxContent(tile.content)) {
        tile.content = tile.type === 'question' ? 'coin' : 'none';
      }
    }
  }
  return level;
}

const VALID_ENEMY_TYPES = new Set<EnemyType>([
  'goomba',
  'koopa',
  'red_koopa',
  'paratroopa',
  'hammer_bro',
  'piranha',
  'blooper',
  'cheep_cheep',
  'fast_cheep',
  'bullet_bill',
  'bowser',
  'lava_bubble',
  'boo',
  'dry_bones',
]);

export interface ExportedLevelFile {
  format: 'smb-custom-level';
  version: 1;
  exportedAt: string;
  level: LevelData;
}

export function serializeLevelToFileJson(level: LevelData): string {
  const payload: ExportedLevelFile = {
    format: 'smb-custom-level',
    version: 1,
    exportedAt: new Date().toISOString(),
    level: {
      ...cloneLevelData(level),
      isCustom: true,
    },
  };
  return JSON.stringify(payload, null, 2);
}

export function getExportLevelFilename(levelName: string): string {
  const slug = levelName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'fase-mario'}.smb.json`;
}

export function parseImportedLevelFile(rawJson: string): LevelData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Arquivo JSON inválido ou corrompido.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Estrutura do arquivo de fase inválida.');
  }

  const candidateObj =
    'level' in parsed && parsed.level && typeof parsed.level === 'object'
      ? (parsed.level as Record<string, unknown>)
      : (parsed as Record<string, unknown>);

  if (!Array.isArray(candidateObj.tiles) || candidateObj.tiles.length === 0) {
    throw new Error('Arquivo não contém grade de blocos ("tiles") válida.');
  }

  const rawTheme = String(candidateObj.theme || 'overworld') as LevelData['theme'];
  const theme: LevelData['theme'] = VALID_THEMES.has(rawTheme) ? rawTheme : 'overworld';

  const height = 15;
  const rawWidth =
    typeof candidateObj.width === 'number' && Number.isFinite(candidateObj.width)
      ? candidateObj.width
      : Array.isArray(candidateObj.tiles[0])
      ? candidateObj.tiles[0].length
      : 100;
  const width = Math.max(20, Math.min(240, Math.floor(rawWidth)));

  const tiles: (BlockTile | null)[][] = [];
  for (let y = 0; y < height; y++) {
    const rawRow = Array.isArray(candidateObj.tiles[y]) ? (candidateObj.tiles[y] as unknown[]) : [];
    const row: (BlockTile | null)[] = [];
    for (let x = 0; x < width; x++) {
      const cell = rawRow[x];
      if (!cell || typeof cell !== 'object') {
        row.push(null);
        continue;
      }
      const c = cell as Record<string, unknown>;
      const type = String(c.type || '') as TileType;
      if (!VALID_TILE_TYPES.has(type) || type === 'empty') {
        row.push(null);
        continue;
      }
      const rawContent = String(c.content || 'none') as ItemContent;
      const content: ItemContent = VALID_ITEM_CONTENTS.has(rawContent) ? rawContent : 'none';
      const tile: BlockTile = {
        type,
        content,
        bumpOffset: 0,
        bumpVel: 0,
      };
      if (typeof c.coinsLeft === 'number' && Number.isFinite(c.coinsLeft) && c.coinsLeft > 0) {
        tile.coinsLeft = Math.floor(c.coinsLeft);
      }
      if (c.invisible === true) {
        tile.invisible = true;
      }
      row.push(tile);
    }
    tiles.push(row);
  }

  const enemies: LevelData['enemies'] = [];
  if (Array.isArray(candidateObj.enemies)) {
    for (const item of candidateObj.enemies) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const enemyType = String(e.type || '') as EnemyType;
      if (!VALID_ENEMY_TYPES.has(enemyType)) continue;
      if (typeof e.x !== 'number' || typeof e.y !== 'number') continue;
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
      enemies.push({
        type: enemyType,
        x: Math.max(0, Math.min(width * 16 - 8, e.x)),
        y: Math.max(0, Math.min(height * 16 - 8, e.y)),
      });
    }
  }

  const coins: LevelData['coins'] = [];
  if (Array.isArray(candidateObj.coins)) {
    for (const item of candidateObj.coins) {
      if (!item || typeof item !== 'object') continue;
      const c = item as Record<string, unknown>;
      if (typeof c.x !== 'number' || typeof c.y !== 'number') continue;
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
      coins.push({
        x: Math.max(0, Math.min(width * 16 - 8, c.x)),
        y: Math.max(0, Math.min(height * 16 - 8, c.y)),
      });
    }
  }

  const rawStart =
    candidateObj.marioStart && typeof candidateObj.marioStart === 'object'
      ? (candidateObj.marioStart as Record<string, unknown>)
      : {};
  const marioStartX =
    typeof rawStart.x === 'number' && Number.isFinite(rawStart.x)
      ? Math.max(0, Math.min((width - 2) * 16, rawStart.x))
      : 48;
  const marioStartY =
    typeof rawStart.y === 'number' && Number.isFinite(rawStart.y)
      ? Math.max(0, Math.min((height - 2) * 16, rawStart.y))
      : 192;

  const flagX =
    typeof candidateObj.flagX === 'number' && Number.isFinite(candidateObj.flagX)
      ? candidateObj.flagX
      : 999999;

  const castleX =
    typeof candidateObj.castleX === 'number' && Number.isFinite(candidateObj.castleX)
      ? candidateObj.castleX
      : Math.max(64, (width - 6) * 16);

  const rawName = typeof candidateObj.name === 'string' ? candidateObj.name.trim() : '';
  const name = (rawName || 'FASE IMPORTADA').toUpperCase().slice(0, 16);

  const rawBg = typeof candidateObj.bgColor === 'string' && candidateObj.bgColor.trim() ? candidateObj.bgColor.trim() : THEME_DEFAULT_BG[theme];
  const rawTime =
    typeof candidateObj.timeLimit === 'number' && Number.isFinite(candidateObj.timeLimit)
      ? Math.max(60, Math.min(999, Math.floor(candidateObj.timeLimit)))
      : 400;

  const floatingPlatforms: FloatingPlatformSpec[] = [];
  if (Array.isArray(candidateObj.floatingPlatforms)) {
    for (const item of candidateObj.floatingPlatforms) {
      if (!item || typeof item !== 'object') continue;
      const fp = item as Record<string, unknown>;
      if (typeof fp.x !== 'number' || typeof fp.y !== 'number') continue;
      if (!Number.isFinite(fp.x) || !Number.isFinite(fp.y)) continue;
      const axis =
        fp.axis === 'horizontal' || fp.axis === 'vertical' || fp.axis === 'bob' ? fp.axis : 'bob';
      floatingPlatforms.push({
        x: Math.max(0, Math.min(width * 16 - 16, fp.x)),
        y: Math.max(16, Math.min(height * 16 - 16, fp.y)),
        width:
          typeof fp.width === 'number' && Number.isFinite(fp.width)
            ? Math.max(24, Math.min(96, fp.width))
            : 48,
        height:
          typeof fp.height === 'number' && Number.isFinite(fp.height)
            ? Math.max(6, Math.min(16, fp.height))
            : 10,
        axis,
        range:
          typeof fp.range === 'number' && Number.isFinite(fp.range)
            ? Math.max(0, Math.min(80, fp.range))
            : 24,
        speed:
          typeof fp.speed === 'number' && Number.isFinite(fp.speed)
            ? Math.max(0.005, Math.min(0.15, fp.speed))
            : 0.035,
        phase: typeof fp.phase === 'number' && Number.isFinite(fp.phase) ? fp.phase : 0,
      });
    }
  }

  const yoshis: { x: number; y: number }[] = [];
  if (!isCastleStageForYoshi({ theme }) && Array.isArray(candidateObj.yoshis)) {
    for (const item of candidateObj.yoshis) {
      if (!item || typeof item !== 'object') continue;
      const yPos = item as Record<string, unknown>;
      if (typeof yPos.x !== 'number' || typeof yPos.y !== 'number') continue;
      if (!Number.isFinite(yPos.x) || !Number.isFinite(yPos.y)) continue;
      yoshis.push({
        x: Math.max(0, Math.min(width * 16 - 20, yPos.x)),
        y: Math.max(16, Math.min(height * 16 - 20, yPos.y)),
      });
    }
  }

  const carryables: CarryablePlacement[] = [];
  if (Array.isArray(candidateObj.carryables)) {
    for (const item of candidateObj.carryables) {
      if (!item || typeof item !== 'object') continue;
      const c = item as Record<string, unknown>;
      const kind = String(c.kind || '') as CarryableKind;
      if (kind !== 'key' && kind !== 'p_switch_blue' && kind !== 'p_switch_cyan') continue;
      if (typeof c.x !== 'number' || typeof c.y !== 'number') continue;
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
      carryables.push({
        kind,
        x: Math.max(0, Math.min(width * 16 - 16, c.x)),
        y: Math.max(16, Math.min(height * 16 - 16, c.y)),
      });
    }
  }

  const keyholes: KeyholePlacement[] = [];
  if (Array.isArray(candidateObj.keyholes)) {
    for (const item of candidateObj.keyholes) {
      if (!item || typeof item !== 'object') continue;
      const k = item as Record<string, unknown>;
      if (typeof k.x !== 'number' || typeof k.y !== 'number') continue;
      if (!Number.isFinite(k.x) || !Number.isFinite(k.y)) continue;
      keyholes.push({
        x: Math.max(0, Math.min(width * 16 - 16, k.x)),
        y: Math.max(16, Math.min(height * 16 - 24, k.y)),
      });
    }
  }

  const pipeWarps: NonNullable<LevelData['pipeWarps']> = [];
  if (Array.isArray(candidateObj.pipeWarps)) {
    for (const item of candidateObj.pipeWarps) {
      if (!item || typeof item !== 'object') continue;
      const pw = item as Record<string, unknown>;
      const fromObj = pw.from && typeof pw.from === 'object' ? (pw.from as Record<string, unknown>) : null;
      const toPosObj = pw.toPos && typeof pw.toPos === 'object' ? (pw.toPos as Record<string, unknown>) : null;
      const toLevel = typeof pw.toLevel === 'string' ? pw.toLevel.trim() : '';
      const warpType = pw.type === 'right' ? 'right' : pw.type === 'down' ? 'down' : null;
      if (!fromObj || !toPosObj || !toLevel || !warpType) continue;
      if (
        typeof fromObj.x !== 'number' ||
        typeof fromObj.y !== 'number' ||
        typeof fromObj.width !== 'number' ||
        typeof fromObj.height !== 'number' ||
        typeof toPosObj.x !== 'number' ||
        typeof toPosObj.y !== 'number'
      ) {
        continue;
      }
      if (
        !Number.isFinite(fromObj.x) ||
        !Number.isFinite(fromObj.y) ||
        !Number.isFinite(fromObj.width) ||
        !Number.isFinite(fromObj.height) ||
        !Number.isFinite(toPosObj.x) ||
        !Number.isFinite(toPosObj.y)
      ) {
        continue;
      }
      const w = Math.max(8, Math.min(48, fromObj.width));
      const h = Math.max(8, Math.min(80, fromObj.height));
      pipeWarps.push({
        from: {
          x: Math.max(0, Math.min(width * 16 - w, fromObj.x)),
          y: Math.max(0, Math.min(height * 16 - h, fromObj.y)),
          width: w,
          height: h,
        },
        toLevel,
        toPos: {
          x: Math.max(0, Math.min(240 * 16, toPosObj.x)),
          y: Math.max(0, Math.min(height * 16 - 16, toPosObj.y)),
        },
        type: warpType,
      });
    }
  }

  let wCoins: LevelData['wCoins'] = undefined;
  if (Array.isArray(candidateObj.wCoins)) {
    const parsedWC: { x: number; y: number }[] = [];
    for (const item of candidateObj.wCoins) {
      if (!item || typeof item !== 'object') continue;
      const wc = item as Record<string, unknown>;
      if (typeof wc.x !== 'number' || typeof wc.y !== 'number') continue;
      if (!Number.isFinite(wc.x) || !Number.isFinite(wc.y)) continue;
      parsedWC.push({
        x: Math.max(0, Math.min(width * 16 - 8, wc.x)),
        y: Math.max(0, Math.min(height * 16 - 8, wc.y)),
      });
    }
    wCoins = parsedWC.slice(0, STAGE_W_COINS_COUNT);
  }

  let checkpoints: LevelData['checkpoints'] = undefined;
  if (Array.isArray(candidateObj.checkpoints)) {
    const parsedCP: NonNullable<LevelData['checkpoints']> = [];
    for (const item of candidateObj.checkpoints) {
      if (!item || typeof item !== 'object') continue;
      const cp = item as Record<string, unknown>;
      const rp =
        cp.respawnPos && typeof cp.respawnPos === 'object'
          ? (cp.respawnPos as Record<string, unknown>)
          : null;
      if (
        typeof cp.x !== 'number' ||
        !Number.isFinite(cp.x) ||
        !rp ||
        typeof rp.x !== 'number' ||
        typeof rp.y !== 'number' ||
        !Number.isFinite(rp.x) ||
        !Number.isFinite(rp.y)
      ) {
        continue;
      }
      parsedCP.push({
        x: Math.max(0, Math.min(width * 16 - 16, cp.x)),
        respawnPos: {
          x: Math.max(0, Math.min((width - 2) * 16, rp.x)),
          y: Math.max(0, Math.min((height - 2) * 16, rp.y)),
        },
      });
    }
    if (parsedCP.length > 0) checkpoints = parsedCP;
  }

  const rawMusic = typeof candidateObj.musicTrack === 'string' ? candidateObj.musicTrack : '';
  const musicTrack: LevelData['musicTrack'] =
    rawMusic === 'overworld' ||
    rawMusic === 'underground' ||
    rawMusic === 'underwater' ||
    rawMusic === 'castle' ||
    rawMusic === 'ghost_house' ||
    rawMusic === 'bonus'
      ? rawMusic
      : undefined;

  const useBonusBackdrop = candidateObj.useBonusBackdrop === true ? true : undefined;
  const dryFinishStartX =
    typeof candidateObj.dryFinishStartX === 'number' && Number.isFinite(candidateObj.dryFinishStartX)
      ? Math.max(0, Math.min(width * 16, candidateObj.dryFinishStartX))
      : undefined;
  const bossName =
    typeof candidateObj.bossName === 'string' && candidateObj.bossName.trim()
      ? candidateObj.bossName.trim()
      : undefined;
  const smwNodeId =
    typeof candidateObj.smwNodeId === 'string' && candidateObj.smwNodeId.trim()
      ? candidateObj.smwNodeId.trim()
      : undefined;
  const smwWorldName =
    typeof candidateObj.smwWorldName === 'string' && candidateObj.smwWorldName.trim()
      ? candidateObj.smwWorldName.trim()
      : undefined;
  const isFinalCastle =
    typeof candidateObj.isFinalCastle === 'boolean' ? candidateObj.isFinalCastle : undefined;
  const biomeLabel =
    typeof candidateObj.biomeLabel === 'string' && candidateObj.biomeLabel.trim()
      ? candidateObj.biomeLabel.trim()
      : 'FASE DO JOGADOR';

  return stripNonSmwPowerUpBoxes(
    sanitizeCustomLevelEntities({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      theme,
      biomeLabel,
      width,
      height,
      tiles,
      enemies,
      coins,
      wCoins,
      yoshis: yoshis.length > 0 ? yoshis : undefined,
      carryables: carryables.length > 0 ? carryables : undefined,
      keyholes: keyholes.length > 0 ? keyholes : undefined,
      floatingPlatforms: floatingPlatforms.length > 0 ? floatingPlatforms : undefined,
      pipeWarps: pipeWarps.length > 0 ? pipeWarps : undefined,
      checkpoints,
      musicTrack,
      useBonusBackdrop,
      dryFinishStartX,
      bossName,
      smwNodeId,
      smwWorldName,
      isFinalCastle,
      marioStart: { x: marioStartX, y: marioStartY },
      flagX,
      castleX,
      bgColor: rawBg,
      timeLimit: rawTime,
      isCustom: true,
    }).level
  );
}

export interface WorldStageJsonDefaults {
  id: string;
  name: string;
  smwNodeId?: string;
  smwWorldName?: string;
  biomeLabel?: string;
  isFinalCastle?: boolean;
  bossName?: string;
}

export function parseWorldStageFromJson(
  rawJsonData: unknown,
  defaults: WorldStageJsonDefaults
): LevelData {
  const rawJsonString =
    typeof rawJsonData === 'string' ? rawJsonData : JSON.stringify(rawJsonData);
  const parsed = parseImportedLevelFile(rawJsonString);
  const rootObj =
    rawJsonData && typeof rawJsonData === 'object'
      ? (rawJsonData as Record<string, unknown>)
      : {};
  const levelObj =
    'level' in rootObj && rootObj.level && typeof rootObj.level === 'object'
      ? (rootObj.level as Record<string, unknown>)
      : rootObj;
  const rawName =
    typeof levelObj.name === 'string' && levelObj.name.trim()
      ? levelObj.name.trim().toUpperCase().slice(0, 16)
      : defaults.name;
  const rawBiome =
    typeof levelObj.biomeLabel === 'string' && levelObj.biomeLabel.trim()
      ? levelObj.biomeLabel.trim()
      : defaults.biomeLabel || parsed.biomeLabel;

  return {
    ...parsed,
    id: defaults.id,
    name: rawName,
    biomeLabel: rawBiome,
    smwNodeId: defaults.smwNodeId ?? parsed.smwNodeId,
    smwWorldName: defaults.smwWorldName ?? parsed.smwWorldName,
    isFinalCastle: defaults.isFinalCastle ?? parsed.isFinalCastle ?? false,
    bossName: parsed.bossName ?? defaults.bossName,
    isCustom: false,
  };
}



