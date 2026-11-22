/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockTile, ItemContent, LevelData, SmwSwitchColor, TileType } from './types.ts';
import {
  createSingleplayerLevel,
  createWorldGhostHouse,
  cloneLevelData,
} from './levels.ts';

export const SMW_BETA_VERSION = 'Beta V0.9';
export const SMW_WORLD_ISLAND_NAME = 'Ilha WikiWorldWeb';

export const SMW_INTRO_STORY =
  'Olá, seja bem vindo ao mundo fantastico de WazzimaGiygg. Parece que desta vez o problema também é o caluniador, de nome Chronus, junto com Bowser. Vamos explorar os mundos para poder salvar a princesa femboy';

export type SmwIslandId = 'wikiworld' | 'island2';

export const SMW_ISLAND2_UNAVAILABLE_MSG = '(Versão Beta) ainda não disponível para jogar';

export interface SmwIslandInfo {
  id: SmwIslandId;
  number: number;
  name: string;
  subtitle: string;
  playable: boolean;
}

export const SMW_ISLANDS: SmwIslandInfo[] = [
  {
    id: 'wikiworld',
    number: 1,
    name: SMW_WORLD_ISLAND_NAME,
    subtitle: 'Ilha 1 · 6 fases jogáveis',
    playable: true,
  },
  {
    id: 'island2',
    number: 2,
    name: 'Ilha 2 · Terras de Chronus',
    subtitle: SMW_ISLAND2_UNAVAILABLE_MSG,
    playable: false,
  },
];

export const JOHANNNNES_CASTLE_1_BOSS_NAME = 'Lorde Ignis Koopa';

export interface SmwMapNode {
  id: string;
  order: number;
  code: string;
  title: string;
  subtitle: string;
  bossName?: string;
  theme: LevelData['theme'];
  mapX: number;
  mapY: number;
  isCastle?: boolean;
  isSwitchPalace?: boolean;
  switchColor?: SmwSwitchColor;
  unlocksAfterNodeId?: string;
  unlocksAfterSecretNodeId?: string;
  betaPlaceholderMessage?: string;
}

export interface SmwDevSwitchPalaceInfo {
  id: string;
  code: string;
  color: SmwSwitchColor;
  title: string;
  rewardLabel: string;
}

export const SMW_DEV_ONLY_SWITCH_PALACES: SmwDevSwitchPalaceInfo[] = [
  {
    id: 'wiki-switch-green',
    code: 'PV',
    color: 'green',
    title: 'Palácio Interruptor Verde',
    rewardLabel: 'Bloco [!] Verde · Pena (Cape)',
  },
  {
    id: 'wiki-switch-red',
    code: 'PR',
    color: 'red',
    title: 'Palácio Interruptor Vermelho',
    rewardLabel: 'Bloco [!] Vermelho · Flor de Fogo',
  },
  {
    id: 'wiki-switch-pink',
    code: 'PP',
    color: 'pink',
    title: 'Palácio Interruptor Rosa',
    rewardLabel: 'Bloco [!] Rosa · Laço Femboy',
  },
  {
    id: 'wiki-switch-blue',
    code: 'PB',
    color: 'blue',
    title: 'Palácio Interruptor Azul',
    rewardLabel: 'Bloco [!] Azul · Tanooki',
  },
];

export const SMW_WIKIWORLD_NODES: SmwMapNode[] = [
  {
    id: 'wiki-1-overworld',
    order: 0,
    code: 'W-1',
    title: 'Overworld',
    subtitle: 'Planícies iniciais da Ilha WikiWorldWeb',
    theme: 'overworld',
    mapX: 16,
    mapY: 64,
  },
  {
    id: 'wiki-2-caverna',
    order: 1,
    code: 'W-2',
    title: 'Caverna',
    subtitle: 'Grutas subterrâneas e túneis de pedra',
    theme: 'underground',
    mapX: 34,
    mapY: 41,
    unlocksAfterNodeId: 'wiki-1-overworld',
  },
  {
    id: 'wiki-3-agua',
    order: 2,
    code: 'W-3',
    title: 'Água',
    subtitle: 'Lagoa costeira com recifes e corais',
    theme: 'underwater',
    mapX: 51,
    mapY: 66,
    unlocksAfterNodeId: 'wiki-2-caverna',
  },
  {
    id: 'wiki-4-mansao',
    order: 3,
    code: 'W-4',
    title: 'Mansão Fantasma',
    subtitle: 'Boos, Dry Bones e salões assombrados',
    theme: 'ghost_house',
    mapX: 68,
    mapY: 38,
    unlocksAfterNodeId: 'wiki-3-agua',
  },
  {
    id: 'wiki-5-castelo',
    order: 4,
    code: 'W-5',
    title: 'Castelo de Johannnnes89',
    subtitle: `Fortaleza final da ilha · 1º Chefe: ${JOHANNNNES_CASTLE_1_BOSS_NAME}`,
    bossName: JOHANNNNES_CASTLE_1_BOSS_NAME,
    theme: 'castle',
    mapX: 85,
    mapY: 53,
    isCastle: true,
    unlocksAfterNodeId: 'wiki-4-mansao',
  },
  {
    id: 'wiki-switch-yellow',
    order: 5,
    code: 'PA',
    title: 'Palácio Interruptor Amarelo',
    subtitle: 'Saída secreta de W-1 (cano do subsolo · Chave + Fechadura). Ativa blocos [!] amarelos',
    theme: 'underground',
    mapX: 29,
    mapY: 72,
    isSwitchPalace: true,
    switchColor: 'yellow',
    unlocksAfterSecretNodeId: 'wiki-1-overworld',
  },
];

export interface SmwPathSegment {
  fromId: string;
  toId: string;
  fromOrder: number;
  toOrder: number;
  p0: [number, number];
  c1: [number, number];
  c2: [number, number];
  p1: [number, number];
}

