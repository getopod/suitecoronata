/**
 * Trigger Pattern Evaluators
 *
 * This module implements trigger conditions that determine when rules activate.
 * Triggers are used to conditionally apply scoring, coin, and state patterns.
 */

import { GameState, MoveContext, Card } from '../../types';
import { TriggerEvaluator, TriggerPatternId, MinigameTrigger } from './types';
import { getCardColor } from './movement';

// =============================================================================
// Trigger Evaluators
// =============================================================================

export const triggerPatterns: Record<TriggerPatternId, TriggerEvaluator> = {
  // ===========================================================================
  // Probability Triggers
  // ===========================================================================

  /**
   * Random chance trigger
   * @param params.probability - Chance to trigger (0-1)
   */
  chance: (state, context, params = { probability: 0.5 }) => {
    return Math.random() < params.probability;
  },

  // ===========================================================================
  // Target/Source Triggers
  // ===========================================================================

  /**
   * Target pile type
   * @param params.type - 'tableau' | 'foundation' | 'hand' | 'deck'
   */
  target_type: (state, context, params = { type: 'foundation' }) => {
    if (!context) return false;
    const pile = state.piles[context.target];
    return pile?.type === params.type;
  },

  /**
   * Source pile type
   * @param params.type - 'tableau' | 'foundation' | 'hand' | 'deck'
   */
  source_type: (state, context, params = { type: 'hand' }) => {
    if (!context) return false;
    const pile = state.piles[context.source];
    return pile?.type === params.type;
  },

  /**
   * Specific target pile
   * @param params.contains - String the target must contain
   */
  target_pile: (state, context, params = { contains: 'foundation' }) => {
    if (!context) return false;
    return context.target.includes(params.contains);
  },

  /**
   * Specific source pile
   * @param params.contains - String the source must contain
   */
  source_pile: (state, context, params = { contains: 'hand' }) => {
    if (!context) return false;
    return context.source.includes(params.contains);
  },

  // ===========================================================================
  // Card Property Triggers
  // ===========================================================================

  /**
   * Card rank equals
   * @param params.rank - Required rank
   * @param params.ranks - Array of acceptable ranks
   */
  card_rank: (state, context, params = {}) => {
    if (!context || context.cards.length === 0) return false;
    const card = context.cards[0];

    if (params.rank !== undefined) {
      return card.rank === params.rank;
    }
    if (params.ranks) {
      return params.ranks.includes(card.rank);
    }
    return false;
  },

  /**
   * Card suit equals
   * @param params.suit - Required suit
   * @param params.suits - Array of acceptable suits
   */
  card_suit: (state, context, params = {}) => {
    if (!context || context.cards.length === 0) return false;
    const card = context.cards[0];

    if (params.suit !== undefined) {
      return card.suit === params.suit;
    }
    if (params.suits) {
      return params.suits.includes(card.suit);
    }
    return false;
  },

  /**
   * Card color equals
   * @param params.color - 'red' | 'black'
   */
  card_color: (state, context, params = { color: 'red' }) => {
    if (!context || context.cards.length === 0) return false;
    const card = context.cards[0];
    return getCardColor(card.suit) === params.color;
  },

  /**
   * Card has meta property
   * @param params.key - Meta key to check
   * @param params.value - Optional value to match (truthy check if not specified)
   */
  card_meta: (state, context, params = { key: 'isWild' }) => {
    if (!context || context.cards.length === 0) return false;
    const card = context.cards[0];

    if (!card.meta) return false;

    if (params.value !== undefined) {
      return card.meta[params.key] === params.value;
    }
    return !!card.meta[params.key];
  },

  // ===========================================================================
  // State Triggers
  // ===========================================================================

  /**
   * Move count divisible by N
   * @param params.interval - Divisor
   * @param params.remainder - Required remainder (default 0)
   */
  move_count: (state, context, params = { interval: 5, remainder: 0 }) => {
    return state.moves % params.interval === params.remainder;
  },

  /**
   * Score threshold
   * @param params.min - Minimum score
   * @param params.max - Maximum score (optional)
   */
  score_threshold: (state, context, params = { min: 0 }) => {
    if (params.max !== undefined) {
      return state.score >= params.min && state.score <= params.max;
    }
    return state.score >= params.min;
  },

  /**
   * Coin threshold
   * @param params.min - Minimum coins
   * @param params.max - Maximum coins (optional)
   */
  coin_threshold: (state, context, params = { min: 0 }) => {
    if (params.max !== undefined) {
      return state.coins >= params.min && state.coins <= params.max;
    }
    return state.coins >= params.min;
  },

  /**
   * Goal percentage reached
   * @param params.percentage - Percentage of goal (0-1)
   */
  goal_percentage: (state, context, params = { percentage: 0.5 }) => {
    return state.score >= Math.floor(state.currentScoreGoal * params.percentage);
  },

  // ===========================================================================
  // Pile State Triggers
  // ===========================================================================

  /**
   * Pile is empty
   * @param params.pileId - Specific pile ID (optional, uses target if not specified)
   */
  pile_empty: (state, context, params = {}) => {
    const pileId = params.pileId || context?.target;
    if (!pileId) return false;
    const pile = state.piles[pileId];
    return pile?.cards.length === 0;
  },

  /**
   * Pile has N cards
   * @param params.pileId - Specific pile ID (optional)
   * @param params.count - Required card count
   */
  pile_full: (state, context, params = { count: 13 }) => {
    const pileId = params.pileId || context?.target;
    if (!pileId) return false;
    const pile = state.piles[pileId];
    return pile?.cards.length === params.count;
  },

  /**
   * Foundation is complete (13 cards)
   */
  foundation_complete: (state, context, params = {}) => {
    if (!context) return false;
    const pile = state.piles[context.target];
    return pile?.type === 'foundation' && pile.cards.length === 13;
  },

  /**
   * All foundations complete
   */
  all_foundations_complete: (state, context, params = {}) => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    return suits.every(suit => {
      const pile = state.piles[`foundation-${suit}`];
      return pile?.cards.length === 13;
    });
  },

  // ===========================================================================
  // Card Visibility Triggers
  // ===========================================================================

  /**
   * N cards of specific rank visible
   * @param params.rank - Rank to count
   * @param params.count - Minimum count required
   */
  visible_rank_count: (state, context, params = { rank: 7, count: 3 }) => {
    let count = 0;
    Object.values(state.piles).forEach(pile => {
      pile.cards.forEach(card => {
        if (card.faceUp && card.rank === params.rank) {
          count++;
        }
      });
    });
    return count >= params.count;
  },

  /**
   * All face cards are visible
   */
  face_cards_visible: (state, context, params = {}) => {
    let allVisible = true;
    Object.values(state.piles).forEach(pile => {
      pile.cards.forEach(card => {
        if ((card.rank === 1 || card.rank >= 11) && !card.faceUp) {
          allVisible = false;
        }
      });
    });
    return allVisible;
  },

  // ===========================================================================
  // Event Triggers
  // ===========================================================================

  /**
   * Card was just revealed (context.reveal === true)
   */
  reveal: (state, context, params = {}) => {
    return context?.reveal === true;
  },

  /**
   * Moving card is the one just revealed
   */
  just_revealed_card: (state, context, params = {}) => {
    if (!context || context.cards.length === 0) return false;
    return context.cards[0].id === state.effectState.justRevealedCardId;
  },

  /**
   * Encounter is starting (used with onEncounterStart)
   */
  encounter_start: () => true,

  /**
   * Encounter is ending
   */
  encounter_end: () => true,

  /**
   * Deck was just recycled
   */
  deck_cycle: (state, context, params = {}) => {
    // This would be set by the game engine when deck cycles
    return state.effectState.deckJustCycled === true;
  },
};

