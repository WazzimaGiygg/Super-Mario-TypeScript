/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelData, SmwSwitchColor } from './types.ts';
import { parseWorldStageFromJson, type WorldStageJsonDefaults } from './levels.ts';
import wiki1OverworldJson from './worldLevels/wiki-1-overworld.json';
import smwWiki1SecretJson from './worldLevels/smw-wiki-1-secret.json';
import wiki2CavernaJson from './worldLevels/wiki-2-caverna.json';
import wiki3AguaJson from './worldLevels/wiki-3-agua.json';
import wiki4MansaoJson from './worldLevels/wiki-4-mansao.json';
import wiki5CasteloJson from './worldLevels/wiki-5-castelo.json';
import wikiSwitchYellowJson from './worldLevels/wiki-switch-yellow.json';
import wikiSwitchGreenJson from './worldLevels/wiki-switch-green.json';
import wikiSwitchRedJson from './worldLevels/wiki-switch-red.json';
import wikiSwitchPinkJson from './worldLevels/wiki-switch-pink.json';
import wikiSwitchBlueJson from './worldLevels/wiki-switch-blue.json';

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
    subtitle: "Planícies de Yoshi's Island · Cano secreto à caverna da chave",
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

export interface WorldStageJsonEntry {
  key: string;
  filename: string;
  label: string;
  rawJson: unknown;
  defaults: WorldStageJsonDefaults;
}

export const WORLD_STAGE_JSON_REGISTRY: readonly WorldStageJsonEntry[] = [
  {
    key: 'wiki-1-overworld',
    filename: 'wiki-1-overworld.json',
    label: "World W-1 (Yoshi's Island)",
    rawJson: wiki1OverworldJson,
    defaults: {
      id: 'smw-wiki-1',
      name: 'W-1',
      biomeLabel: "WIKIWORLDWEB · YOSHI'S ISLAND (W-1)",
      smwNodeId: 'wiki-1-overworld',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'smw-wiki-1-secret',
    filename: 'smw-wiki-1-secret.json',
    label: 'World W-1 Subsolo (Caverna Chave)',
    rawJson: smwWiki1SecretJson,
    defaults: {
      id: 'smw-wiki-1-secret',
      name: 'W-1 SUBSOLO',
      biomeLabel: 'WIKIWORLDWEB · SUBSOLO SECRETO',
      smwNodeId: 'wiki-1-overworld',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-2-caverna',
    filename: 'wiki-2-caverna.json',
    label: 'World W-2 (Caverna)',
    rawJson: wiki2CavernaJson,
    defaults: {
      id: 'smw-wiki-2',
      name: 'W-2',
      biomeLabel: 'WIKIWORLDWEB · CAVERNA',
      smwNodeId: 'wiki-2-caverna',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-3-agua',
    filename: 'wiki-3-agua.json',
    label: 'World W-3 (Água)',
    rawJson: wiki3AguaJson,
    defaults: {
      id: 'smw-wiki-3',
      name: 'W-3',
      biomeLabel: 'WIKIWORLDWEB · ÁGUA',
      smwNodeId: 'wiki-3-agua',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-4-mansao',
    filename: 'wiki-4-mansao.json',
    label: 'World W-4 (Mansão Fantasma)',
    rawJson: wiki4MansaoJson,
    defaults: {
      id: 'smw-wiki-4',
      name: 'W-4',
      biomeLabel: 'WIKIWORLDWEB · MANSÃO FANTASMA',
      smwNodeId: 'wiki-4-mansao',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-5-castelo',
    filename: 'wiki-5-castelo.json',
    label: 'World W-5 (Castelo)',
    rawJson: wiki5CasteloJson,
    defaults: {
      id: 'smw-wiki-5',
      name: 'W-5',
      biomeLabel: 'CASTELO DE JOHANNNNES89',
      smwNodeId: 'wiki-5-castelo',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
      bossName: JOHANNNNES_CASTLE_1_BOSS_NAME,
    },
  },
  {
    key: 'wiki-switch-yellow',
    filename: 'wiki-switch-yellow.json',
    label: 'World PA (Palácio Amarelo)',
    rawJson: wikiSwitchYellowJson,
    defaults: {
      id: 'smw-wiki-switch-yellow',
      name: 'PA',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO AMARELO',
      smwNodeId: 'wiki-switch-yellow',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-switch-green',
    filename: 'wiki-switch-green.json',
    label: 'World PV (Palácio Verde)',
    rawJson: wikiSwitchGreenJson,
    defaults: {
      id: 'smw-wiki-switch-green',
      name: 'PV',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO VERDE',
      smwNodeId: 'wiki-switch-green',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-switch-red',
    filename: 'wiki-switch-red.json',
    label: 'World PR (Palácio Vermelho)',
    rawJson: wikiSwitchRedJson,
    defaults: {
      id: 'smw-wiki-switch-red',
      name: 'PR',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO VERMELHO',
      smwNodeId: 'wiki-switch-red',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-switch-pink',
    filename: 'wiki-switch-pink.json',
    label: 'World PP (Palácio Rosa)',
    rawJson: wikiSwitchPinkJson,
    defaults: {
      id: 'smw-wiki-switch-pink',
      name: 'PP',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO ROSA',
      smwNodeId: 'wiki-switch-pink',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-switch-blue',
    filename: 'wiki-switch-blue.json',
    label: 'World PB (Palácio Azul)',
    rawJson: wikiSwitchBlueJson,
    defaults: {
      id: 'smw-wiki-switch-blue',
      name: 'PB',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO AZUL',
      smwNodeId: 'wiki-switch-blue',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
];

const WORLD_STAGE_BY_KEY = new Map<string, WorldStageJsonEntry>(
  WORLD_STAGE_JSON_REGISTRY.map(entry => [entry.key, entry])
);

function loadWorldStageByKey(key: string): LevelData {
  const entry = WORLD_STAGE_BY_KEY.get(key) || WORLD_STAGE_BY_KEY.get('wiki-1-overworld')!;
  return parseWorldStageFromJson(entry.rawJson, entry.defaults);
}

export function getWorldStageFilename(level: Pick<LevelData, 'id' | 'smwNodeId' | 'pipeWarps'>): string | null {
  if (
    level.id === 'smw-wiki-1-secret' ||
    (level.smwNodeId === 'wiki-1-overworld' &&
      (level.pipeWarps || []).some(pw => pw.toLevel === 'wiki-1-overworld'))
  ) {
    return 'smw-wiki-1-secret.json';
  }
  if (level.smwNodeId && WORLD_STAGE_BY_KEY.has(level.smwNodeId)) {
    return WORLD_STAGE_BY_KEY.get(level.smwNodeId)!.filename;
  }
  return null;
}

export function createYellowSwitchPalaceStage(): LevelData {
  return loadWorldStageByKey('wiki-switch-yellow');
}

export function createColoredSwitchPalaceStage(color: Exclude<SmwSwitchColor, 'yellow'>): LevelData {
  return loadWorldStageByKey(`wiki-switch-${color}`);
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
  return loadWorldStageByKey('smw-wiki-1-secret');
}

export function createSmwWiki1OverworldStage(): LevelData {
  return loadWorldStageByKey('wiki-1-overworld');
}

export function createSmwWikiWorldStage(nodeId: string): LevelData {
  if (WORLD_STAGE_BY_KEY.has(nodeId) && nodeId !== 'smw-wiki-1-secret') {
    return loadWorldStageByKey(nodeId);
  }
  return createSmwWiki1OverworldStage();
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



