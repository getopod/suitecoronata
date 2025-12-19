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
    description: 'Tableau plays allow same or ±1 rank. Play buried face-up cards without moving their stack.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        // Thief's effect: allow playing buried face-up cards
        if (source.type === 'tableau' && cards.length === 1) {
          const card = cards[0];
          const idx = source.cards.findIndex(c => c.id === card.id);
          const isBuried = idx < source.cards.length - 1;
          if (isBuried && card.faceUp) return true;
        }

        // Blacksmith's effect: tableau plays allow same or ±1 rank
        if (target.type === 'tableau' && target.cards.length > 0) {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          const step = Math.abs(moving.rank - top.rank) <= 1;
          const isAlt = getCardColor(moving.suit) !== getCardColor(top.suit);
          return isAlt && step;
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
    description: 'Tableau plays ignore rank, foundation plays ignore suit. No duplicate rank+suit in same tableau.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        const moving = cards[0];
        const top = target.cards[target.cards.length - 1];
        if (target.type === 'tableau') {
          // Check for duplicate rank+suit in target tableau
          const hasDuplicate = target.cards.some(card =>
            card.rank === moving.rank && card.suit === moving.suit
          );
          if (hasDuplicate) return false;

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
    description: '+2 foundations. Build tableau up or down by rank.',
    onActivate: [
      { action: 'add_piles', params: { type: 'foundation', count: 2 } }
    ],
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

  // ===========================================================================
  // Scoring Modifiers
  // ===========================================================================

  {
    id: 'schemer',
    name: 'Schemer',
    type: 'blessing',
    description: 'All tableau cards face up. +1 wild foundation. Foundation cards can be played to tableaus. Consecutive same-suit plays stack +100% points each.',
    effectState: {
      schemerLastSuit: null,
      schemerStreak: 0
    },
    visuals: [
      { pattern: 'force_face_up', appliesTo: ['tableau'] }
    ],
    custom: {
      onActivate: (state) => {
        const fid = `foundation-wild-${Date.now()}`;
        const newPile: Pile = { id: fid, type: 'foundation', cards: [], meta: { isWildFoundation: true } };
        const newPiles = { ...state.piles, [fid]: newPile };
        return { piles: newPiles };
      },
      canMove: (cards, source, target, defaultAllowed) => {
        // Allow moving from foundation to tableau
        if (source.type === 'foundation' && target.type === 'tableau') {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          if (!top) return isHighestRank(moving.rank);
          return getCardColor(moving.suit) !== getCardColor(top.suit) &&
                 isNextLowerInOrder(moving.rank, top.rank);
        }
        // Wild foundation logic
        if (target.meta?.isWildFoundation) {
          const top = target.cards[target.cards.length - 1];
          if (!top) return cards[0].rank === 1 || cards[0].meta?.isWild;
          return isNextHigherInOrder(cards[0].rank, top.rank);
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

  // ===========================================================================
  // Special Cards
  // ===========================================================================

  {
    id: 'jester',
    name: 'Jester',
    type: 'blessing',
    description: '+20% coin from all sources. Add a wild card to your hand (3 charges).',
    coins: [
      { pattern: 'coin_multiplier', params: { allMultiplier: 1.2 } }
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

  {
    id: 'trickster',
    name: 'Trickster',
    type: 'blessing',
    description: 'Add a key to your hand (3 charges). Allows playing buried face-up cards while moving their stack.',
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
      },
      canMove: (cards, source, target, defaultAllowed, state) => {
        // Check if trickster key is in hand with charges
        const hand = state.piles['hand'];
        const tricksterKey = hand?.cards.find(c => c.meta?.isTricksterKey && (c.meta.charges || 0) > 0);

        if (tricksterKey && source.type === 'tableau') {
          // Allow moving any face-up card along with all cards on top of it
          const sourceCards = source.cards;
          const firstCardIndex = sourceCards.findIndex(c => c.id === cards[0].id);

          if (firstCardIndex >= 0 && sourceCards[firstCardIndex].faceUp) {
            return true; // Allow the move
          }
        }

        return defaultAllowed;
      }
    }
  },

  // ===========================================================================
  // Complex Effects (require custom handlers)
  // ===========================================================================

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
    description: 'Sacrifice 1 foundation. Return its cards to the deck. Return the last 5 cards you played to your hand (1 charge).',
    effectState: { lastPlayedCards: [], martyrTimekeeperUsed: false },
    custom: {
      onActivate: (state) => {
        // Check if we're using the timekeeper ability
        if (state.effectState.martyrTimekeeperUsed) {
          // Use the sacrifice foundation ability
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
          // Use the timekeeper ability
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

  {
    id: 'master_debater',
    name: 'Master Debater',
    type: 'blessing',
    description: 'Block 1 ability trigger or gain 1 advantage per encounter.',
    effectState: {
      masterDebaterCharges: 1,
      fleshWoundBandages: 0,
      cagedBakenekoBonusKeys: 0,
      streetSmartsCoinSaved: 0,
      fogOfWarBlocked: false,
      threeRulesDelayPlays: 0,
      moodSwingsStartingRank: null,
      eatTheRichCoinReduction: 0
    },
    custom: {
      onEncounterStart: (state) => ({
        effectState: {
          ...state.effectState,
          masterDebaterCharges: 1,
          fleshWoundBandages: 0,
          cagedBakenekoBonusKeys: 0,
          streetSmartsCoinSaved: 0,
          fogOfWarBlocked: false,
          threeRulesDelayPlays: 0,
          moodSwingsStartingRank: null,
          eatTheRichCoinReduction: 0
        }
      })
    }
  },

];
// Merchant blessing removed - merged into Trust Fund exploit
