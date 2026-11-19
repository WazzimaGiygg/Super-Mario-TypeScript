/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Coins,
  Crown,
  Flame,
  Globe2,
  Hammer,
  Heart,
  RotateCcw,
  Star,
  Swords,
  Timer,
  X,
} from 'lucide-react';
import {
  AchievementBadgeKind,
  AchievementProgressView,
} from '../game/achievements.ts';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: AchievementProgressView[];
  summary: {
    unlockedCount: number;
    totalCount: number;
    totalRewardPoints: number;
    totalRewardLives: number;
  };
  onResetAchievements: () => void;
}

const renderBadgeIcon = (badge: AchievementBadgeKind, unlocked: boolean) => {
  const colorClass = unlocked ? 'text-amber-300' : 'text-stone-400';
  switch (badge) {
    case 'goomba':
      return <Award className={`w-5 h-5 ${colorClass}`} />;
    case 'speedrun':
      return <Timer className={`w-5 h-5 ${unlocked ? 'text-sky-300' : 'text-stone-400'}`} />;
    case 'combat':
      return <Swords className={`w-5 h-5 ${unlocked ? 'text-rose-300' : 'text-stone-400'}`} />;
    case 'coin':
      return <Coins className={`w-5 h-5 ${colorClass}`} />;
    case 'brick':
      return <Hammer className={`w-5 h-5 ${unlocked ? 'text-orange-300' : 'text-stone-400'}`} />;
    case 'wcoin':
      return <Star className={`w-5 h-5 ${colorClass}`} />;
    case 'boss':
      return <Flame className={`w-5 h-5 ${unlocked ? 'text-red-400' : 'text-stone-400'}`} />;
    case 'world':
      return <Globe2 className={`w-5 h-5 ${unlocked ? 'text-emerald-300' : 'text-stone-400'}`} />;
  }
};

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  achievements,
  summary,
  onResetAchievements,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!isOpen) setConfirmReset(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const pct =
    summary.totalCount > 0
      ? Math.round((summary.unlockedCount / summary.totalCount) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conquistas e Recompensas"
        className="relative w-full max-w-2xl bg-stone-900 border-2 border-amber-500/70 rounded-2xl shadow-2xl p-4 sm:p-6 text-stone-100 max-h-[90vh] flex flex-col gap-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Award className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-['Press_Start_2P',monospace] text-sm sm:text-base text-amber-400 tracking-wide">
                CONQUISTAS
              </h2>
              <p className="mt-1 text-xs font-mono text-stone-400 tabular-nums">
                {summary.unlockedCount}/{summary.totalCount} desbloqueadas ({pct}%) · +
                {summary.totalRewardPoints.toLocaleString()} pts · +{summary.totalRewardLives}{' '}
                {summary.totalRewardLives === 1 ? 'vida' : 'vidas'} recebidas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar conquistas"
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overall Progress Track */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-3 shrink-0">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-stone-300 font-semibold flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Progresso Geral das Metas
            </span>
            <span className="text-amber-300 font-bold tabular-nums">
              {summary.unlockedCount} / {summary.totalCount}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-stone-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Achievements List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {achievements.map(ach => {
            const ratio = Math.min(100, Math.round((ach.progress / Math.max(1, ach.target)) * 100));
            return (
              <div
                key={ach.id}
                className={`rounded-xl border p-3.5 transition ${
                  ach.unlocked
                    ? 'bg-emerald-950/35 border-emerald-500/60'
                    : 'bg-stone-950/70 border-stone-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                      ach.unlocked
                        ? 'bg-amber-500/15 border-amber-400/70'
                        : 'bg-stone-900 border-stone-700'
                    }`}
                  >
                    {renderBadgeIcon(ach.badge, ach.unlocked)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-['Press_Start_2P',monospace] text-[11px] sm:text-xs text-white truncate">
                          {ach.title}
                        </h3>
                        {ach.unlocked && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-mono font-bold tabular-nums shrink-0 ${
                          ach.unlocked ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {ach.progress}/{ach.target}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-stone-300 leading-snug">
                      {ach.description}
                    </p>

                    <div className="mt-2 w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          ach.unlocked ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-amber-300 font-semibold flex items-center gap-1.5 tabular-nums">
                        <span>Recompensa: +{ach.rewardPoints.toLocaleString()} PTS</span>
                        {ach.rewardLives > 0 && (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            · <Heart className="w-3 h-3 fill-rose-500 text-rose-500" /> +
                            {ach.rewardLives} {ach.rewardLives === 1 ? 'Vida' : 'Vidas'}
                          </span>
                        )}
                      </span>
                      {ach.unlockedAt && (
                        <span className="text-emerald-300/90 tabular-nums">
                          Desbloqueada em {new Date(ach.unlockedAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-800 pt-3 shrink-0">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
              <span>Zerar Conquistas</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetAchievements();
                  setConfirmReset(false);
                }}
                className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-mono font-bold cursor-pointer whitespace-nowrap shrink-0 transition"
              >
                Confirmar Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-mono cursor-pointer whitespace-nowrap shrink-0 transition"
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-['Press_Start_2P',monospace] text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};
