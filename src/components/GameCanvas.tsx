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
import { UpdatesModal, UpdatesModalFilter } from './UpdatesModal.tsx';
import { SmwOverworldMap } from './SmwOverworldMap.tsx';
import { multiplayerClient } from '../game/multiplayer.ts';
import { SoundEngine } from '../game/audio.ts';
import { GamepadControls, GameStats, LevelData, MarioPower, GameDifficulty, ResolutionScale, MultiplayerMatchResult, MultiplayerLogoffEvent } from '../game/types.ts';
import {
  SMW_WIKIWORLD_NODES,
  SmwBetaProgress,
  createSmwWikiWorldStage,
  loadSmwBetaProgress,
  saveSmwBetaProgress,
  isSmwNodeUnlocked,
} from '../game/smwWorldMap.ts';
import { getTopScore } from '../game/scoreboard.ts';
import { sanitizeCustomLevelEntities } from '../game/levels.ts';
import { isSmartTvUserAgent, moveFocusWithDpad, resolveTvRemoteAction } from '../game/smartTv.ts';
import { Settings, Play, RotateCcw, Volume2, VolumeX, Maximize2, Minimize2, Trophy, Flame, Users, Crown, Clock, CheckCircle2, WifiOff, Hammer, ShieldAlert, Shield, ScrollText, Heart, Map as MapIcon, Bug, Crosshair, ChevronLeft, ChevronRight, Plus, Tv, Wrench } from 'lucide-react';

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
  const [isCampaignVictory, setIsCampaignVictory] = useState(false);
  const [isMultiplayerMatchOver, setIsMultiplayerMatchOver] = useState(false);
  const [multiplayerMatchResult, setMultiplayerMatchResult] = useState<MultiplayerMatchResult | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isCheatMenuOpen, setIsCheatMenuOpen] = useState(false);
  const [isCheatActive, setIsCheatActive] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDebugPlacementActive, setIsDebugPlacementActive] = useState(false);
  const [debugCoords, setDebugCoords] = useState<{ x: number; y: number }>({ x: 40, y: 192 });
  const [debugSelectedLabel, setDebugSelectedLabel] = useState('MOEDA');
  const [isIllegalInstructionBug, setIsIllegalInstructionBug] = useState(false);
  const [cheatToast, setCheatToast] = useState('');
  const [splashCheatInput, setSplashCheatInput] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [crtFilter, setCrtFilter] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wasNativeFullscreenRef = useRef(false);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isTvUa = isSmartTvUserAgent();
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      (!isTvUa && (navigator.maxTouchPoints > 0 || window.innerWidth < 768))
    );
  });
  const [smartTvMode, setSmartTvMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smb_smart_tv_mode');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return isSmartTvUserAgent();
  });
  const [smartTvJumpWithUp, setSmartTvJumpWithUp] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smb_smart_tv_jump_up');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [smartTvAutoRun, setSmartTvAutoRun] = useState<boolean>(() => {
    try {
      return localStorage.getItem('smb_smart_tv_autorun') === 'true';
    } catch {
      return false;
    }
  });
  const manualRunHeldRef = useRef(false);
  const splashOverlayRef = useRef<HTMLDivElement | null>(null);
  const pauseOverlayRef = useRef<HTMLDivElement | null>(null);
  const gameOverOverlayRef = useRef<HTMLDivElement | null>(null);
  const victoryOverlayRef = useRef<HTMLDivElement | null>(null);
  const multiplayerOverOverlayRef = useRef<HTMLDivElement | null>(null);
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
  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false);
  const [updatesFilter, setUpdatesFilter] = useState<UpdatesModalFilter>('all');
  const [isSmwMapOpen, setIsSmwMapOpen] = useState(false);
  const [isSmwModeActive, setIsSmwModeActive] = useState(false);
  const [smwProgress, setSmwProgress] = useState<SmwBetaProgress>(() => loadSmwBetaProgress());
  const [smwJustClearedNodeId, setSmwJustClearedNodeId] = useState<string | null>(null);
  const [customLevels, setCustomLevels] = useState<LevelData[]>([]);
  const [activeCustomLevelId, setActiveCustomLevelId] = useState<string | null>(null);
  const [editorImmortality, setEditorImmortality] = useState(false);
  const [isCustomLevelActive, setIsCustomLevelActive] = useState(false);
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
      const isTvUa = isSmartTvUserAgent();
      setIsMobileDevice(
        window.matchMedia('(pointer: coarse)').matches ||
          (!isTvUa && (navigator.maxTouchPoints > 0 || window.innerWidth < 768))
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

  const toggleSmartTvMode = useCallback(() => {
    setSmartTvMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smb_smart_tv_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleSmartTvJumpWithUp = useCallback(() => {
    setSmartTvJumpWithUp(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smb_smart_tv_jump_up', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleSmartTvAutoRun = useCallback(() => {
    setSmartTvAutoRun(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smb_smart_tv_autorun', String(next));
      } catch {
        // ignore
      }
      if (!next && engineRef.current && !manualRunHeldRef.current) {
        engineRef.current.controls.run = false;
        setControls(c => ({ ...c, run: false }));
      }
      return next;
    });
  }, []);

  // Initialize engine once
  useEffect(() => {
    const engine = new GameEngine();
    engine.stats.highScore = getTopScore();
    const initialSmwProgress = loadSmwBetaProgress();
    engine.yellowSwitchUnlocked = initialSmwProgress.yellowSwitchUnlocked;
    engine.goalPointsWallet = initialSmwProgress.goalPointsWallet ?? 0;
    engine.stats.goalPointsWallet = engine.goalPointsWallet;
    engine.onSmwGoalWalletChanged = (wallet: number) => {
      if (engine.gameMode !== 'smw_world_map') return;
      setSmwProgress(prev => {
        if ((prev.goalPointsWallet ?? 0) === wallet) return prev;
        const updated: SmwBetaProgress = {
          ...prev,
          goalPointsWallet: wallet,
        };
        saveSmwBetaProgress(updated);
        return updated;
      });
    };
    engine.onSmwYellowSwitchActivated = () => {
      setSmwProgress(prev => {
        if (prev.yellowSwitchUnlocked) return prev;
        const updated: SmwBetaProgress = {
          ...prev,
          yellowSwitchUnlocked: true,
        };
        saveSmwBetaProgress(updated);
        return updated;
      });
    };
    engine.onSmwStageCompleted = (nodeId: string) => {
      setSmwProgress(prev => {
        const nextCleared = prev.clearedNodeIds.includes(nodeId)
          ? prev.clearedNodeIds
          : [...prev.clearedNodeIds, nodeId];
        const currNode = SMW_WIKIWORLD_NODES.find(n => n.id === nodeId);
        const nextNode =
          nodeId === 'wiki-switch-yellow'
            ? SMW_WIKIWORLD_NODES.find(n => n.id === 'wiki-2-caverna')
            : currNode && currNode.order < 4
            ? SMW_WIKIWORLD_NODES[currNode.order + 1]
            : undefined;
        const nextSelected =
          nextNode && !nextCleared.includes(nextNode.id)
            ? nextNode.id
            : nodeId;
        const updated: SmwBetaProgress = {
          ...prev,
          clearedNodeIds: nextCleared,
          selectedNodeId: nextSelected,
          yellowSwitchUnlocked:
            prev.yellowSwitchUnlocked || nodeId === 'wiki-switch-yellow',
        };
        saveSmwBetaProgress(updated);
        return updated;
      });
      setSmwJustClearedNodeId(nodeId);
      setIsStageClear(false);
      setIsPaused(false);
      setIsGameOver(false);
      setIsSmwModeActive(true);
      setIsSmwMapOpen(true);
      setStats({ ...engine.stats, isNewHighScore: engine.isNewHighScore });
    };
    engineRef.current = engine;
    multiplayerClient.setEngine(engine);

    return () => {
      engine.onSmwStageCompleted = undefined;
      engine.onSmwYellowSwitchActivated = undefined;
      engine.onSmwGoalWalletChanged = undefined;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      SoundEngine.get().stopMusic();
    };
  }, []);

  const openUpdatesModal = useCallback((filter: UpdatesModalFilter = 'all') => {
    setUpdatesFilter(filter);
    setIsUpdatesOpen(true);
  }, []);

  // Update controls to engine (only during active gameplay; blocked in menus/overlays — R1.16.UF.4)
  const handleControlChange = useCallback(
    (key: keyof GamepadControls, active: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      const canControlGameplay =
        hasStarted &&
        engine.isGameStarted &&
        !isSmwMapOpen &&
        !isPaused &&
        !isGameOver &&
        !isCampaignVictory &&
        !isMultiplayerMatchOver &&
        !isSettingsOpen &&
        !isLeaderboardOpen &&
        !isCheatMenuOpen &&
        !isMultiplayerOpen &&
        !isLevelEditorOpen &&
        !isUpdatesOpen;
      if (!canControlGameplay) {
        engine.controls.left = false;
        engine.controls.right = false;
        engine.controls.up = false;
        engine.controls.down = false;
        engine.controls.jump = false;
        engine.controls.run = false;
        setControls({
          left: false,
          right: false,
          up: false,
          down: false,
          jump: false,
          run: false,
          pause: false,
        });
        return;
      }
      engine.controls[key] = active;
      setControls(prev => ({ ...prev, [key]: active }));
    },
    [
      hasStarted,
      isSmwMapOpen,
      isPaused,
      isGameOver,
      isCampaignVictory,
      isMultiplayerMatchOver,
      isSettingsOpen,
      isLeaderboardOpen,
      isCheatMenuOpen,
      isMultiplayerOpen,
      isLevelEditorOpen,
      isUpdatesOpen,
    ]
  );

  // Activate developer mode ("lula132026")
  const activateCheat = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.activateCheatMode();
    setIsCheatActive(true);
    setIsCheatMenuOpen(true);
    setCheatToast('PÁGINA DO DESENVOLVEDOR ATIVADA!');
    setTimeout(() => setCheatToast(''), 4500);
  }, []);

  const handleDeveloperButtonClick = useCallback(() => {
    const engine = engineRef.current;
    if (engine && engine.isIllegalInstructionBug) {
      engine.recoverFromIllegalInstruction();
      setIsIllegalInstructionBug(false);
      setCheatToast('TELA RESTAURADA PELO BOTÃO DO DESENVOLVEDOR!');
      setTimeout(() => setCheatToast(''), 4000);
      return;
    }
    setIsCheatMenuOpen(true);
  }, []);

  const handleToggleDebugMode = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.isDebugLockedAtStageEnd()) {
      engine.toggleDebugMode(false);
      setIsDebugMode(false);
      setIsDebugPlacementActive(false);
      setIsCheatActive(engine.isCheatActive);
      setCheatToast('Modo Debug bloqueado ao alcançar o final da fase!');
      setTimeout(() => setCheatToast(''), 3800);
      return;
    }
    const active = engine.toggleDebugMode();
    setIsDebugMode(active);
    setIsDebugPlacementActive(engine.isDebugPlacementActive);
    setIsCheatActive(engine.isCheatActive);
    setDebugCoords({ x: engine.marioX, y: engine.marioY });
    setDebugSelectedLabel(engine.getCurrentDebugPlaceable().label);
    setCheatToast(
      active
        ? 'MODO DEBUG (SONIC) ATIVADO! Pressione B para inserir itens.'
        : 'Modo Debug desativado.'
    );
    setTimeout(() => setCheatToast(''), 3800);
  }, []);

  const handleToggleDebugPlacement = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.isDebugLockedAtStageEnd()) {
      engine.toggleDebugPlacementCursor(false);
      setIsDebugMode(engine.isDebugMode);
      setIsDebugPlacementActive(false);
      setIsCheatActive(engine.isCheatActive);
      setCheatToast('Modo Debug bloqueado ao alcançar o final da fase!');
      setTimeout(() => setCheatToast(''), 3200);
      return;
    }
    const placing = engine.toggleDebugPlacementCursor();
    setIsDebugMode(engine.isDebugMode);
    setIsDebugPlacementActive(placing);
    setIsCheatActive(engine.isCheatActive);
    setDebugSelectedLabel(engine.getCurrentDebugPlaceable().label);
  }, []);

  const handleCycleDebugItem = useCallback((delta: -1 | 1) => {
    const engine = engineRef.current;
    if (!engine || engine.isDebugLockedAtStageEnd()) return;
    const spec = engine.cycleDebugPlaceable(delta);
    setDebugSelectedLabel(spec.label);
  }, []);

  const handlePlaceDebugItem = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engine.isDebugMode) return;
    if (engine.isDebugLockedAtStageEnd()) {
      engine.placeDebugItemAt();
      setIsDebugMode(engine.isDebugMode);
      setIsDebugPlacementActive(engine.isDebugPlacementActive);
      return;
    }
    engine.placeDebugItemAt();
  }, []);

  const handleCanvasDebugClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas || !engine.isDebugMode || !engine.isDebugPlacementActive) return;
    if (engine.isPaused || engine.isGameOver || engine.isIllegalInstructionBug) return;
    if (engine.isDebugLockedAtStageEnd()) {
      engine.toggleDebugMode(false);
      setIsDebugMode(false);
      setIsDebugPlacementActive(false);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scale = Math.min(rect.width / GameEngine.NES_WIDTH, rect.height / GameEngine.NES_HEIGHT);
    const renderW = GameEngine.NES_WIDTH * scale;
    const renderH = GameEngine.NES_HEIGHT * scale;
    const offsetX = rect.left + (rect.width - renderW) / 2;
    const offsetY = rect.top + (rect.height - renderH) / 2;

    const nesX = (e.clientX - offsetX) / scale;
    const nesY = (e.clientY - offsetY) / scale;
    if (nesX < 0 || nesX > GameEngine.NES_WIDTH || nesY < 0 || nesY > GameEngine.NES_HEIGHT) return;

    const worldX = Math.max(
      0,
      Math.min(engine.level.width * GameEngine.TILE_SIZE - 16, Math.round(nesX + engine.camera.renderX - 8))
    );
    const worldY = Math.max(16, Math.min(GameEngine.NES_HEIGHT - 16, Math.round(nesY - 8)));
    if (engine.isDebugPlacementBlockedAt(worldX)) {
      engine.placeDebugItemAt(worldX, worldY);
      return;
    }
    engine.marioX = worldX;
    engine.marioY = worldY;
    engine.placeDebugItemAt(worldX, worldY);
    setDebugCoords({ x: engine.marioX, y: engine.marioY });
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

  // Auto-focus primary menu button for 10-foot Smart TV D-Pad navigation
  useEffect(() => {
    if (!smartTvMode) return;
    const timer = window.setTimeout(() => {
      if (isSettingsOpen || isLeaderboardOpen || isCheatMenuOpen || isMultiplayerOpen || isUpdatesOpen || isLevelEditorOpen) {
        const dialog = document.querySelector<HTMLElement>('.fixed.inset-0.z-50');
        const firstBtn = dialog?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
        return;
      }
      if (!hasStarted) {
        const firstBtn = splashOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      } else if (isPaused) {
        const firstBtn = pauseOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      } else if (isMultiplayerMatchOver) {
        const firstBtn = multiplayerOverOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      } else if (isGameOver) {
        const firstBtn = gameOverOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      } else if (isCampaignVictory) {
        const firstBtn = victoryOverlayRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
        firstBtn?.focus();
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [
    smartTvMode,
    hasStarted,
    isPaused,
    isGameOver,
    isCampaignVictory,
    isMultiplayerMatchOver,
    isSettingsOpen,
    isLeaderboardOpen,
    isCheatMenuOpen,
    isMultiplayerOpen,
    isUpdatesOpen,
    isLevelEditorOpen,
  ]);

  // Keyboard & Smart TV Remote Event Listeners
  useEffect(() => {
    const clearAllInputs = () => {
      manualRunHeldRef.current = false;
      const engine = engineRef.current;
      if (engine) {
        engine.controls.left = false;
        engine.controls.right = false;
        engine.controls.up = false;
        engine.controls.down = false;
        engine.controls.jump = false;
        engine.controls.run = false;
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
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inputType = target?.tagName === 'INPUT' ? (target as HTMLInputElement).type.toLowerCase() : '';
      const isTextEntry = Boolean(
        target &&
          ((target.tagName === 'INPUT' &&
            !['button', 'submit', 'reset', 'checkbox', 'radio', 'range'].includes(inputType)) ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
      );
      const isRangeInput = Boolean(target && target.tagName === 'INPUT' && inputType === 'range');

      const tv = resolveTvRemoteAction(
        { code: e.code, key: e.key, keyCode: e.keyCode },
        { smartTvMode, jumpWithUp: smartTvJumpWithUp, autoRun: smartTvAutoRun }
      );

      // Inside text fields: only intercept dedicated non-Backspace Back keys (Esc / TV Return 461 / 10009)
      if (isTextEntry) {
        if (tv.isBack && e.code !== 'Backspace' && e.key !== 'Backspace' && e.keyCode !== 8) {
          e.preventDefault();
          target?.blur();
          if (isCheatMenuOpen) setIsCheatMenuOpen(false);
          else if (isUpdatesOpen) setIsUpdatesOpen(false);
          else if (isLeaderboardOpen) setIsLeaderboardOpen(false);
          else if (isSettingsOpen) setIsSettingsOpen(false);
          else if (isMultiplayerOpen) setIsMultiplayerOpen(false);
          else if (isLevelEditorOpen) setIsLevelEditorOpen(false);
        }
        return;
      }

      const anyModalOpen =
        isMultiplayerOpen ||
        isSettingsOpen ||
        isLeaderboardOpen ||
        isLevelEditorOpen ||
        isUpdatesOpen ||
        isCheatMenuOpen;

      if (anyModalOpen) {
        if (tv.isBack && !e.repeat) {
          e.preventDefault();
          if (isCheatMenuOpen) setIsCheatMenuOpen(false);
          else if (isUpdatesOpen) setIsUpdatesOpen(false);
          else if (isLeaderboardOpen) setIsLeaderboardOpen(false);
          else if (isSettingsOpen) setIsSettingsOpen(false);
          else if (isMultiplayerOpen) setIsMultiplayerOpen(false);
          else if (isLevelEditorOpen) setIsLevelEditorOpen(false);
          return;
        }

        if (tv.isDirection) {
          const modalEl = document.querySelector<HTMLElement>('.fixed.inset-0.z-50');
          const dir = tv.actions.includes('up')
            ? 'up'
            : tv.actions.includes('down')
            ? 'down'
            : tv.actions.includes('left')
            ? 'left'
            : 'right';
          if (isRangeInput && (dir === 'left' || dir === 'right')) {
            return; // Let left/right adjust volume or sync rate sliders natively
          }
          if (modalEl && moveFocusWithDpad(modalEl, dir)) {
            e.preventDefault();
          }
          return;
        }

        if (
          tv.isConfirm &&
          target &&
          (target.tagName === 'BUTTON' || (target.tagName === 'INPUT' && inputType === 'checkbox')) &&
          (e.code === 'Select' || e.key === 'Select' || e.key === 'OK' || e.keyCode === 23)
        ) {
          e.preventDefault();
          target.click();
        }
        return;
      }

      if (isSmwMapOpen) {
        return;
      }

      // Secret Cheat Code Detection: "lula132026"
      if (e.key && e.key.length === 1) {
        cheatBufferRef.current = (cheatBufferRef.current + e.key.toLowerCase()).slice(-16);
        if (cheatBufferRef.current.endsWith('lula132026')) {
          activateCheat();
        }
      }

      // TV Info / Menu key opens Settings cleanly
      if (tv.isInfo && !e.repeat) {
        e.preventDefault();
        if (engineRef.current && hasStarted && !engineRef.current.isPaused && !isGameOver && !isMultiplayerMatchOver) {
          togglePauseGame();
        }
        setIsSettingsOpen(true);
        return;
      }

      // Menu / Overlay State: Splash, Pause, Game Over, Victory, Multiplayer Match Over
      const inMenuOverlay =
        !hasStarted || isPaused || isGameOver || isCampaignVictory || isMultiplayerMatchOver;

      if (inMenuOverlay) {
        if (isPaused && hasStarted && !isGameOver && !isMultiplayerMatchOver && (tv.isPause || tv.isBack)) {
          if (e.repeat) return;
          e.preventDefault();
          SoundEngine.get().resume();
          togglePauseGame();
          return;
        }

        const activeOverlayEl = !hasStarted
          ? splashOverlayRef.current
          : isPaused
          ? pauseOverlayRef.current
          : isMultiplayerMatchOver
          ? multiplayerOverOverlayRef.current
          : isGameOver
          ? gameOverOverlayRef.current
          : victoryOverlayRef.current;

        if (tv.isDirection && activeOverlayEl) {
          const dir = tv.actions.includes('up')
            ? 'up'
            : tv.actions.includes('down')
            ? 'down'
            : tv.actions.includes('left')
            ? 'left'
            : 'right';
          if (moveFocusWithDpad(activeOverlayEl, dir)) {
            e.preventDefault();
          }
          return;
        }

        if (tv.isConfirm || tv.actions.includes('jump')) {
          if (target && target.tagName === 'BUTTON' && activeOverlayEl?.contains(target)) {
            e.preventDefault();
            target.click();
            return;
          }
          if (!hasStarted) {
            e.preventDefault();
            handleStartGame();
            return;
          }
          if (isPaused && !isGameOver && !isMultiplayerMatchOver) {
            e.preventDefault();
            SoundEngine.get().resume();
            togglePauseGame();
            return;
          }
        }

        if (tv.actions.includes('restart') && !e.ctrlKey && !e.metaKey && hasStarted && engineRef.current) {
          if (multiplayerStatus.connected) {
            if (multiplayerStatus.transport === 'websocket' || multiplayerStatus.isHost) {
              multiplayerClient.startMultiplayerRematch();
              setIsGameOver(false);
              setIsStageClear(false);
              setIsPaused(false);
            }
          } else {
            engineRef.current.restartGame();
            setIsGameOver(false);
            setIsStageClear(false);
            setIsPaused(false);
          }
        }
        return;
      }

      // --- ACTIVE GAMEPLAY CONTROLS ---
      // Pause / Unpause on Escape, P, Media Play/Pause, or TV Back/Return
      if (tv.isPause || tv.isBack) {
        if (e.repeat) return;
        e.preventDefault();
        SoundEngine.get().resume();
        togglePauseGame();
        return;
      }

      // Prevent Enter/Space from accidentally clicking a focused HUD/toolbar button mid-jump
      if (target && target.tagName === 'BUTTON') {
        target.blur();
      }

      if (tv.shouldPreventDefault) {
        e.preventDefault();
      }

      SoundEngine.get().resume();

      const engine = engineRef.current;
      if (!engine || engine.isPaused) return;

      for (const action of tv.actions) {
        switch (action) {
          case 'left':
            engine.controls.left = true;
            if (smartTvMode && smartTvAutoRun) engine.controls.run = true;
            setControls(c => ({ ...c, left: true, ...(smartTvMode && smartTvAutoRun ? { run: true } : {}) }));
            break;
          case 'right':
            engine.controls.right = true;
            if (smartTvMode && smartTvAutoRun) engine.controls.run = true;
            setControls(c => ({ ...c, right: true, ...(smartTvMode && smartTvAutoRun ? { run: true } : {}) }));
            break;
          case 'up':
            engine.controls.up = true;
            setControls(c => ({ ...c, up: true }));
            break;
          case 'down':
            engine.controls.down = true;
            setControls(c => ({ ...c, down: true }));
            break;
          case 'jump':
            engine.controls.jump = true;
            setControls(c => ({ ...c, jump: true }));
            break;
          case 'run':
            manualRunHeldRef.current = true;
            if (smartTvMode && smartTvAutoRun && engine.controls.run && !e.repeat) {
              // Pulse rising edge so Fireball / Tail Whip triggers even while TV Auto-Run is active
              engine.controls.run = false;
              requestAnimationFrame(() => {
                if (engineRef.current && !engineRef.current.isPaused) {
                  engineRef.current.controls.run = true;
                }
              });
            } else {
              engine.controls.run = true;
            }
            setControls(c => ({ ...c, run: true }));
            break;
        }
      }

      // Preserve Debug Mode & Quick Restart keys
      if (e.code === 'KeyB' || e.code === 'KeyE') {
        if (!e.repeat && engine.isDebugMode && !engine.isDebugLockedAtStageEnd()) {
          e.preventDefault();
          engine.toggleDebugPlacementCursor();
          setIsDebugPlacementActive(engine.isDebugPlacementActive);
          setDebugSelectedLabel(engine.getCurrentDebugPlaceable().label);
        }
      } else if (e.code === 'BracketLeft' && engine.isDebugMode && !engine.isDebugLockedAtStageEnd()) {
        e.preventDefault();
        const spec = engine.cycleDebugPlaceable(-1);
        setDebugSelectedLabel(spec.label);
      } else if (e.code === 'BracketRight' && engine.isDebugMode && !engine.isDebugLockedAtStageEnd()) {
        e.preventDefault();
        const spec = engine.cycleDebugPlaceable(1);
        setDebugSelectedLabel(spec.label);
      } else if (tv.actions.includes('restart') && !e.ctrlKey && !e.metaKey) {
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
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      const tv = resolveTvRemoteAction(
        { code: e.code, key: e.key, keyCode: e.keyCode },
        { smartTvMode, jumpWithUp: smartTvJumpWithUp, autoRun: smartTvAutoRun }
      );

      for (const action of tv.actions) {
        switch (action) {
          case 'left':
            engine.controls.left = false;
            if (smartTvMode && smartTvAutoRun && !engine.controls.right && !manualRunHeldRef.current) {
              engine.controls.run = false;
              setControls(c => ({ ...c, left: false, run: false }));
            } else {
              setControls(c => ({ ...c, left: false }));
            }
            break;
          case 'right':
            engine.controls.right = false;
            if (smartTvMode && smartTvAutoRun && !engine.controls.left && !manualRunHeldRef.current) {
              engine.controls.run = false;
              setControls(c => ({ ...c, right: false, run: false }));
            } else {
              setControls(c => ({ ...c, right: false }));
            }
            break;
          case 'up':
            engine.controls.up = false;
            setControls(c => ({ ...c, up: false }));
            break;
          case 'down':
            engine.controls.down = false;
            setControls(c => ({ ...c, down: false }));
            break;
          case 'jump':
            engine.controls.jump = false;
            setControls(c => ({ ...c, jump: false }));
            break;
          case 'run':
            manualRunHeldRef.current = false;
            if (!(smartTvMode && smartTvAutoRun && (engine.controls.left || engine.controls.right))) {
              engine.controls.run = false;
              setControls(c => ({ ...c, run: false }));
            }
            break;
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) clearAllInputs();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearAllInputs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    hasStarted,
    isPaused,
    isGameOver,
    isCampaignVictory,
    isMultiplayerMatchOver,
    isCheatMenuOpen,
    isMultiplayerOpen,
    isSettingsOpen,
    isLeaderboardOpen,
    isLevelEditorOpen,
    isUpdatesOpen,
    isSmwMapOpen,
    smartTvMode,
    smartTvJumpWithUp,
    smartTvAutoRun,
    multiplayerStatus.connected,
    multiplayerStatus.isHost,
    multiplayerStatus.transport,
    activateCheat,
    togglePauseGame,
  ]);

  // Gamepad API Polling (blocked while in menus/overlays — R1.16.UF.4)
  const pollGamepad = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0];
    if (!gp || !engineRef.current) return;

    const engine = engineRef.current;
    const anyModalOpen =
      isSettingsOpen ||
      isLeaderboardOpen ||
      isCheatMenuOpen ||
      isMultiplayerOpen ||
      isLevelEditorOpen ||
      isUpdatesOpen;

    if (
      !hasStarted ||
      !engine.isGameStarted ||
      isSmwMapOpen ||
      isGameOver ||
      isCampaignVictory ||
      isMultiplayerMatchOver ||
      anyModalOpen
    ) {
      engine.controls.left = false;
      engine.controls.right = false;
      engine.controls.up = false;
      engine.controls.down = false;
      engine.controls.jump = false;
      engine.controls.run = false;
      engine.controls.pause = false;
      return;
    }

    const btnStart = gp.buttons[9]?.pressed || false;
    if (btnStart && !engine.controls.pause) {
      engine.togglePause();
      setIsPaused(engine.isPaused);
    }

    if (engine.isPaused) {
      engine.controls.left = false;
      engine.controls.right = false;
      engine.controls.up = false;
      engine.controls.down = false;
      engine.controls.jump = false;
      engine.controls.run = false;
      engine.controls.pause = btnStart;
      return;
    }

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

    engine.controls.left = dpadLeft;
    engine.controls.right = dpadRight;
    engine.controls.up = dpadUp;
    engine.controls.down = dpadDown;
    engine.controls.jump = btnA;
    engine.controls.run = btnB;
    engine.controls.pause = btnStart;
  }, [
    hasStarted,
    isSmwMapOpen,
    isGameOver,
    isCampaignVictory,
    isMultiplayerMatchOver,
    isSettingsOpen,
    isLeaderboardOpen,
    isCheatMenuOpen,
    isMultiplayerOpen,
    isLevelEditorOpen,
    isUpdatesOpen,
  ]);

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
          setIsCampaignVictory(engine.isCampaignVictory);
          setIsSmwModeActive(engine.gameMode === 'smw_world_map');
          setIsMultiplayerMatchOver(engine.isMultiplayerMatchOver);
          setMultiplayerMatchResult(engine.multiplayerMatchResult);
          setIsCustomLevelActive(Boolean(engine.level?.isCustom));
          setIsCheatActive(engine.isCheatActive);
          setIsDebugMode(engine.isDebugMode);
          setIsDebugPlacementActive(engine.isDebugPlacementActive);
          setDebugCoords({ x: engine.marioX, y: engine.marioY });
          setDebugSelectedLabel(engine.getCurrentDebugPlaceable().label);
          setIsIllegalInstructionBug(engine.isIllegalInstructionBug);
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
      engineRef.current.gameMode = level.smwNodeId
        ? 'smw_world_map'
        : level.singleplayerWorld
        ? 'singleplayer'
        : 'classic';
      engineRef.current.loadLevel(level, true, false);
      setHasStarted(true);
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
      setIsCampaignVictory(false);
      setIsSmwMapOpen(false);
      setIsSmwModeActive(Boolean(level.smwNodeId));
    }
  };

  const openLevelEditor = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.controls = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        run: false,
        pause: false,
      };
      if (hasStarted && !engine.isPaused && !engine.isGameOver && !engine.isMultiplayerMatchOver) {
        engine.togglePause();
        setIsPaused(true);
      }
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
    setIsUpdatesOpen(false);
    setIsLevelEditorOpen(true);
  }, [hasStarted]);

  const handlePlayCustomLevel = useCallback(
    (level: LevelData, options?: { immortality?: boolean }) => {
      if (multiplayerStatus.connected) {
        setCheatToast('Saia da sala multiplayer para testar fases personalizadas!');
        setTimeout(() => setCheatToast(''), 3500);
        return;
      }
      const immortal = options?.immortality ?? editorImmortality;
      const sanitizedLevel = sanitizeCustomLevelEntities(level).level;
      setEditorImmortality(immortal);
      SoundEngine.get().resume();
      setIsLevelEditorOpen(false);
      setIsSettingsOpen(false);
      setIsUpdatesOpen(false);
      setIsCampaignVictory(false);
      setIsMultiplayerMatchOver(false);
      setHasStarted(true);
      setIsCustomLevelActive(true);
      setIsSmwMapOpen(false);
      setIsSmwModeActive(false);
      if (engineRef.current) {
        engineRef.current.playCustomLevel(sanitizedLevel, immortal);
        setIsPaused(false);
        setIsGameOver(false);
        setIsStageClear(false);
        setStats({ ...engineRef.current.stats, isNewHighScore: false });
        setMarioPower(engineRef.current.marioPower);
      }
    },
    [multiplayerStatus.connected, editorImmortality]
  );

  const handleReturnToMainMenu = useCallback(() => {
    setIsLevelEditorOpen(false);
    setIsSettingsOpen(false);
    setIsUpdatesOpen(false);
    setIsCheatMenuOpen(false);
    setIsSmwMapOpen(false);
    setIsSmwModeActive(false);
    setSmwJustClearedNodeId(null);
    setIsPaused(false);
    setIsGameOver(false);
    setIsStageClear(false);
    setIsCampaignVictory(false);
    setHasStarted(false);
    setIsCustomLevelActive(false);
    manualRunHeldRef.current = false;
    setControls({
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      run: false,
      pause: false,
    });
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
    setIsCampaignVictory(false);
    setIsSmwMapOpen(false);
    setIsSmwModeActive(false);
    setHasStarted(true);
    if (engineRef.current) {
      if (multiplayerStatus.connected) {
        engineRef.current.isGameStarted = true;
      } else {
        engineRef.current.gameMode = 'classic';
        engineRef.current.restartGame();
      }
    }
  };

  const handleStartSingleplayer = () => {
    if (multiplayerStatus.connected) {
      setCheatToast('Desconecte do multiplayer para jogar o modo Singleplayer (7 Mundos)!');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    SoundEngine.get().resume();
    setIsCampaignVictory(false);
    setIsSmwMapOpen(false);
    setIsSmwModeActive(false);
    setIsSettingsOpen(false);
    setIsLevelEditorOpen(false);
    setHasStarted(true);
    setIsCustomLevelActive(false);
    if (engineRef.current) {
      engineRef.current.startSingleplayerCampaign(1, 1);
      setIsPaused(false);
      setIsGameOver(false);
      setIsStageClear(false);
      setStats({ ...engineRef.current.stats, isNewHighScore: false });
      setMarioPower(engineRef.current.marioPower);
    }
  };

  const handleOpenSmwWorldMap = useCallback(() => {
    if (multiplayerStatus.connected) {
      setCheatToast('Desconecte do multiplayer para explorar o Overworld (Beta V0.9)!');
      setTimeout(() => setCheatToast(''), 3500);
      return;
    }
    SoundEngine.get().stopMusic();
    setIsCampaignVictory(false);
    setIsSettingsOpen(false);
    setIsLevelEditorOpen(false);
    setIsUpdatesOpen(false);
    setIsPaused(false);
    setIsGameOver(false);
    setIsStageClear(false);
    setIsCustomLevelActive(false);
    setSmwJustClearedNodeId(null);
    setHasStarted(true);
    setIsSmwModeActive(true);
    setIsSmwMapOpen(true);
    if (engineRef.current) {
      engineRef.current.gameMode = 'smw_world_map';
      engineRef.current.isPaused = false;
      engineRef.current.isGameOver = false;
    }
  }, [multiplayerStatus.connected]);

  const handleEnterSmwStage = useCallback(
    (nodeId: string) => {
      const node = SMW_WIKIWORLD_NODES.find(n => n.id === nodeId);
      if (!node || !isSmwNodeUnlocked(node.id, smwProgress)) return;

      const updated: SmwBetaProgress = {
        ...smwProgress,
        selectedNodeId: nodeId,
        storySeen: true,
      };
      setSmwProgress(updated);
      saveSmwBetaProgress(updated);

      SoundEngine.get().resume();
      setIsSmwMapOpen(false);
      setIsSmwModeActive(true);
      setSmwJustClearedNodeId(null);
      setHasStarted(true);
      setIsCustomLevelActive(false);
      if (engineRef.current) {
        engineRef.current.yellowSwitchUnlocked = updated.yellowSwitchUnlocked;
        engineRef.current.goalPointsWallet = updated.goalPointsWallet ?? 0;
        engineRef.current.stats.goalPointsWallet = engineRef.current.goalPointsWallet;
        engineRef.current.startSmwStage(createSmwWikiWorldStage(nodeId), false);
        setIsPaused(false);
        setIsGameOver(false);
        setIsStageClear(false);
        setStats({ ...engineRef.current.stats, isNewHighScore: false });
        setMarioPower(engineRef.current.marioPower);
      }
    },
    [smwProgress]
  );

  const handleReturnToSmwOverworld = useCallback(() => {
    SoundEngine.get().stopMusic();
    setIsPaused(false);
    setIsGameOver(false);
    setIsStageClear(false);
    setSmwJustClearedNodeId(null);
    setIsSmwModeActive(true);
    setIsSmwMapOpen(true);
    if (engineRef.current) {
      engineRef.current.gameMode = 'smw_world_map';
      engineRef.current.isPaused = false;
      engineRef.current.isGameOver = false;
    }
  }, []);

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
          ? `fixed inset-0 z-40 flex flex-col items-center justify-between w-screen h-[100dvh] bg-black select-none overflow-hidden ${
              smartTvMode ? 'p-3 sm:p-4' : ''
            }`
          : `relative flex flex-col items-center justify-start w-full min-h-screen bg-stone-950 select-none overflow-x-hidden ${
              smartTvMode ? 'px-4 py-2 sm:px-6 sm:py-3' : ''
            }`
      }
    >
      {/* Top HUD (Placar & Vidas) */}
      <RetroHUD
        stats={stats}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        isCheatActive={isCheatActive}
        isCustomLevel={isCustomLevelActive}
        isFemboy={marioPower === 'femboy'}
        onOpenCheatMenu={handleDeveloperButtonClick}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isDebugMode={isDebugMode}
        isDebugPlacementActive={isDebugPlacementActive}
        debugCoords={debugCoords}
        isIllegalInstructionBug={isIllegalInstructionBug}
        onToggleDebugPlacement={handleToggleDebugPlacement}
      />

      {/* Compact Sonic Debug Placement Bar when Debug Mode is active */}
      {hasStarted && isDebugMode && !isIllegalInstructionBug && !isSmwMapOpen && (
        <div className="w-full max-w-4xl px-2 sm:px-4 pt-1 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleDebugPlacement}
              className={`px-2 py-1 rounded border font-bold flex items-center gap-1 cursor-pointer transition ${
                isDebugPlacementActive
                  ? 'bg-cyan-600/80 border-cyan-300 text-white shadow'
                  : 'bg-stone-900 border-cyan-600/50 text-cyan-300 hover:bg-stone-800'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>{isDebugPlacementActive ? 'CURSOR: ON (B)' : 'CURSOR: OFF (B)'}</span>
            </button>

            <div className="flex items-center bg-stone-900 border border-stone-700 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => handleCycleDebugItem(-1)}
                title="Item anterior ([)"
                className="px-1.5 py-1 hover:bg-stone-800 text-amber-300 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 py-1 text-amber-200 font-bold tracking-wide min-w-[110px] text-center">
                {debugSelectedLabel}
              </span>
              <button
                type="button"
                onClick={() => handleCycleDebugItem(1)}
                title="Próximo item (] / Shift / X)"
                className="px-1.5 py-1 hover:bg-stone-800 text-amber-300 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePlaceDebugItem}
              className="px-2.5 py-1 rounded bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-400/70 text-white font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <Plus className="w-3 h-3" />
              <span>INSERIR (Espaço)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleDebugMode}
            className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-[9px] flex items-center gap-1 cursor-pointer"
          >
            <Bug className="w-3 h-3 text-cyan-400" />
            <span>SAIR DEBUG</span>
          </button>
        </div>
      )}

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
            onClick={handleCanvasDebugClick}
            className={`w-full h-full object-contain image-rendering-pixelated ${
              isDebugMode && isDebugPlacementActive ? 'cursor-crosshair' : ''
            }`}
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

          {/* Translucent On-Screen D-Pad & Action Buttons (A, B) Overlay on Canvas for Mobile Devices (hidden in Smart TV mode) */}
          {!smartTvMode && isMobileDevice && touchOverlayOnCanvas && hasStarted && !isSmwMapOpen && !isPaused && !isGameOver && !isMultiplayerMatchOver && (
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

          {/* Start Screen Splash — Simplified & Clean Hierarchy (R1.16.7H.4 + R1.16.EG.4) */}
          {!hasStarted && (
            <div
              ref={splashOverlayRef}
              className="absolute inset-0 z-20 flex flex-col items-center justify-between bg-black/88 p-3 sm:p-6 text-center animate-in fade-in overflow-y-auto"
            >
              {/* Top Utility Strip: Compact 16+ Badge + Quick Display/TV Toggles */}
              <div className="w-full max-w-xl flex items-center justify-between gap-2">
                <div
                  title="Recomendado para maiores de 16 anos (pode haver mensagens sugestivas no jogo)."
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/70 text-[10px] sm:text-xs text-amber-200"
                >
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 font-['Press_Start_2P',monospace] text-[9px] font-extrabold">
                    16+
                  </span>
                  <span className="hidden sm:inline font-medium">
                    Recomendado 16+ · Mensagens sugestivas
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleSmartTvMode}
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      smartTvMode
                        ? 'bg-sky-900/90 border-sky-400 text-sky-100'
                        : 'bg-stone-900/90 hover:bg-stone-800 border-stone-700 text-stone-300'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5 text-sky-400" />
                    <span>{smartTvMode ? 'TV: ON' : 'TV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      isFullscreen
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                        : 'bg-stone-900/90 hover:bg-stone-800 border-stone-700 text-stone-200'
                    }`}
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
                  </button>
                </div>
              </div>

              {/* Center Hero & Focused Mode Selection */}
              <div className="w-full max-w-xl my-auto py-3 flex flex-col items-center">
                <span className="block text-amber-400 font-['Press_Start_2P',monospace] text-xl sm:text-3xl font-extrabold tracking-wider drop-shadow-md">
                  SUPER MARIO BROS.
                </span>
                <p className="mt-1.5 text-[11px] sm:text-xs text-stone-400 font-mono">
                  60 FPS Canvas · Clássico NES · Modo World · Campanha 7 Mundos
                </p>

                {/* Primary Play Actions (3 focused modes) */}
                <div className="mt-4 sm:mt-5 w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-['Press_Start_2P',monospace] text-white text-[10px] sm:text-xs font-bold shadow-xl shadow-red-950/50 transform hover:scale-[1.03] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white shrink-0" />
                    <span>JOGAR CLÁSSICO</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenSmwWorldMap}
                    className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 hover:from-emerald-600 hover:to-teal-500 border border-amber-300/70 font-['Press_Start_2P',monospace] text-white text-[10px] sm:text-xs font-bold shadow-xl shadow-emerald-950/50 transform hover:scale-[1.03] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MapIcon className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>MODO WORLD</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartSingleplayer}
                    className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 border border-pink-300/60 font-['Press_Start_2P',monospace] text-white text-[10px] sm:text-xs font-bold shadow-xl shadow-pink-950/50 transform hover:scale-[1.03] active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Crown className="w-4 h-4 text-amber-200 shrink-0" />
                    <span>7 MUNDOS</span>
                  </button>
                </div>

                {/* Secondary Utilities (Compact single row) */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMultiplayerOpen(true)}
                    className="px-3 py-2 rounded-lg bg-emerald-950/85 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Multiplayer</span>
                  </button>

                  <button
                    type="button"
                    onClick={openLevelEditor}
                    className="px-3 py-2 rounded-lg bg-sky-950/85 hover:bg-sky-900 border border-sky-500/70 text-sky-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Hammer className="w-3.5 h-3.5 text-sky-400" />
                    <span>Editor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLeaderboardOpen(true)}
                    className="px-3 py-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 border border-amber-500/60 text-amber-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ranking{stats.highScore > 0 ? ` (${stats.highScore.toLocaleString()})` : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openUpdatesModal('fixes')}
                    className="px-3 py-2 rounded-lg bg-amber-950/85 hover:bg-amber-900 border border-amber-400/80 text-amber-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Correções Recentes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="px-3 py-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Settings className="w-3.5 h-3.5 text-stone-300" />
                    <span>Opções</span>
                  </button>
                </div>

                {/* Compact Controls Hint */}
                <div className="mt-3 text-[10px] sm:text-[11px] text-amber-300/90 font-mono">
                  {smartTvMode
                    ? '[◀▶▼] Mover • [OK / ▲ / Vermelho] Pular • [Azul / 0] Correr/Fogo • [Voltar] Pausar'
                    : '[Setas / WASD] Mover • [Espaço / Z] Pular • [Shift / X] Correr / Fogo'}
                </div>
              </div>

              {/* Compact Footer Attribution + Hidden Cheat Trigger */}
              <div className="w-full max-w-xl flex flex-col items-center">
                <p className="text-[10px] text-stone-500 font-mono leading-snug">
                  Projeto não oficial de fãs (WazzimaGiygg). Jogo original pertence à Nintendo. Όχι, ο Χρόνος δεν είναι ο άρχοντας της γνώσης!
                </p>
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
              ref={pauseOverlayRef}
              role="dialog"
              aria-label="PAUSED"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs p-4 text-center"
            >
              <h2 className="font-['Press_Start_2P',monospace] text-2xl sm:text-4xl text-amber-400 mb-3 tracking-widest drop-shadow-[0_3px_0_rgba(0,0,0,0.9)]">
                PAUSED
              </h2>
              <p className="text-stone-300 font-mono text-xs mb-6">
                {smartTvMode ? (
                  <>
                    Use as <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">SETAS</kbd> +{' '}
                    <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">OK</kbd> ou{' '}
                    <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">VOLTAR</kbd> para continuar
                  </>
                ) : (
                  <>
                    Pressione <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">ESC</kbd> ou{' '}
                    <kbd className="px-1.5 py-0.5 bg-stone-800 border border-stone-600 rounded text-amber-300">P</kbd> para continuar
                  </>
                )}
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
                  onClick={() => openUpdatesModal('fixes')}
                  className="px-4 py-2.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-400/70 text-amber-200 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  CORREÇÕES
                </button>
                <button
                  type="button"
                  onClick={() => openUpdatesModal('all')}
                  className="px-5 py-2.5 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-500/60 text-purple-200 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ScrollText className="w-3.5 h-3.5 text-purple-300" />
                  NOVIDADES
                </button>
                {isCustomLevelActive && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !editorImmortality;
                      setEditorImmortality(next);
                      engineRef.current?.setEditorImmortality(next);
                      if (engineRef.current) {
                        setStats({ ...engineRef.current.stats, isNewHighScore: false });
                      }
                    }}
                    className={`px-4 py-2.5 rounded-lg border font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer ${
                      editorImmortality
                        ? 'bg-purple-900 hover:bg-purple-800 border-purple-400 text-purple-100'
                        : 'bg-stone-800 hover:bg-stone-700 border-stone-600 text-stone-300'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-300" />
                    IMORTAL: {editorImmortality ? 'ON' : 'OFF'}
                  </button>
                )}
                {isSmwModeActive && (
                  <button
                    type="button"
                    onClick={handleReturnToSmwOverworld}
                    className="px-5 py-2.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 border border-emerald-400/70 text-emerald-100 font-['Press_Start_2P',monospace] text-xs shadow flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <MapIcon className="w-3.5 h-3.5 text-amber-300" />
                    OVERWORLD
                  </button>
                )}
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

          {/* Super Mario World Beta V0.9 Overworld Map (Ilha 1 WikiWorldWeb & Ilha 2 Terras de Chronus) */}
          <SmwOverworldMap
            isOpen={isSmwMapOpen && hasStarted && !isGameOver && !isMultiplayerMatchOver}
            progress={smwProgress}
            playerCharacter={engineRef.current?.playerCharacter || 'mario'}
            justClearedNodeId={smwJustClearedNodeId}
            onSelectNode={nodeId => {
              setSmwProgress(prev => {
                const updated = { ...prev, selectedNodeId: nodeId };
                saveSmwBetaProgress(updated);
                return updated;
              });
            }}
            onSelectIsland={islandId => {
              setSmwProgress(prev => {
                const updated = { ...prev, selectedIslandId: islandId };
                saveSmwBetaProgress(updated);
                return updated;
              });
            }}
            onEnterStage={handleEnterSmwStage}
            onDismissStory={() => {
              setSmwProgress(prev => {
                if (prev.storySeen) return prev;
                const updated = { ...prev, storySeen: true };
                saveSmwBetaProgress(updated);
                return updated;
              });
            }}
            onResetProgress={() => {
              const reset: SmwBetaProgress = {
                clearedNodeIds: [],
                selectedNodeId: 'wiki-1-overworld',
                selectedIslandId: 'wikiworld',
                storySeen: true,
                yellowSwitchUnlocked: false,
              };
              if (engineRef.current) {
                engineRef.current.yellowSwitchUnlocked = false;
              }
              setSmwProgress(reset);
              setSmwJustClearedNodeId(null);
              saveSmwBetaProgress(reset);
            }}
            onBackToMainMenu={handleReturnToMainMenu}
          />

          {/* Multiplayer Winner Overlay (when any player loses all lives) */}
          {isMultiplayerMatchOver && multiplayerMatchResult && (
            <div
              ref={multiplayerOverOverlayRef}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 p-4 sm:p-6 text-center animate-in zoom-in-95 overflow-y-auto"
            >
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
            <div
              ref={gameOverOverlayRef}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center animate-in zoom-in-95"
            >
              <h2 className="font-['Press_Start_2P',monospace] text-3xl sm:text-5xl text-red-600 mb-3 tracking-widest drop-shadow-lg">
                GAME OVER
              </h2>
              {stats.isNewHighScore && !isCheatActive && !isCustomLevelActive && (
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
                {lastSavedRank !== null && !isCheatActive && !isCustomLevelActive && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-bold">
                    #{lastSavedRank} NO RANKING
                  </span>
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRestart}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg transform hover:scale-105 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  JOGAR NOVAMENTE
                </button>
                {isSmwModeActive && (
                  <button
                    type="button"
                    onClick={handleReturnToSmwOverworld}
                    className="px-5 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-400/70 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <MapIcon className="w-4 h-4 text-amber-300" />
                    OVERWORLD
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/50 font-['Press_Start_2P',monospace] text-xs font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {!isCheatActive && !isCustomLevelActive && stats.score > 0 ? 'RANKING / NOME' : 'VER RANKING'}
                </button>
              </div>
            </div>
          )}

          {/* Final 7-World Singleplayer Victory Overlay (Princesa Femboy Rescued!) */}
          {isCampaignVictory && !isGameOver && !isMultiplayerMatchOver && (
            <div
              ref={victoryOverlayRef}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/92 p-5 sm:p-6 text-center animate-in zoom-in-95 overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-7 h-7 text-amber-400 fill-amber-400" />
                <Heart className="w-6 h-6 text-pink-400 fill-pink-500" />
              </div>
              <h2 className="font-['Press_Start_2P',monospace] text-lg sm:text-2xl text-pink-300 mb-2 tracking-wider drop-shadow-lg">
                7 MUNDOS CONCLUÍDOS!
              </h2>
              <p className="text-amber-300 font-mono text-xs sm:text-sm font-bold mb-1">
                Você salvou a Princesa Femboy no Castelo Final (7-5)!
              </p>
              <p className="text-stone-300 font-mono text-xs mb-3">
                Pontuação Final:{' '}
                <span className="font-bold text-amber-400 text-sm">{stats.score.toLocaleString()}</span>
                {' · '}
                Moedas: <span className="font-bold text-amber-300">{stats.coins}</span>
              </p>
              {stats.isNewHighScore && !isCheatActive && !isCustomLevelActive && (
                <div className="mb-3 px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>NOVO RECORDE LOCAL!</span>
                </div>
              )}
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                <button
                  type="button"
                  onClick={handleStartSingleplayer}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 text-white font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  JOGAR NOVAMENTE
                </button>
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  className="px-5 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/50 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {!isCheatActive && !isCustomLevelActive && stats.score > 0 ? 'RANKING / NOME' : 'VER RANKING'}
                </button>
                <button
                  type="button"
                  onClick={handleReturnToMainMenu}
                  className="px-5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-600 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  MENU INICIAL
                </button>
              </div>
            </div>
          )}

          {/* Stage Clear & Multiplayer Waiting Banner */}
          {isStageClear && !isCampaignVictory && !isMultiplayerMatchOver && (
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

          {/* Botão do Desenvolvedor (ativo com cheat, debug ou para restaurar ILLEGAL INSTRUCTION) */}
          {(isCheatActive || isDebugMode || isIllegalInstructionBug) && (
            <button
              type="button"
              onClick={handleDeveloperButtonClick}
              title={isIllegalInstructionBug ? 'Restaurar tela bugada (Botão do Desenvolvedor)' : 'Página do desenvolvedor'}
              className={`p-2 rounded-lg border transition flex items-center gap-1.5 animate-pulse cursor-pointer ${
                isIllegalInstructionBug
                  ? 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400 text-emerald-200'
                  : 'bg-red-950/80 hover:bg-red-900 border-red-500 text-red-300 hover:text-white'
              }`}
            >
              <Flame className={`w-4 h-4 ${isIllegalInstructionBug ? 'text-emerald-400' : 'text-red-400'}`} />
              <span className="hidden sm:inline text-[11px] font-bold">
                {isIllegalInstructionBug ? 'Restaurar (Dev)' : 'Dev'}
              </span>
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

          {/* Correções Recentes com UID */}
          <button
            type="button"
            onClick={() => openUpdatesModal('fixes')}
            title="Correções recentes com UID específica"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-amber-500/45 text-amber-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline text-[11px]">Correções</span>
          </button>

          {/* Novidades / Updates */}
          <button
            type="button"
            onClick={() => openUpdatesModal('all')}
            title="Novidades e atualizações recentes do jogo"
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-purple-500/40 text-purple-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            <ScrollText className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline text-[11px]">Novidades</span>
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

          {/* Smart TV Mode Quick Button */}
          <button
            type="button"
            onClick={toggleSmartTvMode}
            title="Modo Smart TV (Controle Remoto)"
            className={`p-2 rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
              smartTvMode
                ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                : 'bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-300 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline text-[11px]">TV</span>
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

      {/* Smart TV Compact Remote Control Legend Strip */}
      {smartTvMode && !isFullscreen && (
        <div className="w-full max-w-4xl px-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-sky-950/45 border border-sky-700/50 text-[11px] font-mono text-sky-100">
            <span className="flex items-center gap-1.5 font-bold text-sky-300">
              <Tv className="w-3.5 h-3.5 text-sky-400" />
              MODO SMART TV
            </span>
            <span className="text-stone-300">
              <strong className="text-amber-300">◀▶▼</strong> Mover/Cano •{' '}
              <strong className="text-amber-300">OK/Vermelho{smartTvJumpWithUp ? '/▲' : ''}</strong> Pular •{' '}
              <strong className="text-amber-300">Azul/Verde/Ch+/0</strong> Correr/Fogo •{' '}
              <strong className="text-amber-300">Voltar/Play-Pause</strong> Pausar
            </span>
          </div>
        </div>
      )}

      {/* Docked Touch Controls (Shown ONLY during active gameplay; blocked in menus — R1.16.UF.4) */}
      {!smartTvMode &&
        (!isMobileDevice || !touchOverlayOnCanvas) &&
        hasStarted &&
        !isSmwMapOpen &&
        !isPaused &&
        !isGameOver &&
        !isCampaignVictory &&
        !isMultiplayerMatchOver && (
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
        onStartSingleplayer={handleStartSingleplayer}
        onStartSmwWorldMap={handleOpenSmwWorldMap}
        isDebugMode={isDebugMode}
        onToggleDebugMode={handleToggleDebugMode}
        smartTvMode={smartTvMode}
        onToggleSmartTvMode={toggleSmartTvMode}
        smartTvJumpWithUp={smartTvJumpWithUp}
        onToggleSmartTvJumpWithUp={toggleSmartTvJumpWithUp}
        smartTvAutoRun={smartTvAutoRun}
        onToggleSmartTvAutoRun={toggleSmartTvAutoRun}
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
        isCustomLevel={isCustomLevelActive}
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
        isDebugMode={isDebugMode}
        isDebugPlacementActive={isDebugPlacementActive}
        onToggleInfiniteLives={() => {
          engineRef.current?.toggleInfiniteLives();
          setStats({ ...engineRef.current!.stats });
        }}
        onToggleDebugMode={handleToggleDebugMode}
        onToggleDebugPlacement={handleToggleDebugPlacement}
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
        editorImmortality={editorImmortality}
        onToggleEditorImmortality={enabled => {
          setEditorImmortality(enabled);
          if (engineRef.current?.level?.isCustom) {
            engineRef.current.setEditorImmortality(enabled);
          }
        }}
      />

      {/* Updates / Correções Recentes Modal */}
      <UpdatesModal
        isOpen={isUpdatesOpen}
        initialFilter={updatesFilter}
        onClose={() => setIsUpdatesOpen(false)}
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
