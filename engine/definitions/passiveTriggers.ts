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
  },

  {
    id: 'get_out_of_jail',
    name: 'Get Out of Jail',
    type: 'passive',
    description: 'Have a royal flush face up in a tableau → Finish encounter immediately.',
    custom: {
      onMoveComplete: (state) => {
        const royalRanks = [10, 11, 12, 13, 1]; // Ten, Jack, Queen, King, Ace
        const suits: ('hearts' | 'diamonds' | 'clubs' | 'spades')[] = ['hearts','diamonds','clubs','spades'];

        const hasRoyalFlush = Object.values(state.piles)
          .filter(p => p.type === 'tableau')
          .some(pile => {
            const faceUps = pile.cards.filter(c => c.faceUp);
            return suits.some(suit => {
              const ranksPresent = faceUps.filter(c => c.suit === suit).map(c => c.rank);
              return royalRanks.every(r => ranksPresent.includes(r));
            });
          });

        if (hasRoyalFlush && !state.effectState.jailTriggered) {
          //onClick={() => setGameState(p => ({ ...p, score: p.currentScoreGoal
          return { isLevelComplete: true, effectState: { ...state.effectState, jailTriggered: true } };
        }
        return {};
      }
    }
  },

  {
    id: 'loaded_deck',
    name: 'Loaded Deck',
    type: 'passive',
    description: 'Have 4 Aces face up in same tableau → Add 2 wild Aces to your deck for rest of run.',
    custom: {
      onMoveComplete: (state) => {
        const hasCondition = Object.values(state.piles)
          .filter(p => p.type === 'tableau')
          .some(pile => {
            const count = pile.cards.filter(c => c.faceUp && c.rank === 1).length;
            return count >= 4;
          });
        if (hasCondition && !state.effectState.loadedDeckTriggered) {
          const deck = state.piles['deck'];
          const wildAces = Array.from({ length: 2 }).map((_, i) => ({
            id: `wild-ace-${i}-${Date.now()}`, suit: 'special' as const, rank: 1 as const, faceUp: false, meta: { isWild: true }
          }));
          return {
            piles: { ...state.piles, deck: { ...deck, cards: [...deck.cards, ...wildAces] } },
            effectState: { ...state.effectState, loadedDeckTriggered: true }
          };
        }
        return {};
      }
    }
  },

  {
    id: 'nepotism',
    name: 'Nepotism',
    type: 'passive',
    description: 'Have 4 Queens face up in same tableau → 25% discount in next trade.',
    custom: {
      onMoveComplete: (state) => {
        const hasCondition = Object.values(state.piles)
          .filter(p => p.type === 'tableau')
          .some(pile => {
            const count = pile.cards.filter(c => c.faceUp && c.rank === 12).length;
            return count >= 4;
          });
        if (hasCondition && !state.effectState.nepotismTriggered) {
          return { effectState: { ...state.effectState, nepotismTriggered: true, tradeDiscount: 0.25 } };
        }
        return {};
      }
    }
  },

  {
    id: 'insider_trading',
    name: 'Insider Trading',
    type: 'passive',
    description: 'When all face cards are face up, gain x3 encounter reward on completion.',
    custom: {
      onEncounterComplete: (state, context) => {
        // Check if all face cards (A, J, Q, K) are face up
        let allVisible = true;
        Object.values(state.piles).forEach(pile => {
          pile.cards.forEach(card => {
            if ((card.rank === 1 || card.rank === 11 || card.rank === 12 || card.rank === 13) && !card.faceUp) {
              allVisible = false;
            }
          });
        });
        if (allVisible && context && typeof context.reward === 'number') {
          return { coins: (state.coins ?? 0) + 2 * context.reward }; // x3 total (base + 2x)
        }
        return {};
      }
    }
  },

  {
    id: 'keen_instincts',
    name: 'Keen Instincts',
    type: 'passive',
    description: 'Revealed cards ignore rank & give +10 coin if played immediately.',
    custom: {
      canMove: (cards, source, target, defaultAllowed, state) => {
        const c = cards[0];
        if (c.id === state.effectState.justRevealedCardId && target.type === 'tableau') return true;
        return defaultAllowed;
      },
      onMoveComplete: (state, context) => {
        if (context.cards[0]?.id === state.effectState.justRevealedCardId) {
          return { coins: state.coins + 10, effectState: { ...state.effectState, justRevealedCardId: null } };
        }
        return {};
      }
    }
  },

  {
    id: 'breaking_entering',
    name: 'Breaking & Entering',
    type: 'passive',
    description: 'Have a Full House face up in a tableau → Unlock all tableau.',
    custom: {
      onMoveComplete: (state) => {
        const tableauCards = Object.values(state.piles)
          .filter(p => p.type === 'tableau')
          .flatMap(p => p.cards.filter(c => c.faceUp));
        const rankCounts: Record<number, number> = {};
        tableauCards.forEach(c => { rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1; });
        const hasThree = Object.values(rankCounts).some(cnt => cnt >= 3);
        const hasTwo = Object.values(rankCounts).some(cnt => cnt >= 2);
        if (hasThree && hasTwo && !state.effectState.breakingTriggered) {
          const newPiles = { ...state.piles };
          Object.keys(newPiles).filter(k => k.startsWith('tableau')).forEach(id => {
            newPiles[id] = { ...newPiles[id], locked: false };
          });
          return { piles: newPiles, effectState: { ...state.effectState, breakingTriggered: true } };
        }
        return {};
      }
    }
  }
];
