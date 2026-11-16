/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelData } from './types.ts';
import {
  createSingleplayerLevel,
  createWorldGhostHouse,
  cloneLevelData,
} from './levels.ts';

export const SMW_BETA_VERSION = 'Beta V0.9';
export const SMW_WORLD_ISLAND_NAME = 'Ilha WikiWorldWeb';

export const SMW_INTRO_STORY =
  'Olá, seja bem vindo ao mundo fantastico de WazzimaGiygg. Parece que desta vez o problema também é o caluniador, de nome Chronus, junto com Bowser. Vamos explorar os mundos para poder salvar a princesa femboy';

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
  },
];

export function createSmwWikiWorldStage(nodeId: string): LevelData {
  switch (nodeId) {
    case 'wiki-2-caverna':
      return createSingleplayerLevel(2, 2, {
        seedOverride: 90202,
        id: 'smw-wiki-2',
        name: 'W-2',
        biomeLabel: 'WIKIWORLDWEB · CAVERNA',
        smwNodeId: 'wiki-2-caverna',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      });

    case 'wiki-3-agua':
      return createSingleplayerLevel(2, 3, {
        seedOverride: 90303,
        id: 'smw-wiki-3',
        name: 'W-3',
        biomeLabel: 'WIKIWORLDWEB · ÁGUA',
        smwNodeId: 'wiki-3-agua',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      });

    case 'wiki-4-mansao': {
      const ghostBase = cloneLevelData(createWorldGhostHouse());
      return {
        ...ghostBase,
        id: 'smw-wiki-4',
        name: 'W-4',
        biomeLabel: 'WIKIWORLDWEB · MANSÃO FANTASMA',
        smwNodeId: 'wiki-4-mansao',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      };
    }

    case 'wiki-5-castelo':
      return createSingleplayerLevel(3, 5, {
        seedOverride: 90505,
        id: 'smw-wiki-5',
        name: 'W-5',
        biomeLabel: 'CASTELO DE JOHANNNNES89',
        smwNodeId: 'wiki-5-castelo',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      });

    case 'wiki-1-overworld':
    default:
      return createSingleplayerLevel(1, 1, {
        seedOverride: 90101,
        id: 'smw-wiki-1',
        name: 'W-1',
        biomeLabel: 'WIKIWORLDWEB · OVERWORLD',
        smwNodeId: 'wiki-1-overworld',
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        isFinalCastle: false,
      });
  }
}

export interface SmwBetaProgress {
  clearedNodeIds: string[];
  selectedNodeId: string;
  storySeen: boolean;
  betaUnlockAll: boolean;
}

const SMW_PROGRESS_STORAGE_KEY = 'smb_smw_beta_v09_progress';

const DEFAULT_SMW_PROGRESS: SmwBetaProgress = {
  clearedNodeIds: [],
  selectedNodeId: 'wiki-1-overworld',
  storySeen: false,
  betaUnlockAll: false,
};

export function loadSmwBetaProgress(): SmwBetaProgress {
  try {
    const raw = localStorage.getItem(SMW_PROGRESS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SMW_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<SmwBetaProgress>;
    const validIds = new Set(SMW_WIKIWORLD_NODES.map(n => n.id));
    const clearedNodeIds = Array.isArray(parsed.clearedNodeIds)
      ? parsed.clearedNodeIds.filter((id): id is string => typeof id === 'string' && validIds.has(id))
      : [];
    const selectedNodeId =
      typeof parsed.selectedNodeId === 'string' && validIds.has(parsed.selectedNodeId)
        ? parsed.selectedNodeId
        : 'wiki-1-overworld';
    return {
      clearedNodeIds,
      selectedNodeId,
      storySeen: Boolean(parsed.storySeen),
      betaUnlockAll: Boolean(parsed.betaUnlockAll),
    };
  } catch {
    return { ...DEFAULT_SMW_PROGRESS };
  }
}

export function saveSmwBetaProgress(progress: SmwBetaProgress): void {
  try {
    localStorage.setItem(SMW_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors
  }
}

export function isSmwNodeUnlocked(nodeOrder: number, progress: SmwBetaProgress): boolean {
  if (progress.betaUnlockAll || nodeOrder === 0) return true;
  const prevNode = SMW_WIKIWORLD_NODES[nodeOrder - 1];
  return prevNode ? progress.clearedNodeIds.includes(prevNode.id) : true;
}
