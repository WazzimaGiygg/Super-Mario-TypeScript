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
import { LevelEditorModal } from './LevelEditorModal.tsx';
import { multiplayerClient } from '../game/multiplayer.ts';
import { SoundEngine } from '../game/audio.ts';
import { GamepadControls, GameStats, LevelData, MarioPower, GameDifficulty, ResolutionScale, MultiplayerMatchResult, MultiplayerLogoffEvent } from '../game/types.ts';
import { getTopScore } from '../game/scoreboard.ts';
import { Settings, Play, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, Trophy, Flame, Users, Crown, Clock, CheckCircle2, WifiOff, Hammer, ShieldAlert } from 'lucide-react';

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const cheatBufferRef = useRef<string>('');

  // UI state for reactive updates
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    coins: 0,
    world: '1-1',
    time: 400,
    lives: 3,
    highScore: getTopScore(),
    isNewHighScore: false,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [lastSavedRank, setLastSavedRank] = useState<number | null>(null);
  const [marioPower, setMarioPower] = useState<MarioPower>('small');
  const [isStageClear, setIsStageClear] = useState(false);
  const [waitingForPlayersFinish, setWaitingForPlayersFinish] = useState(false);
  const [waitingPlayersNames, setWaitingPlayersNames] = useState<string[]>([]);
  const [stageArrivalNotice, setStageArrivalNotice] = useState('');
  const [allPlayersClearedReady, setAllPlayersClearedReady] = useState(false);
  const [localStageCleared, setLocalStageCleared] = useState(false);
  const [isMultiplayerMatchOver, setIsMultiplayerMatchOver] = useState(false);
  const [multiplayerMatchResult, setMultiplayerMatchResult] = useState<MultiplayerMatchResult | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isCheatMenuOpen, setIsCheatMenuOpen] = useState(false);
  const [isCheatActive, setIsCheatActive] = useState(false);
  const [cheatToast, setCheatToast] = useState('');
  const [splashCheatInput, setSplashCheatInput] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [crtFilter, setCrtFilter] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wasNativeFullscreenRef = useRef(false);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 768
    );
  });
  const [touchOverlayOnCanvas, setTouchOverlayOnCanvas] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smb_touch_overlay_mode');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [difficulty, setDifficulty] = useState<GameDifficulty>('normal');
  const [resolutionScale, setResolutionScale] = useState<ResolutionScale>('fit');
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [isLevelEditorOpen, setIsLevelEditorOpen] = useState(false);
  const [customLevels, setCustomLevels] = useState<LevelData[]>([]);
  const [activeCustomLevelId, setActiveCustomLevelId] = useState<string | null>(null);
  const [multiplayerStatus, setMultiplayerStatus] = useState(() => multiplayerClient.getStatus());
  const [multiplayerNotice, setMultiplayerNotice] = useState<MultiplayerLogoffEvent | null>(null);

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

  // Subscribe to multiplayer client, logoff/inactivity events & check URL invite room
  useEffect(() => {
    const unsub = multiplayerClient.subscribe((status) => {
      setMultiplayerStatus(status);
      if (status.connected) {
        setHasStarted(true);
        if (engineRef.current) {
          engineRef.current.isGameStarted = true;
        }
      }
    });
    let noticeTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubLogoff = multiplayerClient.onLogoffEvent((evt) => {
      setMultiplayerNotice(evt);
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        setMultiplayerNotice(null);
      }, 5500);
    });
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('room')) {
        setIsMultiplayerOpen(true);
      }
    }
    return () => {
      unsub();
      unsubLogoff();
      if (noticeTimer) clearTimeout(noticeTimer);
    };
  }, []);

  // Keep mobile/touch device detection reactive across resize & orientation changes
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(
        window.matchMedia('(pointer: coarse)').matches ||
          navigator.maxTouchPoints > 0 ||
          window.innerWidth < 768
      );
    };
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  const toggleTouchOverlayMode = useCallback(() => {
    setTouchOverlayOnCanvas(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smb_touch_overlay_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
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

  const togglePauseGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !hasStarted || engine.isGameOver || engine.isMultiplayerMatchOver) return;
    engine.togglePause();
    setIsPaused(engine.isPaused);
    if (engine.isPaused) {
      setControls({
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        run: false,
        pause: false,
      });
    }
  }, [hasStarted]);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      ) {
        return;
      }

      if (isMultiplayerOpen || isSettingsOpen || isLeaderboardOpen || isLevelEditorOpen) {
        return;
      }

      // Pause / Unpause on Escape or P (without starting splash screen or flickering on key repeat)
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (isCheatMenuOpen) {
          if (e.code === 'Escape') {
            e.preventDefault();
            setIsCheatMenuOpen(false);
          }
          return;
        }
        if (!hasStarted || isGameOver || isMultiplayerMatchOver) return;
        if (e.repeat) return;
        e.preventDefault();
        SoundEngine.get().resume();
        togglePauseGame();
        return;
      }

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
          if (multiplayerStatus.connected) {
            engineRef.current.isGameStarted = true;
          } else {
            engineRef.current.restartGame();
          }
        }
      }

      const engine = engineRef.current;
      if (!engine || engine.isPaused) return;

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
        case 'KeyR':
          if (e.ctrlKey || e.metaKey) return;
          if (multiplayerStatus.connected) {
            if (multiplayerStatus.transport === 'websocket' || multiplayerStatus.isHost) {
              multiplayerClient.startMultiplayerRematch();
              setIsGameOver(false);
              setIsStageClear(false);
            }
          } else {
            engine.restartGame();
            setIsGameOver(false);
            setIsStageClear(false);
          }
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
  }, [hasStarted, isGameOver, isMultiplayerMatchOver, isCheatMenuOpen, isMultiplayerOpen, isSettingsOpen, isLeaderboardOpen, isLevelEditorOpen, multiplayerStatus.connected, multiplayerStatus.isHost, multiplayerStatus.transport, activateCheat, togglePauseGame]);

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

  // Main Game Loop (60 FPS) — Freezes canvas rendering & RAF loop completely while paused
  useEffect(() => {
    if (isPaused) {
      // Keep listening only for Gamepad Start button while paused so controller users can unpause
      const gamepadPauseTimer = window.setInterval(() => {
        pollGamepad();
        if (engineRef.current && !engineRef.current.isPaused) {
          setIsPaused(false);
        }
      }, 120);
      return () => clearInterval(gamepadPauseTimer);
    }

    let animationFrameId: number;
    let uiTimer = 0;
    lastTimeRef.current = performance.now();

    const loop = (timestamp: number) => {
      const deltaMs = Math.min(32, timestamp - lastTimeRef.current);
      lastTimeRef.current = timestamp;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (engine && canvas) {
        // Poll Gamepad
        pollGamepad();

        if (engine.isPaused) {
          setIsPaused(true);
          return;
        }

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
          setStats({ ...engine.stats, isNewHighScore: engine.isNewHighScore });
          setLastSavedRank(engine.lastSavedRank);
          setMarioPower(engine.marioPower);
          setIsPaused(engine.isPaused);
          setIsGameOver(engine.isGameOver);
          setIsStageClear(engine.isStageClear);
          setWaitingForPlayersFinish(engine.waitingForPlayersFinish);
          setWaitingPlayersNames([...engine.waitingPlayersNames]);
          setStageArrivalNotice(engine.stageArrivalNotice);
          setAllPlayersClearedReady(engine.allPlayersClearedReady);
          setLocalStageCleared(engine.localStageCleared);
          setIsMultiplayerMatchOver(engine.isMultiplayerMatchOver);
          setMultiplayerMatchResult(engine.multiplayerMatchResult);
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, pollGamepad]);

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
    if (multiplayerStatus.connected && multiplayerStatus.transport === 'firebase' && !multiplayerStatus.isHost) {
      setCheatToast('Apenas o anfitrião pode escolher a fase da sala!');
      setTimeout(() => setCheatToast(''), 3000);
      return;
    }
    if (engineRef.current) {
      engineRef.current.isPaused = false;
      engineRef.current.loadLevel(level, true, false);
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
    }
  };

  const openLevelEditor = useCallback(() => {
    const engine = engineRef.current;
    if (engine && hasStarted && !engine.isPaused && !engine.isGameOver && !engine.isMultiplayerMatchOver) {
      engine.togglePause();
      setIsPaused(true);
    }
    setControls({
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      run: false,
      pause: false,
    });
    setIsSettingsOpen(false);
    setIsLevelEditorOpen(true);
  }, [hasStarted]);

  const handlePlayCustomLevel = useCallback(
    (level: LevelData) => {
      if (multiplayerStatus.connected) {
        setCheatToast('Saia da sala multiplayer para testar fases personalizadas!');
        setTimeout(() => setCheatToast(''), 3500);
        return;
      }
      SoundEngine.get().resume();
      setIsLevelEditorOpen(false);
      setIsSettingsOpen(false);
      setHasStarted(true);
      if (engineRef.current) {
        engineRef.current.playCustomLevel(level);
        setIsPaused(false);
        setIsGameOver(false);
        setIsStageClear(false);
        setStats({ ...engineRef.current.stats, isNewHighScore: engineRef.current.isNewHighScore });
        setMarioPower(engineRef.current.marioPower);
      }
    },
    [multiplayerStatus.connected]
  );

  const handleReturnToMainMenu = useCallback(() => {
    setIsLevelEditorOpen(false);
    setIsSettingsOpen(false);
    setIsCheatMenuOpen(false);
    setIsPaused(false);
    setIsGameOver(false);
    setIsStageClear(false);
    setHasStarted(false);
    if (engineRef.current) {
      engineRef.current.exitToMainMenu();
      setStats({ ...engineRef.current.stats, isNewHighScore: false });
      setMarioPower(engineRef.current.marioPower);
    } else {
      SoundEngine.get().stopMusic();
    }
  }, []);

  const handleRestart = () => {
    if (multiplayerStatus.connected) {
      if (multiplayerStatus.transport === 'websocket' || multiplayerStatus.isHost) {
        if (engineRef.current) engineRef.current.isPaused = false;
        multiplayerClient.startMultiplayerRematch();
        setIsPaused(false);
        setIsGameOver(false);
        setIsStageClear(false);
      } else {
        setCheatToast('Apenas o anfitrião pode reiniciar a partida da sala!');
        setTimeout(() => setCheatToast(''), 3000);
      }
      return;
    }
    if (engineRef.current) {
      engineRef.current.restartGame();
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
    }
  };

  useEffect(() => {
    const getFullscreenElement = () =>
      document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ||
      null;

    const handleFullscreenChange = () => {
      const activeNative = Boolean(getFullscreenElement());
      if (activeNative) {
        wasNativeFullscreenRef.current = true;
        setIsFullscreen(true);
      } else if (wasNativeFullscreenRef.current) {
        wasNativeFullscreenRef.current = false;
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const el = containerRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;

    const nativeFsEl = document.fullscreenElement || doc.webkitFullscreenElement;

    if (isFullscreen || nativeFsEl) {
      setIsFullscreen(false);
      wasNativeFullscreenRef.current = false;
      if (nativeFsEl) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
        }
      }
      return;
    }

    // Always activate immersive 100dvh fullscreen immediately (ensures full support on iOS Safari & mobile iframes)
    setIsFullscreen(true);

    if (el) {
      if (el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {
          // Fallback to CSS immersive mobile fullscreen already enabled above
        });
      } else if (el.webkitRequestFullscreen) {
        try {
          Promise.resolve(el.webkitRequestFullscreen()).catch(() => {});
        } catch {
          // Immersive CSS fullscreen remains active
        }
      }
    }
  }, [isFullscreen]);

  const handleStartGame = () => {
    SoundEngine.get().resume();
    setHasStarted(true);
    if (engineRef.current) {
      if (multiplayerStatus.connected) {
        engineRef.current.isGameStarted = true;
      } else {
        engineRef.current.restartGame();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      style={
        isFullscreen
          ? {
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
            }
          : undefined
      }
      className={
        isFullscreen
          ? 'fixed inset-0 z-40 flex flex-col items-center justify-between w-screen h-[100dvh] bg-black select-none overflow-hidden'
          : 'relative flex flex-col items-center justify-center w-full min-h-screen bg-stone-950 select-none overflow-hidden'
      }
    >
      {/* Top HUD (Placar & Vidas) */}
      <RetroHUD
        stats={stats}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        isCheatActive={isCheatActive}
        isFemboy={marioPower === 'femboy'}
        onOpenCheatMenu={() => setIsCheatMenuOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Main Arcade Frame / TV Screen Bezel */}
      <div
        className={`relative flex-1 min-h-0 w-full flex items-center justify-center ${
          isFullscreen ? 'p-0 overflow-hidden' : 'p-2 sm:p-4 overflow-auto'
        }`}
      >
        <div
          className={`relative bg-black overflow-hidden flex items-center justify-center transition-all duration-200 ${
            isFullscreen
              ? 'border-0 rounded-none shadow-none'
              : 'rounded-lg sm:rounded-2xl border-2 sm:border-8 border-stone-800 shadow-2xl'
          } ${
            resolutionScale === 'fit'
              ? isFullscreen
                ? 'w-full h-full max-w-none max-h-full'
                : isMobileDevice && touchOverlayOnCanvas
                ? 'w-full max-w-4xl aspect-[4/3] max-h-[76vh] sm:max-h-[75vh]'
                : 'w-full max-w-4xl aspect-[4/3] max-h-[46vh] sm:max-h-[68vh] md:max-h-[75vh]'
              : ''
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

          {/* Translucent On-Screen D-Pad & Action Buttons (A, B) Overlay on Canvas for Mobile Devices */}
          {isMobileDevice && touchOverlayOnCanvas && hasStarted && !isPaused && !isGameOver && !isMultiplayerMatchOver && (
            <TouchControls
              variant="canvas-overlay"
              controls={controls}
              onControlChange={handleControlChange}
              isPaused={isPaused}
              onTogglePause={togglePauseGame}
              isMuted={soundStatus.muted}
              onToggleMute={toggleMute}
              onRestart={handleRestart}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              multiplayerConnected={multiplayerStatus.connected}
            />
          )}

          {/* Start Screen Splash (Initial User Interaction) */}
          {!hasStarted && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-start sm:justify-center bg-black/85 p-4 sm:p-6 text-center animate-in fade-in overflow-y-auto">
              <div className="mb-2.5 sm:mb-3">
                <span className="block text-amber-400 font-['Press_Start_2P',monospace] text-lg sm:text-3xl font-extrabold tracking-wider drop-shadow-md">
                  SUPER MARIO BROS.
                </span>
                <span className="inline-block mt-1.5 px-3 py-1 bg-red-800/80 text-white rounded font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] tracking-widest">
                  TYPESCRIPT & CANVAS
                </span>
              </div>

              {/* Aviso de Classificação Indicativa 16+ */}
              <div className="max-w-md w-full bg-amber-950/90 border-2 border-amber-500/85 rounded-xl px-3.5 py-2.5 mb-3 text-left flex items-start gap-3 shadow-lg">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500 text-stone-950 font-['Press_Start_2P',monospace] text-[10px] font-extrabold flex items-center justify-center border border-amber-200 shadow">
                  16+
                </div>
                <div className="text-[11px] sm:text-xs font-sans leading-snug text-amber-100">
                  <p className="font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    Recomendado para maiores de 16 anos
                  </p>
                  <p className="text-amber-100/90 mt-0.5">
                    Este jogo é recomendado para públicos maiores de 16 anos, pois pode haver mensagens sugestivas no jogo.
                  </p>
                </div>
              </div>

              <div className="max-w-md w-full bg-stone-900/90 border-2 border-stone-700 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 text-stone-300 text-xs sm:text-sm font-sans space-y-1">
                <p className="font-semibold text-white">Pronto para jogar no clássico NES?</p>
                <p className="text-stone-400 text-[11px] sm:text-xs">
                  Renderização pura em Canvas a 60 FPS com sintetizador Web Audio 8-bit, física original, Goombas, Koopas e canos secretos!
                </p>
                <div className="pt-1 text-[10px] sm:text-[11px] text-amber-300 font-mono">
                  [Espaço / Z] Pular • [Shift / X] Correr / Bola de Fogo
                </div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3 items-center justify-center">
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="px-7 py-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-['Press_Start_2P',monospace] text-white text-xs sm:text-sm font-bold shadow-xl shadow-red-950/50 transform hover:scale-105 active:scale-95 transition flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  JOGAR AGORA
                </button>

                <button
                  type="button"
                  onClick={openLevelEditor}
                  className="px-5 py-3 rounded-xl bg-sky-950/90 hover:bg-sky-900 border-2 border-sky-500 text-sky-200 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-xl shadow-sky-950/50 transform hover:scale-105 active:scale-95 transition flex items-center gap-2 cursor-pointer"
                >
                  <Hammer className="w-4 h-4 text-sky-400" />
                  EDITOR DE FASES
                </button>

                <button
                  type="button"
                  onClick={() => setIsMultiplayerOpen(true)}
                  className="px-5 py-3 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border-2 border-emerald-500 text-emerald-300 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-xl shadow-emerald-950/50 transform hover:scale-105 active:scale-95 transition flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  MULTIPLAYER (GOOGLE)
                </button>

                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-5 py-3 rounded-xl bg-stone-900/90 hover:bg-stone-800 border-2 border-amber-500/60 text-amber-300 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-xl transition flex items-center gap-2 cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  RANKING {stats.highScore > 0 ? `(${stats.highScore.toLocaleString()})` : ''}
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={`px-5 py-3 rounded-xl border-2 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-xl transition flex items-center gap-2 cursor-pointer ${
                    isFullscreen
                      ? 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-500 text-emerald-300'
                      : 'bg-stone-900/90 hover:bg-stone-800 border-stone-600 text-stone-200'
                  }`}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  {isFullscreen ? 'SAIR TELA CHEIA' : 'TELA CHEIA'}
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
            <div
              role="dialog"
              aria-label="PAUSED"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs p-4 text-center"
            >
              <h2 className="font-['Press_Start_2P',monospace] text-2xl sm:text-4xl text-amber-400 mb-3 tracking-widest drop-shadow-[0_3px_0_rgba(0,0,0,0.9)]">
                PAUSED
              </h2>
              <p className="text-stone-300 font-mono text-xs mb-6">
                Pressione <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">ESC</kbd> ou{' '}
                <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">P</kbd> para continuar
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    togglePauseGame();
                  }}
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-['Press_Start_2P',monospace] text-xs shadow cursor-pointer"
                >
                  CONTINUAR
                </button>
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-5 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-amber-500/50 text-amber-300 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  RANKING
                </button>
                <button
                  type="button"
                  onClick={openLevelEditor}
                  className="px-5 py-2.5 rounded-lg bg-sky-900 hover:bg-sky-800 border border-sky-400/60 text-sky-200 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Hammer className="w-3.5 h-3.5 text-sky-400" />
                  EDITOR DE FASES
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRestart();
                    setIsPaused(false);
                  }}
                  className="px-6 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-['Press_Start_2P',monospace] text-xs shadow cursor-pointer"
                >
                  REINICIAR
                </button>
              </div>
            </div>
          )}

          {/* Multiplayer Winner Overlay (when any player loses all lives) */}
          {isMultiplayerMatchOver && multiplayerMatchResult && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 p-4 sm:p-6 text-center animate-in zoom-in-95 overflow-y-auto">
              <div className="flex items-center gap-2 mb-1.5">
                <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 fill-amber-400 animate-bounce" />
                <h2 className="font-['Press_Start_2P',monospace] text-lg sm:text-2xl text-amber-400 tracking-wider drop-shadow-lg">
                  FIM DE PARTIDA!
                </h2>
              </div>

              <p className="text-red-400 font-mono text-[11px] sm:text-xs mb-3">
                {multiplayerMatchResult.loserNames.join(', ')} perdeu todas as vidas!
              </p>

              {/* Winner Highlight Card */}
              <div className="w-full max-w-md rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-950/70 via-stone-900 to-stone-950 p-3 sm:p-4 mb-3 shadow-[0_0_25px_rgba(245,158,11,0.3)]">
                <div className="text-[10px] font-['Press_Start_2P',monospace] text-amber-300 mb-1.5">
                  {multiplayerMatchResult.isTie ? 'EMPATE NO 1º LUGAR!' : 'JOGADOR VENCEDOR'}
                </div>
                <div className="flex items-center justify-center gap-3">
                  {multiplayerMatchResult.winner.photoUrl ? (
                    <img
                      src={multiplayerMatchResult.winner.photoUrl}
                      alt={multiplayerMatchResult.winner.name}
                      className="w-10 h-10 rounded-full border-2 border-amber-400"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full border-2 border-amber-400 flex items-center justify-center font-['Press_Start_2P',monospace] text-xs font-bold ${
                        multiplayerMatchResult.winner.character === 'wazzima'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-red-700 text-white'
                      }`}
                    >
                      {multiplayerMatchResult.winner.character === 'wazzima' ? 'W' : 'M'}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="font-['Press_Start_2P',monospace] text-xs sm:text-sm text-white">
                      {multiplayerMatchResult.winner.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                          multiplayerMatchResult.winner.character === 'wazzima'
                            ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-500/50'
                            : 'bg-red-900/90 text-red-200 border border-red-500/50'
                        }`}
                      >
                        {multiplayerMatchResult.winner.character === 'wazzima' ? 'WazzimaGiygg' : 'Mario'}
                      </span>
                      <span className="font-['Press_Start_2P',monospace] text-xs text-amber-400">
                        {multiplayerMatchResult.winner.score} PTS
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ranked Standings */}
              <div className="w-full max-w-md bg-stone-900/90 border border-stone-700 rounded-xl p-2.5 sm:p-3 mb-4 space-y-1.5 text-left">
                {multiplayerMatchResult.standings.map((player, idx) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono ${
                      idx === 0
                        ? 'bg-amber-500/15 border border-amber-400/50 text-amber-100'
                        : 'bg-stone-950/70 border border-stone-800 text-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-['Press_Start_2P',monospace] text-[10px] text-amber-400 w-6">
                        {idx + 1}º
                      </span>
                      <span className="truncate font-bold">
                        {player.name}
                        {player.isLocal ? ' (Você)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          player.lives <= 0
                            ? 'bg-red-950 text-red-400 border border-red-700/60'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                        }`}
                      >
                        {player.lives <= 0 ? 'SEM VIDAS' : `x${player.lives}`}
                      </span>
                      <span className="font-bold text-amber-300">{player.score} pts</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rematch / Exit Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-center">
                {(!multiplayerStatus.connected || multiplayerStatus.transport === 'websocket' || multiplayerStatus.isHost) ? (
                  <button
                    type="button"
                    onClick={() => multiplayerClient.startMultiplayerRematch()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    NOVA PARTIDA
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-lg bg-stone-900 border border-amber-500/40 text-amber-300 font-mono text-xs animate-pulse">
                    Aguardando o anfitrião iniciar nova partida...
                  </div>
                )}

                {multiplayerStatus.connected && (
                  <button
                    type="button"
                    onClick={async () => {
                      await multiplayerClient.disconnect();
                      handleRestart();
                      setIsMultiplayerMatchOver(false);
                      setMultiplayerMatchResult(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 font-['Press_Start_2P',monospace] text-[10px] cursor-pointer"
                  >
                    SAIR DA SALA
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Solo Game Over Overlay */}
          {isGameOver && !isMultiplayerMatchOver && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center animate-in zoom-in-95">
              <h2 className="font-['Press_Start_2P',monospace] text-3xl sm:text-5xl text-red-600 mb-3 tracking-widest drop-shadow-lg">
                GAME OVER
              </h2>
              {stats.isNewHighScore && !isCheatActive && (
                <div className="mb-3 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs animate-bounce flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>NOVO RECORDE LOCAL!</span>
                </div>
              )}
              <p className="text-stone-300 font-mono text-sm mb-2">
                {marioPower === 'femboy' ? 'LOVE POINTS FINAIS: ' : 'PONTUAÇÃO FINAL: '}
                <span className={`font-bold text-base ${marioPower === 'femboy' ? 'text-pink-400' : 'text-amber-400'}`}>
                  {stats.score.toLocaleString()}
                </span>
              </p>
              <p className="text-stone-400 font-mono text-xs mb-5">
                RECORDE MÁXIMO: <span className="text-amber-300 font-bold">{stats.highScore.toLocaleString()}</span>
                {lastSavedRank !== null && !isCheatActive && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-bold">
                    #{lastSavedRank} NO RANKING
                  </span>
                )}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleRestart}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg transform hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  JOGAR NOVAMENTE
                </button>
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/50 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {!isCheatActive && stats.score > 0 ? 'RANKING / NOME' : 'VER RANKING'}
                </button>
              </div>
            </div>
          )}

          {/* Stage Clear & Multiplayer Waiting Banner */}
          {isStageClear && !isMultiplayerMatchOver && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 px-5 py-3 bg-black/92 border-2 border-amber-400 rounded-xl text-center shadow-2xl max-w-[92%]">
              <span className="block font-['Press_Start_2P',monospace] text-amber-400 text-xs sm:text-base">
                FASE CONCLUÍDA!
              </span>
              {stageArrivalNotice && (
                <div className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-400/70 flex items-center justify-center gap-1.5 text-emerald-200 font-mono text-[11px] sm:text-xs font-bold shadow">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{stageArrivalNotice}</span>
                </div>
              )}
              {waitingForPlayersFinish && (
                <div className="mt-2 flex items-center justify-center gap-2 text-amber-200 font-mono text-[11px] sm:text-xs animate-pulse">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>
                    Aguardando {waitingPlayersNames.join(', ')} terminar a fase...
                  </span>
                </div>
              )}
              {(allPlayersClearedReady || (!waitingForPlayersFinish && localStageCleared && multiplayerStatus.connected && multiplayerStatus.playerCount > 1)) && (
                <div className="mt-2 text-amber-300 font-mono text-[11px] sm:text-xs font-bold animate-pulse">
                  Todos terminaram! Avançando juntos para a próxima fase...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Toolbar (Audio, Settings, Fullscreen - for desktop/tablet, hidden during fullscreen) */}
      {!isFullscreen && (
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

          {/* Editor de Fases (Memória Temporária) */}
          <button
            type="button"
            onClick={openLevelEditor}
            title="Editor de Fases (Memória Temporária)"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-sky-600/50 text-sky-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <Hammer className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline text-[11px] font-bold">Editor</span>
          </button>

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
      )}

      {/* Docked Touch Controls (Shown when mobile overlay is disabled or on desktop touch mode) */}
      {(!isMobileDevice || !touchOverlayOnCanvas) && (
        <TouchControls
          variant="docked"
          controls={controls}
          onControlChange={handleControlChange}
          isPaused={isPaused}
          onTogglePause={togglePauseGame}
          isMuted={soundStatus.muted}
          onToggleMute={toggleMute}
          onRestart={handleRestart}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          multiplayerConnected={multiplayerStatus.connected}
        />
      )}

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
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        touchOverlayOnCanvas={touchOverlayOnCanvas}
        onToggleTouchOverlay={toggleTouchOverlayMode}
        onOpenLevelEditor={openLevelEditor}
      />

      {/* Leaderboard / Placar Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentScore={stats.score}
        currentCoins={stats.coins}
        currentWorld={stats.world}
        currentRunId={engineRef.current?.currentRunId}
        currentCharacter={engineRef.current?.playerCharacter || 'mario'}
        currentDifficulty={difficulty}
        isCheatActive={isCheatActive}
        onScoresCleared={() => {
          engineRef.current?.resetLocalHighScore();
          setLastSavedRank(null);
          setStats(prev => ({ ...prev, highScore: 0, isNewHighScore: false }));
        }}
        onScoreSaved={(rank) => {
          if (engineRef.current) {
            engineRef.current.lastSavedRank = rank;
          }
          setLastSavedRank(rank);
          setStats(prev => ({
            ...prev,
            highScore: getTopScore(),
          }));
        }}
      />

      {/* Cheat Menu Modal ("lula132026") */}
      <CheatMenuModal
        isOpen={isCheatMenuOpen}
        onClose={() => setIsCheatMenuOpen(false)}
        infiniteLives={engineRef.current?.infiniteLives || false}
        isFemboy={marioPower === 'femboy'}
        onToggleInfiniteLives={() => {
          engineRef.current?.toggleInfiniteLives();
          setStats({ ...engineRef.current!.stats });
        }}
        onSetPowerUp={(power: MarioPower | 'star') => {
          engineRef.current?.setPowerUp(power);
          if (engineRef.current) {
            setMarioPower(engineRef.current.marioPower);
          }
        }}
        onAddScore={(pts: number) => {
          engineRef.current?.addCheatScore(pts);
          setStats({ ...engineRef.current!.stats });
        }}
        onTeleportToEnd={() => {
          engineRef.current?.teleportToStageEnd();
          if (engineRef.current) {
            setStats({ ...engineRef.current.stats });
          }
        }}
      />

      {/* Multiplayer por IP Modal (WazzimaGiygg / Mario) */}
      <MultiplayerModal
        isOpen={isMultiplayerOpen}
        onClose={() => setIsMultiplayerOpen(false)}
      />

      {/* Editor de Fases Modal (Memória Temporária do Navegador) */}
      <LevelEditorModal
        isOpen={isLevelEditorOpen}
        onClose={() => setIsLevelEditorOpen(false)}
        customLevels={customLevels}
        activeCustomLevelId={activeCustomLevelId}
        onUpdateCustomLevels={(levels, activeId) => {
          setCustomLevels(levels);
          setActiveCustomLevelId(activeId);
        }}
        onPlayLevel={handlePlayCustomLevel}
        onBackToMainMenu={handleReturnToMainMenu}
      />

      {/* Multiplayer Logoff / Room Inactivity Toast Notification */}
      {multiplayerNotice && (
        <div
          className={`fixed top-14 z-50 px-4 py-2.5 rounded-xl border-2 font-mono text-xs shadow-2xl flex items-center gap-2 max-w-[92vw] ${
            multiplayerNotice.type === 'room_inactive'
              ? 'bg-amber-950/95 border-amber-400 text-amber-200'
              : 'bg-rose-950/95 border-rose-500 text-rose-100'
          }`}
        >
          {multiplayerNotice.type === 'room_inactive' ? (
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{multiplayerNotice.message}</span>
        </div>
      )}

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
