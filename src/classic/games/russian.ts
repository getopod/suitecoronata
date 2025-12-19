import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isConsecutiveDescending, isSameSuit, isConsecutiveAscending } from '../utils/cards';

export const RussianSolitaire: GameRules = {
  name: "Russian Solitaire",
  description: "A variation of Yukon. You must build tableaus down in the SAME suit. Very difficult.",
  details: {
      objective: "Build 4 foundations Ace to King in suit.",
      controls: "Drag any face-up card. Build tableaus down in SAME suit (e.g., 6♠ on 7♠).",
      rules: [
          "Groups of cards can be moved regardless of sequence.",
          "Tableaus build down in same suit.",
          "Foundations build up in same suit.",
          "Kings fill empty tableau spaces."
      ]
  },
  
  layout: (w, h) => {
    // Same layout as Yukon
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

    for (let i = 0; i < 4; i++) {
        configs.push({ 
            id: `foundation-${i}`, 
            type: 'foundation', 
            x: startX + ((i) * (cardW + gap)), 
            y: topRowY, 
            fan: 'none' 
        });
    }

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
    // Same deal as Yukon
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<7; i++) piles[`tableau-${i}`] = [];

    let c = 0;
    for (let i = 0; i < 7; i++) {
        const pileName = `tableau-${i}`;
        const faceDownCount = i; 
        for(let j=0; j<faceDownCount; j++) {
            piles[pileName].push({ ...deck[c++], faceUp: false });
        }
        const faceUpCount = i === 0 ? 1 : 5;
        for(let j=0; j<faceUpCount; j++) {
            piles[pileName].push({ ...deck[c++], faceUp: true });
        }
    }
    return piles;
  },

  canDrag: (pileId, cardIndex, cards) => {
    if (pileId.startsWith('foundation')) return false;
    // Can drag any face up card (Yukon style)
    const card = cards[cardIndex];
    return card.faceUp; 
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
        if (!targetTop) return leadCard.rank === 13;
        // Russian Solitaire: Build down in SAME SUIT
        return isSameSuit(targetTop, leadCard) && isConsecutiveDescending(targetTop, leadCard);
    }
    
    return false;
  },

  winCondition: (gameState) => {
    return ['foundation-0', 'foundation-1', 'foundation-2', 'foundation-3'].every(
      id => (gameState.piles[id]?.length || 0) === 13
    );
  }
};
