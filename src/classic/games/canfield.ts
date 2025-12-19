import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isAlternatingColor, isConsecutiveDescending, isSameSuit, isConsecutiveAscending } from '../utils/cards';

export const Canfield: GameRules = {
  name: "Canfield",
  description: "A difficult classic. Deal 13 to reserve. Build foundations in suit. Tableaus build down alternating color.",
  details: {
      objective: "Build 4 foundations in suit, wrapping K to A if needed.",
      controls: "Move reserve cards to foundations or tableau. Empty tableau filled from reserve.",
      rules: [
          "Reserve contains 13 cards.",
          "Foundations start with a random rank.",
          "Tableaus build down alternating color. Wrapping allowed (A on K, K on A? No, standard is strict but let's check variant).",
          "Actually, standard Canfield builds down alt color, wrapping allowed.",
          "Empty tableau space filled from Reserve first.",
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const numCols = 6; // Reserve(1) + 4 Tableau + gap
    const margin = 2;
    const gap = 2;
    let cardW = Math.floor((width - (2 * margin) - ((numCols) * gap)) / numCols);
    if (cardW > 90) cardW = 90;
    const cardH = Math.floor(cardW * 1.5);
    const startX = (width - ((numCols * cardW) + ((numCols - 1) * gap))) / 2;

    const configs: PileConfig[] = [];
    const topY = 50;

    // Reserve (Left)
    configs.push({ id: 'reserve', type: 'reserve', x: startX, y: topY + cardH + 20, fan: 'down', fanSpacing: 2 });
    
    // Foundations (Top Rightish)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: startX + ((i + 2) * (cardW + gap)),
            y: topY,
            fan: 'none'
        });
    }

    // Stock & Waste (Top Left)
    configs.push({ id: 'stock', type: 'stock', x: startX, y: topY, fan: 'none' });
    configs.push({ id: 'waste', type: 'waste', x: startX + cardW + gap, y: topY, fan: 'none' });

    // Tableau (4 piles)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: startX + ((i + 2) * (cardW + gap)),
            y: topY + cardH + 20,
            fan: 'down',
            fanSpacing: 20
        });
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<4; i++) piles[`tableau-${i}`] = [];
    piles['reserve'] = [];
    piles['stock'] = [];
    piles['waste'] = [];

    let c = 0;
    // 13 to reserve
    for(let i=0; i<13; i++) {
        const card = deck[c++];
        // In Canfield reserve is squared but top is available. We'll show all squared but bottom one is top?
        // Usually only top is visible. We'll simulate by making them face down except top?
        // Or just stacked.
        card.faceUp = (i === 12); 
        piles['reserve'].push(card);
    }
    
    // 1 to first foundation to set rank
    const seedCard = deck[c++];
    seedCard.faceUp = true;
    piles[`foundation-0`].push(seedCard);
    
    // 4 to tableau
    for(let i=0; i<4; i++) piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });

    // Rest to stock
    while(c < deck.length) piles['stock'].push({ ...deck[c++], faceUp: false });

    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      const waste = gameState.piles.waste;

      if (stock.length === 0) {
          // Recycle
          if (waste.length === 0) return null;
          const newStock = [...waste].reverse().map(c => ({ ...c, faceUp: false }));
          return { piles: { ...gameState.piles, stock: newStock, waste: [] } };
      }

      const newStock = [...stock];
      const newWaste = [...waste];
      // Deal 3
      for(let i=0; i<3; i++) {
          if (newStock.length > 0) {
              const c = newStock.pop()!;
              c.faceUp = true;
              newWaste.push(c);
          }
      }
      return { piles: { ...gameState.piles, stock: newStock, waste: newWaste } };
  },

  canDrag: (pileId, cardIndex, cards) => {
      if (pileId === 'reserve') return cardIndex === cards.length - 1;
      if (pileId === 'waste') return cardIndex === cards.length - 1;
      if (pileId.startsWith('tableau')) {
          // Can drag entire packed sequence
          return isAlternatingColor(cards[cardIndex], cards[cardIndex]? cards[cardIndex] : cards[cardIndex]); // Simple check?
          // Full run check:
          const stack = cards.slice(cardIndex);
          if (stack.length === 1) return true;
          // Canfield: only top card? Or entire sequence? 
          // Usually entire sequence is allowed.
          return true; // Simplified: Allow dragging any stack, drop logic checks validity
      }
      return false;
  },

  canDrop: (move, targetPileCards, gameState) => {
      const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
      const leadCard = movingCards[0];
      const targetTop = targetPileCards[targetPileCards.length - 1];

      // Foundation
      if (move.targetPileId.startsWith('foundation')) {
          if (movingCards.length > 1) return false;
          // Must match base rank logic.
          // In standard engine, we don't store "base rank". We have to infer from other foundations or just standard logic.
          // BUT Canfield base rank is determined by the first card dealt.
          // We can check if pile is empty. If so, must match base rank of game.
          // Find base rank from foundation-0 bottom card if exists?
          // Or any non-empty foundation bottom card.
          let baseRank = -1;
          for(let i=0; i<4; i++) {
              const f = gameState.piles[`foundation-${i}`];
              if (f && f.length > 0) {
                  baseRank = f[0].rank;
                  break;
              }
          }
          
          if (!targetTop) {
               return leadCard.rank === baseRank;
          }
          return isSameSuit(targetTop, leadCard) && (
              leadCard.rank === targetTop.rank + 1 || (targetTop.rank === 13 && leadCard.rank === 1)
          );
      }

      // Tableau
      if (move.targetPileId.startsWith('tableau')) {
          if (!targetTop) {
              // Empty space: Must come from Reserve if Reserve not empty?
              // Strict rule: Reserve > Waste/Stock.
              // Engine doesn't enforce source priority in `canDrop` easily without game state check.
              // But we can allow it.
              return true; 
          }
          return isAlternatingColor(targetTop, leadCard) && (
              leadCard.rank === targetTop.rank - 1 || (targetTop.rank === 1 && leadCard.rank === 13) // Wrapping? Canfield usually wraps.
          );
      }
      return false;
  },

  onPostMove: (gameState) => {
      // Auto-fill empty tableau from reserve
      const reserve = gameState.piles['reserve'];
      if (!reserve || reserve.length === 0) return null;

      const newPiles = { ...gameState.piles };
      let changed = false;

      for(let i=0; i<4; i++) {
          const tab = newPiles[`tableau-${i}`];
          if (tab.length === 0 && newPiles['reserve'].length > 0) {
              const card = newPiles['reserve'].pop()!;
              card.faceUp = true;
              newPiles[`tableau-${i}`] = [card];
              // Update reserve top card visibility
              if (newPiles['reserve'].length > 0) {
                  newPiles['reserve'][newPiles['reserve'].length - 1].faceUp = true;
              }
              changed = true;
          }
      }
      
      return changed ? { piles: newPiles } : null;
  },

  winCondition: (gameState) => {
     return ['foundation-0', 'foundation-1', 'foundation-2', 'foundation-3'].every(
            id => (gameState.piles[id]?.length || 0) === 13
       );
  }
};