export const SMW_PATH_SEGMENTS: SmwPathSegment[] = [
  {
    fromId: 'wiki-1-overworld',
    toId: 'wiki-2-caverna',
    fromOrder: 0,
    toOrder: 1,
    p0: [16, 64],
    c1: [24, 62],
    c2: [25, 44],
    p1: [34, 41],
  },
  {
    fromId: 'wiki-2-caverna',
    toId: 'wiki-3-agua',
    fromOrder: 1,
    toOrder: 2,
    p0: [34, 41],
    c1: [42, 40],
    c2: [43, 64],
    p1: [51, 66],
  },
  {
    fromId: 'wiki-3-agua',
    toId: 'wiki-4-mansao',
    fromOrder: 2,
    toOrder: 3,
    p0: [51, 66],
    c1: [60, 64],
    c2: [59, 41],
    p1: [68, 38],
  },
  {
    fromId: 'wiki-4-mansao',
    toId: 'wiki-5-castelo',
    fromOrder: 3,
    toOrder: 4,
    p0: [68, 38],
    c1: [77, 36],
    c2: [77, 54],
    p1: [85, 53],
  },
  {
    fromId: 'wiki-1-overworld',
    toId: 'wiki-switch-yellow',
    fromOrder: 0,
    toOrder: 5,
    p0: [16, 64],
    c1: [19, 71],
    c2: [24, 73],
    p1: [29, 72],
  },
];

export const SMW_ISLAND2_NODES: SmwMapNode[] = [
  {
    id: 'island2-1-entrada',
    order: 0,
    code: '2-1',
    title: 'Fase 2-1',
    subtitle: SMW_ISLAND2_UNAVAILABLE_MSG,
    theme: 'overworld',
    mapX: 28,
    mapY: 59,
    betaPlaceholderMessage: SMW_ISLAND2_UNAVAILABLE_MSG,
  },
  {
    id: 'island2-2-ruinas',
    order: 1,
    code: '2-2',
    title: 'Fase 2-2',
    subtitle: SMW_ISLAND2_UNAVAILABLE_MSG,
    theme: 'underground',
    mapX: 52,
    mapY: 42,
    unlocksAfterNodeId: 'island2-1-entrada',
    betaPlaceholderMessage: SMW_ISLAND2_UNAVAILABLE_MSG,
  },
  {
    id: 'island2-3-fortaleza',
    order: 2,
    code: '2-C',
    title: 'Fortaleza de Chronus',
    subtitle: SMW_ISLAND2_UNAVAILABLE_MSG,
    theme: 'castle',
    mapX: 75,
    mapY: 55,
    isCastle: true,
    unlocksAfterNodeId: 'island2-2-ruinas',
    betaPlaceholderMessage: SMW_ISLAND2_UNAVAILABLE_MSG,
  },
];

export const SMW_ISLAND2_PATH_SEGMENTS: SmwPathSegment[] = [
  {
    fromId: 'island2-1-entrada',
    toId: 'island2-2-ruinas',
    fromOrder: 0,
    toOrder: 1,
    p0: [28, 59],
    c1: [38, 55],
    c2: [43, 44],
    p1: [52, 42],
  },
  {
    fromId: 'island2-2-ruinas',
    toId: 'island2-3-fortaleza',
    fromOrder: 1,
    toOrder: 2,
    p0: [52, 42],
    c1: [62, 40],
    c2: [66, 54],
    p1: [75, 55],
  },
];

export function evaluateSmwPathSegment(
  seg: SmwPathSegment,
  t: number
): { x: number; y: number; dx: number; dy: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x =
    uuu * seg.p0[0] +
    3 * uu * t * seg.c1[0] +
    3 * u * tt * seg.c2[0] +
    ttt * seg.p1[0];
  const y =
    uuu * seg.p0[1] +
    3 * uu * t * seg.c1[1] +
    3 * u * tt * seg.c2[1] +
    ttt * seg.p1[1];

  const dx =
    3 * uu * (seg.c1[0] - seg.p0[0]) +
    6 * u * t * (seg.c2[0] - seg.c1[0]) +
    3 * tt * (seg.p1[0] - seg.c2[0]);
  const dy =
    3 * uu * (seg.c1[1] - seg.p0[1]) +
    6 * u * t * (seg.c2[1] - seg.c1[1]) +
    3 * tt * (seg.p1[1] - seg.c2[1]);

  return { x, y, dx, dy };
}

export interface SmwWalkStep {
  seg: SmwPathSegment;
  reverse: boolean;
}

export function findSmwMapPath(
  fromNodeId: string,
  toNodeId: string,
  segments: SmwPathSegment[] = SMW_PATH_SEGMENTS
): SmwWalkStep[] {
  if (fromNodeId === toNodeId) return [];

  const queue: { nodeId: string; steps: SmwWalkStep[] }[] = [{ nodeId: fromNodeId, steps: [] }];
  const visited = new Set<string>([fromNodeId]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const seg of segments) {
      let nextId: string | null = null;
      let reverse = false;
      if (seg.fromId === curr.nodeId) {
        nextId = seg.toId;
        reverse = false;
      } else if (seg.toId === curr.nodeId) {
        nextId = seg.fromId;
        reverse = true;
      }
      if (!nextId || visited.has(nextId)) continue;
      const nextSteps = [...curr.steps, { seg, reverse }];
      if (nextId === toNodeId) return nextSteps;
      visited.add(nextId);
      queue.push({ nodeId: nextId, steps: nextSteps });
    }
  }

  return [];
}

/**
 * Resolves graph-connected neighbor movement along the World Map roads so the player
 * can walk both forward and backward through every unlocked stage (R1.16.UC.4).
 */
