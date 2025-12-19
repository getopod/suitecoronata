import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData, ClassicGameState as GameState } from '../types';
import { createSuitedDeck, isConsecutiveDescending, isRunDescendingSameSuit } from '../utils/cards';

const createSpider = (suitsCount: 1 | 2 | 4): GameRules => {
    return {
        name: `Spider (${suitsCount} Suit${suitsCount > 1 ? 's' : ''})`,
        description: `Arrange cards in descending order (K to A) of the same suit to remove them.${suitsCount > 1 ? ' Harder.' : ''}`,
        details: {
            objective: "Assemble 8 full sets of cards in descending order (King to Ace) of the same suit.",
            controls: "Drag cards to build runs. Click the stock pile to deal a new row of cards.",
            rules: [
                "You can build down regardless of suit.",
                "However, you can only move a group of cards if they are all in proper descending sequence AND same suit.",
                "A full run (King down to Ace) of the same suit is automatically removed from the board.",
                "You cannot deal from the stock if any tableau column is empty (unless 'Strict Deal' is disabled in settings).",
                "Empty columns can be filled by any card."
            ]
        },
        
        layout: (w, h) => {
            const width = w || 360;
            const numCols = 10;
            const margin = Math.max(2, Math.floor(width * 0.01));
            const gap = Math.max(1, Math.floor(width * 0.01));
            
            let cardW = Math.floor((width - (2 * margin) - ((numCols - 1) * gap)) / numCols);
            if (cardW > 100) cardW = 100;

            const cardH = Math.floor(cardW * 1.5);
            
            const contentWidth = (numCols * cardW) + ((numCols - 1) * gap);
            const startX = Math.floor((width - contentWidth) / 2);

            const configs: PileConfig[] = [];
            const topRowY = 60;
            const tableauY = topRowY + cardH + 15;
            
            // Stock (Left)
            configs.push({ id: 'stock', type: 'stock', x: startX, y: topRowY, fan: 'none' });
            
            // Completed (Right most slot) - Just a visual placeholder for piled wins
            configs.push({ 
                id: 'completed', 
                type: 'foundation', 
                x: startX + (9 * (cardW + gap)), 
                y: topRowY, 
                fan: 'none' 
            });

            for (let i = 0; i < 10; i++) {
                configs.push({ 
                    id: `tableau-${i}`, 
                    type: 'tableau', 
                    x: startX + (i * (cardW + gap)), 
                    y: tableauY, 
                    fan: 'down', 
                    fanSpacing: Math.max(12, cardH * 0.22) 
                });
            }

            return { piles: configs, cardWidth: cardW, cardHeight: cardH };
        },

        deal: () => {
            let suitsToUse;
            if (suitsCount === 1) suitsToUse = ['S'];
            else if (suitsCount === 2) suitsToUse = ['S', 'H'];
            else suitsToUse = ['S', 'H', 'D', 'C'];
            
            // Spider uses 104 cards
            const deck = createSuitedDeck(suitsToUse as any, 104);

            const piles: Record<string, CardData[]> = {
                stock: [],
                completed: [],
            };
            for(let i=0; i<10; i++) piles[`tableau-${i}`] = [];

            let c = 0;
            // First 4 cols get 6 cards, next 6 get 5 cards = 54 cards
            for (let i = 0; i < 10; i++) {
                const count = i < 4 ? 6 : 5;
                for (let j = 0; j < count; j++) {
                    const card = { ...deck[c++] };
                    card.faceUp = (j === count - 1);
                    piles[`tableau-${i}`].push(card);
                }
            }

            while(c < deck.length) {
                piles.stock.push({ ...deck[c++], faceUp: false });
            }

            return piles;
        },

        onStockClick: (gameState, settings) => {
            const stock = gameState.piles.stock;
            if (stock.length === 0) return null;
            
            // Strict dealing rule: Cannot deal if any tableau is empty
            if (settings?.spiderStrictDeal) {
                const anyEmpty = Object.keys(gameState.piles)
                    .filter(k => k.startsWith('tableau'))
                    .some(k => gameState.piles[k].length === 0);
                
                if (anyEmpty) return null; // Prevent deal
            }

            if (stock.length < 10) return null; // Should be multiples of 10 usually

            const newStock = [...stock];
            const newPiles = { ...gameState.piles };
            
            for(let i=0; i<10; i++) {
                const card = newStock.pop();
                if (card) {
                    card.faceUp = true;
                    // Check if tableau exists before pushing (safety)
                    if (newPiles[`tableau-${i}`]) {
                        newPiles[`tableau-${i}`] = [...newPiles[`tableau-${i}`], card];
                    }
                }
            }
            
            return { piles: { ...newPiles, stock: newStock } };
        },

        onPostMove: (gameState) => {
            // Check for completed runs (K -> A of same suit) in tableaus
            const newPiles = { ...gameState.piles };
            let changed = false;

            for (let i = 0; i < 10; i++) {
                const pid = `tableau-${i}`;
                const pile = newPiles[pid];
                
                // Safety check: if pile doesn't exist (e.g. state mismatch during game switch), skip
                if (!pile) continue;

                if (pile.length < 13) continue;

                // Check last 13 cards
                const potentialRun = pile.slice(-13);
                if (potentialRun[0].rank === 13 && isRunDescendingSameSuit(potentialRun)) {
                     // Found a run! Remove it.
                     newPiles[pid] = pile.slice(0, pile.length - 13);
                     
                     // Flip new top card if needed
                     if (newPiles[pid].length > 0) {
                         const top = newPiles[pid][newPiles[pid].length - 1];
                         if (!top.faceUp) {
                             newPiles[pid][newPiles[pid].length - 1] = { ...top, faceUp: true };
                         }
                     }
                     
                     // Add to completed
                     const completedPile = newPiles['completed'] || [];
                     newPiles['completed'] = [...completedPile, ...potentialRun];
                     changed = true;
                }
            }

            return changed ? { piles: newPiles } : null;
        },

        canDrag: (pileId, cardIndex, cards) => {
            if (pileId === 'stock') return true;
            const card = cards[cardIndex];
            if (!card.faceUp) return false;
            
            if (pileId.startsWith('tableau')) {
                const stack = cards.slice(cardIndex);
                // Spider rule: can only drag if same suit sequence
                return isRunDescendingSameSuit(stack); 
            }
            return false;
        },

        canDrop: (move, targetPileCards, gameState) => {
            const movingCards = gameState.piles[move.sourcePileId].slice(-move.cardIds.length);
            const leadCard = movingCards[0];
            const targetTop = targetPileCards[targetPileCards.length - 1];

            if (move.targetPileId.startsWith('tableau')) {
                if (!targetTop) return true; // Can drop on empty
                // Can drop if rank is +1 (suit doesn't matter for drop, only for run build)
                return isConsecutiveDescending(targetTop, leadCard);
            }
            return false;
        },

        winCondition: (gameState) => {
            return (gameState.piles.completed?.length || 0) === 104;
        }
    }
};

export const Spider1Suit = createSpider(1);
export const Spider2Suit = createSpider(2);
export const Spider4Suit = createSpider(4);