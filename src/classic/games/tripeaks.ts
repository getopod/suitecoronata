import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isRankNeighbor } from '../utils/cards';

const getTriPeaksCover = (i: number): number[] => {
    // Row 0 (0-2)
    if (i === 0) return [3, 4];
    if (i === 1) return [5, 6];
    if (i === 2) return [7, 8];
    // Row 1 (3-8)
    if (i === 3) return [9, 10];
    if (i === 4) return [10, 11];
    if (i === 5) return [12, 13];
    if (i === 6) return [13, 14];
    if (i === 7) return [15, 16];
    if (i === 8) return [16, 17];
    // Row 2 (9-17)
    if (i === 9) return [18, 19];
    if (i === 10) return [19, 20];
    if (i === 11) return [20, 21];
    if (i === 12) return [21, 22];
    if (i === 13) return [22, 23];
    if (i === 14) return [23, 24];
    if (i === 15) return [24, 25];
    if (i === 16) return [25, 26];
    if (i === 17) return [26, 27];
    // Row 3 (18-27) is bottom
    return [];
};

export const TriPeaks: GameRules = {
  name: "TriPeaks",
  description: "Clear the three peaks by selecting cards one higher or lower than the waste pile.",
  details: {
      objective: "Move all cards from the peaks to the waste pile.",
      controls: "Click/Drag exposed cards to the waste pile if they are 1 rank higher or lower.",
      rules: [
          "ClassicRank ignores suit.",
          "Check settings to enable King-Ace wrapping.",
          "Only exposed cards (no cards overlapping them) can be played."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const cardW = Math.min(50, Math.floor(width / 11));
    const cardH = Math.floor(cardW * 1.5);
    const startX = (width - (10 * cardW)) / 2; // Base row is 10 wide
    const topY = 40;
    const gapX = cardW; 
    const gapY = cardH * 0.5;

    const configs: PileConfig[] = [];
    // Helper to add pile
    const add = (id: number, r: number, c: number, offsetx: number) => {
        configs.push({
             id: `tableau-${id}`,
             type: 'tableau',
             x: startX + (c * gapX) + (offsetx * gapX),
             y: topY + (r * gapY),
             fan: 'none'
        });
    }

    // Row 0 (Peaks)
    add(0, 0, 0, 1.5); // Peak 1
    add(1, 0, 3, 1.5); // Peak 2
    add(2, 0, 6, 1.5); // Peak 3

    // Row 1
    add(3, 1, 0, 1); add(4, 1, 1, 1);
    add(5, 1, 3, 1); add(6, 1, 4, 1);
    add(7, 1, 6, 1); add(8, 1, 7, 1);

    // Row 2
    add(9, 2, 0, 0.5); add(10, 2, 1, 0.5); add(11, 2, 2, 0.5);
    add(12, 2, 3, 0.5); add(13, 2, 4, 0.5); add(14, 2, 5, 0.5);
    add(15, 2, 6, 0.5); add(16, 2, 7, 0.5); add(17, 2, 8, 0.5);

    // Row 3 (Base)
    for(let i=0; i<10; i++) add(18+i, 3, i, 0);

    // Stock/Waste
    configs.push({ id: 'stock', type: 'stock', x: width/2 - cardW - 20, y: topY + (5 * gapY) + 20, fan: 'none' });
    configs.push({ id: 'waste', type: 'waste', x: width/2 + 20, y: topY + (5 * gapY) + 20, fan: 'none' });

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<28; i++) piles[`tableau-${i}`] = [];
    piles['stock'] = [];
    piles['waste'] = [];

    let c = 0;
    for(let i=0; i<28; i++) piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
    piles['waste'].push({ ...deck[c++], faceUp: true }); // 1 to waste
    while(c < deck.length) piles['stock'].push({ ...deck[c++], faceUp: false });

    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      if (stock.length === 0) return null;
      const newStock = [...stock];
      const newWaste = [...gameState.piles.waste];
      const card = newStock.pop();
      if (card) {
          card.faceUp = true;
          newWaste.push(card);
      }
      return { piles: { ...gameState.piles, stock: newStock, waste: newWaste } };
  },

  canDrag: (pileId, cardIndex, cards) => {
    if (pileId.startsWith('tableau')) {
        const idx = parseInt(pileId.split('-')[1]);
        if (cards.length === 0) return false;
        return true;
    }
    return false;
  },

  canDrop: (move, targetPileCards, gameState, settings) => {
      if (move.targetPileId !== 'waste') return false;
      const sourcePileId = move.sourcePileId;
      if (!sourcePileId.startsWith('tableau')) return false;

      // Check exposure
      const idx = parseInt(sourcePileId.split('-')[1]);
      const covers = getTriPeaksCover(idx);
      const isCovered = covers.some(c => gameState.piles[`tableau-${c}`]?.length > 0);
      if (isCovered) return false;

      // Check rank
      const sourceCard = gameState.piles[sourcePileId][0];
      const targetCard = targetPileCards[targetPileCards.length - 1];
      
      const diff = Math.abs(sourceCard.rank - targetCard.rank);
      if (diff === 1) return true;
      
      // Wrap Around
      if (settings?.allowWrap && diff === 12) return true; 

      return false;
  },

  winCondition: (gameState) => {
      for(let i=0; i<28; i++) {
          if (gameState.piles[`tableau-${i}`]?.length > 0) return false;
      }
      return true;
  }
};
