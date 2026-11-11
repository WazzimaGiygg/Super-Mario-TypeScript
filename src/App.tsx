/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameCanvas } from './components/GameCanvas.tsx';

export default function App() {
  return (
    <main className="w-full min-h-screen bg-stone-950 flex flex-col justify-between text-stone-100">
      <GameCanvas />
    </main>
  );
}
