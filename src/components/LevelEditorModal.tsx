/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eraser,
  Flag,
  Grid,
  Hammer,
  Layers,
  Pencil,
  Play,
  Plus,
  Copy,
  Trash2,
  UserCheck,
  X,
  ZoomIn,
  ZoomOut,
  EyeOff,
  Sparkles,
  Download,
  Home,
  Shield,
  AlertTriangle,
  Upload,
  FileDown,
  Undo2,
  Redo2,
  ListOrdered,
  ArrowUp,
  ArrowDown,
  Crown,
} from 'lucide-react';
import { CarryableKind, EnemyType, ItemContent, LevelData, TileType } from '../game/types.ts';
import {
  EDITOR_MAX_CARRYABLES,
  EDITOR_MAX_COINS,
  EDITOR_MAX_CUSTOM_LEVELS,
  EDITOR_MAX_ENEMIES,
  EDITOR_MAX_FLOATING_PLATFORMS,
  EDITOR_MAX_KEYHOLES,
  EDITOR_MAX_TOTAL_ENTITIES,
  EDITOR_MAX_YOSHIS,
  KEY_CAVE_PIPE_TARGET,
  cloneLevelData,
  createBlankCustomLevel,
  createSecretVault,
  createWorld1_1,
  createWorld1_2,
  createWorld1_4,
  createWorld2_2,
  createWorldGhostHouse,
  getCustomLevelEntityCounts,
  getExportLevelFilename,
  isCastleStageForYoshi,
  parseImportedLevelFile,
  placeKeyCavePipeInLevel,
  pruneKeyCavePipeWarps,
  sanitizeCustomLevelEntities,
  serializeLevelToFileJson,
} from '../game/levels.ts';
import {
  WORLD_STAGE_JSON_REGISTRY,
  createSmwWiki1SecretRoom,
  createSmwWikiWorldStage,
  getWorldStageFilename,
} from '../game/smwWorldMap.ts';
import { SpriteAtlas } from '../game/sprites.ts';

export const EDITOR_MAX_HISTORY = 35;
const EDITOR_MAX_CANVAS_BACKING_WIDTH = 2048;

interface LevelEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  customLevels: LevelData[];
  activeCustomLevelId: string | null;
  onUpdateCustomLevels: (levels: LevelData[], activeId: string | null) => void;
  onPlayLevel: (level: LevelData, options?: { immortality?: boolean }) => void;
  customCampaignIds?: string[];
  onUpdateCustomCampaignIds?: (ids: string[]) => void;
  onPlayCampaign?: (levels: LevelData[], options?: { immortality?: boolean }) => void;
  onBackToMainMenu?: () => void;
  editorImmortality?: boolean;
  onToggleEditorImmortality?: (enabled: boolean) => void;
}

type EditorBrushKind =
  | { kind: 'erase' }
  | { kind: 'mario_start' }
  | { kind: 'yoshi' }
  | { kind: 'carryable'; carryKind: CarryableKind }
  | { kind: 'keyhole' }
  | { kind: 'coin' }
  | { kind: 'tile'; tileType: TileType; content?: ItemContent; invisible?: boolean }
  | { kind: 'pipe'; height: 2 | 3 | 4; withPiranha?: boolean }
  | { kind: 'pipe_key_cave'; height: 2 | 3 | 4 }
  | { kind: 'flagpole_goal' }
  | { kind: 'floating_platform'; axis: 'horizontal' | 'vertical' | 'bob' }
  | { kind: 'enemy'; enemyType: EnemyType };

type PaletteTab = 'blocks' | 'items' | 'enemies' | 'special';

interface PaletteOption {
  id: string;
  label: string;
  brush: EditorBrushKind;
  tab: PaletteTab;
  preview: () => HTMLCanvasElement | null;
}

const SpriteIcon: React.FC<{ getCanvas: () => HTMLCanvasElement | null; size?: number }> = ({
  getCanvas,
  size = 24,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const target = ref.current;
    const src = getCanvas();
    if (!target || !src) return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, target.width, target.height);
    const scale = Math.min(target.width / src.width, target.height / src.height);
    const dw = src.width * scale;
    const dh = src.height * scale;
    const dx = (target.width - dw) / 2;
    const dy = (target.height - dh) / 2;
    ctx.drawImage(src, dx, dy, dw, dh);
  }, [getCanvas]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="shrink-0"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

const THEME_BG_COLORS: Record<LevelData['theme'], string> = {
  overworld: '#5c94fc',
  underground: '#000000',
  underwater: '#1840b8',
  castle: '#140406',
  ghost_house: '#120822',
};

const ITEM_CONTENT_OPTIONS: { value: ItemContent; label: string }[] = [
  { value: 'coin', label: 'Moeda' },
];

const hasValidStageGoal = (level: LevelData): boolean => {
  const hasGoalTile = level.tiles.some(row =>
    row.some(
      t =>
        t?.type === 'axe' ||
        t?.type === 'yellow_switch' ||
        t?.type === 'green_switch' ||
        t?.type === 'red_switch' ||
        t?.type === 'pink_switch' ||
        t?.type === 'blue_switch'
    )
  );
  if (hasGoalTile) return true;
  if ((level.keyholes?.length ?? 0) > 0) return true;
  if (level.flagX > 0 && level.flagX < level.width * 16) {
    const flagTx = Math.floor(level.flagX / 16);
    if (flagTx >= 0 && flagTx < level.width) {
      const hasPole = level.tiles.some(row => {
        const t = row[flagTx];
        return t?.type === 'pole' || t?.type === 'pole_top';
      });
      if (hasPole) return true;
    }
  }
  if ((level.pipeWarps || []).some(pw => pw.toLevel === KEY_CAVE_PIPE_TARGET)) {
    return true;
  }
  return false;
};

