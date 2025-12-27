import React from 'react';
import { PileConfig, CardData, GameSettings } from '../types';
import { Card } from './Card';

interface PileProps {
  config: PileConfig;
  cards: CardData[];
  cardWidth: number;
  cardHeight: number;
  settings: GameSettings;
  onCardClick: (cardIndex: number) => void;
  selectedCardId?: string;
  selectionType?: 'green' | 'red' | 'yellow' | 'none';
  isHighlighted?: boolean;
}

export const Pile: React.FC<PileProps> = ({
  config,
  cards,
  cardWidth,
  cardHeight,
  settings,
  onCardClick,
  selectedCardId,
  selectionType = 'none',
  isHighlighted = false
}) => {
  const highlightRing = isHighlighted
    ? `ring-2 ${selectionType === 'green' ? 'ring-green-400' : selectionType === 'yellow' ? 'ring-amber-300' : 'ring-red-400'}`
    : '';

  return (
    <div
      className="absolute"
      style={{ position: 'absolute', left: config.x, top: config.y }}
    >
      {/* Empty Pile Placeholder */}
      <div
        className={`rounded-lg border-2 border-white/30 bg-black/30 absolute top-0 left-0 backdrop-blur-sm ${config.type === 'stock' ? 'cursor-pointer hover:border-white/50 hover:bg-black/40 transition-all' : ''} ${highlightRing}`}
        style={{
            width: cardWidth,
            height: cardHeight,
            borderRadius: Math.max(4, cardWidth * 0.1),
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)'
        }}
        onClick={() => {
            if (cards.length === 0) onCardClick(-1);
        }}
      >
        {/* Visual hint for empty stock recycling */}
        {config.type === 'stock' && cards.length === 0 && (
            <div className="w-full h-full flex items-center justify-center opacity-30">
                <div className="w-1/2 h-1/2 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-xl font-bold text-white">⟳</span>
                </div>
            </div>
        )}
        {/* Foundation suit symbol */}
        {config.type === 'foundation' && cards.length === 0 && (
            <div className="w-full h-full flex items-center justify-center text-2xl">
                {(() => {
                    // Extract suit from pile ID (e.g., "foundation-H", "foundation-hearts")
                    const suitMatch = config.id.match(/foundation-?([HDCS]|hearts|diamonds|clubs|spades)/i);
                    if (!suitMatch) {
                        // For numbered foundations (Klondike, etc.), show generic Ace symbol
                        return <span className="text-white/20 text-lg font-bold">A</span>;
                    }

                    const suitChar = suitMatch[1].toUpperCase()[0];
                    const suitSymbol = suitChar === 'H' ? '♥' : suitChar === 'D' ? '♦' : suitChar === 'C' ? '♣' : '♠';
                    const suitColor = (suitChar === 'H' || suitChar === 'D') ? 'text-red-600/30' : 'text-white/20';

                    return <span className={suitColor}>{suitSymbol}</span>;
                })()}
            </div>
        )}
        {/* Cell label */}
        {config.type === 'cell' && cards.length === 0 && (
            <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                Cell
            </div>
        )}
      </div>

      {/* Cards */}
      {cards.map((card, index) => {
        const isSelected = card.id === selectedCardId;
        let topOffset = 0;
        let leftOffset = 0;
        let shouldHide = false;

        if (config.fan === 'down') {
          const prevCards = cards.slice(0, index);
          topOffset = prevCards.reduce((acc, c) => acc + (c.faceUp ? (config.fanSpacing || 25) : (cardWidth * 0.15)), 0);
        } else if (config.fan === 'right') {
          // For waste pile in draw-3, only show top 3 cards with offset
          if (config.type === 'waste' && cards.length > 3) {
            // Hide cards that aren't in the top 3
            if (index < cards.length - 3) {
              shouldHide = true;
            } else {
              // Offset only the visible top 3 cards
              const visibleIndex = index - (cards.length - 3);
              leftOffset = visibleIndex * (config.fanSpacing || 20);
            }
          } else {
            leftOffset = index * (config.fanSpacing || 20);
          }
        }

        if (shouldHide) return null;

        return (
            <div
                key={card.id}
                className="absolute cursor-pointer"
                style={{ top: topOffset, left: leftOffset, zIndex: index }}
                onClick={(e) => {
                    e.stopPropagation();
                    onCardClick(index);
                }}
            >
                <Card
                  card={card}
                  width={cardWidth}
                  height={cardHeight}
                  settings={settings}
                  selectionType={isSelected ? selectionType : 'none'}
                />
            </div>
        );
      })}
    </div>
  );
};