export function resolveSmwDirectionalStep(
  fromNodeId: string,
  direction: 'up' | 'down' | 'left' | 'right',
  progress: SmwBetaProgress,
  islandId: SmwIslandId = 'wikiworld'
): SmwMapNode | null {
  const nodes = islandId === 'island2' ? SMW_ISLAND2_NODES : SMW_WIKIWORLD_NODES;
  const segments = islandId === 'island2' ? SMW_ISLAND2_PATH_SEGMENTS : SMW_PATH_SEGMENTS;
  const current = nodes.find(n => n.id === fromNodeId);
  if (!current) return null;

  const ux = direction === 'right' ? 1 : direction === 'left' ? -1 : 0;
  const uy = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;

  // 1. Collect road-connected neighbors that are unlocked
  const neighborIds = new Set<string>();
  for (const seg of segments) {
    if (seg.fromId === fromNodeId) neighborIds.add(seg.toId);
    else if (seg.toId === fromNodeId) neighborIds.add(seg.fromId);
  }

  let bestNeighbor: SmwMapNode | null = null;
  let bestScore = -Infinity;

  for (const nid of neighborIds) {
    const cand = nodes.find(n => n.id === nid);
    if (!cand) continue;
    const isAccessible =
      islandId === 'island2'
        ? cand.order === 0
        : isSmwNodeUnlocked(cand.id, progress);
    if (!isAccessible) continue;

    const dx = cand.mapX - current.mapX;
    const dy = cand.mapY - current.mapY;
    const len = Math.hypot(dx, dy) || 1;
    const dot = (dx / len) * ux + (dy / len) * uy;
    if (dot > 0.12 && dot > bestScore) {
      bestScore = dot;
      bestNeighbor = cand;
    }
  }

  return bestNeighbor;
}

function makeTile(type: BlockTile['type'], content: BlockTile['content'] = 'none'): BlockTile {
  return {
    type,
    content,
    bumpOffset: 0,
    bumpVel: 0,
  };
}

function placeYellowExclamBlocks(level: LevelData, targetCols: number[], preferredY: number = 9): LevelData {
  const maxSafeCol = level.width - 14;
  for (const col of targetCols) {
    let placed = false;
    const colOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];
    const rowCandidates = [preferredY, 9, 10, 8];

    for (const y of rowCandidates) {
      if (placed) break;
      if (y < 4 || y > 10) continue;
      for (const dx of colOffsets) {
        const x = col + dx;
        if (x < 4 || x >= maxSafeCol) continue;
        const curr = level.tiles[y]?.[x];
        const above = level.tiles[y - 1]?.[x];
        const below1 = level.tiles[y + 1]?.[x];
        const below2 = level.tiles[y + 2]?.[x];
        const hasFloorSupport = Boolean(
          level.tiles[13]?.[x] || level.tiles[14]?.[x] || level.tiles[12]?.[x]
        );
        if (
          curr === null &&
          above === null &&
          below1 === null &&
          below2 === null &&
          hasFloorSupport
        ) {
          level.tiles[y][x] = makeTile('exclam_yellow', 'mushroom');
          placed = true;
          break;
        }
      }
    }
  }
  return level;
}

export function createYellowSwitchPalaceStage(): LevelData {
  const width = 90;
  const height = 15;
  const tiles: (BlockTile | null)[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );

  // Enclosed golden palace ceiling & solid stone/gold floor
  for (let x = 0; x < width; x++) {
    tiles[0][x] = makeTile('hard_block');
    tiles[1][x] = makeTile('hard_block');
    const isLavaPool = (x >= 44 && x <= 45) || (x >= 58 && x <= 59);
    if (isLavaPool) {
      tiles[13][x] = makeTile('lava');
      tiles[14][x] = makeTile('lava');
    } else {
      tiles[13][x] = makeTile('hard_block');
      tiles[14][x] = makeTile('hard_block');
    }
  }

  // Left and right palace chamber walls
  for (let y = 2; y <= 12; y++) {
    tiles[y][0] = makeTile('hard_block');
    tiles[y][1] = makeTile('hard_block');
    tiles[y][width - 3] = makeTile('hard_block');
    tiles[y][width - 2] = makeTile('hard_block');
    tiles[y][width - 1] = makeTile('hard_block');
  }

  // Section 1: Welcome showcase (locked Yellow [!] outline)
  tiles[9][9] = makeTile('exclam_yellow', 'mushroom');
  tiles[9][13] = makeTile('brick');
  tiles[9][14] = makeTile('brick');
  tiles[9][15] = makeTile('brick');

  // Section 2: Iconic SMW Switch Palace Coin & Brick platform room
  for (let x = 22; x <= 36; x++) {
    tiles[10][x] = makeTile('hard_block');
  }
  tiles[6][29] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, coinsLeft: 5 };
  tiles[6][28] = makeTile('brick');
  tiles[6][30] = makeTile('brick');

  // Section 3: Golden bridges & stepped blocks over two small lava pools
  tiles[10][44] = makeTile('brick');
  tiles[10][45] = makeTile('brick');
  tiles[9][50] = makeTile('exclam_yellow', 'mushroom');

  tiles[11][54] = makeTile('hard_block');
  tiles[11][55] = makeTile('hard_block');
  tiles[10][56] = makeTile('hard_block');
  tiles[10][57] = makeTile('hard_block');
  tiles[11][60] = makeTile('hard_block');
  tiles[11][61] = makeTile('hard_block');

  // Section 4: Grand Altar of the Giant Yellow Switch
  tiles[12][68] = makeTile('hard_block');
  tiles[12][69] = makeTile('hard_block');
  tiles[11][70] = makeTile('hard_block');
  for (let x = 71; x <= 82; x++) {
    tiles[11][x] = makeTile('hard_block');
    tiles[12][x] = makeTile('hard_block');
  }
  // Pillars framing the Yellow Switch dais
  for (let y = 3; y <= 10; y++) {
    tiles[y][83] = makeTile('hard_block');
  }
  // Giant Yellow Switch Button atop the altar!
  tiles[10][77] = makeTile('yellow_switch');

  // Decorative floating coins across the Switch Palace (classic SMW coin shower feel)
  const coins: { x: number; y: number }[] = [];
  for (let x = 5; x <= 8; x++) {
    coins.push({ x: x * 16, y: 11 * 16 });
  }
  for (let x = 24; x <= 34; x++) {
    if (x >= 28 && x <= 30) continue;
    coins.push({ x: x * 16, y: 7 * 16 });
    coins.push({ x: x * 16, y: 8 * 16 });
  }
  coins.push({ x: 44 * 16, y: 8 * 16 }, { x: 45 * 16, y: 8 * 16 });
  coins.push({ x: 58 * 16, y: 8 * 16 }, { x: 59 * 16, y: 8 * 16 });
  // Celebratory crown of coins above the Yellow Switch
  coins.push(
    { x: 75 * 16, y: 8 * 16 },
    { x: 76 * 16, y: 7 * 16 },
    { x: 77 * 16, y: 6 * 16 },
    { x: 78 * 16, y: 7 * 16 },
    { x: 79 * 16, y: 8 * 16 }
  );

  return {
    id: 'smw-wiki-switch-yellow',
    name: 'PA',
    theme: 'underground',
    width,
    height,
    tiles,
    enemies: [
      { type: 'goomba', x: 18 * 16, y: 12 * 16 },
      { type: 'koopa', x: 25 * 16, y: 11 * 16 },
      { type: 'koopa', x: 33 * 16, y: 11 * 16 },
      { type: 'goomba', x: 39 * 16, y: 12 * 16 },
      { type: 'paratroopa', x: 52 * 16, y: 8 * 16 },
    ],
    coins,
    marioStart: { x: 3 * 16, y: 11 * 16 },
    flagX: 999999,
    castleX: 999999,
    bgColor: '#0c1230',
    musicTrack: 'bonus',
    useBonusBackdrop: true,
    timeLimit: 200,
    biomeLabel: 'WIKIWORLDWEB · PALÁCIO AMARELO',
    checkpoints: [{ x: 41 * 16, respawnPos: { x: 41 * 16, y: 11 * 16 } }],
    smwNodeId: 'wiki-switch-yellow',
    smwWorldName: SMW_WORLD_ISLAND_NAME,
    isFinalCastle: false,
  };
}

