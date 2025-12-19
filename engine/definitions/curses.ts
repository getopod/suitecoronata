/**
 * Curse Effect Definitions
 *
 * Curses are negative effects that challenge the player.
 * They modify rules, add restrictions, or change the win condition.
 */

import { EffectDefinition } from '../patterns/types';
import { Card, Pile, GameState, Rank, Suit } from '../../types';

// Helper
const getCardColor = (suit: string) => {
  if (suit === 'hearts' || suit === 'diamonds') return 'red';
  if (suit === 'clubs' || suit === 'spades') return 'black';
  return 'none';
};

export const CURSE_DEFINITIONS: EffectDefinition[] = [
  // ===========================================================================
  // Board Manipulation Curses
  // ===========================================================================

  {
    id: 'reverse_psychology',
    name: 'Reverse Psychology',
    type: 'curse',
    description: 'Every 5 moves, flip board H/V alternating. Completed foundations remove 1 flip.',
    effectState: { pendingFlips: [] },
    custom: {
      onMoveComplete: (state) => {
        const moves = state.moves + 1;
        const flips = state.effectState.pendingFlips || [];
        if (moves % 5 === 0) {
          const next = (flips.length % 2 === 0) ? 'horizontal' : 'vertical';
          return { effectState: { ...state.effectState, pendingFlips: [...flips, next] } };
        }
        return {};
      },
      onActivate: (state) => ({ effectState: { ...state.effectState, pendingFlips: [] } })
    }
  },

  {
    id: 'schrodingers_deck',
    name: "Schrodinger's Deck",
    type: 'curse',
    description: 'Tableaus 50% exist after each play; at least 3 exist. Each Ace in foundation increases odds by 10%. Queen at bottom of tableau stops it from disappearing.',
    custom: {
      onMoveComplete: (state) => {
        const newPiles = { ...state.piles };
        const tabs = Object.keys(newPiles).filter(k => k.startsWith('tableau'));

        // Count aces in foundations for stability
        const acesInFoundations = Object.keys(newPiles)
          .filter(k => k.startsWith('foundation'))
          .reduce((count, fid) => {
            const pile = newPiles[fid];
            return count + pile.cards.filter(c => c.rank === 1).length;
          }, 0);

        const baseChance = 0.5 + (acesInFoundations * 0.1);

        tabs.forEach(id => {
          const pile = newPiles[id];

          // Check if Queen is at bottom
          const hasQueenAtBottom = pile.cards.length > 0 && pile.cards[0].rank === 12;

          if (hasQueenAtBottom) {
            // Don't change visibility if Queen at bottom
            return;
          }

          const exists = Math.random() < baseChance;
          newPiles[id] = { ...pile, hidden: !exists };
        });

        const existent = tabs.filter(id => !newPiles[id].hidden);
        if (existent.length < 3) {
          const forceIds = tabs.slice(0, 3);
          forceIds.forEach(id => { newPiles[id].hidden = false; });
        }
        return { piles: newPiles };
      },
      canMove: (cards, source, target, defaultAllowed, state) =>
        (source.hidden || target.hidden) ? false : defaultAllowed
    }
  },

  // ===========================================================================
  // Quest/Item Curses
  // ===========================================================================

  {
    id: 'flesh_wound',
    name: 'Flesh Wound',
    type: 'curse',
    description: 'Wound in hand increases goal by 10% each cycle. Find 2 bandages in tableau to remove.',
    effectState: { woundActive: true, bandagesFound: 0 },
    custom: {
      onActivate: (state) => {
        const hand = state.piles['hand'];
        const wound: Card = { id: 'wound-card', suit: 'special', rank: 0 as Rank, faceUp: true, meta: { isWound: true } };
        const newPiles = { ...state.piles, hand: { ...hand, cards: [...hand.cards, wound] } };
        const tabKeys = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
        for (let i = 0; i < 2 && tabKeys.length > 0; i++) {
          const key = tabKeys[Math.floor(Math.random() * tabKeys.length)];
          const bandage: Card = { id: `bandage-${i}-${Date.now()}`, suit: 'special', rank: 0 as Rank, faceUp: false, meta: { isBandage: true } };
          newPiles[key] = { ...newPiles[key], cards: [...newPiles[key].cards, bandage] };
        }
        return { piles: newPiles, effectState: { ...state.effectState, woundActive: true, bandagesFound: 0 } };
      },
      onMoveComplete: (state, context) => {
        const foundBandage = context.cards.find(c => c.meta?.isBandage);
        if (foundBandage && context.cards[0].faceUp) {
          const remaining = (state.effectState.bandagesFound || 0) + 1;
          const clearWound = remaining >= 2;
          return { effectState: { ...state.effectState, bandagesFound: remaining, woundActive: clearWound ? false : true } };
        }
        return {};
      }
    }
  },

  {
    id: 'caged_bakeneko',
    name: 'Caged Bakeneko',
    type: 'curse',
    description: '3 tableau locked. 4 keys hidden. Unlock a random tableau at 50% of score goal.',
    effectState: { bakenekoLocked: [] },
    custom: {
      onActivate: (state) => {
        const newPiles = { ...state.piles };
        const tabIds = Object.keys(newPiles).filter(k => k.startsWith('tableau')).sort(() => Math.random() - 0.5).slice(0, 3);
        tabIds.forEach(id => { newPiles[id] = { ...newPiles[id], locked: true }; });
        const others = Object.keys(newPiles).filter(k => k.startsWith('tableau') && !tabIds.includes(k));
        for (let i = 0; i < 4 && others.length > 0; i++) {
          const id = others[Math.floor(Math.random() * others.length)];
          const key: Card = { id: `bkey-${i}-${Date.now()}`, suit: 'special', rank: 0 as Rank, faceUp: false, meta: { isKey: true } };
          newPiles[id] = { ...newPiles[id], cards: [...newPiles[id].cards, key] };
        }
        return { piles: newPiles, effectState: { ...state.effectState, bakenekoLocked: tabIds } };
      },
      onMoveComplete: (state) => {
        if (state.score >= Math.floor(state.currentScoreGoal * 0.5)) {
          const locked = (state.effectState.bakenekoLocked || []).slice();
          if (locked.length > 0) {
            const unlock = locked.shift();
            const pile = state.piles[unlock!];
            const newPiles = { ...state.piles, [unlock!]: { ...pile, locked: false } };
            return { piles: newPiles, effectState: { ...state.effectState, bakenekoLocked: locked } };
          }
        }
        return {};
      },
      canMove: (cards, source, target, defaultAllowed) =>
        (source.locked || target.locked) ? false : defaultAllowed
    }
  },

  // ===========================================================================
  // Scoring/Economy Curses
  // ===========================================================================

  {
    id: 'street_smarts',
    name: 'Street Smarts',
    type: 'curse',
    description: 'Complete encounter by gaining goal in coins, not points. x5 coins gained. Only keep 10%.',
    coins: [
      { pattern: 'coin_multiplier', params: { allMultiplier: 5 } }
    ]
  },

  {
    id: 'counterfeiting',
    name: 'Counterfeiting',
    type: 'curse',
    description: 'Duplicate all cards before dealing. -50% points gained. Cards with same rank can be stacked.',
    scoring: [
      { pattern: 'percentage_multiplier', params: { multiplier: 0.5 } }
    ],
    onActivate: [
      { action: 'duplicate_deck' }
    ],
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        if (target.type === 'tableau' && target.cards.length > 0) {
          const top = target.cards[target.cards.length - 1];
          return cards[0].rank === top.rank || defaultAllowed;
        }
        return defaultAllowed;
      }
    }
  },

  // ===========================================================================
  // Visual/Information Curses
  // ===========================================================================

  {
    id: 'fog_of_war_variant',
    name: 'Fog of War',
    type: 'curse',
    description: 'Only rank & color visible. Suit hidden. Every 10 moves, reduce rank of face-up tableau cards by 1 & increase rank of face-down tableau cards by 1.',
    visuals: [
      { pattern: 'hide_suit' }
    ],
    custom: {
      onMoveComplete: (state) => {
        if (state.moves > 0 && state.moves % 10 === 0) {
          const newPiles = { ...state.piles };
          Object.keys(newPiles).filter(k => k.startsWith('tableau')).forEach(id => {
            const pile = newPiles[id];
            newPiles[id] = {
              ...pile,
              cards: pile.cards.map(card => {
                if (card.faceUp) {
                  // Reduce rank by 1 for face-up cards
                  return { ...card, rank: Math.max(1, card.rank - 1) as Rank };
                } else {
                  // Increase rank by 1 for face-down cards
                  return { ...card, rank: Math.min(13, card.rank + 1) as Rank };
                }
              })
            };
          });
          return { piles: newPiles };
        }
        return {};
      }
    }
  },

  // ===========================================================================
  // Game Structure Curses
  // ===========================================================================

  {
    id: 'tower_of_babel',
    name: 'Tower of Babel',
    type: 'curse',
    description: '+4 empty tableau. No foundations. No score. Advance by stacking all 4 suits in tableau.',
    custom: {
      onActivate: (state) => {
        const newPiles = { ...state.piles };
        Object.keys(newPiles).filter(k => k.startsWith('foundation')).forEach(fid => { delete newPiles[fid]; });
        return { piles: newPiles };
      }
    }
  },

  {
    id: 'revolving_door',
    name: 'Revolving Door',
    type: 'curse',
    description: 'Foundations only keep top card, return rest to deck. Cards score +50% each cycle. Pass all 13 ranks through a foundation to close it & gain +100% score bonus.',
    effectState: { cardCycles: {}, closedFoundations: [] },
    custom: {
      onMoveComplete: (state, context) => {
        if (context.target.includes('foundation')) {
          const pile = state.piles[context.target];
          const top = pile.cards[pile.cards.length - 1];
          const returned = pile.cards.slice(0, -1).map(c => ({ ...c, faceUp: false }));
          const deck = state.piles['deck'];

          // Track card cycles for scoring
          const cycles = state.effectState.cardCycles || {};
          returned.forEach(card => {
            cycles[card.id] = (cycles[card.id] || 0) + 1;
          });

          // Check if all 13 ranks have passed through
          const ranksCompleted = new Set(pile.cards.map(c => c.rank)).size;
          const closedFounds = state.effectState.closedFoundations || [];
          if (ranksCompleted >= 13 && !closedFounds.includes(context.target)) {
            closedFounds.push(context.target);
          }

          return {
            piles: {
              ...state.piles,
              [context.target]: { ...pile, cards: [top] },
              deck: { ...deck, cards: [...deck.cards, ...returned] }
            },
            effectState: { ...state.effectState, cardCycles: cycles, closedFoundations: closedFounds }
          };
        }
        if (context.target === 'deck') {
          const newPiles = { ...state.piles };
          Object.keys(newPiles).filter(k => k.startsWith('tableau')).forEach(id => {
            const pile = newPiles[id];
            const faceUp = pile.cards.filter(c => c.faceUp);
            faceUp.sort(() => Math.random() - 0.5);
            newPiles[id] = { ...pile, cards: [...pile.cards.filter(c => !c.faceUp), ...faceUp] };
          });
          return { piles: newPiles };
        }
        return {};
      }
    }
  },

  {
    id: '3_rules_of_3',
    name: '3 Rules of 3',
    type: 'curse',
    description: 'Only 3s can move to foundations. Only 3 tableau moves per turn. Only 3 cards can be in hand.',
    custom: {
      canMove: (cards, source, target, defaultAllowed, state) => {
        if (target.type === 'foundation' && cards[0].rank !== 3) {
          return false;
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'eat_the_rich',
    name: 'Eat the Rich',
    type: 'curse',
    description: 'Face cards (J/Q/K) cannot be played. Must be discarded to continue. -5 coins per face card discarded.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        const isFaceCard = cards[0].rank >= 11; // J=11, Q=12, K=13
        if (isFaceCard && target.type !== 'deck') {
          return false;
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'entropy',
    name: 'Entropy',
    type: 'curse',
    description: 'After each move, flip a random face-up card face-down in tableau.',
    custom: {
      onMoveComplete: (state) => {
        const newPiles = { ...state.piles };
        const tableaus = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
        const faceUpCards: {pileId: string, index: number}[] = [];

        tableaus.forEach(id => {
          newPiles[id].cards.forEach((card, idx) => {
            if (card.faceUp) {
              faceUpCards.push({ pileId: id, index: idx });
            }
          });
        });

        if (faceUpCards.length > 0) {
          const target = faceUpCards[Math.floor(Math.random() * faceUpCards.length)];
          newPiles[target.pileId].cards[target.index] = { ...newPiles[target.pileId].cards[target.index], faceUp: false };
        }

        return { piles: newPiles };
      }
    }
  },

  {
    id: 'executive_order',
    name: 'Executive Order',
    type: 'curse',
    description: 'Kings cannot be moved. They must remain in their starting position.',
    custom: {
      canMove: (cards, source, target, defaultAllowed) => {
        if (cards[0].rank === 13) { // King
          return false;
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'mood_swings',
    name: 'Mood Swings',
    type: 'curse',
    description: 'Every 7 moves, randomly swap red/black stacking rules.',
    effectState: { redBlackSwapped: false },
    custom: {
      onActivate: (state) => ({ effectState: { ...state.effectState, redBlackSwapped: false } }),
      onMoveComplete: (state) => {
        if (state.moves > 0 && state.moves % 7 === 0) {
          const swapped = !(state.effectState.redBlackSwapped || false);
          return { effectState: { ...state.effectState, redBlackSwapped: swapped } };
        }
        return {};
      },
      canMove: (cards, source, target, defaultAllowed, state) => {
        if (target.type === 'tableau' && target.cards.length > 0 && state.effectState.redBlackSwapped) {
          const topCard = target.cards[target.cards.length - 1];
          const movingCard = cards[0];
          const topColor = getCardColor(topCard.suit);
          const movingColor = getCardColor(movingCard.suit);

          // If swapped, allow same color instead of alternating
          if (topColor === movingColor && movingCard.rank === topCard.rank - 1) {
            return true;
          }
          return false;
        }
        return defaultAllowed;
      }
    }
  },

  {
    id: 'veil_of_uncertainty',
    name: 'Veil of Uncertainty',
    type: 'curse',
    description: 'All face-down cards show question marks. Cannot see what will be revealed until flipped.',
    visuals: [
      { pattern: 'hide_facedown_ranks' }
    ]
  },
];
