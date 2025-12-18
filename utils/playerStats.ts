import { PlayerStats, SerializedPlayerStats, RunHistoryEntry } from '../types';

const STORAGE_KEY = 'coronata_player_stats_v1';

export const createEmptyStats = (): PlayerStats => ({
  runsWon: 0,
  runsLost: 0,
  totalRuns: 0,
  currentStreak: 0,
  bestStreak: 0,
  totalEffectsFound: 0,
  uniqueEffectsFound: new Set(),
  cursesCompleted: 0,
  wandersCompleted: 0,
  totalCoinsEarned: 0,
  totalScore: 0,
  bestScore: 0,
  fastestWinTime: 0,
  runHistory: [],
  firstPlayDate: new Date().toISOString(),
  lastPlayDate: new Date().toISOString(),
});

export const loadPlayerStats = (): PlayerStats => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createEmptyStats();
    
    const parsed: SerializedPlayerStats = JSON.parse(stored);
    return {
      ...parsed,
      uniqueEffectsFound: new Set(parsed.uniqueEffectsFound || []),
    };
  } catch (error) {
    console.error('Failed to load player stats:', error);
    return createEmptyStats();
  }
};

export const savePlayerStats = (stats: PlayerStats): void => {
  try {
    const serialized: SerializedPlayerStats = {
      ...stats,
      uniqueEffectsFound: Array.from(stats.uniqueEffectsFound),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save player stats:', error);
  }
};

export const recordRunCompletion = (
  stats: PlayerStats,
  runData: RunHistoryEntry
): PlayerStats => {
  const newStats = { ...stats };
  
  // Update win/loss counts
  if (runData.result === 'won') {
    newStats.runsWon++;
    newStats.currentStreak++;
    newStats.bestStreak = Math.max(newStats.bestStreak, newStats.currentStreak);
    
    // Track fastest win
    if (newStats.fastestWinTime === 0 || runData.duration < newStats.fastestWinTime) {
      newStats.fastestWinTime = runData.duration;
    }
  } else {
    newStats.runsLost++;
    newStats.currentStreak = 0;
  }
  
  newStats.totalRuns++;
  
  // Track effects found
  const allEffects = [...runData.exploits, ...runData.curses, ...runData.blessings];
  allEffects.forEach(effectId => {
    if (!newStats.uniqueEffectsFound.has(effectId)) {
      newStats.uniqueEffectsFound.add(effectId);
      newStats.totalEffectsFound++;
    }
  });
  
  // Track encounters completed
  runData.encounters.forEach(enc => {
    if (enc.passed) {
      if (enc.type === 'curse' || enc.type === 'boss') newStats.cursesCompleted++;
      if (enc.type === 'wander') newStats.wandersCompleted++;
    }
  });
  
  // Track scores and coins
  newStats.totalScore += runData.score;
  newStats.bestScore = Math.max(newStats.bestScore, runData.score);
  newStats.totalCoinsEarned += runData.finalCoins;
  
  // Add to history (keep last 50 runs)
  newStats.runHistory = [runData, ...stats.runHistory].slice(0, 50);
  
  // Update dates
  newStats.lastPlayDate = runData.date;
  
  return newStats;
};

export const getWinRate = (stats: PlayerStats): number => {
  if (stats.totalRuns === 0) return 0;
  return Math.round((stats.runsWon / stats.totalRuns) * 100);
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getRelativeTime = (isoDate: string): string => {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};
