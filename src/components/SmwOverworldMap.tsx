/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Lock,
  Check,
  BookOpen,
  ArrowLeft,
  Castle,
  Ghost,
  Waves,
  Mountain,
  Trees,
  Crown,
  RotateCcw,
  Zap,
  Compass,
  AlertTriangle,
  Save,
  FolderOpen,
  Trash2,
  KeyRound,
} from 'lucide-react';
import {
  JOHANNNNES_CASTLE_1_BOSS_NAME,
  SMW_BETA_VERSION,
  SMW_WORLD_ISLAND_NAME,
  SMW_INTRO_STORY,
  SMW_ISLANDS,
  SMW_ISLAND2_NODES,
  SMW_ISLAND2_PATH_SEGMENTS,
  SMW_ISLAND2_UNAVAILABLE_MSG,
  SMW_WIKIWORLD_NODES,
  SMW_PATH_SEGMENTS,
  SmwBetaProgress,
  SmwIslandId,
  SmwMapNode,
  SmwSaveSlotData,
  SmwWalkStep,
  evaluateSmwPathSegment,
  findSmwMapPath,
  isSmwNodeCompletedAndLocked,
  isSmwNodeUnlocked,
  resolveSmwDirectionalStep,
} from '../game/smwWorldMap.ts';
import { SpriteAtlas } from '../game/sprites.ts';
import { PlayerCharacter } from '../game/types.ts';
import { resolveTvRemoteAction } from '../game/smartTv.ts';

interface SmwOverworldMapProps {
  isOpen: boolean;
  progress: SmwBetaProgress;
  playerCharacter: PlayerCharacter;
  justClearedNodeId?: string | null;
  saveSlots?: (SmwSaveSlotData | null)[];
  castleSavePromptNodeTitle?: string | null;
  openLoadSignal?: number;
  onSelectNode: (nodeId: string) => void;
  onSelectIsland?: (islandId: SmwIslandId) => void;
  onEnterStage: (nodeId: string) => void;
  onDismissStory: () => void;
  onResetProgress: () => void;
  onSaveToSlot?: (slotIndex: number) => void;
  onLoadFromSlot?: (slotIndex: number) => void;
  onDeleteSlot?: (slotIndex: number) => void;
  onDismissCastleSave?: () => void;
  onBackToMainMenu: () => void;
  isReturnToMenuLocked?: boolean;
}

interface PixelSpriteViewProps {
  sprite: HTMLCanvasElement | undefined;
  displayWidth: number;
  displayHeight: number;
  facing?: 'left' | 'right';
  className?: string;
}

const PixelSpriteView: React.FC<PixelSpriteViewProps> = ({
  sprite,
  displayWidth,
  displayHeight,
  facing = 'right',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite) return;
    if (canvas.width !== sprite.width) canvas.width = sprite.width;
    if (canvas.height !== sprite.height) canvas.height = sprite.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (facing === 'left') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(sprite, 0, 0);
    ctx.restore();
  }, [sprite, facing]);

  if (!sprite) return null;

  return (
    <canvas
      ref={canvasRef}
      width={sprite.width}
      height={sprite.height}
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        imageRendering: 'pixelated',
      }}
      className={className}
      aria-hidden="true"
    />
  );
};

interface MapWalkState {
  leadX: number;
  leadY: number;
  leadFacing: 'left' | 'right';
  companionX: number;
  companionY: number;
  companionFacing: 'left' | 'right';
  isWalking: boolean;
  walkFrame: number;
  bobOffsetPx: number;
  ambientTick: number;
}

function getNodePosById(nodeId: string, islandId: SmwIslandId): { x: number; y: number } {
  const nodes = islandId === 'island2' ? SMW_ISLAND2_NODES : SMW_WIKIWORLD_NODES;
  const node = nodes.find(n => n.id === nodeId) || nodes[0];
  return { x: node.mapX, y: node.mapY };
}

function sampleWalkSteps(
  steps: SmwWalkStep[],
  fallbackNodeId: string,
  islandId: SmwIslandId,
  progressVal: number
): { x: number; y: number; dx: number; dy: number } {
  if (steps.length === 0) {
    const pos = getNodePosById(fallbackNodeId, islandId);
    return { x: pos.x, y: pos.y, dx: 1, dy: 0 };
  }
  const clamped = Math.max(0, Math.min(steps.length, progressVal));
  if (clamped >= steps.length) {
    const last = steps[steps.length - 1];
    const s = evaluateSmwPathSegment(last.seg, last.reverse ? 0 : 1);
    return {
      x: s.x,
      y: s.y,
      dx: last.reverse ? -s.dx : s.dx,
      dy: last.reverse ? -s.dy : s.dy,
    };
  }
  const idx = Math.min(steps.length - 1, Math.floor(clamped));
  const step = steps[idx];
  const localT = clamped - idx;
  const evalT = step.reverse ? 1 - localT : localT;
  const s = evaluateSmwPathSegment(step.seg, evalT);
  return {
    x: s.x,
    y: s.y,
    dx: step.reverse ? -s.dx : s.dx,
    dy: step.reverse ? -s.dy : s.dy,
  };
}

