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
  
  // Create and deal tableau piles (7 columns, 1-7 cards each, top cards face up)
  for (let col = 0; col < 7; col++) {
    piles[`tableau-${col}`] = { id: `tableau-${col}`, type: 'tableau', cards: [] };
  }
  
  // Deal cards to tableaus
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      if (card) {
        card.faceUp = (row === col); // Only top card is face up
        piles[`tableau-${col}`].cards.push(card);
      }
    }
  }
  
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
  {
    id: 'blacksmith',
    name: 'Blacksmith',
    type: 'blessing',
    description: 'Foundation plays allow ±1 rank.',
    canMove: (cards, source, target, defaultAllowed) => {
      if (target.type === 'foundation' && target.cards.length > 0) {
        const moving = cards[0];
        const top = target.cards[target.cards.length - 1];
        const step = Math.abs(moving.rank - top.rank) === 1;
        return moving.suit === top.suit && step;
      }
      return defaultAllowed;
    }
  },
  {
    id: 'vagrant',
    name: 'Vagrant',
    type: 'blessing',
    description: '+2 tableaus.',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      const next = Object.keys(newPiles).filter(k => k.startsWith('tableau')).length;
      newPiles[`tableau-${next}`] = { id: `tableau-${next}`, type: 'tableau', cards: [] };
      newPiles[`tableau-${next+1}`] = { id: `tableau-${next+1}`, type: 'tableau', cards: [] };
      return { piles: newPiles };
    }
  },
  {
    id: 'maneki_neko',
    name: 'Maneki-Neko',
    type: 'blessing',
    description: 'Tableau plays ignore suit, foundation plays ignore rank.',
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
  },
  {
    id: 'tortoiseshell',
    name: 'Tortoiseshell',
    type: 'blessing',
    description: 'Tableau plays ignore rank, foundation plays ignore suit.',
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
  },
  {
    id: 'schemer',
    name: 'Schemer',
    type: 'blessing',
    description: 'Foundation cards can be played to tableaus.',
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
  },
  {
    id: 'thief',
    name: 'Thief',
    type: 'blessing',
    description: 'Play buried face-up cards without moving their stack.',
    canMove: (cards, source, target, defaultAllowed) => {
      if (source.type === 'tableau' && cards.length === 1) {
        const card = cards[0];
        const idx = source.cards.findIndex(c => c.id === card.id);
        const isBuried = idx < source.cards.length - 1;
        if (isBuried && card.faceUp) return true;
      }
      return defaultAllowed;
    }
  },
  {
    id: 'hoarder',
    name: 'Hoarder',
    type: 'blessing',
    description: 'Consecutive same-suit plays stack +100% points each.',
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
  },
  {
    id: 'pedant',
    name: 'Pedant',
    type: 'blessing',
    description: 'All tableau cards face-up.',
    transformCardVisual: (card, pile) => pile?.type === 'tableau' ? { faceUp: true } : {}
  },
  {
    id: 'wizard',
    name: 'Wizard',
    type: 'blessing',
    description: '+2 foundations.',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      const count = Object.keys(newPiles).filter(k => k.startsWith('foundation')).length;
      newPiles[`foundation-extra-${count}`] = { id: `foundation-extra-${count}`, type: 'foundation', cards: [] };
      newPiles[`foundation-extra-${count+1}`] = { id: `foundation-extra-${count+1}`, type: 'foundation', cards: [] };
      return { piles: newPiles };
    }
  },
  {
    id: 'alchemist',
    name: 'Alchemist',
    type: 'blessing',
    description: '+20% coin from all sources.',
    calculateCoinTransaction: (delta) => Math.floor(delta * 1.2)
  },
  {
    id: 'charlatan',
    name: 'Charlatan',
    type: 'blessing',
    description: 'Build tableau up or down by rank.',
    canMove: (cards, source, target, defaultAllowed) => {
      if (target.type === 'tableau' && target.cards.length > 0) {
        const moving = cards[0];
        const top = target.cards[target.cards.length - 1];
        const isAlt = getCardColor(moving.suit) !== getCardColor(top.suit);
        return isAlt && (isNextHigherInOrder(moving.rank, top.rank) || isNextLowerInOrder(moving.rank, top.rank));
      }
      return defaultAllowed;
    }
  },
  {
    id: 'martyr',
    name: 'Martyr',
    type: 'blessing',
    description: 'Sacrifice 1 foundation. Return its cards to the deck.',
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
  },
  {
    id: 'jester',
    name: 'Jester',
    type: 'blessing',
    description: 'Add a persistent fear skip card to your hand.',
    onActivate: (state) => {
      const hand = state.piles['hand'];
      const skipCard: Card = { id: `jester-skip-${Date.now()}`, suit: 'special', rank: 0, faceUp: true, meta: { isFearSkip: true, persistent: true } };
      return {
        piles: { ...state.piles, hand: { ...hand, cards: [...hand.cards, skipCard] } }
      };
    }
  },
  {
    id: 'trickster',
    name: 'Trickster',
    type: 'blessing',
    description: 'Add a persistent key to your hand.',
    onActivate: (state, activeEffects) => {
      const hand = state.piles['hand'];
      const keyCard: Card = { id: `trickster-key-${Date.now()}`, suit: 'special', rank: 0, faceUp: true, meta: { isKey: true, persistent: true } };
      return {
        piles: { ...state.piles, hand: { ...hand, cards: [...hand.cards, keyCard] } }
      };
    }
  },
  {
    id: 'timekeeper',
    name: 'Timekeeper',
    type: 'blessing',
    description: 'Return the last 5 cards you played to your hand (1 charge).',
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
  },
  {
    id: 'klabautermann',
    name: 'Klabautermann',
    type: 'blessing',
    description: 'Once per encounter, you may discard your hand to draw 5 cards.',
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
  },
  {
    id: 'lobbyist',
    name: 'Lobbyist',
    type: 'blessing',
    description: 'Combine black suits & red suits.',
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
  },
  {
    id: 'impersonator',
    name: 'Impersonator',
    type: 'blessing',
    description: 'Add a persistent wild card to your hand.',
    onActivate: (state) => {
      const hand = state.piles['hand'];
      const wild: Card = { id: `impersonator-wild-${Date.now()}`, suit: 'special', rank: 0, faceUp: true, meta: { isWild: true, persistent: true } };
      return {
        piles: { ...state.piles, hand: { ...hand, cards: [...hand.cards, wild] } }
      };
    },
    canMove: (cards, source, target, defaultAllowed) => (cards.length === 1 && cards[0].meta?.isWild) ? true : defaultAllowed
  },
  {
    id: 'whore_of_galore',
    name: 'Whore of Galore',
    type: 'blessing',
    description: '+1 wild foundation.',
    onActivate: (state, activeEffects) => {
      const fid = `foundation-wild-${Date.now()}`;
      const newPiles = { ...state.piles, [fid]: { id: fid, type: 'foundation', cards: [], meta: { isWildFoundation: true } } };
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
  },
  {
    id: 'merchant',
    name: 'Merchant',
    type: 'blessing',
    description: 'Pay 2× goal with coin to skip encounter.',
    onActivate: (state) => {
      const cost = state.currentScoreGoal * 2;
      if (state.coins < cost) return {};
      return { coins: state.coins - cost, effectState: { ...state.effectState, skipEncounter: true } };
    }
  },
  {
    id: 'mad_king',
    name: 'Mad King',
    type: 'exploit',
    description: '+4 Ace of Crowns in deck. Move as Ace, Jack or King.',
    onActivate: (state) => {
      const deck = state.piles['deck'];
      const crowns: Card[] = Array.from({ length: 4 }).map((_, i) => ({
        id: `crown-${i}-${Date.now()}`, suit: 'special', rank: 1, faceUp: false,
        meta: { crown: true, virtualRanks: [1, 11, 13] }
      }));
      const newDeck = [...deck.cards, ...crowns];
      newDeck.sort(() => Math.random() - 0.5);
      return { piles: { ...state.piles, deck: { ...deck, cards: newDeck } } };
    },
    canMove: (cards, source, target, defaultAllowed) => {
      const c = cards[0];
      if (!c.meta?.crown) return defaultAllowed;
      const top = target.cards[target.cards.length - 1];
      const tryRanks: Rank[] = [1, 11, 13];
      return tryRanks.some(r => {
        const virtual = { ...c, rank: r };
        if (target.type === 'tableau') {
          if (!top) return isHighestRank(virtual.rank);
          return getCardColor(virtual.suit) !== getCardColor(top.suit) &&
                 isNextLowerInOrder(virtual.rank, top.rank);
        }
        if (target.type === 'foundation') {
          if (!top) return virtual.rank === 1;
          return virtual.suit === top.suit && isNextHigherInOrder(virtual.rank, top.rank);
        }
        return false;
      });
    }
  },
  {
    id: 'high_society',
    name: 'High Society',
    type: 'exploit',
    description: 'Hand to foundation plays x2 points.',
    calculateScore: (score, context) =>
      (context.source === 'hand' && context.target.includes('foundation')) ? score * 2 : score
  },
  {
    id: 'compound_interest',
    name: 'Compound Interest',
    type: 'exploit',
    description: 'Each foundation play gives +10% points gained. Each reveal gives +5% current coins.',
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
  },
  {
    id: 'anarchists_cookbook',
    name: "Anarchist's Cookbook",
    type: 'exploit',
    description: 'Build foundations in any order once aces are placed.',
    canMove: (cards, source, target, defaultAllowed) => {
      if (target.type === 'foundation') {
        const moving = cards[0]; const top = target.cards[target.cards.length - 1];
        if (!top) return moving.rank === 1; // Only allow aces on empty foundations
        return moving.suit === top.suit && (isNextHigherInOrder(moving.rank, top.rank) ||
               isNextLowerInOrder(moving.rank, top.rank));
      }
      return defaultAllowed;
    }
  },
  {
    id: 'switcheroo',
    name: 'Switcheroo',
    type: 'exploit',
    description: 'Undo last 3 plays for -50 coins.',
    onActivate: (state) => {
      if ((state.effectState.lastSnapshots || []).length < 3 || state.coins < 50) return {};
      const snapshot = state.effectState.lastSnapshots[state.effectState.lastSnapshots.length - 3];
      return { ...snapshot, coins: state.coins - 50 };
    },
    onMoveComplete: (state) => {
      const snap = { piles: state.piles, score: state.score, coins: state.coins, effectState: state.effectState };
      const prev = [...(state.effectState.lastSnapshots || []), snap].slice(-10);
      return { effectState: { ...state.effectState, lastSnapshots: prev } };
    }
  },
  {
    id: 'master_debater',
    name: 'Master Debater',
    type: 'exploit',
    description: 'Disable a curse for 1 encounter.',
    onActivate: (state) => ({ effectState: { ...state.effectState, disabledCurseOnce: true } })
  },
  {
    id: 'insider_trading',
    name: 'Insider Trading',
    type: 'exploit',
    description: 'All face cards visible → x3 encounter reward.',
    transformCardVisual: (card) => (card.rank === 1 || card.rank >= 11) ? { faceUp: true } : {},
    onEncounterEnd: (state) => ({ score: state.score * 3 })
  },
  {
    id: 'liquid_assets',
    name: 'Liquid Assets',
    type: 'exploit',
    description: 'Convert between points & coins (3:1 or 5:1).',
    onActivate: (state) => {
      const mode = state.effectState.liquidMode || '3to1';
      if (mode === '3to1' && state.score >= 3) {
        const converted = Math.floor(state.score / 3);
        return { score: state.score - converted * 3, coins: state.coins + converted };
      } else if (mode === '5to1' && state.coins >= 5) {
        const converted = Math.floor(state.coins / 5);
        return { coins: state.coins - converted * 5, score: state.score + converted };
      }
      return {};
    }
  },
  {
    id: 'keen_instincts',
    name: 'Keen Instincts',
    type: 'exploit',
    description: 'Revealed cards ignores rank & give +10 coin if played immediately.',
    canMove: (cards, source, target, defaultAllowed, state) => {
      const c = cards[0];
      if (c.id === state.effectState.justRevealedCardId && target.type === 'tableau') return true;
      return defaultAllowed;
    },
    onMoveComplete: (state, context) => {
      if (context.cards[0].id === state.effectState.justRevealedCardId) {
        return { coins: state.coins + 10, effectState: { ...state.effectState, justRevealedCardId: null } };
      }
      return {};
    }
  },
  {
    id: 'venture_capitol',
    name: 'Venture Capitol',
    type: 'exploit',
    description: 'Foundation plays +20 coin. Completions +100 coin.',
    calculateCoinTransaction: (delta, context, state) => {
      if (context.target.includes('foundation')) {
        const pile = state.piles[context.target];
        const willBe = pile.cards.length + context.cards.length;
        return delta + 20 + (willBe === 13 ? 100 : 0);
      }
      return delta;
    }
  },
  {
    id: 'one_armed_bandit',
    name: 'One-Armed Bandit',
    type: 'exploit',
    description: 'Have 3 sevens face up at once → Slots minigame.',
    onMoveComplete: (state) => {
      let count = 0;
      Object.values(state.piles).forEach(p =>
        p.cards.forEach(c => { if (c.faceUp && c.rank === 7) count++; })
      );
      if (count >= 3 && !state.effectState.slotsTriggered) {
        return { effectState: { ...state.effectState, slotsTriggered: true }, activeMinigame: 'slots' };
      }
      return {};
    }
  },
  {
    id: 'fancy_8ball',
    name: 'Fancy 8-ball',
    type: 'exploit',
    description: '4 eights face up at once → Pool minigame.',
    onMoveComplete: (state) => {
      let count = 0;
      Object.values(state.piles).forEach(p =>
        p.cards.forEach(c => { if (c.faceUp && c.rank === 8) count++; })
      );
      if (count >= 4 && !state.effectState.poolTriggered) {
        return { effectState: { ...state.effectState, poolTriggered: true }, activeMinigame: 'pool' };
      }
      return {};
    }
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    type: 'exploit',
    description: 'Have 4 nines face up at once → Pinball minigame.',
    onMoveComplete: (state) => {
      let count = 0;
      Object.values(state.piles).forEach(p =>
        p.cards.forEach(c => { if (c.faceUp && c.rank === 9) count++; })
      );
      if (count >= 4 && !state.effectState.pinballTriggered) {
        return { effectState: { ...state.effectState, pinballTriggered: true }, activeMinigame: 'pinball' };
      }
      return {};
    }
  },
  {
    id: 'panopticon_darts',
    name: 'Panopticon',
    type: 'exploit',
    description: 'Have 4 tens face up at once → Darts minigame.',
    onMoveComplete: (state) => {
      let count = 0;
      Object.values(state.piles).forEach(p =>
        p.cards.forEach(c => { if (c.faceUp && c.rank === 10) count++; })
      );
      if (count >= 4 && !state.effectState.dartsTriggered) {
        return { effectState: { ...state.effectState, dartsTriggered: true }, activeMinigame: 'darts' };
      }
      return {};
    }
  },
  {
    id: 'counting_cards',
    name: 'Counting Cards',
    type: 'exploit',
    description: '4 Jacks face up at once → Blackjack minigame.',
    onMoveComplete: (state) => {
      let count = 0;
      Object.values(state.piles).forEach(p =>
        p.cards.forEach(c => { if (c.faceUp && c.rank === 11) count++; })
      );
      if (count >= 4 && !state.effectState.blackjackTriggered) {
        return { effectState: { ...state.effectState, blackjackTriggered: true }, activeMinigame: 'blackjack' };
      }
      return {};
    }
  },
  {
    id: 'russian_roulette',
    name: 'Russian Roulette',
    type: 'exploit',
    description: '4 Kings face up at once → Roulette minigame.',
    onMoveComplete: (state) => {
      let count = 0;
      Object.values(state.piles).forEach(p =>
        p.cards.forEach(c => { if (c.faceUp && c.rank === 13) count++; })
      );
      if (count >= 4 && !state.effectState.rouletteTriggered) {
        return { effectState: { ...state.effectState, rouletteTriggered: true }, activeMinigame: 'roulette' };
      }
      return {};
    }
  },
  {
    id: 'rose_glasses',
    name: 'Rose Colored Glasses',
    type: 'exploit',
    description: 'Have 4 of a kind face up with 2,3,4,5 → Poker minigame.',
    onMoveComplete: (state) => {
      const counts: Record<number, number> = {};
      Object.values(state.piles).forEach(p =>
        p.cards.forEach(c => { if (c.faceUp) counts[c.rank] = (counts[c.rank] || 0) + 1; })
      );
      const has4Kind = Object.entries(counts).some(([r, cnt]) =>
        [2,3,4,5].includes(Number(r)) && cnt >= 4
      );
      if (has4Kind && !state.effectState.pokerTriggered) {
        return { effectState: { ...state.effectState, pokerTriggered: true }, activeMinigame: 'poker' };
      }
      return {};
    }
  },
  {
    id: 'weighted_dice',
    name: 'Weighted Dice',
    type: 'exploit',
    description: '3 sixes in foundations but no sevens → Devil\'s Dice.',
    onMoveComplete: (state) => {
      const fids = Object.keys(state.piles).filter(k => k.startsWith('foundation'));
      let sixes = 0; let sevens = 0;
      fids.forEach(fid => state.piles[fid].cards.forEach(c => {
        if (c.rank === 6) sixes++;
        if (c.rank === 7) sevens++;
      }));
      if (sixes >= 3 && sevens === 0 && !state.effectState.devilsDicePlayed) {
        const d1 = Math.ceil(Math.random() * 6),
              d2 = Math.ceil(Math.random() * 6),
              d3 = Math.ceil(Math.random() * 6);
        const gain = (d1 + d2 + d3) * 100;
        const newPiles = { ...state.piles };
        fids.forEach(fid => {
          newPiles[fid] = { ...newPiles[fid], cards: newPiles[fid].cards.filter(c => c.rank !== 6) };
        });
        return {
          coins: state.coins + gain,
          piles: newPiles,
          effectState: { ...state.effectState, devilsDicePlayed: true }
        };
      }
      return {};
    }
  },
  {
    id: 'tax_loophole',
    name: 'Tax Loophole',
    type: 'exploit',
    description: 'Buy a key for 25% of your coin. It works anywhere.',
    onActivate: (state) => {
      if (state.coins <= 0) return {};
      const cost = Math.floor(state.coins * 0.25);
      const hand = state.piles['hand'];
      const key: Card = { id: `key-${Date.now()}`, suit: 'special', rank: 0, faceUp: true,
                          meta: { isKey: true, universal: true } };
      return {
        coins: state.coins - cost,
        piles: { ...state.piles, hand: { ...hand, cards: [...hand.cards, key] } }
      };
    }
  },
  {
    id: 'reverse_psychology',
    name: 'Reverse Psychology',
    type: 'curse',
    description: 'Every 5 moves, flip board H/V alternating. Completed foundations remove 1 flip.',
    onMoveComplete: (state) => {
      const moves = state.moves + 1;
      const flips = state.effectState.pendingFlips || [];
      if (moves % 5 === 0) {
        const next = (flips.length % 2 === 0) ? 'horizontal' : 'vertical';
        return { effectState: { ...state.effectState, pendingFlips: [...flips, next] } };
      }
      return {};
    },
    onActivate: (state) => ({ effectState: { ...state.effectState, pendingFlips: [] } }),
    onMoveCompletePost: (state, context) => {
      if (context.target.includes('foundation')) {
        const flips = [...(state.effectState.pendingFlips || [])];
        if (flips.length > 0) flips.pop();
        return { effectState: { ...state.effectState, pendingFlips: flips } };
      }
      return {};
    }
  },
  {
    id: 'flesh_wound',
    name: 'Flesh Wound',
    type: 'curse',
    description: 'Wound in hand increases goal by 10% each cycle. Find 2 bandages in tableau to remove.',
    onActivate: (state) => {
      const hand = state.piles['hand'];
      const wound: Card = { id: 'wound-card', suit: 'special', rank: 0, faceUp: true, meta: { isWound: true } };
      const newPiles = { ...state.piles, hand: { ...hand, cards: [...hand.cards, wound] } };
      const tabKeys = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
      for (let i = 0; i < 2 && tabKeys.length > 0; i++) {
        const key = tabKeys[Math.floor(Math.random() * tabKeys.length)];
        const bandage: Card = { id: `bandage-${i}-${Date.now()}`, suit: 'special', rank: 0, faceUp: false, meta: { isBandage: true } };
        newPiles[key] = { ...newPiles[key], cards: [...newPiles[key].cards, bandage] };
      }
      return { piles: newPiles, effectState: { ...state.effectState, woundActive: true } };
    },
    onDeckCycleComplete: (state) => {
      if (state.effectState.woundActive) {
        return { currentScoreGoal: Math.floor(state.currentScoreGoal * 1.1) };
      }
      return {};
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
  },
  {
    id: 'schrondingers_deck',
    name: "Schrondinger's Deck",
    type: 'curse',
    description: 'Tableaus 50% exist after each play; at least 3 exist.',
    onMoveComplete: (state) => {
      const newPiles = { ...state.piles };
      const tabs = Object.keys(newPiles).filter(k => k.startsWith('tableau'));
      tabs.forEach(id => {
        const pile = newPiles[id];
        const exists = Math.random() < 0.5;
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
  },
  {
    id: 'caged_bakeneko',
    name: 'Caged Bakeneko',
    type: 'curse',
    description: '3 tableau locked. 4 keys hidden. Unlock a random tableau at 50% of score goal.',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      const tabIds = Object.keys(newPiles).filter(k => k.startsWith('tableau')).sort(() => Math.random() - 0.5).slice(0, 3);
      tabIds.forEach(id => { newPiles[id] = { ...newPiles[id], locked: true }; });
      const others = Object.keys(newPiles).filter(k => k.startsWith('tableau') && !tabIds.includes(k));
      for (let i = 0; i < 4 && others.length > 0; i++) {
        const id = others[Math.floor(Math.random() * others.length)];
        const key: Card = { id: `bkey-${i}-${Date.now()}`, suit: 'special', rank: 0, faceUp: false, meta: { isKey: true } };
        newPiles[id] = { ...newPiles[id], cards: [...newPiles[id].cards, key] };
      }
      return { piles: newPiles, effectState: { ...state.effectState, bakenekoLocked: tabIds } };
    },
    onMoveComplete: (state) => {
      if (state.score >= Math.floor(state.currentScoreGoal * 0.5)) {
        const locked = (state.effectState.bakenekoLocked || []).slice();
        if (locked.length > 0) {
          const unlock = locked.shift();
          const pile = state.piles[unlock];
          const newPiles = { ...state.piles, [unlock]: { ...pile, locked: false } };
          return { piles: newPiles, effectState: { ...state.effectState, bakenekoLocked: locked } };
        }
      }
      return {};
    },
    canMove: (cards, source, target, defaultAllowed) =>
      (source.locked || target.locked) ? false : defaultAllowed
  },
  {
    id: 'street_smarts',
    name: 'Street Smarts',
    type: 'curse',
    description: 'Complete encounter by gaining goal in coins, not points. x5 coins gained. Only keep 10%.',
    onEncounterEnd: (state) => {
      if (state.coins >= state.currentScoreGoal) {
        const reward = Math.floor(state.coins * 0.1);
        return { isLevelComplete: true, coins: reward };
      }
      return {};
    },
    calculateCoinTransaction: (delta) => delta * 5
  },
  {
    id: 'counterfeiting',
    name: 'Counterfeiting',
    type: 'curse',
    description: 'Duplicate all cards before dealing. -50% points gained. Cards with same rank can be stacked.',
    onActivate: (state) => {
      const deck = state.piles['deck'];
      const duped = [...deck.cards, ...deck.cards.map(c => ({ ...c, id: `${c.id}-copy` }))];
      return { piles: { ...state.piles, deck: { ...deck, cards: duped } } };
    },
    calculateScore: (score) => Math.floor(score * 0.5),
    canMove: (cards, source, target, defaultAllowed) => {
      if (target.type === 'tableau' && target.cards.length > 0) {
        const top = target.cards[target.cards.length - 1];
        return cards[0].rank === top.rank;
      }
      return defaultAllowed;
    }
  },
  {
    id: 'fog_of_war_variant',
    name: 'Fog of War',
    type: 'curse',
    description: 'Only rank & color visible. Suit hidden. Every 10 moves, reduce score of face-up tableau cards ±1 rank.',
    transformCardVisual: (card) => ({ suit: 'special' }),
    onMoveComplete: (state) => {
      if (state.moves > 0 && state.moves % 10 === 0) {
        const newPiles = { ...state.piles };
        Object.keys(newPiles).filter(k => k.startsWith('tableau')).forEach(id => {
          const pile = newPiles[id];
          if (pile.cards.length > 0) {
            const top = pile.cards[pile.cards.length - 1];
            if (top.faceUp) {
              const adjust = Math.random() < 0.5 ? -1 : +1;
              newPiles[id].cards[pile.cards.length - 1] =
                { ...top, rank: Math.max(1, Math.min(13, top.rank + adjust)) };
            }
          }
        });
        return { piles: newPiles };
      }
      return {};
    }
  },
  {
    id: 'tower_of_babel',
    name: 'Tower of Babel',
    type: 'curse',
    description: '+4 empty tableau. No foundations. No score. Advance by stacking all 4 suits in tableau.',
    onActivate: (state) => {
      const newPiles = { ...state.piles };
      for (let i = 0; i < 4; i++) {
        newPiles[`babel-${i}`] = { id: `babel-${i}`, type: 'tableau', cards: [] };
      }
      Object.keys(newPiles).filter(k => k.startsWith('foundation')).forEach(fid => { delete newPiles[fid]; });
      return { piles: newPiles, scoreMultiplier: 0 };
    }
  },
  {
    id: 'revolving_door',
    name: 'Revolving Door',
    type: 'curse',
    description: 'Foundations only keep top card, return rest to deck. Rearrange tableau cards every discard.',
    onMoveComplete: (state, context) => {
      if (context.target.includes('foundation')) {
        const pile = state.piles[context.target];
        const top = pile.cards[pile.cards.length - 1];
        const returned = pile.cards.slice(0, -1).map(c => ({ ...c, faceUp: false }));
        const deck = state.piles['deck'];
        return {
          piles: {
            ...state.piles,
            [context.target]: { ...pile, cards: [top] },
            deck: { ...deck, cards: [...deck.cards, ...returned] }
          }
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
];