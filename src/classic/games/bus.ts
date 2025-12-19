import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveAscending, isConsecutiveDescending } from '../utils/cards';

export const BusDriver: GameRules = {
  name: "Bus Driver",
  description: "Simple game. 10 columns. Build down in suit. Empty spaces fill with any card.",
  details: {
      objective: "Build 4 foundations in suit.",
      controls: "Move 1 card at a time. Build down in suit. Empty space takes any card.",
      rules: [
          "1 deck.",
          "All cards dealt face up to 10 piles.",
          "Move one card at a time.",
          "Build down in suit."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const numCols = 10; 
    const margin = 2;
    const gap = 2;
    let cardW = Math.floor((width - (2 * margin) - ((numCols - 1) * gap)) / numCols);
    if (cardW > 80) cardW = 80;
    const cardH = Math.floor(cardW * 1.5);
    const startX = (width - ((numCols * cardW) + ((numCols - 1) * gap))) / 2;

    const configs: PileConfig[] = [];
    
    // Foundations Top
    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: startX + ((i+3) * (cardW + gap)),
            y: 40,
            fan: 'none'
        });
    }

    // Tableaus
    for(let i=0; i<10; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: startX + (i * (cardW + gap)),
            y: 40 + cardH + 20,
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
    for(let i=0; i<10; i++) piles[`tableau-${i}`] = [];

    let c = 0;
    while(c < deck.length) {
        for(let i=0; i<10; i++) {
            if (c < deck.length) {
                piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
            }
        }
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
          if (!targetTop) return true; 
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