/**
 * Parse a trigger string into pattern ID and params
 * Supports formats:
 * - "pattern_id"
 * - "pattern_id=value"
 * - "target=foundation" (parsed as target_pile with contains param)
 */
export function parseTriggerString(trigger: string): { id: TriggerPatternId; params: Record<string, any> } {
  // Handle equality format
  if (trigger.includes('=')) {
    const [key, value] = trigger.split('=');

    // Special case: target=X -> target_pile with contains
    if (key === 'target') {
      return { id: 'target_pile', params: { contains: value } };
    }
    if (key === 'source') {
      return { id: 'source_pile', params: { contains: value } };
    }
    if (key === 'rank') {
      return { id: 'card_rank', params: { rank: parseInt(value) } };
    }
    if (key === 'suit') {
      return { id: 'card_suit', params: { suit: value } };
    }
    if (key === 'chance') {
      return { id: 'chance', params: { probability: parseFloat(value) } };
    }

    // Generic case
    return { id: key as TriggerPatternId, params: { value } };
  }

  // Handle modulo format (e.g., "moves%5==0")
  if (trigger.includes('%') && trigger.includes('==')) {
    const match = trigger.match(/(\w+)%(\d+)==(\d+)/);
    if (match) {
      const [, name, mod, remainder] = match;
      if (name === 'moves') {
        return { id: 'move_count', params: { interval: parseInt(mod), remainder: parseInt(remainder) } };
      }
    }
  }

  // Handle comparison operators
  if (trigger.includes('>=')) {
    const [key, value] = trigger.split('>=');
    if (key === 'score') {
      return { id: 'score_threshold', params: { min: parseInt(value) } };
    }
    if (key === 'coins') {
      return { id: 'coin_threshold', params: { min: parseInt(value) } };
    }
  }

  // Plain pattern ID
  return { id: trigger as TriggerPatternId, params: {} };
}

