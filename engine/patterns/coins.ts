/**
 * Coin Transaction Pattern Evaluators
 *
 * This module implements all coin-related patterns from the documentation.
 * Each pattern transforms a coin delta based on game context.
 */

import { GameState, MoveContext } from '../../types';
import { CoinContext, CoinEvaluator, CoinPatternId } from './types';
import { getCardColor } from './movement';

// =============================================================================
// Basic Coin Modifiers (Section 1)
// =============================================================================

const basicCoinPatterns: Record<string, CoinEvaluator> = {
  /**
   * 1.1 Flat Gain/Loss
   * @param params.amount - Amount to add (negative for loss)
   */
  coin_flat_bonus: (ctx, params = { amount: 10 }) => {
    return ctx.currentDelta + params.amount;
  },

  /**
   * 1.2 Multipliers
   * @param params.gainMultiplier - Multiplier for gains (when delta > 0)
   * @param params.lossMultiplier - Multiplier for losses (when delta < 0)
   * @param params.allMultiplier - Multiplier for all transactions
   */
  coin_multiplier: (ctx, params = {}) => {
    let delta = ctx.currentDelta;

    if (params.allMultiplier) {
      delta *= params.allMultiplier;
    }

    if (params.gainMultiplier && delta > 0) {
      delta *= params.gainMultiplier;
    }

    if (params.lossMultiplier && delta < 0) {
      delta *= params.lossMultiplier;
    }

    return Math.floor(delta);
  },

  /**
   * 1.3 Conditional by Target
   * @param params.foundation - Bonus for foundation plays
   * @param params.tableau - Bonus for tableau plays
   * @param params.waste - Bonus for waste plays
   * @param params.deck - Bonus for deck plays
   */
  coin_conditional_target: (ctx, params = {}) => {
    let delta = ctx.currentDelta;
    const target = ctx.moveContext.target;

    if (params.foundation && target.includes('foundation')) {
      delta += params.foundation;
    }
    if (params.tableau && target.includes('tableau')) {
      delta += params.tableau;
    }
    if (params.waste && target.includes('waste')) {
      delta += params.waste;
    }
    if (params.deck && target.includes('deck')) {
      delta += params.deck;
    }

    return delta;
  },

  /**
   * 1.4 Conditional by Card
   * @param params.suits - { hearts: 5, diamonds: 10, ... }
   * @param params.ranks - { 7: 7, 11: 15, ... }
   * @param params.face - Bonus for face cards
   */
  coin_conditional_card: (ctx, params = {}) => {
    const card = ctx.cards[0];
    if (!card) return ctx.currentDelta;

    let delta = ctx.currentDelta;

    // Suit bonuses
    if (params.suits && params.suits[card.suit]) {
      delta += params.suits[card.suit];
    }

    // Rank bonuses
    if (params.ranks && params.ranks[card.rank]) {
      delta += params.ranks[card.rank];
    }

    // Face card bonus
    if (params.face && (card.rank === 1 || card.rank >= 11)) {
      delta += params.face;
    }

    return delta;
  },

  /**
   * 1.5 Percentage of Score
   * @param params.percentage - What percentage of score to add (0.01 = 1%)
   */
  score_percentage: (ctx, params = { percentage: 0.01 }) => {
    const bonus = Math.floor(ctx.state.score * params.percentage);
    return ctx.currentDelta + bonus;
  },

  /**
   * 1.6 Move-based
   * @param params.interval - Move interval for bonus
   * @param params.bonus - Bonus amount per interval
   */
  coin_move_based: (ctx, params = { interval: 5, bonus: 1 }) => {
    const moveBonus = Math.floor(ctx.state.moves / params.interval);
    return ctx.currentDelta + (moveBonus * params.bonus);
  },

  /**
   * 1.7 Time-based
   * @param params.penaltyPerMinute - Penalty per minute elapsed
   */
  coin_time_based: (ctx, params = { penaltyPerMinute: 1 }) => {
    const timeElapsed = Date.now() - ctx.state.startTime;
    const timePenalty = Math.floor(timeElapsed / 60000) * params.penaltyPerMinute;
    return ctx.currentDelta - timePenalty;
  },

  /**
   * 1.8 Stack-based
   * @param params.perCard - Bonus per card in the moved stack
   */
  coin_stack_based: (ctx, params = { perCard: 2 }) => {
    const stackSize = ctx.cards.length;
    return ctx.currentDelta + (stackSize * params.perCard);
  },
};

// =============================================================================
// Achievement-based Coin Rewards (Section 2)
// =============================================================================

