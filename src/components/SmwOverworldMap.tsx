/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import {
  SMW_BETA_VERSION,
  SMW_WORLD_ISLAND_NAME,
  SMW_INTRO_STORY,
  SMW_WIKIWORLD_NODES,
  SmwBetaProgress,
  SmwMapNode,
  isSmwNodeUnlocked,
} from '../game/smwWorldMap.ts';
import { PlayerCharacter } from '../game/types.ts';

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

  const selectedUnlocked = isSmwNodeUnlocked(selectedNode.order, progress);
  const selectedCleared = progress.clearedNodeIds.includes(selectedNode.id);
  const islandCompleted = progress.clearedNodeIds.includes('wiki-5-castelo');
  const clearedCount = progress.clearedNodeIds.length;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showStory) {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
          e.preventDefault();
          setShowStory(false);
          onDismissStory();
        }
        return;
      }

      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        const nextIdx = Math.min(SMW_WIKIWORLD_NODES.length - 1, selectedNode.order + 1);
        const target = SMW_WIKIWORLD_NODES[nextIdx];
        if (target && isSmwNodeUnlocked(target.order, progress)) {
          onSelectNode(target.id);
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        const prevIdx = Math.max(0, selectedNode.order - 1);
        const target = SMW_WIKIWORLD_NODES[prevIdx];
        if (target && isSmwNodeUnlocked(target.order, progress)) {
          onSelectNode(target.id);
        }
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') {
        e.preventDefault();
        if (selectedUnlocked) {
          onEnterStage(selectedNode.id);
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onBackToMainMenu();
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

  const getThemeIcon = (theme: SmwMapNode['theme']) => {
    switch (theme) {
      case 'overworld':
        return <Trees className="w-4 h-4 text-emerald-100" />;
      case 'underground':
        return <Mountain className="w-4 h-4 text-sky-200" />;
      case 'underwater':
        return <Waves className="w-4 h-4 text-cyan-100" />;
      case 'ghost_house':
        return <Ghost className="w-4 h-4 text-purple-100" />;
      case 'castle':
        return <Castle className="w-4 h-4 text-amber-100" />;
    }
  };

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
            <span className="tabular-nums text-stone-400">
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
      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-gradient-to-b from-sky-700 via-blue-700 to-indigo-900">
        {/* Ocean Ripple Pattern & Distant Horizon Islands */}
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          aria-hidden="true"
        >
          {/* Ocean wave highlights */}
          <g stroke="#38bdf8" strokeWidth="2.5" strokeOpacity="0.28" fill="none" strokeLinecap="round">
            <path d="M40 90 Q60 80 80 90 T120 90" />
            <path d="M840 110 Q860 100 880 110 T920 110" />
            <path d="M90 500 Q110 490 130 500 T170 500" />
            <path d="M760 520 Q785 510 810 520 T860 520" />
            <path d="M420 70 Q445 60 470 70 T520 70" />
          </g>

          {/* Distant locked Beta Horizon Island */}
          <g opacity="0.55">
            <ellipse cx="905" cy="92" rx="68" ry="26" fill="#fde68a" />
            <ellipse cx="905" cy="86" rx="58" ry="20" fill="#1e293b" />
            <polygon points="885,78 905,52 925,78" fill="#334155" />
          </g>

          {/* Main Island: Ilha WikiWorldWeb Sand Shore */}
          <path
            d="M 85 385 C 65 290, 120 205, 225 185 C 310 165, 375 130, 480 165 C 575 195, 625 135, 735 150 C 865 168, 945 255, 925 360 C 905 460, 800 505, 680 485 C 570 465, 515 515, 420 490 C 330 468, 250 495, 165 465 C 110 445, 95 425, 85 385 Z"
            fill="#fde68a"
            stroke="#ca8a04"
            strokeWidth="4"
          />

          {/* Island Lush Emerald Turf */}
          <path
            d="M 105 375 C 88 298, 138 220, 232 200 C 315 182, 372 148, 476 182 C 570 212, 628 152, 728 166 C 845 182, 918 260, 900 352 C 882 442, 785 482, 678 462 C 570 442, 515 490, 425 468 C 335 445, 255 470, 175 445 C 128 428, 115 408, 105 375 Z"
            fill="#22c55e"
            stroke="#15803d"
            strokeWidth="4"
          />

          {/* Aquatic Lagoon Cove (near W-3 Água around 51%, 66%) */}
          <ellipse cx="510" cy="400" rx="95" ry="52" fill="#0284c7" stroke="#bae6fd" strokeWidth="3" />
          <ellipse cx="515" cy="402" rx="68" ry="34" fill="#0ea5e9" fillOpacity="0.65" />

          {/* Mountain Plateau for W-2 Caverna (34%, 41%) */}
          <path d="M 275 265 L 335 170 L 405 265 Z" fill="#78716c" stroke="#44403c" strokeWidth="3" />
          <path d="M 318 265 C 318 225, 358 225, 358 265 Z" fill="#1c1917" />

          {/* Haunted Violet Grove for W-4 Mansão Fantasma (68%, 38%) */}
          <ellipse cx="680" cy="242" rx="82" ry="48" fill="#4c1d95" fillOpacity="0.78" stroke="#7e22ce" strokeWidth="3" />

          {/* Dark Castle Volcanic Ridge for W-5 Castelo de Johannnnes89 (85%, 53%) */}
          <ellipse cx="848" cy="322" rx="74" ry="52" fill="#3f3f46" stroke="#7f1d1d" strokeWidth="4" />
          <ellipse cx="848" cy="332" rx="52" ry="32" fill="#18181b" />

          {/* Overworld Decorative Pixel Hills & Trees */}
          <g fill="#16a34a" stroke="#14532d" strokeWidth="2">
            <circle cx="150" cy="300" r="18" />
            <circle cx="205" cy="420" r="15" />
            <circle cx="240" cy="260" r="14" />
            <circle cx="430" cy="245" r="16" />
          </g>

          {/* SMW Dotted Stage Paths Connecting Nodes */}
          {SMW_WIKIWORLD_NODES.slice(0, -1).map((node, i) => {
            const next = SMW_WIKIWORLD_NODES[i + 1];
            const pathUnlocked = isSmwNodeUnlocked(next.order, progress);
            return (
              <g key={`${node.id}-${next.id}`}>
                <line
                  x1={node.mapX * 10}
                  y1={node.mapY * 6}
                  x2={next.mapX * 10}
                  y2={next.mapY * 6}
                  stroke="#1c1917"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeOpacity={pathUnlocked ? 0.45 : 0.25}
                />
                <line
                  x1={node.mapX * 10}
                  y1={node.mapY * 6}
                  x2={next.mapX * 10}
                  y2={next.mapY * 6}
                  stroke={pathUnlocked ? '#facc15' : '#64748b'}
                  strokeWidth="6"
                  strokeDasharray="12 10"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Distant Horizon Marker Label */}
        <div className="hidden sm:block absolute top-3 right-3 text-right pointer-events-none">
          <span className="text-[10px] font-mono text-sky-200/80">
            Novas ilhas em desenvolvimento (Pós-Beta V0.9)
          </span>
        </div>

        {/* Island Name Banner */}
        <div className="absolute top-2.5 left-3 pointer-events-none">
          <div className="px-2.5 py-1 rounded-md bg-stone-950/80 border border-emerald-500/50 shadow">
            <span className="font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] text-emerald-300">
              {SMW_WORLD_ISLAND_NAME.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Interactive Stage Nodes on Ilha WikiWorldWeb */}
        {SMW_WIKIWORLD_NODES.map(node => {
          const unlocked = isSmwNodeUnlocked(node.order, progress);
          const cleared = progress.clearedNodeIds.includes(node.id);
          const isSelected = progress.selectedNodeId === node.id;

          return (
            <div
              key={node.id}
              style={{ left: `${node.mapX}%`, top: `${node.mapY}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
            >
              {/* Animated Hero Avatar Marker standing above selected node */}
              {isSelected && (
                <div className="mb-1 px-1.5 py-0.5 rounded bg-stone-950/90 border border-amber-400 text-[9px] font-['Press_Start_2P',monospace] text-amber-300 shadow-lg animate-bounce whitespace-nowrap">
                  {playerCharacter === 'wazzima' ? 'W' : 'M'}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!unlocked) return;
                  if (isSelected) {
                    onEnterStage(node.id);
                  } else {
                    onSelectNode(node.id);
                  }
                }}
                disabled={!unlocked}
                aria-label={`${node.title} (${cleared ? 'Concluída' : unlocked ? 'Disponível' : 'Bloqueada'})`}
                className={`relative min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl border-2 flex items-center justify-center gap-1 transition-transform cursor-pointer shadow-lg ${
                  !unlocked
                    ? 'bg-stone-900/90 border-stone-600 text-stone-500 cursor-not-allowed opacity-75'
                    : isSelected
                    ? node.isCastle
                      ? 'bg-red-700 border-amber-300 text-white scale-110 ring-4 ring-amber-400/50'
                      : 'bg-amber-600 border-white text-white scale-110 ring-4 ring-amber-400/50'
                    : cleared
                    ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-300 text-white hover:scale-105'
                    : node.isCastle
                    ? 'bg-red-900 hover:bg-red-800 border-red-400 text-amber-200 hover:scale-105'
                    : 'bg-sky-700 hover:bg-sky-600 border-sky-300 text-white hover:scale-105'
                }`}
              >
                {unlocked ? getThemeIcon(node.theme) : <Lock className="w-4 h-4" />}
                {cleared && (
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </button>

              {/* Node Title Tag below button */}
              <span
                className={`mt-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold whitespace-nowrap shadow ${
                  isSelected
                    ? 'bg-stone-950 text-amber-300 border border-amber-400/80'
                    : 'bg-stone-950/85 text-stone-100 border border-stone-700/70'
                }`}
              >
                {node.title}
              </span>
            </div>
          );
        })}

        {/* Island Victory Celebration Toast (after clearing Castelo de Johannnnes89) */}
        {(islandCompleted || justClearedNodeId === 'wiki-5-castelo') && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-lg px-3.5 py-2 rounded-lg bg-stone-950/92 border border-amber-400/80 text-center shadow-xl">
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
              Fases da {SMW_WORLD_ISLAND_NAME}: Overworld, Caverna, Água, Mansão Fantasma e Castelo de Johannnnes89.
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
