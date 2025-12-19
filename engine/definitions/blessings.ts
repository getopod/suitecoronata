/**
 * Blessing Effect Definitions
 *
 * Blessings are positive effects that help the player.
 * They modify movement rules, scoring, and game state.
 */

import { EffectDefinition } from '../patterns/types';
import { isHighestRank, isNextLowerInOrder, isNextHigherInOrder } from '../../utils/rankOrder';
import { Card, Pile, GameState, Rank } from '../../types';

// Helper from movement patterns
const getCardColor = (suit: string) => {
  if (suit === 'hearts' || suit === 'diamonds') return 'red';
  if (suit === 'clubs' || suit === 'spades') return 'black';
  return 'none';
};

export const BLESSING_DEFINITIONS: EffectDefinition[] = [
  // ===========================================================================
  // Movement Modifiers
  // ===========================================================================

  {
    id: 'blacksmith',
    name: 'Blacksmith',
    type: 'blessing',
    description: 'Foundation plays allow same or ±1 rank.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        if (target.type === 'foundation' && target.cards.length > 0) {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          const step = Math.abs(moving.rank - top.rank) <= 1;
          return moving.suit === top.suit && step;
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'maneki_neko',
    name: 'Maneki-Neko',
    type: 'blessing',
    description: 'Tableau plays ignore suit, foundation plays ignore rank.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        const moving = cards[0];
        const top = target.cards[target.cards.length - 1];
        if (target.type === 'tableau') {
          if (!top) return isHighestRank(moving.rank);
          return isNextLowerInOrder(moving.rank, top.rank);
        }
        if (target.type === 'foundation') {
          if (!top) return moving.rank === 1;
          return moving.suit === top.suit;
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'tortoiseshell',
    name: 'Tortoiseshell',
    type: 'blessing',
    description: 'Tableau plays ignore rank, foundation plays ignore suit.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        const moving = cards[0];
        const top = target.cards[target.cards.length - 1];
        if (target.type === 'tableau') {
          if (!top) return isHighestRank(moving.rank);
          return getCardColor(moving.suit) !== getCardColor(top.suit);
        }
        if (target.type === 'foundation') {
          if (!top) return moving.rank === 1;
          return isNextHigherInOrder(moving.rank, top.rank);
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'schemer',
    name: 'Schemer',
    type: 'blessing',
    description: 'Foundation cards can be played to tableaus.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        if (source.type === 'foundation' && target.type === 'tableau') {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          if (!top) return isHighestRank(moving.rank);
          return getCardColor(moving.suit) !== getCardColor(top.suit) &&
                 isNextLowerInOrder(moving.rank, top.rank);
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'thief',
    name: 'Thief',
    type: 'blessing',
    description: 'Play buried face-up cards without moving their stack.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        if (source.type === 'tableau' && cards.length === 1) {
          const card = cards[0];
          const idx = source.cards.findIndex(c => c.id === card.id);
          const isBuried = idx < source.cards.length - 1;
          if (isBuried && card.faceUp) return true;
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'charlatan',
    name: 'Charlatan',
    type: 'blessing',
    description: 'Build tableau up or down by rank.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        if (target.type === 'tableau' && target.cards.length > 0) {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          const isAlt = getCardColor(moving.suit) !== getCardColor(top.suit);
          return isAlt && (isNextHigherInOrder(moving.rank, top.rank) || isNextLowerInOrder(moving.rank, top.rank));
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'lobbyist',
    name: 'Lobbyist',
    type: 'blessing',
    description: 'Combine black suits & red suits.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        if (target.type === 'foundation') {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          const color = getCardColor(moving.suit);
          const topColor = top ? getCardColor(top.suit) : null;
          if (!top) return moving.rank === 1;
          return color === topColor && isNextHigherInOrder(moving.rank, top.rank);
        }
        if (target.type === 'tableau' && target.cards.length > 0) {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          const isOpp = getCardColor(moving.suit) !== getCardColor(top.suit);
          return isOpp && isNextLowerInOrder(moving.rank, top.rank);
        }
        return defaultAllowed;
      }
    }
  },

  // ===========================================================================
  // Pile Modifiers
  // ===========================================================================

  {
    id: 'vagrant',
    name: 'Vagrant',
    type: 'blessing',
    description: '+2 tableaus.',
    onActivate: [
      { action: 'add_piles', params: { type: 'tableau', count: 2 } }
    ]
  },

  {
    id: 'wizard',
    name: 'Wizard',
    type: 'blessing',
    description: '+2 foundations.',
    onActivate: [
      { action: 'add_piles', params: { type: 'foundation', count: 2 } }
    ]
  },

  // ===========================================================================
  // Scoring Modifiers
  // ===========================================================================

  {
    id: 'hoarder',
    name: 'Hoarder',
    type: 'blessing',
    description: 'Consecutive same-suit plays stack +100% points each.',
    effectState: {
      hoarderLastSuit: null,
      hoarderStreak: 0
    },
    custom: {
      calculateScore: (score, context, state) => {
        const suit = context.cards[0].suit;
        const last = state.effectState.hoarderLastSuit;
        const streak = state.effectState.hoarderStreak || 0;
        if (last === suit) {
          return score * (2 ** streak);
        }
        return score;
      },
      onMoveComplete: (state, context) => {
        const suit = context.cards[0].suit;
        const last = state.effectState.hoarderLastSuit;
        const streak = state.effectState.hoarderStreak || 0;
        const nextStreak = last === suit ? streak + 1 : 1;
        return { effectState: { ...state.effectState, hoarderLastSuit: suit, hoarderStreak: nextStreak } };
      }
    }
  },

  // ===========================================================================
  // Coin Modifiers
  // ===========================================================================

  {
    id: 'alchemist',
    name: 'Alchemist',
    type: 'blessing',
    description: '+20% coin from all sources.',
    coins: [
      { pattern: 'coin_multiplier', params: { allMultiplier: 1.2 } }
    ]
  },

  // ===========================================================================
  // Visual Effects
  // ===========================================================================

  {
    id: 'pedant',
    name: 'Pedant',
    type: 'blessing',
    description: 'All tableau cards face-up.',
    visuals: [
      { pattern: 'force_face_up', appliesTo: ['tableau'] }
    ]
  },

  // ===========================================================================
  // Special Cards
  // ===========================================================================

  {
    id: 'jester',
    name: 'Jester',
    type: 'blessing',
    description: 'Add a fear skip card to your hand (2 charges).',
    onActivate: [
      { action: 'add_card_to_pile', params: { pile: 'hand', cardType: 'fear_skip', charges: 2 } }
    ]
  },

  {
    id: 'trickster',
    name: 'Trickster',
    type: 'blessing',
    description: 'Add a key to your hand (3 charges).',
    onActivate: [
      { action: 'add_card_to_pile', params: { pile: 'hand', cardType: 'key', charges: 3 } }
    ]
  },

  {
    id: 'impersonator',
    name: 'Impersonator',
    type: 'blessing',
    description: 'Add a wild card to your hand (3 charges).',
    onActivate: [
      { action: 'add_card_to_pile', params: { pile: 'hand', cardType: 'wild', charges: 3 } }
    ],
    custom: {
      canMove: (cards, source, target, defaultAllowed) =>
        (cards.length === 1 && cards[0].meta?.isWild) ? true : defaultAllowed
    }
  },

  // ===========================================================================
  // Complex Effects (require custom handlers)
  // ===========================================================================

  {
    id: 'timekeeper',
    name: 'Timekeeper',
    type: 'blessing',
    description: 'Return the last 5 cards you played to your hand (1 charge).',
    effectState: { lastPlayedCards: [], timekeeperUsed: false },
    custom: {
      onActivate: (state) => {
        if (state.effectState.timekeeperUsed) return {};
        const lastFive: Card[] = (state.effectState.lastPlayedCards || []).slice(-5);
        const hand = state.piles['hand'];
        const clean = lastFive.map(c => ({ ...c, faceUp: true }));
        return {
          effectState: { ...state.effectState, timekeeperUsed: true },
          piles: { ...state.piles, hand: { ...hand, cards: [...hand.cards, ...clean] } }
        };
      },
      onMoveComplete: (state, context) => {
        const playedCards = [...(state.effectState.lastPlayedCards || [])];
        playedCards.push(...context.cards);
        return { effectState: { ...state.effectState, lastPlayedCards: playedCards.slice(-20) } };
      }
    }
  },

  {
    id: 'klabautermann',
    name: 'Klabautermann',
    type: 'blessing',
    description: 'Once per encounter, you may discard your hand to draw 5 cards.',
    effectState: { klabautermannUsed: false },
    custom: {
      onActivate: (state) => {
        if (state.effectState.klabautermannUsed) return {};
        const deck = state.piles['deck'];
        const hand = state.piles['hand'];
        const drawCount = Math.min(5, deck.cards.length);
        const drawn = deck.cards.slice(-drawCount).map(c => ({ ...c, faceUp: true }));
        const remainingDeck = deck.cards.slice(0, -drawCount);
        return {
          effectState: { ...state.effectState, klabautermannUsed: true },
          piles: {
            ...state.piles,
            hand: { ...hand, cards: drawn },
            deck: { ...deck, cards: remainingDeck }
          }
        };
      }
    }
  },

  {
    id: 'martyr',
    name: 'Martyr',
    type: 'blessing',
    description: 'Sacrifice 1 foundation. Return its cards to the deck.',
    custom: {
      onActivate: (state) => {
        const fids = Object.keys(state.piles).filter(k => k.startsWith('foundation') && state.piles[k].cards.length > 0);
        if (fids.length === 0) return {};
        const fid = fids[0];
        const deck = state.piles['deck'];
        const returned = state.piles[fid].cards.map(c => ({ ...c, faceUp: false }));
        const newDeck = [...deck.cards, ...returned];
        newDeck.sort(() => Math.random() - 0.5);
        return {
          piles: {
            ...state.piles,
            [fid]: { ...state.piles[fid], cards: [] },
            deck: { ...deck, cards: newDeck }
          }
        };
      }
    }
  },

  {
    id: 'whore_of_galore',
    name: 'Whore of Galore',
    type: 'blessing',
    description: '+1 wild foundation.',
    custom: {
      onActivate: (state) => {
        const fid = `foundation-wild-${Date.now()}`;
        const newPile: Pile = { id: fid, type: 'foundation', cards: [], meta: { isWildFoundation: true } };
        const newPiles = { ...state.piles, [fid]: newPile };
        return { piles: newPiles };
      },
      canMove: (cards, source, target, defaultAllowed) => {
        if (target.meta?.isWildFoundation) {
          const top = target.cards[target.cards.length - 1];
          if (!top) return cards[0].rank === 1 || cards[0].meta?.isWild;
          return isNextHigherInOrder(cards[0].rank, top.rank);
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'merchant',
    name: 'Merchant',
    type: 'blessing',
    description: 'Pay 2× goal with coin to skip encounter.',
    custom: {
      onActivate: (state) => {
        const cost = state.currentScoreGoal * 2;
        if (state.coins < cost) return {};
        return { coins: state.coins - cost, effectState: { ...state.effectState, skipEncounter: true } };
      }
    }
  },
];
