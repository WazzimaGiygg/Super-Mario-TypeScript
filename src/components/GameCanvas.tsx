/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine.ts';
import { RetroHUD } from './RetroHUD.tsx';
import { TouchControls } from './TouchControls.tsx';
import { SettingsModal } from './SettingsModal.tsx';
import { LeaderboardModal } from './LeaderboardModal.tsx';
import { CheatMenuModal } from './CheatMenuModal.tsx';
import { MultiplayerModal } from './MultiplayerModal.tsx';
import { multiplayerClient } from '../game/multiplayer.ts';
import { SoundEngine } from '../game/audio.ts';
import { GamepadControls, LevelData, MarioPower, GameDifficulty, ResolutionScale } from '../game/types.ts';
import { getTopScore, saveNewScore } from '../game/scoreboard.ts';
import { Settings, Play, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, Trophy, Flame, Users } from 'lucide-react';

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const cheatBufferRef = useRef<string>('');

  // UI state for reactive updates
  const [stats, setStats] = useState({
    score: 0,
    coins: 0,
    world: '1-1',
    time: 400,
    lives: 3,
    highScore: getTopScore(),
  });

  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isStageClear, setIsStageClear] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isCheatMenuOpen, setIsCheatMenuOpen] = useState(false);
  const [isCheatActive, setIsCheatActive] = useState(false);
  const [cheatToast, setCheatToast] = useState('');
  const [splashCheatInput, setSplashCheatInput] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [crtFilter, setCrtFilter] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('normal');
  const [resolutionScale, setResolutionScale] = useState<ResolutionScale>('fit');
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [multiplayerStatus, setMultiplayerStatus] = useState(() => multiplayerClient.getStatus());

  // Audio state
  const [soundStatus, setSoundStatus] = useState(() => SoundEngine.get().getStatus());

  // Controls state for touch/gamepad
  const [controls, setControls] = useState<GamepadControls>({
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    run: false,
    pause: false,
  });

  // Subscribe to multiplayer client & check URL invite room
  useEffect(() => {
    const unsub = multiplayerClient.subscribe(setMultiplayerStatus);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room')) {
        setIsMultiplayerOpen(true);
      }
    }
    return () => unsub();
  }, []);

  // Initialize engine once
  useEffect(() => {
    const engine = new GameEngine();
    engine.stats.highScore = getTopScore();
    engineRef.current = engine;
    multiplayerClient.setEngine(engine);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      SoundEngine.get().stopMusic();
    };
  }, []);

  // Update controls to engine
  const handleControlChange = useCallback((key: keyof GamepadControls, active: boolean) => {
    if (!engineRef.current) return;
    engineRef.current.controls[key] = active;
    setControls(prev => ({ ...prev, [key]: active }));
  }, []);

  // Activate developer mode ("lula132026")
  const activateCheat = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.activateCheatMode();
    setIsCheatActive(true);
    setIsCheatMenuOpen(true);
    setCheatToast('PÁGINA DO DESENVOLVEDOR ATIVADA!');
    setTimeout(() => setCheatToast(''), 4500);
  }, []);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Secret Cheat Code Detection: "lula132026"
      if (e.key && e.key.length === 1) {
        cheatBufferRef.current = (cheatBufferRef.current + e.key.toLowerCase()).slice(-16);
        if (cheatBufferRef.current.endsWith('lula132026')) {
          activateCheat();
        }
      }

      // Prevent browser scrolling on game keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      // Resume Web Audio on first keypress
      SoundEngine.get().resume();

      if (!hasStarted) {
        setHasStarted(true);
        if (engineRef.current && !engineRef.current.isGameStarted) {
          engineRef.current.restartGame();
        }
      }

      const engine = engineRef.current;
      if (!engine) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          engine.controls.left = true;
          setControls(c => ({ ...c, left: true }));
          break;
        case 'ArrowRight':
        case 'KeyD':
          engine.controls.right = true;
          setControls(c => ({ ...c, right: true }));
          break;
        case 'ArrowUp':
        case 'KeyW':
          engine.controls.up = true;
          setControls(c => ({ ...c, up: true }));
          break;
        case 'ArrowDown':
        case 'KeyS':
          engine.controls.down = true;
          setControls(c => ({ ...c, down: true }));
          break;
        case 'Space':
        case 'KeyZ':
          engine.controls.jump = true;
          setControls(c => ({ ...c, jump: true }));
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyX':
        case 'KeyK':
          engine.controls.run = true;
          setControls(c => ({ ...c, run: true }));
          break;
        case 'KeyP':
        case 'Escape':
          engine.togglePause();
          setIsPaused(engine.isPaused);
          break;
        case 'KeyR':
          if (e.ctrlKey || e.metaKey) return;
          engine.restartGame();
          setIsGameOver(false);
          setIsStageClear(false);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          engine.controls.left = false;
          setControls(c => ({ ...c, left: false }));
          break;
        case 'ArrowRight':
        case 'KeyD':
          engine.controls.right = false;
          setControls(c => ({ ...c, right: false }));
          break;
        case 'ArrowUp':
        case 'KeyW':
          engine.controls.up = false;
          setControls(c => ({ ...c, up: false }));
          break;
        case 'ArrowDown':
        case 'KeyS':
          engine.controls.down = false;
          setControls(c => ({ ...c, down: false }));
          break;
        case 'Space':
        case 'KeyZ':
          engine.controls.jump = false;
          setControls(c => ({ ...c, jump: false }));
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyX':
        case 'KeyK':
          engine.controls.run = false;
          setControls(c => ({ ...c, run: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hasStarted]);

  // Gamepad API Polling
  const pollGamepad = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (!gp || !engineRef.current) return;

    const engine = engineRef.current;

    // D-Pad / Thumbstick
    const axisX = gp.axes[0] || 0;
    const axisY = gp.axes[1] || 0;
    const dpadLeft = gp.buttons[14]?.pressed || axisX < -0.4;
    const dpadRight = gp.buttons[15]?.pressed || axisX > 0.4;
    const dpadUp = gp.buttons[12]?.pressed || axisY < -0.4;
    const dpadDown = gp.buttons[13]?.pressed || axisY > 0.4;

    // A button (button 0), B button (button 1 or 2), Start (button 9)
    const btnA = gp.buttons[0]?.pressed || false;
    const btnB = gp.buttons[1]?.pressed || gp.buttons[2]?.pressed || false;
    const btnStart = gp.buttons[9]?.pressed || false;

    engine.controls.left = dpadLeft;
    engine.controls.right = dpadRight;
    engine.controls.up = dpadUp;
    engine.controls.down = dpadDown;
    engine.controls.jump = btnA;
    engine.controls.run = btnB;

    if (btnStart && !engine.controls.pause) {
      engine.togglePause();
      setIsPaused(engine.isPaused);
    }
    engine.controls.pause = btnStart;
  }, []);

  // Main Game Loop (60 FPS)
  useEffect(() => {
    let animationFrameId: number;
    let uiTimer = 0;

    const loop = (timestamp: number) => {
      const deltaMs = Math.min(32, timestamp - lastTimeRef.current);
      lastTimeRef.current = timestamp;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (engine && canvas) {
        // Poll Gamepad
        pollGamepad();

        // Update Physics & Game State
        engine.update(deltaMs);

        // Render Canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          engine.render(ctx);
        }

        // Throttle UI React state updates to ~10 times per second for smooth DOM performance
        uiTimer += deltaMs;
        if (uiTimer >= 100) {
          uiTimer = 0;
          setStats({ ...engine.stats });
          setIsPaused(engine.isPaused);
          setIsGameOver(engine.isGameOver);
          setIsStageClear(engine.isStageClear);
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [pollGamepad]);

  // Audio Controls Handlers
  const toggleMute = () => {
    const sound = SoundEngine.get();
    sound.toggleMute();
    setSoundStatus(sound.getStatus());
  };

  const toggleMusic = () => {
    const sound = SoundEngine.get();
    sound.toggleMusic();
    setSoundStatus(sound.getStatus());
  };

  const handleVolumeChange = (vol: number) => {
    const sound = SoundEngine.get();
    sound.setVolume(vol);
    setSoundStatus(sound.getStatus());
  };

  const handleSelectLevel = (level: LevelData) => {
    if (engineRef.current) {
      engineRef.current.loadLevel(level, true, false);
      setIsGameOver(false);
      setIsStageClear(false);
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.restartGame();
      setIsGameOver(false);
      setIsStageClear(false);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleStartGame = () => {
    SoundEngine.get().resume();
    setHasStarted(true);
    if (engineRef.current) {
      engineRef.current.restartGame();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center w-full min-h-screen bg-stone-950 select-none overflow-hidden"
    >
      {/* Top HUD (Placar & Vidas) */}
      <RetroHUD
        stats={stats}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        isCheatActive={isCheatActive}
        onOpenCheatMenu={() => setIsCheatMenuOpen(true)}
      />

      {/* Main Arcade Frame / TV Screen Bezel */}
      <div className="relative flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-auto">
        <div
          className={`relative bg-black rounded-lg sm:rounded-2xl border-2 sm:border-8 border-stone-800 shadow-2xl overflow-hidden flex items-center justify-center transition-all duration-200 ${
            resolutionScale === 'fit' ? 'w-full max-w-4xl aspect-[4/3] max-h-[46vh] sm:max-h-[68vh] md:max-h-[75vh]' : ''
          }`}
          style={
            resolutionScale !== 'fit'
              ? {
                  width:
                    resolutionScale === '0.5x'
                      ? 128
                      : resolutionScale === '0.75x'
                      ? 192
                      : resolutionScale === '1x'
                      ? 256
                      : resolutionScale === '1.25x'
                      ? 320
                      : resolutionScale === '1.5x'
                      ? 384
                      : 512,
                  height:
                    resolutionScale === '0.5x'
                      ? 120
                      : resolutionScale === '0.75x'
                      ? 180
                      : resolutionScale === '1x'
                      ? 240
                      : resolutionScale === '1.25x'
                      ? 300
                      : resolutionScale === '1.5x'
                      ? 360
                      : 480,
                }
              : undefined
          }
        >
          {/* HTML5 Canvas (Internal resolution 256x240, stretched with pixelated CSS) */}
          <canvas
            ref={canvasRef}
            width={GameEngine.NES_WIDTH}
            height={GameEngine.NES_HEIGHT}
            className="w-full h-full object-contain image-rendering-pixelated"
            style={{
              imageRendering: 'pixelated',
            }}
          />

          {/* CRT Scanline & Phosphor Overlay */}
          {crtFilter && (
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0px, rgba(0, 0, 0, 0.25) 1px, transparent 1px, transparent 2px)',
                boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.65)',
              }}
            />
          )}

          {/* Start Screen Splash (Initial User Interaction) */}
          {!hasStarted && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 p-6 text-center animate-in fade-in overflow-y-auto">
              <div className="mb-3">
                <span className="block text-amber-400 font-['Press_Start_2P',monospace] text-xl sm:text-3xl font-extrabold tracking-wider drop-shadow-md">
                  SUPER MARIO BROS.
                </span>
                <span className="inline-block mt-2 px-3 py-1 bg-red-800/80 text-white rounded font-['Press_Start_2P',monospace] text-[10px] tracking-widest">
                  TYPESCRIPT & CANVAS
                </span>
              </div>

              <div className="max-w-md bg-stone-900/90 border-2 border-stone-700 rounded-xl p-4 sm:p-5 mb-4 text-stone-300 text-xs sm:text-sm font-sans space-y-1.5">
                <p className="font-semibold text-white">Pronto para jogar no clássico NES?</p>
                <p className="text-stone-400 text-xs">
                  Renderização pura em Canvas a 60 FPS com sintetizador Web Audio 8-bit, física original, Goombas, Koopas e canos secretos!
                </p>
                <div className="pt-1 text-[11px] text-amber-300 font-mono">
                  [Espaço / Z] Pular • [Shift / X] Correr / Bola de Fogo
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-['Press_Start_2P',monospace] text-white text-xs sm:text-sm font-bold shadow-xl shadow-red-950/50 transform hover:scale-105 active:scale-95 transition flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  JOGAR AGORA
                </button>

                <button
                  type="button"
                  onClick={() => setIsMultiplayerOpen(true)}
                  className="px-6 py-3.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border-2 border-emerald-500 text-emerald-300 font-['Press_Start_2P',monospace] text-xs font-bold shadow-xl shadow-emerald-950/50 transform hover:scale-105 active:scale-95 transition flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  MULTIPLAYER (GOOGLE)
                </button>
              </div>

              {/* Hidden Developer Mode Trigger: Invisible hot spot with keyboard fallback */}
              <div className="mt-4 pt-1 flex flex-col items-center">
                <input
                  type="text"
                  tabIndex={-1}
                  aria-hidden="true"
                  value={splashCheatInput}
                  onChange={e => {
                    const val = e.target.value;
                    setSplashCheatInput(val);
                    if (val.trim().toLowerCase() === 'lula132026') {
                      activateCheat();
                      setSplashCheatInput('');
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      if (splashCheatInput.trim().toLowerCase() === 'lula132026') {
                        activateCheat();
                        setSplashCheatInput('');
                      }
                    }
                  }}
                  className="opacity-0 w-1 h-1 pointer-events-none select-none absolute"
                />
              </div>
            </div>
          )}

          {/* Pause Overlay */}
          {isPaused && hasStarted && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs">
              <h2 className="font-['Press_Start_2P',monospace] text-2xl sm:text-4xl text-amber-400 mb-6 tracking-widest animate-pulse">
                PAUSADO
              </h2>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current?.togglePause();
                    setIsPaused(false);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-['Press_Start_2P',monospace] text-xs shadow"
                >
                  CONTINUAR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current?.restartGame();
                    setIsPaused(false);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-['Press_Start_2P',monospace] text-xs shadow"
                >
                  REINICIAR
                </button>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {isGameOver && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center animate-in zoom-in-95">
              <h2 className="font-['Press_Start_2P',monospace] text-3xl sm:text-5xl text-red-600 mb-4 tracking-widest drop-shadow-lg">
                GAME OVER
              </h2>
              <p className="text-stone-300 font-mono text-sm mb-6">
                PONTUAÇÃO FINAL: <span className="text-amber-400 font-bold text-base">{stats.score}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleRestart}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg transform hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  JOGAR NOVAMENTE
                </button>
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/50 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  SALVAR NO PLACAR
                </button>
              </div>
            </div>
          )}

          {/* Stage Clear Banner */}
          {isStageClear && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-black/85 border-2 border-amber-400 rounded-lg text-center animate-bounce">
              <span className="font-['Press_Start_2P',monospace] text-amber-400 text-sm sm:text-lg">
                FASE CONCLUÍDA!
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Toolbar (Audio, Settings, Fullscreen - for desktop/tablet) */}
      <div className="hidden sm:flex w-full max-w-4xl px-4 py-2 items-center justify-between text-stone-400 text-xs">
        <div className="flex items-center gap-2">
          {/* Mute SFX button */}
          <button
            type="button"
            onClick={toggleMute}
            title={soundStatus.muted ? 'Desmutar Som' : 'Mutar Som'}
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition"
          >
            {soundStatus.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Toggle Music */}
          <button
            type="button"
            onClick={toggleMusic}
            className={`px-3 py-1.5 rounded-lg border font-mono text-[11px] transition ${
              soundStatus.musicEnabled
                ? 'bg-stone-900 border-amber-600/50 text-amber-300'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
          >
            Música: {soundStatus.musicEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Toggle CRT lines */}
          <button
            type="button"
            onClick={() => setCrtFilter(!crtFilter)}
            className={`hidden sm:inline-block px-3 py-1.5 rounded-lg border font-mono text-[11px] transition ${
              crtFilter
                ? 'bg-stone-900 border-emerald-600/50 text-emerald-300'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
          >
            CRT: {crtFilter ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Restart */}
          <button
            type="button"
            onClick={handleRestart}
            title="Reiniciar jogo (R)"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Placar de Recordes */}
          <button
            type="button"
            onClick={() => setIsLeaderboardOpen(true)}
            title="Placar de Recordes (Hall da Fama)"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-amber-500/40 text-amber-300 hover:text-white transition flex items-center gap-1.5"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline text-[11px]">Placar</span>
          </button>

          {/* Multiplayer Firebase (Login Google) */}
          <button
            type="button"
            onClick={() => setIsMultiplayerOpen(true)}
            title="Multiplayer Online com Login Google (Firebase)"
            className={`p-2 rounded-lg border text-xs transition flex items-center gap-1.5 cursor-pointer ${
              multiplayerStatus.connected
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                : 'bg-stone-900 hover:bg-stone-800 border-emerald-700/60 text-emerald-400 hover:text-emerald-200'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline text-[11px] font-bold">
              {multiplayerStatus.connected ? `ONLINE (${multiplayerStatus.playerCount})` : 'Multiplayer'}
            </span>
          </button>

          {/* Página do desenvolvedor (se código estiver ativo) */}
          {isCheatActive && (
            <button
              type="button"
              onClick={() => setIsCheatMenuOpen(true)}
              title="Página do desenvolvedor"
              className="p-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500 text-red-300 hover:text-white transition flex items-center gap-1.5 animate-pulse"
            >
              <Flame className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline text-[11px] font-bold">Dev</span>
            </button>
          )}

          {/* Settings */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Configurações e Fases"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline text-[11px]">Menu</span>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Tela Cheia"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* On-Screen Touch Controls (For mobile / touch devices) */}
      <TouchControls
        controls={controls}
        onControlChange={handleControlChange}
        isPaused={isPaused}
        onTogglePause={() => {
          engineRef.current?.togglePause();
          setIsPaused(prev => !prev);
        }}
        isMuted={soundStatus.muted}
        onToggleMute={toggleMute}
        onRestart={handleRestart}
        onToggleFullscreen={toggleFullscreen}
        onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        multiplayerConnected={multiplayerStatus.connected}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSelectLevel={handleSelectLevel}
        onRestart={handleRestart}
        isMuted={soundStatus.muted}
        onToggleMute={toggleMute}
        musicEnabled={soundStatus.musicEnabled}
        onToggleMusic={toggleMusic}
        volume={soundStatus.volume}
        onVolumeChange={handleVolumeChange}
        crtFilter={crtFilter}
        onToggleCrt={() => setCrtFilter(!crtFilter)}
        difficulty={difficulty}
        onSelectDifficulty={(diff: GameDifficulty) => {
          setDifficulty(diff);
          if (engineRef.current) {
            engineRef.current.setDifficulty(diff);
            setStats({ ...engineRef.current.stats });
          }
        }}
        resolutionScale={resolutionScale}
        onSelectResolution={(scale: ResolutionScale) => {
          setResolutionScale(scale);
        }}
      />

      {/* Leaderboard / Placar Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentScore={stats.score}
        currentCoins={stats.coins}
        currentWorld={stats.world}
        isCheatActive={isCheatActive}
      />

      {/* Cheat Menu Modal ("lula132026") */}
      <CheatMenuModal
        isOpen={isCheatMenuOpen}
        onClose={() => setIsCheatMenuOpen(false)}
        infiniteLives={engineRef.current?.infiniteLives || false}
        onToggleInfiniteLives={() => {
          engineRef.current?.toggleInfiniteLives();
          setStats({ ...engineRef.current!.stats });
        }}
        onSetPowerUp={(power: MarioPower | 'star') => {
          engineRef.current?.setPowerUp(power);
        }}
        onAddScore={(pts: number) => {
          engineRef.current?.addCheatScore(pts);
          setStats({ ...engineRef.current!.stats });
        }}
      />

      {/* Multiplayer por IP Modal (WazzimaGiygg / Mario) */}
      <MultiplayerModal
        isOpen={isMultiplayerOpen}
        onClose={() => setIsMultiplayerOpen(false)}
      />

      {/* Cheat Toast Notification */}
      {cheatToast && (
        <div className="fixed top-24 z-50 px-5 py-3 rounded-xl bg-red-950 border-2 border-red-500 text-amber-300 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs shadow-2xl animate-bounce flex items-center gap-2">
          <Flame className="w-4 h-4 text-red-500 fill-red-500" />
          <span>{cheatToast}</span>
        </div>
      )}
    </div>
  );
};