export const LevelEditorModal: React.FC<LevelEditorModalProps> = ({
  isOpen,
  onClose,
  customLevels,
  activeCustomLevelId,
  onUpdateCustomLevels,
  onPlayLevel,
  customCampaignIds,
  onUpdateCustomCampaignIds,
  onPlayCampaign,
  onBackToMainMenu,
  editorImmortality = false,
  onToggleEditorImmortality,
}) => {
  const atlas = useMemo(() => SpriteAtlas.get(), []);
  const keyCavePipePreview = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 24;
    const cctx = c.getContext('2d');
    if (!cctx) return null;
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(atlas.pipeTopLeft, 0, 2, 16, 16);
    cctx.drawImage(atlas.pipeTopRight, 8, 2, 16, 16);
    cctx.drawImage(atlas.itemKey, 10, 10, 13, 13);
    return c;
  }, [atlas]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPaintedCellRef = useRef<string | null>(null);
  const dragEraseModeRef = useRef(false);
  const strokeSnapshotRef = useRef<LevelData | null>(null);
  const strokeCommittedRef = useRef(false);
  const nameUndoArmedRef = useRef(true);

  const undoStacksRef = useRef<Map<string, LevelData[]>>(new Map());
  const redoStacksRef = useRef<Map<string, LevelData[]>>(new Map());
  const [historyRevision, setHistoryRevision] = useState(0);
  const [internalCampaignIds, setInternalCampaignIds] = useState<string[]>([]);
  const [showCampaignPanel, setShowCampaignPanel] = useState(false);
  const [pendingCampaignStart, setPendingCampaignStart] = useState(false);

  const [selectedBrushId, setSelectedBrushId] = useState<string>('tile_brick');
  const [questionContent, setQuestionContent] = useState<ItemContent>('coin');
  const [invisibleBlock, setInvisibleBlock] = useState(false);
  const [activeTab, setActiveTab] = useState<PaletteTab>('blocks');
  const [cellSize, setCellSize] = useState<16 | 24 | 32>(24);
  const [showGrid, setShowGrid] = useState(true);
  const [hoverCell, setHoverCell] = useState<{ tx: number; ty: number } | null>(null);
  const [statusNotice, setStatusNotice] = useState<string>('');
  const [statusError, setStatusError] = useState<string>('');
  const [localImmortality, setLocalImmortality] = useState(editorImmortality);
  const [showMissingGoalAlert, setShowMissingGoalAlert] = useState(false);

  const effectiveCampaignIds = customCampaignIds ?? internalCampaignIds;
  const setEffectiveCampaignIds = useCallback(
    (nextIds: string[]) => {
      if (onUpdateCustomCampaignIds) {
        onUpdateCustomCampaignIds(nextIds);
      } else {
        setInternalCampaignIds(nextIds);
      }
    },
    [onUpdateCustomCampaignIds]
  );

  const campaignLevels = useMemo(() => {
    const byId = new Map(customLevels.map(l => [l.id, l]));
    return effectiveCampaignIds
      .map(id => byId.get(id))
      .filter((lvl): lvl is LevelData => Boolean(lvl));
  }, [customLevels, effectiveCampaignIds]);

  useEffect(() => {
    setLocalImmortality(editorImmortality);
  }, [editorImmortality]);

  // Ensure at least one temporary in-memory level exists when opening the editor
  useEffect(() => {
    if (!isOpen) return;
    if (customLevels.length === 0) {
      const initial = createBlankCustomLevel('MINHA FASE 1', 'overworld', 100);
      onUpdateCustomLevels([initial], initial.id);
    } else if (!activeCustomLevelId || !customLevels.some(l => l.id === activeCustomLevelId)) {
      onUpdateCustomLevels(customLevels, customLevels[0].id);
    }
  }, [isOpen, customLevels, activeCustomLevelId, onUpdateCustomLevels]);

  const currentLevel = useMemo(() => {
    return customLevels.find(l => l.id === activeCustomLevelId) || customLevels[0] || null;
  }, [customLevels, activeCustomLevelId]);

  const currentLevelId = currentLevel?.id ?? '';
  const canUndo = useMemo(() => {
    void historyRevision;
    return currentLevelId ? (undoStacksRef.current.get(currentLevelId)?.length ?? 0) > 0 : false;
  }, [currentLevelId, historyRevision]);

  const canRedo = useMemo(() => {
    void historyRevision;
    return currentLevelId ? (redoStacksRef.current.get(currentLevelId)?.length ?? 0) > 0 : false;
  }, [currentLevelId, historyRevision]);

  const notify = useCallback((msg: string) => {
    setStatusError('');
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice(prev => (prev === msg ? '' : prev));
    }, 2600);
  }, []);

  const notifyError = useCallback((msg: string) => {
    setStatusNotice('');
    setStatusError(msg);
    setTimeout(() => {
      setStatusError(prev => (prev === msg ? '' : prev));
    }, 4000);
  }, []);

  const pushUndoSnapshot = useCallback((snapshot: LevelData) => {
    const stack = undoStacksRef.current.get(snapshot.id) || [];
    stack.push(cloneLevelData(snapshot));
    if (stack.length > EDITOR_MAX_HISTORY) {
      stack.splice(0, stack.length - EDITOR_MAX_HISTORY);
    }
    undoStacksRef.current.set(snapshot.id, stack);
    redoStacksRef.current.set(snapshot.id, []);
    setHistoryRevision(r => r + 1);
  }, []);

  const handleUndo = useCallback(() => {
    if (!currentLevel) return;
    const stack = undoStacksRef.current.get(currentLevel.id);
    if (!stack || stack.length === 0) return;
    const previous = stack.pop()!;
    const redoStack = redoStacksRef.current.get(currentLevel.id) || [];
    redoStack.push(cloneLevelData(currentLevel));
    if (redoStack.length > EDITOR_MAX_HISTORY) {
      redoStack.splice(0, redoStack.length - EDITOR_MAX_HISTORY);
    }
    redoStacksRef.current.set(currentLevel.id, redoStack);
    setHistoryRevision(r => r + 1);
    const nextList = customLevels.map(l => (l.id === currentLevel.id ? previous : l));
    onUpdateCustomLevels(nextList, currentLevel.id);
    notify('Desfeito (Ctrl+Z)');
  }, [currentLevel, customLevels, onUpdateCustomLevels, notify]);

  const handleRedo = useCallback(() => {
    if (!currentLevel) return;
    const redoStack = redoStacksRef.current.get(currentLevel.id);
    if (!redoStack || redoStack.length === 0) return;
    const restored = redoStack.pop()!;
    const undoStack = undoStacksRef.current.get(currentLevel.id) || [];
    undoStack.push(cloneLevelData(currentLevel));
    if (undoStack.length > EDITOR_MAX_HISTORY) {
      undoStack.splice(0, undoStack.length - EDITOR_MAX_HISTORY);
    }
    undoStacksRef.current.set(currentLevel.id, undoStack);
    setHistoryRevision(r => r + 1);
    const nextList = customLevels.map(l => (l.id === currentLevel.id ? restored : l));
    onUpdateCustomLevels(nextList, currentLevel.id);
    notify('Refeito (Ctrl+Y)');
  }, [currentLevel, customLevels, onUpdateCustomLevels, notify]);

  // Keyboard shortcuts: Ctrl+Z / Cmd+Z (Undo) & Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z (Redo) — R1.16.FH.4
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
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
      if (isTextEntry) return;

      const lower = e.key.toLowerCase();
      if (lower === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
      } else if (lower === 'y' || (lower === 'z' && e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, handleUndo, handleRedo]);

  const updateCurrentLevel = useCallback(
    (updater: (draft: LevelData) => LevelData, options?: { recordUndo?: boolean }) => {
      if (!currentLevel) return;
      if (options?.recordUndo) {
        if (isDrawingRef.current) {
          if (!strokeCommittedRef.current && strokeSnapshotRef.current) {
            pushUndoSnapshot(strokeSnapshotRef.current);
            strokeCommittedRef.current = true;
          }
        } else {
          pushUndoSnapshot(currentLevel);
        }
      }
      const cloned = cloneLevelData(currentLevel);
      const updated = updater(cloned);
      const nextList = customLevels.map(l => (l.id === currentLevel.id ? updated : l));
      onUpdateCustomLevels(nextList, currentLevel.id);
    },
    [currentLevel, customLevels, onUpdateCustomLevels, pushUndoSnapshot]
  );

  const paletteOptions: PaletteOption[] = useMemo(
    () => [
      // Blocks & Terrain
      {
        id: 'tile_ground',
        label: 'Chão',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'ground' },
        preview: () => atlas.tileGround,
      },
      {
        id: 'tile_brick',
        label: 'Tijolo',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'brick', invisible: invisibleBlock },
        preview: () => atlas.tileBrick,
      },
      {
        id: 'tile_hard',
        label: 'Bloco Duro',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'hard_block' },
        preview: () => atlas.tileHardBlock,
      },
      {
        id: 'tile_ug_ground',
        label: 'Chão Caverna',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'underground_ground' },
        preview: () => atlas.tileGroundUnderground,
      },
      {
        id: 'tile_ug_brick',
        label: 'Tijolo Caverna',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'underground_brick', invisible: invisibleBlock },
        preview: () => atlas.tileBrickUnderground,
      },
      {
        id: 'tile_sea_ground',
        label: 'Fundo Marinho',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'sea_ground' },
        preview: () => atlas.tileSeaGround,
      },
      {
        id: 'tile_coral',
        label: 'Coral',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'coral' },
        preview: () => atlas.tileCoral,
      },
      {
        id: 'tile_castle_stone',
        label: 'Pedra Castelo',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'castle_stone' },
        preview: () => atlas.castleBrick,
      },
      {
        id: 'tile_bridge',
        label: 'Ponte Boss',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'bridge' },
        preview: () => atlas.tileBridge,
      },
      {
        id: 'tile_lava',
        label: 'Lava',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'lava' },
        preview: () => atlas.tileLavaFrames[0] || null,
      },
      {
        id: 'tile_ghost_floor',
        label: 'Piso Mansão',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'ghost_floor' },
        preview: () => atlas.tileGhostFloor,
      },
      {
        id: 'tile_ghost_brick',
        label: 'Tijolo Mansão',
        tab: 'blocks',
        brush: { kind: 'tile', tileType: 'ghost_brick', invisible: invisibleBlock },
        preview: () => atlas.tileGhostBrick,
      },
      {
        id: 'plat_horiz',
        label: 'Plat. Flut. Horiz.',
        tab: 'blocks',
        brush: { kind: 'floating_platform', axis: 'horizontal' },
        preview: () => atlas.tileBridge,
      },
      {
        id: 'plat_vert',
        label: 'Plat. Flut. Vert.',
        tab: 'blocks',
        brush: { kind: 'floating_platform', axis: 'vertical' },
        preview: () => atlas.tileBridge,
      },

      // Question Blocks, SMW [!] Box, Coins & Pipes
      {
        id: 'tile_question',
        label: `Bloco ? (${ITEM_CONTENT_OPTIONS.find(o => o.value === questionContent)?.label || 'Moeda'})`,
        tab: 'items',
        brush: {
          kind: 'tile',
          tileType: 'question',
          content: questionContent,
          invisible: invisibleBlock,
        },
        preview: () => atlas.tileQuestionFrames[0] || null,
      },
      {
        id: 'tile_exclam_yellow',
        label: 'Bloco [!] Amarelo',
        tab: 'items',
        brush: {
          kind: 'tile',
          tileType: 'exclam_yellow',
          content: 'mushroom',
        },
        preview: () => atlas.tileExclamYellowActive || null,
      },
      {
        id: 'tile_exclam_green',
        label: 'Bloco [!] Verde (Pena)',
        tab: 'items',
        brush: {
          kind: 'tile',
          tileType: 'exclam_green',
          content: 'feather',
        },
        preview: () => atlas.tileExclamGreenActive || null,
      },
      {
        id: 'tile_exclam_red',
        label: 'Bloco [!] Vermelho (Fogo)',
        tab: 'items',
        brush: {
          kind: 'tile',
          tileType: 'exclam_red',
          content: 'fireflower',
        },
        preview: () => atlas.tileExclamRedActive || null,
      },
      {
        id: 'tile_exclam_pink',
        label: 'Bloco [!] Rosa (Femboy)',
        tab: 'items',
        brush: {
          kind: 'tile',
          tileType: 'exclam_pink',
          content: 'femboy',
        },
        preview: () => atlas.tileExclamPinkActive || null,
      },
      {
        id: 'tile_exclam_blue',
        label: 'Bloco [!] Azul (Tanooki)',
        tab: 'items',
        brush: {
          kind: 'tile',
          tileType: 'exclam_blue',
          content: 'leaf',
        },
        preview: () => atlas.tileExclamBlueActive || null,
      },
      {
        id: 'tile_question_empty',
        label: 'Bloco Vazio',
        tab: 'items',
        brush: { kind: 'tile', tileType: 'question_empty' },
        preview: () => atlas.tileQuestionEmpty,
      },
      {
        id: 'coin',
        label: 'Moeda Solta',
        tab: 'items',
        brush: { kind: 'coin' },
        preview: () => atlas.itemCoinFrames[0] || null,
      },
      {
        id: 'pipe_2',
        label: 'Cano Alto 2',
        tab: 'items',
        brush: { kind: 'pipe', height: 2 },
        preview: () => atlas.pipeTopLeft,
      },
      {
        id: 'pipe_3',
        label: 'Cano Alto 3',
        tab: 'items',
        brush: { kind: 'pipe', height: 3 },
        preview: () => atlas.pipeTopLeft,
      },
      {
        id: 'pipe_4_piranha',
        label: 'Cano + Piranha',
        tab: 'items',
        brush: { kind: 'pipe', height: 4, withPiranha: true },
        preview: () => atlas.piranha1,
      },
      {
        id: 'pipe_key_cave',
        label: 'Cano Caverna Chave',
        tab: 'items',
        brush: { kind: 'pipe_key_cave', height: 2 },
        preview: () => keyCavePipePreview || atlas.pipeTopLeft,
      },

      // Enemies
      {
        id: 'enemy_goomba',
        label: 'Goomba',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'goomba' },
        preview: () => atlas.goombaWalk1,
      },
      {
        id: 'enemy_koopa',
        label: 'Koopa Verde',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'koopa' },
        preview: () => atlas.koopaWalk1,
      },
      {
        id: 'enemy_red_koopa',
        label: 'Koopa Vermelho',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'red_koopa' },
        preview: () => atlas.redKoopaWalk1,
      },
      {
        id: 'enemy_paratroopa',
        label: 'Paratroopa Alado',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'paratroopa' },
        preview: () => atlas.paratroopa1,
      },
      {
        id: 'enemy_hammer_bro',
        label: 'Hammer Bro',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'hammer_bro' },
        preview: () => atlas.hammerBroWalk1,
      },
      {
        id: 'enemy_piranha',
        label: 'Planta Piranha',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'piranha' },
        preview: () => atlas.piranha1,
      },
      {
        id: 'enemy_cheep',
        label: 'Cheep-Cheep',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'cheep_cheep' },
        preview: () => atlas.cheepCheep1,
      },
      {
        id: 'enemy_fast_cheep',
        label: 'Cheep Turbo',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'fast_cheep' },
        preview: () => atlas.fastCheep1,
      },
      {
        id: 'enemy_blooper',
        label: 'Blooper',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'blooper' },
        preview: () => atlas.blooper1,
      },
      {
        id: 'enemy_bullet',
        label: 'Bullet Bill',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'bullet_bill' },
        preview: () => atlas.bulletBill,
      },
      {
        id: 'enemy_lava_bubble',
        label: 'Bolha Lava',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'lava_bubble' },
        preview: () => atlas.lavaBubble1,
      },
      {
        id: 'enemy_boo',
        label: 'Boo (Fantasma)',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'boo' },
        preview: () => atlas.booChase,
      },
      {
        id: 'enemy_dry_bones',
        label: 'Dry Bones',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'dry_bones' },
        preview: () => atlas.dryBonesWalk1,
      },
      {
        id: 'enemy_bowser',
        label: 'Bowser Boss',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'bowser' },
        preview: () => atlas.bowser1,
      },

      // Special Tools: Spawn, Yoshi, Goals, Eraser
      {
        id: 'mario_start',
        label: 'Início (Mario)',
        tab: 'special',
        brush: { kind: 'mario_start' },
        preview: () => atlas.marioSmallIdle,
      },
      {
        id: 'yoshi_mount',
        label: 'Yoshi (Fora de Castelos)',
        tab: 'special',
        brush: { kind: 'yoshi' },
        preview: () => atlas.yoshiIdle,
      },
      {
        id: 'key_item',
        label: 'Chave SMW (Carregável)',
        tab: 'special',
        brush: { kind: 'carryable', carryKind: 'key' },
        preview: () => atlas.itemKey,
      },
      {
        id: 'keyhole_goal',
        label: 'Buraco de Chave (Saída)',
        tab: 'special',
        brush: { kind: 'keyhole' },
        preview: () => atlas.itemKeyhole,
      },
      {
        id: 'p_switch_blue',
        label: 'Botão Móvel Azul',
        tab: 'special',
        brush: { kind: 'carryable', carryKind: 'p_switch_blue' },
        preview: () => atlas.itemPSwitchBlue,
      },
      {
        id: 'p_switch_cyan',
        label: 'Botão Móvel Ciano',
        tab: 'special',
        brush: { kind: 'carryable', carryKind: 'p_switch_cyan' },
        preview: () => atlas.itemPSwitchCyan,
      },
      {
        id: 'flagpole_goal',
        label: 'Poste Pontos SMW',
        tab: 'special',
        brush: { kind: 'flagpole_goal' },
        preview: () => atlas.flagTriangle,
      },
      {
        id: 'tile_axe',
        label: 'Machado (Castelo)',
        tab: 'special',
        brush: { kind: 'tile', tileType: 'axe' },
        preview: () => atlas.tileAxeFrames[0] || null,
      },
      {
        id: 'erase',
        label: 'Borracha',
        tab: 'special',
        brush: { kind: 'erase' },
        preview: () => null,
      },
    ],
    [atlas, keyCavePipePreview, questionContent, invisibleBlock]
  );

  const activeOption = useMemo(
    () => paletteOptions.find(p => p.id === selectedBrushId) || paletteOptions[0],
    [paletteOptions, selectedBrushId]
  );

  const applyBrushAtCell = useCallback(
    (tx: number, ty: number, forceErase: boolean = false) => {
      if (!currentLevel) return;
      if (tx < 0 || tx >= currentLevel.width || ty < 0 || ty >= currentLevel.height) return;

      const brush: EditorBrushKind = forceErase ? { kind: 'erase' } : activeOption.brush;
      const cellMinX = tx * 16;
      const cellMaxX = (tx + 1) * 16;
      const cellMinY = ty * 16;
      const cellMaxY = (ty + 1) * 16;
      const counts = getCustomLevelEntityCounts(currentLevel);

      // Avoid unnecessary state clones & enforce safe entity limits before cloning
      if (brush.kind === 'erase') {
        const hasTile = currentLevel.tiles[ty]?.[tx] !== null;
        const hasCoin = currentLevel.coins.some(
          c => c.x >= cellMinX && c.x < cellMaxX && c.y >= cellMinY && c.y < cellMaxY
        );
        const hasEnemy = currentLevel.enemies.some(
          e => e.x >= cellMinX - 4 && e.x < cellMaxX + 4 && e.y >= cellMinY - 12 && e.y < cellMaxY
        );
        const hasPlatform = (currentLevel.floatingPlatforms || []).some(
          fp => cellMaxX > fp.x && cellMinX < fp.x + fp.width && cellMaxY > fp.y && cellMinY < fp.y + 16
        );
        const hasYoshi = (currentLevel.yoshis || []).some(
          y => cellMaxX > y.x && cellMinX < y.x + 20 && cellMaxY > y.y && cellMinY < y.y + 20
        );
        const hasCarryable = (currentLevel.carryables || []).some(
          c => cellMaxX > c.x && cellMinX < c.x + 16 && cellMaxY > c.y && cellMinY < c.y + 16
        );
        const hasKeyhole = (currentLevel.keyholes || []).some(
          k => cellMaxX > k.x && cellMinX < k.x + 16 && cellMaxY > k.y && cellMinY < k.y + 24
        );
        if (!hasTile && !hasCoin && !hasEnemy && !hasPlatform && !hasYoshi && !hasCarryable && !hasKeyhole) return;
      }

      if (brush.kind === 'yoshi') {
        if (isCastleStageForYoshi(currentLevel)) {
          notifyError('Yoshi não pode ser inserido nem spawnado dentro do castelo!');
          return;
        }
        const spawnX = Math.max(0, Math.min((currentLevel.width - 2) * 16, tx * 16));
        const spawnY = Math.max(16, (ty + 1) * 16 - 20);
        const currentYoshis = currentLevel.yoshis || [];
        const remainingYoshis = currentYoshis.filter(
          y => !(Math.abs(y.x - spawnX) < 16 && Math.abs(y.y - spawnY) < 20)
        ).length;
        const netDelta = 1 - (currentYoshis.length - remainingYoshis);
        if (remainingYoshis + 1 > EDITOR_MAX_YOSHIS) {
          notifyError(`Limite seguro de Yoshis (${EDITOR_MAX_YOSHIS}) atingido!`);
          return;
        }
        if (counts.total + netDelta > EDITOR_MAX_TOTAL_ENTITIES) {
          notifyError(`Limite seguro de entidades (${EDITOR_MAX_TOTAL_ENTITIES}) atingido!`);
          return;
        }
      }

      if (brush.kind === 'carryable') {
        const spawnX = tx * 16;
        const spawnY = ty * 16;
        const currentCarryables = currentLevel.carryables || [];
        const remaining = currentCarryables.filter(
          c => !(Math.abs(c.x - spawnX) < 12 && Math.abs(c.y - spawnY) < 12)
        ).length;
        const netDelta = 1 - (currentCarryables.length - remaining);
        if (remaining + 1 > EDITOR_MAX_CARRYABLES) {
          notifyError(`Limite seguro de objetos carregáveis (${EDITOR_MAX_CARRYABLES}) atingido!`);
          return;
        }
        if (counts.total + netDelta > EDITOR_MAX_TOTAL_ENTITIES) {
          notifyError(`Limite seguro de entidades (${EDITOR_MAX_TOTAL_ENTITIES}) atingido!`);
          return;
        }
      }

      if (brush.kind === 'keyhole') {
        const spawnX = tx * 16;
        const spawnY = Math.max(16, (ty + 1) * 16 - 24);
        const currentKeyholes = currentLevel.keyholes || [];
        const remaining = currentKeyholes.filter(
          k => !(Math.abs(k.x - spawnX) < 12 && Math.abs(k.y - spawnY) < 20)
        ).length;
        const netDelta = 1 - (currentKeyholes.length - remaining);
        if (remaining + 1 > EDITOR_MAX_KEYHOLES) {
          notifyError(`Limite seguro de buracos de chave (${EDITOR_MAX_KEYHOLES}) atingido!`);
          return;
        }
        if (counts.total + netDelta > EDITOR_MAX_TOTAL_ENTITIES) {
          notifyError(`Limite seguro de entidades (${EDITOR_MAX_TOTAL_ENTITIES}) atingido!`);
          return;
        }
      }

      if (brush.kind === 'coin') {
        const exists = currentLevel.coins.some(
          c => Math.floor(c.x / 16) === tx && Math.floor(c.y / 16) === ty
        );
        if (exists && currentLevel.tiles[ty]?.[tx] === null) return;
        if (!exists) {
          if (counts.coins >= EDITOR_MAX_COINS) {
            notifyError(`Limite seguro de moedas (${EDITOR_MAX_COINS}) atingido!`);
            return;
          }
          if (counts.total >= EDITOR_MAX_TOTAL_ENTITIES) {
            notifyError(`Limite seguro de entidades (${EDITOR_MAX_TOTAL_ENTITIES}) atingido!`);
            return;
          }
        }
      }

      if (brush.kind === 'tile') {
        const existingTile = currentLevel.tiles[ty]?.[tx];
        const desiredContent =
          brush.tileType === 'question'
            ? brush.content || 'coin'
            : brush.tileType === 'exclam_yellow'
            ? brush.content || 'mushroom'
            : brush.tileType === 'exclam_green'
            ? brush.content || 'feather'
            : brush.tileType === 'exclam_red'
            ? brush.content || 'fireflower'
            : brush.tileType === 'exclam_pink'
            ? brush.content || 'femboy'
            : brush.tileType === 'exclam_blue'
            ? brush.content || 'leaf'
            : 'none';
        const desiredInvisible = brush.invisible ? true : undefined;
        if (
          existingTile &&
          existingTile.type === brush.tileType &&
          existingTile.content === desiredContent &&
          existingTile.invisible === desiredInvisible
        ) {
          return;
        }
      }

      if (brush.kind === 'pipe_key_cave') {
        if (tx + 1 >= currentLevel.width) return;
        const bottomY = Math.min(12, Math.max(3, ty));
        const topY = Math.max(2, bottomY - brush.height + 1);
        const expectedFromX = tx * 16;
        const expectedFromY = (topY - 1) * 16;
        const alreadyPlaced =
          currentLevel.tiles[topY]?.[tx]?.type === 'pipe_warp_top_left' &&
          currentLevel.tiles[topY]?.[tx + 1]?.type === 'pipe_warp_top_right' &&
          (currentLevel.pipeWarps || []).some(
            pw =>
              pw.toLevel === KEY_CAVE_PIPE_TARGET &&
              pw.from.x === expectedFromX &&
              pw.from.y === expectedFromY
          );
        if (alreadyPlaced) return;
      }

      if (brush.kind === 'pipe') {
        if (tx + 1 >= currentLevel.width) return;
        if (brush.withPiranha) {
          const remainingEnemies = currentLevel.enemies.filter(
            e => !(e.type === 'piranha' && Math.abs(e.x - (tx * 16 + 8)) < 16)
          ).length;
          const netEnemyDelta = 1 - (counts.enemies - remainingEnemies);
          if (remainingEnemies + 1 > EDITOR_MAX_ENEMIES) {
            notifyError(`Limite seguro de inimigos (${EDITOR_MAX_ENEMIES}) atingido!`);
            return;
          }
          if (counts.total + netEnemyDelta > EDITOR_MAX_TOTAL_ENTITIES) {
            notifyError(`Limite seguro de entidades (${EDITOR_MAX_TOTAL_ENTITIES}) atingido!`);
            return;
          }
        }
      }

      if (brush.kind === 'floating_platform') {
        const px = Math.min((currentLevel.width - 3) * 16, tx * 16);
        const py = ty * 16;
        const currentPlatforms = currentLevel.floatingPlatforms || [];
        const remainingPlatforms = currentPlatforms.filter(
          fp => !(Math.abs(fp.x - px) < 24 && Math.abs(fp.y - py) < 16)
        ).length;
        const netDelta = 1 - (currentPlatforms.length - remainingPlatforms);
        if (remainingPlatforms + 1 > EDITOR_MAX_FLOATING_PLATFORMS) {
          notifyError(`Limite seguro de plataformas (${EDITOR_MAX_FLOATING_PLATFORMS}) atingido!`);
          return;
        }
        if (counts.total + netDelta > EDITOR_MAX_TOTAL_ENTITIES) {
          notifyError(`Limite seguro de entidades (${EDITOR_MAX_TOTAL_ENTITIES}) atingido!`);
          return;
        }
      }

      if (brush.kind === 'enemy') {
        const isTall =
          brush.enemyType === 'koopa' ||
          brush.enemyType === 'red_koopa' ||
          brush.enemyType === 'paratroopa' ||
          brush.enemyType === 'hammer_bro' ||
          brush.enemyType === 'dry_bones';
        const isBoss = brush.enemyType === 'bowser';
        const spawnX = brush.enemyType === 'piranha' ? tx * 16 + 8 : tx * 16;
        const spawnY = isTall || isBoss ? (ty + 1) * 16 - 24 : ty * 16;
        const remainingEnemies = currentLevel.enemies.filter(
          e => !(Math.abs(e.x - spawnX) < 12 && Math.abs(e.y - spawnY) < 16)
        ).length;
        const netEnemyDelta = 1 - (counts.enemies - remainingEnemies);
        if (remainingEnemies + 1 > EDITOR_MAX_ENEMIES) {
          notifyError(`Limite seguro de inimigos (${EDITOR_MAX_ENEMIES}) atingido!`);
          return;
        }
        if (counts.total + netEnemyDelta > EDITOR_MAX_TOTAL_ENTITIES) {
          notifyError(`Limite seguro de entidades (${EDITOR_MAX_TOTAL_ENTITIES}) atingido!`);
          return;
        }
      }

      updateCurrentLevel(draft => {
        const clearCoinsAndEnemiesAtCell = () => {
          draft.coins = draft.coins.filter(
            c => !(c.x >= cellMinX && c.x < cellMaxX && c.y >= cellMinY && c.y < cellMaxY)
          );
          draft.enemies = draft.enemies.filter(
            e => !(e.x >= cellMinX - 4 && e.x < cellMaxX + 4 && e.y >= cellMinY - 12 && e.y < cellMaxY)
          );
          if (draft.floatingPlatforms) {
            draft.floatingPlatforms = draft.floatingPlatforms.filter(
              fp => !(cellMaxX > fp.x && cellMinX < fp.x + fp.width && cellMaxY > fp.y && cellMinY < fp.y + 16)
            );
          }
          if (draft.yoshis) {
            draft.yoshis = draft.yoshis.filter(
              y => !(cellMaxX > y.x && cellMinX < y.x + 20 && cellMaxY > y.y && cellMinY < y.y + 20)
            );
            if (draft.yoshis.length === 0) draft.yoshis = undefined;
          }
          if (draft.carryables) {
            draft.carryables = draft.carryables.filter(
              c => !(cellMaxX > c.x && cellMinX < c.x + 16 && cellMaxY > c.y && cellMinY < c.y + 16)
            );
            if (draft.carryables.length === 0) draft.carryables = undefined;
          }
          if (draft.keyholes) {
            draft.keyholes = draft.keyholes.filter(
              k => !(cellMaxX > k.x && cellMinX < k.x + 16 && cellMaxY > k.y && cellMinY < k.y + 24)
            );
            if (draft.keyholes.length === 0) draft.keyholes = undefined;
          }
        };

        if (brush.kind === 'erase') {
          const prevTile = draft.tiles[ty][tx];
          draft.tiles[ty][tx] = null;
          clearCoinsAndEnemiesAtCell();
          pruneKeyCavePipeWarps(draft);
          if (prevTile && (prevTile.type === 'pole' || prevTile.type === 'pole_top')) {
            const flagTx = Math.floor(draft.flagX / 16);
            if (flagTx === tx) {
              const hasRemainingPole = draft.tiles.some(
                row => row[tx]?.type === 'pole' || row[tx]?.type === 'pole_top'
              );
              if (!hasRemainingPole) {
                draft.flagX = 999999;
              }
            }
          }
          return draft;
        }

        if (brush.kind === 'mario_start') {
          draft.marioStart = { x: tx * 16, y: ty * 16 };
          return draft;
        }

        if (brush.kind === 'yoshi') {
          if (isCastleStageForYoshi(draft)) return draft;
          const spawnX = Math.max(0, Math.min((draft.width - 2) * 16, tx * 16));
          const spawnY = Math.max(16, (ty + 1) * 16 - 20);
          const nextYoshis = (draft.yoshis || []).filter(
            y => !(Math.abs(y.x - spawnX) < 16 && Math.abs(y.y - spawnY) < 20)
          );
          nextYoshis.push({ x: spawnX, y: spawnY });
          draft.yoshis = nextYoshis;
          return draft;
        }

        if (brush.kind === 'carryable') {
          const spawnX = tx * 16;
          const spawnY = ty * 16;
          const nextCarryables = (draft.carryables || []).filter(
            c => !(Math.abs(c.x - spawnX) < 12 && Math.abs(c.y - spawnY) < 12)
          );
          nextCarryables.push({ kind: brush.carryKind, x: spawnX, y: spawnY });
          draft.carryables = nextCarryables;
          return draft;
        }

        if (brush.kind === 'keyhole') {
          const spawnX = tx * 16;
          const spawnY = Math.max(16, (ty + 1) * 16 - 24);
          const nextKeyholes = (draft.keyholes || []).filter(
            k => !(Math.abs(k.x - spawnX) < 12 && Math.abs(k.y - spawnY) < 20)
          );
          nextKeyholes.push({ x: spawnX, y: spawnY });
          draft.keyholes = nextKeyholes;
          return draft;
        }

        if (brush.kind === 'coin') {
          draft.tiles[ty][tx] = null;
          pruneKeyCavePipeWarps(draft);
          const exists = draft.coins.some(
            c => Math.floor(c.x / 16) === tx && Math.floor(c.y / 16) === ty
          );
          if (!exists) {
            draft.coins.push({ x: tx * 16 + 8, y: ty * 16 });
          }
          return draft;
        }

        if (brush.kind === 'tile') {
          draft.tiles[ty][tx] = {
            type: brush.tileType,
            content:
              brush.tileType === 'question'
                ? brush.content || 'coin'
                : brush.tileType === 'exclam_yellow'
                ? brush.content || 'mushroom'
                : brush.tileType === 'exclam_green'
                ? brush.content || 'feather'
                : brush.tileType === 'exclam_red'
                ? brush.content || 'fireflower'
                : brush.tileType === 'exclam_pink'
                ? brush.content || 'femboy'
                : brush.tileType === 'exclam_blue'
                ? brush.content || 'leaf'
                : 'none',
            bumpOffset: 0,
            bumpVel: 0,
            invisible: brush.invisible ? true : undefined,
          };
          pruneKeyCavePipeWarps(draft);
          if (brush.tileType === 'axe') {
            draft.flagX = 999999;
            draft.castleX = Math.min(draft.width - 2, tx + 6) * 16;
          }
          return draft;
        }

        if (brush.kind === 'pipe_key_cave') {
          placeKeyCavePipeInLevel(draft, tx, ty, brush.height);
          return draft;
        }

        if (brush.kind === 'pipe') {
          if (tx + 1 >= draft.width) return draft;
          const bottomY = Math.min(12, ty);
          const topY = Math.max(2, bottomY - brush.height + 1);
          draft.tiles[topY][tx] = { type: 'pipe_top_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
          draft.tiles[topY][tx + 1] = { type: 'pipe_top_right', content: 'none', bumpOffset: 0, bumpVel: 0 };
          for (let py = topY + 1; py <= bottomY; py++) {
            draft.tiles[py][tx] = { type: 'pipe_body_left', content: 'none', bumpOffset: 0, bumpVel: 0 };
            draft.tiles[py][tx + 1] = { type: 'pipe_body_right', content: 'none', bumpOffset: 0, bumpVel: 0 };
          }
          pruneKeyCavePipeWarps(draft);
          if (brush.withPiranha) {
            draft.enemies = draft.enemies.filter(
              e => !(e.type === 'piranha' && Math.abs(e.x - (tx * 16 + 8)) < 16)
            );
            draft.enemies.push({ type: 'piranha', x: tx * 16 + 8, y: topY * 16 });
          }
          return draft;
        }

        if (brush.kind === 'flagpole_goal') {
          // Clear previous flagpole tiles
          for (let py = 0; py < draft.height; py++) {
            for (let px = 0; px < draft.width; px++) {
              const t = draft.tiles[py][px];
              if (t && (t.type === 'pole' || t.type === 'pole_top')) {
                draft.tiles[py][px] = null;
              }
            }
          }
          const flagTile = Math.max(4, Math.min(draft.width - 8, tx));
          draft.tiles[12][flagTile] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
          for (let y = 3; y <= 11; y++) {
            draft.tiles[y][flagTile] = { type: 'pole', content: 'none', bumpOffset: 0, bumpVel: 0 };
          }
          draft.tiles[2][flagTile] = { type: 'pole_top', content: 'none', bumpOffset: 0, bumpVel: 0 };
          draft.flagX = flagTile * 16;

          const cStart = Math.min(draft.width - 6, flagTile + 3);
          for (let cx = cStart; cx <= cStart + 4 && cx < draft.width - 1; cx++) {
            for (let cy = 8; cy <= 12; cy++) {
              draft.tiles[cy][cx] = { type: 'castle_brick', content: 'none', bumpOffset: 0, bumpVel: 0 };
            }
            if ((cx - cStart) % 2 === 0) {
              draft.tiles[7][cx] = { type: 'castle_crenel', content: 'none', bumpOffset: 0, bumpVel: 0 };
            }
          }
          if (cStart + 2 < draft.width - 1) {
            draft.tiles[11][cStart + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
            draft.tiles[12][cStart + 2] = { type: 'castle_door', content: 'none', bumpOffset: 0, bumpVel: 0 };
            draft.castleX = (cStart + 2) * 16;
          }
          pruneKeyCavePipeWarps(draft);
          return draft;
        }

        if (brush.kind === 'floating_platform') {
          if (!draft.floatingPlatforms) draft.floatingPlatforms = [];
          const px = Math.min((draft.width - 3) * 16, tx * 16);
          const py = ty * 16;
          draft.floatingPlatforms = draft.floatingPlatforms.filter(
            fp => !(Math.abs(fp.x - px) < 24 && Math.abs(fp.y - py) < 16)
          );
          draft.floatingPlatforms.push({
            x: px,
            y: py,
            width: 48,
            axis: brush.axis,
            range: brush.axis === 'bob' ? 14 : 28,
            speed: 0.035,
            phase: 0,
          });
          return draft;
        }

        if (brush.kind === 'enemy') {
          const isTall =
            brush.enemyType === 'koopa' ||
            brush.enemyType === 'red_koopa' ||
            brush.enemyType === 'paratroopa' ||
            brush.enemyType === 'hammer_bro' ||
            brush.enemyType === 'dry_bones';
          const isBoss = brush.enemyType === 'bowser';
          let spawnX = tx * 16;
          let spawnY = ty * 16;
          if (brush.enemyType === 'piranha') {
            spawnX = tx * 16 + 8;
          } else if (isTall || isBoss) {
            spawnY = (ty + 1) * 16 - 24;
          }
          draft.enemies = draft.enemies.filter(
            e => !(Math.abs(e.x - spawnX) < 12 && Math.abs(e.y - spawnY) < 16)
          );
          draft.enemies.push({ type: brush.enemyType, x: spawnX, y: spawnY });
          return draft;
        }

        return draft;
      }, { recordUndo: true });
    },
    [currentLevel, activeOption, updateCurrentLevel, notifyError]
  );

  // Release transient interaction state & canvas backing store when closing editor
  useEffect(() => {
    if (!isOpen) {
      isDrawingRef.current = false;
      lastPaintedCellRef.current = null;
      dragEraseModeRef.current = false;
      strokeSnapshotRef.current = null;
      strokeCommittedRef.current = false;
      setHoverCell(null);
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    }
  }, [isOpen]);

  // Draw only the visible horizontal viewport slice so backing-store width stays <= 2048px (prevents GPU black screen — R1.16.1IZ.4)
  const drawEditorCanvas = useCallback(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas || !currentLevel) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalW = currentLevel.width * cellSize;
    const totalH = currentLevel.height * cellSize;
    const scrollEl = scrollContainerRef.current;
    const viewportW = scrollEl?.clientWidth && scrollEl.clientWidth > 0 ? scrollEl.clientWidth : Math.min(totalW, 1280);
    const drawW = Math.max(1, Math.min(totalW, Math.min(EDITOR_MAX_CANVAS_BACKING_WIDTH, Math.max(viewportW + cellSize * 4, 1024))));
    const rawScrollLeft = scrollEl?.scrollLeft ?? 0;
    const offsetX = Math.max(0, Math.min(Math.floor(rawScrollLeft), Math.max(0, totalW - drawW)));

    if (canvas.width !== drawW || canvas.height !== totalH) {
      canvas.width = drawW;
      canvas.height = totalH;
    }
    canvas.style.width = `${drawW}px`;
    canvas.style.height = `${totalH}px`;
    canvas.style.transform = `translateX(${offsetX}px)`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Background sky
    ctx.fillStyle = currentLevel.bgColor || THEME_BG_COLORS[currentLevel.theme] || '#5c94fc';
    ctx.fillRect(0, 0, drawW, totalH);

    const startTx = Math.max(0, Math.floor(offsetX / cellSize) - 1);
    const endTx = Math.min(currentLevel.width - 1, Math.ceil((offsetX + drawW) / cellSize) + 1);

    // Draw visible tiles
    for (let ty = 0; ty < currentLevel.height; ty++) {
      const row = currentLevel.tiles[ty];
      if (!row) continue;
      for (let tx = startTx; tx <= endTx; tx++) {
        const block = row[tx];
        if (!block) continue;
        const dx = tx * cellSize - offsetX;
        const dy = ty * cellSize;

        let sprite: HTMLCanvasElement | null = null;
        switch (block.type) {
          case 'ground':
            sprite = atlas.tileGround;
            break;
          case 'underground_ground':
            sprite = atlas.tileGroundUnderground;
            break;
          case 'brick':
            sprite = atlas.tileBrick;
            break;
          case 'underground_brick':
            sprite = atlas.tileBrickUnderground;
            break;
          case 'coral':
            sprite = atlas.tileCoral;
            break;
          case 'sea_ground':
            sprite = atlas.tileSeaGround;
            break;
          case 'ghost_floor':
            sprite = atlas.tileGhostFloor;
            break;
          case 'ghost_brick':
            sprite = atlas.tileGhostBrick;
            break;
          case 'question':
            sprite = atlas.tileQuestionFrames[0];
            break;
          case 'question_empty':
            sprite = atlas.tileQuestionEmpty;
            break;
          case 'exclam_yellow':
            sprite = atlas.tileExclamYellowActive;
            break;
          case 'exclam_green':
            sprite = atlas.tileExclamGreenActive;
            break;
          case 'exclam_red':
            sprite = atlas.tileExclamRedActive;
            break;
          case 'exclam_pink':
            sprite = atlas.tileExclamPinkActive;
            break;
          case 'exclam_blue':
            sprite = atlas.tileExclamBlueActive;
            break;
          case 'yellow_switch':
            sprite = atlas.tileYellowSwitch;
            break;
          case 'yellow_switch_pressed':
            sprite = atlas.tileYellowSwitchPressed;
            break;
          case 'green_switch':
            sprite = atlas.tileGreenSwitch;
            break;
          case 'green_switch_pressed':
            sprite = atlas.tileGreenSwitchPressed;
            break;
          case 'red_switch':
            sprite = atlas.tileRedSwitch;
            break;
          case 'red_switch_pressed':
            sprite = atlas.tileRedSwitchPressed;
            break;
          case 'pink_switch':
            sprite = atlas.tilePinkSwitch;
            break;
          case 'pink_switch_pressed':
            sprite = atlas.tilePinkSwitchPressed;
            break;
          case 'blue_switch':
            sprite = atlas.tileBlueSwitch;
            break;
          case 'blue_switch_pressed':
            sprite = atlas.tileBlueSwitchPressed;
            break;
          case 'hard_block':
            sprite = atlas.tileHardBlock;
            break;
          case 'pipe_top_left':
          case 'pipe_warp_top_left':
            sprite = atlas.pipeTopLeft;
            break;
          case 'pipe_top_right':
          case 'pipe_warp_top_right':
            sprite = atlas.pipeTopRight;
            break;
          case 'pipe_body_left':
            sprite = atlas.pipeBodyLeft;
            break;
          case 'pipe_body_right':
            sprite = atlas.pipeBodyRight;
            break;
          case 'castle_brick':
          case 'castle_stone':
          case 'castle_crenel':
            sprite = atlas.castleBrick;
            break;
          case 'castle_door':
            sprite = atlas.castleDoor;
            break;
          case 'pole':
            sprite = atlas.flagPoleBody;
            break;
          case 'pole_top':
            sprite = atlas.flagPoleTop;
            break;
          case 'lava':
            sprite = atlas.tileLavaFrames[0];
            break;
          case 'bridge':
            sprite = atlas.tileBridge;
            break;
          case 'axe':
            sprite = atlas.tileAxeFrames[0];
            break;
        }

        ctx.save();
        if (block.invisible) {
          ctx.globalAlpha = 0.45;
        }
        if (sprite) {
          ctx.drawImage(sprite, dx, dy, cellSize, cellSize);
        }
        if (block.invisible) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#fce078';
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(dx + 1, dy + 1, cellSize - 2, cellSize - 2);
        }
        if (block.type === 'question' && block.content !== 'none' && block.content !== 'coin') {
          const itemSprite =
            block.content === 'mushroom'
              ? atlas.itemMushroomSuper
              : block.content === 'fireflower'
              ? atlas.itemFireFlowerFrames[0]
              : block.content === 'leaf'
              ? atlas.itemSuperLeaf
              : block.content === 'feather'
              ? atlas.itemFeather
              : block.content === 'femboy'
              ? atlas.itemFemboy
              : block.content === '1up'
              ? atlas.itemMushroom1Up
              : atlas.itemCoinFrames[0];
            if (itemSprite) {
            const badgeSize = Math.max(8, Math.round(cellSize * 0.55));
            ctx.drawImage(
              itemSprite,
              dx + cellSize - badgeSize,
              dy + cellSize - badgeSize,
              badgeSize,
              badgeSize
            );
          }
        }
        if (
          block.type === 'pipe_warp_top_left' &&
          (currentLevel.pipeWarps || []).some(
            pw =>
              pw.toLevel === KEY_CAVE_PIPE_TARGET &&
              Math.floor(pw.from.x / 16) === tx &&
              Math.floor((pw.from.y + pw.from.height) / 16) === ty
          )
        ) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.strokeRect(dx + 1, dy + 1, cellSize * 2 - 2, cellSize - 2);
          const keyBadge = Math.max(10, Math.round(cellSize * 0.72));
          ctx.drawImage(
            atlas.itemKey,
            dx + cellSize - keyBadge / 2,
            dy + Math.round((cellSize - keyBadge) / 2),
            keyBadge,
            keyBadge
          );
        }
        ctx.restore();
      }
    }

    // Draw SMW Points Goal Gate preview (2.5D dual pillar + top arch + grounded pedestal + tape)
    if (currentLevel.flagX > 0 && currentLevel.flagX < currentLevel.width * 16) {
      const fx = (currentLevel.flagX / 16) * cellSize - offsetX;
      if (fx >= -cellSize * 3 && fx <= drawW + cellSize * 2) {
        const frontX = fx + cellSize * 1.25;
        const frontTopOffset = cellSize * 0.375;

        // Top 2.5D connecting beam between back cap and front cap
        ctx.save();
        ctx.strokeStyle = '#181828';
        ctx.lineWidth = Math.max(3, Math.round(cellSize * 0.35));
        ctx.beginPath();
        ctx.moveTo(fx + cellSize * 0.55, 2.45 * cellSize);
        ctx.lineTo(frontX + cellSize * 0.5, 2.45 * cellSize + frontTopOffset);
        ctx.stroke();

        ctx.strokeStyle = '#dce4f2';
        ctx.lineWidth = Math.max(2, Math.round(cellSize * 0.2));
        ctx.beginPath();
        ctx.moveTo(fx + cellSize * 0.55, 2.45 * cellSize);
        ctx.lineTo(frontX + cellSize * 0.5, 2.45 * cellSize + frontTopOffset);
        ctx.stroke();

        // Moving Goal Tape ribbon between pillars
        ctx.drawImage(atlas.flagTriangle, fx + cellSize * 0.55, 4.2 * cellSize, cellSize * 1.15, cellSize * 0.9);

        // Front pillar extending cleanly down to row 13 ground pedestal
        for (let py = 3; py <= 12; py++) {
          ctx.drawImage(
            atlas.flagPoleBody,
            frontX,
            py * cellSize + (py === 3 ? frontTopOffset : 0),
            cellSize,
            py === 3 ? cellSize - frontTopOffset : cellSize
          );
        }
        ctx.drawImage(atlas.flagPoleTop, frontX, 2 * cellSize + frontTopOffset, cellSize, cellSize);

        // Grounded pedestal base under front pillar
        ctx.fillStyle = '#181828';
        ctx.fillRect(frontX + cellSize * 0.08, 12.7 * cellSize, cellSize * 0.84, cellSize * 0.3);
        ctx.fillStyle = '#8494b0';
        ctx.fillRect(frontX + cellSize * 0.14, 12.76 * cellSize, cellSize * 0.72, cellSize * 0.18);
        ctx.restore();
      }
    }

    // Draw standalone coins
    const scale = cellSize / 16;
    currentLevel.coins.forEach(c => {
      const cx = (c.x - 8) * scale - offsetX;
      if (cx < -cellSize || cx > drawW + cellSize) return;
      const cy = c.y * scale;
      ctx.drawImage(atlas.itemCoinFrames[0], cx, cy, cellSize, cellSize);
    });

    // Draw floating platforms preview
    (currentLevel.floatingPlatforms || []).forEach(fp => {
      const px = fp.x * scale - offsetX;
      const pw = fp.width * scale;
      if (px + pw < -cellSize || px > drawW + cellSize) return;
      const py = fp.y * scale;
      const ph = (fp.height ?? 10) * scale;
      ctx.save();
      ctx.fillStyle = '#483068';
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#9070c8';
      ctx.fillRect(px, py, pw, Math.max(2, Math.round(2 * scale)));
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      ctx.fillStyle = '#e9d5ff';
      ctx.font = `${Math.max(8, Math.round(9 * scale))}px monospace`;
      ctx.fillText(fp.axis === 'horizontal' ? '↔' : fp.axis === 'vertical' ? '↕' : '~', px + 4, py + ph - 2);
      ctx.restore();
    });

    // Draw enemies
    currentLevel.enemies.forEach(e => {
      const drawX = (e.type === 'piranha' ? e.x - 4 : e.x) * scale - offsetX;
      if (drawX < -cellSize * 2 || drawX > drawW + cellSize * 2) return;
      const ey = e.y * scale;
      let sprite: HTMLCanvasElement = atlas.goombaWalk1;
      let w = 16;
      let h = 16;

      switch (e.type) {
        case 'koopa':
          sprite = atlas.koopaWalk1;
          h = 24;
          break;
        case 'red_koopa':
          sprite = atlas.redKoopaWalk1;
          h = 24;
          break;
        case 'paratroopa':
          sprite = atlas.paratroopa1;
          h = 24;
          break;
        case 'hammer_bro':
          sprite = atlas.hammerBroWalk1;
          h = 24;
          break;
        case 'piranha':
          sprite = atlas.piranha1;
          break;
        case 'blooper':
          sprite = atlas.blooper1;
          break;
        case 'cheep_cheep':
          sprite = atlas.cheepCheep1;
          break;
        case 'fast_cheep':
          sprite = atlas.fastCheep1;
          break;
        case 'bullet_bill':
          sprite = atlas.bulletBill;
          break;
        case 'lava_bubble':
          sprite = atlas.lavaBubble1;
          break;
        case 'boo':
          sprite = atlas.booChase;
          break;
        case 'dry_bones':
          sprite = atlas.dryBonesWalk1;
          h = 24;
          break;
        case 'bowser':
          sprite = atlas.bowser1;
          w = 24;
          h = 24;
          break;
      }

      ctx.drawImage(sprite, drawX, ey, w * scale, h * scale);
    });

    // Draw Keyholes & Carryables (Key, Blue P-Switch, Cyan P-Switch)
    (currentLevel.keyholes || []).forEach(kh => {
      const kx = kh.x * scale - offsetX;
      if (kx < -cellSize * 2 || kx > drawW + cellSize * 2) return;
      const ky = kh.y * scale;
      ctx.drawImage(atlas.itemKeyhole, kx, ky, 16 * scale, 24 * scale);
    });

    (currentLevel.carryables || []).forEach(c => {
      const cx = c.x * scale - offsetX;
      if (cx < -cellSize * 2 || cx > drawW + cellSize * 2) return;
      const cy = c.y * scale;
      const sprite =
        c.kind === 'key'
          ? atlas.itemKey
          : c.kind === 'p_switch_blue'
          ? atlas.itemPSwitchBlue
          : atlas.itemPSwitchCyan;
      ctx.drawImage(sprite, cx, cy, cellSize, cellSize);
    });

    // Draw Yoshis placed in non-castle editor stages
    (currentLevel.yoshis || []).forEach(yPos => {
      const yx = yPos.x * scale - offsetX;
      if (yx < -cellSize * 2 || yx > drawW + cellSize * 2) return;
      const yy = yPos.y * scale;
      ctx.drawImage(atlas.yoshiIdle, yx, yy, 20 * scale, 20 * scale);
    });

    // Draw Mario Spawn point marker
    const mx = currentLevel.marioStart.x * scale - offsetX;
    if (mx >= -cellSize && mx <= drawW + cellSize) {
      const my = currentLevel.marioStart.y * scale;
      ctx.drawImage(atlas.marioSmallIdle, mx, my, cellSize, cellSize);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(mx, my, cellSize, cellSize);
    }

    // Draw grid lines (only visible columns)
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let tx = startTx; tx <= endTx + 1; tx++) {
        const x = tx * cellSize - offsetX + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, totalH);
      }
      for (let ty = 0; ty <= currentLevel.height; ty++) {
        const y = ty * cellSize + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(drawW, y);
      }
      ctx.stroke();
    }
  }, [isOpen, currentLevel, cellSize, showGrid, atlas]);

  // Render the level editor canvas whenever modal opens or level/zoom/grid updates (hover is CSS overlay — R1.16.1IZ.4)
  useEffect(() => {
    drawEditorCanvas();
    if (!isOpen) return;
    const rafId = requestAnimationFrame(() => drawEditorCanvas());
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, currentLevel, cellSize, showGrid, atlas]);

  // Redraw viewport slice smoothly on horizontal scroll or container resize
  useEffect(() => {
    if (!isOpen) return;
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    let rafId: number | null = null;
    const scheduleDraw = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        drawEditorCanvas();
      });
    };
    scrollEl.addEventListener('scroll', scheduleDraw, { passive: true });
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleDraw);
      resizeObserver.observe(scrollEl);
    }
    return () => {
      scrollEl.removeEventListener('scroll', scheduleDraw);
      resizeObserver?.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isOpen, drawEditorCanvas]);

  const getCellFromPointer = (clientX: number, clientY: number) => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper || !currentLevel) return null;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const tx = Math.floor((relX / rect.width) * currentLevel.width);
    const ty = Math.floor((relY / rect.height) * currentLevel.height);
    if (tx < 0 || tx >= currentLevel.width || ty < 0 || ty >= currentLevel.height) return null;
    return { tx, ty };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cell = getCellFromPointer(e.clientX, e.clientY);
    if (!cell || !currentLevel) return;
    isDrawingRef.current = true;
    dragEraseModeRef.current = e.button === 2;
    strokeSnapshotRef.current = cloneLevelData(currentLevel);
    strokeCommittedRef.current = false;
    const cellKey = `${cell.tx},${cell.ty},${dragEraseModeRef.current}`;
    lastPaintedCellRef.current = cellKey;
    applyBrushAtCell(cell.tx, cell.ty, dragEraseModeRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cell = getCellFromPointer(e.clientX, e.clientY);
    setHoverCell(cell);
    if (!isDrawingRef.current || !cell) return;
    const cellKey = `${cell.tx},${cell.ty},${dragEraseModeRef.current}`;
    if (lastPaintedCellRef.current !== cellKey) {
      lastPaintedCellRef.current = cellKey;
      applyBrushAtCell(cell.tx, cell.ty, dragEraseModeRef.current);
    }
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPaintedCellRef.current = null;
    dragEraseModeRef.current = false;
    strokeSnapshotRef.current = null;
    strokeCommittedRef.current = false;
  };

  const handleNewBlankLevel = () => {
    if (customLevels.length >= EDITOR_MAX_CUSTOM_LEVELS) {
      notifyError(`Limite de ${EDITOR_MAX_CUSTOM_LEVELS} fases na memória atingido. Exclua uma antes.`);
      return;
    }
    const idx = customLevels.length + 1;
    const created = createBlankCustomLevel(`MINHA FASE ${idx}`, 'overworld', 100);
    onUpdateCustomLevels([...customLevels, created], created.id);
    notify('Nova fase criada na memória!');
  };

  const handleDuplicateLevel = () => {
    if (!currentLevel) return;
    if (customLevels.length >= EDITOR_MAX_CUSTOM_LEVELS) {
      notifyError(`Limite de ${EDITOR_MAX_CUSTOM_LEVELS} fases na memória atingido. Exclua uma antes.`);
      return;
    }
    const sanitized = sanitizeCustomLevelEntities(currentLevel).level;
    sanitized.id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    sanitized.name = `${currentLevel.name.slice(0, 12)} 2`;
    sanitized.isCustom = true;
    onUpdateCustomLevels([...customLevels, sanitized], sanitized.id);
    notify('Cópia criada na memória temporária!');
  };

  const handleDeleteLevel = () => {
    if (!currentLevel) return;
    undoStacksRef.current.delete(currentLevel.id);
    redoStacksRef.current.delete(currentLevel.id);
    setHistoryRevision(r => r + 1);
    const nextCampaignIds = effectiveCampaignIds.filter(id => id !== currentLevel.id);
    if (nextCampaignIds.length !== effectiveCampaignIds.length) {
      setEffectiveCampaignIds(nextCampaignIds);
    }
    const remaining = customLevels.filter(l => l.id !== currentLevel.id);
    if (remaining.length === 0) {
      const fresh = createBlankCustomLevel('MINHA FASE 1', 'overworld', 100);
      onUpdateCustomLevels([fresh], fresh.id);
    } else {
      onUpdateCustomLevels(remaining, remaining[0].id);
    }
    notify('Fase removida da memória.');
  };

  const handleImportTemplate = (sourceId: string) => {
    if (customLevels.length >= EDITOR_MAX_CUSTOM_LEVELS) {
      notifyError(`Limite de ${EDITOR_MAX_CUSTOM_LEVELS} fases na memória atingido. Exclua uma antes.`);
      return;
    }
    const isWorldStage = sourceId.startsWith('world:');
    let base: LevelData;
    if (isWorldStage) {
      const worldKey = sourceId.slice('world:'.length);
      base =
        worldKey === 'smw-wiki-1-secret'
          ? createSmwWiki1SecretRoom()
          : createSmwWikiWorldStage(worldKey);
    } else {
      switch (sourceId) {
        case 'world-1-2':
          base = createWorld1_2();
          break;
        case 'world-2-2':
          base = createWorld2_2();
          break;
        case 'world-ghost':
          base = createWorldGhostHouse();
          break;
        case 'world-1-4':
          base = createWorld1_4();
          break;
        case 'secret-vault':
          base = createSecretVault();
          break;
        default:
          base = createWorld1_1();
          break;
      }
    }
    const { level: sanitized, truncated } = sanitizeCustomLevelEntities(base);
    const copy: LevelData = {
      ...sanitized,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: isWorldStage ? base.name.slice(0, 16) : `EDIT ${base.name}`.slice(0, 16),
      biomeLabel: isWorldStage ? base.biomeLabel : 'FASE EDITADA',
      isCustom: true,
    };
    onUpdateCustomLevels([...customLevels, copy], copy.id);
    notify(
      truncated
        ? `${base.name} carregada (entidades ajustadas ao limite seguro)!`
        : `${base.name} carregada na memória para edição!`
    );
  };

  const handleThemeChange = (theme: LevelData['theme']) => {
    const hadYoshis = (currentLevel?.yoshis?.length ?? 0) > 0;
    updateCurrentLevel(
      draft => {
        draft.theme = theme;
        draft.bgColor = THEME_BG_COLORS[theme];
        if (theme === 'castle') {
          draft.yoshis = undefined;
          const hasAxe = draft.tiles.some(row => row.some(t => t?.type === 'axe'));
          if (!hasAxe) {
            const axeX = Math.max(8, draft.width - 12);
            draft.tiles[12][axeX] = { type: 'hard_block', content: 'none', bumpOffset: 0, bumpVel: 0 };
            draft.tiles[11][axeX] = { type: 'axe', content: 'none', bumpOffset: 0, bumpVel: 0 };
            draft.flagX = 999999;
            draft.castleX = Math.min(draft.width - 2, axeX + 6) * 16;
          }
        }
        return draft;
      },
      { recordUndo: true }
    );
    if (theme === 'castle' && hadYoshis) {
      notify('Yoshi removido: ele não pode entrar dentro de castelos!');
    }
  };

  const handleWidthChange = (newWidth: number) => {
    if (!currentLevel) return;
    const clampedTarget = Math.max(40, Math.min(240, newWidth));
    if (clampedTarget === currentLevel.width) return;
    updateCurrentLevel(
      draft => {
        const clamped = clampedTarget;
        const oldW = draft.width;
        const groundType: TileType =
          draft.theme === 'underground'
            ? 'underground_ground'
            : draft.theme === 'underwater'
            ? 'sea_ground'
            : draft.theme === 'castle'
            ? 'castle_stone'
            : draft.theme === 'ghost_house'
            ? 'ghost_floor'
            : 'ground';

        for (let ty = 0; ty < draft.height; ty++) {
          if (clamped > oldW) {
            for (let tx = oldW; tx < clamped; tx++) {
              if (ty >= 13) {
                draft.tiles[ty][tx] = { type: groundType, content: 'none', bumpOffset: 0, bumpVel: 0 };
              } else if ((draft.theme === 'underground' || draft.theme === 'castle' || draft.theme === 'ghost_house') && ty <= 1) {
                draft.tiles[ty][tx] = {
                  type: draft.theme === 'castle' ? 'castle_stone' : draft.theme === 'ghost_house' ? 'ghost_brick' : 'underground_brick',
                  content: 'none',
                  bumpOffset: 0,
                  bumpVel: 0,
                };
              } else {
                draft.tiles[ty][tx] = null;
              }
            }
          } else {
            draft.tiles[ty] = draft.tiles[ty].slice(0, clamped);
          }
        }
        draft.width = clamped;
        draft.enemies = draft.enemies.filter(e => e.x < clamped * 16 - 8);
        draft.coins = draft.coins.filter(c => c.x < clamped * 16 - 8);
        if (draft.pipeWarps) {
          draft.pipeWarps = draft.pipeWarps.filter(pw => pw.from.x + pw.from.width <= clamped * 16);
          pruneKeyCavePipeWarps(draft);
        }
        draft.marioStart.x = Math.min(draft.marioStart.x, (clamped - 4) * 16);
        if (draft.flagX < 99000 && draft.flagX >= clamped * 16) {
          draft.flagX = (clamped - 8) * 16;
        }
        draft.castleX = Math.min(draft.castleX, (clamped - 2) * 16);
        return draft;
      },
      { recordUndo: true }
    );
  };

  const scrollToFraction = (fraction: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      left: Math.max(0, (el.scrollWidth - el.clientWidth) * fraction),
      behavior: 'smooth',
    });
  };

  if (!isOpen || !currentLevel) return null;

  const visiblePalette = paletteOptions.filter(opt => opt.tab === activeTab);
  const levelHasGoal = hasValidStageGoal(currentLevel);
  const entityCounts = getCustomLevelEntityCounts(currentLevel);
  const nearEntityLimit = entityCounts.total >= Math.floor(EDITOR_MAX_TOTAL_ENTITIES * 0.85);
  const atEntityLimit = entityCounts.total >= EDITOR_MAX_TOTAL_ENTITIES;

  const handleToggleImmortality = () => {
    const next = !localImmortality;
    setLocalImmortality(next);
    onToggleEditorImmortality?.(next);
    notify(next ? 'Imortalidade ativada para testes!' : 'Imortalidade desativada.');
  };

  const handleExportLevelFile = () => {
    const json = serializeLevelToFileJson(currentLevel);
    const filename = getWorldStageFilename(currentLevel) || getExportLevelFilename(currentLevel.name);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    notify(`Fase exportada: ${filename}`);
  };

  const handleUploadLevelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (customLevels.length >= EDITOR_MAX_CUSTOM_LEVELS) {
        throw new Error(`Limite de ${EDITOR_MAX_CUSTOM_LEVELS} fases na memória atingido. Exclua uma antes.`);
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Arquivo muito grande (máximo 2 MB).');
      }
      const text = await file.text();
      const imported = parseImportedLevelFile(text);
      onUpdateCustomLevels([...customLevels, imported], imported.id);
      notify(`Fase "${imported.name}" carregada via arquivo!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao importar arquivo de fase.';
      notifyError(msg);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const launchPlayCurrentLevel = () => {
    setShowMissingGoalAlert(false);
    setPendingCampaignStart(false);
    onPlayLevel(cloneLevelData(currentLevel), { immortality: localImmortality });
    onClose();
  };

  const launchPlayCampaign = () => {
    if (campaignLevels.length === 0) return;
    setShowMissingGoalAlert(false);
    setPendingCampaignStart(false);
    if (onPlayCampaign) {
      onPlayCampaign(
        campaignLevels.map(l => cloneLevelData(l)),
        { immortality: localImmortality }
      );
      onClose();
    } else {
      launchPlayCurrentLevel();
    }
  };

  const handleRequestPlayLevel = () => {
    if (!levelHasGoal) {
      setPendingCampaignStart(false);
      setShowMissingGoalAlert(true);
      return;
    }
    launchPlayCurrentLevel();
  };

  const handleRequestPlayCampaign = () => {
    if (campaignLevels.length === 0) {
      setShowCampaignPanel(true);
      notifyError('Adicione pelo menos 1 fase à Campanha Personalizada.');
      return;
    }
    const missingGoalStage = campaignLevels.find(lvl => !hasValidStageGoal(lvl));
    if (missingGoalStage) {
      onUpdateCustomLevels(customLevels, missingGoalStage.id);
      setPendingCampaignStart(true);
      setShowMissingGoalAlert(true);
      return;
    }
    launchPlayCampaign();
  };

  const handleAddCurrentToCampaign = () => {
    if (!currentLevel) return;
    if (effectiveCampaignIds.length >= EDITOR_MAX_CUSTOM_LEVELS) {
      notifyError(`Limite máximo de ${EDITOR_MAX_CUSTOM_LEVELS} fases na campanha atingido.`);
      return;
    }
    setEffectiveCampaignIds([...effectiveCampaignIds, currentLevel.id]);
    setShowCampaignPanel(true);
    notify(`"${currentLevel.name}" adicionada à campanha!`);
  };

  const handleAddAllToCampaign = () => {
    const ids = customLevels.slice(0, EDITOR_MAX_CUSTOM_LEVELS).map(l => l.id);
    setEffectiveCampaignIds(ids);
    setShowCampaignPanel(true);
    notify(`${ids.length} fase(s) adicionadas à campanha na ordem atual!`);
  };

  const handleMoveCampaignStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= effectiveCampaignIds.length) return;
    const next = [...effectiveCampaignIds];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setEffectiveCampaignIds(next);
  };

  const handleRemoveCampaignStage = (index: number) => {
    setEffectiveCampaignIds(effectiveCampaignIds.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/92 animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-6xl bg-stone-900 border-2 border-amber-500/70 rounded-xl shadow-2xl p-3 sm:p-5 text-stone-100 max-h-[95vh] flex flex-col gap-3 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Hammer className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm sm:text-base font-['Press_Start_2P',monospace] text-amber-400">
                EDITOR DE FASES
              </h2>
              <p className="text-[10px] sm:text-xs text-stone-400 font-mono">
                Memória temporária (sessão atual) • Fases do editor não registram recordes
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusNotice && (
              <span className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[11px] font-mono">
                {statusNotice}
              </span>
            )}
            {statusError && (
              <span className="px-2.5 py-1 rounded bg-red-950/90 border border-red-500/70 text-red-200 text-[11px] font-mono">
                {statusError}
              </span>
            )}
            <button
              type="button"
              onClick={handleToggleImmortality}
              title="Permite jogar esta fase sem morrer para inimigos, lava, buracos ou tempo"
              className={`px-3 py-2 rounded-lg border font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] flex items-center gap-1.5 cursor-pointer transition ${
                localImmortality
                  ? 'bg-purple-950/90 border-purple-400 text-purple-200 shadow-lg shadow-purple-950/50'
                  : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-300'
              }`}
            >
              <Shield className={`w-3.5 h-3.5 ${localImmortality ? 'text-purple-300 fill-purple-400/30' : 'text-stone-400'}`} />
              <span>IMORTAL: {localImmortality ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCampaignPanel(v => !v)}
              title="Montar campanha personalizada em sequência com suas fases editadas"
              className={`px-3 py-2 rounded-lg border font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] flex items-center gap-1.5 cursor-pointer transition ${
                showCampaignPanel || campaignLevels.length > 0
                  ? 'bg-amber-950/90 border-amber-400 text-amber-200'
                  : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-300'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
              <span>CAMPANHA ({campaignLevels.length})</span>
            </button>
            {campaignLevels.length > 0 && (
              <button
                type="button"
                onClick={handleRequestPlayCampaign}
                title="Jogar campanha personalizada do 1º ao último mapa na ordem definida"
                className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 fill-stone-950" />
                <span>JOGAR CAMPANHA</span>
              </button>
            )}
            {onBackToMainMenu && (
              <button
                type="button"
                onClick={onBackToMainMenu}
                title="Voltar para o menu inicial"
                className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] flex items-center gap-1.5 cursor-pointer transition"
              >
                <Home className="w-3.5 h-3.5 text-amber-400" />
                <span>MENU INICIAL</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleRequestPlayLevel}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-stone-950 font-['Press_Start_2P',monospace] text-[10px] font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-stone-950" />
              JOGAR FASE
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar editor"
              className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slot & Level Metadata Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 bg-stone-950/75 border border-stone-800 rounded-lg p-2.5 shrink-0 text-xs">
          {/* Temporary memory slots */}
          <div className="lg:col-span-5 flex flex-wrap items-center gap-1.5">
            <select
              value={currentLevel.id}
              onChange={e => onUpdateCustomLevels(customLevels, e.target.value)}
              className="flex-1 min-w-[130px] bg-stone-900 border border-stone-700 rounded px-2 py-1.5 font-mono text-xs text-amber-300 font-bold"
            >
              {customLevels.map(lvl => (
                <option key={lvl.id} value={lvl.id}>
                  {lvl.name} ({lvl.theme} • {lvl.width}t)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNewBlankLevel}
              title="Nova fase em branco"
              className="px-2 py-1.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova
            </button>
            <button
              type="button"
              onClick={handleDuplicateLevel}
              title="Duplicar fase atual"
              className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-sky-300 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDeleteLevel}
              title="Excluir fase atual"
              className="p-1.5 rounded bg-stone-800 hover:bg-red-950 border border-stone-700 hover:border-red-600 text-red-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stage properties */}
          <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
            <input
              type="text"
              maxLength={16}
              value={currentLevel.name}
              onFocus={() => {
                nameUndoArmedRef.current = true;
              }}
              onBlur={() => {
                nameUndoArmedRef.current = true;
              }}
              onChange={e => {
                const nextName = e.target.value.toUpperCase();
                const shouldPush = nameUndoArmedRef.current;
                nameUndoArmedRef.current = false;
                updateCurrentLevel(
                  draft => {
                    draft.name = nextName;
                    return draft;
                  },
                  { recordUndo: shouldPush }
                );
              }}
              placeholder="NOME DA FASE"
              className="w-32 bg-stone-900 border border-stone-700 rounded px-2 py-1.5 font-mono text-xs text-white"
            />

            <select
              value={currentLevel.theme}
              onChange={e => handleThemeChange(e.target.value as LevelData['theme'])}
              className="bg-stone-900 border border-stone-700 rounded px-2 py-1.5 font-mono text-xs text-stone-200"
            >
              <option value="overworld">Superfície</option>
              <option value="underground">Caverna</option>
              <option value="underwater">Água</option>
              <option value="ghost_house">Mansão Fantasma</option>
              <option value="castle">Castelo</option>
            </select>

            <select
              value={currentLevel.width}
              onChange={e => handleWidthChange(Number(e.target.value))}
              className="bg-stone-900 border border-stone-700 rounded px-2 py-1.5 font-mono text-xs text-stone-200"
            >
              {![60, 100, 140, 180, 220].includes(currentLevel.width) && (
                <option value={currentLevel.width}>Atual ({currentLevel.width})</option>
              )}
              <option value={60}>Curta (60)</option>
              <option value={100}>Média (100)</option>
              <option value={140}>Longa (140)</option>
              <option value={180}>Épica (180)</option>
              <option value={220}>Máx (220)</option>
            </select>

            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <Download className="w-3.5 h-3.5 text-stone-400" />
              <select
                value=""
                onChange={e => {
                  if (e.target.value) handleImportTemplate(e.target.value);
                }}
                className="bg-stone-900 border border-stone-700 rounded px-2 py-1.5 font-mono text-xs text-amber-200"
              >
                <option value="">Importar Base...</option>
                <optgroup label="Modo World (JSON)">
                  {WORLD_STAGE_JSON_REGISTRY.map(entry => (
                    <option key={entry.key} value={`world:${entry.key}`}>
                      {entry.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Fases Clássicas">
                  <option value="world-1-1">Mundo 1-1</option>
                  <option value="world-1-2">Mundo 1-2</option>
                  <option value="world-2-2">Mundo 2-2 (Água)</option>
                  <option value="world-ghost">Mansão de Fantasmas</option>
                  <option value="world-1-4">Mundo 1-4 (Castelo)</option>
                  <option value="secret-vault">Cofre Secreto</option>
                </optgroup>
              </select>

              <button
                type="button"
                onClick={handleExportLevelFile}
                title="Baixar arquivo JSON desta fase"
                className="px-2.5 py-1.5 rounded bg-sky-950/90 hover:bg-sky-900 border border-sky-500/60 text-sky-200 font-mono text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <FileDown className="w-3.5 h-3.5 text-sky-400" />
                <span>Exportar</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Carregar fase de um arquivo JSON (.smb.json / .json)"
                className="px-2.5 py-1.5 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-200 font-mono text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleUploadLevelFile}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Custom Multi-Map Campaign Builder Panel (R1.16.1B0.4) */}
        {showCampaignPanel && (
          <div className="bg-stone-950/90 border border-amber-500/50 rounded-lg p-2.5 shrink-0 flex flex-col gap-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-['Press_Start_2P',monospace] text-[10px] text-amber-300">
                  CAMPANHA PERSONALIZADA ({campaignLevels.length} {campaignLevels.length === 1 ? 'FASE' : 'FASES'})
                </span>
                <span className="hidden md:inline text-[11px] font-mono text-stone-400">
                  • Ao passar de cada mapa, avança para o próximo na sequência abaixo
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={handleAddCurrentToCampaign}
                  className="px-2.5 py-1 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-200 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Fase Atual</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddAllToCampaign}
                  className="px-2.5 py-1 rounded bg-sky-950/90 hover:bg-sky-900 border border-sky-500/60 text-sky-200 cursor-pointer"
                >
                  Add Todas ({customLevels.length})
                </button>
                {campaignLevels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEffectiveCampaignIds([])}
                    className="px-2 py-1 rounded bg-stone-800 hover:bg-red-950 border border-stone-700 hover:border-red-600 text-stone-300 hover:text-red-200 cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRequestPlayCampaign}
                  disabled={campaignLevels.length === 0}
                  className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-stone-950" />
                  <span>Iniciar ({campaignLevels.length})</span>
                </button>
              </div>
            </div>

            {campaignLevels.length === 0 ? (
              <div className="text-[11px] font-mono text-stone-400 px-2 py-1.5 rounded bg-stone-900/70 border border-stone-800">
                Nenhuma fase adicionada ainda. Clique em <strong className="text-emerald-300">+ Add Fase Atual</strong> ou{' '}
                <strong className="text-sky-300">Add Todas</strong> para montar a sequência da sua campanha.
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
                {campaignLevels.map((lvl, idx) => (
                  <div
                    key={`${lvl.id}-${idx}`}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border font-mono text-[11px] ${
                      lvl.id === currentLevel.id
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                        : 'bg-stone-900 border-stone-700 text-stone-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onUpdateCustomLevels(customLevels, lvl.id)}
                      title="Selecionar fase no editor"
                      className="flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span className="px-1 rounded bg-amber-500 text-stone-950 font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-bold">{lvl.name}</span>
                    </button>
                    {!hasValidStageGoal(lvl) && (
                      <span title="Fase sem final (Poste ou Machado)">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMoveCampaignStage(idx, -1)}
                      disabled={idx === 0}
                      title="Mover para antes"
                      className="p-0.5 rounded hover:bg-stone-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveCampaignStage(idx, 1)}
                      disabled={idx === campaignLevels.length - 1}
                      title="Mover para depois"
                      className="p-0.5 rounded hover:bg-stone-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveCampaignStage(idx)}
                      title="Remover da campanha"
                      className="p-0.5 rounded hover:bg-red-950 text-red-400 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tool Tabs & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'blocks', label: 'Blocos & Terreno', icon: Layers },
                { id: 'items', label: 'Itens & Canos', icon: Sparkles },
                { id: 'enemies', label: 'Inimigos', icon: Hammer },
                { id: 'special', label: 'Meta & Ferramentas', icon: Flag },
              ] as const
            ).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Desfazer última ação (Ctrl+Z)"
              className="px-2 py-1.5 rounded border bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed border-stone-700 text-stone-200 flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Desfazer</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Refazer ação desfeita (Ctrl+Y)"
              className="px-2 py-1.5 rounded border bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed border-stone-700 text-stone-200 flex items-center gap-1 cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5 text-sky-300" />
              <span className="hidden sm:inline">Refazer</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedBrushId('mario_start')}
              className={`px-2.5 py-1.5 rounded border flex items-center gap-1 cursor-pointer ${
                selectedBrushId === 'mario_start'
                  ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                  : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Início
            </button>
            <button
              type="button"
              onClick={() => setSelectedBrushId('erase')}
              className={`px-2.5 py-1.5 rounded border flex items-center gap-1 cursor-pointer ${
                selectedBrushId === 'erase'
                  ? 'bg-red-950 border-red-400 text-red-300'
                  : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              Apagar
            </button>
            <button
              type="button"
              onClick={() => setShowGrid(g => !g)}
              title="Mostrar/ocultar grade"
              className={`p-1.5 rounded border cursor-pointer ${
                showGrid
                  ? 'bg-stone-800 border-amber-500/50 text-amber-300'
                  : 'bg-stone-900 border-stone-700 text-stone-500'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCellSize(s => (s === 32 ? 24 : 16))}
              title="Diminuir zoom"
              className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCellSize(s => (s === 16 ? 24 : 32))}
              title="Aumentar zoom"
              className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-options for ? Block content & Invisible block flag */}
        {(activeTab === 'items' || activeTab === 'blocks') && (
          <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 bg-stone-950/60 border border-stone-800 rounded-lg text-[11px] font-mono shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-stone-400">Conteúdo do bloco ?:</span>
              <select
                value={questionContent}
                onChange={e => {
                  setQuestionContent(e.target.value as ItemContent);
                  setSelectedBrushId('tile_question');
                }}
                className="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-amber-300"
              >
                {ITEM_CONTENT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer text-stone-300">
              <input
                type="checkbox"
                checked={invisibleBlock}
                onChange={e => setInvisibleBlock(e.target.checked)}
                className="accent-amber-400"
              />
              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              Bloco Invisível (Tijolo / ?)
            </label>
          </div>
        )}

        {/* Palette Buttons */}
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 shrink-0">
          {visiblePalette.map(opt => {
            const isSelected = selectedBrushId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedBrushId(opt.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-2 transition cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                    : 'bg-stone-800/90 hover:bg-stone-700 border-stone-700 text-stone-300'
                }`}
              >
                {opt.id === 'erase' ? (
                  <Eraser className="w-5 h-5 text-red-400" />
                ) : (
                  <SpriteIcon getCanvas={opt.preview} size={22} />
                )}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Tile Canvas (Viewport-windowed backing store <= 2048px — R1.16.1IZ.4) */}
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-[240px] overflow-x-auto overflow-y-auto rounded-lg border-2 border-stone-700 bg-stone-950"
          >
            <div
              ref={canvasWrapperRef}
              className="relative inline-block"
              style={{
                width: currentLevel.width * cellSize,
                height: currentLevel.height * cellSize,
              }}
            >
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => {
                  setHoverCell(null);
                  handlePointerUp();
                }}
                onContextMenu={e => e.preventDefault()}
                className="absolute top-0 left-0 block cursor-crosshair touch-none"
                style={{ imageRendering: 'pixelated' }}
              />
              {hoverCell && (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute border-2 ${
                    activeOption.id === 'erase' ? 'border-red-400' : 'border-amber-400'
                  }`}
                  style={{
                    left: hoverCell.tx * cellSize,
                    top: hoverCell.ty * cellSize,
                    width: cellSize,
                    height: cellSize,
                  }}
                />
              )}
            </div>
          </div>

          {/* Navigation Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-stone-400 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Ferramenta: <strong className="text-amber-300">{activeOption.label}</strong>
                  {hoverCell ? ` • Célula (${hoverCell.tx}, ${hoverCell.ty})` : ' • Clique/arraste para editar • Botão direito apaga'}
                </span>
              </div>
              <span
                title="Limite seguro de entidades para proteger a memória volátil do navegador"
                className={`px-2 py-0.5 rounded border text-[10px] ${
                  atEntityLimit
                    ? 'bg-red-950/90 border-red-500/70 text-red-200'
                    : nearEntityLimit
                    ? 'bg-amber-950/90 border-amber-500/70 text-amber-200'
                    : 'bg-stone-900 border-stone-700 text-stone-300'
                }`}
              >
                Entidades: {entityCounts.total}/{EDITOR_MAX_TOTAL_ENTITIES} (Inimigos {entityCounts.enemies}/{EDITOR_MAX_ENEMIES} • Moedas {entityCounts.coins}/{EDITOR_MAX_COINS} • Plat. {entityCounts.floatingPlatforms}/{EDITOR_MAX_FLOATING_PLATFORMS})
              </span>
              {!levelHasGoal && (
                <span className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-300 flex items-center gap-1 text-[10px]">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  Sem final (Poste ou Machado)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>Ir para:</span>
              <button
                type="button"
                onClick={() => scrollToFraction(0)}
                className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 cursor-pointer"
              >
                Início
              </button>
              <button
                type="button"
                onClick={() => scrollToFraction(0.5)}
                className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 cursor-pointer"
              >
                Meio
              </button>
              <button
                type="button"
                onClick={() => scrollToFraction(1)}
                className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 cursor-pointer"
              >
                Final
              </button>
            </div>
          </div>
        </div>

        {/* Missing Stage Goal Warning Modal */}
        {showMissingGoalAlert && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Fase sem final específico"
            className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div className="w-full max-w-md bg-stone-900 border-2 border-amber-500 rounded-xl shadow-2xl p-5 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-['Press_Start_2P',monospace] text-xs sm:text-sm text-amber-400 leading-relaxed">
                  FASE SEM FINAL DEFINIDO!
                </h3>
                <p className="text-xs sm:text-sm text-stone-200 font-sans leading-relaxed">
                  Esta fase ainda não possui um <strong>Poste de Bandeira (Mastro + Castelo)</strong> nem um <strong>Machado de Castelo</strong>.
                </p>
                <p className="text-[11px] text-amber-200/85 font-mono">
                  Sem um objetivo final colocado, não será possível encerrar ou vencer a fase durante o jogo.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowMissingGoalAlert(false);
                    setActiveTab('special');
                    setSelectedBrushId('flagpole_goal');
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-['Press_Start_2P',monospace] text-[10px] font-bold shadow cursor-pointer transition"
                >
                  COLOCAR FINAL
                </button>
                <button
                  type="button"
                  onClick={pendingCampaignStart ? launchPlayCampaign : launchPlayCurrentLevel}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 font-['Press_Start_2P',monospace] text-[10px] cursor-pointer transition"
                >
                  JOGAR MESMO ASSIM
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
