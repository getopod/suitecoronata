/**
 * Scoring Pattern Evaluators
 *
 * This module implements all scoring-related patterns from the documentation.
 * Each pattern transforms a score value based on game context.
 */

import { GameState, MoveContext } from '../../types';
import { ScoreContext, ScoreEvaluator, ScorePatternId } from './types';
import { getCardColor } from './movement';

// =============================================================================
// Basic Score Modifiers (Section 1)
// =============================================================================

const basicScorePatterns: Record<string, ScoreEvaluator> = {
  /**
   * 1.1 Flat Bonus/Penalty
   * @param params.amount - Amount to add (negative for penalty)
   */
  flat_bonus: (ctx, params = { amount: 10 }) => {
    return ctx.currentScore + params.amount;
  },

  /**
   * 1.2 Percentage Multipliers
   * @param params.multiplier - Multiplier value (1.5 = +50%, 0.5 = -50%)
   */
  percentage_multiplier: (ctx, params = { multiplier: 1.0 }) => {
    return Math.floor(ctx.currentScore * params.multiplier);
  },

  /**
   * 1.3 Conditional by Target
   * @param params.foundation - Bonus for foundation plays
   * @param params.tableau - Bonus for tableau plays
   * @param params.waste - Bonus for waste plays
   * @param params.deck - Bonus for deck plays
   */
  conditional_target: (ctx, params = {}) => {
    let score = ctx.currentScore;
    const target = ctx.moveContext.target;

    if (params.foundation && target.includes('foundation')) {
      score += params.foundation;
    }
    if (params.tableau && target.includes('tableau')) {
      score += params.tableau;
    }
    if (params.waste && target.includes('waste')) {
      score += params.waste;
    }
    if (params.deck && target.includes('deck')) {
      score += params.deck;
    }

    return score;
  },

  /**
   * 1.4 Conditional by Source
   * @param params.foundation - Bonus for foundation source
   * @param params.tableau - Bonus for tableau source
   * @param params.waste - Bonus for waste source
   * @param params.deck - Bonus for deck source
   * @param params.hand - Bonus for hand source
   */
  conditional_source: (ctx, params = {}) => {
    let score = ctx.currentScore;
    const source = ctx.moveContext.source;

    if (params.foundation && source.includes('foundation')) {
      score += params.foundation;
    }
    if (params.tableau && source.includes('tableau')) {
      score += params.tableau;
    }
    if (params.hand && source === 'hand') {
      score += params.hand;
    }
    if (params.waste && source.includes('waste')) {
      score += params.waste;
    }
    if (params.deck && source === 'deck') {
      score += params.deck;
    }

    return score;
  },

  /**
   * 1.5 Conditional by Suit/Color
   * @param params.hearts - Bonus for hearts
   * @param params.diamonds - Bonus for diamonds
   * @param params.clubs - Bonus for clubs
   * @param params.spades - Bonus for spades
   * @param params.red - Bonus for red cards
   * @param params.black - Bonus for black cards
   */
  conditional_suit: (ctx, params = {}) => {
    const card = ctx.cards[0];
    if (!card) return ctx.currentScore;

    let score = ctx.currentScore;

    // Suit-specific
    if (params[card.suit]) {
      score += params[card.suit];
    }

    // Color-specific
    const color = getCardColor(card.suit);
    if (params.red && color === 'red') {
      score += params.red;
    }
    if (params.black && color === 'black') {
      score += params.black;
    }

    return score;
  },

  /**
   * 1.6 Conditional by Rank
   * @param params.ace - Bonus for ace (rank 1)
   * @param params.king - Bonus for king (rank 13)
   * @param params.queen - Bonus for queen (rank 12)
   * @param params.jack - Bonus for jack (rank 11)
   * @param params.face - Bonus for any face card
   * @param params.number - Bonus for number cards (2-10)
   * @param params.specific - Map of rank -> bonus { 7: 50 }
   */
  conditional_rank: (ctx, params = {}) => {
    const card = ctx.cards[0];
    if (!card) return ctx.currentScore;

    let score = ctx.currentScore;

    // Specific ranks
    if (params.ace && card.rank === 1) score += params.ace;
    if (params.king && card.rank === 13) score += params.king;
    if (params.queen && card.rank === 12) score += params.queen;
    if (params.jack && card.rank === 11) score += params.jack;

    // Categories
    if (params.face && (card.rank === 1 || card.rank >= 11)) {
      score += params.face;
    }
    if (params.number && card.rank >= 2 && card.rank <= 10) {
      score += params.number;
    }

    // Specific rank mapping
    if (params.specific && params.specific[card.rank]) {
      score += params.specific[card.rank];
    }

    return score;
  },

  /**
   * 1.7 Move Count Based
   * @param params.interval - Move interval for bonus
   * @param params.bonus - Bonus amount per interval
   */
  move_count_bonus: (ctx, params = { interval: 10, bonus: 5 }) => {
    const moveBonus = Math.floor(ctx.state.moves / params.interval) * params.bonus;
    return ctx.currentScore + moveBonus;
  },

  /**
   * 1.8 Card Count Based
   * @param params.perCard - Points per card on board
   */
  card_count_bonus: (ctx, params = { perCard: 1 }) => {
    let totalCards = 0;
    Object.values(ctx.state.piles).forEach(pile => {
      totalCards += pile.cards.length;
    });
    return ctx.currentScore + (totalCards * params.perCard);
  },

  /**
   * 1.9 Time Based
   * @param params.maxBonus - Maximum time bonus
   * @param params.decayPerSecond - How much bonus decreases per second
   */
  time_bonus: (ctx, params = { maxBonus: 100, decayPerSecond: 1 }) => {
    const elapsedSeconds = (Date.now() - ctx.state.startTime) / 1000;
    const timeBonus = Math.max(0, params.maxBonus - (elapsedSeconds * params.decayPerSecond));
    return ctx.currentScore + Math.floor(timeBonus);
  },
};

