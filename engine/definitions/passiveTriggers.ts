/**
 * Passive Trigger Effect Definitions
 *
 * Passive triggers are always-available effects that modify scoring, coins, or gameplay
 * based on normal game actions. Unlike exploits, these don't need to be purchased or activated.
 * They trigger automatically during gameplay.
 */

import { EffectDefinition } from '../patterns/types';
import { isHighestRank, isNextLowerInOrder } from '../../utils/rankOrder';

// Helper
const getCardColor = (suit: string) => {
  if (suit === 'hearts' || suit === 'diamonds') return 'red';
  if (suit === 'clubs' || suit === 'spades') return 'black';
  return 'none';
};

export const PASSIVE_TRIGGER_DEFINITIONS: EffectDefinition[] = [
  {
    id: 'master_debater',
    name: 'Master Debater',
    type: 'passive',
    description: 'Foundation cards can be played to tableaus. Consecutive same-suit plays stack +100% points each.',
    effectState: {
      schemerLastSuit: null,
      schemerStreak: 0
    },
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        // Allow moving from foundation to tableau
        if (source.type === 'foundation' && target.type === 'tableau') {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          if (!top) return isHighestRank(moving.rank);
          return getCardColor(moving.suit) !== getCardColor(top.suit) &&
                 isNextLowerInOrder(moving.rank, top.rank);
        }
        return defaultAllowed;
      },
      calculateScore: (score, context, state) => {
        const suit = context.cards[0].suit;
        const last = state.effectState.schemerLastSuit;
        const streak = Math.min(state.effectState.schemerStreak || 0, 10); // Cap at 10 to prevent overflow

        if (last === suit) {
          return score * (1 + streak); // +100% per streak
        }
        return score;
      },
      onMoveComplete: (state, context) => {
        const suit = context.cards[0].suit;
        const last = state.effectState.schemerLastSuit;
        const streak = state.effectState.schemerStreak || 0;
        const nextStreak = last === suit ? Math.min(streak + 1, 10) : 1; // Cap at 10
        return { effectState: { ...state.effectState, schemerLastSuit: suit, schemerStreak: nextStreak } };
      }
    }
  },

  {
    id: 'high_society',
    name: 'High Society',
    type: 'passive',
    description: 'Hand to foundation plays x2 points.',
    scoring: [
      {
        pattern: 'percentage_multiplier',
        trigger: 'source=hand',
        params: { multiplier: 2 }
      }
    ],
    custom: {
      calculateScore: (score, context) =>
        (context.source === 'hand' && context.target.includes('foundation')) ? score * 2 : score
    }
  },

  {
    id: 'compound_interest',
    name: 'Compound Interest',
    type: 'passive',
    description: 'Each foundation play gives +10% points gained. Each reveal gives +5% current coins.',
    effectState: { compoundPointMult: 1 },
    custom: {
      onEncounterStart: (state) => ({ effectState: { ...state.effectState, compoundPointMult: 1 } }),
      onMoveComplete: (state, context) => {
        const updates: any = {};
        if (context.target.includes('foundation')) {
          updates.effectState = { ...state.effectState,
            compoundPointMult: (state.effectState.compoundPointMult || 1) * 1.1 };
        }
        if (context.reveal) {
          updates.coins = Math.floor(state.coins * 1.05);
        }
        return updates;
      },
      calculateScore: (score, context, state) =>
        Math.floor(score * (state.effectState.compoundPointMult || 1))
    }
  },

  {
    id: 'venture_capitol',
    name: 'Venture Capitol',
    type: 'passive',
    description: 'Foundation plays +20 coin. Completions +100 coin.',
    custom: {
      calculateCoinTransaction: (delta, context, state) => {
        if (context.target.includes('foundation')) {
          const pile = state.piles[context.target];
          const willBe = pile.cards.length + context.cards.length;
          return delta + 20 + (willBe === 13 ? 100 : 0);
        }
        return delta;
      }
    }
  }
];
