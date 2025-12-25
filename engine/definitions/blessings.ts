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
  // Blacksmith
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    type: 'blessing',
    description: 'Tableau: ±1 rank. Play buried face-up cards.',
    originalDescription: 'Tableau plays allow same or ±1 rank. Play buried face-up cards without moving their stack.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        // Allow playing buried face-up cards
        if (source.type === 'tableau' && cards.length === 1) {
          const card = cards[0];
          const idx = source.cards.findIndex(c => c.id === card.id);
          const isBuried = idx < source.cards.length - 1;
          if (isBuried && card.faceUp) return true;
        }
        // Allow same or ±1 rank for tableau plays
        if (target.type === 'tableau' && target.cards.length > 0) {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          const step = Math.abs(moving.rank - top.rank) <= 1;
          return step;
        }
        return defaultAllowed;
      }
    }
  },

  // Maneki-Neko
  {
    id: 'maneki_neko',
    name: 'Maneki-Neko',
    type: 'blessing',
    description: 'Tableau: ignore suit. Foundation: ignore rank.',
    originalDescription: 'Tableau plays ignore suit, foundation plays ignore rank.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        const moving = cards[0];
        const top = target.cards[target.cards.length - 1];
        if (target.type === 'tableau') {
          if (!top) return true;
          return Math.abs(moving.rank - top.rank) === 1;
        }
        if (target.type === 'foundation') {
          if (!top) return true;
          return moving.suit === top.suit;
        }
        return defaultAllowed;
      }
    }
  },

  // Tortoiseshell
  {
    id: 'tortoiseshell',
    name: 'Tortoiseshell',
    type: 'blessing',
    description: 'Tableau: ignore rank (no duplicates). Foundation: ignore suit.',
    originalDescription: 'Tableau plays ignore rank, foundation plays ignore suit. No duplicate rank+suit in same tableau.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        const moving = cards[0];
        // No duplicate rank+suit in same tableau
        if (target.type === 'tableau') {
          const hasDuplicate = target.cards.some(card => card.rank === moving.rank && card.suit === moving.suit);
          if (hasDuplicate) return false;
          return true;
        }
        if (target.type === 'foundation') {
          if (!target.cards.length) return true;
          return Math.abs(moving.rank - target.cards[target.cards.length - 1].rank) === 1;
        }
        return defaultAllowed;
      }
    }
  },

  // Vagrant
  {
    id: 'vagrant',
    name: 'Vagrant',
    type: 'blessing',
    description: '+2 tableaus. Move buried stacks.',
    originalDescription: '+2 tableaus. Allows playing buried face-up cards while moving their stack.',
    onActivate: [
      { action: 'add_piles', params: { type: 'tableau', count: 2 } }
    ],
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        // Allow playing buried face-up cards while moving their stack
        if (source.type === 'tableau') {
          const idx = source.cards.findIndex(c => c.id === cards[0].id);
          if (idx < source.cards.length - 1 && cards.every(c => c.faceUp)) return true;
        }
        return defaultAllowed;
      }
    }
  },

  // Wizard
  {
    id: 'wizard',
    name: 'Wizard',
    type: 'blessing',
    description: '+2 foundations. Tableau: build up/down.',
    originalDescription: '+2 foundations. Build tableau up or down by rank.',
    onActivate: [
      { action: 'add_piles', params: { type: 'foundation', count: 2 } }
    ],
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        if (target.type === 'tableau' && target.cards.length > 0) {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          return Math.abs(moving.rank - top.rank) === 1;
        }
        return defaultAllowed;
      }
    }
  },

  // Jester
  {
    id: 'jester',
    name: 'Jester',
    type: 'blessing',
    description: '+50% coins. Gain wild card (3 charges).',
    originalDescription: '+50% coin from all sources. Add a wild card to your hand (3 charges).',
    coins: [
      { pattern: 'coin_multiplier', params: { allMultiplier: 1.5 } }
    ],
    custom: {
      onActivate: (state) => {
        const hand = state.piles['hand'];
        const wildCard: Card = {
          id: `jester-wild-${Date.now()}`,
          suit: 'special',
          rank: 0 as Rank,
          faceUp: true,
          meta: { isWild: true, charges: 3 }
        };
        return {
          piles: {
            ...state.piles,
            hand: { ...hand, cards: [...hand.cards, wildCard] }
          }
        };
      },
      canMove: (cards, source, target, defaultAllowed) =>
        (cards.length === 1 && cards[0].meta?.isWild) ? true : defaultAllowed
    }
  },

  // Trickster
  {
    id: 'trickster',
    name: 'Trickster',
    type: 'blessing',
    description: 'All tableau face up. Gain key (3 charges).',
    originalDescription: 'All tableau cards face up. Add a key to your hand (3 charges).',
    visuals: [
      { pattern: 'force_face_up', appliesTo: ['tableau'] }
    ],
    custom: {
      onActivate: (state) => {
        const hand = state.piles['hand'];
        const tricksterKey: Card = {
          id: `trickster-key-${Date.now()}`,
          suit: 'special',
          rank: 0 as Rank,
          faceUp: true,
          meta: { isTricksterKey: true, charges: 3 }
        };
        return {
          piles: {
            ...state.piles,
            hand: { ...hand, cards: [...hand.cards, tricksterKey] }
          }
        };
      }
    }
  },

  // Klabautermann
  {
    id: 'klabautermann',
    name: 'Klabautermann',
    type: 'blessing',
    description: 'Block 1 ability trigger or gain 1 advantage per encounter.',
    originalDescription: 'Block 1 ability trigger or gain 1 advantage per encounter. (blocks 1 flip on Reverse Psychology, adds 1 extra bandage on Flesh Wound, adds 1 key on Caged Bakeneko, doubles the coin kept on Street Smarts, blocks shift once on Fog of War, allows picking starting preference on Mood Swings, gives +1 coin per move on Eat the Rich, & gives 3 play head start on 3 rules of 3)',
    effectState: {},
    custom: {
      // Implement per-curse logic in their respective handlers
    }
  },

  // Martyr
  {
    id: 'martyr',
    name: 'Martyr',
    type: 'blessing',
    description: 'Sacrifice foundation. Recall last 5 cards (1 charge).',
    originalDescription: 'Sacrifice 1 foundation. Return its cards to the deck. Return the last 5 cards you played to your hand (1 charge).',
    effectState: { lastPlayedCards: [], martyrTimekeeperUsed: false },
    custom: {
      onActivate: (state) => {
        if (state.effectState.martyrTimekeeperUsed) {
          // Sacrifice 1 foundation
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
        } else {
          // Return last 5 cards you played to your hand (1 charge)
          const lastFive: Card[] = (state.effectState.lastPlayedCards || []).slice(-5);
          const hand = state.piles['hand'];
          const clean = lastFive.map(c => ({ ...c, faceUp: true }));
          return {
            effectState: { ...state.effectState, martyrTimekeeperUsed: true },
            piles: { ...state.piles, hand: { ...hand, cards: [...hand.cards, ...clean] } }
          };
        }
      },
      onMoveComplete: (state, context) => {
        const playedCards = [...(state.effectState.lastPlayedCards || [])];
        playedCards.push(...context.cards);
        return { effectState: { ...state.effectState, lastPlayedCards: playedCards.slice(-20) } };
      }
    }
  },

  // Whore
  {
    id: 'whore',
    name: 'Whore',
    type: 'blessing',
    description: 'Convert points↔coins. Skip encounter for 2× goal.',
    originalDescription: 'Convert between points & coins (4:1 or 1:5). Pay 2× score goal to skip encounter (no coin rewards).',
    effectState: {},
    custom: {
      // Conversion and skip logic handled in UI/game flow
    }
  },
];
// Merchant blessing removed - merged into Trust Fund exploit