export function createColoredSwitchPalaceStage(color: Exclude<SmwSwitchColor, 'yellow'>): LevelData {
  const specs: Record<
    Exclude<SmwSwitchColor, 'yellow'>,
    {
      nodeId: string;
      id: string;
      code: string;
      biomeLabel: string;
      bgColor: string;
      exclamTile: TileType;
      exclamContent: ItemContent;
      switchTile: TileType;
    }
  > = {
    green: {
      nodeId: 'wiki-switch-green',
      id: 'smw-wiki-switch-green',
      code: 'PV',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO VERDE',
      bgColor: '#0c1230',
      exclamTile: 'exclam_green',
      exclamContent: 'feather',
      switchTile: 'green_switch',
    },
    red: {
      nodeId: 'wiki-switch-red',
      id: 'smw-wiki-switch-red',
      code: 'PR',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO VERMELHO',
      bgColor: '#0c1230',
      exclamTile: 'exclam_red',
      exclamContent: 'fireflower',
      switchTile: 'red_switch',
    },
    pink: {
      nodeId: 'wiki-switch-pink',
      id: 'smw-wiki-switch-pink',
      code: 'PP',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO ROSA',
      bgColor: '#0c1230',
      exclamTile: 'exclam_pink',
      exclamContent: 'femboy',
      switchTile: 'pink_switch',
    },
    blue: {
      nodeId: 'wiki-switch-blue',
      id: 'smw-wiki-switch-blue',
      code: 'PB',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO AZUL',
      bgColor: '#0c1230',
      exclamTile: 'exclam_blue',
      exclamContent: 'leaf',
      switchTile: 'blue_switch',
    },
  };

  const spec = specs[color];
  const width = 90;
  const height = 15;
  const tiles: (BlockTile | null)[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );

  // Enclosed Switch Palace ceiling & solid floor with two hazardous gaps
  for (let x = 0; x < width; x++) {
    tiles[0][x] = makeTile('hard_block');
    tiles[1][x] = makeTile('hard_block');
    const isHazard =
      color === 'green'
        ? (x >= 42 && x <= 44) || (x >= 57 && x <= 59)
        : color === 'red'
        ? (x >= 40 && x <= 43) || (x >= 56 && x <= 59)
        : color === 'pink'
        ? (x >= 43 && x <= 45) || (x >= 58 && x <= 60)
        : (x >= 41 && x <= 43) || (x >= 55 && x <= 57);
    if (isHazard) {
      tiles[13][x] = makeTile('lava');
      tiles[14][x] = makeTile('lava');
    } else {
      tiles[13][x] = makeTile('hard_block');
      tiles[14][x] = makeTile('hard_block');
    }
  }

  for (let y = 2; y <= 12; y++) {
    tiles[y][0] = makeTile('hard_block');
    tiles[y][1] = makeTile('hard_block');
    tiles[y][width - 3] = makeTile('hard_block');
    tiles[y][width - 2] = makeTile('hard_block');
    tiles[y][width - 1] = makeTile('hard_block');
  }

  // Section 1: Showcase [!] block of this palace's color + bricks
  tiles[9][9] = makeTile(spec.exclamTile, spec.exclamContent);
  tiles[9][13] = makeTile('brick');
  tiles[9][14] = makeTile('brick');
  tiles[9][15] = makeTile('brick');

  // Section 2: Elevated arena tailored per palace color
  for (let x = 22; x <= 36; x++) {
    tiles[10][x] = makeTile('hard_block');
  }
  tiles[6][29] = { type: 'question', content: 'coin', bumpOffset: 0, bumpVel: 0, coinsLeft: 5 };
  tiles[6][28] = makeTile('brick');
  tiles[6][30] = makeTile('brick');

  // Section 3: Mid-palace [!] block & bridge/steps over hazard pools
  for (let x = 40; x <= 61; x++) {
    if (tiles[13][x]?.type === 'lava' && x % 2 === 0) {
      tiles[10][x] = makeTile('brick');
    }
  }
  tiles[9][50] = makeTile(spec.exclamTile, spec.exclamContent);
  tiles[11][53] = makeTile('hard_block');
  tiles[10][54] = makeTile('hard_block');
  tiles[11][62] = makeTile('hard_block');

  // Section 4: Grand Switch Altar
  tiles[12][68] = makeTile('hard_block');
  tiles[12][69] = makeTile('hard_block');
  tiles[11][70] = makeTile('hard_block');
  for (let x = 71; x <= 82; x++) {
    tiles[11][x] = makeTile('hard_block');
    tiles[12][x] = makeTile('hard_block');
  }
  for (let y = 3; y <= 10; y++) {
    tiles[y][83] = makeTile('hard_block');
  }
  tiles[10][77] = makeTile(spec.switchTile);

  const coins: { x: number; y: number }[] = [];
  for (let x = 5; x <= 8; x++) {
    coins.push({ x: x * 16, y: 11 * 16 });
  }
  for (let x = 24; x <= 34; x++) {
    if (x >= 28 && x <= 30) continue;
    coins.push({ x: x * 16, y: 7 * 16 });
  }
  coins.push(
    { x: 75 * 16, y: 8 * 16 },
    { x: 76 * 16, y: 7 * 16 },
    { x: 77 * 16, y: 6 * 16 },
    { x: 78 * 16, y: 7 * 16 },
    { x: 79 * 16, y: 8 * 16 }
  );

  const enemies: LevelData['enemies'] =
    color === 'green'
      ? [
          { type: 'paratroopa', x: 18 * 16, y: 9 * 16 },
          { type: 'koopa', x: 26 * 16, y: 11 * 16 },
          { type: 'paratroopa', x: 48 * 16, y: 8 * 16 },
          { type: 'goomba', x: 64 * 16, y: 12 * 16 },
        ]
      : color === 'red'
      ? [
          { type: 'goomba', x: 18 * 16, y: 12 * 16 },
          { type: 'red_koopa', x: 26 * 16, y: 11 * 16 },
          { type: 'red_koopa', x: 33 * 16, y: 11 * 16 },
          { type: 'hammer_bro', x: 63 * 16, y: 11 * 16 },
        ]
      : color === 'pink'
      ? [
          { type: 'goomba', x: 17 * 16, y: 12 * 16 },
          { type: 'koopa', x: 27 * 16, y: 11 * 16 },
          { type: 'paratroopa', x: 47 * 16, y: 7 * 16 },
          { type: 'red_koopa', x: 64 * 16, y: 11 * 16 },
        ]
      : [
          { type: 'goomba', x: 18 * 16, y: 12 * 16 },
          { type: 'koopa', x: 25 * 16, y: 11 * 16 },
          { type: 'paratroopa', x: 35 * 16, y: 8 * 16 },
          { type: 'koopa', x: 64 * 16, y: 11 * 16 },
        ];

  return {
    id: spec.id,
    name: spec.code,
    theme: 'underground',
    width,
    height,
    tiles,
    enemies,
    coins,
    marioStart: { x: 3 * 16, y: 11 * 16 },
    flagX: 999999,
    castleX: 999999,
    bgColor: spec.bgColor,
    musicTrack: 'bonus',
    useBonusBackdrop: true,
    timeLimit: 200,
    biomeLabel: spec.biomeLabel,
    checkpoints: [{ x: 41 * 16, respawnPos: { x: 41 * 16, y: 11 * 16 } }],
    smwNodeId: spec.nodeId,
    smwWorldName: SMW_WORLD_ISLAND_NAME,
    isFinalCastle: false,
  };
}

