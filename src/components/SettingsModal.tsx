/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, Music, RotateCcw, X, Gamepad2, Keyboard, Compass, ShieldAlert, Monitor, Maximize2, Minimize2, Hammer, Crown, Map as MapIcon, Bug, Tv, FolderOpen, Lock } from 'lucide-react';
import { LevelData, GameDifficulty, ResolutionScale } from '../game/types.ts';
import { createWorld1_1, createSecretVault, createWorld1_2, createWorld2_2, createWorldGhostHouse, createWorld1_4, createEndlessLevel } from '../game/levels.ts';

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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  touchOverlayOnCanvas?: boolean;
  onToggleTouchOverlay?: () => void;
  onOpenLevelEditor?: () => void;
  onStartSingleplayer?: () => void;
  onStartSmwWorldMap?: () => void;
  onLoadSmwWorldProgress?: () => void;
  smwSavedSlotsCount?: number;
  isDebugMode?: boolean;
  onToggleDebugMode?: () => void;
  smartTvMode?: boolean;
  onToggleSmartTvMode?: () => void;
  smartTvJumpWithUp?: boolean;
  onToggleSmartTvJumpWithUp?: () => void;
  smartTvAutoRun?: boolean;
  onToggleSmartTvAutoRun?: () => void;
  isModeAndEditorLocked?: boolean;
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
  isFullscreen = false,
  onToggleFullscreen,
  touchOverlayOnCanvas = true,
  onToggleTouchOverlay,
  onOpenLevelEditor,
  onStartSingleplayer,
  onStartSmwWorldMap,
  onLoadSmwWorldProgress,
  smwSavedSlotsCount = 0,
  isDebugMode = false,
  onToggleDebugMode,
  smartTvMode = false,
  onToggleSmartTvMode,
  smartTvJumpWithUp = true,
  onToggleSmartTvJumpWithUp,
  smartTvAutoRun = false,
  onToggleSmartTvAutoRun,
  isModeAndEditorLocked = false,
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
              {isModeAndEditorLocked && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Bloqueado em partida
                </span>
              )}
            </div>
            {isModeAndEditorLocked && (
              <div className="mb-2.5 px-3 py-2 rounded-lg bg-amber-950/55 border border-amber-500/40 text-[11px] text-amber-200/95 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Troca de modo, seleção de fase e Editor de Fases ficam bloqueados após iniciar o jogo
                  (permitido apenas no Modo Desenvolvedor ou usando o Editor de Fases).
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isModeAndEditorLocked}
                onClick={() => {
                  if (isModeAndEditorLocked) return;
                  onSelectLevel(createWorld1_1());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500 disabled:opacity-45 disabled:hover:bg-stone-800 disabled:hover:border-stone-700 disabled:cursor-not-allowed font-medium text-left transition flex flex-col cursor-pointer"
              >
                <span className="font-bold text-amber-400">Mundo 1-1</span>
                <span className="text-[10px] text-stone-400">Superfície clássica do NES</span>
              </button>

              <button
                type="button"
                disabled={isModeAndEditorLocked}
                onClick={() => {
                  if (isModeAndEditorLocked) return;
                  onSelectLevel(createSecretVault());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500 disabled:opacity-45 disabled:hover:bg-stone-800 disabled:hover:border-stone-700 disabled:cursor-not-allowed font-medium text-left transition flex flex-col cursor-pointer"
              >
                <span className="font-bold text-sky-400">Cofre Secreto</span>
                <span className="text-[10px] text-stone-400">Moedas do cano subterrâneo</span>
              </button>

              <button
                type="button"
                disabled={isModeAndEditorLocked}
                onClick={() => {
                  if (isModeAndEditorLocked) return;
                  onSelectLevel(createWorld1_2());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-500 disabled:opacity-45 disabled:hover:bg-stone-800 disabled:hover:border-stone-700 disabled:cursor-not-allowed font-medium text-left transition flex flex-col cursor-pointer"
              >
                <span className="font-bold text-blue-400">Mundo 1-2</span>
                <span className="text-[10px] text-stone-400">Cavernas Subterrâneas</span>
              </button>

              <button
                type="button"
                disabled={isModeAndEditorLocked}
                onClick={() => {
                  if (isModeAndEditorLocked) return;
                  onSelectLevel(createWorld2_2());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-cyan-400 disabled:opacity-45 disabled:hover:bg-stone-800 disabled:hover:border-stone-700 disabled:cursor-not-allowed font-medium text-left transition flex flex-col cursor-pointer"
              >
                <span className="font-bold text-cyan-400">Mundo 2-2 (Água)</span>
                <span className="text-[10px] text-stone-400">Fase Aquática Submarina</span>
              </button>

              <button
                type="button"
                disabled={isModeAndEditorLocked}
                onClick={() => {
                  if (isModeAndEditorLocked) return;
                  onSelectLevel(createWorldGhostHouse());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-purple-400 disabled:opacity-45 disabled:hover:bg-stone-800 disabled:hover:border-stone-700 disabled:cursor-not-allowed font-medium text-left transition flex flex-col cursor-pointer"
              >
                <span className="font-bold text-purple-300">Mansão de Fantasmas</span>
                <span className="text-[10px] text-stone-400">Boo, Dry Bones e salões assombrados</span>
              </button>

              <button
                type="button"
                disabled={isModeAndEditorLocked}
                onClick={() => {
                  if (isModeAndEditorLocked) return;
                  onSelectLevel(createWorld1_4());
                  onClose();
                }}
                className="px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-red-500 disabled:opacity-45 disabled:hover:bg-stone-800 disabled:hover:border-stone-700 disabled:cursor-not-allowed font-medium text-left transition flex flex-col cursor-pointer"
              >
                <span className="font-bold text-red-400">Mundo 1-4 (Castelo)</span>
                <span className="text-[10px] text-stone-400">Lava, Ponte e Rei Koopa</span>
              </button>

              <button
                type="button"
                disabled={isModeAndEditorLocked}
                onClick={() => {
                  if (isModeAndEditorLocked) return;
                  onSelectLevel(createEndlessLevel(Date.now(), 1));
                  onClose();
                }}
                className="col-span-2 px-3 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-emerald-400 disabled:opacity-45 disabled:hover:bg-stone-800 disabled:hover:border-stone-700 disabled:cursor-not-allowed font-medium text-left transition flex flex-col cursor-pointer"
              >
                <span className="font-bold text-emerald-400">Modo Sem Fim (Cíclico)</span>
                <span className="text-[10px] text-stone-400">1 Overworld → 2 Caverna → 3 Água → 4 Castelo</span>
              </button>

              {onStartSingleplayer && (
                <button
                  type="button"
                  disabled={isModeAndEditorLocked}
                  onClick={() => {
                    if (isModeAndEditorLocked) return;
                    onClose();
                    onStartSingleplayer();
                  }}
                  className="col-span-2 px-3 py-2.5 rounded-lg bg-pink-950/70 hover:bg-pink-900/80 border border-pink-500/60 hover:border-pink-400 disabled:opacity-45 disabled:hover:bg-pink-950/70 disabled:hover:border-pink-500/60 disabled:cursor-not-allowed font-medium text-left transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Crown className="w-4 h-4 text-pink-300 shrink-0" />
                    <div>
                      <span className="block font-bold text-pink-300">Modo Singleplayer (7 Mundos · 35 Fases)</span>
                      <span className="text-[10px] text-pink-100/75">7 Mundos × 5 Fases · Resgate a Princesa Femboy no Castelo 7-5</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-['Press_Start_2P',monospace] text-pink-200 shrink-0 inline-flex items-center gap-1">
                    {isModeAndEditorLocked && <Lock className="w-3 h-3" />}
                    {isModeAndEditorLocked ? 'BLOQUEADO' : 'JOGAR'}
                  </span>
                </button>
              )}

              {onStartSmwWorldMap && (
                <button
                  type="button"
                  disabled={isModeAndEditorLocked}
                  onClick={() => {
                    if (isModeAndEditorLocked) return;
                    onClose();
                    onStartSmwWorldMap();
                  }}
                  className="col-span-2 px-3 py-2.5 rounded-lg bg-emerald-950/75 hover:bg-emerald-900/85 border border-emerald-500/65 hover:border-amber-400 disabled:opacity-45 disabled:hover:bg-emerald-950/75 disabled:hover:border-emerald-500/65 disabled:cursor-not-allowed font-medium text-left transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <MapIcon className="w-4 h-4 text-amber-300 shrink-0" />
                    <div>
                      <span className="block font-bold text-emerald-300">Super Mario World (Beta V0.9)</span>
                      <span className="text-[10px] text-emerald-100/80">Overworld da Ilha WikiWorldWeb até o Castelo de Johannnnes89</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-['Press_Start_2P',monospace] text-amber-300 shrink-0 inline-flex items-center gap-1">
                    {isModeAndEditorLocked && <Lock className="w-3 h-3" />}
                    {isModeAndEditorLocked ? 'BLOQUEADO' : 'MAPA'}
                  </span>
                </button>
              )}

              {onLoadSmwWorldProgress && (
                <button
                  type="button"
                  disabled={isModeAndEditorLocked}
                  onClick={() => {
                    if (isModeAndEditorLocked) return;
                    onClose();
                    onLoadSmwWorldProgress();
                  }}
                  className="col-span-2 px-3 py-2.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/65 hover:border-amber-300 disabled:opacity-45 disabled:hover:bg-amber-950/70 disabled:hover:border-amber-500/65 disabled:cursor-not-allowed font-medium text-left transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FolderOpen className="w-4 h-4 text-amber-300 shrink-0" />
                    <div>
                      <span className="block font-bold text-amber-200">Carregar Progresso (Modo World)</span>
                      <span className="text-[10px] text-amber-100/75">
                        Continuar de um dos 3 slots salvos manualmente ({smwSavedSlotsCount}/3 ocupados)
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-['Press_Start_2P',monospace] text-amber-200 shrink-0 inline-flex items-center gap-1">
                    {isModeAndEditorLocked && <Lock className="w-3 h-3" />}
                    {isModeAndEditorLocked ? 'BLOQUEADO' : 'CARREGAR'}
                  </span>
                </button>
              )}
            </div>
            {onOpenLevelEditor && (
              <button
                type="button"
                disabled={isModeAndEditorLocked}
                onClick={() => {
                  if (isModeAndEditorLocked) return;
                  onClose();
                  onOpenLevelEditor();
                }}
                className="mt-2.5 w-full px-3 py-2.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-500/60 hover:border-sky-400 disabled:opacity-45 disabled:hover:bg-sky-950/80 disabled:hover:border-sky-500/60 disabled:cursor-not-allowed font-medium text-left transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Hammer className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <span className="block font-bold text-sky-300">Editor de Fases</span>
                    <span className="text-[10px] text-sky-200/75">Crie e edite suas próprias fases na memória temporária</span>
                  </div>
                </div>
                <span className="text-[9px] font-['Press_Start_2P',monospace] text-sky-300 inline-flex items-center gap-1">
                  {isModeAndEditorLocked && <Lock className="w-3 h-3" />}
                  {isModeAndEditorLocked ? 'BLOQUEADO' : 'ABRIR'}
                </span>
              </button>
            )}
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
                  className={`px-3 py-1 rounded text-[11px] font-bold cursor-pointer ${
                    crtFilter ? 'bg-amber-600 text-white' : 'bg-stone-700 text-stone-400'
                  }`}
                >
                  {crtFilter ? 'ATIVO' : 'DESATIVO'}
                </button>
              </div>

              {/* Fullscreen Mode Toggle (Mobile & Desktop) */}
              {onToggleFullscreen && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-700/60">
                  <div>
                    <div className="font-medium text-stone-200">Modo Tela Cheia (Mobile / PC)</div>
                    <div className="text-[10px] text-stone-400">Expande o jogo e controles para ocupar toda a tela</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleFullscreen();
                    }}
                    className={`px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                      isFullscreen
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    <span>{isFullscreen ? 'SAIR' : 'ATIVAR'}</span>
                  </button>
                </div>
              )}

              {/* Mobile Touch Overlay Mode Toggle */}
              {onToggleTouchOverlay && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-700/60">
                  <div>
                    <div className="font-medium text-stone-200">Controles Táteis no Mobile</div>
                    <div className="text-[10px] text-stone-400">D-pad e botões A/B translúcidos sobre o canvas</div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleTouchOverlay}
                    className={`px-3 py-1 rounded text-[11px] font-bold cursor-pointer ${
                      touchOverlayOnCanvas ? 'bg-emerald-600 text-white' : 'bg-stone-700 text-stone-300'
                    }`}
                  >
                    {touchOverlayOnCanvas ? 'SOBREPOSTO' : 'ABAIXO'}
                  </button>
                </div>
              )}

              {/* Smart TV Mode Section */}
              {onToggleSmartTvMode && (
                <div className="pt-2 border-t border-stone-700/60 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-sky-300 flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>Modo Smart TV (Controle Remoto)</span>
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Margem anti-corte (overscan), foco D-Pad nos menus e teclas de controle de TV
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleSmartTvMode}
                      className={`px-3 py-1 rounded text-[11px] font-bold cursor-pointer shrink-0 ${
                        smartTvMode ? 'bg-sky-600 text-white' : 'bg-stone-700 text-stone-300'
                      }`}
                    >
                      {smartTvMode ? 'ATIVO' : 'DESATIVO'}
                    </button>
                  </div>

                  {smartTvMode && onToggleSmartTvJumpWithUp && (
                    <div className="flex items-center justify-between gap-3 pl-4 border-l-2 border-sky-700/60">
                      <div>
                        <div className="text-[11px] font-medium text-stone-200">
                          Pular com Seta ▲ (Controles de 5 botões)
                        </div>
                        <div className="text-[10px] text-stone-400">
                          Permite pular com ▲ além do botão OK / Enter / Vermelho
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onToggleSmartTvJumpWithUp}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer shrink-0 ${
                          smartTvJumpWithUp ? 'bg-emerald-600 text-white' : 'bg-stone-700 text-stone-300'
                        }`}
                      >
                        {smartTvJumpWithUp ? 'ATIVO' : 'DESATIVO'}
                      </button>
                    </div>
                  )}

                  {smartTvMode && onToggleSmartTvAutoRun && (
                    <div className="flex items-center justify-between gap-3 pl-4 border-l-2 border-sky-700/60">
                      <div>
                        <div className="text-[11px] font-medium text-stone-200">
                          Corrida Automática na TV
                        </div>
                        <div className="text-[10px] text-stone-400">
                          Corre automaticamente ao andar (útil para controles sem botão extra de corrida)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onToggleSmartTvAutoRun}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer shrink-0 ${
                          smartTvAutoRun ? 'bg-amber-600 text-white' : 'bg-stone-700 text-stone-300'
                        }`}
                      >
                        {smartTvAutoRun ? 'ATIVO' : 'DESATIVO'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sonic-style Debug Mode Toggle */}
              {onToggleDebugMode && (
                <div className="flex items-center justify-between pt-2 border-t border-stone-700/60 gap-3">
                  <div>
                    <div className="font-medium text-cyan-300 flex items-center gap-1.5">
                      <Bug className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Modo Debug (Sonic)</span>
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Pontos viram coordenadas X/Y; pressione B para inserir itens manualmente
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleDebugMode}
                    className={`px-3 py-1 rounded text-[11px] font-bold cursor-pointer shrink-0 ${
                      isDebugMode ? 'bg-cyan-600 text-white' : 'bg-stone-700 text-stone-300'
                    }`}
                  >
                    {isDebugMode ? 'ATIVO' : 'DESATIVO'}
                  </button>
                </div>
              )}
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
                <span className="font-bold text-amber-400">C / Q</span>
                <p className="text-[10px] text-stone-400">Pulo Carpado (Spin Jump / Desmontar Yoshi)</p>
              </div>
              <div>
                <span className="font-bold text-amber-400">V / Tab</span>
                <p className="text-[10px] text-stone-400">Select (Usar Power-Up da Carteira / Sair de fase já passada com Pausa)</p>
              </div>
              <div>
                <span className="font-bold text-amber-400">P / Esc</span>
                <p className="text-[10px] text-stone-400">Pausar jogo</p>
              </div>
            </div>
          </div>

          {/* Smart TV Remote Reference */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Tv className="w-4 h-4 text-sky-400" />
              <h3 className="font-['Press_Start_2P',monospace] text-[11px] text-sky-300">
                CONTROLE REMOTO (SMART TV)
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-stone-300 bg-sky-950/35 p-3 rounded-lg border border-sky-700/50 text-xs">
              <div>
                <span className="font-bold text-sky-300">Direcional (◀ ▶ ▼) ou 4/6/8</span>
                <p className="text-[10px] text-stone-400">Andar, agachar e entrar em canos</p>
              </div>
              <div>
                <span className="font-bold text-sky-300">OK / Enter / Vermelho / ▲*</span>
                <p className="text-[10px] text-stone-400">Pular (*▲ ativo no Modo Smart TV)</p>
              </div>
              <div>
                <span className="font-bold text-sky-300">Azul / Verde / Amarelo / Ch+ / 0</span>
                <p className="text-[10px] text-stone-400">Correr, bola de fogo e cauda/capa</p>
              </div>
              <div>
                <span className="font-bold text-sky-300">Voltar / Return / Play-Pause</span>
                <p className="text-[10px] text-stone-400">Pausar, continuar ou fechar janelas</p>
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
