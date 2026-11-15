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
} from 'lucide-react';
import { EnemyType, ItemContent, LevelData, TileType } from '../game/types.ts';
import {
  cloneLevelData,
  createBlankCustomLevel,
  createSecretVault,
  createWorld1_1,
  createWorld1_2,
  createWorld1_4,
  createWorld2_2,
} from '../game/levels.ts';
import { SpriteAtlas } from '../game/sprites.ts';

interface LevelEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  customLevels: LevelData[];
  activeCustomLevelId: string | null;
  onUpdateCustomLevels: (levels: LevelData[], activeId: string | null) => void;
  onPlayLevel: (level: LevelData) => void;
  onBackToMainMenu?: () => void;
}

type EditorBrushKind =
  | { kind: 'erase' }
  | { kind: 'mario_start' }
  | { kind: 'coin' }
  | { kind: 'tile'; tileType: TileType; content?: ItemContent; invisible?: boolean }
  | { kind: 'pipe'; height: 2 | 3 | 4; withPiranha?: boolean }
  | { kind: 'flagpole_goal' }
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
};

const ITEM_CONTENT_OPTIONS: { value: ItemContent; label: string }[] = [
  { value: 'coin', label: 'Moeda' },
  { value: 'mushroom', label: 'Cogumelo' },
  { value: 'fireflower', label: 'Flor de Fogo' },
  { value: 'leaf', label: 'Super Folha' },
  { value: 'feather', label: 'Pena (Cape)' },
  { value: 'femboy', label: 'Laço Femboy' },
  { value: 'star', label: 'Estrela' },
  { value: '1up', label: 'Cogumelo 1-UP' },
];

