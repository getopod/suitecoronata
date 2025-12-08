/**
 * UI-specific types that are independent of backend/effect logic.
 * These define what the UI needs to render, not how effects work.
 */

// ==========================================
// UI Display Types (for rendering only)
// ==========================================

export interface CardDisplay {
  id: string;
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'special';
  rank: number;
  faceUp: boolean;
  // Visual modifiers (set by effects, consumed by UI)
  isSelected?: boolean;
  isDisabled?: boolean;
  isLocked?: boolean;
  isWild?: boolean;
  isFake?: boolean;
  isBlessing?: boolean;
  blessingName?: string;
  customIcon?: string;
}

export interface PileDisplay {
  id: string;
  type: 'deck' | 'hand' | 'foundation' | 'tableau';
  cards: CardDisplay[];
  isLocked?: boolean;
  isHidden?: boolean;
}

export interface EffectDisplay {
  id: string;
  name: string;
  description: string;
  type: string;
  rarity?: string;
  cost?: number;
  isActive?: boolean;
  isReady?: boolean;
  charges?: number;
  maxCharges?: number;
}

export interface EncounterDisplay {
  index: number;
  type: 'fear' | 'danger' | 'normal';
  name?: string;
  description?: string;
  goal: number;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface WanderDisplay {
  id: string;
  label: string;
  description: string;
  choices: {
    label: string;
    description?: string;
  }[];
}

// ==========================================
// UI State (what the UI needs to know)
// ==========================================

export interface UIGameState {
  // Core game display
  score: number;
  coins: number;
  moves: number;
  scoreGoal: number;
  
  // Progress
  currentEncounterIndex: number;
  totalEncounters: number;
  isLevelComplete: boolean;
  isGameOver: boolean;
  
  // Interaction state
  selectedCardIds: string[] | null;
  interactionMode: 'normal' | 'discard_select' | 'target_select';
  
  // Active screens/modals
  activeDrawer: string | null;
  activeMinigame: { type: string; title: string } | null;
  showLevelComplete: boolean;
}

// ==========================================
// UI Callbacks (actions the UI can trigger)
// ==========================================

export interface UICallbacks {
  // Card interactions
  onCardClick: (pileId: string, cardIndex: number) => void;
  onCardDoubleClick: (pileId: string, cardIndex: number) => void;
  onPileClick: (pileId: string) => void;
  
  // Game actions
  onDraw: () => void;
  onStartRun: () => void;
  onResign: () => void;
  
  // Effect actions
  onToggleEffect: (effectId: string) => void;
  onBuyEffect: (effectId: string) => void;
  
  // Navigation
  onOpenDrawer: (drawer: string | null) => void;
  onCompleteLevel: () => void;
  
  // Wander actions
  onSelectWander: (wanderId: string) => void;
  onChooseWanderOption: (choiceIndex: number) => void;
}

// ==========================================
// Mock Data Generators (for UI development)
// ==========================================

export const createMockCard = (overrides?: Partial<CardDisplay>): CardDisplay => ({
  id: `mock-${Math.random().toString(36).substr(2, 9)}`,
  suit: 'hearts',
  rank: 1,
  faceUp: true,
  ...overrides,
});

export const createMockPile = (type: PileDisplay['type'], cardCount: number): PileDisplay => ({
  id: `${type}-mock`,
  type,
  cards: Array.from({ length: cardCount }, (_, i) => 
    createMockCard({ 
      rank: (i % 13) + 1, 
      suit: ['hearts', 'diamonds', 'clubs', 'spades'][i % 4] as CardDisplay['suit'],
      faceUp: type !== 'deck'
    })
  ),
});

export const createMockEffect = (type: string, overrides?: Partial<EffectDisplay>): EffectDisplay => ({
  id: `mock-effect-${Math.random().toString(36).substr(2, 9)}`,
  name: `Mock ${type}`,
  description: `A mock ${type} effect for UI testing`,
  type,
  rarity: 'common',
  cost: 100,
  ...overrides,
});

export const createMockUIState = (): UIGameState => ({
  score: 0,
  coins: 150,
  moves: 0,
  scoreGoal: 150,
  currentEncounterIndex: 0,
  totalEncounters: 15,
  isLevelComplete: false,
  isGameOver: false,
  selectedCardIds: null,
  interactionMode: 'normal',
  activeDrawer: null,
  activeMinigame: null,
  showLevelComplete: false,
});