export const SmwOverworldMap: React.FC<SmwOverworldMapProps> = ({
  isOpen,
  progress,
  playerCharacter,
  justClearedNodeId = null,
  saveSlots = [null, null, null],
  castleSavePromptNodeTitle = null,
  openLoadSignal = 0,
  onSelectNode,
  onSelectIsland,
  onEnterStage,
  onDismissStory,
  onResetProgress,
  onSaveToSlot,
  onLoadFromSlot,
  onDeleteSlot,
  onDismissCastleSave,
  onBackToMainMenu,
  isReturnToMenuLocked = false,
}) => {
  const [showStory, setShowStory] = useState<boolean>(!progress.storySeen);
  const [showSlotsModal, setShowSlotsModal] = useState<boolean>(false);
  const [slotsModalMode, setSlotsModalMode] = useState<'save' | 'load'>('load');
  const [switchLockedNotice, setSwitchLockedNotice] = useState<string>('');
  const [localIslandId, setLocalIslandId] = useState<SmwIslandId>(
    progress.selectedIslandId === 'island2' ? 'island2' : 'wikiworld'
  );
  const [island2Notice, setIsland2Notice] = useState<string>('');
  const lastLoadSignalRef = useRef<number>(openLoadSignal);
  const atlas = useMemo(() => SpriteAtlas.get(), []);

  const blurActiveElement = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setShowSlotsModal(false);
      return;
    }
    if (castleSavePromptNodeTitle) {
      setSlotsModalMode('save');
      setShowSlotsModal(true);
    }
  }, [isOpen, castleSavePromptNodeTitle]);

  useEffect(() => {
    if (openLoadSignal > 0 && openLoadSignal !== lastLoadSignalRef.current) {
      lastLoadSignalRef.current = openLoadSignal;
      if (isOpen) {
        setShowStory(false);
        setSlotsModalMode('load');
        setShowSlotsModal(true);
      }
    }
  }, [isOpen, openLoadSignal]);

  const activeIsland: SmwIslandId = onSelectIsland
    ? progress.selectedIslandId === 'island2'
      ? 'island2'
      : 'wikiworld'
    : localIslandId;

  const switchIsland = (islandId: SmwIslandId) => {
    setIsland2Notice('');
    setSwitchLockedNotice('');
    if (onSelectIsland) {
      onSelectIsland(islandId);
    } else {
      setLocalIslandId(islandId);
    }
  };

  useEffect(() => {
    if (isOpen && !progress.storySeen && !(openLoadSignal > 0 && showSlotsModal)) {
      setShowStory(true);
    }
  }, [isOpen, progress.storySeen, openLoadSignal, showSlotsModal]);

  const activeNodes = activeIsland === 'island2' ? SMW_ISLAND2_NODES : SMW_WIKIWORLD_NODES;
  const activeSegments =
    activeIsland === 'island2' ? SMW_ISLAND2_PATH_SEGMENTS : SMW_PATH_SEGMENTS;
  const activeIslandInfo =
    SMW_ISLANDS.find(isl => isl.id === activeIsland) || SMW_ISLANDS[0];

  const selectedNode: SmwMapNode = useMemo(() => {
    if (activeIsland === 'island2') {
      return SMW_ISLAND2_NODES[0];
    }
    return (
      SMW_WIKIWORLD_NODES.find(n => n.id === progress.selectedNodeId) ||
      SMW_WIKIWORLD_NODES[0]
    );
  }, [activeIsland, progress.selectedNodeId]);

  const selectedUnlocked =
    activeIsland === 'island2' ? false : isSmwNodeUnlocked(selectedNode.id, progress);
  const selectedCleared =
    activeIsland === 'island2' ? false : progress.clearedNodeIds.includes(selectedNode.id);
  const selectedLockedCompleted =
    activeIsland === 'island2' ? false : isSmwNodeCompletedAndLocked(selectedNode.id, progress);
  const islandCompleted = progress.clearedNodeIds.includes('wiki-5-castelo');
  const clearedCount = progress.clearedNodeIds.length;
  const usedSlotsCount = saveSlots.filter(Boolean).length;

  const companionCharacter: PlayerCharacter =
    playerCharacter === 'wazzima' ? 'mario' : 'wazzima';

  // Continuous branching graph walking state across SMW_PATH_SEGMENTS (R1.16.UC.4)
  const walkStepsRef = useRef<SmwWalkStep[]>([]);
  const walkProgressRef = useRef<number>(0);
  const currentNodeIdRef = useRef<string>(selectedNode.id);
  const currentIslandRef = useRef<SmwIslandId>(activeIsland);
  const wasOpenRef = useRef<boolean>(false);
  const lastFacingRef = useRef<'left' | 'right'>('right');

  const [walkState, setWalkState] = useState<MapWalkState>(() => {
    const pos = getNodePosById(selectedNode.id, activeIsland);
    return {
      leadX: pos.x,
      leadY: pos.y,
      leadFacing: 'right',
      companionX: pos.x - 2.6,
      companionY: pos.y + 0.5,
      companionFacing: 'right',
      isWalking: false,
      walkFrame: 0,
      bobOffsetPx: 0,
      ambientTick: 0,
    };
  });

  // Sync target node when opening, changing island, or changing selection (supports mid-walk chaining)
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const justOpened = !wasOpenRef.current;
    const islandChanged = currentIslandRef.current !== activeIsland;
    wasOpenRef.current = true;
    currentIslandRef.current = activeIsland;

    if (activeIsland === 'island2') {
      walkStepsRef.current = [];
      walkProgressRef.current = 0;
      currentNodeIdRef.current = SMW_ISLAND2_NODES[0].id;
      return;
    }

    if (justOpened || islandChanged) {
      const clearedNode =
        justOpened && justClearedNodeId
          ? SMW_WIKIWORLD_NODES.find(n => n.id === justClearedNodeId)
          : undefined;
      const startId = clearedNode ? clearedNode.id : selectedNode.id;
      walkStepsRef.current = findSmwMapPath(startId, selectedNode.id, activeSegments);
      walkProgressRef.current = 0;
      currentNodeIdRef.current = selectedNode.id;
      return;
    }

    if (currentNodeIdRef.current !== selectedNode.id) {
      const prevSteps = walkStepsRef.current;
      const prevProg = walkProgressRef.current;

      // If still walking along a segment, chain seamlessly from the active segment's origin or target
      if (prevSteps.length > 0 && prevProg < prevSteps.length - 0.01) {
        const idx = Math.min(prevSteps.length - 1, Math.floor(prevProg));
        const activeStep = prevSteps[idx];
        const localT = prevProg - idx;
        const stepFrom = activeStep.reverse ? activeStep.seg.toId : activeStep.seg.fromId;
        const stepTo = activeStep.reverse ? activeStep.seg.fromId : activeStep.seg.toId;

        if (selectedNode.id === stepFrom) {
          // Immediately reversed back along the same segment without snapping!
          walkStepsRef.current = [{ seg: activeStep.seg, reverse: !activeStep.reverse }];
          walkProgressRef.current = Math.max(0, Math.min(1, 1 - localT));
          currentNodeIdRef.current = selectedNode.id;
          return;
        }

        const chainedFromTo = findSmwMapPath(stepTo, selectedNode.id, activeSegments);
        const chainedSteps = [{ ...activeStep }, ...chainedFromTo];
        walkStepsRef.current = chainedSteps;
        walkProgressRef.current = localT;
        currentNodeIdRef.current = selectedNode.id;
        return;
      }

      const originId = currentNodeIdRef.current;
      walkStepsRef.current = findSmwMapPath(originId, selectedNode.id, activeSegments);
      walkProgressRef.current = 0;
      currentNodeIdRef.current = selectedNode.id;
    }
  }, [isOpen, activeIsland, activeSegments, selectedNode.id, justClearedNodeId]);

  // Smooth RAF loop for hero duo walking along curved paths + biome creatures patrolling
  useEffect(() => {
    if (!isOpen) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTime = performance.now();
    let lastRenderSync = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const steps = walkStepsRef.current;
      const totalSteps = steps.length;
      let current = walkProgressRef.current;
      let isWalking = false;

      if (prefersReducedMotion || totalSteps === 0) {
        current = totalSteps;
        walkProgressRef.current = current;
      } else if (current < totalSteps - 0.004) {
        isWalking = true;
        const speedSegmentsPerSec = 2.15;
        current = Math.min(totalSteps, current + speedSegmentsPerSec * dt);
        if (totalSteps - current <= 0.004) {
          current = totalSteps;
          isWalking = false;
        }
        walkProgressRef.current = current;
      } else {
        current = totalSteps;
        walkProgressRef.current = current;
      }

      const minIntervalMs = isWalking ? 16 : 90;
      if (now - lastRenderSync >= minIntervalMs) {
        lastRenderSync = now;
        const leadSample = sampleWalkSteps(
          steps,
          currentNodeIdRef.current,
          activeIsland,
          current
        );

        let leadFacing = lastFacingRef.current;
        if (isWalking && Math.abs(leadSample.dx) > 0.05) {
          leadFacing = leadSample.dx >= 0 ? 'right' : 'left';
          lastFacingRef.current = leadFacing;
        }

        let companionX: number;
        let companionY: number;
        let companionFacing: 'left' | 'right';

        if (isWalking && current > 0.04) {
          const trailProgress = Math.max(0, current - 0.16);
          const trailSample = sampleWalkSteps(
            steps,
            currentNodeIdRef.current,
            activeIsland,
            trailProgress
          );
          companionX = trailSample.x;
          companionY = trailSample.y;
          companionFacing =
            Math.abs(trailSample.dx) > 0.05 ? (trailSample.dx >= 0 ? 'right' : 'left') : leadFacing;
        } else {
          companionX = leadSample.x - 2.6;
          companionY = leadSample.y + 0.5;
          companionFacing = 'right';
          leadFacing = 'right';
          lastFacingRef.current = 'right';
        }

        const walkFrame = prefersReducedMotion
          ? 0
          : isWalking
          ? Math.floor(now / 95) % 3
          : Math.floor(now / 260) % 3;

        const bobOffsetPx = prefersReducedMotion
          ? 0
          : isWalking
          ? Math.abs(Math.sin(now / 65)) * 3.5
          : Math.abs(Math.sin(now / 240)) * 1.2;

        setWalkState({
          leadX: leadSample.x,
          leadY: leadSample.y,
          leadFacing,
          companionX,
          companionY,
          companionFacing,
          isWalking,
          walkFrame,
          bobOffsetPx,
          ambientTick: prefersReducedMotion ? 0 : now / 1000,
        });
      }

      if (!prefersReducedMotion || isWalking) {
        rafId = requestAnimationFrame(tick);
      }
    };

    tick(performance.now());
    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isOpen, activeIsland, selectedNode.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tv = resolveTvRemoteAction(
        { code: e.code, key: e.key, keyCode: e.keyCode },
        { smartTvMode: true, jumpWithUp: false }
      );

      if (showSlotsModal) {
        if (tv.isBack) {
          e.preventDefault();
          setShowSlotsModal(false);
          onDismissCastleSave?.();
          blurActiveElement();
        }
        return;
      }

      if (showStory) {
        if (tv.isConfirm || tv.isBack || tv.actions.includes('jump')) {
          e.preventDefault();
          setShowStory(false);
          onDismissStory();
        }
        return;
      }

      if (tv.isBack) {
        e.preventDefault();
        if (!isReturnToMenuLocked) {
          onBackToMainMenu();
        } else {
          setSwitchLockedNotice('Troca de modo bloqueada após iniciar o Modo World (permitido no Modo Desenvolvedor).');
        }
        return;
      }

      // Quick island switch via PageUp/PageDown
      if (e.code === 'PageDown' || e.code === 'BracketRight') {
        e.preventDefault();
        switchIsland('island2');
        return;
      }
      if (e.code === 'PageUp' || e.code === 'BracketLeft') {
        e.preventDefault();
        switchIsland('wikiworld');
        return;
      }

      // Let focused top-bar buttons (História, Slots, Menu, Ilha 1/2, Zerar Ilha) work on OK/Enter
      if (
        target &&
        target.tagName === 'BUTTON' &&
        !target.dataset.smwNodeBtn &&
        (tv.isConfirm || tv.actions.includes('jump'))
      ) {
        e.preventDefault();
        target.click();
        return;
      }

      const dir =
        tv.actions.includes('right')
          ? 'right'
          : tv.actions.includes('left')
          ? 'left'
          : tv.actions.includes('up')
          ? 'up'
          : tv.actions.includes('down')
          ? 'down'
          : null;

      if (dir) {
        e.preventDefault();
        setSwitchLockedNotice('');
        if (activeIsland === 'island2') {
          setIsland2Notice(SMW_ISLAND2_UNAVAILABLE_MSG);
          return;
        }
        const nextRoadNode = resolveSmwDirectionalStep(
          selectedNode.id,
          dir,
          progress,
          activeIsland
        );
        if (nextRoadNode) {
          onSelectNode(nextRoadNode.id);
        }
      } else if (tv.isConfirm || tv.actions.includes('jump')) {
        e.preventDefault();
        if (activeIsland === 'island2') {
          setIsland2Notice(SMW_ISLAND2_UNAVAILABLE_MSG);
          return;
        }
        if (selectedLockedCompleted) {
          setSwitchLockedNotice('Palácio do Interruptor Amarelo já concluído!');
          return;
        }
        if (selectedUnlocked) {
          blurActiveElement();
          onEnterStage(selectedNode.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    showStory,
    showSlotsModal,
    activeIsland,
    selectedNode,
    selectedUnlocked,
    selectedLockedCompleted,
    progress,
    onSelectNode,
    onEnterStage,
    onDismissStory,
    onDismissCastleSave,
    onBackToMainMenu,
    isReturnToMenuLocked,
  ]);

  if (!isOpen) return null;

  const getNodeIcon = (node: SmwMapNode) => {
    if (node.isSwitchPalace) {
      return <Zap className="w-4 h-4 text-yellow-200 fill-yellow-300" />;
    }
    switch (node.theme) {
      case 'overworld':
        return <Trees className="w-4 h-4 text-emerald-100" />;
      case 'underground':
        return <Mountain className="w-4 h-4 text-stone-100" />;
      case 'underwater':
        return <Waves className="w-4 h-4 text-cyan-100" />;
      case 'ghost_house':
        return <Ghost className="w-4 h-4 text-purple-100" />;
      case 'castle':
        return <Castle className="w-4 h-4 text-amber-100" />;
    }
  };

  const leadSprite = atlas.getCharacterSprite(
    playerCharacter,
    'super',
    'castle_walk',
    walkState.walkFrame
  );
  const companionSprite = atlas.getCharacterSprite(
    companionCharacter,
    'super',
    'castle_walk',
    (walkState.walkFrame + 1) % 3
  );

  // Ambient biome patrolling creatures (Ilha 1)
  const t = walkState.ambientTick;
  const goombaPhase = Math.sin(t * 1.15);
  const goombaX = 13.5 + goombaPhase * 3.6;
  const goombaFacing: 'left' | 'right' = Math.cos(t * 1.15) >= 0 ? 'right' : 'left';
  const goombaSprite = Math.floor(t * 5) % 2 === 0 ? atlas.goombaWalk1 : atlas.goombaWalk2;

  const koopaPhase = Math.sin(t * 0.95 + 1.1);
  const koopaX = 32.5 + koopaPhase * 3.8;
  const koopaFacing: 'left' | 'right' = Math.cos(t * 0.95 + 1.1) >= 0 ? 'right' : 'left';
  const koopaSprite = Math.floor(t * 4.5) % 2 === 0 ? atlas.koopaWalk1 : atlas.koopaWalk2;

  const cheepPhase = Math.sin(t * 1.05 + 2.4);
  const cheepX = 50.5 + cheepPhase * 4.6;
  const cheepY = 74.5 + Math.sin(t * 2.5) * 1.1;
  const cheepFacing: 'left' | 'right' = Math.cos(t * 1.05 + 2.4) >= 0 ? 'right' : 'left';
  const cheepSprite = Math.floor(t * 5) % 2 === 0 ? atlas.cheepCheep1 : atlas.cheepCheep2;

  const dryBonesPhase = Math.sin(t * 0.85 + 0.6);
  const dryBonesX = 63.5 + dryBonesPhase * 3.2;
  const dryBonesFacing: 'left' | 'right' = Math.cos(t * 0.85 + 0.6) >= 0 ? 'right' : 'left';
  const dryBonesSprite = Math.floor(t * 4) % 2 === 0 ? atlas.dryBonesWalk1 : atlas.dryBonesWalk2;

  const booX = 74.5 + Math.cos(t * 0.9) * 2.0;
  const booY = 26.5 + Math.sin(t * 1.6) * 1.6;
  const booFacing: 'left' | 'right' = Math.sin(t * 0.9) <= 0 ? 'right' : 'left';
  const booSprite = Math.floor(t * 2) % 2 === 0 ? atlas.booChase : atlas.booShy;

  const bowserPhase = Math.sin(t * 0.75);
  const bowserX = 84.5 + bowserPhase * 3.5;
  const bowserFacing: 'left' | 'right' = Math.cos(t * 0.75) >= 0 ? 'right' : 'left';
  const bowserSprite = Math.floor(t * 3.5) % 2 === 0 ? atlas.bowser1 : atlas.bowser2;

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between bg-slate-950 text-stone-100 overflow-hidden">
      {/* Top World Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-stone-950/95 border-b border-stone-800 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-amber-300 font-mono">
            <span className="font-bold">{SMW_BETA_VERSION}</span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-semibold truncate ${
                activeIsland === 'island2' ? 'text-purple-300' : 'text-emerald-300'
              }`}
            >
              {activeIslandInfo.name}
            </span>
            {activeIsland === 'wikiworld' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-stone-300">
                  {clearedCount}/{SMW_WIKIWORLD_NODES.length} fases
                </span>
              </>
            )}
          </div>
          <h2 className="font-['Press_Start_2P',monospace] text-[10px] sm:text-xs text-white truncate mt-0.5">
            MAPA DO OVERWORLD
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Island Selector Switcher (RW0.15.0.PW.4) */}
          <div className="flex items-center rounded-lg bg-stone-900 border border-stone-700 p-0.5">
            <button
              type="button"
              onClick={() => switchIsland('wikiworld')}
              className={`min-h-[30px] px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap transition ${
                activeIsland === 'wikiworld'
                  ? 'bg-emerald-700 text-white shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Ilha 1</span>
            </button>
            <button
              type="button"
              onClick={() => switchIsland('island2')}
              className={`min-h-[30px] px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap transition ${
                activeIsland === 'island2'
                  ? 'bg-purple-700 text-white shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <span>Ilha 2 (Beta)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSlotsModalMode('load');
              setShowSlotsModal(true);
            }}
            title="Carregar Progresso Salvo nos Slots (salva ao passar dos castelos)"
            className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-amber-950/90 hover:bg-amber-900 border border-amber-500/70 text-amber-200 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Carregar Progresso ({usedSlotsCount}/3)</span>
            <span className="sm:hidden">Carregar ({usedSlotsCount}/3)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowStory(true)}
            className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-amber-200 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">História</span>
          </button>

          <button
            type="button"
            disabled={isReturnToMenuLocked}
            onClick={() => {
              if (isReturnToMenuLocked) return;
              onBackToMainMenu();
            }}
            title={
              isReturnToMenuLocked
                ? 'Menu inicial bloqueado após iniciar o Modo World (permitido no Modo Desenvolvedor)'
                : 'Voltar ao Menu Inicial'
            }
            className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 disabled:opacity-45 disabled:hover:bg-stone-900 disabled:cursor-not-allowed text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            {isReturnToMenuLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <ArrowLeft className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </div>

      {/* Interactive Super Mario World Island Overworld Viewport */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-gradient-to-b from-sky-500 via-blue-700 to-indigo-950">
        {activeIsland === 'wikiworld' ? (
          <>
            {/* Handcrafted 16-bit SMW Cartography SVG — Ilha 1 (WikiWorldWeb) */}
            <svg
              viewBox="0 0 1000 600"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none select-none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="smwOceanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="45%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#1e1b4b" />
                </linearGradient>
                <linearGradient id="smwTurfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="55%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#15803d" />
                </linearGradient>
                <linearGradient id="smwLagoonGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="55%" stopColor="#0284c7" />
                  <stop offset="100%" stopColor="#0369a1" />
                </linearGradient>
                <linearGradient id="smwLavaGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="50%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
                <linearGradient id="smwMoonGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="100%" stopColor="#eab308" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="1000" height="600" fill="url(#smwOceanGrad)" />
              <ellipse cx="500" cy="330" rx="480" ry="230" fill="#38bdf8" fillOpacity="0.14" />

              <g stroke="#bae6fd" strokeWidth="2.5" strokeOpacity="0.34" fill="none" strokeLinecap="round">
                <path d="M35 88 Q55 78 75 88 T115 88">
                  <animateTransform attributeName="transform" type="translate" values="0,0; 10,0; 0,0" dur="5.5s" repeatCount="indefinite" />
                </path>
                <path d="M270 55 Q292 45 314 55 T358 55">
                  <animateTransform attributeName="transform" type="translate" values="0,0; -8,0; 0,0" dur="6.2s" repeatCount="indefinite" />
                </path>
                <path d="M530 68 Q555 58 580 68 T630 68">
                  <animateTransform attributeName="transform" type="translate" values="0,0; 9,0; 0,0" dur="5.8s" repeatCount="indefinite" />
                </path>
                <path d="M52 515 Q75 505 98 515 T144 515">
                  <animateTransform attributeName="transform" type="translate" values="0,0; 12,0; 0,0" dur="6s" repeatCount="indefinite" />
                </path>
                <path d="M345 548 Q370 538 395 548 T445 548">
                  <animateTransform attributeName="transform" type="translate" values="0,0; -10,0; 0,0" dur="6.8s" repeatCount="indefinite" />
                </path>
                <path d="M760 530 Q785 520 810 530 T860 530">
                  <animateTransform attributeName="transform" type="translate" values="0,0; 10,0; 0,0" dur="5.2s" repeatCount="indefinite" />
                </path>
              </g>

              {/* Distant Second Island Preview on Horizon */}
              <g opacity="0.8">
                <ellipse cx="902" cy="96" rx="76" ry="22" fill="#c084fc" fillOpacity="0.28" />
                <ellipse cx="902" cy="90" rx="64" ry="18" fill="#fde68a" />
                <ellipse cx="902" cy="84" rx="54" ry="15" fill="#4c1d95" />
                <polygon points="878,80 896,50 914,80" fill="#6b21a8" />
                <polygon points="906,82 924,56 940,82" fill="#581c87" />
                <rect x="893" y="45" width="6" height="10" fill="#ef4444" />
              </g>

              <g fill="#f8fafc" fillOpacity="0.78">
                <g>
                  <ellipse cx="195" cy="78" rx="26" ry="11" />
                  <ellipse cx="218" cy="74" rx="18" ry="12" />
                  <ellipse cx="176" cy="80" rx="14" ry="9" />
                  <animateTransform attributeName="transform" type="translate" values="0,0; 22,0; 0,0" dur="14s" repeatCount="indefinite" />
                </g>
                <g>
                  <ellipse cx="645" cy="64" rx="28" ry="10" />
                  <ellipse cx="668" cy="60" rx="19" ry="12" />
                  <ellipse cx="624" cy="66" rx="15" ry="8" />
                  <animateTransform attributeName="transform" type="translate" values="0,0; -18,0; 0,0" dur="16s" repeatCount="indefinite" />
                </g>
              </g>

              <path
                d="M 62 390 C 40 278, 108 188, 222 164 C 312 145, 378 106, 488 142 C 584 174, 636 108, 756 126 C 892 146, 972 246, 950 366 C 928 482, 815 530, 682 508 C 568 488, 514 544, 412 518 C 316 492, 232 522, 144 486 C 88 462, 74 434, 62 390 Z"
                fill="#bae6fd"
                fillOpacity="0.28"
              />
              <path
                d="M 78 398 C 58 296, 118 206, 226 184 C 314 166, 378 128, 484 162 C 580 192, 632 132, 746 148 C 878 166, 954 256, 932 368 C 912 474, 804 518, 678 498 C 566 478, 514 532, 416 506 C 322 482, 240 510, 156 476 C 102 454, 88 434, 78 398 Z"
                fill="#92400e"
              />
              <path
                d="M 78 386 C 58 286, 118 198, 226 176 C 314 158, 378 120, 484 154 C 580 184, 632 124, 746 140 C 878 158, 954 246, 932 356 C 912 460, 804 504, 678 484 C 566 464, 514 518, 416 492 C 322 468, 240 496, 156 462 C 102 440, 88 422, 78 386 Z"
                fill="#fde68a"
                stroke="#b45309"
                strokeWidth="3.5"
              />
              <path
                d="M 100 378 C 82 296, 134 216, 232 196 C 316 178, 376 142, 478 176 C 574 206, 630 146, 734 160 C 854 176, 926 254, 908 352 C 890 446, 790 486, 678 466 C 568 446, 514 496, 422 472 C 330 448, 250 474, 168 446 C 122 428, 110 410, 100 378 Z"
                fill="#14532d"
              />
              <path
                d="M 100 368 C 82 288, 134 208, 232 188 C 316 170, 376 134, 478 168 C 574 198, 630 138, 734 152 C 854 168, 926 244, 908 342 C 890 434, 790 474, 678 454 C 568 434, 514 484, 422 460 C 330 436, 250 462, 168 434 C 122 416, 110 400, 100 368 Z"
                fill="url(#smwTurfGrad)"
                stroke="#166534"
                strokeWidth="3"
              />

              {/* Caverna Ridge */}
              <path
                d="M 248 272 C 250 180, 315 144, 398 158 C 446 168, 468 214, 456 264 C 425 288, 290 295, 248 272 Z"
                fill="#78716c"
                stroke="#44403c"
                strokeWidth="2.5"
              />
              <path
                d="M 254 260 C 258 184, 318 150, 395 162 C 440 170, 458 210, 448 252 C 415 274, 292 278, 254 260 Z"
                fill="#a8a29e"
                fillOpacity="0.35"
              />

              {/* Biome 1: Overworld */}
              <g>
                <path d="M 108 325 C 118 258, 174 258, 184 325 Z" fill="#16a34a" stroke="#14532d" strokeWidth="2.5" />
                <ellipse cx="140" cy="292" rx="2.5" ry="6" fill="#052e16" />
                <ellipse cx="152" cy="292" rx="2.5" ry="6" fill="#052e16" />
                <path d="M 176 312 C 184 268, 224 268, 232 312 Z" fill="#15803d" stroke="#14532d" strokeWidth="2" />
                <ellipse cx="200" cy="290" rx="2" ry="5" fill="#052e16" />
                <ellipse cx="209" cy="290" rx="2" ry="5" fill="#052e16" />
                <rect x="114" y="324" width="32" height="24" rx="3" fill="#fef3c7" stroke="#78350f" strokeWidth="2" />
                <path d="M 108 326 L 130 306 L 152 326 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
                <rect x="125" y="335" width="10" height="13" rx="1" fill="#92400e" />
                <circle cx="130" cy="317" r="3.5" fill="#fef08a" />
                <rect x="210" y="422" width="6" height="14" fill="#78350f" />
                <circle cx="213" cy="414" r="14" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
                <circle cx="207" cy="410" r="6" fill="#4ade80" fillOpacity="0.45" />
                <rect x="97" y="405" width="5" height="12" fill="#78350f" />
                <circle cx="99" cy="398" r="12" fill="#15803d" stroke="#14532d" strokeWidth="2" />
                <rect x="242" y="256" width="5" height="12" fill="#78350f" />
                <circle cx="244" cy="249" r="13" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
              </g>

              {/* Biome 2: Caverna */}
              <g>
                <path d="M 278 242 L 325 142 L 372 242 Z" fill="#57534e" stroke="#292524" strokeWidth="2.5" />
                <path d="M 332 242 L 378 156 L 424 242 Z" fill="#78716c" stroke="#292524" strokeWidth="2.5" />
                <path d="M 310 174 L 325 142 L 340 174 L 332 168 L 325 176 L 318 168 Z" fill="#f1f5f9" />
                <path d="M 366 178 L 378 156 L 390 178 L 383 173 L 378 179 L 373 173 Z" fill="#e2e8f0" />
                <path d="M 316 244 C 316 196, 368 196, 368 244 Z" fill="#1c1917" stroke="#292524" strokeWidth="2.5" />
                <ellipse cx="342" cy="236" rx="18" ry="8" fill="#f59e0b" fillOpacity="0.18" />
                <rect x="319" y="214" width="5" height="30" fill="#78350f" />
                <rect x="360" y="214" width="5" height="30" fill="#78350f" />
                <rect x="316" y="210" width="52" height="6" rx="1" fill="#92400e" stroke="#451a03" strokeWidth="1.5" />
                <circle cx="323" cy="222" r="3" fill="#fbbf24" />
              </g>

              {/* Biome 3: Lagoa */}
              <g>
                <ellipse cx="510" cy="408" rx="112" ry="60" fill="#fde68a" stroke="#d97706" strokeWidth="2" />
                <ellipse cx="510" cy="408" rx="98" ry="51" fill="url(#smwLagoonGrad)" stroke="#7dd3fc" strokeWidth="2.5" />
                <ellipse cx="514" cy="412" rx="68" ry="31" fill="#38bdf8" fillOpacity="0.28" />
                <path d="M 458 418 Q 485 408 512 418 T 566 418" stroke="#e0f2fe" strokeWidth="2" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
                <circle cx="445" cy="422" r="6" fill="#fb7185" />
                <circle cx="452" cy="426" r="4" fill="#f43f5e" />
                <circle cx="574" cy="396" r="5" fill="#fb923c" />
                <circle cx="580" cy="401" r="4" fill="#f97316" />
                <rect x="424" y="376" width="44" height="12" rx="2" fill="#92400e" stroke="#451a03" strokeWidth="1.5" />
                <line x1="435" y1="376" x2="435" y2="388" stroke="#451a03" strokeWidth="1.5" />
                <line x1="447" y1="376" x2="447" y2="388" stroke="#451a03" strokeWidth="1.5" />
                <line x1="459" y1="376" x2="459" y2="388" stroke="#451a03" strokeWidth="1.5" />
              </g>

              {/* Biome 4: Mansão Fantasma */}
              <g>
                <ellipse cx="682" cy="238" rx="88" ry="52" fill="#3b0764" fillOpacity="0.86" stroke="#7e22ce" strokeWidth="3" />
                <ellipse cx="682" cy="242" rx="68" ry="38" fill="#581c87" fillOpacity="0.55" />
                <circle cx="752" cy="146" r="14" fill="url(#smwMoonGlow)" opacity="0.9" />
                <circle cx="758" cy="143" r="12" fill="#0ea5e9" fillOpacity="0.55" />
                <path d="M 615 245 L 619 216 L 609 203 M 619 224 L 629 212" stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                <path d="M 744 242 L 740 214 L 750 202 M 740 222 L 730 211" stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                <rect x="650" y="182" width="64" height="44" fill="#312e81" stroke="#0f172a" strokeWidth="2.5" />
                <polygon points="644,184 682,152 720,184" fill="#1e1b4b" stroke="#0f172a" strokeWidth="2" />
                <rect x="674" y="142" width="16" height="22" fill="#312e81" stroke="#0f172a" strokeWidth="2" />
                <polygon points="670,144 682,126 694,144" fill="#1e1b4b" stroke="#0f172a" strokeWidth="2" />
                <rect x="658" y="192" width="10" height="12" rx="4" fill="#fde047" />
                <rect x="696" y="192" width="10" height="12" rx="4" fill="#fde047" />
                <path d="M 676 226 L 676 208 C 676 202, 688 202, 688 208 L 688 226 Z" fill="#0f172a" />
              </g>

              {/* Biome 5: Castelo de Johannnnes89 */}
              <g>
                <ellipse cx="848" cy="326" rx="84" ry="60" fill="#27272a" stroke="#7f1d1d" strokeWidth="4" />
                <ellipse cx="848" cy="330" rx="68" ry="44" fill="url(#smwLavaGrad)" fillOpacity="0.88" />
                <ellipse cx="848" cy="324" rx="54" ry="34" fill="#18181b" stroke="#450a0a" strokeWidth="2.5" />
                <rect x="814" y="266" width="68" height="46" fill="#52525b" stroke="#18181b" strokeWidth="2.5" />
                <rect x="802" y="250" width="20" height="62" fill="#3f3f46" stroke="#18181b" strokeWidth="2" />
                <rect x="874" y="250" width="20" height="62" fill="#3f3f46" stroke="#18181b" strokeWidth="2" />
                <rect x="800" y="242" width="7" height="9" fill="#52525b" stroke="#18181b" strokeWidth="1.5" />
                <rect x="816" y="242" width="7" height="9" fill="#52525b" stroke="#18181b" strokeWidth="1.5" />
                <rect x="873" y="242" width="7" height="9" fill="#52525b" stroke="#18181b" strokeWidth="1.5" />
                <rect x="889" y="242" width="7" height="9" fill="#52525b" stroke="#18181b" strokeWidth="1.5" />
                <rect x="836" y="236" width="24" height="32" fill="#3f3f46" stroke="#18181b" strokeWidth="2" />
                <polygon points="832,238 848,214 864,238" fill="#991b1b" stroke="#18181b" strokeWidth="2" />
                <line x1="848" y1="214" x2="848" y2="196" stroke="#e4e4e7" strokeWidth="2" />
                <polygon points="848,197 866,203 848,209" fill="#ef4444" />
                <path d="M 838 312 L 838 290 C 838 282, 858 282, 858 290 L 858 312 Z" fill="#18181b" stroke="#f97316" strokeWidth="2" />
                <line x1="844" y1="286" x2="844" y2="312" stroke="#52525b" strokeWidth="1.5" />
                <line x1="852" y1="286" x2="852" y2="312" stroke="#52525b" strokeWidth="1.5" />
              </g>

              {/* Switch Palace Landmark */}
              <g>
                <ellipse
                  cx="290"
                  cy="436"
                  rx="42"
                  ry="24"
                  fill={progress.yellowSwitchUnlocked ? '#fef08a' : '#ca8a04'}
                  fillOpacity={progress.yellowSwitchUnlocked ? 0.35 : 0.22}
                  stroke="#eab308"
                  strokeWidth="2"
                />
                <rect
                  x="266"
                  y="404"
                  width="48"
                  height="26"
                  rx="4"
                  fill={progress.yellowSwitchUnlocked ? '#eab308' : '#854d0e'}
                  stroke="#451a03"
                  strokeWidth="2.5"
                />
                <path
                  d="M 262 406 C 264 382, 316 382, 318 406 Z"
                  fill={progress.yellowSwitchUnlocked ? '#fde047' : '#ca8a04'}
                  stroke="#451a03"
                  strokeWidth="2.5"
                />
                <path
                  d="M 284 430 L 284 416 C 284 411, 296 411, 296 416 L 296 430 Z"
                  fill="#292524"
                />
                <rect
                  x="283"
                  y="390"
                  width="14"
                  height="12"
                  rx="2"
                  fill="#fef9c3"
                  stroke="#451a03"
                  strokeWidth="1.5"
                />
                <rect x="289" y="392" width="2.5" height="5" fill="#451a03" />
                <rect x="289" y="398.5" width="2.5" height="2" fill="#451a03" />
              </g>

              {/* Curved Winding SMW Stage Roads Connecting Nodes */}
              {SMW_PATH_SEGMENTS.map(seg => {
                const nextNode = SMW_WIKIWORLD_NODES.find(n => n.id === seg.toId);
                const pathUnlocked = nextNode ? isSmwNodeUnlocked(nextNode.id, progress) : false;
                const d = `M ${seg.p0[0] * 10} ${seg.p0[1] * 6} C ${seg.c1[0] * 10} ${seg.c1[1] * 6}, ${seg.c2[0] * 10} ${seg.c2[1] * 6}, ${seg.p1[0] * 10} ${seg.p1[1] * 6}`;
                return (
                  <g key={`${seg.fromId}-${seg.toId}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke="#1c1917"
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeOpacity={pathUnlocked ? 0.55 : 0.35}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={pathUnlocked ? '#b45309' : '#475569'}
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke={pathUnlocked ? '#fde047' : '#94a3b8'}
                      strokeWidth="4.5"
                      strokeDasharray="10 10"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Clickable Horizon Link to Ilha 2 (Beta) */}
            <button
              type="button"
              onClick={() => switchIsland('island2')}
              className="hidden sm:flex items-center gap-1.5 absolute top-3 right-3 px-2.5 py-1 rounded-md bg-purple-950/85 hover:bg-purple-900 border border-purple-400/70 text-[10px] font-mono text-purple-100 shadow cursor-pointer transition z-10"
            >
              <span>Ver Ilha 2 (Beta)</span>
              <span aria-hidden="true">→</span>
            </button>

            {/* Island Name Plaque & Yellow [!] Switch Status */}
            <div className="absolute top-2.5 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
              <div className="px-2.5 py-1 rounded-md bg-stone-950/85 border border-emerald-400/60 shadow">
                <span className="font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] text-emerald-300">
                  {SMW_WORLD_ISLAND_NAME.toUpperCase()}
                </span>
              </div>
              <div
                className={`px-2 py-1 rounded-md border text-[9px] sm:text-[10px] font-mono font-bold shadow ${
                  progress.yellowSwitchUnlocked
                    ? 'bg-amber-950/90 border-yellow-400 text-yellow-200'
                    : 'bg-stone-950/85 border-stone-600 text-stone-400'
                }`}
              >
                {progress.yellowSwitchUnlocked
                  ? 'Blocos [!] Amarelos: ATIVOS'
                  : 'Blocos [!] Amarelos: Bloqueados'}
              </div>
            </div>

            {/* Ambient Patrolling Island Creatures */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
              <div style={{ left: `${goombaX}%`, top: '76.5%' }} className="absolute -translate-x-1/2 -translate-y-1/2">
                <div className="w-5 h-1.5 rounded-full bg-black/35 mx-auto translate-y-4" />
                <PixelSpriteView sprite={goombaSprite} displayWidth={20} displayHeight={20} facing={goombaFacing} />
              </div>
              <div style={{ left: `${koopaX}%`, top: '52.5%' }} className="absolute -translate-x-1/2 -translate-y-1/2">
                <div className="w-5 h-1.5 rounded-full bg-black/35 mx-auto translate-y-6" />
                <PixelSpriteView sprite={koopaSprite} displayWidth={20} displayHeight={28} facing={koopaFacing} />
              </div>
              <div style={{ left: `${cheepX}%`, top: `${cheepY}%` }} className="absolute -translate-x-1/2 -translate-y-1/2">
                <PixelSpriteView sprite={cheepSprite} displayWidth={20} displayHeight={20} facing={cheepFacing} />
              </div>
              <div style={{ left: `${dryBonesX}%`, top: '50.5%' }} className="absolute -translate-x-1/2 -translate-y-1/2">
                <div className="w-5 h-1.5 rounded-full bg-black/40 mx-auto translate-y-6" />
                <PixelSpriteView sprite={dryBonesSprite} displayWidth={20} displayHeight={28} facing={dryBonesFacing} />
              </div>
              <div style={{ left: `${booX}%`, top: `${booY}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 opacity-90">
                <PixelSpriteView sprite={booSprite} displayWidth={22} displayHeight={22} facing={booFacing} />
              </div>
              <div
                style={{ left: `${bowserX}%`, top: '67.5%' }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              >
                <span className="mb-0.5 px-1.5 py-0.5 rounded bg-red-950/90 border border-amber-400/70 text-[8px] font-bold text-amber-200 whitespace-nowrap shadow">
                  {JOHANNNNES_CASTLE_1_BOSS_NAME}
                </span>
                <PixelSpriteView sprite={bowserSprite} displayWidth={30} displayHeight={30} facing={bowserFacing} />
                <div className="w-7 h-2 rounded-full bg-black/45 mx-auto -mt-1" />
              </div>
            </div>
          </>
        ) : (
          /* Handcrafted Cartography SVG — Ilha 2: Terras de Chronus (RW0.15.0.PW.4) */
          <>
            <svg
              viewBox="0 0 1000 600"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none select-none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="island2OceanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#312e81" />
                  <stop offset="55%" stopColor="#1e1b4b" />
                  <stop offset="100%" stopColor="#090d16" />
                </linearGradient>
                <linearGradient id="island2TurfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="55%" stopColor="#5b21b6" />
                  <stop offset="100%" stopColor="#3b0764" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="1000" height="600" fill="url(#island2OceanGrad)" />
              <ellipse cx="500" cy="315" rx="460" ry="220" fill="#a855f7" fillOpacity="0.14" />

              {/* Distant Ilha 1 silhouette on western horizon */}
              <g opacity="0.65">
                <ellipse cx="105" cy="96" rx="68" ry="18" fill="#4ade80" fillOpacity="0.45" />
                <ellipse cx="105" cy="90" rx="52" ry="14" fill="#15803d" />
              </g>

              {/* Island 2 Halo & Shelf */}
              <path
                d="M 135 370 C 120 250, 210 165, 360 160 C 480 154, 560 112, 690 148 C 820 184, 885 275, 855 375 C 825 468, 700 505, 550 486 C 410 468, 285 492, 195 452 C 155 432, 142 405, 135 370 Z"
                fill="#c084fc"
                fillOpacity="0.22"
              />
              <path
                d="M 152 372 C 138 262, 222 184, 362 178 C 476 174, 552 134, 678 166 C 798 198, 860 282, 834 372 C 806 456, 688 492, 548 474 C 414 456, 294 478, 210 442 C 170 424, 158 400, 152 372 Z"
                fill="#4c1d95"
                stroke="#2e1065"
                strokeWidth="3.5"
              />
              <path
                d="M 168 362 C 156 262, 232 192, 364 186 C 474 182, 546 144, 668 174 C 782 204, 840 280, 816 362 C 790 438, 678 472, 546 456 C 418 440, 304 460, 224 426 C 186 410, 174 388, 168 362 Z"
                fill="url(#island2TurfGrad)"
                stroke="#a855f7"
                strokeWidth="2.5"
              />

              {/* Chronus Obsidian Peaks & Ruins */}
              <path d="M 480 250 L 520 170 L 560 250 Z" fill="#312e81" stroke="#1e1b4b" strokeWidth="2.5" />
              <path d="M 710 315 L 748 228 L 786 315 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="2.5" />
              <rect x="726" y="275" width="44" height="38" fill="#334155" stroke="#0f172a" strokeWidth="2" />
              <polygon points="722,276 748,252 774,276" fill="#7f1d1d" stroke="#0f172a" strokeWidth="2" />

              {/* Preview Dashed Roads */}
              {SMW_ISLAND2_PATH_SEGMENTS.map(seg => {
                const d = `M ${seg.p0[0] * 10} ${seg.p0[1] * 6} C ${seg.c1[0] * 10} ${seg.c1[1] * 6}, ${seg.c2[0] * 10} ${seg.c2[1] * 6}, ${seg.p1[0] * 10} ${seg.p1[1] * 6}`;
                return (
                  <path
                    key={`${seg.fromId}-${seg.toId}`}
                    d={d}
                    fill="none"
                    stroke="#c4b5fd"
                    strokeOpacity="0.45"
                    strokeWidth="6"
                    strokeDasharray="10 10"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {/* Clickable Link back to Ilha 1 */}
            <button
              type="button"
              onClick={() => switchIsland('wikiworld')}
              className="hidden sm:flex items-center gap-1.5 absolute top-3 right-3 px-2.5 py-1 rounded-md bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-400/70 text-[10px] font-mono text-emerald-100 shadow cursor-pointer transition z-10"
            >
              <span aria-hidden="true">←</span>
              <span>Voltar para Ilha 1</span>
            </button>

            {/* Island 2 Header Plaque & Beta Unavailability Banner */}
            <div className="absolute top-2.5 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
              <div className="px-2.5 py-1 rounded-md bg-stone-950/90 border border-purple-400/70 shadow">
                <span className="font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] text-purple-300">
                  ILHA 2 · TERRAS DE CHRONUS
                </span>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-amber-950/90 border border-amber-400/80 text-[10px] font-mono font-bold text-amber-200 shadow">
                {SMW_ISLAND2_UNAVAILABLE_MSG}
              </div>
            </div>
          </>
        )}

        {/* Interactive Stage Nodes */}
        {activeNodes.map(node => {
          const isIsland2 = activeIsland === 'island2';
          const unlocked = isIsland2 ? false : isSmwNodeUnlocked(node.id, progress);
          const cleared = isIsland2 ? false : progress.clearedNodeIds.includes(node.id);
          const secretCleared =
            !isIsland2 && Boolean(progress.secretClearedNodeIds?.includes(node.id));
          const lockedCompleted = isIsland2
            ? false
            : isSmwNodeCompletedAndLocked(node.id, progress);
          const isSelected = isIsland2
            ? node.order === 0
            : progress.selectedNodeId === node.id;

          return (
            <div
              key={node.id}
              style={{ left: `${node.mapX}%`, top: `${node.mapY}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
            >
              <button
                type="button"
                data-smw-node-btn="true"
                onClick={() => {
                  setSwitchLockedNotice('');
                  if (isIsland2) {
                    setIsland2Notice(SMW_ISLAND2_UNAVAILABLE_MSG);
                    return;
                  }
                  if (!unlocked) return;
                  if (isSelected) {
                    if (lockedCompleted) {
                      setSwitchLockedNotice('Palácio do Interruptor Amarelo já concluído!');
                      return;
                    }
                    blurActiveElement();
                    onEnterStage(node.id);
                  } else {
                    onSelectNode(node.id);
                  }
                }}
                onDoubleClick={() => {
                  if (isIsland2 || !unlocked) return;
                  if (lockedCompleted) {
                    setSwitchLockedNotice('Palácio do Interruptor Amarelo já concluído!');
                    return;
                  }
                  blurActiveElement();
                  onEnterStage(node.id);
                }}
                disabled={!isIsland2 && !unlocked}
                aria-label={`${node.title} (${
                  isIsland2
                    ? SMW_ISLAND2_UNAVAILABLE_MSG
                    : lockedCompleted
                    ? 'Concluído · Entrada bloqueada'
                    : cleared
                    ? 'Concluída'
                    : unlocked
                    ? 'Disponível'
                    : 'Bloqueada'
                })`}
                className={`relative min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl border-2 flex items-center justify-center gap-1 transition-transform shadow-lg ${
                  isIsland2
                    ? node.order === 0
                      ? 'bg-purple-900/95 border-amber-400 text-amber-200 cursor-not-allowed ring-4 ring-amber-400/35'
                      : 'bg-stone-900/85 border-stone-600 text-stone-500 cursor-not-allowed opacity-70'
                    : !unlocked
                    ? 'bg-stone-900/90 border-stone-600 text-stone-500 cursor-not-allowed opacity-80'
                    : isSelected
                    ? node.isCastle
                      ? 'bg-red-700 border-amber-300 text-white scale-110 ring-4 ring-amber-300/65 cursor-pointer'
                      : node.isSwitchPalace
                      ? 'bg-yellow-400 border-white text-stone-950 scale-110 ring-4 ring-yellow-300/75 cursor-pointer'
                      : 'bg-amber-500 border-white text-stone-950 scale-110 ring-4 ring-amber-300/65 cursor-pointer'
                    : cleared
                    ? node.isSwitchPalace
                      ? 'bg-yellow-500 hover:bg-yellow-400 border-yellow-100 text-stone-950 hover:scale-105 cursor-pointer'
                      : 'bg-emerald-700 hover:bg-emerald-600 border-emerald-200 text-white hover:scale-105 cursor-pointer'
                    : node.isCastle
                    ? 'bg-red-900 hover:bg-red-800 border-red-400 text-amber-200 hover:scale-105 cursor-pointer'
                    : node.isSwitchPalace
                    ? 'bg-yellow-700 hover:bg-yellow-600 border-yellow-300 text-yellow-100 hover:scale-105 cursor-pointer'
                    : 'bg-sky-700 hover:bg-sky-600 border-sky-200 text-white hover:scale-105 cursor-pointer'
                }`}
              >
                {unlocked ? getNodeIcon(node) : <Lock className="w-4 h-4" />}
                {cleared && (
                  <span className="w-4 h-4 rounded-full bg-amber-300 text-stone-950 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
                {secretCleared && (
                  <span
                    title="Saída secreta (Chave) concluída"
                    className="w-4 h-4 rounded-full bg-yellow-300 text-stone-950 flex items-center justify-center shrink-0"
                  >
                    <KeyRound className="w-2.5 h-2.5 stroke-[2.75]" />
                  </span>
                )}
              </button>

              {/* Node Title Tag below button */}
              <span
                className={`mt-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold whitespace-nowrap shadow ${
                  isSelected
                    ? 'bg-stone-950 text-amber-300 border border-amber-400/80'
                    : 'bg-stone-950/90 text-stone-100 border border-stone-700/80'
                }`}
              >
                {node.title}
              </span>

              {/* Explicit Beta Placeholder Message directly on First Stage (2-1) of Island 2 */}
              {isIsland2 && node.order === 0 && (
                <span className="mt-1 px-2 py-0.5 rounded bg-amber-950/95 border border-amber-400 text-[9px] sm:text-[10px] font-mono text-amber-200 whitespace-nowrap shadow-lg">
                  {SMW_ISLAND2_UNAVAILABLE_MSG}
                </span>
              )}
            </div>
          );
        })}

        {/* Animated Hero Duo (Lead Character + Companion Walking Along the Path) */}
        <div className="absolute inset-0 pointer-events-none select-none z-20" aria-hidden="true">
          <div
            style={{
              left: `${walkState.companionX}%`,
              top: `${walkState.companionY}%`,
              transform: `translate(-50%, calc(-100% - 18px - ${walkState.bobOffsetPx * 0.85}px))`,
            }}
            className="absolute flex flex-col items-center opacity-95"
          >
            <PixelSpriteView
              sprite={companionSprite}
              displayWidth={22}
              displayHeight={44}
              facing={walkState.companionFacing}
              className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)]"
            />
            <div className="w-4 h-1 rounded-full bg-black/45 -mt-0.5" />
          </div>

          <div
            style={{
              left: `${walkState.leadX}%`,
              top: `${walkState.leadY}%`,
              transform: `translate(-50%, calc(-100% - 18px - ${walkState.bobOffsetPx}px))`,
            }}
            className="absolute flex flex-col items-center"
          >
            <span className="text-[9px] font-bold leading-none text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] mb-0.5">
              ▼
            </span>
            <PixelSpriteView
              sprite={leadSprite}
              displayWidth={24}
              displayHeight={48}
              facing={walkState.leadFacing}
              className="drop-shadow-[0_3px_3px_rgba(0,0,0,0.85)]"
            />
            <div className="w-5 h-1.5 rounded-full bg-black/55 -mt-0.5" />
          </div>
        </div>

        {/* Island 2 Unavailable Notice Banner (RW0.15.0.PW.4) */}
        {activeIsland === 'island2' && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-lg px-3.5 py-2 rounded-lg bg-stone-950/92 border border-amber-400/80 text-center shadow-xl">
            <p className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Fase 2-1 · {SMW_ISLAND2_UNAVAILABLE_MSG}</span>
            </p>
            {island2Notice && (
              <p className="text-[10px] text-purple-200 mt-0.5">
                Explore a Ilha 1 (WikiWorldWeb) enquanto preparamos as novas fases de Chronus.
              </p>
            )}
          </div>
        )}

        {/* Switch Palace Completed Lock Toast (R1.16.O0.4) */}
        {switchLockedNotice && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-md px-3.5 py-2 rounded-lg bg-amber-950/95 border border-yellow-400 text-center shadow-xl">
            <p className="text-[11px] sm:text-xs font-bold text-yellow-200 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span>{switchLockedNotice}</span>
            </p>
          </div>
        )}

        {/* Island 1 Victory Celebration Toast */}
        {activeIsland === 'wikiworld' && !switchLockedNotice && (islandCompleted || justClearedNodeId === 'wiki-5-castelo') && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-lg px-3.5 py-2 rounded-lg bg-stone-950/92 border border-amber-400/80 text-center shadow-xl">
            <p className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Castelo de Johannnnes89 conquistado! Ilha WikiWorldWeb 100% salva!</span>
            </p>
            <p className="text-[10px] text-stone-300 mt-0.5">
              Salve nos Slots após o castelo ou explore a prévia da Ilha 2 (Beta).
            </p>
          </div>
        )}
      </div>

      {/* Bottom Selected Stage Bar */}
      <div className="px-3 sm:px-4 py-2.5 bg-stone-950 border-t border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-stone-400 font-mono">
            <span className="text-amber-300 font-bold">{selectedNode.code}</span>
            <span aria-hidden="true">·</span>
            <span>
              {activeIsland === 'island2'
                ? 'Em breve'
                : selectedLockedCompleted
                ? 'Concluído (entrada encerrada)'
                : selectedCleared
                ? 'Concluída (rejogável)'
                : selectedUnlocked
                ? 'Disponível'
                : 'Bloqueada'}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-white truncate">
            {selectedNode.title}
          </p>
          <p className="text-[10px] sm:text-[11px] text-amber-200/90 truncate">
            {activeIsland === 'island2'
              ? SMW_ISLAND2_UNAVAILABLE_MSG
              : selectedLockedCompleted
              ? 'Interruptor Amarelo já ativado! Não é possível jogar novamente este palácio.'
              : selectedNode.id === 'wiki-1-overworld' &&
                !progress.yellowSwitchUnlocked &&
                !progress.secretClearedNodeIds?.includes('wiki-1-overworld')
              ? `${selectedNode.subtitle} · Dica: procure o cano secreto com Chave e Fechadura para abrir o Palácio Amarelo!`
              : selectedNode.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeIsland === 'wikiworld' && clearedCount > 0 && (
            <button
              type="button"
              onClick={onResetProgress}
              title="Reiniciar progresso da Ilha WikiWorldWeb"
              className="min-h-[40px] px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Zerar Ilha</span>
            </button>
          )}

          {activeIsland === 'island2' ? (
            <button
              type="button"
              onClick={() => switchIsland('wikiworld')}
              className="flex-1 sm:flex-initial min-h-[40px] px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-purple-400/60 text-amber-200 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{SMW_ISLAND2_UNAVAILABLE_MSG}</span>
            </button>
          ) : selectedLockedCompleted ? (
            <button
              type="button"
              disabled
              className="flex-1 sm:flex-initial min-h-[40px] px-4 sm:px-5 py-2 rounded-lg bg-stone-800 border border-yellow-500/40 text-yellow-300/80 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>PALÁCIO CONCLUÍDO</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!selectedUnlocked}
              onClick={() => {
                blurActiveElement();
                onEnterStage(selectedNode.id);
              }}
              className="flex-1 sm:flex-initial min-h-[40px] px-4 sm:px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>ENTRAR NA FASE</span>
            </button>
          )}
        </div>
      </div>

      {/* Story Intro Modal Overlay (Beta V0.9) */}
      {showStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="smw-story-title"
          className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl bg-stone-900 border-2 border-amber-400 shadow-2xl p-4 sm:p-6 text-left">
            <div className="text-[11px] font-mono text-amber-300 mb-1">
              Super Mario World · {SMW_BETA_VERSION} · {SMW_WORLD_ISLAND_NAME}
            </div>
            <h3
              id="smw-story-title"
              className="font-['Press_Start_2P',monospace] text-xs sm:text-sm text-white mb-3 leading-relaxed"
            >
              HISTÓRIA DA AVENTURA
            </h3>

            <p className="text-xs sm:text-sm text-stone-100 leading-relaxed bg-stone-950/90 border border-stone-700 rounded-lg p-3.5 sm:p-4">
              {SMW_INTRO_STORY}
            </p>

            <div className="mt-3 text-[11px] text-stone-400 leading-snug">
              Fases da {SMW_WORLD_ISLAND_NAME}: Overworld, Palácio Interruptor Amarelo, Caverna, Água, Mansão Fantasma e Castelo de Johannnnes89.
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowStory(false);
                  onDismissStory();
                }}
                className="min-h-[42px] px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow cursor-pointer whitespace-nowrap shrink-0 transition"
              >
                EXPLORAR ILHA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Castle Save & Load Progress Slots Modal (R1.16.X6.4 — No Auto-Save) */}
      {showSlotsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="smw-slots-title"
          className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-black/88 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl bg-stone-900 border-2 border-amber-400 shadow-2xl p-4 sm:p-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-stone-800">
              <div>
                <div className="text-[10px] font-mono text-amber-300">
                  {castleSavePromptNodeTitle && slotsModalMode === 'save'
                    ? `Castelo Concluído: ${castleSavePromptNodeTitle}`
                    : 'Modo World · Slots de Progresso Manual'}
                </div>
                <h3
                  id="smw-slots-title"
                  className="font-['Press_Start_2P',monospace] text-xs sm:text-sm text-white mt-1"
                >
                  {castleSavePromptNodeTitle && slotsModalMode === 'save'
                    ? 'SALVAR PROGRESSO?'
                    : 'CARREGAR PROGRESSO'}
                </h3>
              </div>
              {castleSavePromptNodeTitle && slotsModalMode === 'save' ? (
                <Save className="w-5 h-5 text-amber-400 shrink-0" />
              ) : (
                <FolderOpen className="w-5 h-5 text-amber-400 shrink-0" />
              )}
            </div>

            <p className="mt-2.5 text-[11px] text-stone-300 bg-stone-950/80 border border-stone-800 rounded-lg px-3 py-2">
              {castleSavePromptNodeTitle && slotsModalMode === 'save'
                ? 'Você passou pelo castelo! Escolha um Slot abaixo para salvar seu progresso atual (o salvamento automático está desativado).'
                : usedSlotsCount > 0
                ? 'Escolha um dos slots salvos para carregar seu progresso no Modo World (fases concluídas, vidas, pontuação e blocos [!]).'
                : 'Nenhum progresso salvo ainda. Conclua um castelo no Modo World para salvar em um dos slots manuais.'}
            </p>

            <div className="mt-3 space-y-2.5">
              {[0, 1, 2].map(slotIdx => {
                const slot = saveSlots[slotIdx] ?? null;
                const isSaveMode = Boolean(castleSavePromptNodeTitle && slotsModalMode === 'save');
                return (
                  <div
                    key={slotIdx}
                    className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      slot
                        ? 'bg-stone-950/90 border-amber-500/50'
                        : 'bg-stone-950/50 border-stone-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-['Press_Start_2P',monospace] text-[10px] text-amber-300">
                          SLOT {slotIdx + 1}
                        </span>
                        {slot ? (
                          <span className="text-[10px] font-mono text-emerald-300">
                            {slot.clearedNodeIds.length}/{SMW_WIKIWORLD_NODES.length} fases
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-stone-500">Vazio</span>
                        )}
                      </div>
                      {slot ? (
                        <div className="mt-1 text-[11px] text-stone-300 space-y-0.5">
                          <div className="truncate font-medium text-white">{slot.stageName}</div>
                          <div className="text-[10px] font-mono text-stone-400">
                            Vidas: {slot.lives} · Pontos: {slot.score.toLocaleString()} ·{' '}
                            {slot.yellowSwitchUnlocked ? 'Switch [!] ON' : 'Switch OFF'}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] text-stone-500">
                          Nenhum progresso gravado neste slot.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSaveMode && onSaveToSlot && (
                        <button
                          type="button"
                          onClick={() => {
                            onSaveToSlot(slotIdx);
                            onDismissCastleSave?.();
                            setShowSlotsModal(false);
                            blurActiveElement();
                          }}
                          className="min-h-[34px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{slot ? 'Sobrescrever' : 'Salvar Aqui'}</span>
                        </button>
                      )}
                      {slot && onLoadFromSlot && (
                        <button
                          type="button"
                          onClick={() => {
                            onLoadFromSlot(slotIdx);
                            onDismissCastleSave?.();
                            setShowStory(false);
                            setShowSlotsModal(false);
                            blurActiveElement();
                          }}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                            isSaveMode
                              ? 'bg-stone-800 hover:bg-amber-600 border border-amber-500/60 text-amber-200 hover:text-stone-950'
                              : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                          }`}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Carregar</span>
                        </button>
                      )}
                      {slot && onDeleteSlot && (
                        <button
                          type="button"
                          onClick={() => onDeleteSlot(slotIdx)}
                          title={`Apagar Slot ${slotIdx + 1}`}
                          className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-red-900/80 border border-stone-700 text-stone-300 hover:text-red-200 text-xs cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {castleSavePromptNodeTitle && slotsModalMode === 'save' && usedSlotsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSlotsModalMode('load')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-amber-500/50 text-amber-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Ir para Carregar Progresso</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSlotsModal(false);
                  onDismissCastleSave?.();
                  blurActiveElement();
                }}
                className="ml-auto min-h-[38px] px-4 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-white text-xs font-medium cursor-pointer transition"
              >
                {castleSavePromptNodeTitle && slotsModalMode === 'save'
                  ? 'Continuar sem Salvar'
                  : 'Fechar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
