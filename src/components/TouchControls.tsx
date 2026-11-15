/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GamepadControls } from '../game/types.ts';
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Zap,
  Vibrate,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  Users,
  Settings,
} from 'lucide-react';

interface TouchControlsProps {
  controls: GamepadControls;
  onControlChange: (key: keyof GamepadControls, active: boolean) => void;
  isPaused?: boolean;
  onTogglePause?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onRestart?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenMultiplayer?: () => void;
  onOpenSettings?: () => void;
  multiplayerConnected?: boolean;
  /** 'canvas-overlay' renders translucent controls directly over the canvas; 'docked' renders the solid gamepad bar below */
  variant?: 'canvas-overlay' | 'docked';
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  controls,
  onControlChange,
  isPaused = false,
  onTogglePause,
  isMuted = false,
  onToggleMute,
  onRestart,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenMultiplayer,
  onOpenSettings,
  multiplayerConnected = false,
  variant = 'docked',
}) => {
  // Mobile preferences (persisted in localStorage)
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smb_mobile_haptic');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [autoRunEnabled, setAutoRunEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smb_mobile_autorun');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [controlSize, setControlSize] = useState<'normal' | 'large'>(() => {
    try {
      const saved = localStorage.getItem('smb_mobile_size');
      return saved === 'large' ? 'large' : 'normal';
    } catch {
      return 'normal';
    }
  });

  const [isCompactLandscape, setIsCompactLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight && window.innerHeight <= 540;
  });

  useEffect(() => {
    const updateOrientationLayout = () => {
      setIsCompactLandscape(window.innerWidth > window.innerHeight && window.innerHeight <= 540);
    };
    window.addEventListener('resize', updateOrientationLayout);
    window.addEventListener('orientationchange', updateOrientationLayout);
    return () => {
      window.removeEventListener('resize', updateOrientationLayout);
      window.removeEventListener('orientationchange', updateOrientationLayout);
    };
  }, []);

  // D-Pad Touch / Mouse State & Visual Knob Position
  const dpadRef = useRef<HTMLDivElement>(null);
  const dpadTouchIdRef = useRef<number | null>(null);
  const dpadMouseActiveRef = useRef<boolean>(false);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeDirectionsRef = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  // Action Buttons Touch State
  const btnTouchesRef = useRef<Map<number, string>>(new Map());

  // Haptic Feedback Helper
  const triggerHaptic = useCallback(
    (ms: number = 10) => {
      if (!hapticEnabled) return;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(ms);
        }
      } catch {
        // Haptics not allowed
      }
    },
    [hapticEnabled]
  );

  // Sync Auto-Run state with GameEngine controls
  useEffect(() => {
    if (autoRunEnabled) {
      onControlChange('run', true);
    } else {
      onControlChange('run', false);
    }
    try {
      localStorage.setItem('smb_mobile_autorun', String(autoRunEnabled));
    } catch {
      // ignore
    }
  }, [autoRunEnabled, onControlChange]);

  // Persist Haptic Preference
  const toggleHaptic = () => {
    const next = !hapticEnabled;
    setHapticEnabled(next);
    if (next) triggerHaptic(20);
    try {
      localStorage.setItem('smb_mobile_haptic', String(next));
    } catch {
      // ignore
    }
  };

  // Toggle Auto-Run
  const toggleAutoRun = () => {
    const next = !autoRunEnabled;
    setAutoRunEnabled(next);
    triggerHaptic(next ? 25 : 15);
  };

  // Toggle Size
  const toggleSize = () => {
    const next = controlSize === 'normal' ? 'large' : 'normal';
    setControlSize(next);
    triggerHaptic(15);
    try {
      localStorage.setItem('smb_mobile_size', next);
    } catch {
      // ignore
    }
  };

  // --- CONTINUOUS D-PAD INPUT PROCESSING ---
  const processDpadPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!dpadRef.current) return;
      const rect = dpadRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const maxRadius = rect.width / 2 - 8;

      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const kx = clampedDist * Math.cos(angle);
      const ky = clampedDist * Math.sin(angle);
      setKnobPos({ x: kx, y: ky });

      const deadzone = 7;
      const threshold = 10;

      let nextLeft = false;
      let nextRight = false;
      let nextUp = false;
      let nextDown = false;

      if (dist > deadzone) {
        if (dx < -threshold) nextLeft = true;
        if (dx > threshold) nextRight = true;
        if (dy < -threshold) nextUp = true;
        if (dy > threshold) nextDown = true;
      }

      const prev = activeDirectionsRef.current;
      let directionChanged = false;

      if (prev.left !== nextLeft) {
        activeDirectionsRef.current.left = nextLeft;
        onControlChange('left', nextLeft);
        directionChanged = true;
      }
      if (prev.right !== nextRight) {
        activeDirectionsRef.current.right = nextRight;
        onControlChange('right', nextRight);
        directionChanged = true;
      }
      if (prev.up !== nextUp) {
        activeDirectionsRef.current.up = nextUp;
        onControlChange('up', nextUp);
        directionChanged = true;
      }
      if (prev.down !== nextDown) {
        activeDirectionsRef.current.down = nextDown;
        onControlChange('down', nextDown);
        directionChanged = true;
      }

      if (directionChanged && (nextLeft || nextRight || nextUp || nextDown)) {
        triggerHaptic(8);
      }
    },
    [onControlChange, triggerHaptic]
  );

  const releaseDpad = useCallback(() => {
    dpadTouchIdRef.current = null;
    dpadMouseActiveRef.current = false;
    setKnobPos({ x: 0, y: 0 });

    if (activeDirectionsRef.current.left) {
      activeDirectionsRef.current.left = false;
      onControlChange('left', false);
    }
    if (activeDirectionsRef.current.right) {
      activeDirectionsRef.current.right = false;
      onControlChange('right', false);
    }
    if (activeDirectionsRef.current.up) {
      activeDirectionsRef.current.up = false;
      onControlChange('up', false);
    }
    if (activeDirectionsRef.current.down) {
      activeDirectionsRef.current.down = false;
      onControlChange('down', false);
    }
  }, [onControlChange]);

  // Global mouse release safety for D-pad drag testing
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (dpadMouseActiveRef.current) {
        processDpadPoint(e.clientX, e.clientY);
      }
    };
    const handleWindowMouseUp = () => {
      if (dpadMouseActiveRef.current) {
        releaseDpad();
      }
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [processDpadPoint, releaseDpad]);

  const handleDpadTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dpadTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    dpadTouchIdRef.current = touch.identifier;
    processDpadPoint(touch.clientX, touch.clientY);
  };

  const handleDpadTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dpadTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === dpadTouchIdRef.current) {
        processDpadPoint(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleDpadTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dpadTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === dpadTouchIdRef.current) {
        releaseDpad();
        break;
      }
    }
  };

  const handleDpadMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dpadTouchIdRef.current !== null) return;
    e.preventDefault();
    dpadMouseActiveRef.current = true;
    processDpadPoint(e.clientX, e.clientY);
  };

  // --- ACTION BUTTONS (MULTI-TOUCH + MOUSE FALLBACK) ---
  const activateButton = (buttonType: 'jump' | 'run' | 'combo') => {
    if (buttonType === 'jump') {
      triggerHaptic(14);
      onControlChange('jump', true);
    } else if (buttonType === 'run') {
      triggerHaptic(10);
      onControlChange('run', true);
    } else if (buttonType === 'combo') {
      triggerHaptic(18);
      onControlChange('run', true);
      onControlChange('jump', true);
    }
  };

  const deactivateButton = (buttonType: 'jump' | 'run' | 'combo') => {
    if (buttonType === 'jump') {
      onControlChange('jump', false);
    } else if (buttonType === 'run') {
      if (!autoRunEnabled) {
        onControlChange('run', false);
      }
    } else if (buttonType === 'combo') {
      onControlChange('jump', false);
      if (!autoRunEnabled) {
        onControlChange('run', false);
      }
    }
  };

  const handleButtonTouchStart = (buttonType: 'jump' | 'run' | 'combo') => (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    btnTouchesRef.current.set(touch.identifier, buttonType);
    activateButton(buttonType);
  };

  const handleButtonTouchEnd = (buttonType: 'jump' | 'run' | 'combo') => (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      btnTouchesRef.current.delete(e.changedTouches[i].identifier);
    }
    deactivateButton(buttonType);
  };

  const handleButtonMouseDown = (buttonType: 'jump' | 'run' | 'combo') => (e: React.MouseEvent) => {
    e.preventDefault();
    activateButton(buttonType);
  };

  const handleButtonMouseUp = (buttonType: 'jump' | 'run' | 'combo') => (e: React.MouseEvent) => {
    e.preventDefault();
    deactivateButton(buttonType);
  };

  // Layout & Size scales
  const isLarge = controlSize === 'large';
  const isCanvasOverlay = variant === 'canvas-overlay';
  const isOverlayLandscape = isFullscreen && isCompactLandscape;
  const isTranslucentOverlay = isCanvasOverlay || isOverlayLandscape;

  const dpadSizeClass = isCanvasOverlay
    ? isLarge
      ? 'w-32 h-32 sm:w-36 sm:h-36'
      : 'w-26 h-26 sm:w-32 sm:h-32'
    : isOverlayLandscape
    ? isLarge
      ? 'w-36 h-36'
      : 'w-32 h-32'
    : isLarge
    ? 'w-44 h-44 sm:w-48 sm:h-48'
    : 'w-36 h-36 sm:w-40 sm:h-40';

  const btnSizeClass = isCanvasOverlay
    ? isLarge
      ? 'w-14 h-14 sm:w-16 sm:h-16 text-base'
      : 'w-12 h-12 sm:w-14 sm:h-14 text-sm'
    : isOverlayLandscape
    ? isLarge
      ? 'w-15 h-15 text-lg'
      : 'w-13 h-13 text-base'
    : isLarge
    ? 'w-18 h-18 sm:w-20 sm:h-20 text-xl'
    : 'w-15 h-15 sm:w-16 sm:h-16 text-lg';

  const comboBtnSizeClass = isCanvasOverlay
    ? 'w-9 h-9 sm:w-11 sm:h-11 text-[8px]'
    : 'w-12 h-12 sm:w-14 sm:h-14 text-[9px]';

  // --- TRANSLUCENT ON-CANVAS OVERLAY LAYOUT ---
  if (isCanvasOverlay) {
    return (
      <div
        aria-label="Controles táteis na tela"
        className="pointer-events-none absolute inset-0 z-[15] flex flex-col justify-between p-2 sm:p-3 select-none touch-none"
      >
        {/* Top Translucent Quick-Actions Strip */}
        <div className="pointer-events-auto flex items-center justify-between gap-1.5 bg-stone-950/45 backdrop-blur-[2px] border border-white/15 rounded-lg px-2 py-1 text-[9px] shadow-md">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleAutoRun}
              title="Trava de Corrida (Auto-Run)"
              className={`px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 border transition cursor-pointer ${
                autoRunEnabled
                  ? 'bg-amber-500/45 border-amber-300 text-amber-100'
                  : 'bg-black/40 border-white/15 text-stone-300'
              }`}
            >
              <Zap className={`w-3 h-3 ${autoRunEnabled ? 'text-amber-300 fill-amber-300' : 'text-stone-400'}`} />
              <span>AUTO</span>
            </button>

            <button
              type="button"
              onClick={toggleHaptic}
              title={hapticEnabled ? 'Vibração Ativada' : 'Vibração Desativada'}
              className={`p-1 rounded border transition cursor-pointer ${
                hapticEnabled
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200'
                  : 'bg-black/40 border-white/15 text-stone-400'
              }`}
            >
              <Vibrate className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={toggleSize}
              title="Tamanho dos Botões"
              className="p-1 rounded bg-black/40 border border-white/15 text-stone-200 cursor-pointer"
            >
              <Sliders className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {onOpenMultiplayer && (
              <button
                type="button"
                onClick={onOpenMultiplayer}
                title="Multiplayer"
                className={`p-1 rounded border transition cursor-pointer ${
                  multiplayerConnected
                    ? 'bg-emerald-600/50 border-emerald-400 text-emerald-100'
                    : 'bg-black/40 border-white/15 text-emerald-300'
                }`}
              >
                <Users className="w-3 h-3" />
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Configurações"
                className="p-1 rounded bg-black/40 border border-white/15 text-amber-300 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
              </button>
            )}

            {onToggleMute && (
              <button
                type="button"
                onClick={onToggleMute}
                title={isMuted ? 'Desmutar Som' : 'Mutar Som'}
                className="p-1 rounded bg-black/40 border border-white/15 text-stone-200 cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-amber-300" />}
              </button>
            )}

            {onTogglePause && (
              <button
                type="button"
                onClick={onTogglePause}
                title={isPaused ? 'Continuar' : 'Pausar'}
                className={`px-2 py-0.5 rounded border font-['Press_Start_2P',monospace] text-[8px] flex items-center gap-1 cursor-pointer ${
                  isPaused
                    ? 'bg-amber-500/80 text-black border-amber-300 font-bold'
                    : 'bg-black/45 border-white/20 text-stone-100'
                }`}
              >
                {isPaused ? <Play className="w-2.5 h-2.5 fill-black" /> : <Pause className="w-2.5 h-2.5" />}
                <span>{isPaused ? 'VOLTAR' : 'PAUSA'}</span>
              </button>
            )}

            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                title="Reiniciar"
                className="p-1 rounded bg-black/40 border border-white/15 text-stone-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}

            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                className={`p-1 rounded border cursor-pointer ${
                  isFullscreen
                    ? 'bg-emerald-600/45 border-emerald-400 text-emerald-100'
                    : 'bg-black/40 border-amber-400/50 text-amber-300'
                }`}
              >
                {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Bottom Translucent D-Pad (Left) & A / B Action Buttons (Right) */}
        <div className="w-full flex items-end justify-between pb-1">
          {/* Translucent Virtual D-Pad */}
          <div className="pointer-events-auto flex flex-col items-center">
            <div
              ref={dpadRef}
              aria-label="Direcional D-Pad"
              className={`relative ${dpadSizeClass} rounded-full bg-stone-950/35 backdrop-blur-[2px] border-2 border-white/25 shadow-[0_4px_16px_rgba(0,0,0,0.4)] touch-none flex items-center justify-center select-none`}
              onTouchStart={handleDpadTouchStart}
              onTouchMove={handleDpadTouchMove}
              onTouchEnd={handleDpadTouchEnd}
              onTouchCancel={handleDpadTouchEnd}
              onMouseDown={handleDpadMouseDown}
            >
              {/* Translucent Cross Guides */}
              <div className="absolute inset-2 flex items-center justify-center pointer-events-none opacity-30">
                <div className="w-7 h-full bg-white/25 rounded-sm" />
                <div className="absolute h-7 w-full bg-white/25 rounded-sm" />
              </div>

              {/* UP */}
              <div
                className={`absolute top-1.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  controls.up ? 'bg-amber-400/85 text-black scale-110' : 'text-white/75'
                }`}
              >
                <ArrowUp className="w-4 h-4" />
              </div>

              {/* DOWN */}
              <div
                className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  controls.down ? 'bg-amber-400/85 text-black scale-110' : 'text-white/75'
                }`}
              >
                <ArrowDown className="w-4 h-4" />
              </div>

              {/* LEFT */}
              <div
                className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  controls.left ? 'bg-amber-400/85 text-black scale-110' : 'text-white/75'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
              </div>

              {/* RIGHT */}
              <div
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  controls.right ? 'bg-amber-400/85 text-black scale-110' : 'text-white/75'
                }`}
              >
                <ArrowRight className="w-4 h-4" />
              </div>

              {/* Translucent Center Knob */}
              <div
                className="absolute w-9 h-9 rounded-full bg-white/20 backdrop-blur-xs border border-white/45 shadow flex items-center justify-center pointer-events-none transition-transform duration-75"
                style={{
                  transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                }}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    controls.left || controls.right || controls.up || controls.down
                      ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]'
                      : 'bg-white/50'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Translucent Action Buttons (B+A Combo, B = Run/Fire, A = Jump) */}
          <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
            {/* Combo B+A */}
            <div className="flex flex-col items-center mb-1">
              <button
                type="button"
                aria-label="Botão Combo Correr e Pular"
                className={`${comboBtnSizeClass} rounded-full bg-purple-600/45 active:bg-purple-500/80 backdrop-blur-[2px] border-2 border-purple-200/50 flex items-center justify-center text-white/95 font-['Press_Start_2P',monospace] font-bold shadow-lg transition-transform active:scale-95 select-none touch-none`}
                onTouchStart={handleButtonTouchStart('combo')}
                onTouchEnd={handleButtonTouchEnd('combo')}
                onTouchCancel={handleButtonTouchEnd('combo')}
                onMouseDown={handleButtonMouseDown('combo')}
                onMouseUp={handleButtonMouseUp('combo')}
                onMouseLeave={handleButtonMouseUp('combo')}
              >
                B+A
              </button>
            </div>

            {/* B Button (Run / Fire) */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                aria-label="Botão B Correr"
                className={`${btnSizeClass} rounded-full border-2 backdrop-blur-[2px] flex items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-lg transition-all select-none touch-none ${
                  controls.run || autoRunEnabled
                    ? 'bg-red-500/75 border-red-200 scale-95 shadow-[0_0_14px_rgba(239,68,68,0.65)]'
                    : 'bg-red-600/40 border-red-200/60 active:bg-red-500/75'
                }`}
                onTouchStart={handleButtonTouchStart('run')}
                onTouchEnd={handleButtonTouchEnd('run')}
                onTouchCancel={handleButtonTouchEnd('run')}
                onMouseDown={handleButtonMouseDown('run')}
                onMouseUp={handleButtonMouseUp('run')}
                onMouseLeave={handleButtonMouseUp('run')}
              >
                B
              </button>
              <span className="text-[8px] font-['Press_Start_2P',monospace] text-white/80 drop-shadow mt-0.5">
                B
              </span>
            </div>

            {/* A Button (Jump) */}
            <div className="flex flex-col items-center -translate-y-2.5">
              <button
                type="button"
                aria-label="Botão A Pular"
                className={`${btnSizeClass} rounded-full border-2 backdrop-blur-[2px] flex items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-lg transition-all select-none touch-none ${
                  controls.jump
                    ? 'bg-amber-400/80 border-amber-100 text-black scale-95 shadow-[0_0_16px_rgba(251,191,36,0.7)]'
                    : 'bg-amber-500/45 border-amber-200/70 active:bg-amber-400/80'
                }`}
                onTouchStart={handleButtonTouchStart('jump')}
                onTouchEnd={handleButtonTouchEnd('jump')}
                onTouchCancel={handleButtonTouchEnd('jump')}
                onMouseDown={handleButtonMouseDown('jump')}
                onMouseUp={handleButtonMouseUp('jump')}
                onMouseLeave={handleButtonMouseUp('jump')}
              >
                A
              </button>
              <span className="text-[8px] font-['Press_Start_2P',monospace] text-amber-200/90 drop-shadow mt-0.5">
                PULAR
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DOCKED / LANDSCAPE GAMEPAD BAR LAYOUT ---
  return (
    <div
      className={
        isOverlayLandscape
          ? 'pointer-events-none absolute inset-x-0 bottom-0 z-30 w-full select-none touch-none px-3 pb-2 pt-1 transition-all'
          : 'w-full bg-stone-950/95 backdrop-blur-md select-none touch-none border-t border-stone-800/80 px-3 sm:px-6 py-2.5 sm:py-4 transition-all'
      }
    >
      {/* Top Mobile Quick-Actions Bar */}
      <div
        className={`pointer-events-auto max-w-4xl mx-auto flex items-center justify-between text-xs ${
          isOverlayLandscape
            ? 'pb-1.5 mb-1 bg-stone-950/70 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-stone-800/70'
            : 'pb-2 mb-1 border-b border-stone-800/50'
        }`}
      >
        {/* Left: Auto-Run & Haptics Toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleAutoRun}
            title="Trava de Corrida (Auto-Run)"
            className={`px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              autoRunEnabled
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-300'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${autoRunEnabled ? 'text-amber-400 fill-amber-400' : 'text-stone-500'}`} />
            <span>AUTO-CORRER</span>
            <span className={`w-2 h-2 rounded-full ${autoRunEnabled ? 'bg-amber-400 animate-pulse' : 'bg-stone-600'}`} />
          </button>

          <button
            type="button"
            onClick={toggleHaptic}
            title={hapticEnabled ? 'Vibração Ativada' : 'Vibração Desativada'}
            className={`p-1.5 rounded-md border text-[10px] flex items-center gap-1 transition cursor-pointer ${
              hapticEnabled
                ? 'bg-stone-900 border-emerald-600/60 text-emerald-300'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
          >
            <Vibrate className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{hapticEnabled ? 'VIBRAR' : 'MUDO'}</span>
          </button>

          <button
            type="button"
            onClick={toggleSize}
            title="Tamanho dos Botões"
            className="p-1.5 rounded-md bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 text-[10px] flex items-center gap-1 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-stone-400" />
            <span className="hidden xs:inline">{isLarge ? 'GRANDE' : 'NORMAL'}</span>
          </button>
        </div>

        {/* Right: Quick In-Game Controls */}
        <div className="flex items-center gap-1.5">
          {onOpenMultiplayer && (
            <button
              type="button"
              onClick={onOpenMultiplayer}
              title="Multiplayer Online (Login Google)"
              className={`p-1.5 rounded-md border transition cursor-pointer ${
                multiplayerConnected
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                  : 'bg-stone-900 border-emerald-700/60 text-emerald-400 hover:text-emerald-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Fases, Modo Infinito e Configurações"
              className="p-1.5 rounded-md bg-stone-900 border border-stone-800 text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? 'Desmutar Som' : 'Mutar Som'}
              className="p-1.5 rounded-md bg-stone-900 border border-stone-800 text-stone-300 hover:text-white"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          )}

          {onTogglePause && (
            <button
              type="button"
              onClick={onTogglePause}
              title={isPaused ? 'Continuar' : 'Pausar'}
              className={`px-2.5 py-1 rounded-md border font-['Press_Start_2P',monospace] text-[9px] flex items-center gap-1 ${
                isPaused
                  ? 'bg-amber-600 text-black border-amber-400 font-bold'
                  : 'bg-stone-900 border-stone-800 text-stone-300'
              }`}
            >
              {isPaused ? <Play className="w-3 h-3 fill-black" /> : <Pause className="w-3 h-3" />}
              <span>{isPaused ? 'VOLTAR' : 'PAUSA'}</span>
            </button>
          )}

          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              title="Reiniciar Jogo"
              className="p-1.5 rounded-md bg-stone-900 border border-stone-800 text-stone-400 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
              className={`px-2 py-1 rounded-md border flex items-center gap-1 text-[9px] font-bold transition cursor-pointer ${
                isFullscreen
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                  : 'bg-stone-900 border-amber-500/50 text-amber-300 hover:text-white'
              }`}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden xs:inline">{isFullscreen ? 'SAIR' : 'TELA'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Gamepad Surface: D-Pad (Left) and Action Buttons (Right) */}
      <div
        className={`max-w-4xl mx-auto flex items-center justify-between select-none ${
          isTranslucentOverlay ? 'opacity-85' : ''
        }`}
      >
        {/* --- CONTINUOUS ERGONOMIC VIRTUAL D-PAD --- */}
        <div className="pointer-events-auto flex flex-col items-center">
          <div
            ref={dpadRef}
            className={`relative ${dpadSizeClass} rounded-full bg-stone-900/80 border-4 border-stone-800/90 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.5)] touch-none flex items-center justify-center select-none active:border-stone-700`}
            onTouchStart={handleDpadTouchStart}
            onTouchMove={handleDpadTouchMove}
            onTouchEnd={handleDpadTouchEnd}
            onTouchCancel={handleDpadTouchEnd}
            onMouseDown={handleDpadMouseDown}
          >
            <div className="absolute inset-2 flex items-center justify-center pointer-events-none opacity-40">
              <div className="w-10 h-full bg-stone-800/80 rounded-sm"></div>
              <div className="absolute h-10 w-full bg-stone-800/80 rounded-sm"></div>
            </div>

            <div
              className={`absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.up ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowUp className="w-5 h-5" />
            </div>

            <div
              className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.down ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowDown className="w-5 h-5" />
            </div>

            <div
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.left ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </div>

            <div
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.right ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowRight className="w-5 h-5" />
            </div>

            <div
              className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-stone-700 via-stone-800 to-stone-900 border-2 border-stone-600 shadow-[0_2px_8px_rgba(0,0,0,0.6)] flex items-center justify-center pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              }}
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tl from-stone-900 to-stone-700 border border-stone-600/60 shadow-inner flex items-center justify-center">
                <div
                  className={`w-2 h-2 rounded-full transition-colors ${
                    controls.left || controls.right || controls.up || controls.down ? 'bg-amber-400' : 'bg-stone-500'
                  }`}
                />
              </div>
            </div>
          </div>
          <span className="text-[9px] font-mono text-stone-500 mt-1 uppercase tracking-wider">Direcional</span>
        </div>

        {/* --- ERGONOMIC ACTION BUTTONS ZONE (RIGHT THUMB) --- */}
        <div className="pointer-events-auto flex flex-col items-end">
          <div className="relative flex items-center gap-3 sm:gap-5 pr-1">
            <div className="flex flex-col items-center">
              <button
                type="button"
                className={`${comboBtnSizeClass} rounded-full bg-gradient-to-br from-purple-600/85 to-purple-800/85 active:from-purple-700 active:to-purple-900 border-2 border-purple-400/80 shadow-[0_3px_8px_rgba(147,51,234,0.3)] flex flex-col items-center justify-center text-white font-['Press_Start_2P',monospace] font-bold transform active:scale-95 transition-all select-none touch-none`}
                onTouchStart={handleButtonTouchStart('combo')}
                onTouchEnd={handleButtonTouchEnd('combo')}
                onTouchCancel={handleButtonTouchEnd('combo')}
                onMouseDown={handleButtonMouseDown('combo')}
                onMouseUp={handleButtonMouseUp('combo')}
                onMouseLeave={handleButtonMouseUp('combo')}
              >
                <span>B+A</span>
              </button>
              <span className="text-[8px] font-mono text-purple-300 font-bold mt-1">COMBO</span>
            </div>

            <div className="flex flex-col items-center">
              <button
                type="button"
                className={`${btnSizeClass} rounded-full border-4 border-stone-900 flex flex-col items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-[0_4px_10px_rgba(0,0,0,0.6)] transform active:translate-y-1 transition-all select-none touch-none ${
                  controls.run || autoRunEnabled
                    ? 'bg-gradient-to-br from-red-600/90 to-red-800/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_0_12px_rgba(239,68,68,0.5)] translate-y-0.5'
                    : 'bg-gradient-to-br from-red-500/80 to-red-700/80 active:from-red-600 active:to-red-800'
                }`}
                onTouchStart={handleButtonTouchStart('run')}
                onTouchEnd={handleButtonTouchEnd('run')}
                onTouchCancel={handleButtonTouchEnd('run')}
                onMouseDown={handleButtonMouseDown('run')}
                onMouseUp={handleButtonMouseUp('run')}
                onMouseLeave={handleButtonMouseUp('run')}
              >
                <span>B</span>
              </button>
              <span className="text-[9px] font-['Press_Start_2P',monospace] text-stone-400 mt-1">
                {autoRunEnabled ? 'CORRENDO' : 'CORRER'}
              </span>
            </div>

            <div className="flex flex-col items-center -translate-y-3">
              <button
                type="button"
                className={`${btnSizeClass} rounded-full border-4 border-stone-900 flex flex-col items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-[0_6px_14px_rgba(0,0,0,0.7)] transform active:translate-y-1 transition-all select-none touch-none ${
                  controls.jump
                    ? 'bg-gradient-to-br from-red-600/90 to-red-800/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_0_14px_rgba(239,68,68,0.6)] translate-y-0.5'
                    : 'bg-gradient-to-br from-red-500/80 to-red-700/80 active:from-red-600 active:to-red-800'
                }`}
                onTouchStart={handleButtonTouchStart('jump')}
                onTouchEnd={handleButtonTouchEnd('jump')}
                onTouchCancel={handleButtonTouchEnd('jump')}
                onMouseDown={handleButtonMouseDown('jump')}
                onMouseUp={handleButtonMouseUp('jump')}
                onMouseLeave={handleButtonMouseUp('jump')}
              >
                <span>A</span>
              </button>
              <span className="text-[9px] font-['Press_Start_2P',monospace] text-stone-300 font-bold mt-1">PULAR</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
