import { GameEffect, Suit, Card, Rank, Pile, GameState, MoveContext } from '../types';

export const getCardColor = (suit: Suit) => {
  if (suit === 'special') return 'purple';
  return (suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black');
};

const simulateCoinTransaction = (context: MoveContext, state: GameState, activeEffects: GameEffect[]) => {
  return activeEffects.reduce((delta, eff) => {
    if (eff.calculateCoinTransaction) return eff.calculateCoinTransaction(delta, context, state);
    return delta;
  }, 0);
};

// Helper to reset board for Nice Rock variants
export const generateNewBoard = (currentScore: number, currentCoins: number, scoreMult: number, coinMult: number, hardMode: boolean = false, randomChaos: boolean = false): GameState => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const deck: Card[] = [];
  suits.forEach(suit => {
    for (let r = 1; r <= 13; r++) {
      deck.push({ id: `${suit}-${r}-${Math.random()}`, suit, rank: r as Rank, faceUp: false });
    }
  });
  
  if (randomChaos) {
     // Randomize rank/suit of every card
     deck.forEach(c => {
        c.rank = Math.ceil(Math.random() * 13) as Rank;
        c.suit = suits[Math.floor(Math.random() * 4)];
     });
  }
  
  deck.sort(() => Math.random() - 0.5);

  const piles: Record<string, Pile> = {};
  for (let i = 0; i < 7; i++) {
    // Hard mode: Deal 0 cards to tableau initially
    const count = hardMode ? 0 : i + 1;
    const pileCards = deck.splice(0, count);
    if (pileCards.length > 0) pileCards[pileCards.length - 1].faceUp = true;
    piles[`tableau-${i}`] = { id: `tableau-${i}`, type: 'tableau', cards: pileCards };
  }
  ['hearts', 'diamonds', 'clubs', 'spades'].forEach(suit => {
    piles[`foundation-${suit}`] = { id: `foundation-${suit}`, type: 'foundation', cards: [] };
  });
  piles['deck'] = { id: 'deck', type: 'deck', cards: deck };
  piles['hand'] = { id: 'hand', type: 'hand', cards: [] };

  return {
    piles,
    score: currentScore,
    coins: currentCoins,
    moves: 0,
    selectedCardIds: null,
    effectState: {},
    scoreMultiplier: scoreMult,
    coinMultiplier: coinMult,
    // Add missing properties from GameState interface
    runIndex: 0,
    currentScoreGoal: 150,
    ownedEffects: [],
    isLevelComplete: false,
    isGameOver: false,
    startTime: Date.now(),
    seed: Math.random().toString(36).substring(7),
    debugUnlockAll: false,
    activeMinigame: null,
    minigameResult: null,
    wanderState: 'none',
    wanderRound: 0,
    wanderOptions: [],
    activeWander: null,
    wanderResultText: null,
    interactionMode: 'normal',
    charges: {}
  };
};

