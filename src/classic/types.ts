import { Card, Pile } from '../../types';

// Adapter types for classic solitaire games
export type ClassicSuit = 'H' | 'D' | 'C' | 'S';
export type ClassicRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface ClassicCardData {
  id: string;
  rank: ClassicRank;
  suit: ClassicSuit;
  faceUp: boolean;
}

export type ClassicPileType = 'stock' | 'waste' | 'foundation' | 'tableau' | 'cell' | 'reserve';

export interface ClassicPileConfig {
  id: string;
  type: ClassicPileType;
  x: number;
  y: number;
  fan?: 'none' | 'right' | 'down';
  fanSpacing?: number;
  maxCards?: number; // For cells
}

export interface ClassicLayoutData {
  piles: ClassicPileConfig[];
  cardWidth: number;
  cardHeight: number;
}

export interface ClassicGameSettings {
  strictSolitaire?: boolean;
  spiderStrictDeal?: boolean;
  allowWrap?: boolean;
}

export interface ClassicGameState {
  piles: Record<string, ClassicCardData[]>;
  score: number;
  moves: number;
  history: ClassicGameState[];
  customData?: Record<string, any>;
}

export interface ClassicMoveAttempt {
  cardIds: string[];
  sourcePileId: string;
  targetPileId: string;
}

export interface ClassicGameRules {
  name: string;
  description: string;
  details: {
      objective: string;
      controls: string;
      rules: string[];
  };
  layout: (width: number, height: number) => ClassicLayoutData;
  deal: () => Record<string, ClassicCardData[]>;
  canDrag: (pileId: string, cardIndex: number, cards: ClassicCardData[]) => boolean;
  canDrop: (move: ClassicMoveAttempt, targetPile: ClassicCardData[], gameState: ClassicGameState, settings?: ClassicGameSettings) => boolean;

  // Interaction extensions
  interactionMode?: 'standard' | 'pair_removal';
  onCardClick?: (card: ClassicCardData, pileId: string, gameState: ClassicGameState) => Partial<ClassicGameState> | null;
  onStockClick?: (gameState: ClassicGameState, settings?: ClassicGameSettings) => Partial<ClassicGameState> | null;
  onPostMove?: (gameState: ClassicGameState) => Partial<ClassicGameState> | null;
  winCondition: (gameState: ClassicGameState) => boolean;
}

// Conversion utilities between classic and coronata formats
export const suitMap: Record<ClassicSuit, 'hearts' | 'diamonds' | 'clubs' | 'spades'> = {
  'H': 'hearts',
  'D': 'diamonds',
  'C': 'clubs',
  'S': 'spades'
};

export const reverseSuitMap: Record<'hearts' | 'diamonds' | 'clubs' | 'spades', ClassicSuit> = {
  'hearts': 'H',
  'diamonds': 'D',
  'clubs': 'C',
  'spades': 'S'
};

export const convertClassicCardToCoronata = (classicCard: ClassicCardData): Card => ({
  id: classicCard.id,
  suit: suitMap[classicCard.suit],
  rank: classicCard.rank,
  faceUp: classicCard.faceUp
});

export const convertCoronataCardToClassic = (card: Card): ClassicCardData => ({
  id: card.id,
  suit: reverseSuitMap[card.suit as keyof typeof reverseSuitMap] || 'H',
  rank: card.rank as ClassicRank,
  faceUp: card.faceUp
});

export const convertClassicPilesToCoronata = (classicPiles: Record<string, ClassicCardData[]>): Record<string, Pile> => {
  const coronataPiles: Record<string, Pile> = {};

  // Ensure basic piles exist
  coronataPiles['deck'] = { id: 'deck', type: 'deck', cards: [] };
  coronataPiles['hand'] = { id: 'hand', type: 'hand', cards: [] };

  Object.entries(classicPiles).forEach(([pileId, cards]) => {
    let pileType: 'deck' | 'hand' | 'foundation' | 'tableau' = 'tableau';

    if (pileId === 'stock') {
      pileType = 'deck';
      coronataPiles['deck'] = {
        id: 'deck',
        type: 'deck',
        cards: cards.map(convertClassicCardToCoronata)
      };
    } else if (pileId === 'waste') {
      pileType = 'hand';
      coronataPiles['hand'] = {
        id: 'hand',
        type: 'hand',
        cards: cards.map(convertClassicCardToCoronata)
      };
    } else if (pileId.startsWith('foundation')) {
      pileType = 'foundation';
      coronataPiles[pileId] = {
        id: pileId,
        type: pileType,
        cards: cards.map(convertClassicCardToCoronata)
      };
    } else if (pileId.startsWith('tableau') || pileId.startsWith('cell')) {
      pileType = 'tableau';
      coronataPiles[pileId] = {
        id: pileId,
        type: pileType,
        cards: cards.map(convertClassicCardToCoronata)
      };
    }
  });

  return coronataPiles;
};

export const convertCoronataPilesToClassic = (coronataPiles: Record<string, Pile>): Record<string, ClassicCardData[]> => {
  const classicPiles: Record<string, ClassicCardData[]> = {};

  Object.entries(coronataPiles).forEach(([pileId, pile]) => {
    classicPiles[pileId] = pile.cards.map(convertCoronataCardToClassic);
  });

  return classicPiles;
};