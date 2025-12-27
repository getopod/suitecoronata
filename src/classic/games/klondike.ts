import { ClassicGameRules as GameRules, ClassicPileConfig as PileConfig, ClassicCardData as CardData } from '../types';
import { createDeck, isSameSuit, isConsecutiveAscending, isConsecutiveDescending, isAlternatingColor, isRunDescendingAltColor } from '../utils/cards';

const createKlondike = (drawCount: number): GameRules => {
    return {
        name: `Klondike (Draw ${drawCount})`,
        description: `Classic Solitaire, drawing ${drawCount} card${drawCount > 1 ? 's' : ''} at a time.`,
        details: {
            objective: "Build 4 foundations in suit from Ace to King.",
            controls: "Drag cards to move them. Single-click cards to auto-move them to the best available spot.",
            rules: [
                "Build tableaus down in alternating colors (Red on Black, Black on Red).",
                "Foundations build up in suit (Ace -> King).",
                "Empty tableau piles can only be filled by a King.",
                `Draw ${drawCount} card${drawCount > 1 ? 's' : ''} from stock at a time.`,
                "You can cycle through the stock pile indefinitely (unless strict mode is on)."
            ]
        },
        
        layout: (w, h) => {
            const width = w || 360;
            const numCols = 7;
            const margin = Math.max(5, Math.floor(width * 0.02));
            const gap = Math.max(2, Math.floor(width * 0.015));
            let cardW = Math.floor((width - (2 * margin) - ((numCols - 1) * gap)) / numCols);
            if (cardW > 120) cardW = 120;
            const cardH = Math.floor(cardW * 1.5);
            
            const contentWidth = (numCols * cardW) + ((numCols - 1) * gap);
            const startX = Math.floor((width - contentWidth) / 2);
            
            const configs: PileConfig[] = [];
            const topRowY = 60;
            const tableauY = topRowY + cardH + Math.max(10, h * 0.02);
            
            configs.push({ id: 'stock', type: 'stock', x: startX, y: topRowY, fan: 'none' });
            configs.push({ id: 'waste', type: 'waste', x: startX + cardW + gap, y: topRowY, fan: drawCount > 1 ? 'right' : 'none', fanSpacing: drawCount > 1 ? 15 : undefined }); 
        
            for (let i = 0; i < 4; i++) {
            configs.push({ 
                id: `foundation-${i}`, 
                type: 'foundation', 
                x: startX + ((3 + i) * (cardW + gap)), 
                y: topRowY, 
                fan: 'none' 
            });
            }
        
            for (let i = 0; i < 7; i++) {
            configs.push({ 
                id: `tableau-${i}`, 
                type: 'tableau', 
                x: startX + (i * (cardW + gap)), 
                y: tableauY, 
                fan: 'down', 
                fanSpacing: Math.max(15, cardH * 0.22)
            });
            }
        
            return { piles: configs, cardWidth: cardW, cardHeight: cardH };
        },

        deal: () => {
            const deck = createDeck();
            const piles: Record<string, CardData[]> = {
            stock: [],
            waste: [],
            'foundation-0': [], 'foundation-1': [], 'foundation-2': [], 'foundation-3': [],
            'tableau-0': [], 'tableau-1': [], 'tableau-2': [], 'tableau-3': [], 'tableau-4': [], 'tableau-5': [], 'tableau-6': [],
            };

            let cardIdx = 0;
            for (let i = 0; i < 7; i++) {
                const pileName = `tableau-${i}`;
                for (let j = 0; j <= i; j++) {
                    const card = { ...deck[cardIdx++] };
                    card.faceUp = (j === i);
                    piles[pileName].push(card);
                }
            }

            while (cardIdx < deck.length) {
                piles.stock.push({ ...deck[cardIdx++], faceUp: false });
            }

            return piles;
        },

        onStockClick: (gameState, settings) => {
            const stockPile = gameState.piles['stock'];
            const wastePile = gameState.piles['waste'];

            if (stockPile.length === 0) {
                // Recycle Logic
                if (wastePile.length === 0) return null;

                // Strict Mode Check
                if (settings?.strictSolitaire) {
                    const currentPass = gameState.customData?.passCount || 1;
                    const maxPasses = drawCount === 1 ? 1 : 3;
                    
                    if (currentPass >= maxPasses) {
                        return null; // Limit reached
                    }
                }

                const newStock = [...wastePile].reverse().map(c => ({ ...c, faceUp: false }));
                return {
                    piles: { ...gameState.piles, stock: newStock, waste: [] },
                    customData: { 
                        ...gameState.customData, 
                        passCount: (gameState.customData?.passCount || 1) + 1 
                    }
                };
            }

            // Draw
            const newStock = [...stockPile];
            const movedCards: CardData[] = [];
            
            for(let i=0; i<drawCount; i++) {
                if (newStock.length > 0) {
                    const c = newStock.pop()!;
                    c.faceUp = true;
                    movedCards.push(c);
                }
            }
            
            const newWaste = [...(wastePile || []), ...movedCards];
            return {
                piles: { ...gameState.piles, stock: newStock, waste: newWaste }
            };
        },

        canDrag: (pileId, cardIndex, cards) => {
            if (pileId === 'stock') return true; 
            const card = cards[cardIndex];
            if (!card.faceUp) return false;

            if (pileId === 'waste' || pileId.startsWith('foundation')) {
            return cardIndex === cards.length - 1;
            }

            if (pileId.startsWith('tableau')) {
            const stack = cards.slice(cardIndex);
            return isRunDescendingAltColor(stack);
            }
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
                if (!targetTop) return leadCard.rank === 13;
                return isAlternatingColor(targetTop, leadCard) && isConsecutiveDescending(targetTop, leadCard);
            }
            return false;
        },

        onPostMove: (gameState) => {
            // Implement standard Klondike scoring
            // This is called after a move is made
            // Note: The move has already been applied to gameState
            // We'll track scoring based on pile changes in the main app
            return null;
        },

        winCondition: (gameState) => {
            return ['foundation-0', 'foundation-1', 'foundation-2', 'foundation-3'].every(
            id => (gameState.piles[id]?.length || 0) === 13
            );
        }
    }
};

export const KlondikeDraw1 = createKlondike(1);
export const KlondikeDraw3 = createKlondike(3);