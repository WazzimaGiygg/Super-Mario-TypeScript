/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GamepadControls } from '../game/types.ts';
import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';

interface TouchControlsProps {
  controls: GamepadControls;
  onControlChange: (key: keyof GamepadControls, active: boolean) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ controls, onControlChange }) => {
  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch {
      // Haptics not allowed or not supported
    }
  };

  const handleTouchStart = (key: keyof GamepadControls) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    triggerHaptic();
    onControlChange(key, true);
  };

  const handleTouchEnd = (key: keyof GamepadControls) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onControlChange(key, false);
  };

  return (
    <div className="w-full flex items-center justify-between px-4 py-3 bg-stone-950/80 backdrop-blur-md select-none touch-none border-t border-stone-800">
      {/* D-Pad */}
      <div className="relative w-36 h-36">
        {/* Up */}
        <button
          type="button"
          className={`absolute top-0 left-12 w-12 h-12 rounded-t-lg border-2 border-stone-600 flex items-center justify-center transition-all ${
            controls.up ? 'bg-amber-500 text-black shadow-inner' : 'bg-stone-800 text-stone-200 active:bg-stone-700'
          }`}
          onTouchStart={handleTouchStart('up')}
          onTouchEnd={handleTouchEnd('up')}
          onMouseDown={handleTouchStart('up')}
          onMouseUp={handleTouchEnd('up')}
        >
          <ArrowUp className="w-6 h-6" />
        </button>

        {/* Left */}
        <button
          type="button"
          className={`absolute top-12 left-0 w-12 h-12 rounded-l-lg border-2 border-stone-600 flex items-center justify-center transition-all ${
            controls.left ? 'bg-amber-500 text-black shadow-inner' : 'bg-stone-800 text-stone-200 active:bg-stone-700'
          }`}
          onTouchStart={handleTouchStart('left')}
          onTouchEnd={handleTouchEnd('left')}
          onMouseDown={handleTouchStart('left')}
          onMouseUp={handleTouchEnd('left')}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Center Pivot */}
        <div className="absolute top-12 left-12 w-12 h-12 bg-stone-900 border-2 border-stone-700 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-stone-700"></div>
        </div>

        {/* Right */}
        <button
          type="button"
          className={`absolute top-12 right-0 w-12 h-12 rounded-r-lg border-2 border-stone-600 flex items-center justify-center transition-all ${
            controls.right ? 'bg-amber-500 text-black shadow-inner' : 'bg-stone-800 text-stone-200 active:bg-stone-700'
          }`}
          onTouchStart={handleTouchStart('right')}
          onTouchEnd={handleTouchEnd('right')}
          onMouseDown={handleTouchStart('right')}
          onMouseUp={handleTouchEnd('right')}
        >
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Down (Crouch / Enter Pipe) */}
        <button
          type="button"
          className={`absolute bottom-0 left-12 w-12 h-12 rounded-b-lg border-2 border-stone-600 flex items-center justify-center transition-all ${
            controls.down ? 'bg-amber-500 text-black shadow-inner' : 'bg-stone-800 text-stone-200 active:bg-stone-700'
          }`}
          onTouchStart={handleTouchStart('down')}
          onTouchEnd={handleTouchEnd('down')}
          onMouseDown={handleTouchStart('down')}
          onMouseUp={handleTouchEnd('down')}
        >
          <ArrowDown className="w-6 h-6" />
        </button>
      </div>

      {/* Middle Status / Start-Select */}
      <div className="hidden sm:flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => onControlChange('pause', !controls.pause)}
          className="px-4 py-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-[10px] font-['Press_Start_2P',monospace] text-stone-300 border border-stone-600"
        >
          {controls.pause ? 'RESUME' : 'PAUSE'}
        </button>
      </div>

      {/* NES Action Buttons: [B] Run/Shoot, [A] Jump */}
      <div className="flex items-center gap-4">
        {/* [B] Run / Shoot */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            className={`w-16 h-16 rounded-full border-4 border-red-950 flex items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold text-lg shadow-lg transform transition-all ${
              controls.run
                ? 'bg-red-700 translate-y-1 shadow-inner'
                : 'bg-red-600 active:bg-red-700 shadow-md active:translate-y-1'
            }`}
            onTouchStart={handleTouchStart('run')}
            onTouchEnd={handleTouchEnd('run')}
            onMouseDown={handleTouchStart('run')}
            onMouseUp={handleTouchEnd('run')}
          >
            B
          </button>
          <span className="text-[9px] font-['Press_Start_2P',monospace] text-stone-400 mt-1">CORRER</span>
        </div>

        {/* [A] Jump */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            className={`w-16 h-16 rounded-full border-4 border-red-950 flex items-center justify-center font-['Press_Start_2P',monospace] text-white font-bold text-lg shadow-lg transform -translate-y-2 transition-all ${
              controls.jump
                ? 'bg-red-700 -translate-y-1 shadow-inner'
                : 'bg-red-600 active:bg-red-700 shadow-md'
            }`}
            onTouchStart={handleTouchStart('jump')}
            onTouchEnd={handleTouchEnd('jump')}
            onMouseDown={handleTouchStart('jump')}
            onMouseUp={handleTouchEnd('jump')}
          >
            A
          </button>
          <span className="text-[9px] font-['Press_Start_2P',monospace] text-stone-400 -mt-1">PULAR</span>
        </div>
      </div>
    </div>
  );
};
