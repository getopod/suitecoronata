import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveAscending, isConsecutiveDescending } from '../utils/cards';

export const Cruel: GameRules = {
  name: "Cruel",
  description: "Shift cards to win. Build down in suit. Empty spaces not filled. Infinite redeals via shifting.",
  details: {
      objective: "Build 4 foundations from Ace to King in suit.",
      controls: "Drag top cards. Build tableaus down in suit. Click stock to shift cards (redeal).",
      rules: [
          "Aces start in foundations.",
          "Tableaus build down in suit.",
          "Empty tableau spaces are NEVER filled.",
          "Clicking stock collects all cards and redeals them into piles of 4, preserving order.",
          "You can redeal as many times as you like."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const cardW = Math.min(60, Math.floor(width / 7));
    const cardH = Math.floor(cardW * 1.5);
    const startX = (width - ((6 * cardW) + (5 * 10))) / 2;
    const topY = 20;
    const gapX = cardW + 10;
    const gapY = cardH + 20;

    const configs: PileConfig[] = [];

    // Foundations (Top Rightish) - 4
    // Stock (Redeal) - Top Left
    configs.push({ id: 'stock', type: 'stock', x: startX, y: topY, fan: 'none' });

    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: startX + ((i+2) * gapX),
            y: topY,
            fan: 'none'
        });
    }

    // 12 Tableaus
    // 2 rows of 6
    const startTabX = startX;
    for(let r=0; r<2; r++) {
        for(let c=0; c<6; c++) {
            const idx = r * 6 + c;
            configs.push({
                id: `tableau-${idx}`,
                type: 'tableau',
                x: startTabX + (c * gapX),
                y: topY + cardH + 40 + (r * gapY),
                fan: 'down', 
                fanSpacing: 20
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
    // Infinite redeals, so stock holds a dummy card or just logic handles it. 
    // We'll put 1 permanent card in stock to make it clickable.
    piles['stock'].push({ id: 'redeal-inf', rank: 0, suit: 'S', faceUp: false } as any);
    
    for(let i=0; i<12; i++) piles[`tableau-${i}`] = [];

    // Extract Aces
    const aces = deck.filter(c => c.rank === 1);
    const others = deck.filter(c => c.rank !== 1);

    aces.forEach((a, i) => {
        a.faceUp = true;
        piles[`foundation-${i}`].push(a);
    });

    // Deal rest to 12 piles (4 cards each)
    let c = 0;
    for(let i=0; i<12; i++) {
        for(let j=0; j<4; j++) {
            piles[`tableau-${i}`].push({ ...others[c++], faceUp: true });
        }
    }

    return piles;
  },

  onStockClick: (gameState) => {
      // Cruel Redeal Logic:
      // Gather all tableau cards (preserving order).
      // Deal them out again into 4s.
      
      let allCards: CardData[] = [];
      for(let i=0; i<12; i++) {
          allCards = [...allCards, ...gameState.piles[`tableau-${i}`]];
      }

      const newPiles = { ...gameState.piles };
      for(let i=0; i<12; i++) newPiles[`tableau-${i}`] = []; // Clear
      
      let c = 0;
      let pileIdx = 0;
      while(c < allCards.length) {
          const limit = Math.min(c + 4, allCards.length);
          for(let k=c; k<limit; k++) {
              newPiles[`tableau-${pileIdx}`].push(allCards[k]);
          }
          c += 4;
          pileIdx++;
          if (pileIdx >= 12) pileIdx = 0; // Should fit if 48 cards (12*4)
      }
      
      return { piles: newPiles };
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
          // Aces are already there
          if (!targetTop) return false; 
          return isSameSuit(targetTop, leadCard) && isConsecutiveAscending(targetTop, leadCard);
      }

      if (move.targetPileId.startsWith('tableau')) {
          if (!targetTop) return false; // Empty piles cannot be filled in Cruel
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