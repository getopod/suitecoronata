import { ClassicCardData, ClassicRank, ClassicSuit } from './types';

export const SUITS: ClassicSuit[] = ['H', 'D', 'C', 'S'];
export const RANKS: ClassicRank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// Generic shuffler
export const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Create a standard 52-card deck
export const createDeck = (decks = 1): ClassicCardData[] => {
  const deck: ClassicCardData[] = [];
  let idCounter = 0;
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          id: `card-${d}-${idCounter++}`,
          rank,
          suit,
          faceUp: false,
        });
      }
    }
  }
  return shuffle(deck);
};

// Create deck with specific suits (e.g. for Spider 1-suit or 2-suit)
// totalCards should be multiple of 13 * suits.length
export const createSuitedDeck = (suits: ClassicSuit[], totalCards: number): ClassicCardData[] => {
  const deck: ClassicCardData[] = [];
  let idCounter = 0;

  // How many full sets of each suit?
  const cardsPerSuit = totalCards / suits.length;

  for (const suit of suits) {
    let count = 0;
    while(count < cardsPerSuit) {
        for (const rank of RANKS) {
             deck.push({
                id: `card-s-${suit}-${idCounter++}`,
                rank,
                suit,
                faceUp: false,
             });
             count++;
        }
    }
  }

  return shuffle(deck);
};

// --- Predicates ---

export const isRed = (card: ClassicCardData) => card.suit === 'H' || card.suit === 'D';
export const isBlack = (card: ClassicCardData) => !isRed(card);

export const isSameSuit = (a: ClassicCardData, b: ClassicCardData) => a.suit === b.suit;

export const isConsecutiveDescending = (high: ClassicCardData, low: ClassicCardData) => high.rank === low.rank + 1;
export const isConsecutiveAscending = (low: ClassicCardData, high: ClassicCardData) => low.rank === high.rank - 1;

// Checks if rank difference is exactly 1 (e.g. 3 & 4, K & Q)
export const isRankNeighbor = (a: ClassicCardData, b: ClassicCardData) => Math.abs(a.rank - b.rank) === 1;

export const isAlternatingColor = (a: ClassicCardData, b: ClassicCardData) => isRed(a) !== isRed(b);

// Validates a stack of cards is movable (e.g. Klondike run)
export const isRunDescendingAltColor = (cards: ClassicCardData[]): boolean => {
  if (cards.length <= 1) return true;
  for (let i = 0; i < cards.length - 1; i++) {
    const current = cards[i];
    const next = cards[i + 1];
    if (!isConsecutiveDescending(current, next) || !isAlternatingColor(current, next)) {
      return false;
    }
  }
  return true;
};

export const isRunDescendingSameSuit = (cards: ClassicCardData[]): boolean => {
  if (cards.length <= 1) return true;
  for (let i = 0; i < cards.length - 1; i++) {
    const current = cards[i];
    const next = cards[i + 1];
    if (!isConsecutiveDescending(current, next) || !isSameSuit(current, next)) {
      return false;
    }
  }
  return true;
};

// For Calculation: Check modular arithmetic sequence
export const isNextCalculationRank = (currentRank: number, nextCardRank: number, interval: number): boolean => {
    // interval 1: 1, 2, 3...
    // interval 2: 2, 4, 6...
    let expected = currentRank + interval;
    if (expected > 13) expected -= 13;
    return nextCardRank === expected;
};