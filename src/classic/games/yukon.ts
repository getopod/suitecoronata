import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isConsecutiveDescending, isAlternatingColor, isSameSuit, isConsecutiveAscending } from '../utils/cards';

export const Yukon: GameRules = {
  name: "Yukon",
  description: "Similar to Klondike, but you can move any face-up card group. 21 cards start face-down.",
  details: {
      objective: "Build 4 foundations from Ace to King in suit.",
      controls: "Drag any face-up card to move it. All cards on top of it will move with it.",
      rules: [
          "You can move any face-up card, regardless of what is on top of it.",
          "You can only drop a card on a tableau if it is an alternating color and one rank higher (e.g. Red 6 on Black 7).",
          "Foundations build up in suit.",
          "Empty tableau piles can only be filled by a King."
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

    // Foundations (Right aligned effectively, but let's put them on the right side of header area or centered-ish)
    // Actually, Yukon usually just has foundations at top, tableaus below.
    // Let's use 4 foundations.
    for (let i = 0; i < 4; i++) {
        configs.push({ 
            id: `foundation-${i}`, 
            type: 'foundation', 
            x: startX + ((i) * (cardW + gap)), // Left aligned foundations
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
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<7; i++) piles[`tableau-${i}`] = [];

    // Deal Logic
    // Col 0: 1 card up
    // Col 1: 1 down, 5 up
    // Col 2: 2 down, 5 up
    // ...
    // Col 6: 6 down, 5 up
    let c = 0;
    for (let i = 0; i < 7; i++) {
        const pileName = `tableau-${i}`;
        // Face down cards
        const faceDownCount = i; 
        for(let j=0; j<faceDownCount; j++) {
            piles[pileName].push({ ...deck[c++], faceUp: false });
        }
        // Face up cards (1 for first col, 5 for others)
        const faceUpCount = i === 0 ? 1 : 5;
        for(let j=0; j<faceUpCount; j++) {
            piles[pileName].push({ ...deck[c++], faceUp: true });
        }
    }
    
    return piles;
  },

  canDrag: (pileId, cardIndex, cards) => {
    if (pileId.startsWith('foundation')) return false; // Usually can't drag from foundation in Yukon (strict)
    
    // In Yukon, you can drag ANY face-up card, even if the stack isn't a sequence
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