import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveAscending, isConsecutiveDescending, isAlternatingColor, isRunDescendingAltColor } from '../utils/cards';

export const Easthaven: GameRules = {
  name: "Easthaven",
  description: "A hybrid of Klondike and Spider. Build down alternating colors. Stock deals a card to every tableau.",
  details: {
      objective: "Build 4 foundations Ace to King.",
      controls: "Drag valid sequences (alt color). Click stock to deal 1 card to each tableau.",
      rules: [
          "Tableaus build down alternating color.",
          "Foundations build up in suit.",
          "Empty tableau can be filled by any King (or sequence starting with King).",
          "Clicking stock deals 1 card to all 7 tableaus."
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
    const tableauY = topRowY + cardH + Math.max(10, h * 0.02);
    
    // Stock (Top Left)
    configs.push({ id: 'stock', type: 'stock', x: startX, y: topRowY, fan: 'none' });
    
    // Foundations (Top Right - 4)
    for (let i = 0; i < 4; i++) {
        configs.push({ 
            id: `foundation-${i}`, 
            type: 'foundation', 
            x: startX + ((3 + i) * (cardW + gap)), 
            y: topRowY, 
            fan: 'none' 
        });
    }

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
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<7; i++) piles[`tableau-${i}`] = [];

    let c = 0;
    // Deal 3 cards to each of 7 tableaus (2 down, 1 up)
    for (let i = 0; i < 7; i++) {
        piles[`tableau-${i}`].push({ ...deck[c++], faceUp: false });
        piles[`tableau-${i}`].push({ ...deck[c++], faceUp: false });
        piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
    }

    while (c < deck.length) {
        piles['stock'].push({ ...deck[c++], faceUp: false });
    }

    return piles;
  },

  onStockClick: (gameState) => {
    const stock = gameState.piles.stock;
    if (stock.length === 0) return null; // No recycle in Easthaven usually (or strict limits)

    // Easthaven typically deals 1 to each tableau (Spider style)
    // If not enough cards for all, deal what we have? 
    // Standard rules: usually 31 cards in stock (52 - 21). 7 * 4 = 28. Remainder 3.
    // Let's deal to first N columns if < 7 cards remain.

    const newStock = [...stock];
    const newPiles = { ...gameState.piles };
    
    for(let i=0; i<7; i++) {
        const card = newStock.pop();
        if (card) {
            card.faceUp = true;
            newPiles[`tableau-${i}`] = [...newPiles[`tableau-${i}`], card];
        }
    }
    
    return { piles: { ...newPiles, stock: newStock } };
  },

  canDrag: (pileId, cardIndex, cards) => {
    if (pileId === 'stock') return true; 
    const card = cards[cardIndex];
    if (!card.faceUp) return false;
    
    if (pileId.startsWith('foundation')) return cardIndex === cards.length - 1;

    if (pileId.startsWith('tableau')) {
        // Klondike style dragging
        const stack = cards.slice(cardIndex);
        return isRunDescendingAltColor(stack);
    }
    return false;
  },

  canDrop: (move, targetPileCards, gameState) => {
    const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
    const leadCard = movingCards[0];
    const targetTop = targetPileCards[targetPileCards.length - 1];

    if (move.targetPileId.startsWith('foundation')) {
        if (movingCards.length > 1) return false;
        if (!targetTop) return leadCard.rank === 1;
        return isSameSuit(targetTop, leadCard) && isConsecutiveAscending(targetTop, leadCard);
    }

    if (move.targetPileId.startsWith('tableau')) {
        if (!targetTop) return leadCard.rank === 13; // King only
        return isAlternatingColor(targetTop, leadCard) && isConsecutiveDescending(targetTop, leadCard);
    }
    return false;
  },

  winCondition: (gameState) => {
    return ['foundation-0', 'foundation-1', 'foundation-2', 'foundation-3'].every(
      id => (gameState.piles[id]?.length || 0) === 13
    );
  }
};
