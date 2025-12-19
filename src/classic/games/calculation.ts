import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isNextCalculationRank } from '../utils/cards';

export const Calculation: GameRules = {
  name: "Calculation",
  description: "A mathematical game. Build foundations by +1, +2, +3, +4.",
  details: {
      objective: "Build 4 foundations in specific intervals.",
      controls: "Move stock to waste. Move waste top to foundation. No moving between waste piles.",
      rules: [
          "F1: 1, 2, 3, 4...",
          "F2: 2, 4, 6, 8...",
          "F3: 3, 6, 9, Q...",
          "F4: 4, 8, Q, 3...",
          "Suits ignore.",
          "Any card can play to any of the 4 waste piles."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const cardW = 70;
    const cardH = 105;
    const cx = width / 2;
    
    const configs: PileConfig[] = [];

    // Foundations Top
    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: cx - 150 + (i * 80),
            y: 50,
            fan: 'none'
        });
    }

    // Stock
    configs.push({ id: 'stock', type: 'stock', x: 20, y: 200, fan: 'none' });

    // Waste (4 piles)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `tableau-${i}`, // Using tableau type for waste behavior (visual)
            type: 'tableau',
            x: cx - 150 + (i * 80),
            y: 200,
            fan: 'down',
            fanSpacing: 25
        });
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<4; i++) piles[`tableau-${i}`] = [];
    piles['stock'] = [];

    // Extract bases: A, 2, 3, 4
    const bases = [1, 2, 3, 4];
    bases.forEach((r, i) => {
        const idx = deck.findIndex(c => c.rank === r);
        if (idx !== -1) {
            const c = deck.splice(idx, 1)[0];
            c.faceUp = true;
            piles[`foundation-${i}`].push(c);
        }
    });

    // Rest to stock
    deck.forEach(c => {
        c.faceUp = true; // Calculation stock is usually face up one by one?
        // Or face down and you flip?
        // Let's do face down stock, flip to temp? Or just deal to waste?
        // Standard: Draw card, MUST place on one of 4 waste piles.
        // We will simulate this by 'Click stock -> moves to a "hand" or force drag'.
        // Simplified: Click stock -> moves to 'stock' face up pile?
        // Let's use standard stock. You click it, it reveals a card. You drag that card to waste.
        // Engine limitation: Stock usually moves to Waste automatically or Recycles.
        // Here, we need to drag FROM stock TO waste.
        c.faceUp = false;
        piles['stock'].push(c);
    });

    return piles;
  },

  onStockClick: (gameState) => {
      // In Calculation, you turn over a card and play it.
      // If we use standard engine, click stock flips card?
      // We can just flip top card of stock in place.
      const stock = gameState.piles.stock;
      if (stock.length === 0) return null;
      
      const newStock = [...stock];
      const top = newStock[newStock.length-1];
      if (!top.faceUp) {
          top.faceUp = true;
          return { piles: { ...gameState.piles, stock: newStock } };
      }
      return null;
  },

  canDrag: (pileId, cardIndex, cards) => {
      if (pileId === 'stock') return cardIndex === cards.length - 1 && cards[cardIndex].faceUp;
      if (pileId.startsWith('tableau')) return cardIndex === cards.length - 1;
      return false;
  },

  canDrop: (move, targetPileCards, gameState) => {
      const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
      const leadCard = movingCards[0];
      const targetTop = targetPileCards[targetPileCards.length - 1];

      // To Waste
      if (move.targetPileId.startsWith('tableau')) {
          if (move.sourcePileId !== 'stock') return false; // Can only move stock to waste
          return true; // Any card to any waste
      }

      // To Foundation
      if (move.targetPileId.startsWith('foundation')) {
          const fid = parseInt(move.targetPileId.split('-')[1]);
          const interval = fid + 1; // 1, 2, 3, 4
          
          if (!targetTop) return false; // Should have bases
          
          return isNextCalculationRank(targetTop.rank, leadCard.rank, interval);
      }

      return false;
  },

  winCondition: (gameState) => {
      let count = 0;
      for(let i=0; i<4; i++) count += gameState.piles[`foundation-${i}`]?.length || 0;
      return count === 52;
  }
};