import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isRed, isConsecutiveDescending, isAlternatingColor, isConsecutiveAscending, isSameSuit, isRunDescendingAltColor } from '../utils/cards';

export const FreeCell: GameRules = {
  name: "FreeCell",
  description: "Use four free cells to move cards and build foundations.",
  details: {
      objective: "Build all 4 foundations from Ace to King in suit.",
      controls: "Drag cards to move them. You can move multiple cards if you have enough empty free cells and columns.",
      rules: [
          "Tableaus build down in alternating color.",
          "Foundations build up in suit.",
          "The 4 Free Cells can hold one card each.",
          "You can only move a stack of cards if you have enough open spaces (Free Cells + Empty Tableaus) to temporarily hold them."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const numCols = 8;
    const margin = Math.max(5, Math.floor(width * 0.02));
    const gap = Math.max(2, Math.floor(width * 0.01));
    
    let cardW = Math.floor((width - (2 * margin) - ((numCols - 1) * gap)) / numCols);
    if (cardW > 110) cardW = 110;
    const cardH = Math.floor(cardW * 1.5);
    
    const contentWidth = (numCols * cardW) + ((numCols - 1) * gap);
    const startX = Math.floor((width - contentWidth) / 2);
    
    const configs: PileConfig[] = [];
    const topRowY = 60;
    const tableauY = topRowY + cardH + Math.max(15, h * 0.03);

    // Free Cells (Left 4)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `cell-${i}`,
            type: 'cell',
            x: startX + (i * (cardW + gap)),
            y: topRowY,
            fan: 'none',
            maxCards: 1
        });
    }

    // Foundations (Right 4)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: startX + ((4 + i) * (cardW + gap)),
            y: topRowY,
            fan: 'none'
        });
    }

    // Tableaus (8 columns)
    for(let i=0; i<8; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: startX + (i * (cardW + gap)),
            y: tableauY,
            fan: 'down',
            fanSpacing: Math.max(18, cardH * 0.25)
        });
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck(); // 52 cards
    const piles: Record<string, CardData[]> = {};
    
    for(let i=0; i<4; i++) piles[`cell-${i}`] = [];
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<8; i++) piles[`tableau-${i}`] = [];

    deck.forEach((card, idx) => {
        card.faceUp = true;
        const col = idx % 8;
        piles[`tableau-${col}`].push(card);
    });

    return piles;
  },

  canDrag: (pileId, cardIndex, cards) => {
    // Cells: Can always drag the single card
    if (pileId.startsWith('cell')) return true;
    
    // Foundations: Usually not allowed in strict FreeCell, but we'll allow dragging back
    if (pileId.startsWith('foundation')) return cardIndex === cards.length - 1;

    // Tableau: Can drag single card, or valid run if enough capacity (checked in canDrop or loosely here)
    if (pileId.startsWith('tableau')) {
        const stack = cards.slice(cardIndex);
        return isRunDescendingAltColor(stack);
    }
    return false;
  },

  canDrop: (move, targetPileCards, gameState) => {
    const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
    const leadCard = movingCards[0];
    const targetTop = targetPileCards[targetPileCards.length - 1];

    // Calculate Capacity for Supermove
    // Max items = (1 + emptyCells) * (2 ^ emptyCols)
    // Note: If dropping into an empty column, that column doesn't count as empty for the calculation
    if (movingCards.length > 1) {
        let emptyCells = 0;
        let emptyCols = 0;
        
        for(const k in gameState.piles) {
            if (k.startsWith('cell') && gameState.piles[k].length === 0) emptyCells++;
            if (k.startsWith('tableau') && gameState.piles[k].length === 0 && k !== move.targetPileId) emptyCols++;
        }
        
        const limit = (1 + emptyCells) * Math.pow(2, emptyCols);
        if (movingCards.length > limit) return false;
    }

    // Drop to Cell
    if (move.targetPileId.startsWith('cell')) {
        return movingCards.length === 1 && targetPileCards.length === 0;
    }

    // Drop to Foundation
    if (move.targetPileId.startsWith('foundation')) {
        if (movingCards.length > 1) return false;
        if (!targetTop) return leadCard.rank === 1;
        return isSameSuit(targetTop, leadCard) && isConsecutiveAscending(targetTop, leadCard);
    }

    // Drop to Tableau
    if (move.targetPileId.startsWith('tableau')) {
        if (!targetTop) return true; // Any card(s) to empty tableau (subject to capacity above)
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