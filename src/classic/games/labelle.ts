import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveAscending, isConsecutiveDescending } from '../utils/cards';

export const LaBelleLucie: GameRules = {
  name: "La Belle Lucie",
  description: "A fan game. Build foundations up in suit. Tableaus build down in suit. 2 Redeals allowed.",
  details: {
      objective: "Build all 4 foundations from Ace to King in suit.",
      controls: "Drag top cards. Tableaus build down in suit. No filling empty spaces. Click stock for redeal.",
      rules: [
          "18 fans of 3 cards (last one has 1).",
          "Top card of each fan is available.",
          "Foundations build Up in ClassicSuit (A-K).",
          "Tableaus build Down in ClassicSuit.",
          "Empty fans cannot be filled.",
          "Two redeals allowed: Shuffles remaining cards and redeals."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const cardW = Math.min(60, Math.floor(width / 9));
    const cardH = Math.floor(cardW * 1.5);
    const startX = (width - ((8 * cardW) + (7 * 10))) / 2;
    const topY = 20;
    const gapX = cardW + 10;
    const gapY = cardH + 20;

    const configs: PileConfig[] = [];

    // Foundations (Top Row) - 4
    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: startX + (i * gapX),
            y: topY,
            fan: 'none'
        });
    }

    // Stock (Redeal Button) - Top Right
    configs.push({ id: 'stock', type: 'stock', x: width - cardW - 20, y: topY, fan: 'none' });

    // 18 Fans
    // 3 rows of 6? 6x3 = 18.
    const startTabX = (width - ((6 * cardW) + (5 * 10))) / 2;
    for(let r=0; r<3; r++) {
        for(let c=0; c<6; c++) {
            const idx = r * 6 + c;
            configs.push({
                id: `tableau-${idx}`,
                type: 'tableau',
                x: startTabX + (c * gapX),
                y: topY + cardH + 40 + (r * gapY),
                fan: 'right', // Small spread
                fanSpacing: 15
            });
        }
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    piles['stock'] = [];
    
    // 18 tableaus
    for(let i=0; i<18; i++) piles[`tableau-${i}`] = [];

    let c = 0;
    // Deal 3 cards to first 17 piles, 1 to last
    for(let i=0; i<17; i++) {
        for(let j=0; j<3; j++) {
            piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
        }
    }
    piles[`tableau-17`].push({ ...deck[c++], faceUp: true });

    // Stock holds 2 "dummy" cards for 2 redeals.
    // We use special IDs or just standard cards (doesn't matter, they are markers)
    piles['stock'].push({ id: 'redeal-1', rank: 1, suit: 'S', faceUp: false });
    piles['stock'].push({ id: 'redeal-2', rank: 1, suit: 'S', faceUp: false });

    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      if (stock.length === 0) return null; // No redeals left

      // Gather all tableau cards
      let allCards: CardData[] = [];
      for(let i=0; i<18; i++) {
          allCards = [...allCards, ...gameState.piles[`tableau-${i}`]];
      }

      // Shuffle
      for (let i = allCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
      }

      // Redeal
      const newPiles = { ...gameState.piles };
      for(let i=0; i<18; i++) newPiles[`tableau-${i}`] = []; // Clear
      
      let c = 0;
      let pileIdx = 0;
      while(c < allCards.length) {
          // In La Belle Lucie redeal, usually dealt in 3s again?
          // Rules say: "Gather, shuffle, redeal into fans of 3".
          if (pileIdx >= 18) pileIdx = 0; // Wrap if somehow overflow? usually fills 18 piles max logic?
          // Wait, if fewer cards, we have fewer piles.
          // We just fill piles until cards run out.
          
          const limit = Math.min(c + 3, allCards.length);
          for(let k=c; k<limit; k++) {
              newPiles[`tableau-${pileIdx}`].push(allCards[k]);
          }
          c += 3;
          pileIdx++;
      }

      // Remove 1 redeal marker
      const newStock = stock.slice(0, -1);
      
      return { piles: { ...newPiles, stock: newStock } };
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
          if (!targetTop) return false; // Empty piles cannot be filled in La Belle Lucie
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