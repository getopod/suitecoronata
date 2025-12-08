
import { LucideIcon } from 'lucide-react';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'special'; 
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; 
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
  effects: { type: string; params: any[] }[];
}

export interface Wander {
  id: string;
  label: string;
  description: string;
  type: string;
  choices: WanderChoice[];
  conditions?: any;
  isHidden?: boolean;
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
  ) => boolean;

  interceptMove?: (
    context: MoveContext,
    gameState: GameState
  ) => Partial<MoveContext>;

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
