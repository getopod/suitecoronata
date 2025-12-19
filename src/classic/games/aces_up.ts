import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit } from '../utils/cards';

export const AcesUp: GameRules = {
  name: "Aces Up",
  description: "Remove lower ranked cards of the same suit. Goal: Leave only Aces.",
  details: {
      objective: "Remove all cards except the 4 Aces.",
      controls: "Click a card to remove it if a higher card of the same suit is visible at the top of another pile. Aces are high.",
      rules: [
          "Deal 4 cards at a time.",
          "Top cards of piles are available.",
          "If two top cards have same suit, the lower rank can be removed.",
          "Aces are high (rank 14 effectively).",
          "Empty spaces can be filled by any top card."
      ]
  },
  interactionMode: 'standard', // We use click to remove

  layout: (w, h) => {
    const width = w || 360;
    const cardW = 80;
    const cardH = 120;
    const gap = 10;
    const startX = (width - ((4*cardW) + (3*gap))) / 2;
    
    const configs: PileConfig[] = [];
    
    // Stock
    configs.push({ id: 'stock', type: 'stock', x: 20, y: h - 140, fan: 'none' });
    
    // Tableaus
    for(let i=0; i<4; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: startX + (i * (cardW + gap)),
            y: 50,
            fan: 'down',
            fanSpacing: 25
        });
    }
    // Foundation (Waste/Removed)
    configs.push({ id: 'foundation-0', type: 'foundation', x: width - 100, y: h - 140, fan: 'none' });

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<4; i++) piles[`tableau-${i}`] = [];
    piles['stock'] = [];
    piles['foundation-0'] = [];

    // Deal 4
    let c = 0;
    for(let i=0; i<4; i++) piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
    
    while(c < deck.length) piles['stock'].push({ ...deck[c++], faceUp: false });

    return piles;
  },

  onStockClick: (gameState) => {
      const stock = gameState.piles.stock;
      if (stock.length === 0) return null;
      
      const newPiles = { ...gameState.piles };
      const newStock = [...stock];
      
      for(let i=0; i<4; i++) {
          if (newStock.length > 0) {
              const c = newStock.pop()!;
              c.faceUp = true;
              newPiles[`tableau-${i}`] = [...newPiles[`tableau-${i}`], c];
          }
      }
      return { piles: { ...newPiles, stock: newStock } };
  },

  onCardClick: (card, pileId, gameState) => {
      if (!pileId.startsWith('tableau')) return null;
      
      // Must be top card
      const pile = gameState.piles[pileId];
      if (pile[pile.length-1].id !== card.id) return null;

      // Check if removeable
      // Find other top cards
      const myRank = card.rank === 1 ? 14 : card.rank;
      
      let canRemove = false;
      for(let i=0; i<4; i++) {
          const otherPile = gameState.piles[`tableau-${i}`];
          if (otherPile.length > 0) {
              const top = otherPile[otherPile.length-1];
              if (top.id === card.id) continue;
              
              if (isSameSuit(top, card)) {
                  const otherRank = top.rank === 1 ? 14 : top.rank;
                  if (otherRank > myRank) {
                      canRemove = true;
                      break;
                  }
              }
          }
      }

      if (canRemove) {
          const newPiles = { ...gameState.piles };
          newPiles[pileId] = pile.slice(0, pile.length-1);
          newPiles['foundation-0'] = [...newPiles['foundation-0'], card];
          return { piles: newPiles, score: gameState.score + 1 };
      }
      return null;
  },

  canDrag: (pileId, cardIndex, cards) => {
      if (pileId.startsWith('tableau')) return cardIndex === cards.length - 1;
      return false;
  },

  canDrop: (move, targetPileCards, gameState) => {
      if (move.targetPileId.startsWith('tableau')) {
          if (targetPileCards.length === 0) return true; // Empty fill
      }
      return false;
  },

  winCondition: (gameState) => {
      // 4 Aces left in tableaus (size 1 each), foundation has 48 cards?
      let acesCount = 0;
      let otherCount = 0;
      for(let i=0; i<4; i++) {
          const p = gameState.piles[`tableau-${i}`];
          if (p.length > 0) {
             if (p.length > 1) otherCount++;
             if (p[0].rank === 1) acesCount++;
             else otherCount++;
          }
      }
      return otherCount === 0 && acesCount === 4 && gameState.piles['stock'].length === 0;
  }
};