/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Medal, X, PlusCircle, Check, Trash2, Crown } from 'lucide-react';
import {
  getHighScores,
  getTopScore,
  getLastPlayerName,
  clearHighScores,
  ScoreEntry,
  saveNewScore,
} from '../game/scoreboard.ts';
import { GameDifficulty, PlayerCharacter } from '../game/types.ts';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScore?: number;
  currentCoins?: number;
  currentWorld?: string;
  currentRunId?: string;
  currentCharacter?: PlayerCharacter;
  currentDifficulty?: GameDifficulty;
  isCheatActive?: boolean;
  isCustomLevel?: boolean;
  onScoresCleared?: () => void;
  onScoreSaved?: (rank: number | null) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentScore = 0,
  currentCoins = 0,
  currentWorld = '1-1',
  currentRunId,
  currentCharacter = 'mario',
  currentDifficulty = 'normal',
  isCheatActive = false,
  isCustomLevel = false,
  onScoresCleared,
  onScoreSaved,
}) => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [topScore, setTopScore] = useState<number>(0);
  const [playerName, setPlayerName] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [savedRank, setSavedRank] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentList = getHighScores();
      setScores(currentList);
      setTopScore(getTopScore());
      const existingRun = currentRunId ? currentList.find(s => s.id === currentRunId) : undefined;
      setPlayerName(existingRun?.name || getLastPlayerName() || '');
      setHasSaved(false);
      setSavedRank(existingRun ? currentList.indexOf(existingRun) + 1 : null);
      setConfirmClear(false);
    }
  }, [isOpen, currentRunId]);

  if (!isOpen) return null;

  const isRunAlreadyInRanking = Boolean(currentRunId && scores.some(s => s.id === currentRunId));

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || isCheatActive || isCustomLevel || currentScore <= 0) return;
    const result = saveNewScore(currentScore, currentCoins, currentWorld, playerName.trim(), {
      id: currentRunId,
      character: currentCharacter,
      difficulty: currentDifficulty,
    });
    setScores(result.scores);
    setTopScore(getTopScore());
    setSavedRank(result.rank);
    setHasSaved(true);
    onScoreSaved?.(result.rank);
  };

  const handleClearRanking = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearHighScores();
    setScores([]);
    setTopScore(0);
    setHasSaved(false);
    setSavedRank(null);
    setConfirmClear(false);
    onScoresCleared?.();
  };

  const getRankBadge = (rank: number) => {
    if (rank === 0) return <Medal className="w-5 h-5 text-amber-400 fill-amber-400" />;
    if (rank === 1) return <Medal className="w-5 h-5 text-stone-300 fill-stone-300" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-amber-700 fill-amber-700" />;
    return <span className="text-xs font-mono text-stone-500 font-bold">#{rank + 1}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-stone-900 border-2 border-amber-500/60 rounded-xl shadow-2xl p-5 sm:p-6 text-stone-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-400 animate-bounce" />
            <div>
              <h2 className="text-sm sm:text-base font-['Press_Start_2P',monospace] text-amber-400">
                RANKING LOCAL
              </h2>
              <span className="text-[10px] text-stone-400">HALL DA FAMA • SALVO NO NAVEGADOR</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* All-time Local High Score Banner */}
        <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-amber-950/60 via-stone-950 to-amber-950/60 border border-amber-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400 fill-amber-400/30" />
            <div>
              <div className="text-[9px] font-['Press_Start_2P',monospace] text-amber-300">
                PONTUAÇÃO MÁXIMA
              </div>
              <div className="text-[10px] text-stone-400 font-mono">Recorde pessoal salvo</div>
            </div>
          </div>
          <div className="font-['Press_Start_2P',monospace] text-sm sm:text-base text-amber-300 tabular-nums">
            {topScore.toLocaleString()} <span className="text-[10px] text-amber-500">PTS</span>
          </div>
        </div>

        {/* Cheat / Custom Level Warning: Cannot save record! */}
        {isCheatActive ? (
          <div className="my-4 p-3.5 bg-red-950/80 border-2 border-red-600 rounded-lg text-center space-y-1.5 animate-in zoom-in-95">
            <span className="block font-['Press_Start_2P',monospace] text-xs text-red-400 animate-pulse tracking-wider">
              CHEAT USE
            </span>
            <p className="text-[11px] text-red-200">
              A página do desenvolvedor foi utilizada nesta partida.
            </p>
            <p className="text-[10px] text-amber-300 font-bold">
              Salvamento de novos recordes bloqueado!
            </p>
          </div>
        ) : isCustomLevel ? (
          <div className="my-4 p-3.5 bg-sky-950/80 border-2 border-sky-500 rounded-lg text-center space-y-1.5 animate-in zoom-in-95">
            <span className="block font-['Press_Start_2P',monospace] text-xs text-sky-300 tracking-wider">
              EDITOR DE FASES
            </span>
            <p className="text-[11px] text-sky-100">
              Você está jogando uma fase criada no Editor de Fases.
            </p>
            <p className="text-[10px] text-amber-300 font-bold">
              Fases do editor não registram recordes no ranking!
            </p>
          </div>
        ) : (
          currentScore > 0 && (
            <form
              onSubmit={handleSaveCurrent}
              className="my-4 p-3 bg-stone-800/80 border border-amber-500/40 rounded-lg space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold">
                <span>
                  {isRunAlreadyInRanking
                    ? 'Atualizar nome no ranking desta partida:'
                    : 'Registrar pontuação da partida:'}
                </span>
                <span className="text-white font-mono text-xs">{currentScore.toLocaleString()} pts</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={12}
                  placeholder="SEU NOME"
                  value={playerName}
                  onChange={e => {
                    setPlayerName(e.target.value.toUpperCase());
                    if (hasSaved) setHasSaved(false);
                  }}
                  className="flex-1 bg-stone-950 border border-stone-700 rounded px-2.5 py-1.5 text-xs font-mono uppercase text-white tracking-wider focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!playerName.trim()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-bold rounded flex items-center gap-1 font-['Press_Start_2P',monospace] text-[9px] cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  {isRunAlreadyInRanking ? 'ATUALIZAR' : 'SALVAR'}
                </button>
              </div>
            </form>
          )
        )}

        {hasSaved && (
          <div className="my-3 p-2.5 bg-emerald-950/80 border border-emerald-600 rounded text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              {savedRank !== null
                ? `Recorde salvo no Ranking Local (#${savedRank} lugar)!`
                : 'Pontuação registrada (fora do Top 10 atual).'}
            </span>
          </div>
        )}

        {/* High Scores List */}
        <div className="space-y-1.5 my-4">
          <div className="grid grid-cols-12 text-[8px] sm:text-[9px] font-['Press_Start_2P',monospace] text-stone-400 px-2 pb-1.5 border-b border-stone-800">
            <span className="col-span-2">POS</span>
            <span className="col-span-4">JOGADOR</span>
            <span className="col-span-2 text-right">MOE</span>
            <span className="col-span-2 text-right">FASE</span>
            <span className="col-span-2 text-right">PTS</span>
          </div>

          {scores.length === 0 ? (
            <div className="py-8 px-4 text-center bg-stone-950/60 border border-stone-800 rounded-lg space-y-2">
              <Trophy className="w-8 h-8 text-stone-600 mx-auto" />
              <p className="text-xs text-stone-300 font-mono">
                Nenhum recorde registrado ainda.
              </p>
              <p className="text-[11px] text-stone-500">
                Jogue uma partida para registrar sua pontuação máxima no ranking local!
              </p>
            </div>
          ) : (
            scores.map((s, idx) => {
              const isCurrentRun = Boolean(currentRunId && s.id === currentRunId);
              return (
                <div
                  key={s.id || idx}
                  className={`grid grid-cols-12 items-center px-2 py-2 rounded font-mono text-xs transition ${
                    isCurrentRun
                      ? 'bg-emerald-500/15 border border-emerald-400/60 text-emerald-200 font-bold'
                      : idx === 0
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold'
                      : 'bg-stone-800/40 text-stone-200'
                  }`}
                >
                  <div className="col-span-2 flex items-center">{getRankBadge(idx)}</div>
                  <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                    {s.character && (
                      <span
                        className={`shrink-0 px-1 py-0.2 rounded text-[9px] font-bold ${
                          s.character === 'wazzima'
                            ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-600/50'
                            : 'bg-red-900/80 text-red-200 border border-red-600/50'
                        }`}
                        title={s.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario'}
                      >
                        {s.character === 'wazzima' ? 'W' : 'M'}
                      </span>
                    )}
                    <span className="font-bold tracking-wide truncate">{s.name}</span>
                  </div>
                  <div className="col-span-2 text-right text-amber-300/80 text-[11px] tabular-nums">
                    {s.coins}
                  </div>
                  <div className="col-span-2 text-right text-stone-400 text-[11px]">{s.world}</div>
                  <div className="col-span-2 text-right text-amber-400 font-bold tabular-nums">
                    {s.score.toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-800 flex flex-wrap justify-between items-center gap-2 text-xs">
          {(scores.length > 0 || topScore > 0) ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearRanking}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition cursor-pointer ${
                  confirmClear
                    ? 'bg-red-600 hover:bg-red-500 text-white font-bold'
                    : 'bg-stone-800 hover:bg-stone-700 text-red-400 border border-red-900/60'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmClear ? 'Confirmar limpeza?' : 'Limpar Ranking'}
              </button>
              {confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1.5 text-[11px] text-stone-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-stone-500">Top 10 salvo em localStorage</span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded-lg font-medium cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
