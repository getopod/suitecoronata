import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isRankNeighbor } from '../utils/cards';

export const Golf: GameRules = {
  name: "Golf",
  description: "Remove cards to the waste pile by matching ranks one higher or lower. Try to clear the board!",
  details: {
      objective: "Move all cards from the tableaus to the waste pile.",
      controls: "Tap or drag a card that is one rank higher or lower than the top waste card.",
      rules: [
          "Suits do not matter.",
          "You can play a 4 on a 5, or a 6 on a 5.",
          "Check settings to enable King-Ace wrapping.",
          "Cards must be exposed (top of pile) to be played."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const numCols = 7;
    const margin = Math.max(5, Math.floor(width * 0.02));
    const gap = Math.max(2, Math.floor(width * 0.015));
    
    let cardW = Math.floor((width - (2 * margin) - ((numCols - 1) * gap)) / numCols);
    if (cardW > 120) cardW = 120;
    const cardH = Math.floor(cardW * 1.5);
    
    const contentWidth = (numCols * cardW) + ((numCols - 1) * gap);
    const startX = Math.floor((width - contentWidth) / 2);
    
    const configs: PileConfig[] = [];
    const topRowY = 60;
    const tableauY = topRowY + cardH + Math.max(15, h * 0.03);

    // Stock & Waste (Foundation)
    // We treat the Waste pile as a 'foundation' so the engine awards points/animates it correctly
    configs.push({ id: 'stock', type: 'stock', x: startX, y: topRowY, fan: 'none' });
    configs.push({ id: 'foundation-0', type: 'foundation', x: startX + cardW + gap, y: topRowY, fan: 'none' });

    // 7 Tableaus
    for (let i = 0; i < 7; i++) {
        configs.push({ 
            id: `tableau-${i}`, 
            type: 'tableau', 
            x: startX + (i * (cardW + gap)), 
            y: tableauY, 
            fan: 'down', 
            fanSpacing: Math.max(15, cardH * 0.22)
        });
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    piles['stock'] = [];
    piles['foundation-0'] = []; // Waste
    
    let c = 0;
    // 7 cols of 5 cards
    for(let i=0; i<7; i++) {
        piles[`tableau-${i}`] = [];
        for(let j=0; j<5; j++) {
            piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
        }
    }
    
    // 1 card to waste
    piles['foundation-0'].push({ ...deck[c++], faceUp: true });
    
    // Rest to stock
    while(c < deck.length) {
        piles['stock'].push({ ...deck[c++], faceUp: false });
    }
    
    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      if (stock.length === 0) return null;
      
      const newStock = [...stock];
      const card = newStock.pop();
      if (card) card.faceUp = true;
      
      const waste = gameState.piles['foundation-0'];
      
      return {
          piles: {
              ...gameState.piles,
              stock: newStock,
              'foundation-0': [...waste, card!]
          }
      };
  },

  canDrag: (pileId, cardIndex, cards) => {
    if (pileId === 'stock') return false; // Handled by click
    
    // Can only drag top card of tableau
    if (pileId.startsWith('tableau')) {
        return cardIndex === cards.length - 1;
    }
    return false;
  },

  canDrop: (move, targetPileCards, gameState, settings) => {
    const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
    const leadCard = movingCards[0];
    const targetTop = targetPileCards[targetPileCards.length - 1];

    // Must drop on Waste (foundation-0)
    if (move.targetPileId === 'foundation-0') {
        if (!targetTop) return false;
        
        // Standard Check (+1 / -1)
        if (isRankNeighbor(targetTop, leadCard)) return true;

        // Wrap Around Check
        if (settings?.allowWrap) {
             const diff = Math.abs(targetTop.rank - leadCard.rank);
             if (diff === 12) return true; // K-A or A-K
        }
        
        return false;
    }
    
    return false;
  },

  winCondition: (gameState) => {
    // Win if all tableaus are empty
    for(let i=0; i<7; i++) {
        if ((gameState.piles[`tableau-${i}`]?.length || 0) > 0) return false;
    }
    return true;
  }
};
