/**
 * State Action Pattern Evaluators
 *
 * This module implements state manipulation patterns from the documentation.
 * These handle pile modifications, card additions, and game state changes.
 */

import { Card, Pile, GameState, Rank, Suit } from '../../types';
import { StateContext, StateEvaluator, StateActionId } from './types';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Shuffle an array (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a unique card ID
 */
function generateCardId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a special card based on type
 */
export function createSpecialCard(
  type: 'wound' | 'bandage' | 'key' | 'wild' | 'fear_skip' | 'crown',
  options: {
    faceUp?: boolean;
    charges?: number;
    universal?: boolean;
  } = {}
): Card {
  const id = generateCardId(type);
  const faceUp = options.faceUp ?? true;

  const cardTypes: Record<string, Partial<Card>> = {
    wound: {
      meta: { isWound: true },
    },
    bandage: {
      meta: { isBandage: true },
    },
    key: {
      meta: {
        isKey: true,
        charges: options.charges,
        universal: options.universal,
      },
    },
    wild: {
      meta: {
        isWild: true,
        charges: options.charges,
      },
    },
    fear_skip: {
      meta: {
        isFearSkip: true,
        charges: options.charges,
      },
    },
    crown: {
      rank: 1 as Rank, // Base rank, but acts as multiple
      meta: {
        crown: true,
        virtualRanks: [1, 11, 13],
      },
    },
  };

  return {
    id,
    suit: 'special',
    rank: 0 as Rank,
    faceUp,
    ...cardTypes[type],
  };
}

// =============================================================================
// State Action Evaluators
// =============================================================================

export const stateActions: Record<StateActionId, StateEvaluator> = {
  /**
   * Add piles to the game
   * @param params.type - 'tableau' | 'foundation'
   * @param params.count - Number of piles to add
   */
  add_piles: (ctx, params = { type: 'tableau', count: 2 }) => {
    const newPiles = { ...ctx.state.piles };
    const existingCount = Object.keys(newPiles).filter(k => k.startsWith(params.type)).length;

    for (let i = 0; i < params.count; i++) {
      const id = `${params.type}-${existingCount + i}`;
      newPiles[id] = {
        id,
        type: params.type as any,
        cards: [],
      };
    }

    return { piles: newPiles };
  },

  /**
   * Remove piles from the game
   * @param params.type - Type of piles to remove
   * @param params.ids - Specific pile IDs to remove (optional)
   */
  remove_piles: (ctx, params = {}) => {
    const newPiles = { ...ctx.state.piles };

    if (params.ids) {
      params.ids.forEach((id: string) => delete newPiles[id]);
    } else if (params.type) {
      Object.keys(newPiles)
        .filter(k => k.startsWith(params.type))
        .forEach(k => delete newPiles[k]);
    }

    return { piles: newPiles };
  },

  /**
   * Lock specific piles
   * @param params.ids - Pile IDs to lock
   * @param params.random - Number of random piles to lock
   * @param params.type - Type of piles to select from when using random
   */
  lock_piles: (ctx, params = {}) => {
    const newPiles = { ...ctx.state.piles };
    let idsToLock: string[] = [];

    if (params.ids) {
      idsToLock = params.ids;
    } else if (params.random) {
      const candidates = Object.keys(newPiles)
        .filter(k => !params.type || k.startsWith(params.type));
      idsToLock = shuffleArray(candidates).slice(0, params.random);
    }

    idsToLock.forEach(id => {
      if (newPiles[id]) {
        newPiles[id] = { ...newPiles[id], locked: true };
      }
    });

    return { piles: newPiles };
  },

  /**
   * Unlock specific piles
   * @param params.ids - Pile IDs to unlock
   * @param params.all - Unlock all piles
   */
  unlock_piles: (ctx, params = {}) => {
    const newPiles = { ...ctx.state.piles };

    if (params.all) {
      Object.keys(newPiles).forEach(id => {
        newPiles[id] = { ...newPiles[id], locked: false };
      });
    } else if (params.ids) {
      params.ids.forEach((id: string) => {
        if (newPiles[id]) {
          newPiles[id] = { ...newPiles[id], locked: false };
        }
      });
    }

    return { piles: newPiles };
  },

  /**
   * Add a special card to a pile
   * @param params.pile - Pile ID to add to
   * @param params.cardType - Type of special card
   * @param params.faceUp - Whether card is face up
   * @param params.charges - Charges for the card
   */
  add_card_to_pile: (ctx, params = { pile: 'hand', cardType: 'wild' }) => {
    const newPiles = { ...ctx.state.piles };
    const pile = newPiles[params.pile];

    if (!pile) return {};

    const card = createSpecialCard(params.cardType, {
      faceUp: params.faceUp,
      charges: params.charges,
      universal: params.universal,
    });

    newPiles[params.pile] = {
      ...pile,
      cards: [...pile.cards, card],
    };

    return { piles: newPiles };
  },

  /**
   * Scatter cards across multiple piles
   * @param params.cardType - Type of special card
   * @param params.count - Number of cards to scatter
   * @param params.pileType - Type of piles to scatter to
   * @param params.faceUp - Whether cards are face up
   */
  scatter_cards: (ctx, params = { cardType: 'bandage', count: 2, pileType: 'tableau' }) => {
    const newPiles = { ...ctx.state.piles };
    const targetPiles = Object.keys(newPiles)
      .filter(k => k.startsWith(params.pileType));

    if (targetPiles.length === 0) return {};

    for (let i = 0; i < params.count; i++) {
      const randomPile = targetPiles[Math.floor(Math.random() * targetPiles.length)];
      const card = createSpecialCard(params.cardType, {
        faceUp: params.faceUp ?? false,
      });

      newPiles[randomPile] = {
        ...newPiles[randomPile],
        cards: [...newPiles[randomPile].cards, card],
      };
    }

    return { piles: newPiles };
  },

  /**
   * Set effectState properties
   * @param params - Key-value pairs to set in effectState
   */
  set_effect_state: (ctx, params = {}) => {
    return {
      effectState: {
        ...ctx.state.effectState,
        ...params,
      },
    };
  },

  /**
   * Shuffle a specific pile
   * @param params.pileId - Pile to shuffle
   */
  shuffle_pile: (ctx, params = { pileId: 'deck' }) => {
    const newPiles = { ...ctx.state.piles };
    const pile = newPiles[params.pileId];

    if (!pile) return {};

    newPiles[params.pileId] = {
      ...pile,
      cards: shuffleArray(pile.cards),
    };

    return { piles: newPiles };
  },

  /**
   * Reshuffle all cards (redeal)
   */
  reshuffle_all: (ctx) => {
    // Collect all cards
    let allCards: Card[] = [];
    Object.values(ctx.state.piles).forEach(pile => {
      allCards = [...allCards, ...pile.cards];
    });

    // Shuffle
    allCards = shuffleArray(allCards);

    // Create new piles
    const newPiles: Record<string, Pile> = {};
    let cardIdx = 0;

    // Tableaus (1, 2, 3, 4, 5, 6, 7 cards)
    for (let i = 0; i < 7; i++) {
      const pileCards = allCards.slice(cardIdx, cardIdx + i + 1);
      if (pileCards.length > 0) {
        pileCards[pileCards.length - 1].faceUp = true;
      }
      newPiles[`tableau-${i}`] = {
        id: `tableau-${i}`,
        type: 'tableau',
        cards: pileCards,
      };
      cardIdx += i + 1;
    }

    // Empty foundations
    ['hearts', 'diamonds', 'clubs', 'spades'].forEach(suit => {
      newPiles[`foundation-${suit}`] = {
        id: `foundation-${suit}`,
        type: 'foundation',
        cards: [],
      };
    });

    // Remaining cards go to deck
    newPiles['deck'] = {
      id: 'deck',
      type: 'deck',
      cards: allCards.slice(cardIdx).map(c => ({ ...c, faceUp: false })),
    };

    // Hand
    newPiles['hand'] = { id: 'hand', type: 'hand', cards: [] };

    return { piles: newPiles };
  },

  /**
   * Return cards from a pile to the deck
   * @param params.pileId - Pile to return cards from
   * @param params.keep - Number of cards to keep in the pile (from the end)
   */
  return_to_deck: (ctx, params = { pileId: '', keep: 0 }) => {
    const newPiles = { ...ctx.state.piles };
    const pile = newPiles[params.pileId];
    const deck = newPiles['deck'];

    if (!pile || !deck) return {};

    const toReturn = pile.cards.slice(0, -params.keep || pile.cards.length);
    const toKeep = params.keep > 0 ? pile.cards.slice(-params.keep) : [];

    const returnedCards = toReturn.map(c => ({ ...c, faceUp: false }));
    const newDeckCards = [...deck.cards, ...returnedCards];

    newPiles[params.pileId] = { ...pile, cards: toKeep };
    newPiles['deck'] = { ...deck, cards: shuffleArray(newDeckCards) };

    return { piles: newPiles };
  },

  /**
   * Duplicate all deck cards (counterfeiting)
   */
  duplicate_deck: (ctx) => {
    const newPiles = { ...ctx.state.piles };
    const deck = newPiles['deck'];

    if (!deck) return {};

    const duplicated = deck.cards.map(c => ({
      ...c,
      id: `${c.id}-copy`,
    }));

    newPiles['deck'] = {
      ...deck,
      cards: [...deck.cards, ...duplicated],
    };

    return { piles: newPiles };
  },
};

/**
 * Get a state action evaluator by ID
 */
export function getStateAction(id: StateActionId): StateEvaluator | undefined {
  return stateActions[id];
}

/**
 * Execute multiple state actions in sequence
 * Results are merged together
 */
export function executeStateActions(
  ctx: StateContext,
  actions: Array<{ action: StateActionId; params?: Record<string, any> }>
): Partial<GameState> {
  let result: Partial<GameState> = {};
  let currentState = ctx.state;

  if (!Array.isArray(actions)) return result;
  for (const { action, params } of actions) {
    const evaluator = stateActions[action];
    if (evaluator) {
      const changes = evaluator({ ...ctx, state: currentState }, params);

      // Merge changes
      if (changes.piles) {
        result.piles = { ...result.piles, ...changes.piles };
        currentState = { ...currentState, piles: { ...currentState.piles, ...changes.piles } };
      }
      if (changes.effectState) {
        result.effectState = { ...result.effectState, ...changes.effectState };
        currentState = { ...currentState, effectState: { ...currentState.effectState, ...changes.effectState } };
      }

      // Merge other properties
      Object.entries(changes).forEach(([key, value]) => {
        if (key !== 'piles' && key !== 'effectState') {
          (result as any)[key] = value;
          (currentState as any)[key] = value;
        }
      });
    }
  }

  return result;
}