export const EFFECTS_REGISTRY: GameEffect[] = [
  // --- EXISTING ITEMS ---
  {
    id: 'hostile_takeover',
    name: 'Hostile Takeover',
    type: 'danger',
    description: 'Only suit visible. Rank not shown.',
    transformCardVisual: (card) => card.faceUp ? { ...card, rank: -1 as unknown as Rank } : {}
  },
  {
    id: 'bait_switch',
    name: 'Bait & Switch',
    type: 'exploit',
    description: 'Aces can be high or low.',
    canMove: (cards, source, target, defaultAllowed) => {
      if (defaultAllowed) return true;
      if (target.type === 'tableau' && cards.length > 0) {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (targetCard && targetCard.faceUp && moving.rank === 1 && targetCard.rank === 13) {
           return getCardColor(moving.suit) !== getCardColor(targetCard.suit);
        }
      }
      return defaultAllowed;
    },
  },
  {
    id: 'death_dishonor',
    name: 'Death before Dishonor',
    type: 'danger',
    description: 'Each shuffle or discard, -10% points then double.',
    onMoveComplete: (state, context) => {
      if (context.source === 'hand' && context.target === 'deck') {
        return { score: Math.floor(state.score * 0.9) };
      }
      return {};
    }
  },
  {
    id: 'stolen_valor',
    name: 'Stolen Valor',
    type: 'exploit',
    description: 'Play from foundations for -10 points.',
    canMove: (cards, source, target, defaultAllowed) => {
      if (source.type === 'foundation' && target.type === 'tableau') {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return moving.rank === 13;
        return (getCardColor(moving.suit) !== getCardColor(targetCard.suit) && targetCard.rank === moving.rank + 1);
      }
      return defaultAllowed;
    },
    calculateScore: (score, context) => {
       if (context.source.includes('foundation') && context.target.includes('tableau')) {
        return score - 10;
      }
      return score;
    }
  },
  {
    id: 'fog_of_war',
    name: 'Fog of War',
    type: 'curse',
    description: "Can't move stacks. All plays +50% points.",
    canMove: (cards, s, t, defaultAllowed) => cards.length > 1 ? false : defaultAllowed,
    calculateScore: (score) => Math.floor(score * 1.5)
  },
  {
    id: 'broken_heart',
    name: 'Broken Heart',
    type: 'curse',
    description: 'Heart plays -10 points. Other suit plays +5 points.',
    calculateScore: (currentScore, context) => {
      if (!context.target.includes('foundation')) return currentScore;
      return context.cards[0].suit === 'hearts' ? -10 : currentScore + 5;
    }
  },
  {
    id: 'mulligan',
    name: 'Mulligan',
    type: 'danger',
    description: 'Every 5 moves, shuffle & deal all cards again.',
    onMoveComplete: (state, context) => {
      if (state.moves > 0 && state.moves % 5 === 0) {
        let allCards: Card[] = [];
        Object.values(state.piles).forEach(p => { allCards = [...allCards, ...p.cards]; });
        allCards = allCards.map(c => ({ ...c, faceUp: false }));
        allCards.sort(() => Math.random() - 0.5);

        const newPiles: Record<string, Pile> = {};
        let cardIdx = 0;
        for (let i = 0; i < 7; i++) {
          const pileCards = allCards.slice(cardIdx, cardIdx + i + 1);
          pileCards[pileCards.length - 1].faceUp = true;
          newPiles[`tableau-${i}`] = { id: `tableau-${i}`, type: 'tableau', cards: pileCards };
          cardIdx += i + 1;
        }
        ['hearts', 'diamonds', 'clubs', 'spades'].forEach(suit => {
          newPiles[`foundation-${suit}`] = { id: `foundation-${suit}`, type: 'foundation', cards: [] };
        });
        newPiles['hand'] = { id: 'hand', type: 'hand', cards: [] };
        newPiles['deck'] = { id: 'deck', type: 'deck', cards: allCards.slice(cardIdx) };
        return { piles: newPiles };
      }
      return {};
    }
  },
  {
    id: 'excommunication',
    name: 'Excommunication',
    type: 'danger',
    description: 'No foundation plays allowed.',
    canMove: (cards, source, target) => target.type === 'foundation' ? false : undefined
  },
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    type: 'blessing',
    description: 'Choose ±1 rank for tableau plays.',
    canMove: (cards, source, target, defaultAllowed) => {
      if (defaultAllowed) return true;
      if (target.type === 'tableau' && cards.length > 0) {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (targetCard && targetCard.faceUp) {
          const isColorAlt = getCardColor(moving.suit) !== getCardColor(targetCard.suit);
          const isRankClose = Math.abs(targetCard.rank - moving.rank) === 1; 
          return isColorAlt && isRankClose;
        }
      }
      return defaultAllowed;
    }
  },
  {
    id: 'sycophant',
    name: 'Sycophant',
    type: 'blessing',
    description: 'Tableau plays ignore suit & rank then become correct card.',
    canMove: (cards, source, target, defaultAllowed) => {
      if (target.type === 'tableau' && target.cards.length > 0) return true;
      if (target.type === 'tableau' && target.cards.length === 0 && cards[0].rank === 13) return true;
      return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
      if (context.target.includes('tableau')) {
        const pile = state.piles[context.target];
        const anchorIndex = pile.cards.length - context.cards.length - 1;
        if (anchorIndex >= 0) {
          const anchorCard = pile.cards[anchorIndex];
          const movedCards = pile.cards.slice(anchorIndex + 1);
          const targetRank = (anchorCard.rank - 1) as Rank;
          const targetColor = getCardColor(anchorCard.suit) === 'red' ? 'black' : 'red';
          const targetSuit: Suit = targetColor === 'red' ? 'hearts' : 'spades';
          if (targetRank >= 1) {
             const transformedCard = { ...movedCards[0], rank: targetRank, suit: targetSuit };
             const newPileCards = [...pile.cards];
             newPileCards[anchorIndex + 1] = transformedCard;
             return { piles: { ...state.piles, [context.target]: { ...pile, cards: newPileCards } } };
          }
        }
      }
      return {};
    }
  },
  {
    id: 'vagrant',
    name: 'Vagrant',
    type: 'blessing',
    description: 'Tableau cards are always face up.',
    transformCardVisual: (card, pile) => pile?.type === 'tableau' ? { faceUp: true } : {}
  },
  {
    id: 'creative_accounting',
    name: 'Creative Accounting',
    type: 'exploit',
    description: 'On foundation complete, +50 coin.',
    calculateCoinTransaction: (delta, context, state) => {
      if (context.target.includes('foundation')) {
         const currentLen = state.piles[context.target].cards.length;
         if (currentLen + context.cards.length === 13) return delta + 50;
      }
      return delta;
    }
  },
  {
    id: 'stranglehold',
    name: 'Stranglehold',
    type: 'danger',
    description: 'No tableau play from tableau.',
    canMove: (cards, source, target) => (source.type === 'tableau' && target.type === 'tableau') ? false : undefined
  },
  {
    id: 'starving_artist',
    name: 'Starving Artist',
    type: 'curse',
    description: 'All plays -1 coin. Foundation completed +50 coin.',
    calculateCoinTransaction: (delta, context, state) => {
      let newDelta = delta - 1;
      if (context.target.includes('foundation')) {
        const currentLen = state.piles[context.target].cards.length;
        if (currentLen + context.cards.length === 13) newDelta += 50;
      }
      return newDelta;
    }
  },
  {
    id: 'schizophrenia',
    name: 'Schizophrenia',
    type: 'fear',
    description: 'Change face up card ranks per 5 plays.',
    onMoveComplete: (state) => {
      if (state.moves > 0 && state.moves % 5 === 0) {
         const newPiles = { ...state.piles };
         Object.keys(newPiles).forEach(key => {
           newPiles[key] = {
             ...newPiles[key],
             cards: newPiles[key].cards.map(c => c.faceUp ? { ...c, rank: Math.ceil(Math.random() * 13) as Rank } : c)
           };
         });
         return { piles: newPiles };
      }
      return {};
    }
  },
  {
    id: 'malocchio',
    name: 'Malocchio',
    type: 'curse',
    description: 'Foundation plays: 25% blocked, score 1x or 3x.',
    canMove: (cards, source, target, defaultAllowed) => {
       if (target.type === 'foundation' && Math.random() < 0.25) return false;
       return defaultAllowed;
    },
    calculateScore: (score, context) => context.target.includes('foundation') ? (Math.random() > 0.5 ? score * 3 : score) : score
  },
  {
    id: 'herding_cats',
    name: 'Herding Cats',
    type: 'danger',
    description: '33% for tableau plays to stumble to an adjacent pile.',
    interceptMove: (context, gameState) => {
      if (context.target.includes('tableau') && Math.random() < 0.33) {
        const currentIdx = parseInt(context.target.split('-')[1]);
        const possibleTargets = [];
        if (gameState.piles[`tableau-${currentIdx - 1}`]) possibleTargets.push(`tableau-${currentIdx - 1}`);
        if (gameState.piles[`tableau-${currentIdx + 1}`]) possibleTargets.push(`tableau-${currentIdx + 1}`);
        
        if (possibleTargets.length > 0) {
          const newTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
          return { target: newTarget };
        }
      }
      return {};
    }
  },
  {
    id: 'hyperfixation',
    name: 'Hyperfixation',
    type: 'fear',
    description: 'Discard costs 20 coin. Deck cycle costs 10% points.',
    onMoveComplete: (state, context) => {
      if (context.source === 'hand' && context.target === 'deck') {
        return { score: Math.floor(state.score * 0.9) };
      }
      return {};
    },
    calculateCoinTransaction: (delta, context) => {
       if (context.target === 'hand') return delta - 20;
       return delta;
    }
  },
  {
    id: 'mandatory_minimum',
    name: 'Mandatory Minimum',
    type: 'danger',
    description: 'Remove 2 cards per shuffle (Deck Cycle).',
    onMoveComplete: (state, context) => {
      if (context.source === 'hand' && context.target === 'deck') {
        const deckPile = state.piles['deck'];
        if (deckPile.cards.length > 2) {
          const newCards = [...deckPile.cards];
          newCards.splice(Math.floor(Math.random() * newCards.length), 1);
          newCards.splice(Math.floor(Math.random() * newCards.length), 1);
          return {
            piles: {
              ...state.piles,
              deck: { ...deckPile, cards: newCards }
            }
          };
        }
      }
      return {};
    }
  },
  {
    id: 'analysis_paralysis',
    name: 'Analysis Paralysis',
    type: 'curse',
    description: 'Foundation plays +10 coin but score zero.',
    calculateScore: (score, context) => context.target.includes('foundation') ? 0 : score,
    calculateCoinTransaction: (delta, context) => context.target.includes('foundation') ? delta + 10 : delta
  },
  {
    id: 'delusions_grandeur',
    name: 'Delusions of Grandeur',
    type: 'curse',
    description: 'Red tableau plays score 10pts, black tableau plays 0pts.',
    calculateScore: (score, context) => {
      if (context.target.includes('tableau')) {
        const isRed = context.cards[0].suit === 'hearts' || context.cards[0].suit === 'diamonds';
        return isRed ? 10 : 0;
      }
      return score;
    }
  },
  {
    id: 'deregulation',
    name: 'Deregulation',
    type: 'fear',
    description: 'Face down tableau shuffled per 12 plays.',
    onMoveComplete: (state) => {
      if (state.moves > 0 && state.moves % 12 === 0) {
        const newPiles = { ...state.piles };
        // Only shuffle standard tableau piles
        Object.keys(newPiles).forEach(pid => {
           if (pid.startsWith('tableau')) {
              const pile = newPiles[pid];
              const faceDown = pile.cards.filter(c => !c.faceUp);
              const faceUp = pile.cards.filter(c => c.faceUp);
              if (faceDown.length > 1) {
                 faceDown.sort(() => Math.random() - 0.5);
                 newPiles[pid] = { ...pile, cards: [...faceDown, ...faceUp] };
              }
           }
        });
        return { piles: newPiles };
      }
      return {};
    }
  },
  {
    id: 'ponzi_scheme',
    name: 'Ponzi Scheme',
    type: 'curse',
    description: 'Spade/Club plays -5 pts. If Black Foundation full, +10 for plays.',
    calculateScore: (score, context, gameState) => {
       const card = context.cards[0];
       const isBlack = card.suit === 'spades' || card.suit === 'clubs';
       let newScore = score;
       if (isBlack) newScore -= 5;
       
       const spadeFull = gameState.piles['foundation-spades']?.cards.length === 13;
       const clubFull = gameState.piles['foundation-clubs']?.cards.length === 13;
       if (spadeFull || clubFull) newScore += 10;
       return newScore;
    }
  },
  {
    id: 'ball_chain',
    name: 'Ball & Chain',
    type: 'fear',
    description: '50% chance tableau plays return to deck.',
    interceptMove: (context) => {
      if (context.target.includes('tableau') && Math.random() < 0.5) return { target: 'deck' };
      return {};
    }
  },
  {
    id: 'gluttony',
    name: 'Gluttony',
    type: 'curse',
    description: '3x coin gained, 2x coin costs.',
    calculateCoinTransaction: (delta) => {
       if (delta > 0) return delta * 3;
       if (delta < 0) return delta * 2;
       return delta;
    }
  },
  {
    id: 'forged_signature',
    name: 'Forged Signature',
    type: 'curse',
    description: 'Face cards wild on Tableau (0 score).',
    canMove: (cards, source, target, defaultAllowed) => {
       if (target.type === 'tableau' && cards.length > 0) {
          const rank = cards[0].rank;
          if (rank >= 11) return true;
       }
       return defaultAllowed;
    },
    calculateScore: (score, context) => {
       const rank = context.cards[0].rank;
       if (rank >= 11) return 0;
       return score;
    }
  },
  {
    id: 'annuit_coeptis',
    name: 'Annuit Coeptis',
    type: 'curse',
    description: 'Tableau plays -5 coin. Foundation plays +10 coin.',
    calculateCoinTransaction: (delta, context) => {
       if (context.target.includes('tableau')) return delta - 5;
       if (context.target.includes('foundation')) return delta + 10;
       return delta;
    }
  },
  {
    id: 'not_gaslighting',
    name: 'Not Gaslighting',
    type: 'danger',
    description: 'Change face up suit & rank per shuffle or discard.',
    onMoveComplete: (state, context) => {
       const isShuffle = context.source === 'hand' && context.target === 'deck';
       const isDiscard = context.target === 'hand';
       
       if (isShuffle || isDiscard) {
          const newPiles = { ...state.piles };
          Object.keys(newPiles).forEach(key => {
            newPiles[key] = {
              ...newPiles[key],
              cards: newPiles[key].cards.map(c => {
                if (c.faceUp) {
                  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
                  return { 
                    ...c, 
                    rank: Math.ceil(Math.random() * 13) as Rank,
                    suit: suits[Math.floor(Math.random() * 4)]
                  };
                }
                return c;
              })
            };
          });
          return { piles: newPiles };
       }
       return {};
    }
  },
  {
    id: 'malnourishment',
    name: 'Malnourishment',
    type: 'curse',
    description: '-25% points, 1.5x coins.',
    calculateScore: (score) => Math.floor(score * 0.75),
    calculateCoinTransaction: (delta) => Math.floor(delta * 1.5)
  },
  {
    id: 'sultan_of_swat',
    name: 'Sultan of Swat',
    type: 'danger',
    description: 'Hearts/Diamonds foundations locked until 20 cards in any foundation.',
    canMove: (cards, source, target, defaultAllowed, gameState) => {
      if (target.id === 'foundation-hearts' || target.id === 'foundation-diamonds') {
        let totalFoundationCards = 0;
        ['hearts', 'diamonds', 'clubs', 'spades'].forEach(s => {
          totalFoundationCards += gameState.piles[`foundation-${s}`]?.cards.length || 0;
        });
        if (totalFoundationCards < 20) return false;
      }
      return defaultAllowed;
    }
  },
  {
    id: 'identity_theft',
    name: 'Identity Theft',
    type: 'fear',
    description: 'Tableau 7 is permanently disabled (-1 Tableau).',
    canMove: (cards, source, target) => {
      if (target.id === 'tableau-6' || source.id === 'tableau-6') return false;
      return undefined;
    },
    transformCardVisual: (card, pile) => {
      if (pile?.id === 'tableau-6') return { faceUp: false }; // Hide them
      return {};
    }
  },
  {
    id: 'ignorance',
    name: 'Ignorance',
    type: 'danger',
    description: 'No Spades or Hearts interactions allowed.',
    canMove: (cards) => {
      if (cards.some(c => c.suit === 'spades' || c.suit === 'hearts')) return false;
      return undefined;
    },
    transformCardVisual: (card) => {
      if (card.suit === 'spades' || card.suit === 'hearts') {
        return { meta: { ...card.meta, disabled: true } };
      }
      return {};
    }
  },
  {
    id: 'collateral_damage',
    name: 'Collateral Damage',
    type: 'curse',
    description: 'Tableau plays flip adjacent tableau top card face-down.',
    onMoveComplete: (state, context) => {
      if (context.target.includes('tableau')) {
        const currentIdx = parseInt(context.target.split('-')[1]);
        const adjacentIdx = currentIdx + (Math.random() > 0.5 ? 1 : -1);
        const adjacentId = `tableau-${adjacentIdx}`;
        
        const pile = state.piles[adjacentId];
        if (pile && pile.cards.length > 0) {
           const newCards = [...pile.cards];
           const topCard = newCards[newCards.length - 1];
           newCards[newCards.length - 1] = { ...topCard, faceUp: false };
           return {
             piles: {
               ...state.piles,
               [adjacentId]: { ...pile, cards: newCards }
             }
           };
        }
      }
      return {};
    }
  },
  {
    id: 'caged_bakeneko',
    name: 'Caged Bakeneko',
    type: 'danger',
    description: '3 Tableaus locked. Find Keys in other cards to unlock.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       // We need to only lock existing tableaus
       const tabIds = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
       const lockedIds = tabIds.sort(() => 0.5 - Math.random()).slice(0, 3);
       
       lockedIds.forEach(id => {
         newPiles[id] = { ...newPiles[id], locked: true };
       });

       const deck = newPiles['deck'];
       const newDeckCards = deck.cards.map(c => {
         if (Math.random() < 0.2) return { ...c, meta: { ...c.meta, isKey: true } };
         return c;
       });
       newPiles['deck'] = { ...deck, cards: newDeckCards };

       return { piles: newPiles };
    },
    canMove: (cards, source, target) => {
       if (source.locked || target.locked) return false;
       return undefined;
    },
    onMoveComplete: (state, context) => {
      const revealedKey = context.cards.find(c => c.meta?.isKey);
      if (revealedKey) {
        const lockedPiles = Object.values(state.piles).filter(p => p.locked && p.type === 'tableau');
        if (lockedPiles.length > 0) {
           const toUnlock = lockedPiles[0];
           const newPiles = { ...state.piles };
           newPiles[toUnlock.id] = { ...toUnlock, locked: false };
           return { piles: newPiles };
        }
      }
      return {};
    },
    transformCardVisual: (card) => {
       if (card.meta?.isKey && card.faceUp) return { meta: { ...card.meta, showKey: true } };
       return {};
    }
  },
  {
    id: 'endless_hunger',
    name: 'Endless Hunger',
    type: 'fear',
    description: 'Tableau plays -5 coin.',
    calculateCoinTransaction: (delta, context) => {
      if (context.target.includes('tableau')) return delta - 5;
      return delta;
    }
  },
  {
    id: 'panopticon',
    name: 'Panopticon',
    type: 'fear',
    description: '25% chance revealed cards are locked (Pay 10 to unlock).',
    onMoveComplete: (state, context) => {
       const sourceId = context.source;
       const pile = state.piles[sourceId];
       if (pile && pile.type === 'tableau') {
          const top = pile.cards[pile.cards.length - 1];
          if (top && top.faceUp && !top.meta?.locked && Math.random() < 0.25) {
             const newCards = [...pile.cards];
             newCards[newCards.length - 1] = { ...top, meta: { ...top.meta, locked: true } };
             return { piles: { ...state.piles, [sourceId]: { ...pile, cards: newCards } } };
          }
       }
       return {};
    },
    canMove: (cards) => {
       if (cards.some(c => c.meta?.locked)) return false;
       return undefined;
    },
    transformCardVisual: (card) => {
       if (card.meta?.locked) return { meta: { ...card.meta, showLock: true } };
       return {};
    }
  },
  {
    id: 'alchemist',
    name: 'Alchemist',
    type: 'blessing',
    description: 'Swap scoring: Points become Coins, Coins become Points.',
    calculateScore: (score, context, state) => {
      return 0;
    },
    calculateCoinTransaction: (delta, context) => {
      if (context.target.includes('foundation')) return delta + 10;
      return delta;
    }
  },
  {
    id: 'cooked_books',
    name: 'Cooked Books',
    type: 'fear',
    description: 'Lose points equal to coins gained.',
    calculateScore: (score, context, state) => {
      return score; 
    },
    onMoveComplete: (state, context) => {
       if (context.target.includes('foundation')) {
          return { score: state.score - 10 };
       }
       return {};
    }
  },
  {
    id: 'gerrymandering',
    name: 'Gerrymandering',
    type: 'fear',
    description: '-2 Tableau (Tableau 5 & 6 disabled).',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       if(newPiles['tableau-5']) newPiles['tableau-5'] = { ...newPiles['tableau-5'], locked: true };
       if(newPiles['tableau-6']) newPiles['tableau-6'] = { ...newPiles['tableau-6'], locked: true };
       return { piles: newPiles };
    },
    canMove: (cards, source, target) => {
       if (source.id === 'tableau-5' || source.id === 'tableau-6' || target.id === 'tableau-5' || target.id === 'tableau-6') return false;
       return undefined;
    },
    transformCardVisual: (card, pile) => {
       if (pile?.id === 'tableau-5' || pile?.id === 'tableau-6') return { faceUp: false };
       return {};
    }
  },
  {
    id: 'schemer',
    name: 'Schemer',
    type: 'blessing',
    description: 'You can play from foundations to tableau.',
    canMove: (cards, source, target, defaultAllowed) => {
       if (source.type === 'foundation' && target.type === 'tableau') {
          const moving = cards[0];
          const targetCard = target.cards[target.cards.length - 1];
          if (!targetCard) return moving.rank === 13;
          return (getCardColor(moving.suit) !== getCardColor(targetCard.suit) && targetCard.rank === moving.rank + 1);
       }
       return defaultAllowed;
    }
  },
  {
    id: 'russian_roulette',
    name: 'Russian Roulette',
    type: 'fear',
    description: '20% chance foundation plays remove 1 card from deck.',
    onMoveComplete: (state, context) => {
       if (context.target.includes('foundation')) {
          if (Math.random() < 0.2) {
             const deck = state.piles['deck'];
             if (deck.cards.length > 0) {
                const newCards = [...deck.cards];
                newCards.pop(); 
                return { piles: { ...state.piles, deck: { ...deck, cards: newCards } } };
             }
          }
       }
       return {};
    }
  },
  {
    id: 'mood_swings',
    name: 'Mood Swings',
    type: 'fear',
    description: 'Every 5 plays, odd or even ranks score 0 points.',
    calculateScore: (score, context, state) => {
       const phase = Math.floor(state.moves / 5);
       const isOddPhase = phase % 2 === 0; 
       const rank = context.cards[0].rank;
       
       if (isOddPhase) {
          if (rank % 2 !== 0) return 0;
       } else {
          if (rank % 2 === 0) return 0;
       }
       return score;
    }
  },
  {
    id: 'switcheroo',
    name: 'Switcheroo',
    type: 'fear',
    description: 'Shuffle all face-up tableau cards on deck cycle.',
    onMoveComplete: (state, context) => {
      if (context.source === 'hand' && context.target === 'deck') {
         let faceUpCards: Card[] = [];
         let tableauConfigs: { id: string, count: number }[] = [];
         
         // Dynamic tableau scan
         Object.keys(state.piles).filter(k => k.startsWith('tableau')).forEach(pileId => {
            const pile = state.piles[pileId];
            const visible = pile.cards.filter(c => c.faceUp);
            faceUpCards = [...faceUpCards, ...visible];
            tableauConfigs.push({ id: pileId, count: visible.length });
         });
         
         faceUpCards.sort(() => Math.random() - 0.5);
         
         const newPiles = { ...state.piles };
         let currentCardIdx = 0;
         
         tableauConfigs.forEach(config => {
            const pile = newPiles[config.id];
            const faceDown = pile.cards.filter(c => !c.faceUp);
            const newFaceUp = faceUpCards.slice(currentCardIdx, currentCardIdx + config.count);
            currentCardIdx += config.count;
            newPiles[config.id] = { ...pile, cards: [...faceDown, ...newFaceUp] };
         });
         
         return { piles: newPiles };
      }
      return {};
    }
  },
  {
    id: 'one_armed_bandit',
    name: 'One-Armed Bandit',
    type: 'fear',
    description: 'Playing 7s triggers a slot machine (Win/Loss coins).',
    onMoveComplete: (state, context) => {
       if (context.cards[0].rank === 7) {
          const roll = Math.random();
          let coinDelta = 0;
          if (roll < 0.33) coinDelta = 50; 
          else if (roll < 0.66) coinDelta = 10; 
          else coinDelta = -30; 
          
          return { coins: state.coins + coinDelta };
       }
       return {};
    }
  },
  {
    id: 'veil_uncertainty',
    name: 'Veil of Uncertainty',
    type: 'curse',
    description: 'No foundations. Tableau plays 4x points.',
    canMove: (cards, source, target) => target.type === 'foundation' ? false : undefined,
    calculateScore: (score, context) => context.target.includes('tableau') ? score * 4 : score
  },
  {
    id: 'impersonator',
    name: 'Impersonator',
    type: 'blessing',
    description: 'Tableau allows same-color stacking (Red on Red).',
    canMove: (cards, source, target, defaultAllowed) => {
       if (target.type === 'tableau' && cards.length > 0) {
          const targetCard = target.cards[target.cards.length - 1];
          if (targetCard && targetCard.faceUp) {
             if (targetCard.rank === cards[0].rank + 1) return true;
          }
       }
       return defaultAllowed;
    }
  },
  {
    id: 'martial_law',
    name: 'Martial Law',
    type: 'exploit',
    description: 'Kings pretend to be Queens (Allow Jacks on Kings, Kings on Kings).',
    canMove: (cards, source, target, defaultAllowed) => {
      const moving = cards[0];
      if (target.type === 'tableau' && target.cards.length > 0) {
        const targetCard = target.cards[target.cards.length - 1];
        if (targetCard.rank === 13 && targetCard.faceUp) {
           if (moving.rank === 11 && getCardColor(moving.suit) !== getCardColor(targetCard.suit)) return true;
           if (moving.rank === 13 && getCardColor(moving.suit) !== getCardColor(targetCard.suit)) return true;
        }
      }
      return defaultAllowed;
    },
  },
  {
    id: 'counting_cards',
    name: 'Counting Cards',
    type: 'exploit',
    description: 'Face cards & Aces are always face up.',
    transformCardVisual: (card) => {
      if (card.rank === 1 || card.rank >= 11) return { faceUp: true };
      return {};
    }
  },
  {
    id: 'path_least_resistance',
    name: 'Path of Least Resistance',
    type: 'exploit',
    description: 'Foundation plays +15 pts.',
    calculateScore: (score, context) => context.target.includes('foundation') ? score + 15 : score
  },
  {
    id: 'gift_gab',
    name: 'Gift of Gab',
    type: 'exploit',
    description: 'Each reveal +10 coin.',
    onMoveComplete: (state, context) => {
      if (context.source.includes('tableau')) {
         const pile = state.piles[context.source];
         if (pile.cards.length > 0) {
            const newTop = pile.cards[pile.cards.length - 1];
            if (newTop.faceUp && !newTop.meta?.scoredGift) {
               return { coins: state.coins + 10 };
            }
         }
      }
      return {};
    }
  },
  {
    id: 'prick_conscience',
    name: 'Prick of Conscience',
    type: 'curse',
    description: 'Tableau plays -10 points, foundation plays +30 points.',
    calculateScore: (score, context) => {
      if (context.target.includes('tableau')) return score - 10;
      if (context.target.includes('foundation')) return score + 30;
      return score; 
    }
  },
  {
    id: 'eat_the_rich',
    name: 'Eat the Rich',
    type: 'fear',
    description: 'Encounter start, tableau have equal cards (4 each).',
    onActivate: (state) => {
       let allTableauCards: Card[] = [];
       // Gather from all active tableaus
       Object.keys(state.piles).filter(k => k.startsWith('tableau')).forEach(key => {
          allTableauCards = [...allTableauCards, ...state.piles[key].cards];
       });
       
       const count = allTableauCards.length;
       const activeTableaus = Object.keys(state.piles).filter(k => k.startsWith('tableau'));
       const numTableaus = activeTableaus.length;
       
       const perPile = Math.floor(count / numTableaus);
       let remainder = count % numTableaus;
       
       const newPiles = { ...state.piles };
       let cardIdx = 0;
       
       activeTableaus.forEach(key => {
          const take = perPile + (remainder > 0 ? 1 : 0);
          remainder--;
          const chunk = allTableauCards.slice(cardIdx, cardIdx + take);
          cardIdx += take;
          const newChunk = chunk.map((c, idx) => ({ ...c, faceUp: idx === chunk.length - 1 }));
          newPiles[key] = { ...newPiles[key], cards: newChunk };
       });
       return { piles: newPiles };
    }
  },
  {
    id: 'doppelganger',
    name: 'Doppelgänger',
    type: 'danger',
    description: '10 deck cards are fake (0 pts).',
    onActivate: (state) => {
       const deck = state.piles['deck'];
       const indexes = new Set<number>();
       while(indexes.size < 10 && indexes.size < deck.cards.length) {
         indexes.add(Math.floor(Math.random() * deck.cards.length));
       }
       const newCards = deck.cards.map((c, i) => indexes.has(i) ? { ...c, meta: { ...c.meta, isFake: true } } : c);
       return { piles: { ...state.piles, deck: { ...deck, cards: newCards } } };
    },
    calculateScore: (score, context) => {
       if (context.cards.some(c => c.meta?.isFake)) return 0;
       return score;
    },
    transformCardVisual: (card) => {
       if (card.meta?.isFake && card.faceUp) return { meta: { ...card.meta, showFake: true } };
       return {};
    }
  },
  {
    id: 'beginners_luck',
    name: "Beginner's Luck",
    type: 'exploit',
    description: '+15 points if drawn card is played immediately.',
    calculateScore: (score, context, state) => {
       if (context.cards.length === 1 && context.cards[0].id === state.effectState.lastDrawnCardId) {
         return score + 15;
       }
       return score;
    },
    onMoveComplete: (state) => {
       return { effectState: { ...state.effectState, lastDrawnCardId: null } };
    }
  },
  {
    id: 'destitution',
    name: 'Destitution',
    type: 'curse',
    description: 'Merge foundations by color (Hearts on Diamonds). -50% points.',
    canMove: (cards, source, target, defaultAllowed) => {
       if (target.type === 'foundation' && cards.length === 1) {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          if (!top) return moving.rank === 1; 
          if (getCardColor(moving.suit) === getCardColor(top.suit) && moving.rank === top.rank + 1) return true;
       }
       return defaultAllowed;
    },
    calculateScore: (score, context) => {
       if (context.target.includes('foundation')) return Math.floor(score * 0.5);
       return score;
    }
  },
  {
    id: 'diplomatic_immunity',
    name: 'Diplomatic Immunity',
    type: 'exploit',
    description: 'Just-revealed cards ignore rank requirements.',
    canMove: (cards, source, target, defaultAllowed, state) => {
       if (cards.length > 0 && cards[0].id === state.effectState.justRevealedCardId) {
          if (target.type === 'tableau') return true;
       }
       return defaultAllowed;
    },
    onMoveComplete: (state) => {
       return { effectState: { ...state.effectState, justRevealedCardId: null } };
    }
  },
  {
    id: 'insomnia',
    name: 'Insomnia',
    type: 'curse',
    description: 'Deck cycle costs 50% of current score.',
    onMoveComplete: (state, context) => {
       if (context.source === 'hand' && context.target === 'deck') {
          return { score: Math.floor(state.score * 0.5) };
       }
       return {};
    }
  },
  {
    id: 'moon_toad_cheeks',
    name: 'Moon Toad Cheeks',
    type: 'curse',
    description: '1 Foundation missing. Others give x2 rewards.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
       const randomSuit = suits[Math.floor(Math.random() * 4)];
       newPiles[`foundation-${randomSuit}`] = { ...newPiles[`foundation-${randomSuit}`], locked: true };
       return { piles: newPiles };
    },
    canMove: (cards, source, target) => {
       if (target.locked && target.type === 'foundation') return false;
       return undefined;
    },
    calculateScore: (score, context, state) => {
       if (context.target.includes('foundation') && !state.piles[context.target].locked) return score * 2;
       return score;
    },
    calculateCoinTransaction: (delta, context, state) => {
       if (context.target.includes('foundation') && !state.piles[context.target].locked) return delta * 2;
       return delta;
    }
  },
  {
    id: 'hoarder',
    name: 'Hoarder',
    type: 'blessing',
    description: 'Consecutive suit plays +100% points.',
    calculateScore: (score, context, state) => {
       if (context.cards[0].suit === state.effectState.lastPlayedSuit) return score * 2;
       return score;
    },
    onMoveComplete: (state, context) => {
       return { effectState: { ...state.effectState, lastPlayedSuit: context.cards[0].suit } };
    }
  },
  {
    id: 'charlatan',
    name: 'Charlatan',
    type: 'blessing',
    description: 'Reverse build order (Ascending Tableau).',
    canMove: (cards, source, target, defaultAllowed) => {
       if (target.type === 'tableau' && cards.length > 0) {
          const moving = cards[0];
          const top = target.cards[target.cards.length - 1];
          if (top) {
             const isColorAlt = getCardColor(moving.suit) !== getCardColor(top.suit);
             if (isColorAlt && top.rank === moving.rank - 1) return true;
             if (isColorAlt && top.rank === moving.rank + 1) return false; 
          }
       }
       return defaultAllowed;
    }
  },
  {
    id: 'weighted_dice',
    name: 'Weighted Dice',
    type: 'exploit',
    description: 'Start with A-3 in foundations.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
       
       const extractCards = (rankLimit: number) => {
          let moved: Card[] = [];
          Object.keys(newPiles).forEach(pid => {
             if (newPiles[pid].type === 'foundation') return;
             newPiles[pid].cards = newPiles[pid].cards.filter(c => {
                if (c.rank <= rankLimit) {
                   moved.push(c);
                   return false;
                }
                return true;
             });
          });
          return moved;
       };

       const earlyCards = extractCards(3); 
       
       suits.forEach(suit => {
          const suitCards = earlyCards.filter(c => c.suit === suit).sort((a,b) => a.rank - b.rank);
          const readyCards = suitCards.map(c => ({ ...c, faceUp: true }));
          newPiles[`foundation-${suit}`].cards = [...newPiles[`foundation-${suit}`].cards, ...readyCards];
       });

       return { piles: newPiles };
    }
  },
  {
    id: 'functional_alcoholic',
    name: 'Functional Alcoholic',
    type: 'fear',
    description: '30% stumble random, success 2x.',
    interceptMove: (context, gameState) => {
       if (Math.random() < 0.3) {
          const randomTableau = `tableau-${Math.floor(Math.random() * 7)}`;
          return { target: randomTableau };
       }
       return {};
    },
    calculateScore: (score) => score * 2 
  },
  {
    id: 'angel_investor',
    name: 'Angel Investor',
    type: 'exploit',
    description: 'When four Jacks face up, +100 coin.',
    onMoveComplete: (state) => {
       if (state.effectState.angelInvestorPaid) return {};
       let visibleJacks = 0;
       Object.values(state.piles).forEach(pile => {
          pile.cards.forEach(c => {
             if (c.faceUp && c.rank === 11) visibleJacks++;
          });
       });
       if (visibleJacks >= 4) {
          return { 
             coins: state.coins + 100,
             effectState: { ...state.effectState, angelInvestorPaid: true }
          };
       }
       return {};
    }
  },
  {
    id: 'bag_of_holding',
    name: 'Bag of Holding',
    type: 'exploit',
    description: 'On encounter start, deal +2 cards to tableau.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       const deck = newPiles['deck'];
       if (deck.cards.length < 14) return {}; 
       const extraCards = deck.cards.slice(0, 14);
       const remainingDeck = deck.cards.slice(14);
       newPiles['deck'] = { ...deck, cards: remainingDeck };
       for(let i=0; i<7; i++) {
          const pair = extraCards.slice(i*2, i*2 + 2);
          const pile = newPiles[`tableau-${i}`];
          const readyPair = pair.map(c => ({...c, faceUp: true}));
          newPiles[`tableau-${i}`] = { ...pile, cards: [...pile.cards, ...readyPair] };
       }
       return { piles: newPiles };
    }
  },
  {
    id: 'sleight_of_hand',
    name: 'Sleight of Hand',
    type: 'exploit',
    description: 'Gain 3 coin for every 2 lost.',
    calculateCoinTransaction: (delta) => {
       if (delta < 0) {
          const loss = Math.abs(delta);
          const rebate = Math.floor(loss / 2) * 3;
          return delta + rebate;
       }
       return delta;
    }
  },
  {
    id: 'street_smarts',
    name: 'Street Smarts',
    type: 'exploit',
    description: 'Pay 25 coins per locked tableau to unlock.',
  },
  {
    id: 'rules_of_3',
    name: '3 Rules of 3',
    type: 'danger',
    description: '3rd card play removes 3 cards from deck.',
    onMoveComplete: (state, context) => {
       if (context.source === 'deck' || context.source === 'hand') return {};
       const currentCounter = (state.effectState.ruleOf3Counter || 0) + 1;
       if (currentCounter >= 3) {
          const deck = state.piles['deck'];
          if (deck.cards.length > 0) {
             const newCards = deck.cards.slice(0, -3); 
             return {
                piles: { ...state.piles, deck: { ...deck, cards: newCards } },
                effectState: { ...state.effectState, ruleOf3Counter: 0 }
             };
          }
          return { effectState: { ...state.effectState, ruleOf3Counter: 0 } };
       }
       return { effectState: { ...state.effectState, ruleOf3Counter: currentCounter } };
    }
  },
  {
    id: 'schrodingers_deck',
    name: "Schrödinger's Deck",
    type: 'danger',
    description: 'Tableau piles randomly fall in & out of dimension.',
    onMoveComplete: (state) => {
       if (Math.random() < 0.2) {
          const randIdx = Math.floor(Math.random() * 7);
          const pileId = `tableau-${randIdx}`;
          const pile = state.piles[pileId];
          const isHidden = !pile.hidden;
          return { piles: { ...state.piles, [pileId]: { ...pile, hidden: isHidden } } };
       }
       return {};
    },
    canMove: (cards, source, target) => {
       if (source.hidden || target.hidden) return false;
       return undefined;
    },
    transformCardVisual: (card, pile) => {
       if (pile?.hidden) return { meta: { ...card.meta, hiddenDimension: true } };
       return {};
    }
  },
  {
    id: 'five_finger_discount',
    name: 'Five-Finger Discount',
    type: 'exploit',
    description: 'Draw 5 cards at once from deck.',
  },
  {
    id: 'legitimate_business',
    name: 'Legitimate Business',
    type: 'exploit',
    description: 'Convert 50 pts to 150 coin automatically.',
    onMoveComplete: (state) => {
       if (state.score >= 50) {
          return { score: state.score - 50, coins: state.coins + 150 };
       }
       return {};
    }
  },
  {
    id: 'liquid_assets',
    name: 'Liquid Assets',
    type: 'exploit',
    description: 'Convert 50 coin to 25 pts automatically.',
    onMoveComplete: (state) => {
       if (state.coins >= 50) {
          return { score: state.score + 25, coins: state.coins - 50 };
       }
       return {};
    }
  },
  {
    id: 'fountain_youth',
    name: 'Fountain of Youth',
    type: 'blessing',
    description: 'Reshuffle all foundations back into deck.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       let returnedCards: Card[] = [];
       ['hearts', 'diamonds', 'clubs', 'spades'].forEach(s => {
          const fCards = newPiles[`foundation-${s}`].cards;
          returnedCards = [...returnedCards, ...fCards];
          newPiles[`foundation-${s}`].cards = [];
       });
       
       const deck = newPiles['deck'];
       const combined = [...deck.cards, ...returnedCards.map(c => ({ ...c, faceUp: false }))];
       combined.sort(() => Math.random() - 0.5);
       newPiles['deck'] = { ...deck, cards: combined };
       
       return { piles: newPiles };
    }
  },
  {
    id: 'clever_disguise',
    name: 'Clever Disguise',
    type: 'fear',
    description: 'Foundation score is Blackjack hand (0-21). Bust = 0.',
    calculateScore: (score, context) => {
       if (context.target.includes('foundation')) {
          const hand = Math.floor(Math.random() * 10) + 17; 
          if (hand > 21) return 0;
          return 21; 
       }
       return score;
    }
  },
  {
    id: 'nepotism',
    name: 'Nepotism',
    type: 'exploit',
    description: 'Queen played to empty tableau summons a wild Ace.',
    onMoveComplete: (state, context) => {
       if (context.target.includes('tableau')) {
          const pile = state.piles[context.target];
          if (pile.cards.length === 1) {
             const playedCard = pile.cards[0];
             if (playedCard.rank === 12) { 
                const wildAce: Card = {
                   id: `summoned-ace-${Math.random()}`,
                   rank: 1,
                   suit: playedCard.suit,
                   faceUp: true,
                   meta: { summoned: true, isWild: true }
                };
                return { 
                   piles: {
                      ...state.piles,
                      [context.target]: { ...pile, cards: [...pile.cards, wildAce] }
                   }
                };
             }
          }
       }
       return {};
    }
  },
  {
    id: 'insider_trading',
    name: 'Insider Trading',
    type: 'exploit',
    description: 'Spend 50 points to unlock a locked foundation.',
  },
  {
    id: 'daruma_karma',
    name: 'Daruma Karma',
    type: 'exploit',
    description: 'Choose a lucky suit. Foundation plays of that suit x3 points.',
    onActivate: (state) => {
       const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
       const lucky = suits[Math.floor(Math.random() * 4)];
       return { effectState: { ...state.effectState, darumaSuit: lucky } };
    },
    calculateScore: (score, context, state) => {
       if (context.target.includes('foundation') && context.cards[0].suit === state.effectState.darumaSuit) {
          return score * 3;
       }
       return score;
    }
  },
  {
    id: 'pedant',
    name: 'Pedant',
    type: 'blessing',
    description: 'Every 10 foundation plays, +1 tableau pile.',
    onMoveComplete: (state, context) => {
       if (context.target.includes('foundation')) {
          const counter = (state.effectState.pedantCounter || 0) + 1;
          if (counter >= 10) {
             const newPileId = `tableau-${Object.keys(state.piles).filter(k => k.startsWith('tableau')).length}`;
             const newPile: Pile = { id: newPileId, type: 'tableau', cards: [] };
             return {
                piles: { ...state.piles, [newPileId]: newPile },
                effectState: { ...state.effectState, pedantCounter: 0 }
             };
          }
          return { effectState: { ...state.effectState, pedantCounter: counter } };
       }
       return {};
    }
  },
  {
    id: 'wizard',
    name: 'Wizard',
    type: 'blessing',
    description: 'Every 10 tableau plays, +1 foundation pile.',
    onMoveComplete: (state, context) => {
       if (context.target.includes('tableau')) {
          const counter = (state.effectState.wizardCounter || 0) + 1;
          if (counter >= 10) {
             const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
             const randomSuit = suits[Math.floor(Math.random() * 4)];
             const count = Object.keys(state.piles).filter(k => k.startsWith('foundation')).length;
             const newPileId = `foundation-${randomSuit}-extra-${count}`;
             const newPile: Pile = { id: newPileId, type: 'foundation', cards: [] };
             
             return {
                piles: { ...state.piles, [newPileId]: newPile },
                effectState: { ...state.effectState, wizardCounter: 0 }
             };
          }
          return { effectState: { ...state.effectState, wizardCounter: counter } };
       }
       return {};
    }
  },
  {
    id: 'golden_parachute',
    name: 'Golden Parachute',
    type: 'exploit',
    description: 'When four 6s face up, +200 coin.',
    onMoveComplete: (state) => {
       if (state.effectState.goldenParachutePaid) return {};
       let visible6s = 0;
       Object.values(state.piles).forEach(pile => {
          pile.cards.forEach(c => {
             if (c.faceUp && c.rank === 6) visible6s++;
          });
       });
       if (visible6s >= 4) {
          return { 
             coins: state.coins + 200,
             effectState: { ...state.effectState, goldenParachutePaid: true }
          };
       }
       return {};
    }
  },
  {
    id: 'predatory_lending',
    name: 'Predatory Lending',
    type: 'curse',
    description: 'Stake all coins. If you earn back stake, 3x return.',
    onActivate: (state) => {
       const currentCoins = state.coins;
       if (currentCoins <= 0) return {};
       return { 
          coins: 0, 
          effectState: { ...state.effectState, loanPrincipal: currentCoins, loanActive: true } 
       };
    },
    onMoveComplete: (state) => {
       if (state.effectState.loanActive && state.coins >= state.effectState.loanPrincipal) {
          return {
             coins: state.coins + (state.effectState.loanPrincipal * 2), // Total 3x (kept current + 2x bonus)
             effectState: { ...state.effectState, loanActive: false, loanPrincipal: 0 }
          };
       }
       return {};
    }
  },
  {
    id: 'slush_fund',
    name: 'Slush Fund',
    type: 'exploit',
    description: 'Go into debt up to 200 coins.',
    // Logic handled in canAfford helper
  },
  {
    id: 'thief',
    name: 'Thief',
    type: 'blessing',
    description: 'Move buried face-up cards to Hand.',
    canMove: (cards, source, target, defaultAllowed) => {
       // Thief special move: Tableau -> Hand
       if (source.type === 'tableau' && target.type === 'hand' && cards.length === 1) {
          return true;
       }
       return defaultAllowed;
    }
  },
  {
    id: 'flesh_wound',
    name: 'Flesh Wound',
    type: 'curse',
    description: 'Adds Wound to Hand & Bandage to Deck. Find Bandage for +50 coins.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       
       // Add Wound to Hand
       const woundCard: Card = { id: 'quest-wound', rank: 0, suit: 'special', faceUp: true, meta: { isWound: true } };
       newPiles['hand'].cards = [...newPiles['hand'].cards, woundCard];

       // Add Bandage to Deck (Shuffled)
       const bandageCard: Card = { id: 'quest-bandage', rank: 0, suit: 'special', faceUp: false, meta: { isBandage: true } };
       const deckCards = [...newPiles['deck'].cards, bandageCard];
       deckCards.sort(() => Math.random() - 0.5);
       newPiles['deck'].cards = deckCards;

       return { piles: newPiles };
    },
    onMoveComplete: (state, context) => {
       // Check if Bandage was drawn/revealed
       // If it moves from Deck -> Hand
       const bandage = context.cards.find(c => c.meta?.isBandage);
       if (bandage && context.source === 'deck') {
          return { coins: state.coins + 50 };
       }
       return {};
    },
    transformCardVisual: (card) => {
       if (card.meta?.isWound) return { meta: { ...card.meta, showWound: true } };
       if (card.meta?.isBandage && card.faceUp) return { meta: { ...card.meta, showBandage: true } };
       return {};
    }
  },
  {
    id: 'quintessence',
    name: 'Quintessence',
    type: 'exploit',
    description: '+2 foundations.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       // Just add 2 blank foundations
       const count = Object.keys(state.piles).filter(k => k.startsWith('foundation')).length;
       newPiles[`foundation-extra-${count}`] = { id: `foundation-extra-${count}`, type: 'foundation', cards: [] };
       newPiles[`foundation-extra-${count+1}`] = { id: `foundation-extra-${count+1}`, type: 'foundation', cards: [] };
       return { piles: newPiles };
    }
  },
  {
    id: 'jester',
    name: 'Jester',
    type: 'blessing',
    description: 'Add 1 wild card to your hand.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       const wildCard: Card = { id: `jester-${Math.random()}`, rank: 0, suit: 'special', faceUp: true, meta: { isWild: true } };
       // Add to Hand
       newPiles['hand'].cards = [...newPiles['hand'].cards, wildCard];
       return { piles: newPiles };
    },
    canMove: (cards, source, target, defaultAllowed) => {
       if (cards.length === 1 && cards[0].meta?.isWild) return true;
       return defaultAllowed;
    },
    transformCardVisual: (card) => {
       if (card.meta?.isWild) return { meta: { ...card.meta, showWild: true } };
       return {};
    }
  },
  {
    id: 'oracle',
    name: 'Oracle',
    type: 'blessing',
    description: 'Shuffle suits in deck or tableau.',
    onActivate: (state) => {
       // Randomize suits of all face down cards in Deck?
       // Or randomize suits of ALL cards? "Shuffle suits in deck".
       const newPiles = { ...state.piles };
       const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
       
       newPiles['deck'].cards = newPiles['deck'].cards.map(c => ({
          ...c,
          suit: suits[Math.floor(Math.random() * 4)]
       }));
       
       return { piles: newPiles };
    }
  },
  {
    id: 'rose_colored_glasses',
    name: 'Rose Colored Glasses',
    type: 'exploit',
    description: 'When three 7s face up, wager coins & spin to win x3.',
    onMoveComplete: (state) => {
       // Check if logic already triggered
       // Simplified: Auto-wager 10 coins
       let visible7s = 0;
       Object.values(state.piles).forEach(pile => {
          pile.cards.forEach(c => {
             if (c.faceUp && c.rank === 7) visible7s++;
          });
       });
       
       if (visible7s >= 3 && !state.effectState.roseGlassesTriggered) {
          // Wager 10
          const wager = 10;
          if (state.coins >= wager) {
             const win = Math.random() > 0.5;
             return {
                coins: state.coins - wager + (win ? wager * 3 : 0),
                effectState: { ...state.effectState, roseGlassesTriggered: true }
             };
          }
       }
       return {};
    }
  },
  {
    id: 'counterfeiting',
    name: 'Counterfeiting',
    type: 'curse',
    description: 'Next card becomes correct suit & rank.',
    canMove: (cards, source, target, defaultAllowed, state) => {
       // Always allow if active?
       if (state.effectState.counterfeitingActive) return true;
       return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
       // If active, transform the moved card to match target top
       if (state.effectState.counterfeitingActive) {
          const pile = state.piles[context.target];
          // Get card below the one we just moved
          const newCardIdx = pile.cards.length - 1;
          const anchorIdx = newCardIdx - 1;
          
          if (anchorIdx >= 0) {
             const anchor = pile.cards[anchorIdx];
             const newCard = pile.cards[newCardIdx];
             
             // Transform newCard to be valid below anchor
             // e.g. Rank - 1, Opposite Color
             const targetRank = (anchor.rank - 1) as Rank;
             const targetColor = getCardColor(anchor.suit) === 'red' ? 'black' : 'red';
             const targetSuit: Suit = targetColor === 'red' ? 'hearts' : 'spades';
             
             if (targetRank >= 1) {
                const fixedCard = { ...newCard, rank: targetRank, suit: targetSuit };
                const newCards = [...pile.cards];
                newCards[newCardIdx] = fixedCard;
                
                return {
                   piles: { ...state.piles, [context.target]: { ...pile, cards: newCards } },
                   effectState: { ...state.effectState, counterfeitingActive: false }
                };
             }
          }
          return { effectState: { ...state.effectState, counterfeitingActive: false } };
       }
       return {};
    },
    onActivate: (state) => {
       return { effectState: { ...state.effectState, counterfeitingActive: true } };
    }
  },
  {
    id: 'venture_capitol',
    name: 'Venture Capitol',
    type: 'exploit',
    description: 'Drag Tableau card to Hand to sell for coins (Rank value).',
    canMove: (cards, source, target, defaultAllowed) => {
       // Tableau -> Hand (Selling)
       if (source.type === 'tableau' && target.type === 'hand' && cards.length === 1) {
          return true;
       }
       return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
       if (context.source.includes('tableau') && context.target === 'hand') {
          // Sells for rank value (1-13)
          const value = context.cards[0].rank;
          // Card is moved to hand by default logic, we just add coins
          return { coins: state.coins + value };
       }
       return {};
    }
  },
  {
    id: 'esrevinu_etanretla',
    name: 'Esrevinu Etanretla',
    type: 'epic',
    description: 'Mirror Rules: Tableau builds UP, Foundation builds DOWN.',
    canMove: (cards, source, target, defaultAllowed) => {
       const moving = cards[0];
       
       if (target.type === 'tableau' && target.cards.length > 0) {
          const targetCard = target.cards[target.cards.length - 1];
          // Standard: Rank - 1. Reverse: Rank + 1.
          // Also still Alt Color
          if (targetCard.faceUp) {
             const isColorAlt = getCardColor(moving.suit) !== getCardColor(targetCard.suit);
             if (isColorAlt && moving.rank === targetCard.rank + 1) return true; 
             // Block standard if we want strict reversal? The prompt implies "Mirror rules".
             if (isColorAlt && moving.rank === targetCard.rank - 1) return false;
          }
       }
       
       if (target.type === 'foundation') {
          const targetCard = target.cards[target.cards.length - 1];
          // Standard: Rank + 1. Reverse: Rank - 1.
          // Start foundation with Kings?
          if (targetCard) {
             if (moving.suit === targetCard.suit && moving.rank === targetCard.rank - 1) return true;
             if (moving.suit === targetCard.suit && moving.rank === targetCard.rank + 1) return false;
          } else {
             // Empty foundation takes King (13) instead of Ace (1)
             if (moving.rank === 13) return true;
             if (moving.rank === 1) return false;
          }
       }
       
       return defaultAllowed;
    }
  },
  {
    id: 'compound_interest',
    name: 'Compound Interest',
    type: 'rare',
    description: 'When four 8s face up, +500 points.',
    onMoveComplete: (state) => {
       if (state.effectState.compoundInterestPaid) return {};
       let visible8s = 0;
       Object.values(state.piles).forEach(pile => {
          pile.cards.forEach(c => {
             if (c.faceUp && c.rank === 8) visible8s++;
          });
       });
       if (visible8s >= 4) {
          return { 
             score: state.score + 500,
             effectState: { ...state.effectState, compoundInterestPaid: true }
          };
       }
       return {};
    }
  },
  {
    id: 'trickster',
    name: 'Trickster',
    type: 'blessing',
    description: 'Unlocks a random locked tableau.',
    onActivate: (state) => {
       const lockedTableaus = Object.values(state.piles).filter(p => p.type === 'tableau' && p.locked);
       if (lockedTableaus.length > 0) {
          const randomPile = lockedTableaus[Math.floor(Math.random() * lockedTableaus.length)];
          const newPiles = { ...state.piles, [randomPile.id]: { ...randomPile, locked: false } };
          return { piles: newPiles };
       }
       return {};
    }
  },
  {
    id: 'synchronicity',
    name: 'Synchronicity',
    type: 'uncommon',
    description: 'On win, +5 coin for each face-down card remaining (impossible in standard, but possible with effects).',
    onMoveComplete: (state) => {
       // Check Win Condition: All foundations full (13 cards each * 4 = 52, or just checking ranks?)
       // Standard win: 4 foundations with Kings on top.
       const foundations = Object.values(state.piles).filter(p => p.type === 'foundation');
       // Simple check: Are there 52 cards in foundations? 
       // Or just check if all 4 main foundations are full
       const mainFoundations = foundations.filter(p => p.id.match(/^foundation-(hearts|diamonds|clubs|spades)$/));
       const isWin = mainFoundations.every(p => p.cards.length >= 13);
       
       if (isWin && !state.effectState.synchronicityPaid) {
          // Count face down cards
          let faceDownCount = 0;
          Object.values(state.piles).forEach(p => {
             faceDownCount += p.cards.filter(c => !c.faceUp).length;
          });
          
          return {
             coins: state.coins + (faceDownCount * 5),
             effectState: { ...state.effectState, synchronicityPaid: true }
          };
       }
       return {};
    }
  },
  {
    id: 'nice_rock',
    name: 'Nice Rock',
    type: 'legendary',
    description: 'New Game+ (Reset Board, Keep Stats, x3 Multipliers).',
    onActivate: (state) => {
       // Reset board but keep current score/coins and boost multipliers
       const newState = generateNewBoard(state.score, state.coins, 3, 3);
       return newState;
    }
  },
  {
    id: 'trust_fund',
    name: 'Trust Fund',
    type: 'rare',
    description: 'Pay 500 coins to auto-fill a foundation.',
    onActivate: (state) => {
       if (state.coins < 500) return {};
       
       // Find incomplete foundation
       const foundations = Object.keys(state.piles).filter(k => k.startsWith('foundation'));
       const targetId = foundations.find(fid => state.piles[fid].cards.length < 13);
       
       if (targetId) {
          const currentLen = state.piles[targetId].cards.length;
          const missing = 13 - currentLen;
          
          return {
             coins: state.coins - 500 + (missing * 10), // Pay cost, get standard move reward
             score: state.score + (missing * 10),
             // We effectively "filled" it virtually. Let's lock it or fill with dummy kings.
             // Simplified: Just give rewards.
             effectState: { ...state.effectState, trustFundUsed: true } 
          };
       }
       return {};
    }
  },
  {
    id: 'noble_eightfold_path',
    name: 'Noble Eightfold Path',
    type: 'rare',
    description: 'When four 8s face up, gain +1 Coin per move permanently.',
    onMoveComplete: (state) => {
       if (state.effectState.noblePathActive) return {}; // Already active
       
       let visible8s = 0;
       Object.values(state.piles).forEach(pile => {
          pile.cards.forEach(c => {
             if (c.faceUp && c.rank === 8) visible8s++;
          });
       });
       
       if (visible8s >= 4) {
          return { 
             effectState: { ...state.effectState, noblePathActive: true }
          };
       }
       return {};
    },
    calculateCoinTransaction: (delta, context, state) => {
       if (state.effectState.noblePathActive) return delta + 1;
       return delta;
    }
  },
  {
    id: 'get_out_of_jail_free',
    name: 'Get Out of Jail Free',
    type: 'uncommon',
    description: 'When four Aces face up, gain 1000 points.',
    onMoveComplete: (state) => {
       if (state.effectState.jailFreeUsed) return {};
       
       let visibleAces = 0;
       Object.values(state.piles).forEach(pile => {
          pile.cards.forEach(c => {
             if (c.faceUp && c.rank === 1) visibleAces++;
          });
       });
       
       if (visibleAces >= 4) {
          return { 
             score: state.score + 1000,
             effectState: { ...state.effectState, jailFreeUsed: true }
          };
       }
       return {};
    }
  },
  {
    id: 'reverse_psychology',
    name: 'Reverse Psychology',
    type: 'epic',
    description: 'Swap the Rank/Suit of top Hand card and top Deck card.',
    onActivate: (state) => {
       const deck = state.piles['deck'];
       const hand = state.piles['hand'];
       
       if (deck.cards.length > 0 && hand.cards.length > 0) {
          const deckCard = deck.cards[deck.cards.length - 1];
          const handCard = hand.cards[hand.cards.length - 1];
          
          const newDeckCard = { ...deckCard, rank: handCard.rank, suit: handCard.suit };
          const newHandCard = { ...handCard, rank: deckCard.rank, suit: deckCard.suit };
          
          // Rebuild piles
          const newDeckCards = [...deck.cards];
          newDeckCards[newDeckCards.length - 1] = newDeckCard;
          
          const newHandCards = [...hand.cards];
          newHandCards[newHandCards.length - 1] = newHandCard;
          
          return {
             piles: {
                ...state.piles,
                deck: { ...deck, cards: newDeckCards },
                hand: { ...hand, cards: newHandCards }
             }
          };
       }
       return {};
    }
  },

  // --- NEW BATCH 21 ---

  {
    id: 'lobbyist',
    name: 'Lobbyist',
    type: 'blessing',
    description: 'Pay 100 coins to remove a random active curse.',
    onActivate: (state, activeEffects) => {
       if (state.coins < 100) return {};
       return { 
          coins: state.coins - 100,
          effectState: { ...state.effectState, freeCurseRemoval: (state.effectState.freeCurseRemoval || 0) + 1 }
       };
    }
  },
  {
    id: 'smoke_mirrors',
    name: 'Smoke & Mirrors',
    type: 'exploit',
    description: 'Pay 20 coins to split largest tableau pile to an empty slot.',
    onActivate: (state) => {
       if (state.coins < 20) return {};
       
       // Find largest tableau
       const tableaus = Object.values(state.piles).filter(p => p.type === 'tableau');
       const largest = tableaus.reduce((prev, current) => (prev.cards.length > current.cards.length) ? prev : current);
       
       // Find empty tableau
       const empty = tableaus.find(p => p.cards.length === 0);
       
       if (largest && empty && largest.cards.length > 1) {
          const splitIdx = Math.floor(largest.cards.length / 2);
          const toKeep = largest.cards.slice(0, splitIdx);
          const toMove = largest.cards.slice(splitIdx);
          
          const newPiles = { ...state.piles };
          newPiles[largest.id] = { ...largest, cards: toKeep };
          newPiles[empty.id] = { ...empty, cards: toMove };
          
          // Ensure tops are face up
          if (newPiles[largest.id].cards.length > 0) {
             newPiles[largest.id].cards[newPiles[largest.id].cards.length - 1].faceUp = true;
          }
          
          return { 
             coins: state.coins - 20,
             piles: newPiles 
          };
       }
       return {};
    }
  },
  {
    id: 'offshore_account',
    name: 'Offshore Account',
    type: 'exploit',
    description: 'Pay 50 coins to move bottom Hand card to top.',
    onActivate: (state) => {
       if (state.coins < 50) return {};
       const hand = state.piles['hand'];
       if (hand.cards.length > 1) {
          const bottom = hand.cards[0];
          const remaining = hand.cards.slice(1);
          const newCards = [...remaining, bottom];
          return {
             coins: state.coins - 50,
             piles: { ...state.piles, hand: { ...hand, cards: newCards } }
          };
       }
       return {};
    }
  },
  {
    id: 'cracked_rock',
    name: 'Cracked Rock',
    type: 'legendary',
    description: 'Hard Mode NG+ (Reset, x5 Multipliers, Empty Tableau).',
    onActivate: (state) => {
       return generateNewBoard(state.score, state.coins, 5, 5, true, false);
    }
  },
  {
    id: 'strange_rock',
    name: 'Strange Rock',
    type: 'legendary',
    description: 'Chaos Mode NG+ (Reset, x4 Multipliers, Random Cards).',
    onActivate: (state) => {
       return generateNewBoard(state.score, state.coins, 4, 4, false, true);
    }
  }
];
