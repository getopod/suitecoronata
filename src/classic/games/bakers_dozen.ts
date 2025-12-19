import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isConsecutiveDescending, isConsecutiveAscending, isSameSuit } from '../utils/cards';

export const BakersDozen: GameRules = {
  name: "Baker's Dozen",
  description: "13 columns. Kings moved to bottom at start. Build down regardless of suit. No empty pile fills.",
  details: {
      objective: "Build 4 foundations Ace to King.",
      controls: "Drag top cards. Build down by rank (suit doesn't matter).",
      rules: [
          "Kings are moved to the bottom of their piles during the deal.",
          "Empty tableau piles cannot be filled.",
          "Foundations built in suit."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const numCols = 13; // 13 cols! Narrow cards.
    const margin = 2;
    const gap = 2;
    let cardW = Math.floor((width - (2 * margin) - ((numCols - 1) * gap)) / numCols);
    if (cardW > 60) cardW = 60;
    const cardH = Math.floor(cardW * 1.5);
    const startX = (width - ((numCols * cardW) + ((numCols - 1) * gap))) / 2;

    const configs: PileConfig[] = [];
    const topY = 50;

    // Foundations (4) - Floating somewhere? Right side? 
    // Let's put them top right.
    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: startX + width - (4 * (cardW + 10)) + (i * (cardW + 5)), // Just generic placement
            y: 10,
            fan: 'none'
        });
    }

    const tabY = topY + 20;
    for(let i=0; i<13; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: startX + (i * (cardW + gap)),
            y: tabY,
            fan: 'down',
            fanSpacing: 20
        });
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<13; i++) piles[`tableau-${i}`] = [];
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];

    // Deal 4 cards to 13 cols
    let c = 0;
    for(let i=0; i<13; i++) {
        for(let j=0; j<4; j++) {
            piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
        }
    }

    // Kings to bottom
    for(let i=0; i<13; i++) {
        const pile = piles[`tableau-${i}`];
        // Find kings
        const kings = pile.filter(x => x.rank === 13);
        const others = pile.filter(x => x.rank !== 13);
        piles[`tableau-${i}`] = [...kings, ...others]; // Kings first (bottom)
    }

    return piles;
  },

  canDrag: (pileId, cardIndex, cards) => {
      if (pileId.startsWith('tableau')) return cardIndex === cards.length - 1;
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
          if (!targetTop) return false; // Empty piles cannot be filled
          // Build down by rank, suit ignores
          return isConsecutiveDescending(targetTop, leadCard);
      }
      return false;
  },

  winCondition: (gameState) => {
       return ['foundation-0', 'foundation-1', 'foundation-2', 'foundation-3'].every(
            id => (gameState.piles[id]?.length || 0) === 13
       );
  }
};
