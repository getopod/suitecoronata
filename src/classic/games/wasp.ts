import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveDescending } from '../utils/cards';

export const Wasp: GameRules = {
  name: "Wasp",
  description: "Like Scorpion, but easier. Any card can be placed in an empty column. All cards start face up.",
  details: {
      objective: "Build 4 columns of cards descending from King to Ace in the SAME suit.",
      controls: "Drag any face-up card. Click the stock to deal the final 3 cards.",
      rules: [
          "All cards are dealt face-up.",
          "You can move any card (and cards on top of it) to another pile.",
          "You must place cards on a card of the SAME suit and one rank higher.",
          "Unlike Scorpion, ANY card or group of cards can be moved to an empty column."
      ]
  },
  
  layout: (w, h) => {
    // Same layout as Scorpion
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
    
    configs.push({ id: 'stock', type: 'stock', x: startX, y: topRowY, fan: 'none' });

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
    
    // In Wasp, typically all cards are dealt face up to start (Open Wasp)
    // 7 columns of 7 cards
    for(let i=0; i<7; i++) {
        for(let j=0; j<7; j++) {
            piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
        }
    }

    // Remaining 3 to stock
    while(c < deck.length) {
        piles['stock'].push({ ...deck[c++], faceUp: false });
    }
    
    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      if (stock.length === 0) return null;
      
      const newPiles = { ...gameState.piles };
      const newStock: typeof stock = []; 
      
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
    return cards[cardIndex].faceUp; 
  },

  canDrop: (move, targetPileCards, gameState) => {
    const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
    const leadCard = movingCards[0];
    const targetTop = targetPileCards[targetPileCards.length - 1];

    if (move.targetPileId.startsWith('tableau')) {
        // Empty spot: Any card allowed in Wasp
        if (!targetTop) return true;
        
        // Must be same suit, one rank lower
        return isSameSuit(targetTop, leadCard) && isConsecutiveDescending(targetTop, leadCard);
    }
    
    return false;
  },

  winCondition: (gameState) => {
    // Same win condition as Scorpion: 4 runs of K-A in suit
    let completeRuns = 0;
    for(let i=0; i<7; i++) {
        const pile = gameState.piles[`tableau-${i}`];
        if (pile.length === 13 && pile[0].rank === 13 && pile[12].rank === 1) {
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