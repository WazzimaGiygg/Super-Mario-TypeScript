/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  coins: number;
  world: string;
  date: string;
}

const STORAGE_KEY = 'smb_high_scores_v1';
const HIGH_SCORE_KEY = 'smb_best_score_v1';

const DEFAULT_SCORES: ScoreEntry[] = [
  { id: '1', name: 'MARIO', score: 12500, coins: 42, world: '1-2', date: '2026-11-09' },
  { id: '2', name: 'LUIGI', score: 8400, coins: 28, world: '1-1', date: '2026-11-09' },
  { id: '3', name: 'PEACH', score: 6200, coins: 19, world: '1-1', date: '2026-11-09' },
  { id: '4', name: 'TOAD', score: 4500, coins: 14, world: '1-1', date: '2026-11-09' },
  { id: '5', name: 'YOSHI', score: 2800, coins: 8, world: '1-1', date: '2026-11-09' },
];

export function getHighScores(): ScoreEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // LocalStorage unavailable
  }
  return DEFAULT_SCORES;
}

export function getTopScore(): number {
  try {
    const saved = localStorage.getItem(HIGH_SCORE_KEY);
    if (saved) {
      return parseInt(saved, 10) || 12500;
    }
  } catch {
    // LocalStorage unavailable
  }
  return 12500;
}

export function saveNewScore(score: number, coins: number, world: string, playerName: string = 'JOGADOR'): boolean {
  try {
    const currentTop = getTopScore();
    if (score > currentTop) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
    }

    const scores = getHighScores();
    const newEntry: ScoreEntry = {
      id: Date.now().toString(),
      name: playerName.toUpperCase().slice(0, 8),
      score,
      coins,
      world,
      date: new Date().toISOString().split('T')[0],
    };

    scores.push(newEntry);
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topScores));

    return score > currentTop;
  } catch {
    return false;
  }
}