// =============================================================================
// Complex Score Logic (Section 2)
// =============================================================================

const complexScorePatterns: Record<string, ScoreEvaluator> = {
  /**
   * 2.1 Rank-based Scoring
   * @param params.faceZero - Face cards score 0
   * @param params.evenZero - Even ranks score 0
   * @param params.lowDouble - Low cards (<=5) double score
   * @param params.highHalve - High cards (>=9) halve score
   */
  rank_based_scoring: (ctx, params = {}) => {
    const card = ctx.cards[0];
    if (!card) return ctx.currentScore;

    let score = ctx.currentScore;

    if (params.faceZero && card.rank >= 11) return 0;
    if (params.evenZero && card.rank % 2 === 0) return 0;
    if (params.lowDouble && card.rank <= 5) return score * 2;
    if (params.highHalve && card.rank >= 9) return Math.floor(score / 2);

    return score;
  },

  /**
   * 2.2 Sequence-based Scoring
   * Uses effectState to track last played card
   * @param params.sameSuitMultiplier - Multiplier for same suit plays
   * @param params.ascendingBonus - Bonus for ascending rank
   * @param params.descendingPenalty - Penalty for descending rank
   */
  sequence_scoring: (ctx, params = {}) => {
    const card = ctx.cards[0];
    if (!card) return ctx.currentScore;

    let score = ctx.currentScore;
    const lastSuit = ctx.state.effectState.lastPlayedSuit;
    const lastRank = ctx.state.effectState.lastPlayedRank;

    if (params.sameSuitMultiplier && card.suit === lastSuit) {
      score *= params.sameSuitMultiplier;
    }
    if (params.ascendingBonus && lastRank && card.rank === lastRank + 1) {
      score += params.ascendingBonus;
    }
    if (params.descendingPenalty && lastRank && card.rank === lastRank - 1) {
      score -= params.descendingPenalty;
    }

    return Math.floor(score);
  },

  /**
   * 2.3 Count-based Scoring
   * @param params.pileId - Pile to count cards from
   * @param params.threshold - Card count threshold
   * @param params.bonusPerCard - Bonus per card beyond threshold
   */
  count_based_scoring: (ctx, params = {}) => {
    const pile = ctx.state.piles[params.pileId || ctx.moveContext.target];
    if (!pile) return ctx.currentScore;

    const extraCards = pile.cards.length - (params.threshold || 6);
    if (extraCards <= 0) return ctx.currentScore;

    return ctx.currentScore + (extraCards * (params.bonusPerCard || 10));
  },

  /**
   * 2.5 Achievement-based Scoring
   * @param params.foundationComplete - Bonus for completing a foundation
   * @param params.tableauComplete - Bonus for completing a tableau sequence
   */
  achievement_scoring: (ctx, params = {}) => {
    let score = ctx.currentScore;

    // Check foundation completion
    if (params.foundationComplete) {
      const pile = ctx.state.piles[ctx.moveContext.target];
      if (pile?.type === 'foundation' && pile.cards.length === 13) {
        score += params.foundationComplete;
      }
    }

    return score;
  },

  /**
   * 2.6 Combo/Multiplier Scoring
   * Applies multiple multipliers based on conditions
   * @param params.suitMultipliers - { hearts: 2, diamonds: 1.5 }
   * @param params.rankMultipliers - { 7: 3 }
   * @param params.moveIntervalMultiplier - { interval: 5, multiplier: 2 }
   */
  combo_multiplier: (ctx, params = {}) => {
    const card = ctx.cards[0];
    if (!card) return ctx.currentScore;

    let multiplier = 1;

    // Suit multipliers
    if (params.suitMultipliers && params.suitMultipliers[card.suit]) {
      multiplier *= params.suitMultipliers[card.suit];
    }

    // Rank multipliers
    if (params.rankMultipliers && params.rankMultipliers[card.rank]) {
      multiplier *= params.rankMultipliers[card.rank];
    }

    // Move interval multiplier
    if (params.moveIntervalMultiplier) {
      const { interval, multiplier: mult } = params.moveIntervalMultiplier;
      if (ctx.state.moves % interval === 0) {
        multiplier *= mult;
      }
    }

    return Math.floor(ctx.currentScore * multiplier);
  },

  /**
   * 2.7 Progressive Scaling
   * @param params.perDifficulty - +X% per difficulty level
   * @param params.perStreak - +X% per streak
   */
  progressive_scaling: (ctx, params = {}) => {
    let multiplier = 1;

    if (params.perDifficulty) {
      const difficulty = ctx.state.effectState.difficulty || 1;
      multiplier *= (1 + (difficulty * params.perDifficulty / 100));
    }

    if (params.perStreak) {
      const streak = ctx.state.effectState.streak || 0;
      multiplier *= (1 + (streak * params.perStreak / 100));
    }

    return Math.floor(ctx.currentScore * multiplier);
  },

  /**
   * Streak multiplier (hoarder pattern)
   * Consecutive same-suit plays multiply points
   * @param params.base - Base multiplier (default 2)
   */
  streak_multiplier: (ctx, params = { base: 2 }) => {
    const card = ctx.cards[0];
    if (!card) return ctx.currentScore;

    const lastSuit = ctx.state.effectState.hoarderLastSuit;
    const streak = ctx.state.effectState.hoarderStreak || 0;

    if (lastSuit === card.suit && streak > 0) {
      return ctx.currentScore * Math.pow(params.base, streak);
    }

    return ctx.currentScore;
  },

  /**
   * Compound multiplier (compound interest pattern)
   * Progressive multiplier stored in effectState
   */
  compound_multiplier: (ctx) => {
    const mult = ctx.state.effectState.compoundPointMult || 1;
    return Math.floor(ctx.currentScore * mult);
  },
};