export function createGreenSwitchPalaceStage(): LevelData {
  return createColoredSwitchPalaceStage('green');
}

export function createRedSwitchPalaceStage(): LevelData {
  return createColoredSwitchPalaceStage('red');
}

export function createPinkSwitchPalaceStage(): LevelData {
  return createColoredSwitchPalaceStage('pink');
}

export function createBlueSwitchPalaceStage(): LevelData {
  return createColoredSwitchPalaceStage('blue');
}

export function createSmwWiki1SecretRoom(): LevelData {
  const width = 32;
  const height = 15;
  const tiles: (BlockTile | null)[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );

  // Underground brick ceiling & solid stone floor
  for (let x = 0; x < width; x++) {
    tiles[0][x] = makeTile('underground_brick');
    tiles[1][x] = makeTile('underground_brick');
    tiles[13][x] = makeTile('underground_ground');
    tiles[14][x] = makeTile('underground_ground');
  }

  // Left & right enclosing walls
  for (let y = 2; y <= 12; y++) {
    tiles[y][0] = makeTile('underground_brick');
    tiles[y][width - 1] = makeTile('underground_brick');
  }

  // Step & elevated ledge holding the Secret Key
  tiles[11][7] = makeTile('underground_brick');
  tiles[11][8] = makeTile('underground_brick');
  for (let x = 9; x <= 13; x++) {
    tiles[9][x] = makeTile('underground_brick');
  }

  // Return pipe back to W-1 Overworld on the right
  tiles[9][28] = makeTile('pipe_warp_top_left');
  tiles[9][29] = makeTile('pipe_warp_top_right');
  for (let y = 10; y <= 12; y++) {
    tiles[y][28] = makeTile('pipe_body_left');
    tiles[y][29] = makeTile('pipe_body_right');
  }

  const coins: { x: number; y: number }[] = [];
  for (let x = 9; x <= 13; x++) {
    coins.push({ x: x * 16 + 4, y: 7 * 16 });
  }
  for (let x = 17; x <= 20; x++) {
    coins.push({ x: x * 16 + 4, y: 11 * 16 });
  }

  return {
    id: 'smw-wiki-1-secret',
    name: 'W-1 SUBSOLO',
    theme: 'underground',
    width,
    height,
    tiles,
    enemies: [
      { type: 'goomba', x: 16 * 16, y: 12 * 16 },
      { type: 'koopa', x: 20 * 16, y: 11 * 16 },
    ],
    coins,
    marioStart: { x: 2 * 16 + 8, y: 4 * 16 },
    flagX: 999999,
    castleX: 999999,
    bgColor: '#000000',
    timeLimit: 200,
    biomeLabel: 'WIKIWORLDWEB · SUBSOLO SECRETO',
    smwNodeId: 'wiki-1-overworld',
    smwWorldName: SMW_WORLD_ISLAND_NAME,
    isFinalCastle: false,
    carryables: [{ kind: 'key', x: 11 * 16, y: 8 * 16 }],
    keyholes: [{ x: 24 * 16, y: 11 * 16 + 8 }],
    pipeWarps: [
      {
        from: { x: 28 * 16, y: 8 * 16, width: 32, height: 16 },
        toLevel: 'wiki-1-overworld',
        toPos: { x: 33 * 16 + 8, y: 10 * 16 },
        type: 'down',
      },
      {
        from: { x: 28 * 16 - 6, y: 9 * 16, width: 8, height: 64 },
        toLevel: 'wiki-1-overworld',
        toPos: { x: 33 * 16 + 8, y: 10 * 16 },
        type: 'right',
      },
    ],
  };
}

