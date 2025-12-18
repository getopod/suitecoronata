/**
 * Movement Pattern Evaluators
 *
 * This module implements all movement-related patterns from the documentation.
 * Each pattern is a pure function that takes a context and optional parameters.
 */

import { Card, Pile, Rank, Suit } from '../../types';
import {
  getOrderedRankValue,
  isHighestRank,
  isNextLowerInOrder,
  isNextHigherInOrder
} from '../../utils/rankOrder';
import {
  PatternContext,
  MovementEvaluator,
  RankPatternId,
  SuitPatternId,
  StackPatternId,
  SpecialRankPatternId,
} from './types';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get card color from suit
 */
export const getCardColor = (suit: Suit): 'red' | 'black' | 'none' => {
  if (suit === 'hearts' || suit === 'diamonds') return 'red';
  if (suit === 'clubs' || suit === 'spades') return 'black';
  return 'none';
};

/**
 * Check if two suits are opposite colors
 */
const isOppositeColor = (suit1: Suit, suit2: Suit): boolean => {
  const color1 = getCardColor(suit1);
  const color2 = getCardColor(suit2);
  if (color1 === 'none' || color2 === 'none') return false;
  return color1 !== color2;
};

/**
 * Check if two suits are same color
 */
const isSameColor = (suit1: Suit, suit2: Suit): boolean => {
  const color1 = getCardColor(suit1);
  const color2 = getCardColor(suit2);
  if (color1 === 'none' || color2 === 'none') return false;
  return color1 === color2;
};

/**
 * Default primes for prime-based patterns
 */
const DEFAULT_PRIMES = [2, 3, 5, 7, 11, 13];

/**
 * Fibonacci sequence for fibonacci-based patterns
 */
const FIBONACCI = [1, 2, 3, 5, 8, 13];

// =============================================================================
// Rank Pattern Evaluators (Section 1)
// =============================================================================

