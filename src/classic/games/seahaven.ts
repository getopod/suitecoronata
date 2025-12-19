import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveDescending, isConsecutiveAscending } from '../utils/cards';

export const SeahavenTowers: GameRules = {
  name: "Seahaven Towers",
  description: "Like FreeCell, but with 10 columns and 4 cells. Deal 5 cards to each column.",
  details: {
      objective: "Build 4 foundations from Ace to King in suit.",
      controls: "Drag cards. 4 Free Cells available. Tableaus build down in suit.",
      rules: [
          "10 Tableau columns.",
          "4 Free Cells (2 start with cards, 2 empty - wait, actually typical Seahaven deals 50 to tableau, 2 to cells).",
          "Tableaus build down in SAME suit.",
          "Empty tableau space can only be filled by a King.",
          "Foundations build up in suit."
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

    // 4 Cells (Left)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `cell-${i}`,
            type: 'cell',
            x: startX + (i * (cardW + gap)),
            y: topY,
            fan: 'none',
            maxCards: 1
        });
    }

    // 4 Foundations (Right - align with last 4 cols)
    for(let i=0; i<4; i++) {
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: startX + ((6+i) * (cardW + gap)),
            y: topY,
            fan: 'none'
        });
    }

    // 10 Tableaus
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
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<4; i++) piles[`cell-${i}`] = [];
    for(let i=0; i<4; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<10; i++) piles[`tableau-${i}`] = [];

    let c = 0;
    // Deal 5 cards to 10 columns
    for(let i=0; i<10; i++) {
        for(let j=0; j<5; j++) {
            piles[`tableau-${i}`].push({ ...deck[c++], faceUp: true });
        }
    }
    // Remaining 2 cards to first 2 cells
    if (c < deck.length) piles[`cell-0`].push({ ...deck[c++], faceUp: true });
    if (c < deck.length) piles[`cell-1`].push({ ...deck[c++], faceUp: true });

    return piles;
  },

  canDrag: (pileId, cardIndex, cards) => {
      if (pileId.startsWith('cell')) return true;
      if (pileId.startsWith('foundation')) return false; // Strict
      if (pileId.startsWith('tableau')) return cardIndex === cards.length - 1; // Only top card
      return false;
  },

  canDrop: (move, targetPileCards, gameState) => {
      const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
      const leadCard = movingCards[0];
      const targetTop = targetPileCards[targetPileCards.length - 1];

      // Standard FreeCell-like supermove logic could apply, but Seahaven is strictly "move 1 card" usually.
      // However, most modern apps allow supermoves if cells valid.
      // Let's restrict to 1 card for strict Seahaven feel, or reuse FreeCell logic?
      // Strict Seahaven: 1 card only.
      if (movingCards.length > 1) return false;

      if (move.targetPileId.startsWith('cell')) {
          return targetPileCards.length === 0;
      }

      if (move.targetPileId.startsWith('foundation')) {
          if (!targetTop) return leadCard.rank === 1;
          return isSameSuit(targetTop, leadCard) && isConsecutiveAscending(targetTop, leadCard);
      }

      if (move.targetPileId.startsWith('tableau')) {
          if (!targetTop) return leadCard.rank === 13; // Kings only in empty
          // Build down in SAME suit
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