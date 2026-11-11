/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Medal, X, RotateCcw, PlusCircle, Check } from 'lucide-react';
import { getHighScores, ScoreEntry, saveNewScore } from '../game/scoreboard.ts';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScore?: number;
  currentCoins?: number;
  currentWorld?: string;
  isCheatActive?: boolean;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentScore = 0,
  currentCoins = 0,
  currentWorld = '1-1',
  isCheatActive = false,
}) => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setScores(getHighScores());
      setHasSaved(false);
      setPlayerName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || hasSaved || isCheatActive) return;
    saveNewScore(currentScore, currentCoins, currentWorld, playerName.trim());
    setScores(getHighScores());
    setHasSaved(true);
  };

  const getRankBadge = (rank: number) => {
    if (rank === 0) return <Medal className="w-5 h-5 text-amber-400 fill-amber-400" />;
    if (rank === 1) return <Medal className="w-5 h-5 text-stone-300 fill-stone-300" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-amber-700 fill-amber-700" />;
    return <span className="text-xs font-mono text-stone-500 font-bold">#{rank + 1}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-stone-900 border-2 border-amber-500/60 rounded-xl shadow-2xl p-6 text-stone-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400 animate-bounce" />
            <div>
              <h2 className="text-sm sm:text-base font-['Press_Start_2P',monospace] text-amber-400">
                PLACAR DE RECORDES
              </h2>
              <span className="text-[10px] text-stone-400">HALL DA FAMA SUPER MARIO</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cheat Use Warning: Cannot save record! */}
        {isCheatActive ? (
          <div className="my-4 p-3.5 bg-red-950/80 border-2 border-red-600 rounded-lg text-center space-y-1.5 animate-in zoom-in-95">
            <span className="block font-['Press_Start_2P',monospace] text-xs text-red-400 animate-pulse tracking-wider">
              CHEAT USE
            </span>
            <p className="text-[11px] text-red-200">
              A página do desenvolvedor foi utilizada nesta partida.
            </p>
            <p className="text-[10px] text-amber-300 font-bold">
              🚫 Salvamento de novos recordes bloqueado!
            </p>
          </div>
        ) : (
          /* Save Current Score Prompt */
          currentScore > 0 && !hasSaved && (
            <form onSubmit={handleSaveCurrent} className="my-4 p-3 bg-stone-800/80 border border-amber-500/40 rounded-lg space-y-2">
              <div className="text-[11px] text-amber-300 font-bold">
                Salvar sua pontuação atual: <span className="text-white font-mono text-xs">{currentScore} pts</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={8}
                  placeholder="SEU NOME"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value.toUpperCase())}
                  className="flex-1 bg-stone-950 border border-stone-700 rounded px-2.5 py-1 text-xs font-mono uppercase text-white tracking-wider focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!playerName.trim()}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 text-xs font-bold rounded flex items-center gap-1 font-['Press_Start_2P',monospace] text-[9px]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  SALVAR
                </button>
              </div>
            </form>
          )
        )}

        {hasSaved && (
          <div className="my-3 p-2 bg-emerald-950/80 border border-emerald-600 rounded text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Recorde registrado com sucesso no placar!</span>
          </div>
        )}

        {/* High Scores List */}
        <div className="space-y-2 my-4">
          <div className="grid grid-cols-12 text-[9px] font-['Press_Start_2P',monospace] text-stone-400 px-2 pb-1 border-b border-stone-800">
            <span className="col-span-2">POS</span>
            <span className="col-span-4">NOME</span>
            <span className="col-span-3 text-right">PONTOS</span>
            <span className="col-span-3 text-right">FASE</span>
          </div>

          {scores.map((s, idx) => (
            <div
              key={s.id || idx}
              className={`grid grid-cols-12 items-center px-2 py-2 rounded font-mono text-xs ${
                idx === 0
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold'
                  : 'bg-stone-800/40 text-stone-200'
              }`}
            >
              <div className="col-span-2 flex items-center">{getRankBadge(idx)}</div>
              <div className="col-span-4 font-bold tracking-wide truncate">{s.name}</div>
              <div className="col-span-3 text-right text-amber-400 font-bold tabular-nums">
                {s.score.toLocaleString()}
              </div>
              <div className="col-span-3 text-right text-stone-400 text-[11px]">{s.world}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-stone-800 flex justify-between items-center text-xs">
          <span className="text-[10px] text-stone-500">Salvo no navegador</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded-lg font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