export function createSmwWikiWorldStage(nodeId: string): LevelData {
  switch (nodeId) {
    case 'wiki-switch-yellow':
      return createYellowSwitchPalaceStage();
    case 'wiki-switch-green':
      return createGreenSwitchPalaceStage();
    case 'wiki-switch-red':
      return createRedSwitchPalaceStage();
    case 'wiki-switch-pink':
      return createPinkSwitchPalaceStage();
    case 'wiki-switch-blue':
      return createBlueSwitchPalaceStage();

    case 'wiki-2-caverna': {
      const level = createSingleplayerLevel(2, 3, {
        seedOverride: 90202,
        id: 'smw-wiki-2',
        name: 'W-2',
        biomeLabel: 'WIKIWORLDWEB · CAVERNA',
        smwNodeId: 'wiki-2-caverna',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      });
      level.carryables = [{ kind: 'p_switch_cyan', x: 10 * 16, y: 12 * 16 }];
      return placeYellowExclamBlocks(level, [22, 54, 92, 134], 9);
    }

    case 'wiki-3-agua': {
      const level = createSingleplayerLevel(2, 2, {
        seedOverride: 90303,
        id: 'smw-wiki-3',
        name: 'W-3',
        biomeLabel: 'WIKIWORLDWEB · ÁGUA',
        smwNodeId: 'wiki-3-agua',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      });
      return placeYellowExclamBlocks(level, [20, 52, 88, 122], 9);
    }

    case 'wiki-4-mansao': {
      const ghostBase = cloneLevelData(createWorldGhostHouse());
      const level: LevelData = {
        ...ghostBase,
        id: 'smw-wiki-4',
        name: 'W-4',
        biomeLabel: 'WIKIWORLDWEB · MANSÃO FANTASMA',
        smwNodeId: 'wiki-4-mansao',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
        carryables: [
          { kind: 'p_switch_blue', x: 50 * 16, y: 12 * 16 },
          { kind: 'key', x: 58 * 16, y: 7 * 16 },
          { kind: 'p_switch_cyan', x: 140 * 16, y: 12 * 16 },
        ],
        keyholes: [{ x: 158 * 16, y: 11 * 16 + 8 }],
      };
      return placeYellowExclamBlocks(level, [22, 48, 78, 104], 9);
    }

    case 'wiki-5-castelo': {
      const level = createSingleplayerLevel(3, 5, {
        seedOverride: 90505,
        id: 'smw-wiki-5',
        name: 'W-5',
        biomeLabel: 'CASTELO DE JOHANNNNES89',
        smwNodeId: 'wiki-5-castelo',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      });
      level.bossName = JOHANNNNES_CASTLE_1_BOSS_NAME;
      return placeYellowExclamBlocks(level, [20, 50, 82, 114], 9);
    }

    case 'wiki-1-overworld':
    default: {
      const level = createSingleplayerLevel(1, 1, {
        seedOverride: 90101,
        id: 'smw-wiki-1',
        name: 'W-1',
        biomeLabel: 'WIKIWORLDWEB · OVERWORLD',
        smwNodeId: 'wiki-1-overworld',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      });
      level.carryables = [{ kind: 'p_switch_blue', x: 9 * 16, y: 12 * 16 }];
      level.coins.push(
        { x: 11 * 16 + 8, y: 10 * 16 },
        { x: 12 * 16 + 8, y: 10 * 16 },
        { x: 13 * 16 + 8, y: 10 * 16 }
      );
      // Pipe #2 (x=33, top at row 11) leads to the underground secret Key & Keyhole room
      level.pipeWarps = [
        ...(level.pipeWarps ?? []),
        {
          from: { x: 33 * 16, y: 10 * 16, width: 32, height: 16 },
          toLevel: 'smw-wiki-1-secret',
          toPos: { x: 2 * 16 + 8, y: 4 * 16 },
          type: 'down',
        },
      ];
      return placeYellowExclamBlocks(level, [18, 46, 84, 128], 9);
    }
  }
}

export interface SmwBetaProgress {
  clearedNodeIds: string[];
  secretClearedNodeIds?: string[];
  selectedNodeId: string;
  selectedIslandId?: SmwIslandId;
  storySeen: boolean;
  yellowSwitchUnlocked: boolean;
  greenSwitchUnlocked?: boolean;
  redSwitchUnlocked?: boolean;
  pinkSwitchUnlocked?: boolean;
  blueSwitchUnlocked?: boolean;
  goalPointsWallet?: number;
}

const SMW_LEGACY_AUTOSAVE_KEY = 'smb_smw_beta_v09_progress';
export const SMW_SAVE_SLOTS_COUNT = 3;
export const SMW_SAVE_SLOTS_STORAGE_KEY = 'smb_smw_save_slots_v1';

export interface SmwSaveSlotData {
  slotIndex: number;
  savedAt: number;
  stageName: string;
  clearedNodeIds: string[];
  secretClearedNodeIds?: string[];
  selectedNodeId: string;
  selectedIslandId: SmwIslandId;
  yellowSwitchUnlocked: boolean;
  greenSwitchUnlocked?: boolean;
  redSwitchUnlocked?: boolean;
  pinkSwitchUnlocked?: boolean;
  blueSwitchUnlocked?: boolean;
  goalPointsWallet: number;
  lives: number;
  score: number;
}

export function createFreshSmwProgress(): SmwBetaProgress {
  return {
    clearedNodeIds: [],
    secretClearedNodeIds: [],
    selectedNodeId: 'wiki-1-overworld',
    selectedIslandId: 'wikiworld',
    storySeen: false,
    yellowSwitchUnlocked: false,
    greenSwitchUnlocked: false,
    redSwitchUnlocked: false,
    pinkSwitchUnlocked: false,
    blueSwitchUnlocked: false,
    goalPointsWallet: 0,
  };
}

