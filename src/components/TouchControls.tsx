/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GamepadControls, ReservePowerItem } from '../game/types.ts';
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
  onSelectAction?: () => void;
  reservePowerUp?: ReservePowerItem | null;
  canExitClearedWorldStage?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onRestart?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenMultiplayer?: () => void;
  onOpenSettings?: () => void;
  multiplayerConnected?: boolean;
  /** 'canvas-overlay' renders transparent controls directly over the canvas; 'docked' renders the solid gamepad bar below */
  variant?: 'canvas-overlay' | 'docked';
}

interface ActionHitResult {
  a: boolean;
  b: boolean;
  combo: boolean;
  spin: boolean;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  controls,
  onControlChange,
  isPaused = false,
  onTogglePause,
  onSelectAction,
  reservePowerUp = null,
  canExitClearedWorldStage = false,
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

  // Action Buttons Zone & Multi-Touch / Slide Hit-Detection Refs
  const actionZoneRef = useRef<HTMLDivElement>(null);
  const btnBRef = useRef<HTMLButtonElement>(null);
  const btnARef = useRef<HTMLButtonElement>(null);
  const btnComboRef = useRef<HTMLButtonElement>(null);
  const btnSpinRef = useRef<HTMLButtonElement>(null);
  const actionTouchIdsRef = useRef<Set<number>>(new Set());
  const actionMouseActiveRef = useRef<boolean>(false);
  const activeActionsRef = useRef<{ jump: boolean; run: boolean; spinJump: boolean }>({
    jump: false,
    run: false,
    spinJump: false,
  });
  const [pressedButtons, setPressedButtons] = useState<ActionHitResult>({
    a: false,
    b: false,
    combo: false,
    spin: false,
  });

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
      activeActionsRef.current.run = true;
      onControlChange('run', true);
    } else if (!pressedButtons.b && !pressedButtons.combo) {
      activeActionsRef.current.run = false;
      onControlChange('run', false);
    }
    try {
      localStorage.setItem('smb_mobile_autorun', String(autoRunEnabled));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // --- PROPORTIONAL GEOMETRIC D-PAD HIT-DETECTION ---
  const processDpadPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!dpadRef.current) return;
      const rect = dpadRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = Math.min(rect.width, rect.height) / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const maxRadius = Math.max(12, radius - Math.max(8, radius * 0.16));

      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      setKnobPos({
        x: clampedDist * Math.cos(angle),
        y: clampedDist * Math.sin(angle),
      });

      const deadzone = Math.max(5, radius * 0.14);
      const axisThreshold = Math.max(7, radius * 0.21);

      let nextLeft = false;
      let nextRight = false;
      let nextUp = false;
      let nextDown = false;

      if (dist > deadzone) {
        if (dx < -axisThreshold) nextLeft = true;
        else if (dx > axisThreshold) nextRight = true;

        if (dy < -axisThreshold) nextUp = true;
        else if (dy > axisThreshold) nextDown = true;

        // Ensure zero dead-spots along 45deg diagonals just outside the deadzone ring
        if (!nextLeft && !nextRight && !nextUp && !nextDown) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx < 0) nextLeft = true;
            else nextRight = true;
          } else {
            if (dy < 0) nextUp = true;
            else nextDown = true;
          }
        }
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

  const handleDpadTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Recover cleanly if a previous touch ID went stale without firing touchend
    if (dpadTouchIdRef.current !== null) {
      let stillActive = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === dpadTouchIdRef.current) {
          stillActive = true;
          break;
        }
      }
      if (stillActive) return;
    }
    const touch = e.changedTouches[0];
    if (!touch) return;
    dpadTouchIdRef.current = touch.identifier;
    processDpadPoint(touch.clientX, touch.clientY);
  };

  const handleDpadTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dpadTouchIdRef.current === null) return;
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      if (touch.identifier === dpadTouchIdRef.current) {
        processDpadPoint(touch.clientX, touch.clientY);
        return;
      }
    }
  };

  const handleDpadTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dpadTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === dpadTouchIdRef.current) {
        releaseDpad();
        return;
      }
    }
    // Also check if the tracked touch disappeared from active touches
    let stillActive = false;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === dpadTouchIdRef.current) {
        stillActive = true;
        break;
      }
    }
    if (!stillActive) {
      releaseDpad();
    }
  };

  const handleDpadMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dpadTouchIdRef.current !== null) return;
    e.preventDefault();
    dpadMouseActiveRef.current = true;
    processDpadPoint(e.clientX, e.clientY);
  };

  // --- UNIFIED GEOMETRIC HIT-DETECTION FOR ACTION BUTTONS (A / B / B+A) ---
  const evaluateActionPoint = useCallback((clientX: number, clientY: number, allowNearestFallback: boolean): ActionHitResult => {
    const checkCircle = (el: HTMLButtonElement | null, padPx: number): { hit: boolean; dist: number; radius: number } => {
      if (!el) return { hit: false, dist: Infinity, radius: 0 };
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const radius = Math.max(r.width, r.height) / 2;
      const dist = Math.hypot(clientX - cx, clientY - cy);
      return { hit: dist <= radius + padPx, dist, radius };
    };

    const hitA = checkCircle(btnARef.current, 8);
    const hitB = checkCircle(btnBRef.current, 8);
    const hitCombo = checkCircle(btnComboRef.current, 4);
    const hitSpin = checkCircle(btnSpinRef.current, 6);

    let a = hitA.hit;
    let b = hitB.hit;
    let combo = hitCombo.hit;
    let spin = hitSpin.hit;

    // Fallback to nearest button within generous outer margin so fast edge taps never drop
    if (!a && !b && !combo && !spin && allowNearestFallback) {
      const candidates: { key: keyof ActionHitResult; dist: number; limit: number }[] = [
        { key: 'a', dist: hitA.dist, limit: hitA.radius + 18 },
        { key: 'b', dist: hitB.dist, limit: hitB.radius + 18 },
        { key: 'combo', dist: hitCombo.dist, limit: hitCombo.radius + 12 },
        { key: 'spin', dist: hitSpin.dist, limit: hitSpin.radius + 14 },
      ];
      candidates.sort((x, y) => x.dist - y.dist);
      if (candidates[0].dist <= candidates[0].limit) {
        if (candidates[0].key === 'a') a = true;
        else if (candidates[0].key === 'b') b = true;
        else if (candidates[0].key === 'spin') spin = true;
        else combo = true;
      }
    }

    return { a, b, combo, spin };
  }, []);

  const applyActionAggregate = useCallback(
    (agg: ActionHitResult) => {
      const nextJump = agg.a || agg.combo;
      const nextRun = autoRunEnabled || agg.b || agg.combo;
      const nextSpin = agg.spin;

      setPressedButtons(prev =>
        prev.a === agg.a && prev.b === agg.b && prev.combo === agg.combo && prev.spin === agg.spin ? prev : agg
      );

      if (activeActionsRef.current.jump !== nextJump) {
        activeActionsRef.current.jump = nextJump;
        onControlChange('jump', nextJump);
        if (nextJump) triggerHaptic(14);
      }

      if (activeActionsRef.current.run !== nextRun) {
        activeActionsRef.current.run = nextRun;
        onControlChange('run', nextRun);
        if (nextRun) triggerHaptic(10);
      }

      if (activeActionsRef.current.spinJump !== nextSpin) {
        activeActionsRef.current.spinJump = nextSpin;
        onControlChange('spinJump', nextSpin);
        if (nextSpin) triggerHaptic(16);
      }
    },
    [autoRunEnabled, onControlChange, triggerHaptic]
  );

  const releaseAllActionButtons = useCallback(
    (forceClearRun: boolean = false) => {
      actionTouchIdsRef.current.clear();
      actionMouseActiveRef.current = false;
      setPressedButtons({ a: false, b: false, combo: false, spin: false });

      if (activeActionsRef.current.jump) {
        activeActionsRef.current.jump = false;
        onControlChange('jump', false);
      }
      if (activeActionsRef.current.spinJump) {
        activeActionsRef.current.spinJump = false;
        onControlChange('spinJump', false);
      }
      const keepRun = !forceClearRun && autoRunEnabled;
      if (activeActionsRef.current.run !== keepRun) {
        activeActionsRef.current.run = keepRun;
        onControlChange('run', keepRun);
      }
    },
    [autoRunEnabled, onControlChange]
  );

  const syncActionTouches = useCallback(
    (touches: React.TouchList) => {
      const zoneRect = actionZoneRef.current?.getBoundingClientRect();
      const margin = 14;
      const nextTrackedIds = new Set<number>();
      let anyA = false;
      let anyB = false;
      let anyCombo = false;
      let anySpin = false;

      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if (t.identifier === dpadTouchIdRef.current) continue;

        const wasTracked = actionTouchIdsRef.current.has(t.identifier);
        const insideZone = zoneRect
          ? t.clientX >= zoneRect.left - margin &&
            t.clientX <= zoneRect.right + margin &&
            t.clientY >= zoneRect.top - margin &&
            t.clientY <= zoneRect.bottom + margin
          : false;

        if (!wasTracked && !insideZone) continue;

        nextTrackedIds.add(t.identifier);
        const hit = evaluateActionPoint(t.clientX, t.clientY, !wasTracked || insideZone);
        if (hit.a) anyA = true;
        if (hit.b) anyB = true;
        if (hit.combo) anyCombo = true;
        if (hit.spin) anySpin = true;
      }

      actionTouchIdsRef.current = nextTrackedIds;
      applyActionAggregate({ a: anyA, b: anyB, combo: anyCombo, spin: anySpin });
    },
    [applyActionAggregate, evaluateActionPoint]
  );

  const handleActionTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    syncActionTouches(e.touches);
  };

  const handleActionTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    syncActionTouches(e.touches);
  };

  const handleActionTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    syncActionTouches(e.touches);
  };

  const handleActionMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (actionTouchIdsRef.current.size > 0) return;
    e.preventDefault();
    actionMouseActiveRef.current = true;
    const hit = evaluateActionPoint(e.clientX, e.clientY, true);
    applyActionAggregate(hit);
  };

  // Global mouse drag & release safety for both D-pad and Action Zone
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (dpadMouseActiveRef.current) {
        processDpadPoint(e.clientX, e.clientY);
      }
      if (actionMouseActiveRef.current) {
        const hit = evaluateActionPoint(e.clientX, e.clientY, false);
        applyActionAggregate(hit);
      }
    };
    const handleWindowMouseUp = () => {
      if (dpadMouseActiveRef.current) {
        releaseDpad();
      }
      if (actionMouseActiveRef.current) {
        releaseAllActionButtons(false);
      }
    };
    const handleWindowBlur = () => {
      releaseDpad();
      releaseAllActionButtons(false);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseDpad();
        releaseAllActionButtons(false);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyActionAggregate, evaluateActionPoint, processDpadPoint, releaseAllActionButtons, releaseDpad]);

  // Prevent stuck controls if TouchControls unmounts mid-press (pause, death, modal, stage clear)
  useEffect(() => {
    return () => {
      releaseDpad();
      releaseAllActionButtons(true);
    };
  }, [releaseDpad, releaseAllActionButtons]);

  // Layout & Size scales
  const isLarge = controlSize === 'large';
  const isCanvasOverlay = variant === 'canvas-overlay';
  const isOverlayLandscape = isFullscreen && isCompactLandscape;
  const isTranslucentOverlay = isCanvasOverlay || isOverlayLandscape;

  const dpadSizeClass = isCanvasOverlay
    ? isLarge
      ? 'w-32 h-32 sm:w-36 sm:h-36'
      : 'w-28 h-28 sm:w-32 sm:h-32'
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

  const isJumpActive = controls.jump || pressedButtons.a || pressedButtons.combo;
  const isRunActive = controls.run || autoRunEnabled || pressedButtons.b || pressedButtons.combo;
  const isSpinActive = Boolean(controls.spinJump) || pressedButtons.spin;

  // --- TRANSPARENT ON-CANVAS OVERLAY LAYOUT ---
  if (isCanvasOverlay) {
    return (
      <div
        aria-label="Controles táteis transparentes na tela"
        className="pointer-events-none absolute inset-0 z-[15] flex flex-col justify-between p-1.5 sm:p-2.5 select-none touch-none"
      >
        {/* Top Ultra-Compact Transparent Quick-Actions Strip (split into corner pills so center canvas HUD stays clear) */}
        <div className="w-full flex items-center justify-between gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
          <div className="pointer-events-auto flex items-center gap-1 bg-black/25 backdrop-blur-[1px] border border-white/15 rounded-lg px-1.5 py-0.5 text-[9px]">
            <button
              type="button"
              onClick={toggleAutoRun}
              title="Trava de Corrida (Auto-Run)"
              className={`px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 border transition cursor-pointer ${
                autoRunEnabled
                  ? 'bg-amber-500/40 border-amber-300/80 text-amber-100'
                  : 'bg-black/25 border-white/15 text-white/80'
              }`}
            >
              <Zap className={`w-3 h-3 ${autoRunEnabled ? 'text-amber-300 fill-amber-300' : 'text-white/60'}`} />
              <span>AUTO</span>
            </button>

            <button
              type="button"
              onClick={toggleHaptic}
              title={hapticEnabled ? 'Vibração Ativada' : 'Vibração Desativada'}
              className={`p-1 rounded border transition cursor-pointer ${
                hapticEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-black/25 border-white/15 text-white/50'
              }`}
            >
              <Vibrate className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={toggleSize}
              title="Tamanho dos Botões"
              className="p-1 rounded bg-black/25 border border-white/15 text-white/80 cursor-pointer"
            >
              <Sliders className="w-3 h-3" />
            </button>
          </div>

          <div className="pointer-events-auto flex items-center gap-1 bg-black/25 backdrop-blur-[1px] border border-white/15 rounded-lg px-1.5 py-0.5">
            {onOpenMultiplayer && (
              <button
                type="button"
                onClick={onOpenMultiplayer}
                title="Multiplayer"
                className={`p-1 rounded border transition cursor-pointer ${
                  multiplayerConnected
                    ? 'bg-emerald-600/45 border-emerald-400/80 text-emerald-100'
                    : 'bg-black/25 border-white/15 text-emerald-300'
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
                className="p-1 rounded bg-black/25 border border-white/15 text-amber-300 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
              </button>
            )}

            {onToggleMute && (
              <button
                type="button"
                onClick={onToggleMute}
                title={isMuted ? 'Desmutar Som' : 'Mutar Som'}
                className="p-1 rounded bg-black/25 border border-white/15 text-white/85 cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-amber-300" />}
              </button>
            )}

            {onSelectAction && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  onSelectAction();
                }}
                aria-label="Botão Select"
                title={
                  reservePowerUp
                    ? 'Select: Usar Power-Up da Carteira'
                    : canExitClearedWorldStage
                    ? 'Select: Sair da fase já passada (ou use Pausa + Select)'
                    : 'Select: Usar Power-Up da Carteira (em jogo) / Sair de fase já passada no Modo World'
                }
                className={`px-1.5 py-0.5 rounded border font-['Press_Start_2P',monospace] text-[8px] flex items-center gap-1 cursor-pointer transition ${
                  controls.select
                    ? 'bg-amber-400 text-black border-amber-200 font-bold'
                    : reservePowerUp
                    ? 'bg-amber-500/45 border-amber-300/90 text-amber-100'
                    : canExitClearedWorldStage
                    ? 'bg-emerald-600/45 border-emerald-300/80 text-emerald-100'
                    : 'bg-black/30 border-white/20 text-white/90'
                }`}
              >
                {reservePowerUp && <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />}
                <span>SELECT</span>
              </button>
            )}

            {onTogglePause && (
              <button
                type="button"
                onClick={onTogglePause}
                title={isPaused ? 'Continuar' : 'Pausar'}
                className={`px-1.5 py-0.5 rounded border font-['Press_Start_2P',monospace] text-[8px] flex items-center gap-1 cursor-pointer ${
                  isPaused
                    ? 'bg-amber-500/75 text-black border-amber-300 font-bold'
                    : 'bg-black/30 border-white/20 text-white/90'
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
                className="p-1 rounded bg-black/25 border border-white/15 text-white/85 cursor-pointer"
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
                    ? 'bg-emerald-600/40 border-emerald-400/80 text-emerald-100'
                    : 'bg-black/25 border-amber-400/50 text-amber-300'
                }`}
              >
                {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Bottom Transparent D-Pad (Left) & A / B Action Buttons (Right) */}
        <div className="w-full flex items-end justify-between pb-1 px-0.5">
          {/* Transparent Virtual D-Pad */}
          <div className="pointer-events-auto flex flex-col items-center">
            <div
              ref={dpadRef}
              aria-label="Direcional D-Pad"
              className={`relative ${dpadSizeClass} rounded-full bg-white/[0.06] backdrop-blur-[1px] border-2 border-white/25 shadow-[0_2px_12px_rgba(0,0,0,0.28)] touch-none flex items-center justify-center select-none`}
              onTouchStart={handleDpadTouchStart}
              onTouchMove={handleDpadTouchMove}
              onTouchEnd={handleDpadTouchEnd}
              onTouchCancel={handleDpadTouchEnd}
              onMouseDown={handleDpadMouseDown}
            >
              {/* Transparent Cross Guides */}
              <div className="absolute inset-2 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-full bg-white/[0.08] border border-white/15 rounded-md" />
                <div className="absolute h-8 w-full bg-white/[0.08] border border-white/15 rounded-md" />
              </div>

              {/* UP */}
              <div
                className={`pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  controls.up
                    ? 'bg-amber-300/75 text-black scale-110 shadow-[0_0_10px_rgba(252,211,77,0.75)]'
                    : 'text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                }`}
              >
                <ArrowUp className="w-4 h-4" />
              </div>

              {/* DOWN */}
              <div
                className={`pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  controls.down
                    ? 'bg-amber-300/75 text-black scale-110 shadow-[0_0_10px_rgba(252,211,77,0.75)]'
                    : 'text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                }`}
              >
                <ArrowDown className="w-4 h-4" />
              </div>

              {/* LEFT */}
              <div
                className={`pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  controls.left
                    ? 'bg-amber-300/75 text-black scale-110 shadow-[0_0_10px_rgba(252,211,77,0.75)]'
                    : 'text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
              </div>

              {/* RIGHT */}
              <div
                className={`pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  controls.right
                    ? 'bg-amber-300/75 text-black scale-110 shadow-[0_0_10px_rgba(252,211,77,0.75)]'
                    : 'text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                }`}
              >
                <ArrowRight className="w-4 h-4" />
              </div>

              {/* Transparent Center Thumb Puck */}
              <div
                className="pointer-events-none absolute w-8 h-8 rounded-full bg-white/15 border border-white/40 shadow-sm flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                }}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    controls.left || controls.right || controls.up || controls.down
                      ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]'
                      : 'bg-white/45'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Unified Action Hit-Zone: B+A Combo, B (Run/Fire), A (Jump) */}
          <div
            ref={actionZoneRef}
            aria-label="Botões de Ação A e B"
            className="pointer-events-auto flex items-end gap-2.5 sm:gap-3.5 p-1 touch-none select-none"
            onTouchStart={handleActionTouchStart}
            onTouchMove={handleActionTouchMove}
            onTouchEnd={handleActionTouchEnd}
            onTouchCancel={handleActionTouchEnd}
            onMouseDown={handleActionMouseDown}
          >
            {/* Combo B+A */}
            <div className="flex flex-col items-center mb-1">
              <button
                ref={btnComboRef}
                type="button"
                aria-label="Botão Combo Correr e Pular"
                onClick={(e) => e.preventDefault()}
                className={`${comboBtnSizeClass} rounded-full backdrop-blur-[1px] border-2 flex items-center justify-center text-white/90 font-['Press_Start_2P',monospace] font-bold shadow-md transition-all select-none touch-none ${
                  pressedButtons.combo
                    ? 'bg-purple-500/55 border-purple-200 scale-95 shadow-[0_0_12px_rgba(168,85,247,0.65)]'
                    : 'bg-purple-500/15 border-purple-200/45'
                }`}
              >
                <span className="pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">B+A</span>
              </button>
            </div>

            {/* B Button (Run / Fire) */}
            <div className="flex flex-col items-center">
              <button
                ref={btnBRef}
                type="button"
                aria-label="Botão B Correr"
                onClick={(e) => e.preventDefault()}
                className={`${btnSizeClass} rounded-full border-2 backdrop-blur-[1px] flex items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-md transition-all select-none touch-none ${
                  isRunActive
                    ? 'bg-red-500/55 border-red-200 scale-95 shadow-[0_0_14px_rgba(248,113,113,0.7)]'
                    : 'bg-red-500/15 border-red-200/55'
                }`}
              >
                <span className="pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">B</span>
              </button>
              <span className="pointer-events-none text-[7px] font-['Press_Start_2P',monospace] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] mt-0.5">
                {autoRunEnabled ? 'AUTO' : 'CORRER'}
              </span>
            </div>

            {/* A Button (Jump) & Spin Jump Button */}
            <div className="flex flex-col items-center -translate-y-2.5 gap-1">
              <button
                ref={btnSpinRef}
                type="button"
                aria-label="Botão C Pulo Carpado"
                onClick={(e) => e.preventDefault()}
                className={`${comboBtnSizeClass} rounded-full border-2 backdrop-blur-[1px] flex items-center justify-center font-['Press_Start_2P',monospace] font-bold shadow-md transition-all select-none touch-none ${
                  isSpinActive
                    ? 'bg-cyan-400/65 border-cyan-100 text-black scale-95 shadow-[0_0_14px_rgba(34,211,238,0.75)]'
                    : 'bg-cyan-500/20 border-cyan-200/55 text-cyan-100'
                }`}
              >
                <span className="pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">C</span>
              </button>

              <button
                ref={btnARef}
                type="button"
                aria-label="Botão A Pular"
                onClick={(e) => e.preventDefault()}
                className={`${btnSizeClass} rounded-full border-2 backdrop-blur-[1px] flex items-center justify-center font-['Press_Start_2P',monospace] font-bold shadow-md transition-all select-none touch-none ${
                  isJumpActive
                    ? 'bg-amber-400/60 border-amber-100 text-black scale-95 shadow-[0_0_16px_rgba(251,191,36,0.75)]'
                    : 'bg-amber-400/15 border-amber-200/60 text-white'
                }`}
              >
                <span className="pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">A</span>
              </button>
              <span className="pointer-events-none text-[7px] font-['Press_Start_2P',monospace] text-amber-200/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
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

          {onSelectAction && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                onSelectAction();
              }}
              aria-label="Botão Select"
              title={
                reservePowerUp
                  ? 'Select (V / Tab): Soltar Power-Up da Carteira'
                  : canExitClearedWorldStage
                  ? 'Select (V / Tab): Sair da fase já passada no Modo World'
                  : 'Select (V / Tab): Usar Power-Up da Carteira / Sair de fase já passada no Modo World'
              }
              className={`px-2.5 py-1 rounded-full border font-['Press_Start_2P',monospace] text-[9px] flex items-center gap-1.5 cursor-pointer transition ${
                controls.select
                  ? 'bg-amber-500 text-black border-amber-300 font-bold scale-95'
                  : reservePowerUp
                  ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.35)]'
                  : canExitClearedWorldStage
                  ? 'bg-emerald-950/90 border-emerald-400/80 text-emerald-200 hover:bg-emerald-900'
                  : 'bg-stone-900 border-stone-700 text-stone-300 hover:text-white hover:border-stone-500'
              }`}
            >
              {reservePowerUp && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
              <span>SELECT</span>
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
              className={`pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.up ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowUp className="w-5 h-5" />
            </div>

            <div
              className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.down ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowDown className="w-5 h-5" />
            </div>

            <div
              className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                controls.left ? 'bg-amber-500 text-black scale-110 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'text-stone-400'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </div>

            <div
              className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
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
        <div
          ref={actionZoneRef}
          className="pointer-events-auto flex flex-col items-end touch-none select-none"
          onTouchStart={handleActionTouchStart}
          onTouchMove={handleActionTouchMove}
          onTouchEnd={handleActionTouchEnd}
          onTouchCancel={handleActionTouchEnd}
          onMouseDown={handleActionMouseDown}
        >
          <div className="relative flex items-center gap-3 sm:gap-5 pr-1">
            <div className="flex flex-col items-center">
              <button
                ref={btnComboRef}
                type="button"
                onClick={(e) => e.preventDefault()}
                className={`${comboBtnSizeClass} rounded-full border-2 shadow-[0_3px_8px_rgba(147,51,234,0.3)] flex flex-col items-center justify-center text-white font-['Press_Start_2P',monospace] font-bold transition-all select-none touch-none ${
                  pressedButtons.combo
                    ? 'bg-gradient-to-br from-purple-700 to-purple-900 border-purple-200 scale-95'
                    : 'bg-gradient-to-br from-purple-600/85 to-purple-800/85 border-purple-400/80'
                }`}
              >
                <span className="pointer-events-none">B+A</span>
              </button>
              <span className="pointer-events-none text-[8px] font-mono text-purple-300 font-bold mt-1">COMBO</span>
            </div>

            <div className="flex flex-col items-center">
              <button
                ref={btnBRef}
                type="button"
                onClick={(e) => e.preventDefault()}
                className={`${btnSizeClass} rounded-full border-4 border-stone-900 flex flex-col items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-[0_4px_10px_rgba(0,0,0,0.6)] transition-all select-none touch-none ${
                  isRunActive
                    ? 'bg-gradient-to-br from-red-600/90 to-red-800/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_0_12px_rgba(239,68,68,0.5)] translate-y-0.5'
                    : 'bg-gradient-to-br from-red-500/80 to-red-700/80'
                }`}
              >
                <span className="pointer-events-none">B</span>
              </button>
              <span className="pointer-events-none text-[9px] font-['Press_Start_2P',monospace] text-stone-400 mt-1">
                {autoRunEnabled ? 'CORRENDO' : 'CORRER'}
              </span>
            </div>

            <div className="flex flex-col items-center -translate-y-3 gap-1.5">
              <button
                ref={btnSpinRef}
                type="button"
                aria-label="Botão C Pulo Carpado"
                onClick={(e) => e.preventDefault()}
                className={`${comboBtnSizeClass} rounded-full border-2 shadow-[0_3px_8px_rgba(6,182,212,0.3)] flex flex-col items-center justify-center font-['Press_Start_2P',monospace] font-bold transition-all select-none touch-none ${
                  isSpinActive
                    ? 'bg-gradient-to-br from-cyan-400 to-teal-600 border-cyan-100 text-black scale-95'
                    : 'bg-gradient-to-br from-cyan-600/85 to-teal-800/85 border-cyan-300/80 text-white'
                }`}
              >
                <span className="pointer-events-none">C</span>
              </button>

              <button
                ref={btnARef}
                type="button"
                onClick={(e) => e.preventDefault()}
                className={`${btnSizeClass} rounded-full border-4 border-stone-900 flex flex-col items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold shadow-[0_6px_14px_rgba(0,0,0,0.7)] transition-all select-none touch-none ${
                  isJumpActive
                    ? 'bg-gradient-to-br from-red-600/90 to-red-800/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6),0_0_14px_rgba(239,68,68,0.6)] translate-y-0.5'
                    : 'bg-gradient-to-br from-red-500/80 to-red-700/80'
                }`}
              >
                <span className="pointer-events-none">A</span>
              </button>
              <span className="pointer-events-none text-[9px] font-['Press_Start_2P',monospace] text-stone-300 font-bold">PULAR</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
