import { GameEffect, Suit, Card, Rank, Pile, GameState, MoveContext } from '../types';
import { getNextLowerRank, getOrderedRankValue, isHighestRank, isNextHigherInOrder, isNextLowerInOrder } from '../utils/rankOrder';

// Effects RNG control — allows the app to inject a seeded RNG for deterministic runs.
const __ORIG_MATH_RANDOM = Math.random;
export const setEffectsRng = (fn: () => number) => { (Math as any).random = fn; };
export const resetEffectsRng = () => { (Math as any).random = __ORIG_MATH_RANDOM; };

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
    charges: {},
    // Wander compatibility fields
    resources: { handSize: 5, shuffles: 0, discards: 0 },
    rules: {},
    run: {
      inventory: { items: [], fortunes: [] },
      unlockedWanders: [],
      activeQuests: [],
      statuses: []
    }
  };
};

export const EFFECTS_REGISTRY: GameEffect[] = [
  // BLESSINGS
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    type: 'blessing',
    description: 'Tableau plays allow +-1 rank',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (target.type === 'tableau' && cards.length === 1) {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return isHighestRank(moving.rank);
        const rankDiff = Math.abs(moving.rank - targetCard.rank);
        return rankDiff <= 1 && getCardColor(moving.suit) !== getCardColor(targetCard.suit);
      }
      return defaultAllowed;
    },
    calculateScore: (score, context, state) => score + 10, // Rank-based bonus
    calculateCoinTransaction: (delta, context, state) => delta + 5 // Basic coin gain
  },
  {
    id: 'vagrant',
    name: 'Vagrant',
    type: 'blessing',
    description: '+2 tableaus',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      const currentTableaus = Object.keys(newPiles).filter(k => k.startsWith('tableau')).length;
      newPiles[`tableau-${currentTableaus}`] = { id: `tableau-${currentTableaus}`, type: 'tableau', cards: [] };
      newPiles[`tableau-${currentTableaus + 1}`] = { id: `tableau-${currentTableaus + 1}`, type: 'tableau', cards: [] };
      return { piles: newPiles };
    },
    calculateScore: (score, context, state) => score * 1.1 // Achievement-based scaling
  },
  {
    id: 'maneki_neko',
    name: 'Maneki-Neko',
    type: 'blessing',
    description: 'Tableau plays ignore suit, foundation plays ignore rank',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (target.type === 'tableau') {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return isHighestRank(moving.rank);
        return isNextLowerInOrder(moving.rank, targetCard.rank);
      }
      if (target.type === 'foundation') {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return moving.rank === 1;
        return moving.suit === targetCard.suit;
      }
      return defaultAllowed;
    },
    calculateCoinTransaction: (delta, context, state) => delta * 1.15 // Multipliers
  },
  {
    id: 'tortoiseshell',
    name: 'Tortoiseshell',
    type: 'blessing',
    description: 'Tableau plays ignore rank, foundation plays ignore suit',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (target.type === 'tableau') {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return isHighestRank(moving.rank);
        return getCardColor(moving.suit) !== getCardColor(targetCard.suit);
      }
      if (target.type === 'foundation') {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return moving.rank === 1;
        return isNextHigherInOrder(moving.rank, targetCard.rank);
      }
      return defaultAllowed;
    },
    calculateScore: (score, context, state) => score + 15 // Conditional by suit
  },
  {
    id: 'schemer',
    name: 'Schemer',
    type: 'blessing',
    description: 'Foundation cards can be played to tableaus',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (source.type === 'foundation' && target.type === 'tableau') {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return isHighestRank(moving.rank);
        return getCardColor(moving.suit) !== getCardColor(targetCard.suit) && isNextLowerInOrder(moving.rank, targetCard.rank);
      }
      return defaultAllowed;
    },
    calculateCoinTransaction: (delta, context, state) => delta + 10 // Conditional by action
  },
  {
    id: 'thief',
    name: 'Thief',
    type: 'blessing',
    description: 'Play buried face-up cards without moving their stack',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (source.type === 'tableau' && target.type === 'foundation' && cards.length === 1) {
        const cardIndex = source.cards.findIndex(c => c.id === cards[0].id);
        return cardIndex >= 0 && source.cards[cardIndex].faceUp;
      }
      return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
      // Trigger events
      return { score: state.score + 5 };
    }
  },
  {
    id: 'hoarder',
    name: 'Hoarder',
    type: 'blessing',
    description: 'Consecutive same-suit plays stack +100% points each',
    calculateScore: (score, context, state) => {
      if (context.cards[0].suit === state.effectState.lastPlayedSuit) {
        state.effectState.lastPlayedSuit = context.cards[0].suit;
        return score * 2;
      }
      state.effectState.lastPlayedSuit = context.cards[0].suit;
      return score;
    },
    calculateCoinTransaction: (delta, context, state) => delta + 20 // Achievement-based
  },
  {
    id: 'pedant',
    name: 'Pedant',
    type: 'blessing',
    description: 'All tableau cards face-up',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      Object.keys(newPiles).filter(k => k.startsWith('tableau')).forEach(key => {
        newPiles[key].cards.forEach(card => card.faceUp = true);
      });
      return { piles: newPiles };
    },
    transformCardVisual: (card, pile) => ({ faceUp: true }) // Visual transformations
  },
  {
    id: 'wizard',
    name: 'Wizard',
    type: 'blessing',
    description: '+2 foundations',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
      const existingFoundations = Object.keys(newPiles).filter(k => k.startsWith('foundation'));
      for (let i = 0; i < 2; i++) {
        const suit = suits[(existingFoundations.length + i) % 4];
        newPiles[`foundation-${suit}-${i}`] = { id: `foundation-${suit}-${i}`, type: 'foundation', cards: [] };
      }
      return { piles: newPiles };
    },
    calculateScore: (score, context, state) => score * 1.05 // Progressive scaling
  },
  {
    id: 'alchemist',
    name: 'Alchemist',
    type: 'blessing',
    description: '+20% coin from all sources',
    calculateCoinTransaction: (delta, context, state) => delta * 1.2
  },
  {
    id: 'charlatan',
    name: 'Charlatan',
    type: 'blessing',
    description: 'Build tableau up or down by rank',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (target.type === 'tableau' && cards.length === 1) {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return isHighestRank(moving.rank);
        return Math.abs(moving.rank - targetCard.rank) === 1 && getCardColor(moving.suit) !== getCardColor(targetCard.suit);
      }
      return defaultAllowed;
    },
    calculateScore: (score, context, state) => score + 20 // Sequence-based
  },
  {
    id: 'martyr',
    name: 'Martyr',
    type: 'blessing',
    description: 'Sacrifice 1 foundation. Return its cards to the deck.',
    onActivate: (state) => {
      const foundations = Object.keys(state.piles).filter(k => k.startsWith('foundation'));
      if (foundations.length > 0) {
        const sacrifice = foundations[Math.floor(Math.random() * foundations.length)];
        const cards = state.piles[sacrifice].cards;
        state.piles['deck'].cards.push(...cards);
        delete state.piles[sacrifice];
      }
      return { piles: state.piles };
    }
  },
  {
    id: 'jester',
    name: 'Jester',
    type: 'blessing',
    description: 'Skip a fear encounter. 2 charges',
    maxCharges: 2,
    chargeReset: 'encounter'
  },
  {
    id: 'trickster',
    name: 'Trickster',
    type: 'blessing',
    description: 'Add a key to your hand. 3 charges',
    maxCharges: 3
  },
  {
    id: 'timekeeper',
    name: 'Timekeeper',
    type: 'blessing',
    description: 'Return the last 5 cards you played to your hand (1 charge)',
    maxCharges: 1
  },
  {
    id: 'klabautermann',
    name: 'Klabautermann',
    type: 'blessing',
    description: 'Once per encounter, you may discard your hand to draw 5 cards.',
    maxCharges: 1,
    chargeReset: 'encounter'
  },
  {
    id: 'lobbyist',
    name: 'Lobbyist',
    type: 'blessing',
    description: 'Combine black suits & red suits',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (target.type === 'tableau' && cards.length === 1) {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return isHighestRank(moving.rank);
        const movingColor = getCardColor(moving.suit);
        const targetColor = getCardColor(targetCard.suit);
        return movingColor === targetColor && isNextLowerInOrder(moving.rank, targetCard.rank);
      }
      return defaultAllowed;
    },
    calculateCoinTransaction: (delta, context, state) => delta + 25 // Gambling: random win/loss
  },
  {
    id: 'impersonator',
    name: 'Impersonator',
    type: 'blessing',
    description: 'Add a wild card to your hand (3 charges)',
    maxCharges: 3
  },
  {
    id: 'whore_of_galore',
    name: 'Whore of Galore',
    type: 'blessing',
    description: '+1 wild foundation',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      newPiles['foundation-wild'] = { id: 'foundation-wild', type: 'foundation', cards: [] };
      return { piles: newPiles };
    }
  },
  {
    id: 'merchant',
    name: 'Merchant',
    type: 'blessing',
    description: 'Pay 2× goal with coin to skip encounter'
  },
  // EXPLOITS
  {
    id: 'mad_king',
    name: 'Mad King',
    type: 'exploit',
    description: '+4 Ace of Crowns in deck. Move as Ace, Jack or King',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      const deck = newPiles['deck'].cards;
      for (let i = 0; i < 4; i++) {
        deck.push({ id: `crown-ace-${i}`, suit: 'special', rank: 1, faceUp: false });
      }
      return { piles: newPiles };
    },
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (cards[0].suit === 'special' && cards[0].rank === 1) {
        if (target.type === 'foundation') {
          return true;
        }
        if (target.type === 'tableau') {
          const targetCard = target.cards[target.cards.length - 1];
          if (!targetCard) return true;
          return isNextLowerInOrder(11, targetCard.rank) || isNextLowerInOrder(13, targetCard.rank) || isNextLowerInOrder(1, targetCard.rank);
        }
      }
      return defaultAllowed;
    },
    calculateScore: (score, context, state) => score * 1.5 // Special conditions
  },
  {
    id: 'high_society',
    name: 'High Society',
    type: 'exploit',
    description: 'Hand to foundation plays x2 points',
    calculateScore: (score, context, state) => {
      if (context.source === 'hand' && context.target.startsWith('foundation')) {
        return score * 2;
      }
      return score;
    }
  },
  {
    id: 'compound_interest',
    name: 'Compound Interest',
    type: 'exploit',
    description: 'Each foundation play gives +10% points gained. Each reveal gives +5% current coins.',
    onMoveComplete: (state, context) => {
      if (context.target.startsWith('foundation')) {
        state.scoreMultiplier *= 1.1;
      }
      if (context.cards.some(c => !c.faceUp)) {
        state.coinMultiplier *= 1.05;
      }
      return { scoreMultiplier: state.scoreMultiplier, coinMultiplier: state.coinMultiplier };
    }
  },
  {
    id: 'anarchist_cookbook',
    name: 'Anarchist\'s Cookbook',
    type: 'exploit',
    description: 'Build foundations in any order',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (target.type === 'foundation') {
        return true;
      }
      return defaultAllowed;
    }
  },
  {
    id: 'switcheroo',
    name: 'Switcheroo',
    type: 'exploit',
    description: 'Undo last 3 plays for -50 coins'
  },
  {
    id: 'master_debater',
    name: 'Master Debater',
    type: 'exploit',
    description: 'Disable a curse for 1 encounter'
  },
  {
    id: 'insider_trading',
    name: 'Insider Trading',
    type: 'exploit',
    description: 'All face cards visible → x3 encounter reward'
  },
  {
    id: 'liquid_assets',
    name: 'Liquid Assets',
    type: 'exploit',
    description: 'Convert between points & coins (3:1 or 5:1)'
  },
  {
    id: 'keen_instincts',
    name: 'Keen Instincts',
    type: 'exploit',
    description: 'Revealed cards ignores rank & give +10 coin if played immediately.',
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (cards.some(c => !c.faceUp)) {
        return true;
      }
      return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
      if (context.cards.some(c => !c.faceUp)) {
        return { coins: state.coins + 10 };
      }
      return {};
    }
  },
  {
    id: 'venture_capitol',
    name: 'Venture Capitol',
    type: 'exploit',
    description: 'Foundation plays give +20 coin. Foundation completions give +100 coin.',
    calculateCoinTransaction: (delta, context, state) => {
      if (context.target.startsWith('foundation')) {
        delta += 20;
        const targetPile = state.piles[context.target];
        if (targetPile.cards.length === 13) {
          delta += 100;
        }
      }
      return delta;
    }
  },
  {
    id: 'one_armed_bandit',
    name: 'One-Armed Bandit',
    type: 'exploit',
    description: 'Have 3 sevens face up at once → Slots →',
    onMoveComplete: (state, context) => {
      const faceUpSevens = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === 7)).length;
      if (faceUpSevens >= 3) {
        return { triggerMinigame: 'slots' };
      }
      return {};
    }
  },
  {
    id: 'fancy_8_ball',
    name: 'Fancy 8-ball',
    type: 'exploit',
    description: '4 eights face up at once → Pool →',
    onMoveComplete: (state, context) => {
      const faceUpEights = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === 8)).length;
      if (faceUpEights >= 4) {
        return { triggerMinigame: 'pool' };
      }
      return {};
    }
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    type: 'exploit',
    description: 'Have 4 nines → Pinball →',
    onMoveComplete: (state, context) => {
      const faceUpNines = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === 9)).length;
      if (faceUpNines >= 4) {
        return { triggerMinigame: 'pinball' };
      }
      return {};
    }
  },
  {
    id: 'panopticon',
    name: 'Panopticon',
    type: 'exploit',
    description: 'Have 4 tens face up at once → Darts',
    onMoveComplete: (state, context) => {
      const faceUpTens = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === 10)).length;
      if (faceUpTens >= 4) {
        return { triggerMinigame: 'darts' };
      }
      return {};
    }
  },
  {
    id: 'counting_cards',
    name: 'Counting Cards',
    type: 'exploit',
    description: '4 Jacks face up at once → Blackjack →',
    onMoveComplete: (state, context) => {
      const faceUpJacks = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === 11)).length;
      if (faceUpJacks >= 4) {
        return { triggerMinigame: 'blackjack' };
      }
      return {};
    }
  },
  {
    id: 'russian_roulette',
    name: 'Russian Roulette',
    type: 'exploit',
    description: 'Have 4 Kings face up at once → Roulette',
    onMoveComplete: (state, context) => {
      const faceUpKings = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === 13)).length;
      if (faceUpKings >= 4) {
        return { triggerMinigame: 'roulette' };
      }
      return {};
    }
  },
  {
    id: 'rose_colored_glasses',
    name: 'Rose Colored Glasses',
    type: 'exploit',
    description: 'Have 4 of a kind face up with 2, 3, 4, or 5 → Poker',
    onMoveComplete: (state, context) => {
      const ranks = [2,3,4,5];
      for (const rank of ranks) {
        const count = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === rank)).length;
        if (count >= 4) {
          return { triggerMinigame: 'poker' };
        }
      }
      return {};
    }
  },
  {
    id: 'weighted_dice',
    name: 'Weighted Dice',
    type: 'exploit',
    description: '3 sixes in foundations but no sevens → Devil\'s Dice → Roll three dice, gain coins equal to the sum times 100, and then remove the sixes from foundations.',
    onMoveComplete: (state, context) => {
      const foundationSixes = Object.keys(state.piles).filter(k => k.startsWith('foundation')).reduce((count, key) => {
        return count + state.piles[key].cards.filter(c => c.rank === 6).length;
      }, 0);
      const hasSevens = Object.values(state.piles).some(p => p.cards.some(c => c.rank === 7));
      if (foundationSixes >= 3 && !hasSevens) {
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const dice3 = Math.floor(Math.random() * 6) + 1;
        const sum = dice1 + dice2 + dice3;
        const reward = sum * 100;
        const newPiles = { ...state.piles };
        Object.keys(newPiles).filter(k => k.startsWith('foundation')).forEach(key => {
          newPiles[key].cards = newPiles[key].cards.filter(c => c.rank !== 6);
        });
        return { piles: newPiles, coins: state.coins + reward };
      }
      return {};
    }
  },
  {
    id: 'tax_loophole',
    name: 'Tax Loophole',
    type: 'exploit',
    description: 'Buy a key for 25% of your coin. It works anywhere.'
  },
  // CURSES
  {
    id: 'reverse_psychology',
    name: 'Reverse Psychology',
    type: 'curse',
    description: 'Every 5 moves, flip gameboard horizontally, then vertically, then horizontally, then vertically, & so on. Completed foundations remove 1 flip from 4 possible.',
    onActivate: (state) => {
      state.effectState.flipCount = 0;
      state.effectState.maxFlips = 4;
      return {};
    },
    onMoveComplete: (state, context) => {
      if (state.moves % 5 === 0 && state.effectState.flipCount < state.effectState.maxFlips) {
        // Implement board flipping: reverse tableau order
        const tableaus = Object.keys(state.piles).filter(k => k.startsWith('tableau')).sort();
        const reversed = tableaus.reverse();
        const newPiles = { ...state.piles };
        reversed.forEach((key, i) => {
          newPiles[`tableau-${i}`] = state.piles[key];
          newPiles[`tableau-${i}`].id = `tableau-${i}`;
        });
        tableaus.forEach(key => {
          if (!reversed.includes(key)) delete newPiles[key];
        });
        state.effectState.flipCount++;
        return { piles: newPiles };
      }
      // Check completed foundations to reduce flips
      const completed = Object.keys(state.piles).filter(k => k.startsWith('foundation') && state.piles[k].cards.length === 13).length;
      state.effectState.maxFlips = Math.max(0, 4 - completed);
      return {};
    }
  },
  {
    id: 'flesh_wound',
    name: 'Flesh Wound',
    type: 'curse',
    description: 'Add a wound card to your hand that increases the score goal by 10% each cycle. Find 2 bandage cards hidden in random tableau to remove the wound.',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      newPiles['hand'].cards.push({ id: 'wound', suit: 'special', rank: 0, faceUp: true });
      const tableaus = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
      for (let i = 0; i < 2; i++) {
        const tableau = tableaus[Math.floor(Math.random() * tableaus.length)];
        const insertIndex = Math.floor(Math.random() * (newPiles[tableau].cards.length + 1));
        newPiles[tableau].cards.splice(insertIndex, 0, { id: `bandage-${i}`, suit: 'special', rank: 0, faceUp: false });
      }
      state.effectState.woundCycles = 0;
      return { piles: newPiles };
    },
    onMoveComplete: (state, context) => {
      if (context.cards.some(c => c.id.startsWith('bandage'))) {
        state.piles['hand'].cards = state.piles['hand'].cards.filter(c => c.id !== 'wound');
        state.effectState.woundCycles++;
        state.currentScoreGoal *= 1.1; // Increase goal
      }
      return { currentScoreGoal: state.currentScoreGoal };
    },
    calculateScore: (score, context, state) => score * 0.9 // Negative score
  },
  {
    id: 'schrondinger_deck',
    name: 'Schrödinger\'s Deck',
    type: 'curse',
    description: 'Tableaus have a 50% chance of existing or not after each play. At least 3 tableau exist at any given moment.',
    onMoveComplete: (state, context) => {
      const tableaus = Object.keys(state.piles).filter(k => k.startsWith('tableau'));
      if (tableaus.length > 3) {
        tableaus.forEach(key => {
          if (Math.random() < 0.5) {
            delete state.piles[key];
          }
        });
      }
      while (Object.keys(state.piles).filter(k => k.startsWith('tableau')).length < 3) {
        const newId = `tableau-${Object.keys(state.piles).length}`;
        state.piles[newId] = { id: newId, type: 'tableau', cards: [] };
      }
      return { piles: state.piles };
    }
  },
  {
    id: 'caged_bakeneko',
    name: 'Caged Bakeneko',
    type: 'curse',
    description: '3 tableau locked. 4 keys hidden in other tableau. Unlock a random tableau at 50% of score goal.',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      const tableaus = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
      for (let i = 0; i < 3; i++) {
        newPiles[tableaus[i]].locked = true;
      }
      for (let i = 0; i < 4; i++) {
        const tableau = tableaus[Math.floor(Math.random() * tableaus.length)];
        const insertIndex = Math.floor(Math.random() * (newPiles[tableau].cards.length + 1));
        newPiles[tableau].cards.splice(insertIndex, 0, { id: `key-${i}`, suit: 'special', rank: 0, faceUp: false });
      }
      return { piles: newPiles };
    },
    onMoveComplete: (state, context) => {
      if (state.score >= state.currentScoreGoal * 0.5) {
        const locked = Object.keys(state.piles).filter(k => k.startsWith('tableau') && state.piles[k].locked);
        if (locked.length > 0) {
          const unlock = locked[Math.floor(Math.random() * locked.length)];
          state.piles[unlock].locked = false;
        }
      }
      return { piles: state.piles };
    }
  },
  {
    id: 'street_smarts',
    name: 'Street Smarts',
    type: 'curse',
    description: 'Complete encounter by gaining goal in coins, not points. x5 coins gained. Only keep 10% as a reward.'
  },
  {
    id: 'counterfeiting',
    name: 'Counterfeiting',
    type: 'curse',
    description: 'Duplicate all cards before dealing. -50% points gained. Cards with same rank can be stacked.',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      const deck = newPiles['deck'].cards;
      const duplicated = deck.map(c => ({ ...c, id: c.id + '-dup' }));
      newPiles['deck'].cards = [...deck, ...duplicated];
      return { piles: newPiles };
    },
    calculateScore: (score, context, state) => score * 0.5,
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (target.type === 'tableau' && cards.length === 1) {
        const moving = cards[0];
        const targetCard = target.cards[target.cards.length - 1];
        if (!targetCard) return true;
        return moving.rank === targetCard.rank;
      }
      return defaultAllowed;
    }
  },
  {
    id: 'fog_of_war',
    name: 'Fog of War',
    type: 'curse',
    description: 'Only rank & color visible. Suit hidden. Every 10 moves, reduce score of faceup tableau cards ±1 rank.',
    transformCardVisual: (card, pile) => {
      if (pile?.type === 'tableau') {
        return { suit: 'special' };
      }
      return {};
    },
    onMoveComplete: (state, context) => {
      if (state.moves % 10 === 0) {
        const newPiles = { ...state.piles };
        Object.keys(newPiles).filter(k => k.startsWith('tableau')).forEach(key => {
          newPiles[key].cards.forEach(c => {
            if (c.faceUp) {
              c.rank = Math.max(1, Math.min(13, c.rank + (Math.random() < 0.5 ? -1 : 1))) as Rank;
            }
          });
        });
        return { piles: newPiles };
      }
      return {};
    }
  },
  {
    id: 'mood_swings',
    name: 'Mood Swings',
    type: 'curse',
    description: 'Odd/even ranks alternate scoring 0 every 6/7 plays. x2 scoring. Shuffle face-up ranks every 5 plays.',
    calculateScore: (score, context, state) => {
      const cycle = Math.floor(state.moves / 13);
      const position = state.moves % 13;
      if ((position >= 6 && position <= 7) || (position >= 12)) {
        return 0;
      }
      return score * 2;
    },
    onMoveComplete: (state, context) => {
      if (state.moves % 5 === 0) {
        const newPiles = { ...state.piles };
        Object.values(newPiles).forEach(pile => {
          pile.cards.forEach(c => {
            if (c.faceUp) {
              c.rank = Math.ceil(Math.random() * 13) as Rank;
            }
          });
        });
        return { piles: newPiles };
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
      const newPiles = { ...state.piles };
      const deck = newPiles['deck'].cards;
      const tableaus = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
      const cardsPerTableau = Math.floor(deck.length / tableaus.length);
      tableaus.forEach((key, i) => {
        newPiles[key].cards = deck.slice(i * cardsPerTableau, (i + 1) * cardsPerTableau);
      });
      newPiles['deck'].cards = [];
      return { piles: newPiles };
    },
    calculateCoinTransaction: (delta, context, state) => 0,
    calculateScore: (score, context, state) => score * 3
  },
  {
    id: 'tower_of_babel',
    name: 'Tower of Babel',
    type: 'curse',
    description: ' +4 empty tableau. No foundations. No score. Advance by stacking all 4 suits in a the tableau.',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      for (let i = 0; i < 4; i++) {
        newPiles[`tableau-extra-${i}`] = { id: `tableau-extra-${i}`, type: 'tableau', cards: [] };
      }
      Object.keys(newPiles).filter(k => k.startsWith('foundation')).forEach(key => delete newPiles[key]);
      return { piles: newPiles };
    },
    calculateScore: (score, context, state) => 0,
    onMoveComplete: (state, context) => {
      const tableaus = Object.values(state.piles).filter(p => p.type === 'tableau');
      for (const tableau of tableaus) {
        const suits = new Set(tableau.cards.map(c => c.suit));
        if (suits.size === 4) {
          return { isLevelComplete: true };
        }
      }
      return {};
    }
  },
  {
    id: 'revolving_door',
    name: 'Revolving Door',
    type: 'curse',
    description: 'Foundations only keep their top card & return the rest to the deck. Rearrange face up tableau cards every discard, or play all 5 hand cards to instead shuffle face-down tableau cards with your deck the next 2 discards.',
    onMoveComplete: (state, context) => {
      if (context.target.startsWith('foundation')) {
        const pile = state.piles[context.target];
        if (pile.cards.length > 1) {
          const toReturn = pile.cards.slice(0, -1);
          state.piles['deck'].cards.push(...toReturn);
          pile.cards = [pile.cards[pile.cards.length - 1]];
        }
      }
      if (context.target === 'deck') {
        const faceUpCards = Object.values(state.piles).filter(p => p.type === 'tableau').flatMap(p => p.cards.filter(c => c.faceUp));
        faceUpCards.sort(() => Math.random() - 0.5);
        // Redistribute to tableaus
        const tableaus = Object.keys(state.piles).filter(k => k.startsWith('tableau'));
        faceUpCards.forEach((card, i) => {
          const tableau = tableaus[i % tableaus.length];
          state.piles[tableau].cards.push(card);
        });
        // Remove from original
        Object.values(state.piles).forEach(p => {
          p.cards = p.cards.filter(c => !faceUpCards.includes(c));
        });
      }
      return { piles: state.piles };
    }
  },
  {
    id: 'veil_of_uncertainty',
    name: 'Veil of Uncertainty',
    type: 'curse',
    description: 'Only suit visible. +50% points gained. 33% to stumble to an adjacent tableau for negative score.',
    transformCardVisual: (card, pile) => ({ rank: undefined }),
    calculateScore: (score, context, state) => score * 1.5,
    onMoveComplete: (state, context) => {
      if (Math.random() < 0.33) {
        return { score: state.score - 10 };
      }
      return {};
    }
  },
  {
    id: 'executive_order',
    name: 'Executive Order',
    type: 'curse',
    description: 'All tableaus linked; Must play 1 to each in order, even if not valid. Then rearrange cards freely for 7 moves & score at end. Repeat.',
    onActivate: (state) => {
      state.effectState.currentTableauIndex = 0;
      state.effectState.phase = 'ordered';
      state.effectState.freeMovesLeft = 0;
      return {};
    },
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (target.type === 'tableau') {
        if (state.effectState.phase === 'ordered') {
          const tableaus = Object.keys(state.piles).filter(k => k.startsWith('tableau')).sort();
          const currentIndex = state.effectState.currentTableauIndex || 0;
          if (target.id !== tableaus[currentIndex]) return false;
          state.effectState.currentTableauIndex = (currentIndex + 1) % tableaus.length;
          if (state.effectState.currentTableauIndex === 0) {
            state.effectState.phase = 'free';
            state.effectState.freeMovesLeft = 7;
          }
          return true;
        } else if (state.effectState.phase === 'free') {
          return defaultAllowed;
        }
      }
      return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
      if (state.effectState.phase === 'free') {
        state.effectState.freeMovesLeft--;
        if (state.effectState.freeMovesLeft <= 0) {
          // Score at end
          state.effectState.phase = 'ordered';
          state.effectState.currentTableauIndex = 0;
        }
      }
      return {};
    },
    calculateScore: (score, context, state) => {
      if (state.effectState.phase === 'ordered') return 0;
      return score;
    }
  },
  {
    id: '3_rules_of_3',
    name: '3 rules of 3',
    type: 'curse',
    description: 'Every 3rd play removes 3 cards from your deck for 3 plays. Lowest face-up tableau card moved to deck every 3 plays.',
    onMoveComplete: (state, context) => {
      if (state.moves % 3 === 0) {
        state.piles['deck'].cards.splice(0, 3);
        const faceUpCards = Object.values(state.piles).filter(p => p.type === 'tableau').flatMap(p => p.cards.filter(c => c.faceUp));
        if (faceUpCards.length > 0) {
          const lowest = faceUpCards.reduce((min, c) => c.rank < min.rank ? c : min);
          Object.values(state.piles).forEach(p => {
            p.cards = p.cards.filter(c => c.id !== lowest.id);
          });
          state.piles['deck'].cards.push(lowest);
        }
      }
      return { piles: state.piles };
    }
  },
  {
    id: 'entropy',
    name: 'Entropy',
    type: 'curse',
    description: 'Every 10 plays, shuffle & redeal tableau & foundations from deck. Hand size is 10. Tableau plays from your hand swap places. No discards.',
    onActivate: (state) => {
      state.resources.handSize = 10;
      return {};
    },
    onMoveComplete: (state, context) => {
      if (state.moves % 10 === 0) {
        const allCards = Object.values(state.piles).flatMap(p => p.cards);
        allCards.sort(() => Math.random() - 0.5);
        const tableaus = Object.keys(state.piles).filter(k => k.startsWith('tableau'));
        const foundations = Object.keys(state.piles).filter(k => k.startsWith('foundation'));
        const cardsPerTableau = Math.floor(allCards.length / tableaus.length);
        tableaus.forEach((key, i) => {
          state.piles[key].cards = allCards.slice(i * cardsPerTableau, (i + 1) * cardsPerTableau);
        });
        foundations.forEach(key => {
          state.piles[key].cards = [];
        });
      }
      return { piles: state.piles };
    },
    canMove: (cards, source, target, defaultAllowed, state) => {
      if (source.type === 'hand' && target.type === 'tableau') {
        const handIndex = state.piles['hand'].cards.findIndex(c => c.id === cards[0].id);
        const targetCard = target.cards[target.cards.length - 1];
        if (targetCard) {
          state.piles['hand'].cards[handIndex] = targetCard;
          target.cards[target.cards.length - 1] = cards[0];
        }
        return false;
      }
      if (target.type === 'deck') return false;
      return defaultAllowed;
    }
  },
  // PATTERN TRIGGERS
  {
    id: 'get_out_of_jail',
    name: 'Get Out of Jail',
    type: 'pattern_trigger',
    description: 'Have a royal flush face up in a tableau to add finish encounter.',
    onMoveComplete: (state, context) => {
      const tableaus = Object.values(state.piles).filter(p => p.type === 'tableau');
      for (const tableau of tableaus) {
        const faceUp = tableau.cards.filter(c => c.faceUp);
        if (faceUp.length >= 5) {
          const suits = faceUp.map(c => c.suit);
          const ranks = faceUp.map(c => c.rank).sort((a,b) => a - b);
          if (suits.every(s => s === suits[0]) && ranks.join(',') === '1,10,11,12,13') {
            return { isLevelComplete: true };
          }
        }
      }
      return {};
    }
  },
  {
    id: 'loaded_deck',
    name: 'Loaded Deck',
    type: 'pattern_trigger',
    description: 'Have 4 Aces face up at once → Add 2 wild Aces to your deck for rest of run.',
    onMoveComplete: (state, context) => {
      const aceCount = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === 1)).length;
      if (aceCount >= 4) {
        const deck = state.piles['deck'].cards;
        for (let i = 0; i < 2; i++) {
          deck.push({ id: `wild-ace-${i}`, suit: 'special', rank: 1, faceUp: false });
        }
        return { piles: state.piles };
      }
      return {};
    }
  },
  {
    id: 'nepotism',
    name: 'Nepotism',
    type: 'pattern_trigger',
    description: 'Have 4 Queens face up at once → 25% discount in next trade.',
    onMoveComplete: (state, context) => {
      const queenCount = Object.values(state.piles).flatMap(p => p.cards.filter(c => c.faceUp && c.rank === 12)).length;
      if (queenCount >= 4) {
        state.effectState.discount = 0.25;
      }
      return {};
    }
  },
  {
    id: 'breaking_entering',
    name: 'Breaking & Entering',
    type: 'pattern_trigger',
    description: 'Have a Full House face up in a tableau → Unlock all tableau.',
    onMoveComplete: (state, context) => {
      const tableaus = Object.values(state.piles).filter(p => p.type === 'tableau');
      for (const tableau of tableaus) {
        const faceUp = tableau.cards.filter(c => c.faceUp);
        const rankCounts = {};
        faceUp.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);
        const counts = Object.values(rankCounts);
        if (counts.includes(3) && counts.includes(2)) {
          Object.keys(state.piles).filter(k => k.startsWith('tableau')).forEach(key => {
            state.piles[key].locked = false;
          });
          return { piles: state.piles };
        }
      }
      return {};
    }
  }
];