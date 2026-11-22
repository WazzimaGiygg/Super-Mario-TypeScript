/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TvRemoteAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'spinJump'
  | 'run'
  | 'select'
  | 'pause'
  | 'back'
  | 'confirm'
  | 'info'
  | 'restart';

export interface TvRemoteKeyInput {
  code?: string;
  key?: string;
  keyCode?: number;
}

export interface TvRemoteOptions {
  smartTvMode: boolean;
  jumpWithUp?: boolean;
  autoRun?: boolean;
}

export interface TvRemoteResolution {
  actions: TvRemoteAction[];
  shouldPreventDefault: boolean;
  isDirection: boolean;
  isConfirm: boolean;
  isBack: boolean;
  isPause: boolean;
  isSelect: boolean;
  isInfo: boolean;
}

const SMART_TV_UA_REGEX =
  /SmartTV|SMART-TV|Tizen|Web0S|webOS|GoogleTV|Android TV|BRAVIA|HbbTV|NetCast|Viera|VIDAA|Hisense|Roku|\bAFT[A-Z0-9]*\b|Xbox|PlayStation|CrKey/i;

/**
 * Detects common Smart TV, TV stick, and console browser User-Agent strings.
 */
export function isSmartTvUserAgent(userAgent?: string): boolean {
  const ua =
    userAgent !== undefined
      ? userAgent
      : typeof navigator !== 'undefined'
      ? navigator.userAgent || ''
      : '';
  if (!ua) return false;
  return SMART_TV_UA_REGEX.test(ua);
}

/**
 * Maps standard keyboard + Smart TV remote control keys (Tizen, WebOS, Android TV,
 * Google TV, Fire TV, HbbTV, CEC / Media keys) into normalized game & UI actions.
 *
 * Preserves 100% of original PC keyboard bindings while extending support to
 * Smart TV remote buttons (D-Pad, OK/Select/DPAD_CENTER, Back/Return, Color keys,
 * Media Play/Pause/FF, Channel Up/Down, and numeric keypad).
 */
