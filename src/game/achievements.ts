/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AchievementMetric =
  | 'goombas_defeated'
  | 'level_clear_under_60s'
  | 'enemies_defeated'
  | 'coins_collected'
  | 'bricks_broken'
  | 'w_coin_sets'
  | 'bowsers_defeated'
  | 'levels_completed';

export type AchievementBadgeKind =
  | 'goomba'
  | 'speedrun'
  | 'combat'
  | 'coin'
  | 'brick'
  | 'wcoin'
  | 'boss'
  | 'world';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  metric: AchievementMetric;
  target: number;
  rewardPoints: number;
  rewardLives: number;
  badge: AchievementBadgeKind;
}

export interface AchievementProgressView extends AchievementDefinition {
  progress: number;
  unlocked: boolean;
  unlockedAt: number | null;
}

export interface AchievementUnlockEvent {
  achievement: AchievementDefinition;
  unlockedAt: number;
  rewardPoints: number;
  rewardLives: number;
}

export interface AchievementsPersistedState {
  metrics: Record<AchievementMetric, number>;
  unlocked: Record<string, number>;
}

export const ACHIEVEMENTS_STORAGE_KEY = 'smb_achievements_v1';

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: 'defeat_10_goombas',
    title: 'Caçador de Goombas',
    description: 'Derrote 10 Goombas em combate (Defeat 10 Goombas)',
    metric: 'goombas_defeated',
    target: 10,
    rewardPoints: 1000,
    rewardLives: 1,
    badge: 'goomba',
  },
  {
    id: 'clear_under_60s',
    title: 'Velocista',
    description: 'Conclua uma fase em menos de 60 segundos (Complete level under 60 seconds)',
    metric: 'level_clear_under_60s',
    target: 1,
    rewardPoints: 1500,
    rewardLives: 1,
    badge: 'speedrun',
  },
  {
    id: 'defeat_25_enemies',
    title: 'Varredor de Fases',
    description: 'Derrote 25 inimigos no total',
    metric: 'enemies_defeated',
    target: 25,
    rewardPoints: 1500,
    rewardLives: 1,
    badge: 'combat',
  },
  {
    id: 'collect_50_coins',
    title: 'Caçador de Moedas',
    description: 'Colete 50 moedas pelas fases',
    metric: 'coins_collected',
    target: 50,
    rewardPoints: 1000,
    rewardLives: 1,
    badge: 'coin',
  },
  {
    id: 'break_10_bricks',
    title: 'Demolidor',
    description: 'Quebre 10 blocos de tijolo',
    metric: 'bricks_broken',
    target: 10,
    rewardPoints: 500,
    rewardLives: 0,
    badge: 'brick',
  },
  {
    id: 'collect_4_w_coins',
    title: 'Colecionador W',
    description: 'Colete todas as 4 moedas gigantes "W" em uma fase',
    metric: 'w_coin_sets',
    target: 1,
    rewardPoints: 1000,
    rewardLives: 0,
    badge: 'wcoin',
  },
  {
    id: 'defeat_bowser',
    title: 'Algoz de Bowser',
    description: 'Derrote Bowser no castelo',
    metric: 'bowsers_defeated',
    target: 1,
    rewardPoints: 2500,
    rewardLives: 2,
    badge: 'boss',
  },
  {
    id: 'complete_3_levels',
    title: 'Aventureiro',
    description: 'Conclua 3 fases completas',
    metric: 'levels_completed',
    target: 3,
    rewardPoints: 2000,
    rewardLives: 1,
    badge: 'world',
  },
];

function createEmptyMetrics(): Record<AchievementMetric, number> {
  return {
    goombas_defeated: 0,
    level_clear_under_60s: 0,
    enemies_defeated: 0,
    coins_collected: 0,
    bricks_broken: 0,
    w_coin_sets: 0,
    bowsers_defeated: 0,
    levels_completed: 0,
  };
}

export function createEmptyAchievementsState(): AchievementsPersistedState {
  return {
    metrics: createEmptyMetrics(),
    unlocked: {},
  };
}

