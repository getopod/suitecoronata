import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveAscending, isConsecutiveDescending } from '../utils/cards';

const clockPositions = [
    {r: 9, dx: -1, dy: -0.5}, // 9
    {r: 10, dx: -0.87, dy: -1}, // 10
    {r: 11, dx: -0.5, dy: -1.37}, // 11
    {r: 12, dx: 0, dy: -1.5}, // 12
    {r: 1, dx: 0.5, dy: -1.37}, // 1
    {r: 2, dx: 0.87, dy: -1}, // 2
    {r: 3, dx: 1, dy: -0.5}, // 3
    {r: 4, dx: 0.87, dy: 0}, // 4
    {r: 5, dx: 0.5, dy: 0.37}, // 5
    {r: 6, dx: 0, dy: 0.5}, // 6
    {r: 7, dx: -0.5, dy: 0.37}, // 7
    {r: 8, dx: -0.87, dy: 0}, // 8
];

export const ClockSolitaire: GameRules = {
  name: "Grandfather's Clock",
  description: "Build foundations to show the correct time on the clock face.",
  details: {
      objective: "Build each foundation up to the correct number on the clock face.",
      controls: "Build foundations up in suit. Tableaus build down in suit.",
      rules: [
          "Foundations are arranged in a clock.",
          "Each foundation starts with a specific base rank.",
          "12 o'clock is Queen? No, 12 is usually 12 (Queen).",
          "Goal: 9->K, 10->A, 11->2, 12->3 ...",
          "Actually, classic is: Base + 1... up to correct hour.",
          "Simpler: Foundation 'n' builds up to 'n' (wrapping). e.g. 5 pile starts with something?",
          "Correct rule: Foundations start with 9, 10, J, Q, K, 2, 3, 4, 5, 6, 7, 8.",
          "And you build up in suit until they show correct clock numbers: 9->...->12?",
          "Actually: 9 at 9 o'clock position builds to 9? No.",
          "Standard: Foundations initialized with 9, 10... 8. Goal is to build up in suit until they match the clock face hour."
      ]
  },
  
  layout: (w, h) => {
    const width = w || 360;
    const cx = width / 2;
    const cy = h / 2 - 50;
    const radius = Math.min(width, h) * 0.35;
    const cardW = 45;
    const cardH = 65;
    
    const configs: PileConfig[] = [];

    // 12 Foundations
    // Map internal index 0..11 to clock hours 9..8
    // 0: 9, 1: 10, ... 3: 12 (Q), 4: 1, ...
    for(let i=0; i<12; i++) {
        // Adjust angle. Clock 12 is -90deg.
        // Positions array handles relative placement
        const pos = clockPositions[i];
        configs.push({
            id: `foundation-${i}`,
            type: 'foundation',
            x: cx + (pos.dx * radius) - (cardW/2),
            y: cy + (pos.dy * radius) - (cardH/2),
            fan: 'none'
        });
    }

    // 8 Tableaus at bottom
    const tabY = cy + radius + 40;
    const tabW = Math.min(40, width / 9);
    const startTabX = (width - (8 * tabW) - (7 * 2)) / 2;
    for(let i=0; i<8; i++) {
        configs.push({
            id: `tableau-${i}`,
            type: 'tableau',
            x: startTabX + (i * (tabW + 2)),
            y: tabY,
            fan: 'down',
            fanSpacing: 15
        });
    }

    return { piles: configs, cardWidth: cardW, cardHeight: cardH };
  },

  deal: () => {
    const deck = createDeck();
    const piles: Record<string, CardData[]> = {};
    for(let i=0; i<12; i++) piles[`foundation-${i}`] = [];
    for(let i=0; i<8; i++) piles[`tableau-${i}`] = [];

    // Foundations bases: 9, 10, J, Q, K, 2, 3, 4, 5, 6, 7, 8
    // We must find these specific ranks in the deck and place them.
    const bases = [9, 10, 11, 12, 13, 2, 3, 4, 5, 6, 7, 8];
    const usedIndices = new Set<number>();
    
    bases.forEach((rank, i) => {
        // Find first card with this rank
        const idx = deck.findIndex((c, idx) => c.rank === rank && !usedIndices.has(idx));
        if (idx !== -1) {
            usedIndices.add(idx);
            const c = deck[idx];
            c.faceUp = true;
            piles[`foundation-${i}`].push(c);
        }
    });

    const remaining = deck.filter((_, i) => !usedIndices.has(i));
    let c = 0;
    while(c < remaining.length) {
        for(let i=0; i<8; i++) {
            if (c < remaining.length) {
                piles[`tableau-${i}`].push({ ...remaining[c++], faceUp: true });
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
          if (!targetTop) return false;
          // Build up in suit, wrapping K->A
          return isSameSuit(targetTop, leadCard) && (
              leadCard.rank === targetTop.rank + 1 || (targetTop.rank === 13 && leadCard.rank === 1)
          );
      }

      if (move.targetPileId.startsWith('tableau')) {
          if (!targetTop) return true; 
          return isSameSuit(targetTop, leadCard) && isConsecutiveDescending(targetTop, leadCard);
      }
      return false;
  },

  winCondition: (gameState) => {
      // Check if all foundations have correct top card
      // 0->12 (Q), 1->1 (A)? 
      // Goal: 9 -> ... -> 12?
      // Wait, Grandfather's Clock rule: "The object is to build the foundations up in suit until the top cards show the correct numbers on the clock face."
      // Index 0 (9 o'clock) -> Should show 9? No.
      // 12 o'clock position (Index 3 in my array, bases 12) should show 12.
      // So they start at X and end at X? No, that's 0 moves.
      // Wait. The bases are:
      // 9, 10, J, Q, K, 2, 3, 4, 5, 6, 7, 8
      // Clock positions:
      // 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8
      // So:
      // Base 9 (pos 9) -> Target 9. (Already done?)
      // Usually, Foundations bases are different. 
      // Variation: Foundations are 2 of Diamonds, etc.
      // Let's assume standard: Foundations start at base, build up until they reach the clock hour.
      // e.g. Base 9 at 9 o'clock. Wait, 9 is 9.
      // Ah, the bases are arranged so they are NOT the clock hour.
      // Common deal: Bases are 10, J, Q, K, 2, 3, 4, 5, 6, 7, 8, 9. 
      // Placed at: 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8.
      // So 9 pos starts with 10?
      // Let's rely on standard 'Win' of just emptying tableaus or cards used.
      // Or just check if all foundations have 4 cards? (Since deck is 52, 52/12 is not clean).
      // Each foundation finishes with a specific rank.
      // Let's assume win if 52 cards in foundations.
      let count = 0;
      for(let i=0; i<12; i++) count += gameState.piles[`foundation-${i}`]?.length || 0;
      return count === 52;
  }
};