export const rankPatterns: Record<RankPatternId, MovementEvaluator> = {
  /**
   * 1.1 Standard Solitaire: Alternate colors, descending rank
   */
  alternate_descending: (ctx) => {
    if (!ctx.target) return isHighestRank(ctx.moving.rank);
    return isOppositeColor(ctx.moving.suit, ctx.target.suit) &&
           isNextLowerInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 1.2 Reverse Build: Alternate colors, ascending rank
   */
  alternate_ascending: (ctx) => {
    if (!ctx.target) return ctx.moving.rank === 1; // Ace on empty
    return isOppositeColor(ctx.moving.suit, ctx.target.suit) &&
           isNextHigherInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 1.3 Same Color Allowed: Only rank matters (ignores color)
   */
  ignore_color: (ctx) => {
    if (!ctx.target) return isHighestRank(ctx.moving.rank);
    return isNextLowerInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 1.4 Same Rank Allowed: Only color matters (ignores rank)
   */
  ignore_rank: (ctx) => {
    if (!ctx.target) return isHighestRank(ctx.moving.rank);
    return isOppositeColor(ctx.moving.suit, ctx.target.suit);
  },

  /**
   * 1.5 Wild Rank: Any rank works (color still matters)
   */
  any_move: (ctx) => {
    if (!ctx.target) return true;
    return isOppositeColor(ctx.moving.suit, ctx.target.suit);
  },

  /**
   * 1.6 Exact Rank Match: Must be same rank
   */
  same_rank: (ctx) => {
    if (!ctx.target) return false;
    return ctx.moving.rank === ctx.target.rank;
  },

  /**
   * 1.7 Rank Within Range: Within ±N rank
   * @param params.range - The range (default 1)
   */
  rank_within_range: (ctx, params = { range: 1 }) => {
    if (!ctx.target) return isHighestRank(ctx.moving.rank);
    const colorsDiffer = isOppositeColor(ctx.moving.suit, ctx.target.suit);
    const rankDiff = Math.abs(
      getOrderedRankValue(ctx.moving.rank) - getOrderedRankValue(ctx.target.rank)
    );
    return colorsDiffer && rankDiff <= params.range;
  },

  /**
   * 1.8 Prime Number Ranks Only
   * @param params.primes - Array of prime ranks (default [2,3,5,7,11,13])
   */
  prime_only: (ctx, params = { primes: DEFAULT_PRIMES }) => {
    if (!ctx.target) return params.primes.includes(ctx.moving.rank);
    return params.primes.includes(ctx.moving.rank) &&
           params.primes.includes(ctx.target.rank);
  },

  /**
   * 1.9 Even/Odd Rank Restrictions
   * @param params.phase - Current phase (even phases = even ranks, odd = odd)
   */
  parity_phase: (ctx, params = { phase: 0 }) => {
    const isEvenPhase = params.phase % 2 === 0;
    const isEvenRank = ctx.moving.rank % 2 === 0;
    return isEvenPhase ? isEvenRank : !isEvenRank;
  },

  /**
   * 1.10 Rank Multiplication: moving * factor === target
   * @param params.factor - Multiplication factor (default 2)
   */
  rank_multiply: (ctx, params = { factor: 2 }) => {
    if (!ctx.target) return false;
    return ctx.moving.rank * params.factor === ctx.target.rank;
  },

  /**
   * 1.11 Rank Division: target / divisor === moving
   * @param params.divisor - Division value (default 2)
   */
  rank_divide: (ctx, params = { divisor: 2 }) => {
    if (!ctx.target) return false;
    return ctx.target.rank / params.divisor === ctx.moving.rank;
  },

  /**
   * 1.12 Rank Sum: moving + target === sum
   * @param params.sum - Target sum (default 13)
   */
  rank_sum: (ctx, params = { sum: 13 }) => {
    if (!ctx.target) return false;
    return ctx.moving.rank + ctx.target.rank === params.sum;
  },

  /**
   * 1.13 Rank Difference: target - moving === diff
   * @param params.diff - Required difference (default 1)
   */
  rank_difference: (ctx, params = { diff: 1 }) => {
    if (!ctx.target) return false;
    return ctx.target.rank - ctx.moving.rank === params.diff;
  },

  /**
   * 1.14 Rank Modulo: same remainder when divided by mod
   * @param params.mod - Modulo value (default 3)
   */
  rank_modulo: (ctx, params = { mod: 3 }) => {
    if (!ctx.target) return false;
    return ctx.moving.rank % params.mod === ctx.target.rank % params.mod;
  },

  /**
   * Build tableau up or down by rank (charlatan)
   */
  up_or_down: (ctx) => {
    if (!ctx.target) return isHighestRank(ctx.moving.rank);
    const colorsDiffer = isOppositeColor(ctx.moving.suit, ctx.target.suit);
    return colorsDiffer && (
      isNextHigherInOrder(ctx.moving.rank, ctx.target.rank) ||
      isNextLowerInOrder(ctx.moving.rank, ctx.target.rank)
    );
  },
};

// =============================================================================
// Suit Pattern Evaluators (Section 2)
// =============================================================================

export const suitPatterns: Record<SuitPatternId, MovementEvaluator> = {
  /**
   * 2.1 Standard Foundation: Same suit, ascending from Ace
   */
  same_suit_ascending: (ctx) => {
    if (!ctx.target) return ctx.moving.rank === 1;
    return ctx.moving.suit === ctx.target.suit &&
           isNextHigherInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 2.2 Color-based Foundation: Same color, ascending
   */
  same_color_ascending: (ctx) => {
    if (!ctx.target) return ctx.moving.rank === 1;
    return isSameColor(ctx.moving.suit, ctx.target.suit) &&
           isNextHigherInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 2.3 Opposite Color Foundation
   */
  opposite_color_ascending: (ctx) => {
    if (!ctx.target) return ctx.moving.rank === 1;
    return isOppositeColor(ctx.moving.suit, ctx.target.suit) &&
           isNextHigherInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 2.4 Suit Rotation (Hearts→Diamonds→Clubs→Spades→Hearts)
   * @param params.order - Suit order array
   */
  suit_rotation: (ctx, params = { order: ['hearts', 'diamonds', 'clubs', 'spades'] }) => {
    if (!ctx.target) return ctx.moving.rank === 1;
    const order: Suit[] = params.order;
    const currentIndex = order.indexOf(ctx.target.suit);
    if (currentIndex === -1) return false;
    const nextIndex = (currentIndex + 1) % order.length;
    return ctx.moving.suit === order[nextIndex] &&
           isNextHigherInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 2.5 Suit Pairing (Red/Black pairs)
   */
  suit_pairing: (ctx) => {
    if (!ctx.target) return ctx.moving.rank === 1;
    const redPairs = [
      ['hearts', 'diamonds'],
      ['diamonds', 'hearts'],
    ];
    const blackPairs = [
      ['clubs', 'spades'],
      ['spades', 'clubs'],
    ];
    const isRedPair = redPairs.some(
      ([a, b]) => ctx.moving.suit === a && ctx.target!.suit === b
    );
    const isBlackPair = blackPairs.some(
      ([a, b]) => ctx.moving.suit === a && ctx.target!.suit === b
    );
    return (isRedPair || isBlackPair) &&
           isNextHigherInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 2.6 Any Suit Foundation (suit-agnostic)
   */
  any_suit_ascending: (ctx) => {
    if (!ctx.target) return ctx.moving.rank === 1;
    return isNextHigherInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * 2.7 Suit Prohibition
   * @param params.forbidden - Array of forbidden suits
   */
  suit_prohibition: (ctx, params = { forbidden: [] }) => {
    const forbidden: Suit[] = params.forbidden;
    return !forbidden.includes(ctx.moving.suit);
  },

  /**
   * 2.8 Suit Groups (same suit family)
   */
  suit_groups: (ctx) => {
    if (!ctx.target) return ctx.moving.rank === 1;
    return isSameColor(ctx.moving.suit, ctx.target.suit) &&
           isNextHigherInOrder(ctx.moving.rank, ctx.target.rank);
  },

  /**
   * Foundation ignores rank (anarchist's cookbook)
   * Build in any order once aces are placed
   */
  same_suit_any_order: (ctx) => {
    if (!ctx.target) return ctx.moving.rank === 1;
    return ctx.moving.suit === ctx.target.suit && (
      isNextHigherInOrder(ctx.moving.rank, ctx.target.rank) ||
      isNextLowerInOrder(ctx.moving.rank, ctx.target.rank)
    );
  },
};

// =============================================================================
// Stack Pattern Evaluators (Section 4)
// =============================================================================

export const stackPatterns: Record<StackPatternId, MovementEvaluator> = {
  /**
   * 4.1 Single Cards Only
   */
  single_card_only: (ctx) => {
    return ctx.cards.length === 1;
  },

  /**
   * 4.2 Allow Moving from Foundation
   */
  allow_foundation_source: (ctx) => {
    return ctx.sourcePile.type === 'foundation';
  },

  /**
   * 4.3 Allow Moving to Waste
   */
  allow_waste_target: (ctx) => {
    return ctx.targetPile.type === 'deck'; // waste is often called deck
  },

  /**
   * 4.4 No Tableau-to-Tableau
   */
  no_tableau_to_tableau: (ctx) => {
    return !(ctx.sourcePile.type === 'tableau' && ctx.targetPile.type === 'tableau');
  },

  /**
   * 4.5 No Foundation Plays
   */
  no_foundation_plays: (ctx) => {
    return ctx.targetPile.type !== 'foundation';
  },

  /**
   * 4.6 Only Complete Stacks (all cards face up)
   */
  all_face_up: (ctx) => {
    return ctx.cards.every(card => card.faceUp);
  },

  /**
   * 4.7 Only Partial Stacks (some cards face down)
   */
  some_face_down: (ctx) => {
    return ctx.cards.some(card => !card.faceUp);
  },

  /**
   * 4.8 Stack Size Limits
   * @param params.maxSize - Maximum pile size
   */
  stack_size_limit: (ctx, params = { maxSize: 13 }) => {
    return ctx.targetPile.cards.length + ctx.cards.length <= params.maxSize;
  },

  /**
   * 4.9 Sequential Stack Only (must be in rank order)
   */
  sequential_stack: (ctx) => {
    for (let i = 1; i < ctx.cards.length; i++) {
      const prev = ctx.cards[i - 1];
      const curr = ctx.cards[i];
      if (!isNextLowerInOrder(curr.rank, prev.rank)) return false;
      if (!isOppositeColor(curr.suit, prev.suit)) return false;
    }
    return true;
  },

  /**
   * 4.10 Same Suit Stack Only
   */
  same_suit_stack: (ctx) => {
    for (let i = 1; i < ctx.cards.length; i++) {
      if (ctx.cards[i].suit !== ctx.cards[i - 1].suit) return false;
    }
    return true;
  },

  /**
   * 4.11 Locked Cards Cannot Move
   */
  no_locked_cards: (ctx) => {
    return !ctx.cards.some(c => c.meta?.locked);
  },

  /**
   * 4.12 Only Revealed Cards Can Move
   */
  only_revealed: (ctx) => {
    return ctx.cards.every(c => c.faceUp);
  },

  /**
   * Allow playing buried face-up cards (thief)
   */
  buried_face_up: (ctx) => {
    if (ctx.sourcePile.type !== 'tableau' || ctx.cards.length !== 1) return false;
    const card = ctx.cards[0];
    const idx = ctx.sourcePile.cards.findIndex(c => c.id === card.id);
    const isBuried = idx < ctx.sourcePile.cards.length - 1;
    return isBuried && card.faceUp;
  },
};

// =============================================================================
// Special Rank Pattern Evaluators (Section 3)
// =============================================================================

export const specialRankPatterns: Record<SpecialRankPatternId, MovementEvaluator> = {
  /**
   * 3.1 Ace Can Be High or Low
   */
  ace_high_or_low: (ctx) => {
    if (!ctx.target) return false;
    // Ace on King
    if (ctx.moving.rank === 1 && isHighestRank(ctx.target.rank)) return true;
    // King on Ace
    if (ctx.moving.rank === 13 && ctx.target.rank === 1) return true;
    return false;
  },

  /**
   * 3.2 Only Kings on Empty Tableau
   */
  kings_on_empty: (ctx) => {
    if (ctx.targetPile.type !== 'tableau') return false;
    if (ctx.target) return false; // Not empty
    return isHighestRank(ctx.moving.rank);
  },

  /**
   * 3.3 Only Aces on Empty Foundation
   */
  aces_on_empty: (ctx) => {
    if (ctx.targetPile.type !== 'foundation') return false;
    if (ctx.target) return false; // Not empty
    return ctx.moving.rank === 1;
  },

  /**
   * 3.4 Face Cards Special Rules
   */
  face_card_rules: (ctx) => {
    if (!ctx.target) return false;
    if (ctx.moving.rank === 11) { // Jack
      return ctx.target.rank === 13; // Jack can go on King
    }
    if (ctx.moving.rank === 12) { // Queen
      return ctx.target.rank === 11 || ctx.target.rank === 12;
    }
    return false;
  },

  /**
   * 3.5 Seven as Wild/Portal
   */
  seven_wild: (ctx) => {
    return ctx.moving.rank === 7;
  },

  /**
   * 3.6 Rank 0 (Special Cards)
   */
  rank_zero_wild: (ctx) => {
    return ctx.moving.rank === 0;
  },

  /**
   * 3.7 Sequential Pairing (2 on 4, 3 on 6, etc.)
   */
  sequential_pairing: (ctx, params = { factor: 2 }) => {
    if (!ctx.target) return false;
    return ctx.moving.rank * params.factor === ctx.target.rank;
  },

  /**
   * 3.8 Fibonacci Sequence
   */
  fibonacci_sequence: (ctx) => {
    if (!ctx.target) return false;
    const movingIndex = FIBONACCI.indexOf(ctx.moving.rank);
    const targetIndex = FIBONACCI.indexOf(ctx.target.rank);
    if (movingIndex === -1 || targetIndex === -1) return false;
    return targetIndex - movingIndex === 1;
  },

  /**
   * 3.9 Prime Number Chain
   */
  prime_chain: (ctx) => {
    if (!ctx.target) return false;
    const movingIndex = DEFAULT_PRIMES.indexOf(ctx.moving.rank);
    const targetIndex = DEFAULT_PRIMES.indexOf(ctx.target.rank);
    if (movingIndex === -1 || targetIndex === -1) return false;
    return targetIndex - movingIndex === 1;
  },

  /**
   * Crown card (Mad King) - can act as Ace, Jack, or King
   */
  crown_card: (ctx) => {
    if (!ctx.moving.meta?.crown) return false;
    const virtualRanks: Rank[] = ctx.moving.meta.virtualRanks || [1, 11, 13];

    return virtualRanks.some(vRank => {
      const virtual = { ...ctx.moving, rank: vRank };
      if (ctx.targetPile.type === 'tableau') {
        if (!ctx.target) return isHighestRank(vRank);
        return isOppositeColor(virtual.suit, ctx.target.suit) &&
               isNextLowerInOrder(vRank, ctx.target.rank);
      }
      if (ctx.targetPile.type === 'foundation') {
        if (!ctx.target) return vRank === 1;
        return virtual.suit === ctx.target.suit &&
               isNextHigherInOrder(vRank, ctx.target.rank);
      }
      return false;
    });
  },

  /**
   * Wild card - can go anywhere
   */
  wild_card: (ctx) => {
    return ctx.moving.meta?.isWild === true;
  },
};

// =============================================================================
// Pattern Registry
// =============================================================================

/**
 * Combined registry of all movement patterns
 */
export const movementPatternRegistry = {
  rank: rankPatterns,
  suit: suitPatterns,
  stack: stackPatterns,
  special: specialRankPatterns,
};

/**
 * Get a movement pattern evaluator by ID
 */
export function getMovementPattern(
  category: 'rank' | 'suit' | 'stack' | 'special',
  id: string
): MovementEvaluator | undefined {
  return (movementPatternRegistry[category] as Record<string, MovementEvaluator>)[id];
}

/**
 * Evaluate multiple patterns and return combined result
 * All patterns must pass for the move to be allowed
 */
export function evaluateMovementPatterns(
  ctx: PatternContext,
  patterns: Array<{ category: 'rank' | 'suit' | 'stack' | 'special'; id: string; params?: Record<string, any> }>
): boolean {
  for (const { category, id, params } of patterns) {
    const pattern = getMovementPattern(category, id);
    if (pattern && !pattern(ctx, params)) {
      return false;
    }
  }
  return true;
}
