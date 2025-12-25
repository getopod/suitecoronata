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
    description: 'Every 5 moves, flip gameboard horizontally, then vertically, then horizontally, then vertically, & so on. Completed foundations remove 1 flip from 4 possible.',
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
    description: '3 tableau locked. 4 keys hidden in other tableau. Unlock a random tableau at 50% of score goal.',
    effectState: { bakenekoLocked: [], bakenekoKeys: [] },
    custom: {
      onActivate: (state) => {
        const newPiles = { ...state.piles };
        const tabIds = Object.keys(newPiles).filter(k => k.startsWith('tableau')).sort(() => Math.random() - 0.5).slice(0, 3);
        tabIds.forEach(id => { newPiles[id] = { ...newPiles[id], locked: true }; });

        // Place keys as face-down cards in random unlocked tableaus
        const others = Object.keys(newPiles).filter(k => k.startsWith('tableau') && !tabIds.includes(k));
        const keyLocations: string[] = [];
        for (let i = 0; i < 4 && others.length > 0; i++) {
          const id = others[Math.floor(Math.random() * others.length)];
          const key: Card = { id: `bkey-${i}-${Date.now()}`, suit: 'special', rank: 0 as Rank, faceUp: false, meta: { isKey: true } };
          newPiles[id] = { ...newPiles[id], cards: [...newPiles[id].cards, key] };
          keyLocations.push(id);
        }

        return { piles: newPiles, effectState: { ...state.effectState, bakenekoLocked: tabIds, bakenekoKeys: keyLocations } };
      },
      onMoveComplete: (state) => {
        // Auto-unlock at 50% goal
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
    effectState: { encounterCoins: 0, previousCoins: 0 },
    coins: [
      { pattern: 'coin_multiplier', params: { allMultiplier: 5 } }
    ],
    custom: {
      onActivate: (state) => {
        return {
          effectState: {
            ...state.effectState,
            encounterCoins: 0,
            previousCoins: state.coins
          }
        };
      },
      onMoveComplete: (state) => {
        // Check if coins increased this move
        const previousCoins = state.effectState.previousCoins || 0;
        const coinDelta = state.coins - previousCoins;

        if (coinDelta > 0) {
          // Coins were earned - move them from player coins to encounter coins
          const encounterCoins = (state.effectState.encounterCoins || 0) + coinDelta;
          const newPlayerCoins = previousCoins; // Remove the coins that were just added

          // Check if we've reached the goal
          if (encounterCoins >= state.currentScoreGoal) {
            // Encounter complete! Give player 10% of encounter coins
            const coinsToKeep = Math.floor(encounterCoins * 0.1);
            return {
              isLevelComplete: true,
              coins: newPlayerCoins + coinsToKeep,
              effectState: {
                ...state.effectState,
                encounterCoins,
                previousCoins: newPlayerCoins + coinsToKeep
              }
            };
          }

          // Update encounter coins and reset player coins
          return {
            coins: newPlayerCoins,
            effectState: {
              ...state.effectState,
              encounterCoins,
              previousCoins: newPlayerCoins
            }
          };
        }

        // No coins earned this move, just update tracking
        return {
          effectState: {
            ...state.effectState,
            previousCoins: state.coins
          }
        };
      }
    }
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
    effectState: { towerSuitsCompleted: [] },
    custom: {
      onActivate: (state) => {
        const newPiles = { ...state.piles };

        // Remove all foundations
        Object.keys(newPiles).filter(k => k.startsWith('foundation')).forEach(fid => { delete newPiles[fid]; });

        // Add 4 empty tableaus
        const existingTableaus = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
        const maxTableauIndex = existingTableaus.reduce((max, key) => {
          const num = parseInt(key.split('-')[1]);
          return Math.max(max, num);
        }, -1);

        for (let i = 1; i <= 4; i++) {
          const newIndex = maxTableauIndex + i;
          newPiles[`tableau-${newIndex}`] = {
            id: `tableau-${newIndex}`,
            type: 'tableau',
            cards: []
          };
        }

        return {
          piles: newPiles,
          scoreMultiplier: 0, // Disable scoring
          effectState: { ...state.effectState, towerSuitsCompleted: [] }
        };
      },
      onMoveComplete: (state) => {
        // Check if all 4 suits are stacked properly in tableaus (Ace to King)
        const tableaus = Object.values(state.piles).filter(p => p.type === 'tableau');
        const completedSuits: string[] = [];

        tableaus.forEach(tableau => {
          if (tableau.cards.length === 13) {
            const firstCard = tableau.cards[0];
            // Check if it's a complete suit from Ace (1) to King (13)
            const isComplete = tableau.cards.every((card, idx) => {
              return card.suit === firstCard.suit &&
                     card.rank === idx + 1 &&
                     card.faceUp;
            });

            if (isComplete && !completedSuits.includes(firstCard.suit)) {
              completedSuits.push(firstCard.suit);
            }
          }
        });

        // Win condition: All 4 suits completed
        if (completedSuits.length >= 4) {
          return {
            isLevelComplete: true,
            effectState: { ...state.effectState, towerSuitsCompleted: completedSuits }
          };
        }

        return { effectState: { ...state.effectState, towerSuitsCompleted: completedSuits } };
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
    id: 'three_rules_of_three',
    name: '3 Rules of 3',
    type: 'curse',
    description: 'Every 3rd play removes 3 cards from deck. Lowest face-up tableau card moved to deck.',
    onMoveComplete: (state) => {
      if (state.moves > 0 && state.moves % 3 === 0) {
        const deck = state.piles['deck'];
        const newDeck = [...deck.cards];
        newDeck.splice(0, Math.min(3, newDeck.length));
        let lowest: Card | null = null;
        Object.values(state.piles).filter(p => p.type === 'tableau').forEach(p => {
          const faceUps = p.cards.filter(c => c.faceUp);
          faceUps.forEach(c => { if (!lowest || c.rank < lowest.rank) lowest = c; });
        });
        if (lowest) {
          const newPiles = { ...state.piles };
          Object.keys(newPiles).filter(k => k.startsWith('tableau')).forEach(id => {
            newPiles[id].cards = newPiles[id].cards.filter(c => c.id !== lowest!.id);
          });
          newDeck.push({ ...lowest, faceUp: false });
          return { piles: { ...newPiles, deck: { ...deck, cards: newDeck } } };
        }
      }
      return {};
    }
  },
   {
    id: 'eat_the_rich',
    name: 'Eat the Rich',
    type: 'curse',
    description: 'Full deck dealt to equal tableaus at start. Coin gains disabled. 3× points gained.',
    onActivate: (state) => {
      const deck = state.piles['deck'];
      const allCards = [...deck.cards];
      allCards.sort(() => Math.random() - 0.5);
      const newPiles: Record<string, Pile> = {};
      const tableauCount = 7;
      const perPile = Math.floor(allCards.length / tableauCount);
      for (let i = 0; i < tableauCount; i++) {
        const pileCards = allCards.slice(i * perPile, (i + 1) * perPile);
        if (pileCards.length > 0) pileCards[pileCards.length - 1].faceUp = true;
        newPiles[`tableau-${i}`] = { id: `tableau-${i}`, type: 'tableau', cards: pileCards };
      }
      Object.keys(state.piles).filter(k => k.startsWith('foundation')).forEach(fid => { delete newPiles[fid]; });
      return {
        piles: { ...state.piles, ...newPiles, deck: { ...deck, cards: [] } },
        coinMultiplier: 0,
        scoreMultiplier: 3
      };
    }
  },


  {
    id: 'entropy',
    name: 'Entropy',
    type: 'curse',
    description: 'Every 10 plays, shuffle & redeal tableau & foundations from deck. Hand size is 10. Tableau plays from your hand swap places.',
    custom: {
      onMoveComplete: (state, context) => {
        let updates: any = {};

        // Handle hand-to-tableau swaps
        if (context.source === 'hand' && context.target.startsWith('tableau')) {
          const targetPile = state.piles[context.target];
          const handPile = state.piles['hand'];

          if (targetPile.cards.length > 0) {
            const newPiles = { ...state.piles };
            const swapCard = targetPile.cards.pop();
            if (swapCard) {
              newPiles['hand'].cards.push(swapCard);
              updates.piles = newPiles;
            }
          }
        }

        // Every 10 plays, shuffle and redeal
        if (state.moves > 0 && state.moves % 10 === 0) {
          let allCards: Card[] = [];
          ['tableau-0','tableau-1','tableau-2','tableau-3','tableau-4','tableau-5','tableau-6'].forEach(id => {
            if (state.piles[id]) allCards = [...allCards, ...state.piles[id].cards];
          });
          ['foundation-hearts','foundation-diamonds','foundation-clubs','foundation-spades'].forEach(id => {
            if (state.piles[id]) allCards = [...allCards, ...state.piles[id].cards];
          });
          if (state.piles['deck']) allCards = [...allCards, ...state.piles['deck'].cards];

          allCards.sort(() => Math.random() - 0.5);
          const newPiles: Record<string, Pile> = { ...(updates.piles || state.piles) };

          for (let i = 0; i < 7; i++) {
            const pileCards = allCards.splice(0, i + 1);
            if (pileCards.length > 0) pileCards[pileCards.length - 1].faceUp = true;
            newPiles[`tableau-${i}`] = { id: `tableau-${i}`, type: 'tableau', cards: pileCards };
          }
          ['hearts','diamonds','clubs','spades'].forEach(suit => {
            newPiles[`foundation-${suit}`] = { id: `foundation-${suit}`, type: 'foundation', cards: [] };
          });
          newPiles['deck'] = { id: 'deck', type: 'deck', cards: allCards };
          updates.piles = newPiles;
        }

        return updates;
      },
      onActivate: (state) => ({ resources: { ...state.resources, handSize: 10 } })
    }
  },


  {
    id: 'executive_order',
    name: 'Executive Order',
    type: 'curse',
    description: 'All tableaus linked; Must play 1 to each in order, even if not valid. Then rearrange cards freely for 7 moves & score at end. Repeat.',
    effectState: { executivePhase: 'play', executiveTableauIndex: 0, executiveFreeMovesLeft: 0 },
    custom: {
      onActivate: (state) => ({
        effectState: { ...state.effectState, executivePhase: 'play', executiveTableauIndex: 0, executiveFreeMovesLeft: 0 }
      }),
      canMove: (cards, source, target, defaultAllowed, state) => {
        const phase = state.effectState.executivePhase || 'play';
        if (phase === 'free') return true; // Allow any move during free phase

        // During play phase, must play to current tableau in order
        if (target.type === 'tableau') {
          const targetNum = parseInt(target.id.split('-')[1]);
          const expectedNum = state.effectState.executiveTableauIndex || 0;
          return targetNum === expectedNum;
        }
        return defaultAllowed;
      },
      calculateScore: (currentScore, context, state) => {
        const phase = state.effectState.executivePhase || 'play';
        const movesLeft = state.effectState.executiveFreeMovesLeft || 0;

        // No scoring during play phase
        if (phase === 'play') {
          return 0;
        }

        // No scoring during free phase except the last move
        if (phase === 'free' && movesLeft > 1) {
          return 0;
        }

        // Allow normal scoring on the last move of free phase
        return currentScore;
      },
      onMoveComplete: (state) => {
        const phase = state.effectState.executivePhase || 'play';
        const currentIndex = state.effectState.executiveTableauIndex || 0;

        if (phase === 'play') {
          const nextIndex = (currentIndex + 1) % 7;
          if (nextIndex === 0) {
            // Completed cycle, enter free phase
            return {
              effectState: { ...state.effectState, executivePhase: 'free', executiveFreeMovesLeft: 7 }
            };
          }
          return { effectState: { ...state.effectState, executiveTableauIndex: nextIndex } };
        } else {
          // Free phase
          const movesLeft = (state.effectState.executiveFreeMovesLeft || 0) - 1;
          if (movesLeft <= 0) {
            // Return to play phase
            return {
              effectState: { ...state.effectState, executivePhase: 'play', executiveTableauIndex: 0 }
            };
          }
          return { effectState: { ...state.effectState, executiveFreeMovesLeft: movesLeft } };
        }
      }
    }
  },

  {
    id: 'mood_swings',
    name: 'Mood Swings',
    type: 'curse',
    description: 'Odd/even ranks alternate scoring 0 every 6/7 plays. x2 scoring.',
    effectState: { moodSwingCycle: 0 },
    custom: {
      onActivate: (state) => ({
        effectState: { ...state.effectState, moodSwingCycle: 0 },
        scoreMultiplier: state.scoreMultiplier * 2
      }),
      calculateScore: (scoreDelta, context, state) => {
        const cycle = (state.effectState.moodSwingCycle || 0);
        const card = context.cards[0];
        const isOddRank = card.rank % 2 === 1;

        // Every 6 plays for odd ranks, every 7 plays for even ranks
        if (isOddRank && cycle % 6 === 5) return 0;
        if (!isOddRank && cycle % 7 === 6) return 0;

        return scoreDelta;
      },
      transformCardVisual: (card, pile, state) => {
        // Only apply visual tint to hand cards
        if (pile?.type !== 'hand') return {};

        const cycle = (state?.effectState?.moodSwingCycle || 0);
        const isOddRank = card.rank % 2 === 1;

        // Check if this card will score 0 on the next play
        const willNotScore = (isOddRank && cycle % 6 === 5) || (!isOddRank && cycle % 7 === 6);

        if (willNotScore) {
          // Subtle red tint for cards that won't score
          return {
            meta: {
              ...card.meta,
              color: 'rgba(255, 100, 100, 0.15)' // Subtle red overlay
            }
          };
        } else {
          // Subtle green tint for cards that will score
          return {
            meta: {
              ...card.meta,
              color: 'rgba(100, 255, 100, 0.15)' // Subtle green overlay
            }
          };
        }
      },
      onMoveComplete: (state) => {
        const cycle = (state.effectState.moodSwingCycle || 0) + 1;
        return { effectState: { ...state.effectState, moodSwingCycle: cycle } };
      }
    }
  },

  {
    id: 'veil_of_uncertainty',
    name: 'Veil of Uncertainty',
    type: 'curse',
    description: 'Only suit visible. +50% points gained. 33% to stumble to an adjacent tableau for negative score.',
    visuals: [
      { pattern: 'hide_rank' }
    ],
    custom: {
      onActivate: (state) => ({
        scoreMultiplier: state.scoreMultiplier * 1.5
      }),
      onMoveComplete: (state, context) => {
        // 33% chance to stumble to adjacent tableau
        if (Math.random() < 0.33 && context.target.startsWith('tableau')) {
          const tableauNum = parseInt(context.target.split('-')[1]);
          const adjacentLeft = tableauNum > 0 ? `tableau-${tableauNum - 1}` : null;
          const adjacentRight = tableauNum < 6 ? `tableau-${tableauNum + 1}` : null;
          const adjacent = Math.random() < 0.5 ? adjacentLeft : adjacentRight;

          if (adjacent && state.piles[adjacent]) {
            const newPiles = { ...state.piles };
            const movedCard = newPiles[context.target].cards.pop();
            if (movedCard) {
              newPiles[adjacent].cards.push(movedCard);
              return { piles: newPiles, score: state.score - movedCard.rank };
            }
          }
        }
        return {};
      }
    }
  },
];