const achievementCoinPatterns: Record<string, CoinEvaluator> = {
  /**
   * 2.1 Complete a Foundation
   * @param params.bonus - Bonus for completing a foundation
   */
  foundation_completion: (ctx, params = { bonus: 50 }) => {
    const pile = ctx.state.piles[ctx.moveContext.target];
    if (!pile || pile.type !== 'foundation') return ctx.currentDelta;

    const willBe = pile.cards.length + ctx.cards.length;
    if (willBe === 13) {
      return ctx.currentDelta + params.bonus;
    }

    return ctx.currentDelta;
  },

  /**
   * 2.2 Visible Card Conditions
   * @param params.rank - Rank to check for
   * @param params.count - Required count of visible cards
   * @param params.bonus - Bonus when condition met
   */
  visible_card_bonus: (ctx, params = { rank: 11, count: 4, bonus: 100 }) => {
    let visibleCount = 0;

    Object.values(ctx.state.piles).forEach(pile => {
      pile.cards.forEach(card => {
        if (card.faceUp && card.rank === params.rank) {
          visibleCount++;
        }
      });
    });

    if (visibleCount >= params.count) {
      return ctx.currentDelta + params.bonus;
    }

    return ctx.currentDelta;
  },
};

// =============================================================================
// Gambling/Risk Mechanics (Section 3)
// =============================================================================

const gamblingCoinPatterns: Record<string, CoinEvaluator> = {
  /**
   * 3.1 Random Win/Loss
   * @param params.outcomes - Array of possible coin changes
   * @param params.weights - Optional weights for outcomes
   */
  random_outcome: (ctx, params = { outcomes: [50, 10, -30] }) => {
    const outcomes: number[] = params.outcomes;
    const weights: number[] | undefined = params.weights;

    if (weights && weights.length === outcomes.length) {
      // Weighted random selection
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      let random = Math.random() * totalWeight;

      for (let i = 0; i < outcomes.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          return ctx.currentDelta + outcomes[i];
        }
      }
      return ctx.currentDelta + outcomes[outcomes.length - 1];
    }

    // Equal probability
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    return ctx.currentDelta + outcome;
  },

  /**
   * 3.2 Wager System
   * @param params.wager - Amount to wager
   * @param params.winChance - Chance to win (0-1)
   * @param params.multiplier - Win multiplier
   */
  wager_system: (ctx, params = { wager: 10, winChance: 0.5, multiplier: 3 }) => {
    if (ctx.state.coins < params.wager) return ctx.currentDelta;

    if (Math.random() < params.winChance) {
      // Win: get back wager plus winnings
      return ctx.currentDelta + (params.wager * params.multiplier);
    } else {
      // Lose wager
      return ctx.currentDelta - params.wager;
    }
  },

  /**
   * 3.3 Progressive Jackpot
   * Accumulates over time with a chance to win
   * @param params.contribution - Amount added to jackpot per play
   * @param params.winChance - Chance to win jackpot
   * @param params.jackpotKey - EffectState key for jackpot (default 'jackpot')
   *
   * Note: This pattern has side effects (modifies jackpot).
   * The calling code should handle effectState updates.
   */
  progressive_jackpot: (ctx, params = { contribution: 5, winChance: 0.01, jackpotKey: 'jackpot' }) => {
    const currentJackpot = ctx.state.effectState[params.jackpotKey] || 0;
    const newJackpot = currentJackpot + params.contribution;

    if (Math.random() < params.winChance) {
      // Win the jackpot
      return ctx.currentDelta + newJackpot;
      // Note: Caller should reset jackpot in effectState
    }

    // No win, jackpot grows
    return ctx.currentDelta;
    // Note: Caller should update jackpot in effectState
  },
};

// =============================================================================
// Combined Registry
// =============================================================================

export const coinPatterns: Record<CoinPatternId, CoinEvaluator> = {
  ...basicCoinPatterns,
  ...achievementCoinPatterns,
  ...gamblingCoinPatterns,
} as Record<CoinPatternId, CoinEvaluator>;

/**
 * Get a coin pattern evaluator by ID
 */
export function getCoinPattern(id: CoinPatternId): CoinEvaluator | undefined {
  return coinPatterns[id];
}

/**
 * Evaluate multiple coin patterns in sequence
 */
export function evaluateCoinPatterns(
  baseDelta: number,
  ctx: Omit<CoinContext, 'currentDelta'>,
  patterns: Array<{ pattern: CoinPatternId; params?: Record<string, any> }>
): number {
  let delta = baseDelta;

  for (const { pattern, params } of patterns) {
    const evaluator = coinPatterns[pattern];
    if (evaluator) {
      delta = evaluator({ ...ctx, currentDelta: delta }, params);
    }
  }

  return delta;
}
