/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GamepadControls } from '../game/types.ts';
import { 
  ArrowLeft, ArrowRight, ArrowDown, ArrowUp, 
  Volume2, VolumeX, Pause, Play, Zap, Vibrate, 
  Maximize2, RotateCcw, Sliders
} from 'lucide-react';

interface TouchControlsProps {
  controls: GamepadControls;
  onControlChange: (key: keyof GamepadControls, active: boolean) => void;
  isPaused?: boolean;
  onTogglePause?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onRestart?: () => void;
  onToggleFullscreen?: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  controls,
  onControlChange,
  isPaused = false,
  onTogglePause,
  isMuted = false,
  onToggleMute,
  onRestart,
  onToggleFullscreen,
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

  const [showQuickSettings, setShowQuickSettings] = useState(false);

  // D-Pad Touch State & Visual Knob Position
  const dpadRef = useRef<HTMLDivElement>(null);
  const dpadTouchIdRef = useRef<number | null>(null);
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
  const triggerHaptic = useCallback((ms: number = 10) => {
    if (!hapticEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // Haptics not allowed
    }
  }, [hapticEnabled]);

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

  // --- CONTINUOUS D-PAD TOUCH PROCESSING ---
  const processDpadTouch = useCallback((clientX: number, clientY: number) => {
    if (!dpadRef.current) return;
    const rect = dpadRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2 - 8;

    // Visual knob position with clamped radius
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = clampedDist * Math.cos(angle);
    const ky = clampedDist * Math.sin(angle);
    setKnobPos({ x: kx, y: ky });

    // Direction calculation with deadzone (8px)
    const deadzone = 8;
    const threshold = 12;

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
  }, [onControlChange, triggerHaptic]);