function sanitizePersistedState(raw: unknown): AchievementsPersistedState {
  const empty = createEmptyAchievementsState();
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as {
    metrics?: Record<string, unknown>;
    unlocked?: Record<string, unknown>;
  };

  if (obj.metrics && typeof obj.metrics === 'object') {
    for (const key of Object.keys(empty.metrics) as AchievementMetric[]) {
      const val = obj.metrics[key];
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        empty.metrics[key] = Math.floor(val);
      }
    }
  }

  const validIds = new Set(ACHIEVEMENT_DEFINITIONS.map(def => def.id));
  if (obj.unlocked && typeof obj.unlocked === 'object') {
    for (const [id, ts] of Object.entries(obj.unlocked)) {
      if (validIds.has(id) && typeof ts === 'number' && Number.isFinite(ts) && ts > 0) {
        empty.unlocked[id] = ts;
      }
    }
  }

  return empty;
}

export class AchievementManager {
  private state: AchievementsPersistedState;
  private storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  constructor(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
    this.storage =
      storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    this.state = this.load();
  }

  private load(): AchievementsPersistedState {
    try {
      if (!this.storage) return createEmptyAchievementsState();
      const raw = this.storage.getItem(ACHIEVEMENTS_STORAGE_KEY);
      if (!raw) return createEmptyAchievementsState();
      return sanitizePersistedState(JSON.parse(raw));
    } catch {
      return createEmptyAchievementsState();
    }
  }

  private persist(): void {
    try {
      if (!this.storage) return;
      this.storage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore quota/storage errors in headless or restricted environments
    }
  }

  public recordMetric(
    metric: AchievementMetric,
    delta: number = 1,
    now: number = Date.now()
  ): AchievementUnlockEvent[] {
    if (!Number.isFinite(delta) || delta <= 0) return [];
    const increment = Math.floor(delta);
    if (increment <= 0) return [];

    this.state.metrics[metric] = (this.state.metrics[metric] ?? 0) + increment;
    const currentValue = this.state.metrics[metric];
    const newlyUnlocked: AchievementUnlockEvent[] = [];

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (def.metric !== metric) continue;
      if (this.state.unlocked[def.id] !== undefined) continue;
      if (currentValue >= def.target) {
        this.state.unlocked[def.id] = now;
        newlyUnlocked.push({
          achievement: def,
          unlockedAt: now,
          rewardPoints: def.rewardPoints,
          rewardLives: def.rewardLives,
        });
      }
    }

    this.persist();
    return newlyUnlocked;
  }

  public getViews(): AchievementProgressView[] {
    return ACHIEVEMENT_DEFINITIONS.map(def => {
      const unlockedAt = this.state.unlocked[def.id] ?? null;
      const rawProgress = this.state.metrics[def.metric] ?? 0;
      const progress = unlockedAt !== null ? def.target : Math.min(def.target, rawProgress);
      return {
        ...def,
        progress,
        unlocked: unlockedAt !== null,
        unlockedAt,
      };
    });
  }

  public getSummary(): {
    unlockedCount: number;
    totalCount: number;
    totalRewardPoints: number;
    totalRewardLives: number;
  } {
    let unlockedCount = 0;
    let totalRewardPoints = 0;
    let totalRewardLives = 0;

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (this.state.unlocked[def.id] !== undefined) {
        unlockedCount++;
        totalRewardPoints += def.rewardPoints;
        totalRewardLives += def.rewardLives;
      }
    }

    return {
      unlockedCount,
      totalCount: ACHIEVEMENT_DEFINITIONS.length,
      totalRewardPoints,
      totalRewardLives,
    };
  }

  public getMetricValue(metric: AchievementMetric): number {
    return this.state.metrics[metric] ?? 0;
  }

  public reset(): void {
    this.state = createEmptyAchievementsState();
    try {
      this.storage?.removeItem(ACHIEVEMENTS_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}