export const LevelEditorModal: React.FC<LevelEditorModalProps> = ({
  isOpen,
  onClose,
  customLevels,
  activeCustomLevelId,
  onUpdateCustomLevels,
  onPlayLevel,
  onBackToMainMenu,
}) => {
  const atlas = useMemo(() => SpriteAtlas.get(), []);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPaintedCellRef = useRef<string | null>(null);
  const dragEraseModeRef = useRef(false);

  const [selectedBrushId, setSelectedBrushId] = useState<string>('tile_brick');
  const [questionContent, setQuestionContent] = useState<ItemContent>('mushroom');
  const [invisibleBlock, setInvisibleBlock] = useState(false);
  const [activeTab, setActiveTab] = useState<PaletteTab>('blocks');
  const [cellSize, setCellSize] = useState<16 | 24 | 32>(24);
  const [showGrid, setShowGrid] = useState(true);
  const [hoverCell, setHoverCell] = useState<{ tx: number; ty: number } | null>(null);
  const [statusNotice, setStatusNotice] = useState<string>('');

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

  const notify = useCallback((msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice(prev => (prev === msg ? '' : prev));
    }, 2200);
  }, []);

  const updateCurrentLevel = useCallback(
    (updater: (draft: LevelData) => LevelData) => {
      if (!currentLevel) return;
      const cloned = cloneLevelData(currentLevel);
      const updated = updater(cloned);
      const nextList = customLevels.map(l => (l.id === currentLevel.id ? updated : l));
      onUpdateCustomLevels(nextList, currentLevel.id);
    },
    [currentLevel, customLevels, onUpdateCustomLevels]
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

      // Question Blocks, Coins & Power-Ups
      {
        id: 'tile_question',
        label: `Bloco ? (${ITEM_CONTENT_OPTIONS.find(o => o.value === questionContent)?.label || 'Item'})`,
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
        id: 'enemy_bowser',
        label: 'Bowser Boss',
        tab: 'enemies',
        brush: { kind: 'enemy', enemyType: 'bowser' },
        preview: () => atlas.bowser1,
      },

      // Special Tools: Spawn, Goals, Eraser
      {
        id: 'mario_start',
        label: 'Início (Mario)',
        tab: 'special',
        brush: { kind: 'mario_start' },
        preview: () => atlas.marioSmallIdle,
      },
      {
        id: 'flagpole_goal',
        label: 'Mastro + Castelo',
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
    [atlas, questionContent, invisibleBlock]
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

      updateCurrentLevel(draft => {
        const cellMinX = tx * 16;
        const cellMaxX = (tx + 1) * 16;
        const cellMinY = ty * 16;
        const cellMaxY = (ty + 1) * 16;

        const clearCoinsAndEnemiesAtCell = () => {
          draft.coins = draft.coins.filter(
            c => !(c.x >= cellMinX && c.x < cellMaxX && c.y >= cellMinY && c.y < cellMaxY)
          );
          draft.enemies = draft.enemies.filter(
            e => !(e.x >= cellMinX - 4 && e.x < cellMaxX + 4 && e.y >= cellMinY - 12 && e.y < cellMaxY)
          );
        };

        if (brush.kind === 'erase') {
          draft.tiles[ty][tx] = null;
          clearCoinsAndEnemiesAtCell();
          return draft;
        }

        if (brush.kind === 'mario_start') {
          draft.marioStart = { x: tx * 16, y: ty * 16 };
          return draft;
        }

        if (brush.kind === 'coin') {
          draft.tiles[ty][tx] = null;
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
            content: brush.tileType === 'question' ? brush.content || 'coin' : 'none',
            bumpOffset: 0,
            bumpVel: 0,
            invisible: brush.invisible ? true : undefined,
          };
          if (brush.tileType === 'axe') {
            draft.flagX = 999999;
            draft.castleX = Math.min(draft.width - 2, tx + 6) * 16;
          }
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
          return draft;
        }

        if (brush.kind === 'enemy') {
          const isTall =
            brush.enemyType === 'koopa' ||
            brush.enemyType === 'red_koopa' ||
            brush.enemyType === 'paratroopa' ||
            brush.enemyType === 'hammer_bro';
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
      });
    },
    [currentLevel, activeOption, updateCurrentLevel]
  );

  // Render the level editor canvas whenever currentLevel, zoom, or hoverCell updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLevel) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalW = currentLevel.width * cellSize;
    const totalH = currentLevel.height * cellSize;
    if (canvas.width !== totalW || canvas.height !== totalH) {
      canvas.width = totalW;
      canvas.height = totalH;
    }
    ctx.imageSmoothingEnabled = false;

    // Background sky
    ctx.fillStyle = currentLevel.bgColor || THEME_BG_COLORS[currentLevel.theme];
    ctx.fillRect(0, 0, totalW, totalH);

    // Draw tiles
    for (let ty = 0; ty < currentLevel.height; ty++) {
      for (let tx = 0; tx < currentLevel.width; tx++) {
        const block = currentLevel.tiles[ty]?.[tx];
        if (!block) continue;
        const dx = tx * cellSize;
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
          case 'question':
            sprite = atlas.tileQuestionFrames[0];
            break;
          case 'question_empty':
            sprite = atlas.tileQuestionEmpty;
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
        // Small item badge inside ? blocks so the player knows what item is inside
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
        ctx.restore();
      }
    }

    // Draw flagpole triangle preview
    if (currentLevel.flagX > 0 && currentLevel.flagX < currentLevel.width * 16) {
      const fx = (currentLevel.flagX / 16) * cellSize - cellSize * 0.85;
      const fy = 3 * cellSize;
      ctx.drawImage(atlas.flagTriangle, fx, fy, cellSize, cellSize);
    }

    // Draw standalone coins
    const scale = cellSize / 16;
    currentLevel.coins.forEach(c => {
      const cx = (c.x - 8) * scale;
      const cy = c.y * scale;
      ctx.drawImage(atlas.itemCoinFrames[0], cx, cy, cellSize, cellSize);
    });

    // Draw enemies
    currentLevel.enemies.forEach(e => {
      const ex = e.x * scale;
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
        case 'bowser':
          sprite = atlas.bowser1;
          w = 24;
          h = 24;
          break;
      }

      const drawX = e.type === 'piranha' ? ex - 4 * scale : ex;
      ctx.drawImage(sprite, drawX, ey, w * scale, h * scale);
    });

    // Draw Mario Spawn point marker
    const mx = currentLevel.marioStart.x * scale;
    const my = currentLevel.marioStart.y * scale;
    ctx.drawImage(atlas.marioSmallIdle, mx, my, cellSize, cellSize);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, cellSize, cellSize);

    // Draw grid lines
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let tx = 0; tx <= currentLevel.width; tx++) {
        const x = tx * cellSize + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, totalH);
      }
      for (let ty = 0; ty <= currentLevel.height; ty++) {
        const y = ty * cellSize + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(totalW, y);
      }
      ctx.stroke();
    }

    // Hover highlight
    if (hoverCell) {
      ctx.strokeStyle = activeOption.id === 'erase' ? '#f87171' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        hoverCell.tx * cellSize + 1,
        hoverCell.ty * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );
    }
  }, [currentLevel, cellSize, showGrid, hoverCell, atlas, activeOption.id]);

  const getCellFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLevel) return null;
    const rect = canvas.getBoundingClientRect();
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
    if (!cell) return;
    isDrawingRef.current = true;
    dragEraseModeRef.current = e.button === 2;
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
  };

  const handleNewBlankLevel = () => {
    const idx = customLevels.length + 1;
    const created = createBlankCustomLevel(`MINHA FASE ${idx}`, 'overworld', 100);
    onUpdateCustomLevels([...customLevels, created], created.id);
    notify('Nova fase criada na memória!');
  };

  const handleDuplicateLevel = () => {
    if (!currentLevel) return;
    const copy = cloneLevelData(currentLevel);
    copy.id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    copy.name = `${currentLevel.name.slice(0, 12)} 2`;
    copy.isCustom = true;
    onUpdateCustomLevels([...customLevels, copy], copy.id);
    notify('Cópia criada na memória temporária!');
  };

  const handleDeleteLevel = () => {
    if (!currentLevel) return;
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
    let base: LevelData;
    switch (sourceId) {
      case 'world-1-2':
        base = createWorld1_2();
        break;
      case 'world-2-2':
        base = createWorld2_2();
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
    const copy: LevelData = {
      ...cloneLevelData(base),
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `EDIT ${base.name}`.slice(0, 16),
      biomeLabel: 'FASE EDITADA',
      isCustom: true,
    };
    onUpdateCustomLevels([...customLevels, copy], copy.id);
    notify(`${base.name} carregada na memória para edição!`);
  };

  const handleThemeChange = (theme: LevelData['theme']) => {
    updateCurrentLevel(draft => {
      draft.theme = theme;
      draft.bgColor = THEME_BG_COLORS[theme];
      if (theme === 'castle') {
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
    });
  };

  const handleWidthChange = (newWidth: number) => {
    updateCurrentLevel(draft => {
      const clamped = Math.max(40, Math.min(240, newWidth));
      const oldW = draft.width;
      const groundType: TileType =
        draft.theme === 'underground'
          ? 'underground_ground'
          : draft.theme === 'underwater'
          ? 'sea_ground'
          : draft.theme === 'castle'
          ? 'castle_stone'
          : 'ground';

      for (let ty = 0; ty < draft.height; ty++) {
        if (clamped > oldW) {
          for (let tx = oldW; tx < clamped; tx++) {
            if (ty >= 13) {
              draft.tiles[ty][tx] = { type: groundType, content: 'none', bumpOffset: 0, bumpVel: 0 };
            } else if ((draft.theme === 'underground' || draft.theme === 'castle') && ty <= 1) {
              draft.tiles[ty][tx] = {
                type: draft.theme === 'castle' ? 'castle_stone' : 'underground_brick',
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
      draft.marioStart.x = Math.min(draft.marioStart.x, (clamped - 4) * 16);
      if (draft.flagX < 99000 && draft.flagX >= clamped * 16) {
        draft.flagX = (clamped - 8) * 16;
      }
      draft.castleX = Math.min(draft.castleX, (clamped - 2) * 16);
      return draft;
    });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/88 backdrop-blur-xs animate-in fade-in duration-150 select-none">
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
                Armazenado na memória temporária do navegador (sessão atual)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusNotice && (
              <span className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[11px] font-mono">
                {statusNotice}
              </span>
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
              onClick={() => {
                onPlayLevel(cloneLevelData(currentLevel));
                onClose();
              }}
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
              onChange={e =>
                updateCurrentLevel(draft => {
                  draft.name = e.target.value.toUpperCase();
                  return draft;
                })
              }
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
              <option value="castle">Castelo</option>
            </select>

            <select
              value={currentLevel.width}
              onChange={e => handleWidthChange(Number(e.target.value))}
              className="bg-stone-900 border border-stone-700 rounded px-2 py-1.5 font-mono text-xs text-stone-200"
            >
              <option value={60}>Curta (60)</option>
              <option value={100}>Média (100)</option>
              <option value={140}>Longa (140)</option>
              <option value={180}>Épica (180)</option>
              <option value={220}>Máx (220)</option>
            </select>

            <div className="flex items-center gap-1 ml-auto">
              <Download className="w-3.5 h-3.5 text-stone-400" />
              <select
                value=""
                onChange={e => {
                  if (e.target.value) handleImportTemplate(e.target.value);
                }}
                className="bg-stone-900 border border-stone-700 rounded px-2 py-1.5 font-mono text-xs text-amber-200"
              >
                <option value="">Importar Base...</option>
                <option value="world-1-1">Mundo 1-1</option>
                <option value="world-1-2">Mundo 1-2</option>
                <option value="world-2-2">Mundo 2-2 (Água)</option>
                <option value="world-1-4">Mundo 1-4 (Castelo)</option>
                <option value="secret-vault">Cofre Secreto</option>
              </select>
            </div>
          </div>
        </div>

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

          <div className="flex items-center gap-1.5 text-xs font-mono">
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

        {/* Scrollable Tile Canvas */}
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-[240px] overflow-x-auto overflow-y-auto rounded-lg border-2 border-stone-700 bg-black"
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
              className="block cursor-crosshair touch-none"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          {/* Navigation Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-stone-400 shrink-0">
            <div className="flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Ferramenta: <strong className="text-amber-300">{activeOption.label}</strong>
                {hoverCell ? ` • Célula (${hoverCell.tx}, ${hoverCell.ty})` : ' • Clique/arraste para editar • Botão direito apaga'}
              </span>
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
      </div>
    </div>
  );
};