/**
 * R1.16.X6.4: Salvamento automático desativado no Super Mario World.
 * O progresso inicial sempre começa limpo até o jogador carregar um Slot salvo.
 */
export function loadSmwBetaProgress(): SmwBetaProgress {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SMW_LEGACY_AUTOSAVE_KEY);
    }
  } catch {
    // Ignore storage access errors in headless/sandbox environments
  }
  return createFreshSmwProgress();
}

/**
 * R1.16.X6.4: Salvamento automático proibido; mantido apenas como no-op seguro.
 * Use saveSmwToSlot(...) explicitamente ao concluir um castelo.
 */
export function saveSmwBetaProgress(_progress: SmwBetaProgress): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SMW_LEGACY_AUTOSAVE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

function sanitizeSaveSlot(raw: unknown, expectedIndex: number): SmwSaveSlotData | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<SmwSaveSlotData>;
  const validMapIds = new Set(SMW_WIKIWORLD_NODES.map(n => n.id));
  const validAllIds = new Set([
    ...SMW_WIKIWORLD_NODES.map(n => n.id),
    ...SMW_DEV_ONLY_SWITCH_PALACES.map(p => p.id),
  ]);
  const clearedNodeIds = Array.isArray(obj.clearedNodeIds)
    ? obj.clearedNodeIds.filter((id): id is string => typeof id === 'string' && validAllIds.has(id))
    : [];
  const secretClearedNodeIds = Array.isArray(obj.secretClearedNodeIds)
    ? obj.secretClearedNodeIds.filter((id): id is string => typeof id === 'string' && validAllIds.has(id))
    : [];
  const selectedNodeId =
    typeof obj.selectedNodeId === 'string' && validMapIds.has(obj.selectedNodeId)
      ? obj.selectedNodeId
      : 'wiki-1-overworld';
  const selectedIslandId: SmwIslandId =
    obj.selectedIslandId === 'island2' ? 'island2' : 'wikiworld';
  const wallet =
    typeof obj.goalPointsWallet === 'number' && Number.isFinite(obj.goalPointsWallet)
      ? Math.max(0, Math.min(99, Math.floor(obj.goalPointsWallet)))
      : 0;
  const lives =
    typeof obj.lives === 'number' && Number.isFinite(obj.lives)
      ? Math.max(1, Math.min(99, Math.floor(obj.lives)))
      : 3;
  const score =
    typeof obj.score === 'number' && Number.isFinite(obj.score)
      ? Math.max(0, Math.floor(obj.score))
      : 0;

  return {
    slotIndex: expectedIndex,
    savedAt: typeof obj.savedAt === 'number' && Number.isFinite(obj.savedAt) ? obj.savedAt : Date.now(),
    stageName:
      typeof obj.stageName === 'string' && obj.stageName.trim().length > 0
        ? obj.stageName.trim()
        : 'Castelo Concluído',
    clearedNodeIds,
    secretClearedNodeIds,
    selectedNodeId,
    selectedIslandId,
    yellowSwitchUnlocked: Boolean(
      obj.yellowSwitchUnlocked || clearedNodeIds.includes('wiki-switch-yellow')
    ),
    greenSwitchUnlocked: Boolean(
      obj.greenSwitchUnlocked || clearedNodeIds.includes('wiki-switch-green')
    ),
    redSwitchUnlocked: Boolean(
      obj.redSwitchUnlocked || clearedNodeIds.includes('wiki-switch-red')
    ),
    pinkSwitchUnlocked: Boolean(
      obj.pinkSwitchUnlocked || clearedNodeIds.includes('wiki-switch-pink')
    ),
    blueSwitchUnlocked: Boolean(
      obj.blueSwitchUnlocked || clearedNodeIds.includes('wiki-switch-blue')
    ),
    goalPointsWallet: wallet,
    lives,
    score,
  };
}

export function loadSmwSaveSlots(storage?: Pick<Storage, 'getItem'>): (SmwSaveSlotData | null)[] {
  const empty: (SmwSaveSlotData | null)[] = Array.from({ length: SMW_SAVE_SLOTS_COUNT }, () => null);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!store) return empty;
    const raw = store.getItem(SMW_SAVE_SLOTS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return empty;
    return empty.map((_, idx) => sanitizeSaveSlot(parsed[idx], idx));
  } catch {
    return empty;
  }
}

