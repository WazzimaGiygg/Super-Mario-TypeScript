/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameStats } from '../game/types.ts';
import { Trophy, Heart, Flame } from 'lucide-react';

interface RetroHUDProps {
  stats: GameStats;
  onOpenLeaderboard?: () => void;
  isCheatActive?: boolean;
  isFemboy?: boolean;
  onOpenCheatMenu?: () => void;
}

export const RetroHUD: React.FC<RetroHUDProps> = ({
  stats,
  onOpenLeaderboard,
  isCheatActive = false,
  isFemboy = false,
  onOpenCheatMenu,
}) => {
  // Format numbers with leading zeroes
  const formattedScore = String(stats.score).padStart(6, '0');
  const formattedHighScore = String(stats.highScore).padStart(6, '0');
  const formattedCoins = String(stats.coins).padStart(2, '0');
  const formattedTime = String(stats.time).padStart(3, '0');

  // Render lives as hearts
  const renderLifeHearts = () => {
    if (stats.lives >= 99) {
      return (
        <span className="text-amber-400 font-bold text-xs flex items-center gap-1">
          <Heart className="w-4 h-4 fill-red-500 text-red-500 animate-pulse" />
          <span>x ∞</span>
        </span>
      );
    }

    const totalSlots = Math.max(3, stats.lives);
    const hearts = [];
    for (let i = 0; i < totalSlots; i++) {
      const isAlive = i < stats.lives;
      hearts.push(
        <Heart
          key={i}
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all duration-300 ${
            isAlive
              ? 'fill-red-500 text-red-600 scale-100 drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]'
              : 'fill-stone-800 text-stone-700 scale-90 opacity-40'
          }`}
        />
      );
    }
    return hearts;
  };

  return (
    <div className="w-full bg-stone-950/95 text-white font-['Press_Start_2P',monospace] select-none border-b border-stone-800/80 shadow-lg px-2 sm:px-6 py-1.5 sm:py-2.5">
      <div className="max-w-5xl mx-auto flex flex-col gap-1.5 sm:gap-2">
        {/* Main Scoreboard Row */}
        <div className="grid grid-cols-3 sm:grid-cols-5 items-center text-center gap-2 sm:gap-4">
          {/* 1. Mario Score (Pontuação / Love Points) */}
          <div
            className={`flex flex-col items-center sm:items-start bg-stone-900/60 p-1.5 sm:p-2 rounded-lg border ${
              isFemboy ? 'border-pink-500/60' : 'border-stone-800/80'
            }`}
          >
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
          </div>

          {/* 2. Recorde / Top Score */}
          <div className="hidden sm:flex flex-col items-center bg-stone-900/60 p-1.5 sm:p-2 rounded-lg border border-stone-800/80">
            <div className="flex items-center gap-1 text-[9px] sm:text-[11px] text-amber-300 font-bold tracking-wider mb-0.5">
              <Trophy className="w-3 h-3 text-amber-400" />
              <span>RECORDE</span>
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

        {/* Second Row: Detailed Lives & Placar Quick Actions (hidden on mobile to preserve vertical space for game controls) */}
        <div className="hidden sm:flex items-center justify-between bg-stone-900/90 px-3 py-1.5 rounded-lg border border-stone-800 text-[10px] sm:text-xs">
          {/* Quantidade de Vidas (Highlighted Lives Tracker) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-stone-200">
              <span className="text-red-400 font-bold">VIDAS:</span>
              <span
                className={`px-2 py-0.5 rounded font-mono font-bold ${
                  stats.lives === 1
                    ? 'bg-red-950 text-red-400 border border-red-600 animate-pulse'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                }`}
              >
                {stats.lives}
              </span>
            </div>

            {/* Visual Hearts */}
            <div className="flex items-center gap-1">
              {renderLifeHearts()}
            </div>

            {/* Warning for last life or difficulty badge */}
            {stats.lives === 1 ? (
              <span className="hidden sm:inline-block text-[9px] text-red-400 animate-bounce font-bold tracking-wider">
                ⚠️ ÚLTIMA VIDA!
              </span>
            ) : stats.difficulty ? (
              <span
                className={`hidden md:inline-block text-[8px] font-['Press_Start_2P',monospace] px-2 py-0.5 rounded border uppercase ${
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
          </div>

          {/* Leaderboard & Cheat Triggers */}
          <div className="flex items-center gap-2">
            {isCheatActive && onOpenCheatMenu && (
              <button
                type="button"
                onClick={onOpenCheatMenu}
                className="px-2.5 py-1 rounded bg-red-600/30 hover:bg-red-600/40 text-red-300 border border-red-500/50 hover:border-red-400 transition flex items-center gap-1.5 cursor-pointer text-[9px] sm:text-[10px] font-bold"
              >
                <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span>PÁGINA DO DESENVOLVEDOR</span>
              </button>
            )}

            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 transition flex items-center gap-1.5 cursor-pointer text-[9px] sm:text-[10px]"
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