export function resolveTvRemoteAction(
  input: TvRemoteKeyInput,
  options: TvRemoteOptions
): TvRemoteResolution {
  const code = input.code || '';
  const key = input.key || '';
  const keyCode = typeof input.keyCode === 'number' ? input.keyCode : 0;

  const actions = new Set<TvRemoteAction>();
  let shouldPreventDefault = false;

  // --- 1. Directional Pad (Standard Arrows, WASD, TV Numpad 2/4/6/8) ---
  if (
    code === 'ArrowLeft' ||
    code === 'KeyA' ||
    code === 'Digit4' ||
    code === 'Numpad4' ||
    key === 'ArrowLeft' ||
    key === 'Left' ||
    keyCode === 37
  ) {
    actions.add('left');
    shouldPreventDefault = true;
  }

  if (
    code === 'ArrowRight' ||
    code === 'KeyD' ||
    code === 'Digit6' ||
    code === 'Numpad6' ||
    key === 'ArrowRight' ||
    key === 'Right' ||
    keyCode === 39
  ) {
    actions.add('right');
    shouldPreventDefault = true;
  }

  if (
    code === 'ArrowUp' ||
    code === 'KeyW' ||
    code === 'Digit2' ||
    code === 'Numpad2' ||
    key === 'ArrowUp' ||
    key === 'Up' ||
    keyCode === 38
  ) {
    actions.add('up');
    if (options.smartTvMode && options.jumpWithUp) {
      actions.add('jump');
    }
    shouldPreventDefault = true;
  }

  if (
    code === 'ArrowDown' ||
    code === 'KeyS' ||
    code === 'Digit8' ||
    code === 'Numpad8' ||
    key === 'ArrowDown' ||
    key === 'Down' ||
    keyCode === 40
  ) {
    actions.add('down');
    shouldPreventDefault = true;
  }

  // --- 2. OK / Center / Select (Menu Confirm + Jump in active gameplay) ---
  if (
    code === 'Enter' ||
    code === 'NumpadEnter' ||
    code === 'Select' ||
    key === 'Enter' ||
    key === 'Select' ||
    key === 'OK' ||
    key === 'Accept' ||
    keyCode === 13 ||
    keyCode === 23 // Android TV DPAD_CENTER
  ) {
    actions.add('confirm');
    actions.add('jump');
    shouldPreventDefault = true;
  }

  // --- 3. Classic Jump + Smart TV Jump Keys (Red button / Ch- / 5) ---
  if (
    code === 'Space' ||
    code === 'KeyZ' ||
    code === 'ColorF0Red' ||
    code === 'PageDown' ||
    code === 'ChannelDown' ||
    code === 'Digit5' ||
    code === 'Numpad5' ||
    key === ' ' ||
    key === 'ColorF0Red' ||
    key === 'Red' ||
    key === 'ChannelDown' ||
    keyCode === 403 || // VK_RED (HbbTV / Tizen / WebOS)
    keyCode === 428 // ChannelDown
  ) {
    actions.add('jump');
    shouldPreventDefault = true;
  }

  // --- 3b. Spin Jump / Pulo Carpado (Dedicated Key C / Q) ---
  if (
    code === 'KeyC' ||
    code === 'KeyQ' ||
    key === 'c' ||
    key === 'C' ||
    key === 'q' ||
    key === 'Q'
  ) {
    actions.add('spinJump');
    shouldPreventDefault = true;
  }

  // --- 4. Run / Fireball / Tail Whip (PC + TV Blue/Green/Yellow, Ch+, FF, 0/1/3) ---
  if (
    code === 'ShiftLeft' ||
    code === 'ShiftRight' ||
    code === 'KeyX' ||
    code === 'KeyK' ||
    code === 'ColorF1Green' ||
    code === 'ColorF2Yellow' ||
    code === 'ColorF3Blue' ||
    code === 'ChannelUp' ||
    code === 'PageUp' ||
    code === 'MediaFastForward' ||
    code === 'Digit0' ||
    code === 'Numpad0' ||
    code === 'Digit1' ||
    code === 'Numpad1' ||
    code === 'Digit3' ||
    code === 'Numpad3' ||
    key === 'ColorF1Green' ||
    key === 'Green' ||
    key === 'ColorF2Yellow' ||
    key === 'Yellow' ||
    key === 'ColorF3Blue' ||
    key === 'Blue' ||
    key === 'ChannelUp' ||
    key === 'MediaFastForward' ||
    keyCode === 404 || // VK_GREEN
    keyCode === 405 || // VK_YELLOW
    keyCode === 406 || // VK_BLUE
    keyCode === 417 || // VK_FAST_FWD (TV remote)
    keyCode === 228 || // MediaFastForward (Android)
    keyCode === 427 // ChannelUp
  ) {
    actions.add('run');
    shouldPreventDefault = true;
  }

  // --- 4b. Select (Reserve Box power-up drop / Exit cleared World stage when paused) ---
  if (
    code === 'KeyV' ||
    code === 'Tab' ||
    key === 'v' ||
    key === 'V' ||
    key === 'Tab'
  ) {
    actions.add('select');
    shouldPreventDefault = true;
  }

  // --- 5. Pause / Media Play-Pause ---
  if (
    code === 'Escape' ||
    code === 'KeyP' ||
    code === 'MediaPlayPause' ||
    code === 'MediaPlay' ||
    code === 'MediaPause' ||
    code === 'Pause' ||
    key === 'Escape' ||
    key === 'MediaPlayPause' ||
    key === 'MediaPlay' ||
    key === 'MediaPause' ||
    key === 'Pause' ||
    keyCode === 19 || // Pause
    keyCode === 179 || // MediaPlayPause (Windows/Chrome/TV)
    keyCode === 415 || // Play (Tizen/WebOS)
    keyCode === 10252 // MediaPlayPause (Samsung Tizen)
  ) {
    actions.add('pause');
    shouldPreventDefault = true;
  }

  // --- 6. Back / Return / Exit (Tizen 10009, WebOS 461, Android 4, Backspace) ---
  if (
    code === 'Escape' ||
    code === 'Backspace' ||
    code === 'BrowserBack' ||
    code === 'GoBack' ||
    key === 'Escape' ||
    key === 'Backspace' ||
    key === 'BrowserBack' ||
    key === 'GoBack' ||
    key === 'Back' ||
    key === 'XF86Back' ||
    key === 'Exit' ||
    keyCode === 27 ||
    keyCode === 8 ||
    keyCode === 4 || // Android Back
    keyCode === 461 || // LG WebOS Back
    keyCode === 10009 // Samsung Tizen Return
  ) {
    actions.add('back');
    shouldPreventDefault = true;
  }

  // --- 7. Info / Settings Menu (TV Info / Menu / ContextMenu) ---
  if (
    code === 'ContextMenu' ||
    code === 'F2' ||
    key === 'Info' ||
    key === 'ContextMenu' ||
    key === 'Menu' ||
    keyCode === 457 || // VK_INFO
    keyCode === 93 // ContextMenu
  ) {
    actions.add('info');
    shouldPreventDefault = true;
  }

  // --- 8. Quick Restart (Keyboard R only to prevent accidental numeric remote restarts) ---
  if (code === 'KeyR') {
    actions.add('restart');
  }

  const list = Array.from(actions);
  return {
    actions: list,
    shouldPreventDefault,
    isDirection:
      actions.has('left') ||
      actions.has('right') ||
      actions.has('up') ||
      actions.has('down'),
    isConfirm: actions.has('confirm'),
    isBack: actions.has('back'),
    isPause: actions.has('pause'),
    isSelect: actions.has('select'),
    isInfo: actions.has('info'),
  };
}

