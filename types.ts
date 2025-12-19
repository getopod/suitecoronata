
import { LucideIcon } from 'lucide-react';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'special';
export type Rank = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type PileType = 'deck' | 'hand' | 'foundation' | 'tableau';

// Typed meta properties for cards
export interface BaseCardMeta {
  // Special card types
  isKey?: boolean;
  isWild?: boolean;
  isBandage?: boolean;
  isWound?: boolean;
  isFearSkip?: boolean;
  isFake?: boolean;
  isQuestItem?: boolean;

  // Crown special (Mad King effect)
  crown?: boolean;
  virtualRanks?: Rank[];

  // Card state
  locked?: boolean;
  persistent?: boolean; // Survives certain operations
  stolen?: boolean;
  summoned?: boolean;
  cursed?: boolean;
  blessed?: boolean;

  // Visual properties
  blurred?: boolean;
  highlighted?: boolean;
  animated?: 'pulse' | 'shake' | 'glow';
  color?: string;
  scale?: number;
  glow?: 'gold' | 'purple' | 'red';
  shadow?: string;
  opacity?: number;
  border?: string;
  tier?: 'gold' | 'silver' | 'bronze';
  phantom?: boolean;

  // Quest/markers
  questType?: 'blood' | 'coin' | 'score';
  showKey?: boolean;
  showWild?: boolean;
  showLock?: boolean;
  showFake?: boolean;
  showWound?: boolean;
  showBandage?: boolean;
  isNextFoundationCard?: boolean;

  // Dimensional
  hiddenDimension?: boolean;

  // Universal keys
  universal?: boolean;

  // Allow additional properties for extensibility
  [key: string]: any;
}

// Typed meta properties for piles
export interface BasePileMeta {
  isWildFoundation?: boolean;
  isPhantom?: boolean;
  tier?: 'gold' | 'silver' | 'bronze';

  // Allow additional properties for extensibility
  [key: string]: any;
}

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  meta?: BaseCardMeta;
}

export interface Pile {
  id: string;
  type: PileType;
  cards: Card[];
  locked?: boolean;
  hidden?: boolean;
  acceptedSuits?: Suit[];
  meta?: BasePileMeta;
}

export interface WanderState {
  resources: {
    coins: number;
    handSize: number;
    shuffles: number;
    discards: number;
  };
  run: {
    inventory: {
      exploits: string[];
      curses: string[];
      blessings: string[];
      items: string[];
      fortunes: string[];
    };
    unlockedWanders: string[];
    activeQuests: string[];
    statuses: { id: string; duration: number }[];
    forcedCurse?: string;
  };
  activeExploits: string[];
  score: { current: number };
  effectState: Record<string, any>;
  rules: Record<string, any>;
}

export interface WanderChoice {
  label: string;
  result: string;
  effects?: { type: string; params: any[]; scaling?: string }[];
  onChoose?: (ctx: { gameState: WanderState, rng?: () => number }) => WanderState;
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
  seenWanders: string[]; // Track wanders seen this run

  // Minigame State
  activeMinigame: { type: string; title: string; context?: any } | null;
  minigameResult: MinigameResult | null;
  
  interactionMode: 'normal' | 'discard_select';
  
  // Wander Compatibility Fields (for claudecoronata wander helpers)
  resources?: { handSize?: number; shuffles?: number; discards?: number; };
  rules?: Record<string, any>;
  run?: {
    inventory?: { items?: string[]; fortunes?: string[]; curses?: string[]; };
    unlockedWanders?: string[];
    activeQuests?: string[];
    statuses?: Array<{ id: string; duration: number; }>;
    forcedCurse?: string;
  };
  deck?: Card[];
  hand?: Card[];
}

export interface Encounter {
  index: number;
  type: 'curse' | 'normal';
  effectId: string;
  goal: number;
  completed: boolean;
}

export interface MoveContext {
  source: string;
  target: string;
  cards: Card[];
  reveal?: boolean;
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
  type: 'blessing' | 'exploit' | 'curse' | 'epic' | 'legendary' | 'rare' | 'uncommon' | string;
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
  type: 'curse' | 'wander' | 'shop' | 'boss';
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
  cursesCompleted: number;
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
  cursesCompleted: number;
  wandersCompleted: number;
  totalCoinsEarned: number;
  totalScore: number;
  bestScore: number;
  fastestWinTime: number;
  runHistory: RunHistoryEntry[];
  firstPlayDate: string;
  lastPlayDate: string;
}
