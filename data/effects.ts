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
      if (context.source === 'waste' && context.target === 'deck') {
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
        newPiles['waste'] = { id: 'waste', type: 'waste', cards: [] };
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
      if (context.source === 'waste' && context.target === 'deck') {
        return { score: Math.floor(state.score * 0.9) };
      }
      return {};
    },
    calculateCoinTransaction: (delta, context) => {
       if (context.target === 'waste') return delta - 20;
       return delta;
    }
  },
  {
    id: 'mandatory_minimum',
    name: 'Mandatory Minimum',
    type: 'danger',
    description: 'Remove 2 cards per shuffle (Deck Cycle).',
    onMoveComplete: (state, context) => {
      if (context.source === 'waste' && context.target === 'deck') {
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
    id: 'not_gaslighting',
    name: 'Not Gaslighting',
    type: 'danger',
    description: 'Change face up suit & rank per shuffle or discard.',
    onMoveComplete: (state, context) => {
       const isShuffle = context.source === 'waste' && context.target === 'deck';
       const isDiscard = context.target === 'waste';
       
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
      if (context.source === 'waste' && context.target === 'deck') {
         let faceUpCards: Card[] = [];
         let tableauConfigs: { id: string, count: number }[] = [];
         
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
       if (context.source === 'waste' && context.target === 'deck') {
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
    id: 'rules_of_3',
    name: '3 Rules of 3',
    type: 'danger',
    description: '3rd card play removes 3 cards from deck.',
    onMoveComplete: (state, context) => {
       if (context.source === 'deck' || context.source === 'waste') return {};
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
    id: 'thief',
    name: 'Thief',
    type: 'blessing',
    description: 'Move buried face-up cards to Waste.',
    canMove: (cards, source, target, defaultAllowed) => {
       if (source.type === 'tableau' && target.type === 'waste' && cards.length === 1) {
          return true;
       }
       return defaultAllowed;
    }
  },
  {
    id: 'flesh_wound',
    name: 'Flesh Wound',
    type: 'curse',
    description: 'Adds Wound to Waste & Bandage to Deck. Find Bandage for +50 coins.',
    onActivate: (state) => {
       const newPiles = { ...state.piles };
       
       const woundCard: Card = { id: 'quest-wound', rank: 0, suit: 'special', faceUp: true, meta: { isWound: true } };
       newPiles['waste'].cards = [...newPiles['waste'].cards, woundCard];

       const bandageCard: Card = { id: 'quest-bandage', rank: 0, suit: 'special', faceUp: false, meta: { isBandage: true } };
       const deckCards = [...newPiles['deck'].cards, bandageCard];
       deckCards.sort(() => Math.random() - 0.5);
       newPiles['deck'].cards = deckCards;

       return { piles: newPiles };
    },
    onMoveComplete: (state, context) => {
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
       newPiles['waste'].cards = [...newPiles['waste'].cards, wildCard];
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
       let visible7s = 0;
       Object.values(state.piles).forEach(pile => {
          pile.cards.forEach(c => {
             if (c.faceUp && c.rank === 7) visible7s++;
          });
       });
       
       if (visible7s >= 3 && !state.effectState.roseGlassesTriggered) {
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
       if (state.effectState.counterfeitingActive) return true;
       return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
       if (state.effectState.counterfeitingActive) {
          const pile = state.piles[context.target];
          const newCardIdx = pile.cards.length - 1;
          const anchorIdx = newCardIdx - 1;
          
          if (anchorIdx >= 0) {
             const anchor = pile.cards[anchorIdx];
             const newCard = pile.cards[newCardIdx];
             
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
    description: 'Drag Tableau card to Waste to sell for coins (Rank value).',
    canMove: (cards, source, target, defaultAllowed) => {
       if (source.type === 'tableau' && target.type === 'waste' && cards.length === 1) {
          return true;
       }
       return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
       if (context.source.includes('tableau') && context.target === 'waste') {
          const value = context.cards[0].rank;
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
          if (targetCard.faceUp) {
             const isColorAlt = getCardColor(moving.suit) !== getCardColor(targetCard.suit);
             if (isColorAlt && moving.rank === targetCard.rank + 1) return true; 
             if (isColorAlt && moving.rank === targetCard.rank - 1) return false;
          }
       }
       
       if (target.type === 'foundation') {
          const targetCard = target.cards[target.cards.length - 1];
          if (targetCard) {
             if (moving.suit === targetCard.suit && moving.rank === targetCard.rank - 1) return true;
             if (moving.suit === targetCard.suit && moving.rank === targetCard.rank + 1) return false;
          } else {
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
    id: 'trust_fund',
    name: 'Trust Fund',
    type: 'rare',
    description: 'Pay 500 coins to auto-fill a foundation.',
    onActivate: (state) => {
       if (state.coins < 500) return {};
       
       const foundations = Object.keys(state.piles).filter(k => k.startsWith('foundation'));
       const targetId = foundations.find(fid => state.piles[fid].cards.length < 13);
       
       if (targetId) {
          const currentLen = state.piles[targetId].cards.length;
          const missing = 13 - currentLen;
          
          return {
             coins: state.coins - 500 + (missing * 10),
             score: state.score + (missing * 10),
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
       if (state.effectState.noblePathActive) return {}; 
       
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
    description: 'Swap the Rank/Suit of top Waste card and top Deck card.',
    onActivate: (state) => {
       const deck = state.piles['deck'];
       const waste = state.piles['waste'];
       
       if (deck.cards.length > 0 && waste.cards.length > 0) {
          const deckCard = deck.cards[deck.cards.length - 1];
          const wasteCard = waste.cards[waste.cards.length - 1];
          
          const newDeckCard = { ...deckCard, rank: wasteCard.rank, suit: wasteCard.suit };
          const newWasteCard = { ...wasteCard, rank: deckCard.rank, suit: deckCard.suit };
          
          const newDeckCards = [...deck.cards];
          newDeckCards[newDeckCards.length - 1] = newDeckCard;
          
          const newWasteCards = [...waste.cards];
          newWasteCards[newWasteCards.length - 1] = newWasteCard;
          
          return {
             piles: {
                ...state.piles,
                deck: { ...deck, cards: newDeckCards },
                waste: { ...waste, cards: newWasteCards }
             }
          };
       }
       return {};
    }
  },
  {
    id: 'lobbyist',
    name: 'Lobbyist',
    type: 'blessing',
    description: 'Pay 100 coins to remove a random active curse.',
    onActivate: (state) => {
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
       
       const tableaus = Object.values(state.piles).filter(p => p.type === 'tableau');
       const largest = tableaus.reduce((prev, current) => (prev.cards.length > current.cards.length) ? prev : current);
       const empty = tableaus.find(p => p.cards.length === 0);
       
       if (largest && empty && largest.cards.length > 1) {
          const splitIdx = Math.floor(largest.cards.length / 2);
          const toKeep = largest.cards.slice(0, splitIdx);
          const toMove = largest.cards.slice(splitIdx);
          
          const newPiles = { ...state.piles };
          newPiles[largest.id] = { ...largest, cards: toKeep };
          newPiles[empty.id] = { ...empty, cards: toMove };
          
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
    description: 'Pay 50 coins to move bottom Waste card to top.',
    onActivate: (state) => {
       if (state.coins < 50) return {};
       const waste = state.piles['waste'];
       if (waste.cards.length > 1) {
          const bottom = waste.cards[0];
          const remaining = waste.cards.slice(1);
          const newCards = [...remaining, bottom];
          return {
             coins: state.coins - 50,
             piles: { ...state.piles, waste: { ...waste, cards: newCards } }
          };
       }
       return {};
    }
  },


{
  id: 'uncle_timmy_boo',
  name: 'Uncle Timmy Boo',
  type: 'exploit',
  description: 'When five Queens face up, +300 points & unlock all tableaus.',
  onMoveComplete: (state) => {
    if (state.effectState.uncleTimmyBooPaid) return {};
    
    let visibleQueens = 0;
    Object.values(state.piles).forEach(pile => {
      pile.cards.forEach(c => {
        if (c.faceUp && c.rank === 12) visibleQueens++;
      });
    });
    
    if (visibleQueens >= 5) {
      const newPiles = { ...state.piles };
      Object.keys(newPiles).forEach(key => {
        if (key.startsWith('tableau') && newPiles[key].locked) {
          newPiles[key] = { ...newPiles[key], locked: false };
        }
      });
      
      return {
        score: state.score + 300,
        piles: newPiles,
        effectState: { ...state.effectState, uncleTimmyBooPaid: true }
      };
    }
    return {};
  }
},

{
  id: 'sacred_geometry',
  name: 'Sacred Geometry',
  type: 'exploit',
  description: 'Prime number ranks (2,3,5,7,11,13) play anywhere.',
  canMove: (cards, source, target, defaultAllowed) => {
    const moving = cards[0];
    const primeRanks = [2, 3, 5, 7, 11, 13];
    
    if (primeRanks.includes(moving.rank)) {
      if (target.type === 'tableau') return true;
      if (target.type === 'foundation') return true;
    }
    return defaultAllowed;
  },
  calculateScore: (score, context) => {
    const rank = context.cards[0].rank;
    const primeRanks = [2, 3, 5, 7, 11, 13];
    if (primeRanks.includes(rank)) return score * 2;
    return score;
  }
},

{
  id: 'royal_flush',
  name: 'Royal Flush',
  type: 'exploit',
  description: 'Complete suit in foundation = +200 pts & +100 coins.',
  onMoveComplete: (state, context) => {
    if (context.target.includes('foundation')) {
      const pile = state.piles[context.target];
      if (pile.cards.length === 13) { // Full suit
        const isRoyal = pile.cards.every(c => c.rank >= 10 || c.rank === 1); // A,10,J,Q,K
        if (isRoyal) {
          return {
            score: state.score + 200,
            coins: state.coins + 100
          };
        }
      }
    }
    return {};
  }
},

{
  id: 'straight_sequence',
  name: 'Straight Sequence',
  type: 'exploit',
  description: '5+ consecutive ranks in tableau = +5 pts per card.',
  onMoveComplete: (state, context) => {
    if (context.target.includes('tableau')) {
      const pile = state.piles[context.target];
      if (pile.cards.length >= 5) {
        const lastFive = pile.cards.slice(-5);
        const ranks = lastFive.map(c => c.rank).sort((a, b) => a - b);
        
        // Check if consecutive
        let isConsecutive = true;
        for (let i = 1; i < ranks.length; i++) {
          if (ranks[i] !== ranks[i-1] + 1) {
            isConsecutive = false;
            break;
          }
        }
        
        if (isConsecutive) {
          return { score: state.score + (lastFive.length * 5) };
        }
      }
    }
    return {};
  }
},

{
  id: 'mirror_match',
  name: 'Mirror Match',
  type: 'exploit',
  description: 'Pair same rank cards = +25 pts & reveal hidden cards.',
  onMoveComplete: (state, context) => {
    if (context.target.includes('tableau') && context.cards.length === 1) {
      const pile = state.piles[context.target];
      const playedCard = context.cards[0];
      
      if (pile.cards.length >= 2) {
        const previousCard = pile.cards[pile.cards.length - 2];
        if (previousCard.rank === playedCard.rank) {
          // Reveal face-down cards in tableau
          const newPiles = { ...state.piles };
          Object.keys(newPiles).forEach(key => {
            if (key.startsWith('tableau')) {
              const tabPile = newPiles[key];
              if (tabPile.cards.length > 0) {
                const topCard = tabPile.cards[tabPile.cards.length - 1];
                if (!topCard.faceUp) {
                  const newCards = [...tabPile.cards];
                  newCards[newCards.length - 1] = { ...topCard, faceUp: true };
                  newPiles[key] = { ...tabPile, cards: newCards };
                }
              }
            }
          });
          
          return {
            score: state.score + 25,
            piles: newPiles
          };
        }
      }
    }
    return {};
  }
},

{
  id: 'rainbow_bridge',
  name: 'Rainbow Bridge',
  type: 'exploit',
  description: 'Play all 4 suits in sequence = +100 pts & wild card.',
  onEncounterStart: (state) => {
    return { 
      effectState: { 
        ...state.effectState, 
        rainbowSequence: [] 
      } 
    };
  },
  onMoveComplete: (state, context) => {
    if (context.cards.length === 1) {
      const playedCard = context.cards[0];
      const sequence = state.effectState.rainbowSequence || [];
      const lastSuit = sequence.length > 0 ? sequence[sequence.length - 1] : null;
      
      if (lastSuit !== playedCard.suit) {
        const newSequence = [...sequence, playedCard.suit];
        
        if (newSequence.length >= 4) {
          // Check if we have all 4 suits
          const suits = new Set(newSequence.slice(-4));
          if (suits.size === 4) {
            // Add wild card to waste
            const newPiles = { ...state.piles };
            const wildCard: Card = {
              id: `rainbow-wild-${Date.now()}`,
              rank: 0,
              suit: 'special',
              faceUp: true,
              meta: { isWild: true, fromRainbow: true }
            };
            newPiles['waste'].cards = [...newPiles['waste'].cards, wildCard];
            
            return {
              score: state.score + 100,
              piles: newPiles,
              effectState: { ...state.effectState, rainbowSequence: [] }
            };
          }
        }
        
        return { 
          effectState: { ...state.effectState, rainbowSequence: newSequence } 
        };
      } else {
        // Same suit breaks sequence
        return { 
          effectState: { ...state.effectState, rainbowSequence: [playedCard.suit] } 
        };
      }
    }
    return {};
  }
},

{
  id: 'tower_of_power',
  name: 'Tower of Power',
  type: 'exploit',
  description: '7+ card tableau pile = +10 pts per extra card.',
  calculateScore: (score, context, state) => {
    if (context.target.includes('tableau')) {
      const pile = state.piles[context.target];
      if (pile.cards.length >= 7) {
        const extraCards = pile.cards.length - 6; // Beyond first 6
        return score + (extraCards * 10);
      }
    }
    return score;
  }
},

{
  id: 'checkered_board',
  name: 'Checkered Board',
  type: 'exploit',
  description: 'Alternating colors score 2x, same color scores 0.',
  calculateScore: (score, context, state) => {
    if (context.target.includes('tableau') && context.cards.length === 1) {
      const pile = state.piles[context.target];
      const playedCard = context.cards[0];
      
      if (pile.cards.length >= 2) {
        const previousCard = pile.cards[pile.cards.length - 2];
        const sameColor = getCardColor(playedCard.suit) === getCardColor(previousCard.suit);
        
        if (sameColor) return 0;
        return score * 2;
      }
    }
    return score;
  }
},

{
  id: 'full_house',
  name: 'Full House',
  type: 'exploit',
  description: '3 of a rank + 2 of another rank in waste = +150 pts.',
  onMoveComplete: (state) => {
    const waste = state.piles['waste'];
    const rankCounts: Record<number, number> = {};
    
    waste.cards.forEach(card => {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    });
    
    let hasThree = false;
    let hasTwo = false;
    for (const count of Object.values(rankCounts)) {
      if (count >= 3) hasThree = true;
      if (count >= 2) hasTwo = true;
    }
    
    if (hasThree && hasTwo && !state.effectState.fullHousePaid) {
      return {
        score: state.score + 150,
        effectState: { ...state.effectState, fullHousePaid: true }
      };
    }
    return {};
  }
},

{
  id: 'the_constellation',
  name: 'The Constellation',
  type: 'exploit',
  description: 'Connect cards like stars = +5 pts per connection.',
  onEncounterStart: (state) => {
    return { 
      effectState: { 
        ...state.effectState, 
        constellationNodes: new Set<string>(),
        constellationConnections: 0
      } 
    };
  },
  onMoveComplete: (state, context) => {
    if (context.cards.length === 1) {
      const playedCard = context.cards[0];
      const cardId = playedCard.id;
      const nodes = new Set(state.effectState.constellationNodes || []);
      let connections = state.effectState.constellationConnections || 0;
      
      // Count connections: each new card connects to all existing nodes
      const newConnections = nodes.size;
      connections += newConnections;
      nodes.add(cardId);
      
      return {
        score: state.score + (newConnections * 5),
        effectState: { 
          ...state.effectState, 
          constellationNodes: Array.from(nodes),
          constellationConnections: connections
        }
      };
    }
    return {};
  }
},

{
  id: 'perfect_balance',
  name: 'Perfect Balance',
  type: 'exploit',
  description: 'Equal red/black cards in tableau = +50 pts each check.',
  onMoveComplete: (state) => {
    let redCount = 0;
    let blackCount = 0;
    
    Object.values(state.piles).forEach(pile => {
      if (pile.type === 'tableau') {
        pile.cards.forEach(card => {
          if (card.faceUp) {
            if (getCardColor(card.suit) === 'red') redCount++;
            else blackCount++;
          }
        });
      }
    });
    
    if (redCount === blackCount && redCount > 0) {
      return { score: state.score + 50 };
    }
    return {};
  }
},

{
  id: 'suit_supremacy',
  name: 'Suit Supremacy',
  type: 'exploit',
  description: 'Dominant suit scores 2x, others 0.5x.',
  onEncounterStart: (state) => {
    return { 
      effectState: { 
        ...state.effectState, 
        suitPlays: { hearts: 0, diamonds: 0, clubs: 0, spades: 0 } 
      } 
    };
  },
  onMoveComplete: (state, context) => {
    if (context.cards.length === 1) {
      const suit = context.cards[0].suit;
      const suitPlays = { ...state.effectState.suitPlays };
      suitPlays[suit] = (suitPlays[suit] || 0) + 1;
      
      return { 
        effectState: { ...state.effectState, suitPlays } 
      };
    }
    return {};
  },
  calculateScore: (score, context, state) => {
    const suitPlays = state.effectState.suitPlays || { hearts: 0, diamonds: 0, clubs: 0, spades: 0 };
    const playedSuit = context.cards[0].suit;
    
    // Find dominant suit
    let maxPlays = 0;
    let dominantSuit: string | null = null;
    for (const [suit, plays] of Object.entries(suitPlays)) {
      if (plays > maxPlays) {
        maxPlays = plays;
        dominantSuit = suit;
      }
    }
    
    if (dominantSuit === playedSuit) return score * 2;
    return Math.floor(score * 0.5);
  }
},

{
  id: 'high_society',
  name: 'High Society',
  type: 'exploit',
  description: 'Face cards & Aces score 3x, number cards 0.5x.',
  calculateScore: (score, context) => {
    const rank = context.cards[0].rank;
    if (rank === 1 || rank >= 11) return score * 3;
    return Math.floor(score * 0.5);
  }
},

{
  id: 'lucky_sevens_wall',
  name: 'Lucky Sevens Wall',
  type: 'exploit',
  description: 'Each 7 played creates protective wall (+10 coin per move).',
  onMoveComplete: (state, context) => {
    if (context.cards[0].rank === 7) {
      const walls = (state.effectState.sevenWalls || 0) + 1;
      return {
        effectState: { ...state.effectState, sevenWalls: walls }
      };
    }
    return {};
  },
  calculateCoinTransaction: (delta, context, state) => {
    const walls = state.effectState.sevenWalls || 0;
    return delta + (walls * 10);
  }
},

{
  id: 'foundation_race',
  name: 'Foundation Race',
  type: 'exploit',
  description: 'First foundation to 10 cards = +200 pts, others +100.',
  onMoveComplete: (state, context) => {
    if (context.target.includes('foundation')) {
      const pile = state.piles[context.target];
      if (pile.cards.length === 10) {
        if (!state.effectState.foundationRaceWinner) {
          // First to 10
          return {
            score: state.score + 200,
            effectState: { ...state.effectState, foundationRaceWinner: context.target }
          };
        } else if (state.effectState.foundationRaceWinner !== context.target) {
          // Others to 10
          return { score: state.score + 100 };
        }
      }
    }
    return {};
  }
},

{
  id: 'grand_slam',
  name: 'Grand Slam',
  type: 'exploit',
  description: 'Complete all foundations in one suit order = +500 pts.',
  onMoveComplete: (state) => {
    const foundations = ['hearts', 'diamonds', 'clubs', 'spades']
      .map(suit => state.piles[`foundation-${suit}`])
      .filter(Boolean);
    
    const allComplete = foundations.every(f => f.cards.length === 13);
    if (allComplete && !state.effectState.grandSlamPaid) {
      return {
        score: state.score + 500,
        effectState: { ...state.effectState, grandSlamPaid: true }
      };
    }
    return {};
  }
},

{
  id: 'emergency_reshuffle',
  name: 'Emergency Reshuffle',
  type: 'exploit',
  description: 'When stuck, reshuffle tableau (costs 50 pts).',
  onActivate: (state) => {
    if (state.score >= 50) {
      const newPiles = { ...state.piles };
      let allTableauCards: Card[] = [];
      
      // Collect all tableau cards
      Object.keys(newPiles).forEach(key => {
        if (key.startsWith('tableau')) {
          allTableauCards = [...allTableauCards, ...newPiles[key].cards];
          newPiles[key].cards = [];
        }
      });
      
      // Shuffle
      allTableauCards.sort(() => Math.random() - 0.5);
      
      // Redistribute
      const tableauKeys = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
      let cardIndex = 0;
      tableauKeys.forEach(key => {
        const pileSize = key === 'tableau-0' ? 1 : key === 'tableau-1' ? 2 : key === 'tableau-2' ? 3 : 
                        key === 'tableau-3' ? 4 : key === 'tableau-4' ? 5 : key === 'tableau-5' ? 6 : 7;
        const cards = allTableauCards.slice(cardIndex, cardIndex + pileSize);
        if (cards.length > 0) {
          cards[cards.length - 1].faceUp = true;
        }
        newPiles[key].cards = cards;
        cardIndex += pileSize;
      });
      
      return {
        score: state.score - 50,
        piles: newPiles
      };
    }
    return {};
  }
},

{
  id: 'sacrifice_play',
  name: 'Sacrifice Play',
  type: 'exploit',
  description: 'Discard high-value card to draw 3 new cards.',
  canMove: (cards, source, target, defaultAllowed) => {
    if (source.type === 'tableau' && target.type === 'waste' && cards.length === 1) {
      const card = cards[0];
      return card.rank >= 10; // Only high-value cards
    }
    return defaultAllowed;
  },
  onMoveComplete: (state, context) => {
    if (context.source.includes('tableau') && context.target === 'waste' && context.cards[0].rank >= 10) {
      const deck = state.piles['deck'];
      if (deck.cards.length >= 3) {
        const newPiles = { ...state.piles };
        const drawn = newPiles['deck'].cards.slice(-3).reverse(); // Draw from end
        newPiles['deck'].cards = newPiles['deck'].cards.slice(0, -3);
        newPiles['waste'].cards = [...newPiles['waste'].cards, ...drawn.map(c => ({ ...c, faceUp: true }))];
        
        return { piles: newPiles };
      }
    }
    return {};
  }
},

{
  id: 'bifurcation',
  name: 'Bifurcation',
  type: 'exploit',
  description: 'Split tableau piles into two paths (choose direction).',
  onActivate: (state) => {
    return {
      effectState: { 
        ...state.effectState, 
        bifurcationActive: true,
        pendingBifurcation: true // UI should let player choose split
      }
    };
  },
  canMove: (cards, source, target, defaultAllowed, state) => {
    if (state.effectState.bifurcationActive && source.type === 'tableau') {
      // Allow playing to either tableau or a special "split" pile
      return true;
    }
    return defaultAllowed;
  }
},

{
  id: 'tableau_tiers',
  name: 'Tableau Tiers',
  type: 'exploit',
  description: 'Tableaus have tiers: Bronze (1-4), Silver (5-8), Gold (9-K).',
  onEncounterStart: (state) => {
    const newPiles = { ...state.piles };
    // Label tableaus by tier
    Object.keys(newPiles).forEach(key => {
      if (key.startsWith('tableau')) {
        const tier = key === 'tableau-0' || key === 'tableau-1' ? 'bronze' :
                    key === 'tableau-2' || key === 'tableau-3' ? 'silver' : 'gold';
        newPiles[key].meta = { ...newPiles[key].meta, tier };
      }
    });
    return { piles: newPiles };
  },
  calculateScore: (score, context, state) => {
    if (context.target.includes('tableau')) {
      const pile = state.piles[context.target];
      const tier = pile.meta?.tier;
      const rank = context.cards[0].rank;
      
      let multiplier = 1;
      if (tier === 'bronze' && rank <= 4) multiplier = 2;
      if (tier === 'silver' && rank >= 5 && rank <= 8) multiplier = 2;
      if (tier === 'gold' && rank >= 9) multiplier = 2;
      
      return score * multiplier;
    }
    return score;
  }
},

{
  id: 'cascading_columns',
  name: 'Cascading Columns',
  type: 'exploit',
  description: 'Clearing a tableau cascades cards to adjacent piles.',
  onMoveComplete: (state, context) => {
    if (context.source.includes('tableau')) {
      const sourcePile = state.piles[context.source];
      if (sourcePile.cards.length === 0) {
        // Find adjacent tableau
        const idx = parseInt(context.source.split('-')[1]);
        const leftIdx = idx - 1;
        const rightIdx = idx + 1;
        
        const newPiles = { ...state.piles };
        let cardsToMove: Card[] = [];
        
        // Try to take from right neighbor
        const rightId = `tableau-${rightIdx}`;
        if (newPiles[rightId] && newPiles[rightId].cards.length > 1) {
          cardsToMove = newPiles[rightId].cards.slice(-1); // Take top card
          newPiles[rightId].cards = newPiles[rightId].cards.slice(0, -1);
        }
        // Or from left neighbor
        else if (newPiles[`tableau-${leftIdx}`] && newPiles[`tableau-${leftIdx}`].cards.length > 1) {
          const leftId = `tableau-${leftIdx}`;
          cardsToMove = newPiles[leftId].cards.slice(-1);
          newPiles[leftId].cards = newPiles[leftId].cards.slice(0, -1);
        }
        
        if (cardsToMove.length > 0) {
          cardsToMove[0].faceUp = true;
          newPiles[context.source].cards = cardsToMove;
          return { piles: newPiles };
        }
      }
    }
    return {};
  }
},

{
  id: 'phantom_tableau',
  name: 'Phantom Tableau',
  type: 'exploit',
  description: 'Create ghost tableau that holds any 3 cards.',
  onActivate: (state) => {
    const phantomId = `tableau-phantom-${Date.now()}`;
    const newPiles = {
      ...state.piles,
      [phantomId]: {
        id: phantomId,
        type: 'tableau',
        cards: [],
        meta: { isPhantom: true, maxCards: 3 }
      }
    };
    return { piles: newPiles };
  },
  canMove: (cards, source, target, defaultAllowed, state) => {
    if (target.meta?.isPhantom) {
      return target.cards.length < (target.meta.maxCards || 3);
    }
    return defaultAllowed;
  },
  calculateScore: (score, context, state) => {
    if (context.target.includes('phantom')) {
      return score * 2; // Bonus for using phantom tableau
    }
    return score;
  }
},

{
  id: 'stacked_deck',
  name: 'Stacked Deck',
  type: 'exploit',
  description: 'Arrange next 5 deck cards in any order.',
  onActivate: (state) => {
    const deck = state.piles['deck'];
    if (deck.cards.length >= 5) {
      return {
        effectState: {
          ...state.effectState,
          stackedDeckActive: true,
          pendingDeckArrange: deck.cards.slice(-5) // Last 5 cards
        }
      };
    }
    return {};
  }
},

// ========== MISSING BLESSINGS ==========

{
  id: 'tortoiseshell',
  name: 'Tortoiseshell',
  type: 'blessing',
  description: 'Each card played to tableau adds +1 to its defense stat.',
  onEncounterStart: (state) => {
    const newPiles = { ...state.piles };
    Object.keys(newPiles).forEach(key => {
      if (key.startsWith('tableau')) {
        newPiles[key].meta = { ...newPiles[key].meta, defense: 0 };
      }
    });
    return { piles: newPiles };
  },
  onMoveComplete: (state, context) => {
    if (context.target.includes('tableau')) {
      const pile = state.piles[context.target];
      const defense = (pile.meta?.defense || 0) + 1;
      const newPiles = {
        ...state.piles,
        [context.target]: {
          ...pile,
          meta: { ...pile.meta, defense }
        }
      };
      
      // Defense reduces penalty from curses
      const curseProtection = Math.min(defense * 0.1, 0.5); // Up to 50% protection
      return {
        piles: newPiles,
        effectState: {
          ...state.effectState,
          curseProtection
        }
      };
    }
    return {};
  }
},

{
  id: 'martyr',
  name: 'Martyr',
  type: 'blessing',
  description: 'Sacrifice a tableau pile to heal 100 points.',
  canMove: (cards, source, target, defaultAllowed) => {
    if (source.type === 'tableau' && target.type === 'waste' && cards.length > 1) {
      return true; // Allow sacrificing entire stack
    }
    return defaultAllowed;
  },
  onMoveComplete: (state, context) => {
    if (context.source.includes('tableau') && context.target === 'waste' && context.cards.length > 1) {
      return { score: state.score + 100 };
    }
    return {};
  }
},

{
  id: 'klabautermann',
  name: 'Klabautermann',
  type: 'blessing',
  description: 'Ghost ship: Move cards between tableau without penalty.',
  canMove: (cards, source, target, defaultAllowed) => {
    if (source.type === 'tableau' && target.type === 'tableau') {
      return true; // Always allow tableau-to-tableau
    }
    return defaultAllowed;
  },
  calculateScore: (score, context) => {
    if (context.source.includes('tableau') && context.target.includes('tableau')) {
      return score + 5; // Bonus for ghost ship moves
    }
    return score;
  }
},

{
  id: 'reality_shift',
  name: 'Reality Shift',
  type: 'blessing',
  description: 'Swap tableau and foundation rules temporarily.',
  onActivate: (state) => {
    return {
      effectState: {
        ...state.effectState,
        realityShiftActive: true,
        realityShiftEnds: state.moves + 10 // Lasts 10 moves
      }
    };
  },
  canMove: (cards, source, target, defaultAllowed, state) => {
    if (!state.effectState.realityShiftActive) return defaultAllowed;
    
    const moving = cards[0];
    
    if (target.type === 'tableau') {
      // Use foundation rules: same suit, ascending
      const targetCard = target.cards[target.cards.length - 1];
      if (!targetCard) return moving.rank === 1; // Ace to empty
      return targetCard.suit === moving.suit && targetCard.rank === moving.rank - 1;
    }
    
    if (target.type === 'foundation') {
      // Use tableau rules: alternate colors, descending
      const targetCard = target.cards[target.cards.length - 1];
      if (!targetCard) return moving.rank === 13; // King to empty
      return getCardColor(moving.suit) !== getCardColor(targetCard.suit) && 
             targetCard.rank === moving.rank + 1;
    }
    
    return defaultAllowed;
  }
},

{
  id: 'time_rewind',
  name: 'Time Rewind',
  type: 'blessing',
  description: 'Undo last move (3 uses per encounter).',
  onActivate: (state) => {
    const uses = (state.effectState.timeRewindUses || 0) + 1;
    if (uses <= 3) {
      return {
        effectState: {
          ...state.effectState,
          timeRewindUses: uses,
          pendingRewind: true // UI should handle undo
        }
      };
    }
    return {};
  }
},

{
  id: 'wild_card_generator',
  name: 'Wild Card Generator',
  type: 'blessing',
  description: 'Every 10 moves, create a wild card in waste.',
  onMoveComplete: (state) => {
    const moves = (state.effectState.wildCardMoves || 0) + 1;
    if (moves >= 10) {
      const newPiles = { ...state.piles };
      const wildCard: Card = {
        id: `wild-${Date.now()}`,
        rank: 0,
        suit: 'special',
        faceUp: true,
        meta: { isWild: true, generated: true }
      };
      newPiles['waste'].cards = [...newPiles['waste'].cards, wildCard];
      
      return {
        piles: newPiles,
        effectState: { ...state.effectState, wildCardMoves: 0 }
      };
    }
    
    return { effectState: { ...state.effectState, wildCardMoves: moves } };
  }
},

{
  id: 'tableau_swap',
  name: 'Tableau Swap',
  type: 'blessing',
  description: 'Swap positions of two tableau piles.',
  onActivate: (state) => {
    return {
      effectState: {
        ...state.effectState,
        pendingTableauSwap: true // UI should let player choose two tableaus
      }
    };
  }
},

{
  id: 'mulligan_blessing',
  name: 'Mulligan (Blessing)',
  type: 'blessing',
  description: 'Redraw opening tableau (once per encounter).',
  onActivate: (state) => {
    if (state.effectState.mulliganUsed) return {};
    
    const newPiles = { ...state.piles };
    let allTableauCards: Card[] = [];
    
    // Collect all tableau cards
    Object.keys(newPiles).forEach(key => {
      if (key.startsWith('tableau')) {
        allTableauCards = [...allTableauCards, ...newPiles[key].cards];
        newPiles[key].cards = [];
      }
    });
    
    // Shuffle and redeal
    allTableauCards.sort(() => Math.random() - 0.5);
    
    const tableauKeys = Object.keys(newPiles).filter(k => k.startsWith('tableau')).sort();
    let cardIndex = 0;
    tableauKeys.forEach((key, i) => {
      const pileSize = i + 1; // Standard solitaire distribution
      const cards = allTableauCards.slice(cardIndex, cardIndex + pileSize);
      if (cards.length > 0) {
        cards[cards.length - 1].faceUp = true;
      }
      newPiles[key].cards = cards;
      cardIndex += pileSize;
    });
    
    return {
      piles: newPiles,
      effectState: { ...state.effectState, mulliganUsed: true }
    };
  }
},

{
  id: 'foundation_peek',
  name: 'Foundation Peek',
  type: 'blessing',
  description: 'See next card that would go on each foundation.',
  onActivate: (state) => {
    const nextCards: Record<string, Card> = {};
    
    ['hearts', 'diamonds', 'clubs', 'spades'].forEach(suit => {
      const foundation = state.piles[`foundation-${suit}`];
      if (foundation) {
        const currentRank = foundation.cards.length;
        const nextRank = currentRank + 1;
        if (nextRank <= 13) {
          // In real game, you'd need to find this card in the deck/tableau
          // For now, we'll just mark that we can see it
          nextCards[suit] = { rank: nextRank as Rank, suit } as Card;
        }
      }
    });
    
    return {
      effectState: {
        ...state.effectState,
        foundationPeek: nextCards,
        peekActive: true
      }
    };
  },
  transformCardVisual: (card, pile, state) => {
    if (state.effectState.peekActive && pile.type === 'foundation') {
      const suit = pile.id.split('-')[1];
      const nextCard = state.effectState.foundationPeek?.[suit];
      if (nextCard && card.rank === nextCard.rank && card.suit === nextCard.suit) {
        return { meta: { ...card.meta, isNextFoundationCard: true } };
      }
    }
    return {};
  }
},

// ========== MISSING CURSES ==========

{
  id: 'temporal_anomaly',
  name: 'Temporal Anomaly',
  type: 'curse',
  description: 'Cards randomly age/de-age (rank changes ±3).',
  onMoveComplete: (state) => {
    if (Math.random() < 0.2) { // 20% chance per move
      const newPiles = { ...state.piles };
      Object.keys(newPiles).forEach(key => {
        const pile = newPiles[key];
        if (pile.cards.length > 0 && Math.random() < 0.3) {
          const randomIndex = Math.floor(Math.random() * pile.cards.length);
          const card = pile.cards[randomIndex];
          const change = Math.random() > 0.5 ? 3 : -3;
          let newRank = card.rank + change;
          newRank = Math.max(1, Math.min(13, newRank));
          
          const newCards = [...pile.cards];
          newCards[randomIndex] = { ...card, rank: newRank as Rank };
          newPiles[key] = { ...pile, cards: newCards };
        }
      });
      return { piles: newPiles };
    }
    return {};
  }
},

{
  id: 'earthquake',
  name: 'Earthquake',
  type: 'curse',
  description: 'Randomly collapse tableau stacks.',
  onMoveComplete: (state) => {
    if (Math.random() < 0.15) { // 15% chance per move
      const newPiles = { ...state.piles };
      const tableaus = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
      
      tableaus.forEach(tableauId => {
        const pile = newPiles[tableauId];
        if (pile.cards.length > 1 && Math.random() < 0.5) {
          // Collapse: move bottom 1-3 cards to waste
          const collapseCount = Math.floor(Math.random() * 3) + 1;
          const toCollapse = Math.min(collapseCount, pile.cards.length);
          const collapsed = pile.cards.slice(0, toCollapse);
          const remaining = pile.cards.slice(toCollapse);
          
          newPiles[tableauId] = { ...pile, cards: remaining };
          newPiles['waste'].cards = [...newPiles['waste'].cards, ...collapsed.map(c => ({ ...c, faceUp: true }))];
        }
      });
      
      return { piles: newPiles };
    }
    return {};
  }
},

{
  id: 'tectonic_shift',
  name: 'Tectonic Shift',
  type: 'curse',
  description: 'Tableau piles slowly drift left/right each move.',
  onMoveComplete: (state) => {
    const newPiles = { ...state.piles };
    const tableaus = Object.keys(newPiles)
      .filter(k => k.startsWith('tableau'))
      .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
    
    if (tableaus.length > 1) {
      // Shift all piles one position
      const firstPile = newPiles[tableaus[0]];
      for (let i = 0; i < tableaus.length - 1; i++) {
        newPiles[tableaus[i]] = newPiles[tableaus[i + 1]];
      }
      newPiles[tableaus[tableaus.length - 1]] = firstPile;
      
      return { piles: newPiles };
    }
    return {};
  }
},

{
  id: 'entropy',
  name: 'Entropy',
  type: 'curse',
  description: 'Game state slowly decays: -1% score per card in waste.',
  calculateScore: (score, context, state) => {
    const waste = state.piles['waste'];
    const decay = waste.cards.length * 0.01;
    return Math.floor(score * (1 - decay));
  }
},

{
  id: 'solar_flare',
  name: 'Solar Flare',
  type: 'curse',
  description: 'Random cards become face-down every 8 moves.',
  onMoveComplete: (state) => {
    const moves = (state.effectState.solarFlareMoves || 0) + 1;
    if (moves >= 8) {
      const newPiles = { ...state.piles };
      let flipped = 0;
      
      Object.keys(newPiles).forEach(key => {
        const pile = newPiles[key];
        if (pile.cards.length > 0 && Math.random() < 0.4) {
          const randomIndex = Math.floor(Math.random() * pile.cards.length);
          const card = pile.cards[randomIndex];
          if (card.faceUp) {
            const newCards = [...pile.cards];
            newCards[randomIndex] = { ...card, faceUp: false };
            newPiles[key] = { ...pile, cards: newCards };
            flipped++;
          }
        }
      });
      
      return {
        piles: newPiles,
        effectState: { ...state.effectState, solarFlareMoves: 0 }
      };
    }
    
    return { effectState: { ...state.effectState, solarFlareMoves: moves } };
  }
},

{
  id: 'gravity_well',
  name: 'Gravity Well',
  type: 'curse',
  description: 'Cards slide to bottom of tableau (reverse build order).',
  canMove: (cards, source, target, defaultAllowed) => {
    if (target.type === 'tableau' && target.cards.length > 0) {
      const moving = cards[0];
      const targetCard = target.cards[0]; // Bottom card instead of top
      if (targetCard.faceUp) {
        // Must be opposite color and one rank higher than bottom card
        return getCardColor(moving.suit) !== getCardColor(targetCard.suit) &&
               moving.rank === targetCard.rank - 1;
      }
    }
    return defaultAllowed;
  }
},

{
  id: 'poltergeist',
  name: 'Poltergeist',
  type: 'curse',
  description: 'Cards randomly move between tableau piles.',
  onMoveComplete: (state) => {
    if (Math.random() < 0.25) {
      const newPiles = { ...state.piles };
      const tableaus = Object.keys(newPiles)
        .filter(k => k.startsWith('tableau') && newPiles[k].cards.length > 0);
      
      if (tableaus.length >= 2) {
        const fromIdx = Math.floor(Math.random() * tableaus.length);
        const toIdx = Math.floor(Math.random() * tableaus.length);
        
        if (fromIdx !== toIdx) {
          const fromPile = newPiles[tableaus[fromIdx]];
          const toPile = newPiles[tableaus[toIdx]];
          
          if (fromPile.cards.length > 0) {
            const movingCard = fromPile.cards[fromPile.cards.length - 1];
            const newFromCards = fromPile.cards.slice(0, -1);
            const newToCards = [...toPile.cards, { ...movingCard, faceUp: true }];
            
            newPiles[tableaus[fromIdx]] = { ...fromPile, cards: newFromCards };
            newPiles[tableaus[toIdx]] = { ...toPile, cards: newToCards };
            
            return { piles: newPiles };
          }
        }
      }
    }
    return {};
  }
},

{
  id: 'shapeshifter',
  name: 'Shapeshifter',
  type: 'curse',
  description: 'Cards change suit when you look away (on tableau reveal).',
  onCardRevealed: (state, card) => {
    if (Math.random() < 0.5) {
      const newPiles = { ...state.piles };
      const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
      const newSuit = suits.filter(s => s !== card.suit)[Math.floor(Math.random() * 3)];
      
      Object.keys(newPiles).forEach(pileId => {
        const pile = newPiles[pileId];
        const cardIndex = pile.cards.findIndex(c => c.id === card.id);
        if (cardIndex >= 0) {
          const newCards = [...pile.cards];
          newCards[cardIndex] = { ...card, suit: newSuit };
          newPiles[pileId] = { ...pile, cards: newCards };
        }
      });
      
      return { piles: newPiles };
    }
    return {};
  }
},

{
  id: 'wild_magic_surge',
  name: 'Wild Magic Surge',
  type: 'curse',
  description: '10% chance any play triggers random effect.',
  onMoveComplete: (state, context) => {
    if (Math.random() < 0.1) {
      const effects = [
        { score: state.score + 50, coins: state.coins + 25 },
        { score: Math.floor(state.score * 0.8) },
        { coins: state.coins - 20 },
        { effectState: { ...state.effectState, wildMagic: 'extraMove' } },
        { effectState: { ...state.effectState, wildMagic: 'shuffleTableaus' } }
      ];
      
      const randomEffect = effects[Math.floor(Math.random() * effects.length)];
      return randomEffect;
    }
    return {};
  }
},

{
  id: 'butterfly_effect',
  name: 'Butterfly Effect',
  type: 'curse',
  description: 'Small changes cascade: moving a 2 affects all 2s, etc.',
  onMoveComplete: (state, context) => {
    if (context.cards.length === 1) {
      const movedRank = context.cards[0].rank;
      const newPiles = { ...state.piles };
      let cascadeCount = 0;
      
      Object.keys(newPiles).forEach(pileId => {
        const pile = newPiles[pileId];
        const newCards = pile.cards.map(card => {
          if (card.rank === movedRank && card.id !== context.cards[0].id) {
            cascadeCount++;
            // Flip the card or change its face-up status
            return { ...card, faceUp: !card.faceUp };
          }
          return card;
        });
        
        newPiles[pileId] = { ...pile, cards: newCards };
      });
      
      if (cascadeCount > 0) {
        return {
          piles: newPiles,
          score: state.score - (cascadeCount * 5) // Penalty for cascade
        };
      }
    }
    return {};
  }
},

{
  id: 'mulligan_curse',
  name: 'Mulligan (Curse)',
  type: 'curse',
  description: 'Every 7 moves, forced tableau reshuffle.',
  onMoveComplete: (state) => {
    const moves = (state.effectState.curseMulliganMoves || 0) + 1;
    if (moves >= 7) {
      const newPiles = { ...state.piles };
      let allTableauCards: Card[] = [];
      
      // Collect and shuffle all tableau cards
      Object.keys(newPiles).forEach(key => {
        if (key.startsWith('tableau')) {
          allTableauCards = [...allTableauCards, ...newPiles[key].cards];
          newPiles[key].cards = [];
        }
      });
      
      allTableauCards.sort(() => Math.random() - 0.5);
      
      // Redistribute randomly (not in standard solitaire pattern)
      const tableauKeys = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
      tableauKeys.forEach(key => {
        const randomCount = Math.floor(Math.random() * 5) + 1;
        const cards = allTableauCards.splice(0, randomCount);
        if (cards.length > 0) {
          cards[cards.length - 1].faceUp = true;
        }
        newPiles[key].cards = cards;
      });
      
      // Put remaining cards back in deck
      newPiles['deck'].cards = [...allTableauCards, ...newPiles['deck'].cards];
      
      return {
        piles: newPiles,
        effectState: { ...state.effectState, curseMulliganMoves: 0 }
      };
    }
    
    return { effectState: { ...state.effectState, curseMulliganMoves: moves } };
  }
},

{
  id: 'revolving_door',
  name: 'Revolving Door',
  type: 'curse',
  description: 'Foundation cards can be taken back, but at -20 pts cost.',
  canMove: (cards, source, target, defaultAllowed) => {
    if (source.type === 'foundation' && target.type === 'tableau') {
      const moving = cards[0];
      const targetCard = target.cards[target.cards.length - 1];
      if (!targetCard) return moving.rank === 13;
      return getCardColor(moving.suit) !== getCardColor(targetCard.suit) &&
             targetCard.rank === moving.rank + 1;
    }
    return defaultAllowed;
  },
  calculateScore: (score, context) => {
    if (context.source.includes('foundation') && context.target.includes('tableau')) {
      return score - 20;
    }
    return score;
  }
},

// ========== MISSING FEARS ==========

{
  id: 'crown_of_martyr',
  name: 'Crown of Martyr',
  type: 'fear',
  description: 'Taking damage gives +1 to all future plays (stacks).',
  onEncounterStart: (state) => {
    return { 
      effectState: { 
        ...state.effectState, 
        martyrCrownStacks: 0 
      } 
    };
  },
  calculateScore: (score, context, state) => {
    const stacks = state.effectState.martyrCrownStacks || 0;
    if (score < 0) { // Taking damage
      return {
        score,
        effectState: { 
          ...state.effectState, 
          martyrCrownStacks: stacks + 1 
        }
      };
    }
    return score + stacks; // Bonus based on stacks
  }
},

{
  id: 'dementia',
  name: 'Dementia',
  type: 'fear',
  description: 'Forget card positions after 3 seconds of viewing.',
  onCardRevealed: (state, card) => {
    // Start a timer for this card
    const timers = state.effectState.dementiaTimers || {};
    timers[card.id] = Date.now() + 3000; // 3 seconds from now
    
    return { 
      effectState: { 
        ...state.effectState, 
        dementiaTimers: timers 
      } 
    };
  },
  transformCardVisual: (card, pile, state) => {
    const timers = state.effectState.dementiaTimers || {};
    const expireTime = timers[card.id];
    
    if (expireTime && Date.now() > expireTime) {
      // Card should be "forgotten" - hide it
      return { faceUp: false };
    }
    return {};
  }
},
{
    id: 'shadow_realm',
    name: 'Shadow Realm',
    type: 'epic',
    description: 'Discards enter Shadow Realm. Pay coins to summon back.',
    onMoveComplete: (state, context) => {
       if (context.target === 'waste') {
          const newPiles = { ...state.piles };
          if (!newPiles['shadow-realm']) newPiles['shadow-realm'] = { id: 'shadow-realm', type: 'waste', cards: [] };
          
          const moved = newPiles['waste'].cards.pop()!;
          newPiles['shadow-realm'].cards.push(moved);
          return { piles: newPiles };
       }
       return {};
    }
  },
  {
    id: 'card_graveyard',
    name: 'Card Graveyard',
    type: 'epic',
    description: 'Foundation cards stack. 35+ total cards -> +500 pts.',
    onMoveComplete: (state) => {
       const total = Object.keys(state.piles)
          .filter(k => k.startsWith('foundation'))
          .reduce((sum, k) => sum + state.piles[k].cards.length, 0);
       
       if (total >= 35 && !state.effectState.graveyardBonus) {
          return { score: state.score + 500, effectState: { ...state.effectState, graveyardBonus: true } };
       }
       return {};
    }
  },
  {
    id: 'linked_fates',
    name: 'Linked Fates',
    type: 'epic',
    description: 'Two tableaus linked. Must play alternatingly.',
    onActivate: (state) => ({ effectState: { ...state.effectState, linkedTableaus: ['tableau-2', 'tableau-4'] } }),
    canMove: (cards, source, target, defaultAllowed, state) => {
       const links = state.effectState.linkedTableaus;
       if (links && links.includes(source.id)) {
          if (state.effectState.lastLinkedPlayed === source.id) return false;
       }
       return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
       const links = state.effectState.linkedTableaus;
       if (links && links.includes(context.source)) {
          return { effectState: { ...state.effectState, lastLinkedPlayed: context.source } };
       }
       return {};
    }
  },
  {
    id: 'parasite_pile',
    name: 'Parasite Pile',
    type: 'epic',
    description: 'Tableau steals cards every 7 moves. Stolen cards score 3x.',
    onActivate: (state) => ({ effectState: { ...state.effectState, parasiteTarget: 'tableau-6' } }),
    onMoveComplete: (state) => {
       if (state.moves % 7 === 0) {
          // Logic handled in App.tsx or here? Ideally here but we need pile access.
          // For now just flag it.
          return { effectState: { ...state.effectState, parasiteActive: true } };
       }
       return {};
    },
    calculateScore: (score, context) => context.cards[0].meta?.stolen ? score * 3 : score
  },
  {
    id: 'ritual_components',
    name: 'Ritual Components',
    type: 'epic',
    description: 'Collect Blood (Hearts), Bone (Diamonds), Ash (Clubs/Spades) in sequence.',
    onMoveComplete: (state, context) => {
       const suit = context.cards[0].suit;
       const seq = state.effectState.ritualSequence || [];
       let next = '';
       if (seq.length === 0 && suit === 'hearts') next = 'blood';
       if (seq.length === 1 && suit === 'diamonds') next = 'bone';
       if (seq.length === 2 && (suit === 'clubs' || suit === 'spades')) next = 'ash';
       
       if (next) {
          const newSeq = [...seq, next];
          if (newSeq.length === 3) return { score: state.score + 666, effectState: { ...state.effectState, ritualSequence: [] } };
          return { effectState: { ...state.effectState, ritualSequence: newSeq } };
       }
       return {};
    }
  },
  {
    id: 'momentum_tokens',
    name: 'Momentum Tokens',
    type: 'epic',
    description: 'Build tokens on pile. Spend for wild/unlock/pts.',
    onMoveComplete: (state) => ({ effectState: { ...state.effectState, momentum: (state.effectState.momentum || 0) + 1 } })
  }
];
