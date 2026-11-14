/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, Music, Tv, RotateCcw, X, Gamepad2, Keyboard, Compass, ShieldAlert, Monitor, Sparkles } from 'lucide-react';
import { LevelData, GameDifficulty, ResolutionScale } from '../game/types.ts';
import { createWorld1_1, createSecretVault, createWorld1_2, createWorld2_2, createWorld1_4, createEndlessLevel } from '../game/levels.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLevel: (level: LevelData) => void;
  onRestart: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  crtFilter: boolean;
  onToggleCrt: () => void;
  difficulty: GameDifficulty;
  onSelectDifficulty: (diff: GameDifficulty) => void;
  resolutionScale: ResolutionScale;
  onSelectResolution: (scale: ResolutionScale) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSelectLevel,
  onRestart,
  isMuted,
  onToggleMute,
  musicEnabled,
  onToggleMusic,
  volume,
  onVolumeChange,
  crtFilter,
  onToggleCrt,
  difficulty,
  onSelectDifficulty,
  resolutionScale,
  onSelectResolution,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-stone-900 border-2 border-stone-600 rounded-xl shadow-2xl p-6 text-stone-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-amber-400" />
            <h2 className="text-base sm:text-lg font-['Press_Start_2P',monospace] text-amber-400">
              CONFIGURAÇÕES
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content sections */}
        <div className="space-y-6 pt-4 text-xs sm:text-sm">
          {/* Level Selector */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Compass className="w-4 h-4 text-amber-400" />
              <h3 className="font-['Press_Start_2P',monospace] text-[11px] text-stone-200">
                ESCOLHER FASE
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectLevel(createWorld1_1());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500 font-medium text-left transition flex flex-col"
              >
                <span className="font-bold text-amber-400">Mundo 1-1</span>
                <span className="text-[10px] text-stone-400">Superfície clássica do NES</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectLevel(createSecretVault());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500 font-medium text-left transition flex flex-col"
              >
                <span className="font-bold text-sky-400">Cofre Secreto</span>
                <span className="text-[10px] text-stone-400">Moedas do cano subterrâneo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectLevel(createWorld1_2());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500 font-medium text-left transition flex flex-col"
              >
                <span className="font-bold text-blue-400">Mundo 1-2</span>
                <span className="text-[10px] text-stone-400">Cavernas Subterrâneas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectLevel(createWorld2_2());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-cyan-400 font-medium text-left transition flex flex-col"
              >
                <span className="font-bold text-cyan-400">Mundo 2-2 (Água)</span>
                <span className="text-[10px] text-stone-400">Fase Aquática Submarina</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectLevel(createWorld1_4());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-red-500 font-medium text-left transition flex flex-col"
              >
                <span className="font-bold text-red-400">Mundo 1-4 (Castelo)</span>
                <span className="text-[10px] text-stone-400">Lava, Ponte e Rei Koopa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectLevel(createEndlessLevel(Date.now(), 1));
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-emerald-400 font-medium text-left transition flex flex-col"
              >
                <span className="font-bold text-emerald-400">Modo Sem Fim (Cíclico)</span>
                <span className="text-[10px] text-stone-400">1 Overworld → 2 Caverna → 3 Água → 4 Castelo</span>
              </button>
            </div>
          </div>

          {/* Audio Controls */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <h3 className="font-['Press_Start_2P',monospace] text-[11px] text-stone-200">
                ÁUDIO RETRÔ
              </h3>
            </div>
            <div className="space-y-3 bg-stone-800/60 p-3 rounded-lg border border-stone-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="flex items-center gap-2 text-stone-200 font-medium">
                    <Music className="w-4 h-4 text-amber-400" />
                    Música de Fundo
                  </span>
                  <span className="text-[10px] text-stone-400">Trilha sonora chiptune sintetizada em 8-bit</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleMusic}
                  className={`px-3 py-1.5 rounded text-[11px] font-bold font-['Press_Start_2P',monospace] text-[9px] transition ${
                    musicEnabled ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950' : 'bg-stone-700 hover:bg-stone-600 text-stone-300'
                  }`}
                >
                  {musicEnabled ? 'LIGADA' : 'DESLIGADA'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-700/60">
                <span className="flex items-center gap-2 text-stone-300">
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                  Efeitos Sonoros (SFX)
                </span>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`px-3 py-1 rounded text-[11px] font-bold ${
                    !isMuted ? 'bg-emerald-600 text-white' : 'bg-stone-700 text-stone-400'
                  }`}
                >
                  {!isMuted ? 'LIGADO' : 'MUDO'}
                </button>
              </div>

              <div className="pt-2">
                <div className="flex justify-between text-xs text-stone-400 mb-1">
                  <span>Volume Geral</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={e => onVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Dificuldade do Jogo */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h3 className="font-['Press_Start_2P',monospace] text-[11px] text-stone-200">
                SELECIONAR DIFICULDADE
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onSelectDifficulty('easy')}
                className={`p-3 rounded-lg border font-medium text-left transition flex flex-col justify-between ${
                  difficulty === 'easy'
                    ? 'bg-emerald-950/80 border-emerald-500 text-white ring-2 ring-emerald-500/50'
                    : 'bg-stone-800/80 hover:bg-stone-700/80 border-stone-700 text-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
                    <span>🌱 Fácil</span>
                  </div>
                  <p className="text-[10px] text-stone-300 mt-1 leading-snug">
                    5 vidas, começa como Super Mario e +80s de tempo.
                  </p>
                </div>
                {difficulty === 'easy' && (
                  <span className="mt-2 text-[9px] font-['Press_Start_2P',monospace] text-emerald-300">
                    SELECIONADO
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectDifficulty('normal')}
                className={`p-3 rounded-lg border font-medium text-left transition flex flex-col justify-between ${
                  difficulty === 'normal'
                    ? 'bg-amber-950/80 border-amber-500 text-white ring-2 ring-amber-500/50'
                    : 'bg-stone-800/80 hover:bg-stone-700/80 border-stone-700 text-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                    <span>⭐ Normal</span>
                  </div>
                  <p className="text-[10px] text-stone-300 mt-1 leading-snug">
                    3 vidas, Mario pequeno inicial e tempo padrão original.
                  </p>
                </div>
                {difficulty === 'normal' && (
                  <span className="mt-2 text-[9px] font-['Press_Start_2P',monospace] text-amber-300">
                    SELECIONADO
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectDifficulty('hard')}
                className={`p-3 rounded-lg border font-medium text-left transition flex flex-col justify-between ${
                  difficulty === 'hard'
                    ? 'bg-red-950/80 border-red-500 text-white ring-2 ring-red-500/50'
                    : 'bg-stone-800/80 hover:bg-stone-700/80 border-stone-700 text-stone-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-red-400 text-xs">
                    <span>🔥 Difícil</span>
                  </div>
                  <p className="text-[10px] text-stone-300 mt-1 leading-snug">
                    Apenas 1 vida, sem margem para erro e relógio acelerado.
                  </p>
                </div>
                {difficulty === 'hard' && (
                  <span className="mt-2 text-[9px] font-['Press_Start_2P',monospace] text-red-300">
                    SELECIONADO
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Resolução e Escala da Tela */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-amber-400" />
              <h3 className="font-['Press_Start_2P',monospace] text-[11px] text-stone-200">
                RESOLUÇÃO / ESCALA DA TELA
              </h3>
            </div>
            <div className="bg-stone-800/60 p-3 rounded-lg border border-stone-800 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-stone-300 font-medium">Escala do Canvas</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {resolutionScale === 'fit' ? 'Ajustar à Tela (4:3)' : `${resolutionScale} (${resolutionScale === '0.5x' ? '128x120' : resolutionScale === '0.75x' ? '192x180' : resolutionScale === '1x' ? '256x240 NATIVO' : resolutionScale === '1.25x' ? '320x300' : resolutionScale === '1.5x' ? '384x360' : '512x480 2X'})`}
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-[10px] font-mono">
                  {(['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x', 'fit'] as ResolutionScale[]).map(scale => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => onSelectResolution(scale)}
                      className={`py-1.5 px-1 rounded text-center transition font-bold ${
                        resolutionScale === scale
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-stone-900 hover:bg-stone-700 text-stone-300 border border-stone-700'
                      }`}
                    >
                      {scale.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* CRT Scanlines toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-700/60">
                <div>
                  <div className="font-medium text-stone-200">Filtro de TV CRT / Scanlines</div>
                  <div className="text-[10px] text-stone-400">Linhas de varredura e brilho vintage</div>
                </div>
                <button
                  type="button"
                  onClick={onToggleCrt}
                  className={`px-3 py-1 rounded text-[11px] font-bold ${
                    crtFilter ? 'bg-amber-600 text-white' : 'bg-stone-700 text-stone-400'
                  }`}
                >
                  {crtFilter ? 'ATIVO' : 'DESATIVO'}
                </button>
              </div>
            </div>
          </div>

          {/* Controls Reference */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Keyboard className="w-4 h-4 text-amber-400" />
              <h3 className="font-['Press_Start_2P',monospace] text-[11px] text-stone-200">
                COMANDOS DO TECLADO
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-stone-300 bg-stone-800/60 p-3 rounded-lg border border-stone-800 text-xs">
              <div>
                <span className="font-bold text-amber-400">Setas / W A S D</span>
                <p className="text-[10px] text-stone-400">Mover / Agachar / Entrar no Cano</p>
              </div>
              <div>
                <span className="font-bold text-amber-400">Espaço / Z / W</span>
                <p className="text-[10px] text-stone-400">Pular (segure para pular alto)</p>
              </div>
              <div>
                <span className="font-bold text-amber-400">Shift / X / K</span>
                <p className="text-[10px] text-stone-400">Correr / Lançar Bola de Fogo</p>
              </div>
              <div>
                <span className="font-bold text-amber-400">P / Esc</span>
                <p className="text-[10px] text-stone-400">Pausar jogo</p>
              </div>
            </div>
          </div>

          {/* Quick Restart */}
          <div className="pt-2 flex justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onRestart();
                onClose();
              }}
              className="flex-1 py-2.5 rounded-lg bg-red-800 hover:bg-red-700 text-white font-['Press_Start_2P',monospace] text-[10px] flex items-center justify-center gap-2 shadow"
            >
              <RotateCcw className="w-4 h-4" />
              REINICIAR JOGO
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-white font-medium text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
