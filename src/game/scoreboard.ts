/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameDifficulty, PlayerCharacter } from './types.ts';

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  coins: number;
  world: string;
  date: string;
  character?: PlayerCharacter;
  difficulty?: GameDifficulty;
}

export interface SaveScoreMeta {
  id?: string;
  character?: PlayerCharacter;
  difficulty?: GameDifficulty;
}

export interface SaveScoreResult {
  entry: ScoreEntry;
  isNewHighScore: boolean;
  rank: number | null;
  scores: ScoreEntry[];
}

const STORAGE_KEY = 'smb_high_scores_v1';
const HIGH_SCORE_KEY = 'smb_best_score_v1';
const LAST_NAME_KEY = 'smb_last_player_name_v1';
const MAX_RANKING_ENTRIES = 10;

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {
    // LocalStorage unavailable or quota exceeded
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function sanitizeScoreEntries(raw: unknown): ScoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid: ScoreEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const score = typeof obj.score === 'number' && Number.isFinite(obj.score) ? Math.max(0, Math.floor(obj.score)) : 0;
    const coins = typeof obj.coins === 'number' && Number.isFinite(obj.coins) ? Math.max(0, Math.floor(obj.coins)) : 0;
    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().toUpperCase().slice(0, 12) : 'JOGADOR';
    const world = typeof obj.world === 'string' && obj.world.trim() ? obj.world.trim() : '1-1';
    const date = typeof obj.date === 'string' && obj.date.trim() ? obj.date.trim() : new Date().toISOString().split('T')[0];
    const id = typeof obj.id === 'string' && obj.id ? obj.id : `${date}_${score}_${valid.length}`;
    const character = obj.character === 'mario' || obj.character === 'wazzima' ? obj.character : undefined;
    const difficulty =
      obj.difficulty === 'easy' || obj.difficulty === 'normal' || obj.difficulty === 'hard'
        ? obj.difficulty
        : undefined;

    valid.push({ id, name, score, coins, world, date, character, difficulty });
  }
  valid.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.coins - a.coins;
  });
  return valid.slice(0, MAX_RANKING_ENTRIES);
}

export function getHighScores(): ScoreEntry[] {
  const data = safeGetItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return sanitizeScoreEntries(JSON.parse(data));
  } catch {
    return [];
  }
}

export function getTopScore(): number {
  const savedRaw = safeGetItem(HIGH_SCORE_KEY);
  const parsedBest = savedRaw ? Math.max(0, parseInt(savedRaw, 10) || 0) : 0;
  const scores = getHighScores();
  const rankingBest = scores.length > 0 ? scores[0].score : 0;
  return Math.max(parsedBest, rankingBest);
}

export function updateTopScore(score: number): boolean {
  const cleanScore = Math.max(0, Math.floor(score));
  if (cleanScore <= 0) return false;
  const currentTop = getTopScore();
  if (cleanScore > currentTop) {
    safeSetItem(HIGH_SCORE_KEY, String(cleanScore));
    return true;
  }
  return false;
}

export function getLastPlayerName(): string {
  return safeGetItem(LAST_NAME_KEY) || '';
}

export function saveLastPlayerName(name: string): void {
  const clean = name.trim().toUpperCase().slice(0, 12);
  if (clean) {
    safeSetItem(LAST_NAME_KEY, clean);
  }
}

export function saveNewScore(
  score: number,
  coins: number,
  world: string,
  playerName: string = 'JOGADOR',
  meta?: SaveScoreMeta
): SaveScoreResult {
  const cleanScore = Math.max(0, Math.floor(score));
  const cleanCoins = Math.max(0, Math.floor(coins));
  const cleanName = (playerName.trim() || 'JOGADOR').toUpperCase().slice(0, 12);
  const entryId = meta?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const prevTop = getTopScore();
  const isNewHighScore = cleanScore > prevTop;
  if (isNewHighScore) {
    safeSetItem(HIGH_SCORE_KEY, String(cleanScore));
  }

  if (playerName.trim() && playerName.trim().toUpperCase() !== 'JOGADOR') {
    saveLastPlayerName(cleanName);
  }

  const scores = getHighScores();
  const existingIdx = scores.findIndex(s => s.id === entryId);

  const newEntry: ScoreEntry = {
    id: entryId,
    name: cleanName,
    score: cleanScore,
    coins: cleanCoins,
    world: world || '1-1',
    date: new Date().toISOString().split('T')[0],
    character: meta?.character,
    difficulty: meta?.difficulty,
  };

  if (existingIdx >= 0) {
    // Update existing run entry in place (e.g. player customized their name or raised their score)
    scores[existingIdx] = {
      ...scores[existingIdx],
      ...newEntry,
      score: Math.max(scores[existingIdx].score, cleanScore),
      coins: Math.max(scores[existingIdx].coins, cleanCoins),
    };
  } else {
    scores.push(newEntry);
  }

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.coins - a.coins;
  });

  const topScores = scores.slice(0, MAX_RANKING_ENTRIES);
  safeSetItem(STORAGE_KEY, JSON.stringify(topScores));

  const savedIndex = topScores.findIndex(s => s.id === entryId);
  return {
    entry: savedIndex >= 0 ? topScores[savedIndex] : newEntry,
    isNewHighScore,
    rank: savedIndex >= 0 ? savedIndex + 1 : null,
    scores: topScores,
  };
}

export function clearHighScores(): void {
  safeRemoveItem(STORAGE_KEY);
  safeRemoveItem(HIGH_SCORE_KEY);
}
