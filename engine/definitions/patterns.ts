
import { EffectDefinition } from '../patterns/types';
import { isHighestRank, isNextLowerInOrder } from '../../utils/rankOrder';

// Helper
const getCardColor = (suit: string) => {
  if (suit === 'hearts' || suit === 'diamonds') return 'red';
  if (suit === 'clubs' || suit === 'spades') return 'black';
  return 'none';
};
export const PATTERN_DEFINITIONS: EffectDefinition[] = [
  // Metrocard
  {
    id: 'metrocard',
    name: 'Metrocard',
    type: 'pattern',
    description: 'Buy a key for 25% of your coin. It works anywhere.',
    custom: {
      onActivate: (state) => {
        if (state.coins <= 0) return {};
        const cost = Math.floor(state.coins * 0.25);
        const hand = state.piles['hand'];
        const key: Card = { id: `key-${Date.now()}`, suit: 'special', rank: 0 as Rank, faceUp: true, meta: { isKey: true, universal: true } };
        return {
          coins: state.coins - cost,
          piles: { ...state.piles, hand: { ...hand, cards: [...hand.cards, key] } }
        };
      }
    }
  },

  // Insider Trading
  {
    id: 'insider_trading',
    name: 'Insider Trading',
    type: 'pattern',
    description: 'When all face cards visible → ×3 encounter reward.',
    custom: {
      onMoveComplete: (state) => {
        // Check if all face cards (J,Q,K) are face up in any tableau
        const hasAllFaceCards = Object.values(state.piles)
          .filter(p => p.type === 'tableau')
          .some(pile => {
            const faceUps = pile.cards.filter(c => c.faceUp);
            const ranks = faceUps.map(c => c.rank);
            return [11, 12, 13].every(r => ranks.includes(r));
          });
        if (hasAllFaceCards && !state.effectState.insiderTradingTriggered) {
          return { effectState: { ...state.effectState, insiderTradingTriggered: true }, encounterRewardMultiplier: 3 };
        }
        return {};
      }
    }
  },

  // Get Out of Jail
  {
    id: 'get_out_of_jail',
    name: 'Get Out of Jail',
    type: 'pattern',
    description: 'Royal flush face up in a tableau finishes encounter.',
    custom: {
      onMoveComplete: (state) => {
        const royalRanks = [10, 11, 12, 13, 1];
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
          return { isLevelComplete: true, effectState: { ...state.effectState, jailTriggered: true } };
        }
        return {};
      }
    }
  },

  // Loaded Deck
  {
    id: 'loaded_deck',
    name: 'Loaded Deck',
    type: 'pattern',
    description: 'Having 4 Aces face up adds 2 wild Aces to your deck.',
    custom: {
      onMoveComplete: (state) => {
        const hasCondition = Object.values(state.piles)
          .filter(p => p.type === 'tableau')
          .some(pile => pile.cards.filter(c => c.faceUp && c.rank === 1).length >= 4);
        if (hasCondition && !state.effectState.loadedDeckTriggered) {
          const deck = state.piles['deck'];
          const wildAces = Array.from({ length: 2 }).map((_, i) => ({
            id: `wild-ace-${i}-${Date.now()}`, suit: 'special', rank: 1 as Rank, faceUp: false, meta: { isWild: true }
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

  // Nepotism
  {
    id: 'nepotism',
    name: 'Nepotism',
    type: 'pattern',
    description: 'Get 4 Queens face up → 25% discount in next trade.',
    custom: {
      onMoveComplete: (state) => {
        const hasCondition = Object.values(state.piles)
          .filter(p => p.type === 'tableau')
          .some(pile => pile.cards.filter(c => c.faceUp && c.rank === 12).length >= 4);
        if (hasCondition && !state.effectState.nepotismTriggered) {
          return { effectState: { ...state.effectState, nepotismTriggered: true, tradeDiscount: 0.25 } };
        }
        return {};
      }
    }
  },

  // Breaking & Entering
  {
    id: 'breaking_entering',
    name: 'Breaking & Entering',
    type: 'pattern',
    description: 'Full House in a tableau → Unlock all tableaus.',
    custom: {
      onMoveComplete: (state) => {
        // Check for Full House (3 of a kind + 2 of a kind) in any tableau
        const hasFullHouse = Object.values(state.piles)
          .filter(p => p.type === 'tableau')
          .some(pile => {
            const faceUps = pile.cards.filter(c => c.faceUp);
            const counts: Record<number, number> = {};
            faceUps.forEach(c => { counts[c.rank] = (counts[c.rank] || 0) + 1; });
            const values = Object.values(counts);
            return values.includes(3) && values.includes(2);
          });
        if (hasFullHouse && !state.effectState.breakingEnteringTriggered) {
          // Unlock all tableaus
          const newPiles = { ...state.piles };
          Object.keys(newPiles).filter(k => k.startsWith('tableau')).forEach(id => {
            newPiles[id] = { ...newPiles[id], locked: false };
          });
          return { piles: newPiles, effectState: { ...state.effectState, breakingEnteringTriggered: true } };
        }
        return {};
      }
    }
  },

  // High Society
  {
    id: 'high_society',
    name: 'High Society',
    type: 'pattern',
    description: 'Hand to foundation plays ×2 points.',
    custom: {
      calculateScore: (score, context) =>
        (context.source === 'hand' && context.target.includes('foundation')) ? score * 2 : score
    }
  },

  // Keen Instincts
  {
    id: 'keen_instincts',
    name: 'Keen Instincts',
    type: 'pattern',
    description: 'Revealed cards ignore rank & give +10 coin if played immediately.',
    effectState: { justRevealedCardId: null },
    custom: {
      canMove: (cards, source, target, defaultAllowed, state) => {
        const c = cards[0];
        // If this is the card that was just revealed, allow it to be played anywhere on tableau
        if (c.id === state.effectState.justRevealedCardId && target.type === 'tableau') return true;
        return defaultAllowed;
      },
      onMoveComplete: (state, context) => {
        let updates: any = {};

        // If the card that was just played was the revealed card, give +10 coins
        if (context.cards[0]?.id === state.effectState.justRevealedCardId) {
          updates.coins = state.coins + 10;
          updates.effectState = { ...state.effectState, justRevealedCardId: null };
        }

        // Track any newly revealed cards from this move
        if (context.reveal) {
          const revealedCards = context.cards.filter(c => c.faceUp);
          if (revealedCards.length > 0) {
            // Track the last revealed card
            updates.effectState = { ...state.effectState, justRevealedCardId: revealedCards[revealedCards.length - 1].id };
          }
        }

        return updates;
      }
    }
  },

  // Venture Capitol
  {
    id: 'venture_capitol',
    name: 'Venture Capitol',
    type: 'pattern',
    description: 'Foundation plays give +20 coin. Completions give +100 coin.',
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

  // Compound Interest
  {
    id: 'compound_interest',
    name: 'Compound Interest',
    type: 'pattern',
    description: 'Each foundation card gives +10% pts. Each reveal gives +5% current coins.',
    effectState: { compoundPointMult: 1 },
    custom: {
      onEncounterStart: (state) => ({ effectState: { ...state.effectState, compoundPointMult: 1 } }),
      onMoveComplete: (state, context) => {
        const updates: any = {};
        if (context.target.includes('foundation')) {
          updates.effectState = { ...state.effectState, compoundPointMult: (state.effectState.compoundPointMult || 1) * 1.1 };
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
];
