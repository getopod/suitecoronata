/**
 * Visual Transformation Pattern Evaluators
 *
 * This module implements all visual-related patterns from the documentation.
 * Each pattern returns partial Card modifications for display purposes.
 */

import { Card, Pile, GameState } from '../../types';
import { VisualEvaluator, VisualPatternId } from './types';
import { getCardColor } from './movement';

// =============================================================================
// Card Display Modifiers (Section 1)
// =============================================================================

const displayPatterns: Record<string, VisualEvaluator> = {
  /**
   * 1.4 Force Face Up
   * @param params.pileTypes - Array of pile types to apply to (optional)
   */
  force_face_up: (card, pile, state, params = {}) => {
    if (params.pileTypes && pile) {
      if (!params.pileTypes.includes(pile.type)) {
        return {};
      }
    }
    return { faceUp: true };
  },

  /**
   * 1.5 Force Face Down
   * @param params.pileTypes - Array of pile types to apply to (optional)
   */
  force_face_down: (card, pile, state, params = {}) => {
    if (params.pileTypes && pile) {
      if (!params.pileTypes.includes(pile.type)) {
        return {};
      }
    }
    return { faceUp: false };
  },

  /**
   * 1.6 Conditionally Face Up
   * @param params.pileTypes - Pile types where cards are face up
   * @param params.ranks - Ranks that are always face up
   * @param params.colors - Colors that are always face up
   * @param params.faceCards - Face cards are always face up
   */
  conditional_face_up: (card, pile, state, params = {}) => {
    // Pile type condition
    if (params.pileTypes && pile) {
      if (params.pileTypes.includes(pile.type)) {
        return { faceUp: true };
      }
    }

    // Rank condition
    if (params.ranks && params.ranks.includes(card.rank)) {
      return { faceUp: true };
    }

    // Color condition
    if (params.colors) {
      const color = getCardColor(card.suit);
      if (params.colors.includes(color)) {
        return { faceUp: true };
      }
    }

    // Face cards condition
    if (params.faceCards && (card.rank === 1 || card.rank >= 11)) {
      return { faceUp: true };
    }

    return {};
  },

  /**
   * 1.2 Hide Suit
   * Hides suit icon while preserving card color
   */
  hide_suit: (card, pile, state, params = {}) => {
    return {
      meta: {
        ...card.meta,
        hideSuitIcon: true
      }
    };
  },

  /**
   * 1.1 Hide Rank
   * Makes rank appear as -1 (hidden)
   */
  hide_rank: (card, pile, state, params = {}) => {
    return { rank: -1 as any };
  },

  /**
   * 1.9 Highlight
   * @param params.condition - 'all' | 'faceUp' | 'faceDown'
   */
  highlight: (card, pile, state, params = { condition: 'all' }) => {
    if (params.condition === 'faceUp' && !card.faceUp) return {};
    if (params.condition === 'faceDown' && card.faceUp) return {};

    return {
      meta: {
        ...card.meta,
        highlighted: true,
      },
    };
  },

  /**
   * 1.13 Glow Effect
   * @param params.color - 'gold' | 'purple' | 'red'
   * @param params.ranks - Ranks that glow (optional, all if not specified)
   */
  glow_effect: (card, pile, state, params = { color: 'gold' }) => {
    if (params.ranks && !params.ranks.includes(card.rank)) {
      return {};
    }

    return {
      meta: {
        ...card.meta,
        glow: params.color,
      },
    };
  },

  /**
   * 1.15 Transparency
   * @param params.opacity - Opacity value (0-1)
   * @param params.condition - 'faceDown' | 'faceUp' | 'all'
   */
  opacity: (card, pile, state, params = { opacity: 0.5, condition: 'faceDown' }) => {
    if (params.condition === 'faceUp' && !card.faceUp) return {};
    if (params.condition === 'faceDown' && card.faceUp) return {};

    return {
      meta: {
        ...card.meta,
        opacity: params.opacity,
      },
    };
  },

  /**
   * Face cards always visible (insider trading)
   */
  face_cards_visible: (card, pile, state, params = {}) => {
    if (card.rank === 1 || card.rank >= 11) {
      return { faceUp: true };
    }
    return {};
  },
};

// =============================================================================
// Combined Registry
// =============================================================================

export const visualPatterns: Record<VisualPatternId, VisualEvaluator> = {
  ...displayPatterns,
} as Record<VisualPatternId, VisualEvaluator>;

/**
 * Get a visual pattern evaluator by ID
 */
export function getVisualPattern(id: VisualPatternId): VisualEvaluator | undefined {
  return visualPatterns[id];
}

/**
 * Evaluate multiple visual patterns and merge results
 * Later patterns override earlier ones
 */
export function evaluateVisualPatterns(
  card: Card,
  pile: Pile | undefined,
  state: GameState,
  patterns: Array<{ pattern: VisualPatternId; params?: Record<string, any> }>
): Partial<Card> {
  let result: Partial<Card> = {};

  for (const { pattern, params } of patterns) {
    const evaluator = visualPatterns[pattern];
    if (evaluator) {
      const changes = evaluator(card, pile, state, params);
      // Deep merge meta
      if (changes.meta && result.meta) {
        result = {
          ...result,
          ...changes,
          meta: { ...result.meta, ...changes.meta },
        };
      } else {
        result = { ...result, ...changes };
      }
    }
  }

  return result;
}
