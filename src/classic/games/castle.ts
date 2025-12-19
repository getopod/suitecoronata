import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveAscending, isConsecutiveDescending } from '../utils/cards';

export const BeleagueredCastle: GameRules = {
  name: "Beleaguered Castle",
  description: "Foundations in the middle. Tableaus on wings. Build down regardless of suit. Only top card moves.",
  details: {
      objective: "Build 4 foundations in suit A to K.",
      controls: "Move top cards. Build down in any suit on tableaus. Fill empty tableaus with any card.",
      rules: [
          "Aces are removed to foundations at start.",
          "Only one card can be moved at a time.",
          "Tableaus build down in rank (suit doesn't matter).",
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const cardW = Math.min(60, Math.floor(width / 9));
    const cardH = Math.floor(cardW * 1.5);
    const gap = 5;
    const startX = (width - ((8 * cardW) + (7 * gap))) / 2; // Approximated
    
    // Layout: 4 Left, 4 Center (Foundations), 4 Right
    // But Beleaguered Castle is typically: 4 Foundations vertical in center. 
    // 4 Rows of tableau left, 4 Rows right.
    // Let's do a central column for Foundations.
    
    const centerX = width / 2;
    const centerLeft = centerX - (cardW / 2);
    
    const configs: PileConfig[] = [];
    const topY = 40;
    
    // Foundations (Center Vertical)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: centerLeft,
            y: topY + (i * (cardH + 10)),
            fan: 'none'
        });
    }

    // Left Wings (4)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: centerLeft - cardW - 20,
            y: topY + (i * (cardH + 10)),
            fan: 'right', // Build leftwards visually? Usually just pile. Let's fan left.
            fanSpacing: 25 // We only support right/down fan in simple engine. Let's fan right but position it further left?
            // Actually, standard is rows. Let's fan right, but starting way left.
        });
        // Override X to be further left
        configs[configs.length-1].x = centerLeft - cardW - 20 - 150; // Manual adjust
    }

    // Right Wings (4)
    for(let i=4; i<8; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: centerLeft + cardW + 20,
            y: topY + ((i-4) * (cardH + 10)),
            fan: 'right',
            fanSpacing: 25
        });
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<8; i++) piles[`tableau-${i}`] = [];

    // Extract Aces
    const aces = deck.filter(c => c.rank === 1);
    const others = deck.filter(c => c.rank !== 1);

    aces.forEach((a, i) => {
        a.faceUp = true;
        piles[`foundation-${i}`].push(a);
    });

    // Deal rest to 8 piles
    let c = 0;
    while(c < others.length) {
        for(let i=0; i<8; i++) {
            if (c < others.length) {
                piles[`tableau-${i}`].push({ ...others[c++], faceUp: true });
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
          if (!targetTop) return leadCard.rank === 1; // Already have aces usually
          return isSameSuit(targetTop, leadCard) && isConsecutiveAscending(targetTop, leadCard);
      }

      if (move.targetPileId.startsWith('tableau')) {
          if (!targetTop) return true; // Empty fills with any
          return isConsecutiveDescending(targetTop, leadCard); // ClassicSuit ignored
      }
      return false;
  },

  winCondition: (gameState) => {
     return ['foundation-0', 'foundation-1', 'foundation-2', 'foundation-3'].every(
            id => (gameState.piles[id]?.length || 0) === 13
       );
  }
};