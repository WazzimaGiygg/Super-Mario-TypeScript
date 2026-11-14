/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Flame, Shield, Sparkles, Heart, PlusCircle, X, Check } from 'lucide-react';
import { MarioPower } from '../game/types.ts';

interface CheatMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  infiniteLives: boolean;
  onToggleInfiniteLives: () => void;
  onSetPowerUp: (power: MarioPower | 'star') => void;
  onAddScore: (points: number) => void;
}

export const CheatMenuModal: React.FC<CheatMenuModalProps> = ({
  isOpen,
  onClose,
  infiniteLives,
  onToggleInfiniteLives,
  onSetPowerUp,
  onAddScore,
}) => {
  const [customPoints, setCustomPoints] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 2000);
  };

  const handleCustomScore = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseInt(customPoints, 10);
    if (!isNaN(pts) && pts > 0) {
      onAddScore(pts);
      showSuccess(`+${pts.toLocaleString()} pontos adicionados!`);
      setCustomPoints('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-md bg-stone-900 border-2 border-red-600 rounded-xl shadow-2xl p-6 text-stone-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-red-950">
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-red-500 animate-pulse" />
            <div>
              <h2 className="text-sm sm:text-base font-['Press_Start_2P',monospace] text-red-400">
                PÁGINA DO DESENVOLVEDOR
              </h2>
              <span className="text-[10px] text-amber-400 font-mono font-bold">MODO DEV ATIVO</span>
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

        {/* Warning Badge: CHEAT USE */}
        <div className="my-3 px-3 py-2 bg-red-950/60 border border-red-700/60 rounded text-center space-y-0.5">
          <span className="block text-red-400 font-['Press_Start_2P',monospace] text-[10px] animate-pulse">
            CHEAT USE
          </span>
          <p className="text-[10px] text-stone-300">
            Modo de desenvolvimento ativado. A gravação de recordes no placar foi desabilitada.
          </p>
        </div>

        {/* Success toast */}
        {successMessage && (
          <div className="my-2 px-3 py-1.5 bg-emerald-950 border border-emerald-500 rounded text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Cheat Controls */}
        <div className="space-y-4 pt-2">
          {/* 1. Vidas Infinitas */}
          <div className="bg-stone-800/80 p-3.5 rounded-lg border border-stone-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                <div>
                  <h3 className="font-['Press_Start_2P',monospace] text-[10px] text-stone-200">
                    VIDAS INFINITAS
                  </h3>
                  <p className="text-[10px] text-stone-400">99 vidas e imunidade a dano fatal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleInfiniteLives();
                  showSuccess(infiniteLives ? 'Vidas normais restauradas' : 'Vidas infinitas ativadas!');
                }}
                className={`px-3 py-1.5 rounded font-['Press_Start_2P',monospace] text-[10px] font-bold transition ${
                  infiniteLives ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'bg-stone-700 text-stone-400'
                }`}
              >
                {infiniteLives ? 'ATIVO' : 'DESATIVO'}
              </button>
            </div>
          </div>

          {/* 2. Selecionar Power-Up */}
          <div className="bg-stone-800/80 p-3.5 rounded-lg border border-stone-700 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-['Press_Start_2P',monospace] text-[10px] text-stone-200">
                ESCOLHER POWER-UP
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  onSetPowerUp('small');
                  showSuccess('Mario Pequeno selecionado');
                }}
                className="p-2 rounded bg-stone-900 hover:bg-stone-700 border border-stone-700 text-left font-medium transition"
              >
                <span className="block text-stone-300 font-bold">🍄 Pequeno</span>
                <span className="text-[10px] text-stone-400">Mario inicial</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSetPowerUp('super');
                  showSuccess('Super Mario (Cogumelo) ativado!');
                }}
                className="p-2 rounded bg-stone-900 hover:bg-stone-700 border border-stone-700 text-left font-medium transition"
              >
                <span className="block text-red-400 font-bold">🍄 Super Mario</span>
                <span className="text-[10px] text-stone-400">Quebra tijolos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSetPowerUp('fire');
                  showSuccess('Fire Mario ativado! Pressione B para atirar.');
                }}
                className="p-2 rounded bg-stone-900 hover:bg-stone-700 border border-stone-700 text-left font-medium transition"
              >
                <span className="block text-orange-400 font-bold">🔥 Fire Mario</span>
                <span className="text-[10px] text-stone-400">Bolas de fogo quicantes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSetPowerUp('tanooki');
                  showSuccess('Tanooki Mario ativado! B = Giro de Cauda, Pulo = Flutuar, Baixo = Estátua!');
                }}
                className="p-2 rounded bg-stone-900 hover:bg-stone-700 border border-amber-500/60 text-left font-medium transition shadow-md shadow-amber-900/30"
              >
                <span className="block text-amber-400 font-bold">🦝 Tanooki Suit</span>
                <span className="text-[10px] text-amber-200/80">Giro 360°, flutuar e estátua</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSetPowerUp('femboy');
                  showSuccess('Power-up Femboy ativado! Pulo 2x e 2 bolas brancas ao cair no chão!');
                }}
                className="p-2 rounded bg-stone-900 hover:bg-stone-700 border border-pink-500/60 text-left font-medium transition shadow-md shadow-pink-900/30"
              >
                <span className="block text-pink-400 font-bold">🎀 Femboy</span>
                <span className="text-[10px] text-pink-200/80">Pulo 2x + 2 bolas brancas ao pousar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSetPowerUp('star');
                  showSuccess('Estrela de Invencibilidade ativada!');
                }}
                className="p-2 rounded bg-stone-900 hover:bg-stone-700 border border-stone-700 text-left font-medium transition"
              >
                <span className="block text-amber-300 font-bold">⭐ Estrela</span>
                <span className="text-[10px] text-stone-400">Invulnerabilidade total</span>
              </button>
            </div>
          </div>

          {/* 3. Adicionar Pontuação */}
          <div className="bg-stone-800/80 p-3.5 rounded-lg border border-stone-700 space-y-2">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="font-['Press_Start_2P',monospace] text-[10px] text-stone-200">
                ADICIONAR PONTOS
              </h3>
            </div>

            {/* Quick buttons */}
            <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono font-bold">
              <button
                type="button"
                onClick={() => {
                  onAddScore(1000);
                  showSuccess('+1.000 pontos!');
                }}
                className="py-1.5 rounded bg-stone-900 hover:bg-stone-700 border border-stone-700 text-amber-300 transition"
              >
                +1K
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddScore(10000);
                  showSuccess('+10.000 pontos!');
                }}
                className="py-1.5 rounded bg-stone-900 hover:bg-stone-700 border border-stone-700 text-amber-300 transition"
              >
                +10K
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddScore(50000);
                  showSuccess('+50.000 pontos!');
                }}
                className="py-1.5 rounded bg-stone-900 hover:bg-stone-700 border border-stone-700 text-amber-300 transition"
              >
                +50K
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddScore(100000);
                  showSuccess('+100.000 pontos!');
                }}
                className="py-1.5 rounded bg-stone-900 hover:bg-stone-700 border border-stone-700 text-amber-300 transition"
              >
                +100K
              </button>
            </div>

            {/* Custom points input */}
            <form onSubmit={handleCustomScore} className="flex gap-2 pt-1">
              <input
                type="number"
                min="1"
                placeholder="Valor exato (ex: 25000)"
                value={customPoints}
                onChange={e => setCustomPoints(e.target.value)}
                className="flex-1 bg-stone-950 border border-stone-700 rounded px-2.5 py-1 text-xs font-mono text-white tracking-wider focus:outline-hidden focus:border-red-500"
              />
              <button
                type="submit"
                disabled={!customPoints}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-1 font-['Press_Start_2P',monospace] text-[9px]"
              >
                + PONTOS
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 border-t border-stone-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded-lg font-medium text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
