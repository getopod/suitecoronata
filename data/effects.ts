/**
 * Effects Registry
 *
 * This file exports effects compiled from the pattern-based engine.
 * All effects are defined declaratively in engine/definitions/.
 */

import { GameEffect, Suit, Card, Rank, Pile, GameState } from '../types';
import { compileAllEffects } from '../engine';

// =============================================================================
// Effects RNG Control
// =============================================================================

// Allows the app to inject a seeded RNG for deterministic runs.
const __ORIG_MATH_RANDOM = Math.random;
export const setEffectsRng = (fn: () => number) => { (Math as any).random = fn; };
export const resetEffectsRng = () => { (Math as any).random = __ORIG_MATH_RANDOM; };

// =============================================================================
// Utility Functions
// =============================================================================

export const getCardColor = (suit: Suit) => {
  if (suit === 'special') return 'purple';
  return (suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black');
};

// =============================================================================
// Board Generation
// =============================================================================

/**
 * Generate a new game board with standard solitaire layout
 */
export const generateNewBoard = (
  currentScore: number,
  currentCoins: number,
  scoreMult: number,
  coinMult: number,
  hardMode: boolean = false,
  randomChaos: boolean = false,
  mode: string = 'coronata'
): GameState => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const deck: Card[] = [];
  suits.forEach(suit => {
    for (let r = 1; r <= 13; r++) {
      deck.push({ id: `${suit}-${r}-${Math.random()}`, suit, rank: r as Rank, faceUp: false });
    }
  });

  if (randomChaos) {
     // Randomize rank/suit of every card
     deck.forEach(c => {
        c.rank = Math.ceil(Math.random() * 13) as Rank;
        c.suit = suits[Math.floor(Math.random() * 4)];
     });
  }

  deck.sort(() => Math.random() - 0.5);

  const piles: Record<string, Pile> = {};
  ['hearts', 'diamonds', 'clubs', 'spades'].forEach(suit => {
    piles[`foundation-${suit}`] = { id: `foundation-${suit}`, type: 'foundation', cards: [] };
  });

  // Create and deal tableau piles (7 columns, 1-7 cards each, top cards face up)
  for (let col = 0; col < 7; col++) {
    piles[`tableau-${col}`] = { id: `tableau-${col}`, type: 'tableau', cards: [] };
  }

  // Deal cards to tableaus
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      if (card) {
        card.faceUp = (row === col); // Only top card is face up
        piles[`tableau-${col}`].cards.push(card);
      }
    }
  }

  piles['deck'] = { id: 'deck', type: 'deck', cards: deck };
  piles['hand'] = { id: 'hand', type: 'hand', cards: [] };

  return {
    piles,
    score: currentScore,
    coins: currentCoins,
    moves: 0,
    selectedCardIds: null,
    effectState: {},
    scoreMultiplier: scoreMult,
    coinMultiplier: coinMult,
    runIndex: 0,
    currentScoreGoal: 150,
    ownedEffects: [],
    isLevelComplete: false,
    isGameOver: false,
    startTime: Date.now(),
    seed: Math.random().toString(36).substring(7),
    debugUnlockAll: false,
    activeMinigame: null,
    minigameResult: null,
    wanderState: 'none',
    wanderRound: 0,
    wanderOptions: [],
    activeWander: null,
    wanderResultText: null,
    seenWanders: [],
    interactionMode: 'normal',
    charges: {},
    resources: { handSize: 5, shuffles: 0, discards: 0 },
    rules: {},
    run: {
      inventory: { items: [], fortunes: [] },
      unlockedWanders: [],
      activeQuests: [],
      statuses: []
    }
  };
};

// =============================================================================
// Effects Registry
// =============================================================================

/**
 * Compiled effects from the pattern-based engine definitions
 */
export const EFFECTS_REGISTRY: GameEffect[] = compileAllEffects();

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Get an effect by ID
 */
export function getEffectById(id: string): GameEffect | undefined {
  return EFFECTS_REGISTRY.find(e => e.id === id);
}

/**
 * Get effects by type
 */
export function getEffectsByType(type: 'blessing' | 'exploit' | 'curse'): GameEffect[] {
  return EFFECTS_REGISTRY.filter(e => e.type === type);
}