// =============================================================================
// Score Reset/Override (Section 3)
// =============================================================================

const resetScorePatterns: Record<string, ScoreEvaluator> = {
  /**
   * 3.5 Cap Maximum Score
   * @param params.max - Maximum score
   */
  score_cap: (ctx, params = { max: 10000 }) => {
    return Math.min(ctx.currentScore, params.max);
  },

  /**
   * 3.6 Floor Minimum Score
   * @param params.min - Minimum score
   */
  score_floor: (ctx, params = { min: 0 }) => {
    return Math.max(ctx.currentScore, params.min);
  },
};

// =============================================================================
// Combined Registry
// =============================================================================

export const scorePatterns: Record<ScorePatternId, ScoreEvaluator> = {
  ...basicScorePatterns,
  ...complexScorePatterns,
  ...resetScorePatterns,
} as Record<ScorePatternId, ScoreEvaluator>;

/**
 * Get a score pattern evaluator by ID
 */
export function getScorePattern(id: ScorePatternId): ScoreEvaluator | undefined {
  return scorePatterns[id];
}

/**
 * Evaluate multiple score patterns in sequence
 */
export function evaluateScorePatterns(
  baseScore: number,
  ctx: Omit<ScoreContext, 'currentScore'>,
  patterns: Array<{ pattern: ScorePatternId; params?: Record<string, any> }>
): number {
  let score = baseScore;

  for (const { pattern, params } of patterns) {
    const evaluator = scorePatterns[pattern];
    if (evaluator) {
      score = evaluator({ ...ctx, currentScore: score }, params);
    }
  }

  return score;
}