/**
 * Evaluate a trigger (string or pattern ID)
 */
export function evaluateTrigger(
  trigger: TriggerPatternId | string,
  state: GameState,
  context?: MoveContext
): boolean {
  const { id, params } = parseTriggerString(trigger);
  const evaluator = triggerPatterns[id];

  if (!evaluator) {
    console.warn(`Unknown trigger pattern: ${id}`);
    return false;
  }

  return evaluator(state, context, params);
}

// =============================================================================
// Minigame Pattern Triggers
// =============================================================================

/**
 * Default minigame triggers based on visible card patterns
 */
export const MINIGAME_TRIGGERS: MinigameTrigger[] = [
  {
    pattern: 'three_sevens',
    minigame: 'slots',
    flagKey: 'slotsTriggered',
  },
  {
    pattern: 'four_eights',
    minigame: 'pool',
    flagKey: 'poolTriggered',
  },
  {
    pattern: 'four_nines',
    minigame: 'pinball',
    flagKey: 'pinballTriggered',
  },
  {
    pattern: 'four_tens',
    minigame: 'darts',
    flagKey: 'dartsTriggered',
  },
  {
    pattern: 'four_jacks',
    minigame: 'blackjack',
    flagKey: 'blackjackTriggered',
  },
  {
    pattern: 'four_kings',
    minigame: 'roulette',
    flagKey: 'rouletteTriggered',
  },
  {
    pattern: 'four_low_kind',
    minigame: 'poker',
    flagKey: 'pokerTriggered',
  },
];

/**
 * Check for minigame pattern triggers
 */
export function checkMinigamePatterns(state: GameState): { trigger: MinigameTrigger; } | null {
  // Count visible cards by rank
  const rankCounts: Record<number, number> = {};

  Object.values(state.piles).forEach(pile => {
    pile.cards.forEach(card => {
      if (card.faceUp) {
        rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      }
    });
  });

  // Check each trigger
  for (const trigger of MINIGAME_TRIGGERS) {
    // Skip if already triggered
    if (state.effectState[trigger.flagKey]) continue;

    let triggered = false;

    switch (trigger.pattern) {
      case 'three_sevens':
        triggered = (rankCounts[7] || 0) >= 3;
        break;
      case 'four_eights':
        triggered = (rankCounts[8] || 0) >= 4;
        break;
      case 'four_nines':
        triggered = (rankCounts[9] || 0) >= 4;
        break;
      case 'four_tens':
        triggered = (rankCounts[10] || 0) >= 4;
        break;
      case 'four_jacks':
        triggered = (rankCounts[11] || 0) >= 4;
        break;
      case 'four_kings':
        triggered = (rankCounts[13] || 0) >= 4;
        break;
      case 'four_low_kind':
        // 4 of a kind with 2, 3, 4, or 5
        triggered = [2, 3, 4, 5].some(rank => (rankCounts[rank] || 0) >= 4);
        break;
    }

    if (triggered) {
      return { trigger };
    }
  }

  return null;
}