  const releaseDpad = useCallback(() => {
    dpadTouchIdRef.current = null;
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

  const handleDpadTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dpadTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    dpadTouchIdRef.current = touch.identifier;
    processDpadTouch(touch.clientX, touch.clientY);
  };

  const handleDpadTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dpadTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === dpadTouchIdRef.current) {
        processDpadTouch(touch.clientX, touch.clientY);
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

  // --- ACTION BUTTONS (MULTI-TOUCH) ---
  const handleButtonTouchStart = (buttonType: 'jump' | 'run' | 'combo') => (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    btnTouchesRef.current.set(touch.identifier, buttonType);

    if (buttonType === 'jump') {
      triggerHaptic(14);
      onControlChange('jump', true);
    } else if (buttonType === 'run') {
      triggerHaptic(10);
      onControlChange('run', true);
    } else if (buttonType === 'combo') {
      // Combo B+A: Dash + Jump simultaneously!
      triggerHaptic(18);
      onControlChange('run', true);
      onControlChange('jump', true);
    }
  };

  const handleButtonTouchEnd = (buttonType: 'jump' | 'run' | 'combo') => (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      btnTouchesRef.current.delete(e.changedTouches[i].identifier);
    }

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

  // Size scales
  const isLarge = controlSize === 'large';
  const dpadSizeClass = isLarge ? 'w-44 h-44 sm:w-48 sm:h-48' : 'w-36 h-36 sm:w-40 sm:h-40';
  const btnSizeClass = isLarge ? 'w-18 h-18 sm:w-20 sm:h-20 text-xl' : 'w-15 h-15 sm:w-16 sm:h-16 text-lg';

  return (
    <div className="w-full bg-stone-950/95 backdrop-blur-md select-none touch-none border-t border-stone-800/80 px-3 sm:px-6 py-2.5 sm:py-4 transition-all">
      {/* Top Mobile Quick-Actions Bar */}
      <div className="max-w-4xl mx-auto flex items-center justify-between pb-2 mb-1 border-b border-stone-800/50 text-xs">
        {/* Left: Auto-Run & Haptics Toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Auto-Run Toggle */}
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

          {/* Haptic Toggle */}
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

          {/* Size Toggle */}
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

        {/* Right: Quick In-Game Controls (Pause, Mute, Restart, Fullscreen) */}
        <div className="flex items-center gap-1.5">
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
              title="Tela Cheia"
              className="p-1.5 rounded-md bg-stone-900 border border-stone-800 text-stone-400 hover:text-white"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Gamepad Surface: D-Pad (Left) and Action Buttons (Right) */}
      <div className="max-w-4xl mx-auto flex items-center justify-between select-none">
        {/* --- CONTINUOUS ERGONOMIC VIRTUAL D-PAD --- */}
        <div className="flex flex-col items-center">
          <div
            ref={dpadRef}
            className={`relative ${dpadSizeClass} rounded-full bg-stone-900 border-4 border-stone-800 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.5)] touch-none flex items-center justify-center select-none active:border-stone-700`}
            onTouchStart={handleDpadTouchStart}
            onTouchMove={handleDpadTouchMove}
            onTouchEnd={handleDpadTouchEnd}
            onTouchCancel={handleDpadTouchEnd}
          >
            {/* Directional Cross Emboss Background */}
            <div className="absolute inset-2 flex items-center justify-center pointer-events-none opacity-40">
              <div className="w-10 h-full bg-stone-800/80 rounded-sm"></div>
              <div className="absolute h-10 w-full bg-stone-800/80 rounded-sm"></div>
            </div>

            {/* UP Arrow Indicator */}
            <div
              className={`absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.up ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowUp className="w-5 h-5" />
            </div>

            {/* DOWN Arrow Indicator (Crouch / Enter Pipe) */}
            <div
              className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.down ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowDown className="w-5 h-5" />
            </div>

            {/* LEFT Arrow Indicator */}
            <div
              className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.left ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </div>

            {/* RIGHT Arrow Indicator */}
            <div
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.right ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowRight className="w-5 h-5" />
            </div>

            {/* Dynamic Thumbstick Knob / Center Tactile Cap */}
            <div
              className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-stone-700 via-stone-800 to-stone-900 border-2 border-stone-600 shadow-[0_2px_8px_rgba(0,0,0,0.6)] flex items-center justify-center pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              }}
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tl from-stone-900 to-stone-700 border border-stone-600/60 shadow-inner flex items-center justify-center">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  controls.left || controls.right || controls.up || controls.down ? 'bg-amber-400' : 'bg-stone-500'
                }`} />
              </div>
            </div>
          </div>
          <span className="text-[9px] font-mono text-stone-500 mt-1 uppercase tracking-wider">Direcional</span>
        </div>

        {/* --- ERGONOMIC ACTION BUTTONS ZONE (RIGHT THUMB) --- */}
        <div className="flex flex-col items-end">
          <div className="relative flex items-center gap-3 sm:gap-5 pr-1">
            {/* [B + A Combo Button] - Running Jump Shortcut for Mobile */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 active:from-purple-700 active:to-purple-900 border-2 border-purple-400/80 shadow-[0_3px_8px_rgba(147,51,234,0.3)] flex flex-col items-center justify-center text-white font-['Press_Start_2P',monospace] text-[9px] font-bold transform active:scale-95 transition-all select-none touch-none"
                onTouchStart={handleButtonTouchStart('combo')}
                onTouchEnd={handleButtonTouchEnd('combo')}
                onTouchCancel={handleButtonTouchEnd('combo')}
              >
                <span>B+A</span>
              </button>
              <span className="text-[8px] font-mono text-purple-300 font-bold mt-1">COMBO</span>
            </div>

            {/* [B Button] - Run / Fireball */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                className={`${btnSizeClass} rounded-full border-4 border-stone-900 flex flex-col items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-[0_4px_10px_rgba(0,0,0,0.6)] transform active:translate-y-1 transition-all select-none touch-none ${
                  controls.run || autoRunEnabled
                    ? 'bg-gradient-to-br from-red-600 to-red-800 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_0_12px_rgba(239,68,68,0.5)] translate-y-0.5'
                    : 'bg-gradient-to-br from-red-500 to-red-700 active:from-red-600 active:to-red-800'
                }`}
                onTouchStart={handleButtonTouchStart('run')}
                onTouchEnd={handleButtonTouchEnd('run')}
                onTouchCancel={handleButtonTouchEnd('run')}
              >
                <span>B</span>
              </button>
              <span className="text-[9px] font-['Press_Start_2P',monospace] text-stone-400 mt-1">
                {autoRunEnabled ? 'CORRENDO' : 'CORRER'}
              </span>
            </div>

            {/* [A Button] - Jump (Slightly raised for natural thumb resting angle) */}
            <div className="flex flex-col items-center -translate-y-3">
              <button
                type="button"
                className={`${btnSizeClass} rounded-full border-4 border-stone-900 flex flex-col items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-[0_6px_14px_rgba(0,0,0,0.7)] transform active:translate-y-1 transition-all select-none touch-none ${
                  controls.jump
                    ? 'bg-gradient-to-br from-red-600 to-red-800 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_0_14px_rgba(239,68,68,0.6)] translate-y-0.5'
                    : 'bg-gradient-to-br from-red-500 to-red-700 active:from-red-600 active:to-red-800'
                }`}
                onTouchStart={handleButtonTouchStart('jump')}
                onTouchEnd={handleButtonTouchEnd('jump')}
                onTouchCancel={handleButtonTouchEnd('jump')}
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
