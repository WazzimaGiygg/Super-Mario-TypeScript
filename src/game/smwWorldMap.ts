/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BlockTile, LevelData } from './types.ts';
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

export interface SmwMapNode {
  id: string;
  order: number;
  code: string;
  title: string;
  subtitle: string;
  theme: LevelData['theme'];
  mapX: number;
  mapY: number;
  isCastle?: boolean;
  isSwitchPalace?: boolean;
  switchColor?: 'yellow';
  unlocksAfterNodeId?: string;
  betaPlaceholderMessage?: string;
}

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
    subtitle: 'Fortaleza final da ilha · Guardada por Bowser',
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
    subtitle: 'Ative o interruptor amarelo para liberar blocos [!] com cogumelos',
    theme: 'underground',
    mapX: 29,
    mapY: 72,
    isSwitchPalace: true,
    switchColor: 'yellow',
    unlocksAfterNodeId: 'wiki-1-overworld',
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

  // Section 1: Welcome showcase (locked Yellow [!] outline + Mushroom Question block)
  tiles[9][9] = makeTile('exclam_yellow', 'mushroom');
  tiles[9][13] = makeTile('question', 'mushroom');
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
    bgColor: '#241804',
    timeLimit: 200,
    biomeLabel: 'WIKIWORLDWEB · PALÁCIO AMARELO',
    checkpoints: [{ x: 41 * 16, respawnPos: { x: 41 * 16, y: 11 * 16 } }],
    smwNodeId: 'wiki-switch-yellow',
    smwWorldName: SMW_WORLD_ISLAND_NAME,
    isFinalCastle: false,
  };
}

export function createSmwWikiWorldStage(nodeId: string): LevelData {
  switch (nodeId) {
    case 'wiki-switch-yellow':
      return createYellowSwitchPalaceStage();

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
      return placeYellowExclamBlocks(level, [18, 46, 84, 128], 9);
    }
  }
}

export interface SmwBetaProgress {
  clearedNodeIds: string[];
  selectedNodeId: string;
  selectedIslandId?: SmwIslandId;
  storySeen: boolean;
  yellowSwitchUnlocked: boolean;
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
  selectedNodeId: string;
  selectedIslandId: SmwIslandId;
  yellowSwitchUnlocked: boolean;
  goalPointsWallet: number;
  lives: number;
  score: number;
}

export function createFreshSmwProgress(): SmwBetaProgress {
  return {
    clearedNodeIds: [],
    selectedNodeId: 'wiki-1-overworld',
    selectedIslandId: 'wikiworld',
    storySeen: false,
    yellowSwitchUnlocked: false,
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
  const validIds = new Set(SMW_WIKIWORLD_NODES.map(n => n.id));
  const clearedNodeIds = Array.isArray(obj.clearedNodeIds)
    ? obj.clearedNodeIds.filter((id): id is string => typeof id === 'string' && validIds.has(id))
    : [];
  const selectedNodeId =
    typeof obj.selectedNodeId === 'string' && validIds.has(obj.selectedNodeId)
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
    selectedNodeId,
    selectedIslandId,
    yellowSwitchUnlocked: Boolean(
      obj.yellowSwitchUnlocked || clearedNodeIds.includes('wiki-switch-yellow')
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

  const validIds = new Set(SMW_WIKIWORLD_NODES.map(n => n.id));
  const clearedNodeIds = progress.clearedNodeIds.filter(id => validIds.has(id));
  const selectedNodeId = validIds.has(progress.selectedNodeId)
    ? progress.selectedNodeId
    : 'wiki-1-overworld';

  const nextSlot: SmwSaveSlotData = {
    slotIndex: idx,
    savedAt: Date.now(),
    stageName: meta.stageName?.trim() || 'Castelo de Johannnnes89',
    clearedNodeIds,
    selectedNodeId,
    selectedIslandId: progress.selectedIslandId === 'island2' ? 'island2' : 'wikiworld',
    yellowSwitchUnlocked: Boolean(
      progress.yellowSwitchUnlocked || clearedNodeIds.includes('wiki-switch-yellow')
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
    selectedNodeId: slot.selectedNodeId,
    selectedIslandId: slot.selectedIslandId,
    storySeen: true,
    yellowSwitchUnlocked: Boolean(
      slot.yellowSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-yellow')
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
  if (node.order === 0 || !node.unlocksAfterNodeId) return true;
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
  if (nodeId !== 'wiki-switch-yellow') return false;
  return Boolean(
    progress.yellowSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-yellow')
  );
}

export function canEnterSmwNode(
  nodeId: string,
  progress: SmwBetaProgress
): boolean {
  return isSmwNodeUnlocked(nodeId, progress) && !isSmwNodeCompletedAndLocked(nodeId, progress);
}


