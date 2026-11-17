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
  Unlock,
  ArrowLeft,
  Castle,
  Ghost,
  Waves,
  Mountain,
  Trees,
  Crown,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  SMW_BETA_VERSION,
  SMW_WORLD_ISLAND_NAME,
  SMW_INTRO_STORY,
  SMW_WIKIWORLD_NODES,
  SMW_PATH_SEGMENTS,
  SmwBetaProgress,
  SmwMapNode,
  SmwWalkStep,
  evaluateSmwPathSegment,
  findSmwMapPath,
  isSmwNodeUnlocked,
} from '../game/smwWorldMap.ts';
import { SpriteAtlas } from '../game/sprites.ts';
import { PlayerCharacter } from '../game/types.ts';
import { findBestSpatialCandidateIndex, resolveTvRemoteAction } from '../game/smartTv.ts';

interface SmwOverworldMapProps {
  isOpen: boolean;
  progress: SmwBetaProgress;
  playerCharacter: PlayerCharacter;
  justClearedNodeId?: string | null;
  onSelectNode: (nodeId: string) => void;
  onEnterStage: (nodeId: string) => void;
  onDismissStory: () => void;
  onToggleBetaUnlockAll: () => void;
  onResetProgress: () => void;
  onBackToMainMenu: () => void;
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

function getNodePosById(nodeId: string): { x: number; y: number } {
  const node = SMW_WIKIWORLD_NODES.find(n => n.id === nodeId) || SMW_WIKIWORLD_NODES[0];
  return { x: node.mapX, y: node.mapY };
}

function sampleWalkSteps(
  steps: SmwWalkStep[],
  fallbackNodeId: string,
  progressVal: number
): { x: number; y: number; dx: number; dy: number } {
  if (steps.length === 0) {
    const pos = getNodePosById(fallbackNodeId);
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
  onSelectNode,
  onEnterStage,
  onDismissStory,
  onToggleBetaUnlockAll,
  onResetProgress,
  onBackToMainMenu,
}) => {
  const [showStory, setShowStory] = useState<boolean>(!progress.storySeen);
  const atlas = useMemo(() => SpriteAtlas.get(), []);

  useEffect(() => {
    if (isOpen && !progress.storySeen) {
      setShowStory(true);
    }
  }, [isOpen, progress.storySeen]);

  const selectedNode: SmwMapNode = useMemo(() => {
    return (
      SMW_WIKIWORLD_NODES.find(n => n.id === progress.selectedNodeId) ||
      SMW_WIKIWORLD_NODES[0]
    );
  }, [progress.selectedNodeId]);

  const selectedUnlocked = isSmwNodeUnlocked(selectedNode.id, progress);
  const selectedCleared = progress.clearedNodeIds.includes(selectedNode.id);
  const islandCompleted = progress.clearedNodeIds.includes('wiki-5-castelo');
  const clearedCount = progress.clearedNodeIds.length;

  const companionCharacter: PlayerCharacter =
    playerCharacter === 'wazzima' ? 'mario' : 'wazzima';

  // Continuous branching graph walking state across SMW_PATH_SEGMENTS
  const walkStepsRef = useRef<SmwWalkStep[]>([]);
  const walkProgressRef = useRef<number>(0);
  const currentNodeIdRef = useRef<string>(selectedNode.id);
  const wasOpenRef = useRef<boolean>(false);
  const lastFacingRef = useRef<'left' | 'right'>('right');

  const [walkState, setWalkState] = useState<MapWalkState>(() => {
    const pos = getNodePosById(selectedNode.id);
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

  // Sync target node when opening or changing selection
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;

    if (justOpened) {
      const clearedNode = justClearedNodeId
        ? SMW_WIKIWORLD_NODES.find(n => n.id === justClearedNodeId)
        : undefined;
      const startId = clearedNode ? clearedNode.id : selectedNode.id;
      walkStepsRef.current = findSmwMapPath(startId, selectedNode.id);
      walkProgressRef.current = 0;
      currentNodeIdRef.current = selectedNode.id;
      return;
    }

    if (currentNodeIdRef.current !== selectedNode.id) {
      const originId = currentNodeIdRef.current;
      walkStepsRef.current = findSmwMapPath(originId, selectedNode.id);
      walkProgressRef.current = 0;
      currentNodeIdRef.current = selectedNode.id;
    }
  }, [isOpen, selectedNode.id, justClearedNodeId]);

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
        const speedSegmentsPerSec = 2.05;
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

      // Limit React state updates to ~30fps when idle (for ambient march) or ~60fps when walking
      const minIntervalMs = isWalking ? 16 : 90;
      if (now - lastRenderSync >= minIntervalMs) {
        lastRenderSync = now;
        const leadSample = sampleWalkSteps(steps, currentNodeIdRef.current, current);

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
          const trailSample = sampleWalkSteps(steps, currentNodeIdRef.current, trailProgress);
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

    // Immediate sync on open / target change
    tick(performance.now());
    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isOpen, selectedNode.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tv = resolveTvRemoteAction(
        { code: e.code, key: e.key, keyCode: e.keyCode },
        { smartTvMode: true, jumpWithUp: false }
      );

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
        onBackToMainMenu();
        return;
      }

      // Let focused top-bar buttons (História, Liberar Fases, Menu, Zerar Ilha) work on OK/Enter
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
        const unlockedNodes = SMW_WIKIWORLD_NODES.filter(n => isSmwNodeUnlocked(n.id, progress));
        const currIdx = unlockedNodes.findIndex(n => n.id === selectedNode.id);
        if (currIdx >= 0 && unlockedNodes.length > 1) {
          const boxes = unlockedNodes.map((n, idx) => ({
            id: idx,
            cx: n.mapX,
            cy: n.mapY,
            width: 10,
            height: 10,
          }));
          const bestIdx = findBestSpatialCandidateIndex(boxes[currIdx], boxes, dir);
          if (bestIdx >= 0 && unlockedNodes[bestIdx]) {
            onSelectNode(unlockedNodes[bestIdx].id);
          }
        }
      } else if (tv.isConfirm || tv.actions.includes('jump')) {
        e.preventDefault();
        if (selectedUnlocked) {
          onEnterStage(selectedNode.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    showStory,
    selectedNode,
    selectedUnlocked,
    progress,
    onSelectNode,
    onEnterStage,
    onDismissStory,
    onBackToMainMenu,
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

  // Active Hero Duo animated sprites (always marching gently in SMW overworld style)
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

  // Ambient biome patrolling creatures
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
            <span className="text-emerald-300 font-semibold truncate">{SMW_WORLD_ISLAND_NAME}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-stone-300">
              {clearedCount}/{SMW_WIKIWORLD_NODES.length} fases
            </span>
          </div>
          <h2 className="font-['Press_Start_2P',monospace] text-[10px] sm:text-xs text-white truncate mt-0.5">
            MAPA DO OVERWORLD
          </h2>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowStory(true)}
            className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-amber-200 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>História</span>
          </button>

          <button
            type="button"
            onClick={onToggleBetaUnlockAll}
            title="Liberar ou bloquear progressão sequencial das fases (Beta V0.9)"
            className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg border text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition ${
              progress.betaUnlockAll
                ? 'bg-emerald-900/80 border-emerald-400 text-emerald-100'
                : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-300'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>{progress.betaUnlockAll ? 'Todas Liberadas' : 'Liberar Fases'}</span>
          </button>

          <button
            type="button"
            onClick={onBackToMainMenu}
            className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </div>

      {/* Interactive Super Mario World Island Overworld Viewport */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-gradient-to-b from-sky-500 via-blue-700 to-indigo-950">
        {/* Handcrafted 16-bit SMW Cartography SVG */}
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

          {/* Ocean Sky Horizon Backdrop */}
          <rect x="0" y="0" width="1000" height="600" fill="url(#smwOceanGrad)" />
          <ellipse cx="500" cy="330" rx="480" ry="230" fill="#38bdf8" fillOpacity="0.14" />

          {/* Animated Ocean Wave Crests */}
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

          {/* Distant Horizon Archipelago (Post-Beta V0.9 Islands) */}
          <g opacity="0.65">
            <ellipse cx="902" cy="96" rx="76" ry="22" fill="#7dd3fc" fillOpacity="0.28" />
            <ellipse cx="902" cy="90" rx="64" ry="18" fill="#fde68a" />
            <ellipse cx="902" cy="84" rx="54" ry="15" fill="#1e293b" />
            <polygon points="878,80 896,50 914,80" fill="#334155" />
            <polygon points="906,82 924,56 940,82" fill="#475569" />
            <rect x="893" y="45" width="6" height="10" fill="#991b1b" />
            <ellipse cx="786" cy="78" rx="34" ry="11" fill="#fde68a" fillOpacity="0.7" />
            <ellipse cx="786" cy="74" rx="26" ry="9" fill="#0f766e" fillOpacity="0.85" />
          </g>

          {/* Subtle Drifting Pixel Clouds in Sky Corners */}
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

          {/* Main Island: Outer Sea-Foam Halo */}
          <path
            d="M 62 390 C 40 278, 108 188, 222 164 C 312 145, 378 106, 488 142 C 584 174, 636 108, 756 126 C 892 146, 972 246, 950 366 C 928 482, 815 530, 682 508 C 568 488, 514 544, 412 518 C 316 492, 232 522, 144 486 C 88 462, 74 434, 62 390 Z"
            fill="#bae6fd"
            fillOpacity="0.28"
          />

          {/* Main Island: Lower Cliff Extrusion Shadow (3D SMW Shelf) */}
          <path
            d="M 78 398 C 58 296, 118 206, 226 184 C 314 166, 378 128, 484 162 C 580 192, 632 132, 746 148 C 878 166, 954 256, 932 368 C 912 474, 804 518, 678 498 C 566 478, 514 532, 416 506 C 322 482, 240 510, 156 476 C 102 454, 88 434, 78 398 Z"
            fill="#92400e"
          />

          {/* Main Island: Golden Sand Shoreline */}
          <path
            d="M 78 386 C 58 286, 118 198, 226 176 C 314 158, 378 120, 484 154 C 580 184, 632 124, 746 140 C 878 158, 954 246, 932 356 C 912 460, 804 504, 678 484 C 566 464, 514 518, 416 492 C 322 468, 240 496, 156 462 C 102 440, 88 422, 78 386 Z"
            fill="#fde68a"
            stroke="#b45309"
            strokeWidth="3.5"
          />

          {/* Main Island: Grass Plateau Base Shadow */}
          <path
            d="M 100 378 C 82 296, 134 216, 232 196 C 316 178, 376 142, 478 176 C 574 206, 630 146, 734 160 C 854 176, 926 254, 908 352 C 890 446, 790 486, 678 466 C 568 446, 514 496, 422 472 C 330 448, 250 474, 168 446 C 122 428, 110 410, 100 378 Z"
            fill="#14532d"
          />

          {/* Main Island: Lush Emerald Turf */}
          <path
            d="M 100 368 C 82 288, 134 208, 232 188 C 316 170, 376 134, 478 168 C 574 198, 630 138, 734 152 C 854 168, 926 244, 908 342 C 890 434, 790 474, 678 454 C 568 434, 514 484, 422 460 C 330 436, 250 462, 168 434 C 122 416, 110 400, 100 368 Z"
            fill="url(#smwTurfGrad)"
            stroke="#166534"
            strokeWidth="3"
          />

          {/* Stepped SMW Highland Terrace (North-West Caverna Ridge) */}
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

          {/* Biome 1: Overworld Hills, Yoshi-style Outpost House & Palms (near W-1 16%, 64%) */}
          <g>
            {/* Classic SMW Hills with cute vertical eyes */}
            <path d="M 108 325 C 118 258, 174 258, 184 325 Z" fill="#16a34a" stroke="#14532d" strokeWidth="2.5" />
            <ellipse cx="140" cy="292" rx="2.5" ry="6" fill="#052e16" />
            <ellipse cx="152" cy="292" rx="2.5" ry="6" fill="#052e16" />

            <path d="M 176 312 C 184 268, 224 268, 232 312 Z" fill="#15803d" stroke="#14532d" strokeWidth="2" />
            <ellipse cx="200" cy="290" rx="2" ry="5" fill="#052e16" />
            <ellipse cx="209" cy="290" rx="2" ry="5" fill="#052e16" />

            {/* Cozy Hero Cottage */}
            <rect x="114" y="324" width="32" height="24" rx="3" fill="#fef3c7" stroke="#78350f" strokeWidth="2" />
            <path d="M 108 326 L 130 306 L 152 326 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
            <rect x="125" y="335" width="10" height="13" rx="1" fill="#92400e" />
            <circle cx="130" cy="317" r="3.5" fill="#fef08a" />

            {/* Lush Overworld Trees */}
            <g>
              <rect x="210" y="422" width="6" height="14" fill="#78350f" />
              <circle cx="213" cy="414" r="14" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
              <circle cx="207" cy="410" r="6" fill="#4ade80" fillOpacity="0.45" />
            </g>
            <g>
              <rect x="97" y="405" width="5" height="12" fill="#78350f" />
              <circle cx="99" cy="398" r="12" fill="#15803d" stroke="#14532d" strokeWidth="2" />
            </g>
            <g>
              <rect x="242" y="256" width="5" height="12" fill="#78350f" />
              <circle cx="244" cy="249" r="13" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
            </g>
          </g>

          {/* Biome 2: Craggy Mountain Peak & Caverna Entrance (near W-2 34%, 41%) */}
          <g>
            {/* Back twin peaks */}
            <path d="M 278 242 L 325 142 L 372 242 Z" fill="#57534e" stroke="#292524" strokeWidth="2.5" />
            <path d="M 332 242 L 378 156 L 424 242 Z" fill="#78716c" stroke="#292524" strokeWidth="2.5" />
            {/* Snow Caps */}
            <path d="M 310 174 L 325 142 L 340 174 L 332 168 L 325 176 L 318 168 Z" fill="#f1f5f9" />
            <path d="M 366 178 L 378 156 L 390 178 L 383 173 L 378 179 L 373 173 Z" fill="#e2e8f0" />
            {/* Dark Cavern Arch & Lantern Glow */}
            <path d="M 316 244 C 316 196, 368 196, 368 244 Z" fill="#1c1917" stroke="#292524" strokeWidth="2.5" />
            <ellipse cx="342" cy="236" rx="18" ry="8" fill="#f59e0b" fillOpacity="0.18" />
            {/* Wooden Mine Frame */}
            <rect x="319" y="214" width="5" height="30" fill="#78350f" />
            <rect x="360" y="214" width="5" height="30" fill="#78350f" />
            <rect x="316" y="210" width="52" height="6" rx="1" fill="#92400e" stroke="#451a03" strokeWidth="1.5" />
            <circle cx="323" cy="222" r="3" fill="#fbbf24" />
          </g>

          {/* Biome 3: Turquoise Lagoon Cove, Coral & Wooden Pier (near W-3 51%, 66%) */}
          <g>
            {/* Sandbar Rim */}
            <ellipse cx="510" cy="408" rx="112" ry="60" fill="#fde68a" stroke="#d97706" strokeWidth="2" />
            {/* Deep Coastal Cove */}
            <ellipse cx="510" cy="408" rx="98" ry="51" fill="url(#smwLagoonGrad)" stroke="#7dd3fc" strokeWidth="2.5" />
            {/* Inner Caustic Rings */}
            <ellipse cx="514" cy="412" rx="68" ry="31" fill="#38bdf8" fillOpacity="0.28" />
            <path d="M 458 418 Q 485 408 512 418 T 566 418" stroke="#e0f2fe" strokeWidth="2" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
            {/* Coral Clusters */}
            <circle cx="445" cy="422" r="6" fill="#fb7185" />
            <circle cx="452" cy="426" r="4" fill="#f43f5e" />
            <circle cx="574" cy="396" r="5" fill="#fb923c" />
            <circle cx="580" cy="401" r="4" fill="#f97316" />
            {/* Wooden Dock Pier */}
            <rect x="424" y="376" width="44" height="12" rx="2" fill="#92400e" stroke="#451a03" strokeWidth="1.5" />
            <line x1="435" y1="376" x2="435" y2="388" stroke="#451a03" strokeWidth="1.5" />
            <line x1="447" y1="376" x2="447" y2="388" stroke="#451a03" strokeWidth="1.5" />
            <line x1="459" y1="376" x2="459" y2="388" stroke="#451a03" strokeWidth="1.5" />
          </g>

          {/* Biome 4: Haunted Violet Grove & Mansão Fantasma (near W-4 68%, 38%) */}
          <g>
            {/* Violet Shadow Woods */}
            <ellipse cx="682" cy="238" rx="88" ry="52" fill="#3b0764" fillOpacity="0.86" stroke="#7e22ce" strokeWidth="3" />
            <ellipse cx="682" cy="242" rx="68" ry="38" fill="#581c87" fillOpacity="0.55" />

            {/* Crescent Moon */}
            <circle cx="752" cy="146" r="14" fill="url(#smwMoonGlow)" opacity="0.9" />
            <circle cx="758" cy="143" r="12" fill="#0ea5e9" fillOpacity="0.55" />

            {/* Crooked Twisted Dead Trees */}
            <path d="M 615 245 L 619 216 L 609 203 M 619 224 L 629 212" stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M 744 242 L 740 214 L 750 202 M 740 222 L 730 211" stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round" />

            {/* Ghost Manor Silhouette */}
            <rect x="650" y="182" width="64" height="44" fill="#312e81" stroke="#0f172a" strokeWidth="2.5" />
            <polygon points="644,184 682,152 720,184" fill="#1e1b4b" stroke="#0f172a" strokeWidth="2" />
            {/* Manor Central Steeple */}
            <rect x="674" y="142" width="16" height="22" fill="#312e81" stroke="#0f172a" strokeWidth="2" />
            <polygon points="670,144 682,126 694,144" fill="#1e1b4b" stroke="#0f172a" strokeWidth="2" />
            {/* Glowing Amber Haunted Windows & Door */}
            <rect x="658" y="192" width="10" height="12" rx="4" fill="#fde047" />
            <rect x="696" y="192" width="10" height="12" rx="4" fill="#fde047" />
            <path d="M 676 226 L 676 208 C 676 202, 688 202, 688 208 L 688 226 Z" fill="#0f172a" />
          </g>

          {/* Biome 5: Obsidian Ridge, Magma Moat & Castelo de Johannnnes89 (near W-5 85%, 53%) */}
          <g>
            {/* Lava Moat & Volcanic Ridge */}
            <ellipse cx="848" cy="326" rx="84" ry="60" fill="#27272a" stroke="#7f1d1d" strokeWidth="4" />
            <ellipse cx="848" cy="330" rx="68" ry="44" fill="url(#smwLavaGrad)" fillOpacity="0.88" />
            <ellipse cx="848" cy="324" rx="54" ry="34" fill="#18181b" stroke="#450a0a" strokeWidth="2.5" />

            {/* Fortress Keep */}
            <rect x="814" y="266" width="68" height="46" fill="#52525b" stroke="#18181b" strokeWidth="2.5" />
            {/* Side Towers & Crenellations */}
            <rect x="802" y="250" width="20" height="62" fill="#3f3f46" stroke="#18181b" strokeWidth="2" />
            <rect x="874" y="250" width="20" height="62" fill="#3f3f46" stroke="#18181b" strokeWidth="2" />
            <rect x="800" y="242" width="7" height="9" fill="#52525b" stroke="#18181b" strokeWidth="1.5" />
            <rect x="816" y="242" width="7" height="9" fill="#52525b" stroke="#18181b" strokeWidth="1.5" />
            <rect x="873" y="242" width="7" height="9" fill="#52525b" stroke="#18181b" strokeWidth="1.5" />
            <rect x="889" y="242" width="7" height="9" fill="#52525b" stroke="#18181b" strokeWidth="1.5" />
            {/* Central Spire & Crimson Banners */}
            <rect x="836" y="236" width="24" height="32" fill="#3f3f46" stroke="#18181b" strokeWidth="2" />
            <polygon points="832,238 848,214 864,238" fill="#991b1b" stroke="#18181b" strokeWidth="2" />
            <line x1="848" y1="214" x2="848" y2="196" stroke="#e4e4e7" strokeWidth="2" />
            <polygon points="848,197 866,203 848,209" fill="#ef4444" />
            {/* Glowing Castle Portcullis */}
            <path d="M 838 312 L 838 290 C 838 282, 858 282, 858 290 L 858 312 Z" fill="#18181b" stroke="#f97316" strokeWidth="2" />
            <line x1="844" y1="286" x2="844" y2="312" stroke="#52525b" strokeWidth="1.5" />
            <line x1="852" y1="286" x2="852" y2="312" stroke="#52525b" strokeWidth="1.5" />
          </g>

          {/* Switch Palace Landmark: Palácio Interruptor Amarelo (29%, 72% -> 290, 432) */}
          <g>
            {/* Sunny Golden Terrace */}
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
            {/* SMW Dome Shrine */}
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
            {/* Doorway */}
            <path
              d="M 284 430 L 284 416 C 284 411, 296 411, 296 416 L 296 430 Z"
              fill="#292524"
            />
            {/* Iconic [!] Badge on Dome */}
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
                {/* Dark Road Outline */}
                <path
                  d={d}
                  fill="none"
                  stroke="#1c1917"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeOpacity={pathUnlocked ? 0.55 : 0.35}
                />
                {/* Stone/Earth Roadbed */}
                <path
                  d={d}
                  fill="none"
                  stroke={pathUnlocked ? '#b45309' : '#475569'}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                {/* Classic SMW Dashed Trail */}
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

        {/* Distant Horizon Label */}
        <div className="hidden sm:block absolute top-3 right-3 text-right pointer-events-none">
          <span className="text-[10px] font-mono text-sky-100/85 drop-shadow">
            Novas ilhas em desenvolvimento (Pós-Beta V0.9)
          </span>
        </div>

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

        {/* Ambient Patrolling Island Creatures (Real SpriteAtlas Pixel Art) */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
          {/* Overworld Goomba Patrol */}
          <div
            style={{ left: `${goombaX}%`, top: '76.5%' }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div className="w-5 h-1.5 rounded-full bg-black/35 mx-auto translate-y-4" />
            <PixelSpriteView sprite={goombaSprite} displayWidth={20} displayHeight={20} facing={goombaFacing} />
          </div>

          {/* Foothills Koopa Troopa Patrol */}
          <div
            style={{ left: `${koopaX}%`, top: '52.5%' }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div className="w-5 h-1.5 rounded-full bg-black/35 mx-auto translate-y-6" />
            <PixelSpriteView sprite={koopaSprite} displayWidth={20} displayHeight={28} facing={koopaFacing} />
          </div>

          {/* Lagoon Cheep-Cheep Swim */}
          <div
            style={{ left: `${cheepX}%`, top: `${cheepY}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <PixelSpriteView sprite={cheepSprite} displayWidth={20} displayHeight={20} facing={cheepFacing} />
          </div>

          {/* Haunted Woods Dry Bones Patrol */}
          <div
            style={{ left: `${dryBonesX}%`, top: '50.5%' }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div className="w-5 h-1.5 rounded-full bg-black/40 mx-auto translate-y-6" />
            <PixelSpriteView sprite={dryBonesSprite} displayWidth={20} displayHeight={28} facing={dryBonesFacing} />
          </div>

          {/* Floating Boo around Ghost Manor */}
          <div
            style={{ left: `${booX}%`, top: `${booY}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 opacity-90"
          >
            <PixelSpriteView sprite={booSprite} displayWidth={22} displayHeight={22} facing={booFacing} />
          </div>

          {/* Bowser Guarding Castelo de Johannnnes89 */}
          <div
            style={{ left: `${bowserX}%`, top: '67.5%' }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div className="w-7 h-2 rounded-full bg-black/45 mx-auto translate-y-7" />
            <PixelSpriteView sprite={bowserSprite} displayWidth={30} displayHeight={30} facing={bowserFacing} />
          </div>
        </div>

        {/* Interactive Stage Nodes on Ilha WikiWorldWeb */}
        {SMW_WIKIWORLD_NODES.map(node => {
          const unlocked = isSmwNodeUnlocked(node.id, progress);
          const cleared = progress.clearedNodeIds.includes(node.id);
          const isSelected = progress.selectedNodeId === node.id;

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
                  if (!unlocked) return;
                  if (isSelected) {
                    onEnterStage(node.id);
                  } else {
                    onSelectNode(node.id);
                  }
                }}
                onDoubleClick={() => {
                  if (!unlocked) return;
                  onEnterStage(node.id);
                }}
                disabled={!unlocked}
                aria-label={`${node.title} (${cleared ? 'Concluída' : unlocked ? 'Disponível' : 'Bloqueada'})`}
                className={`relative min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl border-2 flex items-center justify-center gap-1 transition-transform cursor-pointer shadow-lg ${
                  !unlocked
                    ? 'bg-stone-900/90 border-stone-600 text-stone-500 cursor-not-allowed opacity-80'
                    : isSelected
                    ? node.isCastle
                      ? 'bg-red-700 border-amber-300 text-white scale-110 ring-4 ring-amber-300/65'
                      : node.isSwitchPalace
                      ? 'bg-yellow-400 border-white text-stone-950 scale-110 ring-4 ring-yellow-300/75'
                      : 'bg-amber-500 border-white text-stone-950 scale-110 ring-4 ring-amber-300/65'
                    : cleared
                    ? node.isSwitchPalace
                      ? 'bg-yellow-500 hover:bg-yellow-400 border-yellow-100 text-stone-950 hover:scale-105'
                      : 'bg-emerald-700 hover:bg-emerald-600 border-emerald-200 text-white hover:scale-105'
                    : node.isCastle
                    ? 'bg-red-900 hover:bg-red-800 border-red-400 text-amber-200 hover:scale-105'
                    : node.isSwitchPalace
                    ? 'bg-yellow-700 hover:bg-yellow-600 border-yellow-300 text-yellow-100 hover:scale-105'
                    : 'bg-sky-700 hover:bg-sky-600 border-sky-200 text-white hover:scale-105'
                }`}
              >
                {unlocked ? getNodeIcon(node) : <Lock className="w-4 h-4" />}
                {cleared && (
                  <span className="w-4 h-4 rounded-full bg-amber-300 text-stone-950 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
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
            </div>
          );
        })}

        {/* Animated Hero Duo (Lead Character + Companion Walking Along the Path) */}
        <div className="absolute inset-0 pointer-events-none select-none z-20" aria-hidden="true">
          {/* Companion Hero */}
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

          {/* Lead Active Hero */}
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

        {/* Island Victory Celebration Toast (after clearing Castelo de Johannnnes89) */}
        {(islandCompleted || justClearedNodeId === 'wiki-5-castelo') && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-lg px-3.5 py-2 rounded-lg bg-stone-950/92 border border-amber-400/80 text-center shadow-xl">
            <p className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Castelo de Johannnnes89 conquistado! Ilha WikiWorldWeb 100% salva!</span>
            </p>
            <p className="text-[10px] text-stone-300 mt-0.5">
              Bowser e Chronus recuaram desta ilha. Novas ilhas para resgatar a Princesa Femboy chegam após o Beta V0.9!
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
              {selectedCleared ? 'Concluída' : selectedUnlocked ? 'Disponível' : 'Bloqueada'}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-white truncate">
            {selectedNode.title}
          </p>
          <p className="text-[10px] sm:text-[11px] text-stone-400 truncate">
            {selectedNode.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {clearedCount > 0 && (
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

          <button
            type="button"
            disabled={!selectedUnlocked}
            onClick={() => onEnterStage(selectedNode.id)}
            className="flex-1 sm:flex-initial min-h-[40px] px-4 sm:px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>ENTRAR NA FASE</span>
          </button>
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
    </div>
  );
};
