import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck } from '../utils/cards';

// Helper to calculate pyramid structure coverage
const isExposed = (pileId: string, pileIndex: number, piles: Record<string, CardData[]>): boolean => {
    if (pileId !== 'pyramid') return true; // Stock/Waste always exposed if top
    // Pyramid logic:
    // Row 0: 0
    // Row 1: 1, 2
    // Row 2: 3, 4, 5
    // ...
    // Row 6: 21..27
    // A card at index i (0-based flat index) is covered by i + row + 1 and i + row + 2
    
    // Find row
    let row = 0;
    let count = 0;
    while (count + row + 1 <= pileIndex) {
        count += row + 1;
        row++;
    }
    
    // Cards in last row (row 6) are always exposed
    if (row === 6) return true;
    
    // Check covering cards
    const leftCover = pileIndex + row + 1;
    const rightCover = pileIndex + row + 2;
    
    // The pile is a single list of cards. However, in our deal, we put them in one pile 'pyramid'.
    // To check if covered, we check if the covering indices exist in the current pile.
    // BUT: The IDs change? No, we use index. 
    // Wait, if we remove cards, indices shift. 
    // Pyramid implementation strategy: Use 28 separate piles? Or 1 pile with logic?
    // Using 28 separate piles makes "exposed" logic trivial (is pile overlapping me empty?)
    // Let's use 28 piles for the pyramid: tableau-0 to tableau-27.
    // Covering logic: 
    // tableau-0 covered by 1, 2
    // tableau-1 covered by 3, 4
    // tableau-2 covered by 4, 5
    // General: index i covered by (i + row + 1) and (i + row + 2)
    return false;
};

// simpler approach: 28 piles.
const getCoveringIndices = (index: number): number[] => {
    let row = 0;
    let limit = 0;
    while (limit + row + 1 <= index) {
        limit += row + 1;
        row++;
    }
    if (row === 6) return [];
    return [index + row + 1, index + row + 2];
}

export const Pyramid: GameRules = {
  name: "Pyramid",
  description: "Remove pairs of cards that add up to 13. Kings (13) can be removed singly.",
  details: {
      objective: "Clear the pyramid by removing pairs of cards that sum to 13.",
      controls: "Drag a card onto another to pair them. Click a King to remove it.",
      rules: [
          "Pairs must sum to 13 (Ace=1, J=11, Q=12, K=13).",
          "Valid pairs: A-Q, 2-J, 3-10, 4-9, 5-8, 6-7.",
          "Kings are 13 and can be removed by clicking.",
          "Only exposed cards (no cards overlapping them) can be used.",
          "You can pair Stock/Waste cards with Pyramid cards."
      ]
  },
  interactionMode: 'pair_removal',

  layout: (w, h) => {
    const width = w || 360;
    const cardW = Math.min(60, Math.floor(width / 9));
    const cardH = Math.floor(cardW * 1.5);
    const startX = (width - cardW) / 2;
    const topY = 40;
    const gapX = cardW + 2;
    const gapY = cardH * 0.6;

    const configs: PileConfig[] = [];

    // Pyramid Piles (0-27)
    let idx = 0;
    for (let r = 0; r < 7; r++) {
        const rowStartX = (width - ((r + 1) * gapX) + gapX - cardW) / 2;
        for (let c = 0; c <= r; c++) {
            configs.push({
                id: `tableau-${idx}`,
                type: 'tableau',
                x: rowStartX + (c * gapX),
                y: topY + (r * gapY),
                fan: 'none'
            });
            idx++;
        }
    }

    // Stock & Waste
    configs.push({ id: 'stock', type: 'stock', x: width / 2 - cardW - 10, y: topY + (7 * gapY) + 20, fan: 'none' });
    configs.push({ id: 'waste', type: 'waste', x: width / 2 + 10, y: topY + (7 * gapY) + 20, fan: 'none' });

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
    while(c < deck.length) piles['stock'].push({ ...deck[c++], faceUp: false });

    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      const waste = gameState.piles.waste;
      
      if (stock.length === 0) {
          if (waste.length === 0) return null;
          // Recycle waste to stock
           const newStock = [...waste].reverse().map(c => ({...c, faceUp: false}));
           return { piles: { ...gameState.piles, stock: newStock, waste: [] } };
      }

      const newStock = [...stock];
      const newWaste = [...waste];
      const card = newStock.pop();
      if (card) {
          card.faceUp = true;
          newWaste.push(card);
      }
      return { piles: { ...gameState.piles, stock: newStock, waste: newWaste } };
  },

  onCardClick: (card, pileId, gameState) => {
      if (card.rank === 13) {
          // Check if exposed
          if (pileId.startsWith('tableau')) {
              const idx = parseInt(pileId.split('-')[1]);
              const covers = getCoveringIndices(idx);
              const isCovered = covers.some(cIdx => gameState.piles[`tableau-${cIdx}`]?.length > 0);
              if (isCovered) return null;
          }
          // Remove King
          const newPiles = { ...gameState.piles };
          newPiles[pileId] = newPiles[pileId].filter(c => c.id !== card.id);
          return { piles: newPiles, score: gameState.score + 13 };
      }
      return null;
  },

  canDrag: (pileId, cardIndex, cards) => {
      // Stock/Waste always draggable
      if (pileId === 'waste') return cardIndex === cards.length - 1;
      
      // Pyramid: must be exposed
      if (pileId.startsWith('tableau')) {
          const idx = parseInt(pileId.split('-')[1]);
          // If we have cards, check if covered
          if (cards.length === 0) return false;
          // In standard Pyramid with single-card piles, we only check the single card
          // Covers:
          // 0 covered by 1, 2
          const covers = getCoveringIndices(idx);
          // Check global state? We don't have access to global state in canDrag easily without passing it.
          // The App passes `cards` which is just this pile.
          // Limitation: canDrag needs to know about other piles.
          // WORKAROUND: In App.tsx `handleStart`, we can guard this.
          // But for now, we assume App logic calls canDrag. 
          // Since we can't access other piles here, we'll return true here and rely on `canDrop` or UI visual cues.
          // ACTUALLY, strict rules say you can only match exposed cards.
          // Since we can't check other piles here easily without changing the interface, let's relax it in `canDrag` 
          // but strictly enforce in `canDrop`.
          // Wait, users shouldn't be able to drag covered cards.
          // Let's assume for this specific game, we might need a small hack or just trust the player/enforce on drop.
          // Better: We will allow dragging but validation fails on drop.
          return true;
      }
      return false;
  },

  canDrop: (move, targetPileCards, gameState) => {
      const sourceCard = gameState.piles[move.sourcePileId].slice(-1)[0];
      const targetCard = targetPileCards[targetPileCards.length - 1];
      if (!sourceCard || !targetCard) return false;

      // Check exposure for both
      const checkExposure = (pid: string) => {
          if (pid.startsWith('tableau')) {
             const idx = parseInt(pid.split('-')[1]);
             const covers = getCoveringIndices(idx);
             return !covers.some(cIdx => gameState.piles[`tableau-${cIdx}`]?.length > 0);
          }
          return true;
      };

      if (!checkExposure(move.sourcePileId) || !checkExposure(move.targetPileId)) return false;

      return (sourceCard.rank + targetCard.rank) === 13;
  },

  winCondition: (gameState) => {
      // All tableau piles empty
      for(let i=0; i<28; i++) {
          if (gameState.piles[`tableau-${i}`]?.length > 0) return false;
      }
      return true;
  }
};
