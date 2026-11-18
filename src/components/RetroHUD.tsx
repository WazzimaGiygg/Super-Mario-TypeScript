/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameStats } from '../game/types.ts';
import { Trophy, Heart, Flame, Maximize2, Minimize2, Bug, Crosshair } from 'lucide-react';

interface RetroHUDProps {
  stats: GameStats;
  onOpenLeaderboard?: () => void;
  isCheatActive?: boolean;
  isCustomLevel?: boolean;
  isFemboy?: boolean;
  onOpenCheatMenu?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isDebugMode?: boolean;
  isDebugPlacementActive?: boolean;
  debugCoords?: { x: number; y: number };
  isIllegalInstructionBug?: boolean;
  onToggleDebugPlacement?: () => void;
}

export const RetroHUD: React.FC<RetroHUDProps> = ({
  stats,
  onOpenLeaderboard,
  isCheatActive = false,
  isCustomLevel = false,
  isFemboy = false,
  onOpenCheatMenu,
  isFullscreen = false,
  onToggleFullscreen,
  isDebugMode = false,
  isDebugPlacementActive = false,
  debugCoords = { x: 0, y: 0 },
  isIllegalInstructionBug = false,
  onToggleDebugPlacement,
}) => {
  const hexX = Math.max(0, Math.round(debugCoords.x)).toString(16).toUpperCase().padStart(4, '0');
  const hexY = Math.max(0, Math.round(debugCoords.y)).toString(16).toUpperCase().padStart(4, '0');
  // Format numbers with leading zeroes
  const formattedScore = String(stats.score).padStart(6, '0');
  const formattedHighScore = String(stats.highScore).padStart(6, '0');
  const formattedCoins = String(stats.coins).padStart(2, '0');
  const formattedTime = String(stats.time).padStart(3, '0');
  const formattedGoalWallet = String(Math.max(0, Math.min(99, stats.goalPointsWallet ?? 0))).padStart(2, '0');

  // Render lives as hearts (capped at 5 icons + overflow count to avoid HUD overflow)
  const renderLifeHearts = () => {
    if (stats.lives >= 99) {
      return (
        <span className="text-amber-400 font-bold text-xs flex items-center gap-1 shrink-0">
          <Heart className="w-4 h-4 fill-red-500 text-red-500 animate-pulse" />
          <span>x ∞</span>
        </span>
      );
    }

    const MAX_VISIBLE_HEARTS = 5;
    const clampedLives = Math.max(0, stats.lives);
    const totalSlots = clampedLives > MAX_VISIBLE_HEARTS ? MAX_VISIBLE_HEARTS : Math.max(3, clampedLives);
    const hearts = [];
    for (let i = 0; i < totalSlots; i++) {
      const isAlive = i < clampedLives;
      hearts.push(
        <Heart
          key={i}
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-all duration-300 ${
            isAlive
              ? 'fill-red-500 text-red-600 scale-100 drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]'
              : 'fill-stone-800 text-stone-700 scale-90 opacity-40'
          }`}
        />
      );
    }

    if (clampedLives > MAX_VISIBLE_HEARTS) {
      hearts.push(
        <span
          key="overflow"
          className="ml-0.5 px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-[9px] font-mono font-bold text-amber-300 tabular-nums shrink-0"
        >
          +{clampedLives - MAX_VISIBLE_HEARTS}
        </span>
      );
    }

    return hearts;
  };

  return (
    <div
      className={`w-full shrink-0 bg-stone-950/95 text-white font-['Press_Start_2P',monospace] select-none border-b border-stone-800/80 shadow-lg px-2 sm:px-6 ${
        isFullscreen ? 'py-1 sm:py-1.5' : 'py-1.5 sm:py-2.5'
      }`}
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-1 sm:gap-1.5">
        {/* Main Scoreboard Row */}
        <div className="grid grid-cols-3 sm:grid-cols-5 items-center text-center gap-2 sm:gap-4">
          {/* 1. Mario Score (or Sonic Debug Coordinates when Debug Mode is active) */}
          <div
            className={`flex flex-col items-center sm:items-start bg-stone-900/60 p-1.5 sm:p-2 rounded-lg border ${
              isDebugMode
                ? 'border-cyan-400/70 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : isFemboy
                ? 'border-pink-500/60'
                : 'border-stone-800/80'
            }`}
          >
            {isDebugMode ? (
              <>
                <span className="text-[9px] sm:text-[11px] text-cyan-300 font-bold tracking-wider mb-0.5 flex items-center gap-1">
                  <Bug className="w-3 h-3 text-cyan-400" />
                  <span>COORD DEBUG</span>
                </span>
                <span className="tabular-nums font-mono text-xs sm:text-sm md:text-base tracking-widest text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]">
                  {hexX} {hexY}
                </span>
                <span className="text-[8px] sm:text-[9px] text-amber-300 font-mono font-bold tracking-wider mt-0.5">
                  X:{Math.round(debugCoords.x)} Y:{Math.round(debugCoords.y)}
                </span>
              </>
            ) : (
              <>
                {isFemboy ? (
                  <span className="text-[9px] sm:text-[11px] text-pink-400 font-bold tracking-wider mb-0.5 flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-pink-500 text-pink-400 animate-pulse" />
                    <span>LOVE POINTS</span>
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[11px] text-amber-400 font-bold tracking-wider mb-0.5">
                    PONTOS
                  </span>
                )}
                <span
                  className={`tabular-nums font-mono text-xs sm:text-sm md:text-base tracking-widest ${
                    isFemboy
                      ? 'text-pink-100 drop-shadow-[0_0_6px_rgba(244,114,182,0.6)]'
                      : 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                  }`}
                >
                  {formattedScore}
                </span>
                {isCheatActive && (
                  <span className="text-[8px] sm:text-[9px] text-red-500 font-bold tracking-widest animate-pulse mt-0.5">
                    CHEAT USE
                  </span>
                )}
                {!isCheatActive && isCustomLevel && (
                  <span className="text-[8px] sm:text-[9px] text-sky-400 font-bold tracking-widest mt-0.5">
                    EDITOR
                  </span>
                )}
              </>
            )}
          </div>

          {/* 2. Recorde / Top Score */}
          <div
            className={`hidden sm:flex flex-col items-center bg-stone-900/60 p-1.5 sm:p-2 rounded-lg border transition-colors ${
              stats.isNewHighScore && !isCheatActive && !isCustomLevel
                ? 'border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                : 'border-stone-800/80'
            }`}
          >
            <div className="flex items-center gap-1 text-[9px] sm:text-[11px] text-amber-300 font-bold tracking-wider mb-0.5">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>RECORDE</span>
              {stats.isNewHighScore && !isCheatActive && !isCustomLevel && (
                <span className="text-[8px] text-emerald-400 animate-pulse">NOVO!</span>
              )}
            </div>
            <span className="tabular-nums font-mono text-xs sm:text-sm text-amber-200 tracking-widest">
              {formattedHighScore}
            </span>
          </div>

          {/* 3. Moedas / Coins */}
          <div className="flex flex-col items-center bg-stone-900/60 p-1.5 sm:p-2 rounded-lg border border-stone-800/80">
            <span className="text-[9px] sm:text-[11px] text-stone-400 font-bold tracking-wider mb-0.5">
              MOEDAS
            </span>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-3 bg-amber-400 border border-amber-600 rounded-xs animate-pulse"></span>
              <span className="text-stone-300 text-[10px] sm:text-xs">x</span>
              <span className="tabular-nums font-mono text-xs sm:text-sm md:text-base text-amber-300">
                {formattedCoins}
              </span>
            </div>
          </div>

          {/* 4. Mundo / World */}
          <div className="hidden sm:flex flex-col items-center bg-stone-900/60 p-1.5 sm:p-2 rounded-lg border border-stone-800/80">
            <span className="text-[9px] sm:text-[11px] text-amber-400 font-bold tracking-wider mb-0.5">
              MUNDO
            </span>
            <span className="tabular-nums font-mono text-xs sm:text-sm text-white">
              {stats.world}
            </span>
          </div>

          {/* 5. Tempo / Time */}
          <div className="flex flex-col items-center sm:items-end bg-stone-900/60 p-1.5 sm:p-2 rounded-lg border border-stone-800/80">
            <span className="text-[9px] sm:text-[11px] text-amber-400 font-bold tracking-wider mb-0.5">
              TEMPO
            </span>
            <span
              className={`tabular-nums font-mono text-xs sm:text-sm md:text-base ${
                stats.time < 100
                  ? 'text-red-500 animate-pulse font-extrabold drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                  : 'text-white'
              }`}
            >
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Compact Mobile Recorde, World & Fullscreen Strip */}
        <div className="flex sm:hidden items-center justify-between bg-stone-900/85 px-2.5 py-1 rounded-lg border border-stone-800 text-[9px]">
          <div className="flex items-center gap-1.5 text-amber-300">
            <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
            <span>REC:</span>
            <span className="font-mono text-amber-200 tracking-wider">{formattedHighScore}</span>
            {stats.isNewHighScore && !isCheatActive && !isCustomLevel && (
              <span className="text-[8px] text-emerald-400 animate-pulse">NOVO!</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {(isCheatActive || isDebugMode || isIllegalInstructionBug) && onOpenCheatMenu && (
              <button
                type="button"
                onClick={onOpenCheatMenu}
                className={`px-2 py-0.5 rounded border font-bold cursor-pointer whitespace-nowrap ${
                  isIllegalInstructionBug
                    ? 'bg-emerald-600/40 text-emerald-200 border-emerald-400 animate-pulse'
                    : 'bg-red-600/30 text-red-300 border-red-500/50'
                }`}
              >
                {isIllegalInstructionBug ? 'DEV · CORRIGIR' : 'DEV'}
              </button>
            )}
            {!isIllegalInstructionBug && (
              <span
                title="Carteira de Pontos do Poste (50 = +3 Vidas · 100 = Bonus Stage 9 Vidas)"
                className={`px-1.5 py-0.5 rounded border font-mono font-bold whitespace-nowrap shrink-0 ${
                  stats.isBonusStage
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60'
                    : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                }`}
              >
                {stats.isBonusStage
                  ? `BONUS ${9 - (stats.bonusBlocksRemaining ?? 0)}/9`
                  : `★${formattedGoalWallet}/100`}
              </span>
            )}
            {!isIllegalInstructionBug && (
              <span className="text-stone-400">{stats.world}</span>
            )}
            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold cursor-pointer"
              >
                RANKING
              </button>
            )}
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                className={`px-2 py-0.5 rounded border font-bold flex items-center gap-1 cursor-pointer ${
                  isFullscreen
                    ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60'
                    : 'bg-stone-800 text-stone-200 border-stone-700'
                }`}
              >
                {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                <span>{isFullscreen ? 'SAIR' : 'TELA CHEIA'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Second Row: Detailed Lives & Placar Quick Actions (hidden on mobile to preserve vertical space for game controls) */}
        <div className="hidden sm:flex items-center justify-between gap-2 min-w-0 bg-stone-900/90 px-3 py-1.5 rounded-lg border border-stone-800 text-[10px] sm:text-xs">
          {/* Quantidade de Vidas (Highlighted Lives Tracker) */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <div className="flex items-center gap-1.5 text-stone-200 shrink-0">
              <span className="text-red-400 font-bold">VIDAS:</span>
              <span
                className={`px-2 py-0.5 rounded font-mono font-bold tabular-nums ${
                  stats.lives === 1
                    ? 'bg-red-950 text-red-400 border border-red-600 animate-pulse'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                }`}
              >
                {stats.lives}
              </span>
            </div>

            {/* Visual Hearts */}
            <div className="flex items-center gap-1 shrink-0">
              {renderLifeHearts()}
            </div>

            {/* Warning for last life or difficulty badge */}
            {stats.lives === 1 ? (
              <span className="hidden lg:inline-block text-[9px] text-red-400 animate-bounce font-bold tracking-wider whitespace-nowrap">
                ⚠️ ÚLTIMA VIDA!
              </span>
            ) : stats.difficulty ? (
              <span
                className={`hidden lg:inline-block text-[8px] font-['Press_Start_2P',monospace] px-2 py-0.5 rounded border uppercase whitespace-nowrap ${
                  stats.difficulty === 'easy'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                    : stats.difficulty === 'hard'
                    ? 'bg-red-950 text-red-400 border-red-700'
                    : 'bg-stone-800 text-stone-300 border-stone-700'
                }`}
              >
                {stats.difficulty === 'easy' ? 'FÁCIL' : stats.difficulty === 'hard' ? 'DIFÍCIL' : 'NORMAL'}
              </span>
            ) : null}
            {/* SMW Goal Points Wallet Pill */}
            <span
              title="Carteira de Pontos do Poste SMW (50 = +3 Vidas · 100 = Bonus Stage 9 Vidas)"
              className={`px-2 py-0.5 rounded border font-mono font-bold text-[9px] sm:text-[10px] whitespace-nowrap shrink-0 ${
                stats.isBonusStage
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 animate-pulse'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
              }`}
            >
              {stats.isBonusStage
                ? `BONUS ${9 - (stats.bonusBlocksRemaining ?? 0)}/9 (+${stats.bonusLivesWon ?? 0}V)`
                : `★ ${formattedGoalWallet}/100`}
            </span>
          </div>

          {/* Leaderboard, Debug Cursor & Developer Triggers */}
          <div className="flex items-center gap-2 shrink-0">
            {isDebugMode && !isIllegalInstructionBug && onToggleDebugPlacement && (
              <button
                type="button"
                onClick={onToggleDebugPlacement}
                className={`px-2.5 py-1 rounded border transition flex items-center gap-1.5 cursor-pointer text-[9px] sm:text-[10px] font-bold whitespace-nowrap shrink-0 ${
                  isDebugPlacementActive
                    ? 'bg-cyan-600/35 hover:bg-cyan-600/45 text-cyan-200 border-cyan-400'
                    : 'bg-stone-800 hover:bg-stone-700 text-cyan-300 border-cyan-600/50'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5 text-cyan-300" />
                <span>{isDebugPlacementActive ? 'CURSOR ON (B)' : 'CURSOR OFF (B)'}</span>
              </button>
            )}

            {(isCheatActive || isDebugMode || isIllegalInstructionBug) && onOpenCheatMenu && (
              <button
                type="button"
                onClick={onOpenCheatMenu}
                className={`px-2.5 py-1 rounded border transition flex items-center gap-1.5 cursor-pointer text-[9px] sm:text-[10px] font-bold whitespace-nowrap shrink-0 ${
                  isIllegalInstructionBug
                    ? 'bg-emerald-600/40 hover:bg-emerald-500/50 text-emerald-200 border-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.45)]'
                    : 'bg-red-600/30 hover:bg-red-600/40 text-red-300 border-red-500/50 hover:border-red-400'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 animate-pulse ${isIllegalInstructionBug ? 'text-emerald-300' : 'text-red-400'}`} />
                <span>{isIllegalInstructionBug ? 'DESENVOLVEDOR · RESTAURAR TELA' : 'PÁGINA DO DESENVOLVEDOR'}</span>
              </button>
            )}

            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 transition flex items-center gap-1.5 cursor-pointer text-[9px] sm:text-[10px] whitespace-nowrap shrink-0"
              >
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>PLACAR DE RECORDES</span>
              </button>
            )}

            {/* Small World label on mobile where row 1 world is hidden */}
            <div className="sm:hidden text-stone-400 text-[9px]">
              {stats.world}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