export type SpatialDirection = 'up' | 'down' | 'left' | 'right';

export interface SpatialBox {
  id: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/**
 * Pure geometric nearest-neighbor scoring for 2D D-Pad focus navigation.
 * Exported separately so unit/regression tests can verify TV menu navigation cleanly.
 */
export function findBestSpatialCandidateIndex(
  current: SpatialBox,
  candidates: SpatialBox[],
  direction: SpatialDirection
): number {
  let bestIdx = -1;
  let bestScore = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.id === current.id) continue;

    const dx = c.cx - current.cx;
    const dy = c.cy - current.cy;

    let primary = 0;
    let perp = 0;
    if (direction === 'right') {
      if (dx <= 4) continue;
      primary = dx;
      perp = Math.abs(dy);
    } else if (direction === 'left') {
      if (dx >= -4) continue;
      primary = -dx;
      perp = Math.abs(dy);
    } else if (direction === 'down') {
      if (dy <= 4) continue;
      primary = dy;
      perp = Math.abs(dx);
    } else {
      if (dy >= -4) continue;
      primary = -dy;
      perp = Math.abs(dx);
    }

    // Strongly favor aligned items along the navigation axis
    const score = primary + perp * 2.25;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled):not([type="hidden"]):not([tabindex="-1"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getVisibleFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

/**
 * Moves focus between interactive controls inside a container using D-Pad directions.
 * Returns true if focus moved (or initialized onto the first control).
 */
export function moveFocusWithDpad(
  container: HTMLElement | null,
  direction: SpatialDirection
): boolean {
  if (!container) return false;
  const focusables = getVisibleFocusableElements(container);
  if (focusables.length === 0) return false;

  const active = document.activeElement as HTMLElement | null;
  const currentIdx = active ? focusables.indexOf(active) : -1;

  if (currentIdx === -1) {
    const first = focusables[0];
    first.focus();
    first.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  const boxes: SpatialBox[] = focusables.map((el, idx) => {
    const r = el.getBoundingClientRect();
    return {
      id: idx,
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      width: r.width,
      height: r.height,
    };
  });

  const bestIdx = findBestSpatialCandidateIndex(boxes[currentIdx], boxes, direction);
  if (bestIdx !== -1) {
    const nextEl = focusables[bestIdx];
    nextEl.focus();
    nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  // Fallback linear wrap for narrow single-column menus on Up/Down
  if (direction === 'down' || direction === 'right') {
    const nextIdx = (currentIdx + 1) % focusables.length;
    if (nextIdx !== currentIdx) {
      focusables[nextIdx].focus();
      focusables[nextIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return true;
    }
  } else if (direction === 'up' || direction === 'left') {
    const prevIdx = (currentIdx - 1 + focusables.length) % focusables.length;
    if (prevIdx !== currentIdx) {
      focusables[prevIdx].focus();
      focusables[prevIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return true;
    }
  }

  return false;
}
