
import { LucideIcon } from 'lucide-react';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'special'; 
export type Rank = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; 
export type PileType = 'deck' | 'hand' | 'foundation' | 'tableau'; 

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  meta?: Record<string, any>;
}

export interface Pile {
  id: string;
  type: PileType;
  cards: Card[];
  locked?: boolean; 
  hidden?: boolean; 
  acceptedSuits?: Suit[]; 
}

export interface WanderChoice {
  label: string;
  result: string;
  effects?: { type: string; params: any[]; scaling?: string }[];
  onChoose?: (ctx: { gameState: GameState, rng?: () => number }) => GameState;
}

export interface Wander {
  id: string;
  label: string;
  description: string;
  type: string;
  choices: WanderChoice[];
  conditions?: any;
  isHidden?: boolean;
  category?: string;
  baseWeight?: number;
  weightModifiers?: Record<string, any>;
}

export interface GameState {
  piles: Record<string, Pile>;
  score: number;
  coins: number;
  moves: number;
  selectedCardIds: string[] | null;
  effectState: Record<string, any>;
  charges: Record<string, number>;
  scoreMultiplier: number; 
  coinMultiplier: number; 
  lastActionType?: 'draw' | 'play-tableau' | 'play-foundation' | 'shuffle' | 'none';
  
  // Run State
  runIndex: number;
  currentScoreGoal: number;
  isLevelComplete: boolean;
  isGameOver: boolean;
  startTime: number;
  seed: string;
  ownedEffects: string[]; 
  debugUnlockAll: boolean; 
  
  // Wander State
  wanderState: 'none' | 'selection' | 'active' | 'result';
  wanderOptions: Wander[];
  activeWander: Wander | null;
  wanderResultText: string | null;
  wanderRound: number;

  // Minigame State
  activeMinigame: { type: string; title: string; context?: any } | null;
  minigameResult: MinigameResult | null;
  
  interactionMode: 'normal' | 'discard_select';
  
  // Wander Compatibility Fields (for claudecoronata wander helpers)
  resources?: { handSize?: number; shuffles?: number; discards?: number; };
  rules?: Record<string, any>;
  run?: {
    inventory?: { items?: string[]; fortunes?: string[]; };
    unlockedWanders?: string[];
    activeQuests?: string[];
    statuses?: Array<{ id: string; duration: number; }>;
    forcedDanger?: string;
  };
}

export interface Encounter {
  index: number;
  type: 'fear' | 'danger' | 'normal';
  effectId: string;
  goal: number;
  completed: boolean;
}

export interface MoveContext {
  source: string;
  target: string;
  cards: Card[];
}

export type Outcome = "criticalWin" | "win" | "partialWin" | "draw" | "loss" | "criticalLoss";

export interface MinigameResult {
  outcome: Outcome;
  reward: number;
  text?: string;
}

export interface GameEffect {
  id: string;
  name: string;
  description: string;
  type: 'danger' | 'fear' | 'blessing' | 'exploit' | 'curse' | 'epic' | 'legendary' | 'rare' | 'uncommon' | string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  cost?: number; 
  maxCharges?: number;
  chargeReset?: 'encounter' | 'run';
  
  onActivate?: (gameState: GameState, activeEffects: string[]) => Partial<GameState> & { newActiveEffects?: string[] };

  canMove?: (
    cards: Card[], 
    sourcePile: Pile, 
    targetPile: Pile, 
    defaultAllowed: boolean,
    gameState: GameState
  ) => boolean | undefined;

  interceptMove?: (
    context: MoveContext,
    gameState: GameState
  ) => Partial<MoveContext> | undefined;

  onMoveComplete?: (
    gameState: GameState,
    context: MoveContext
  ) => Partial<GameState> & { triggerMinigame?: string };

  onEncounterStart?: (
    gameState: GameState
  ) => Partial<GameState>;

  calculateScore?: (
    currentScore: number, 
    context: MoveContext,
    gameState: GameState
  ) => number;

  calculateCoinTransaction?: (
    currentDelta: number,
    context: MoveContext,
    gameState: GameState
  ) => number;

  transformCardVisual?: (card: Card, pile?: Pile) => Partial<Card>;
}

// Player Stats & Run History
export interface RunEncounterRecord {
  type: 'danger' | 'fear' | 'wander' | 'shop' | 'boss';
  name: string;
  passed: boolean;
}

export interface RunHistoryEntry {
  id: string;
  result: 'won' | 'lost';
  score: number;
  finalCoins: number;
  date: string; // ISO timestamp
  mode: string;
  duration: number; // seconds
  encountersCompleted: number;
  totalEncounters: number;
  exploits: string[]; // effect IDs
  curses: string[]; // effect IDs
  blessings: string[]; // effect IDs
  encounters: RunEncounterRecord[];
  seed?: string;
}

export interface PlayerStats {
  runsWon: number;
  runsLost: number;
  totalRuns: number;
  currentStreak: number; // consecutive wins
  bestStreak: number;
  totalEffectsFound: number;
  uniqueEffectsFound: Set<string>; // effect IDs
  dangersDefeated: number;
  fearsCompleted: number;
  wandersCompleted: number;
  totalCoinsEarned: number;
  totalScore: number;
  bestScore: number;
  fastestWinTime: number; // seconds, 0 = no win yet
  runHistory: RunHistoryEntry[];
  firstPlayDate: string; // ISO timestamp
  lastPlayDate: string; // ISO timestamp
}

export interface SerializedPlayerStats {
  runsWon: number;
  runsLost: number;
  totalRuns: number;
  currentStreak: number;
  bestStreak: number;
  totalEffectsFound: number;
  uniqueEffectsFound: string[]; // serialized as array
  dangersDefeated: number;
  fearsCompleted: number;
  wandersCompleted: number;
  totalCoinsEarned: number;
  totalScore: number;
  bestScore: number;
  fastestWinTime: number;
  runHistory: RunHistoryEntry[];
  firstPlayDate: string;
  lastPlayDate: string;
}
