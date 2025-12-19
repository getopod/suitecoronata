import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveDescending } from '../utils/cards';

export const Scorpion: GameRules = {
  name: "Scorpion",
  description: "Build down in suit. You can move any face-up group. 3 cards in reserve.",
  details: {
      objective: "Build 4 columns of cards descending from King to Ace in the SAME suit.",
      controls: "Drag any face-up card. Click the stock to deal the final 3 cards.",
      rules: [
          "You can move any face-up card, along with any cards on top of it.",
          "You can only drop a card on a tableau if it is the SAME suit and one rank higher (e.g. 7♠ on 8♠).",
          "Empty columns can only be filled by a King.",
          "When stuck, click the stock pile to deal the 3 reserve cards to the first 3 columns."
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
    
    // Stock (Reserve) - Top Left
    configs.push({ id: 'stock', type: 'stock', x: startX, y: topRowY, fan: 'none' });

    // 7 Tableaus
    const tableauY = topRowY + cardH + 20;
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
    for(let i=0; i<7; i++) piles[`tableau-${i}`] = [];

    let c = 0;
    
    // First 4 columns: 3 down, 4 up (7 cards)
    for(let i=0; i<4; i++) {
        for(let j=0; j<3; j++) piles[`tableau-${i}`].push({ ...deck[c++], faceUp: false });
        for(let j=0; j<4; j++) piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
    }

    // Next 3 columns: 7 up
    for(let i=4; i<7; i++) {
        for(let j=0; j<7; j++) piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
    }

    // Remaining 3 to stock (Reserve)
    while(c < deck.length) {
        piles['stock'].push({ ...deck[c++], faceUp: false });
    }
    
    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      if (stock.length === 0) return null;
      
      const newPiles = { ...gameState.piles };
      const newStock: typeof stock = []; // Stock is emptied
      
      // Deal the 3 reserve cards to the first 3 tableaus
      for(let i=0; i<3; i++) {
          if (stock[i]) {
              const card = { ...stock[i], faceUp: true };
              newPiles[`tableau-${i}`] = [...newPiles[`tableau-${i}`], card];
          }
      }

      return { piles: { ...newPiles, stock: newStock } };
  },

  canDrag: (pileId, cardIndex, cards) => {
    if (pileId === 'stock') return false;
    const card = cards[cardIndex];
    // Like Yukon, can drag any face-up card
    return card.faceUp; 
  },

  canDrop: (move, targetPileCards, gameState) => {
    const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
    const leadCard = movingCards[0];
    const targetTop = targetPileCards[targetPileCards.length - 1];

    if (move.targetPileId.startsWith('tableau')) {
        // Empty spot: Must be King
        if (!targetTop) return leadCard.rank === 13;
        // Must be same suit, one rank lower (e.g. 6H on 7H)
        return isSameSuit(targetTop, leadCard) && isConsecutiveDescending(targetTop, leadCard);
    }
    
    return false;
  },

  winCondition: (gameState) => {
    // Win if we have 4 columns of King down to Ace (Same suit)
    // Simplified check: Are there 4 full runs of 13? 
    // Technically Scorpion allows the runs to be anywhere, but usually users stack them.
    // We'll check if all cards are arranged in K-A sequences.
    
    let completeRuns = 0;
    for(let i=0; i<7; i++) {
        const pile = gameState.piles[`tableau-${i}`];
        if (pile.length === 13 && pile[0].rank === 13 && pile[12].rank === 1) {
             // Check strict suit sequence
             let valid = true;
             for(let j=0; j<12; j++) {
                 if (!isSameSuit(pile[j], pile[j+1]) || !isConsecutiveDescending(pile[j], pile[j+1])) {
                     valid = false;
                     break;
                 }
             }
             if (valid) completeRuns++;
        }
    }
    return completeRuns === 4;
  }
};