export function saveSmwToSlot(
  slotIndex: number,
  progress: SmwBetaProgress,
  meta: { stageName?: string; lives?: number; score?: number } = {},
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): (SmwSaveSlotData | null)[] {
  const idx = Math.floor(slotIndex);
  const current = loadSmwSaveSlots(storage);
  if (idx < 0 || idx >= SMW_SAVE_SLOTS_COUNT) return current;

  const validMapIds = new Set(SMW_WIKIWORLD_NODES.map(n => n.id));
  const validAllIds = new Set([
    ...SMW_WIKIWORLD_NODES.map(n => n.id),
    ...SMW_DEV_ONLY_SWITCH_PALACES.map(p => p.id),
  ]);
  const clearedNodeIds = progress.clearedNodeIds.filter(id => validAllIds.has(id));
  const secretClearedNodeIds = (progress.secretClearedNodeIds ?? []).filter(id => validAllIds.has(id));
  const selectedNodeId = validMapIds.has(progress.selectedNodeId)
    ? progress.selectedNodeId
    : 'wiki-1-overworld';

  const nextSlot: SmwSaveSlotData = {
    slotIndex: idx,
    savedAt: Date.now(),
    stageName: meta.stageName?.trim() || 'Castelo de Johannnnes89',
    clearedNodeIds,
    secretClearedNodeIds,
    selectedNodeId,
    selectedIslandId: progress.selectedIslandId === 'island2' ? 'island2' : 'wikiworld',
    yellowSwitchUnlocked: Boolean(
      progress.yellowSwitchUnlocked || clearedNodeIds.includes('wiki-switch-yellow')
    ),
    greenSwitchUnlocked: Boolean(
      progress.greenSwitchUnlocked || clearedNodeIds.includes('wiki-switch-green')
    ),
    redSwitchUnlocked: Boolean(
      progress.redSwitchUnlocked || clearedNodeIds.includes('wiki-switch-red')
    ),
    pinkSwitchUnlocked: Boolean(
      progress.pinkSwitchUnlocked || clearedNodeIds.includes('wiki-switch-pink')
    ),
    blueSwitchUnlocked: Boolean(
      progress.blueSwitchUnlocked || clearedNodeIds.includes('wiki-switch-blue')
    ),
    goalPointsWallet: Math.max(0, Math.min(99, Math.floor(progress.goalPointsWallet ?? 0))),
    lives: Math.max(1, Math.min(99, Math.floor(meta.lives ?? 3))),
    score: Math.max(0, Math.floor(meta.score ?? 0)),
  };

  current[idx] = nextSlot;
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (store) {
      store.setItem(SMW_SAVE_SLOTS_STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore quota errors
  }
  return current;
}

export function deleteSmwSlot(
  slotIndex: number,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): (SmwSaveSlotData | null)[] {
  const idx = Math.floor(slotIndex);
  const current = loadSmwSaveSlots(storage);
  if (idx < 0 || idx >= SMW_SAVE_SLOTS_COUNT) return current;
  current[idx] = null;
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (store) {
      store.setItem(SMW_SAVE_SLOTS_STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore storage errors
  }
  return current;
}

export function applySmwSlotToProgress(slot: SmwSaveSlotData): SmwBetaProgress {
  return {
    clearedNodeIds: [...slot.clearedNodeIds],
    secretClearedNodeIds: [...(slot.secretClearedNodeIds ?? [])],
    selectedNodeId: slot.selectedNodeId,
    selectedIslandId: slot.selectedIslandId,
    storySeen: true,
    yellowSwitchUnlocked: Boolean(
      slot.yellowSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-yellow')
    ),
    greenSwitchUnlocked: Boolean(
      slot.greenSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-green')
    ),
    redSwitchUnlocked: Boolean(
      slot.redSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-red')
    ),
    pinkSwitchUnlocked: Boolean(
      slot.pinkSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-pink')
    ),
    blueSwitchUnlocked: Boolean(
      slot.blueSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-blue')
    ),
    goalPointsWallet: Math.max(0, Math.min(99, Math.floor(slot.goalPointsWallet ?? 0))),
  };
}

export function isSmwNodeUnlocked(
  nodeIdOrOrder: string | number,
  progress: SmwBetaProgress
): boolean {
  const node =
    typeof nodeIdOrOrder === 'string'
      ? SMW_WIKIWORLD_NODES.find(n => n.id === nodeIdOrOrder)
      : SMW_WIKIWORLD_NODES.find(n => n.order === nodeIdOrOrder) || SMW_WIKIWORLD_NODES[nodeIdOrOrder];
  if (!node) return false;
  if (node.order === 0) return true;
  if (node.unlocksAfterSecretNodeId) {
    return Boolean(
      progress.secretClearedNodeIds?.includes(node.unlocksAfterSecretNodeId) ||
        progress.clearedNodeIds.includes(node.id) ||
        (node.id === 'wiki-switch-yellow' && progress.yellowSwitchUnlocked)
    );
  }
  if (!node.unlocksAfterNodeId) return true;
  return progress.clearedNodeIds.includes(node.unlocksAfterNodeId);
}

/**
 * R1.16.O0.4: Impede que o jogador jogue novamente o Palácio Interruptor Amarelo
 * após ele já ter sido concluído.
 */
export function isSmwNodeCompletedAndLocked(
  nodeId: string,
  progress: SmwBetaProgress
): boolean {
  if (nodeId === 'wiki-switch-yellow') {
    return Boolean(
      progress.yellowSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-yellow')
    );
  }
  if (nodeId === 'wiki-switch-green') {
    return Boolean(
      progress.greenSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-green')
    );
  }
  if (nodeId === 'wiki-switch-red') {
    return Boolean(
      progress.redSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-red')
    );
  }
  if (nodeId === 'wiki-switch-pink') {
    return Boolean(
      progress.pinkSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-pink')
    );
  }
  if (nodeId === 'wiki-switch-blue') {
    return Boolean(
      progress.blueSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-blue')
    );
  }
  return false;
}

export function canEnterSmwNode(
  nodeId: string,
  progress: SmwBetaProgress
): boolean {
  return isSmwNodeUnlocked(nodeId, progress) && !isSmwNodeCompletedAndLocked(nodeId, progress);
}

/**
 * Checks whether a World Map stage node has already been cleared (via normal exit,
 * secret keyhole exit, or switch palace completion).
 */
export function isSmwNodeCleared(
  nodeId: string | null | undefined,
  progress: Pick<
    SmwBetaProgress,
    | 'clearedNodeIds'
    | 'secretClearedNodeIds'
    | 'yellowSwitchUnlocked'
    | 'greenSwitchUnlocked'
    | 'redSwitchUnlocked'
    | 'pinkSwitchUnlocked'
    | 'blueSwitchUnlocked'
  >
): boolean {
  if (!nodeId) return false;
  if (progress.clearedNodeIds.includes(nodeId)) return true;
  if (progress.secretClearedNodeIds?.includes(nodeId)) return true;
  return isSmwNodeCompletedAndLocked(nodeId, progress as SmwBetaProgress);
}

/**
 * In SMW World Mode, pressing SELECT while paused allows exiting back to the
 * Overworld Map ONLY when the current stage has already been beaten.
 */
export function canExitSmwStageWithSelect(params: {
  isSmwModeActive: boolean;
  activeNodeId: string | null | undefined;
  progress: Pick<
    SmwBetaProgress,
    | 'clearedNodeIds'
    | 'secretClearedNodeIds'
    | 'yellowSwitchUnlocked'
    | 'greenSwitchUnlocked'
    | 'redSwitchUnlocked'
    | 'pinkSwitchUnlocked'
    | 'blueSwitchUnlocked'
  >;
}): boolean {
  if (!params.isSmwModeActive) return false;
  return isSmwNodeCleared(params.activeNodeId, params.progress);
}



