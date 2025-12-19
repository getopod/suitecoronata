import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveDescending, isConsecutiveAscending } from '../utils/cards';

export const FortyThieves: GameRules = {
  name: "Forty Thieves",
  description: "Two decks. Build down in suit. Only one card moved at a time. Very hard.",
  details: {
      objective: "Build all 8 foundations from Ace to King in suit.",
      controls: "Drag top cards only. Build tableaus down in suit.",
      rules: [
          "Move one card at a time.",
          "Tableaus build down in same suit.",
          "Empty tableau can be filled by any card.",
          "Stock deals one card to waste."
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
    const topY = 50;
    
    // Stock/Waste Left
    configs.push({ id: 'stock', type: 'stock', x: startX, y: topY, fan: 'none' });
    configs.push({ id: 'waste', type: 'waste', x: startX + cardW + 10, y: topY, fan: 'none' });

    // Foundations Right (8 piles)
    // 2 rows of 4? Or 1 row if space? 10 cols is wide.
    // Let's put 8 foundations above the 10 tableaus? 
    // Maybe split: 4 left, 4 right?
    // Let's put them in a row above tableaus, maybe squeezed or 2 rows.
    // 10 cols. Foundations can take cols 2-9.
    for(let i=0; i<8; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: startX + ((i + 2) * (cardW + gap)),
            y: topY,
            fan: 'none'
        });
    }

    const tabY = topY + cardH + 20;
    for(let i=0; i<10; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: startX + (i * (cardW + gap)),
            y: tabY,
            fan: 'down',
            fanSpacing: 25
        });
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck(2); // 2 decks
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<10; i++) piles[`tableau-${i}`] = [];
    for(let i=0; i<8; i++) piles[`foundation-${i}`] = [];
    piles['stock'] = [];
    piles['waste'] = [];

    let c = 0;
    // 4 cards each to 10 tableaus, face up
    for(let i=0; i<10; i++) {
        for(let j=0; j<4; j++) {
            piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
        }
    }
    while(c < deck.length) piles['stock'].push({ ...deck[c++], faceUp: false });

    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      if (stock.length === 0) return null; // No recycle
      const newStock = [...stock];
      const newWaste = [...gameState.piles.waste];
      const card = newStock.pop();
      if (card) {
          card.faceUp = true;
          newWaste.push(card);
      }
      return { piles: { ...gameState.piles, stock: newStock, waste: newWaste } };
  },

  canDrag: (pileId, cardIndex, cards) => {
      if (pileId === 'waste') return true;
      if (pileId.startsWith('tableau')) return cardIndex === cards.length - 1; // Only top card
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
          if (!targetTop) return true; // Empty space allowed
          return isSameSuit(targetTop, leadCard) && isConsecutiveDescending(targetTop, leadCard);
      }
      return false;
  },

  winCondition: (gameState) => {
      for(let i=0; i<8; i++) {
          if ((gameState.piles[`foundation-${i}`]?.length || 0) !== 13) return false;
      }
      return true;
  }
};
