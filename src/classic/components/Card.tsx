import React from 'react';
import { CardData, Suit, GameSettings } from '../types';

interface CardProps {
  card: CardData;
  width: number;
  height: number;
  settings: GameSettings;
  style?: React.CSSProperties;
  className?: string;
  selectionType?: 'green' | 'red' | 'yellow' | 'none';
}

const suitSymbols: Record<Suit, string> = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠',
};

const rankString = (rank: number): string => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return rank.toString();
};

export const Card: React.FC<CardProps> = ({ card, width, height, settings, style, className = '', selectionType = 'none' }) => {
  const isLarge = settings.cardFace === 'large';
  const isMinimal = settings.cardFace === 'minimal';

  // Responsive font sizes
  const cornerSize = Math.max(10, width * (isLarge ? 0.35 : 0.25));
  const centerSize = Math.max(16, width * (isLarge ? 0.7 : 0.5));

  const commonStyle = {
      width: `${width}px`,
      height: `${height}px`,
      borderRadius: `${Math.max(4, width * 0.1)}px`,
      ...style,
  };

  // Selection ring
  const selectionRing = selectionType !== 'none'
    ? `ring-2 ${selectionType === 'green' ? 'ring-green-400' : selectionType === 'yellow' ? 'ring-amber-300' : 'ring-red-400'}`
    : '';

  if (!card.faceUp) {
    let backgroundStyle: React.CSSProperties = {};
    let borderClass = 'border-2 border-white';

    switch (settings.cardBack) {
      case 'classic-red':
        backgroundStyle = {
            backgroundColor: '#b91c1c',
            backgroundImage: 'repeating-linear-gradient(45deg, #b91c1c 0px, #b91c1c 10px, #991b1b 10px, #991b1b 20px)'
        };
        break;
      case 'modern-dark':
        backgroundStyle = {
            backgroundColor: '#1f2937',
            backgroundImage: 'radial-gradient(#374151 15%, transparent 16%), radial-gradient(#374151 15%, transparent 16%)',
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0, 5px 5px'
        };
        borderClass = 'border-2 border-gray-400';
        break;
      case 'geometric':
        backgroundStyle = {
            backgroundColor: '#0f766e',
            backgroundImage: 'linear-gradient(135deg, #115e59 25%, transparent 25%), linear-gradient(225deg, #115e59 25%, transparent 25%), linear-gradient(45deg, #115e59 25%, transparent 25%), linear-gradient(315deg, #115e59 25%, transparent 25%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '10px 0, 10px 0, 0 0, 0 0'
        };
        break;
      case 'classic-blue':
      default:
        backgroundStyle = {
            backgroundColor: '#1d4ed8',
            backgroundImage: 'repeating-linear-gradient(45deg, #1e3a8a 0px, #1e3a8a 10px, #172554 10px, #172554 20px)'
        };
        break;
    }

    return (
      <div
        className={`${borderClass} shadow-md ${selectionRing} ${className}`}
        style={{ ...commonStyle, ...backgroundStyle }}
      >
        {(settings.cardBack === 'classic-blue' || settings.cardBack === 'classic-red') && (
            <div className="w-full h-full rounded border border-white/30 opacity-30"></div>
        )}
      </div>
    );
  }

  const isRed = card.suit === 'H' || card.suit === 'D';
  const colorClass = isRed ? 'text-red-600' : 'text-black';

  return (
    <div
      className={`bg-white shadow-md border border-gray-300 flex flex-col justify-between p-[2px] sm:p-1 select-none overflow-hidden ${selectionRing} ${className}`}
      style={commonStyle}
    >
      {/* Top Left Corner */}
      <div className={`text-left font-bold leading-none ${colorClass}`} style={{ fontSize: `${cornerSize}px` }}>
        <div>{rankString(card.rank)}</div>
        <div style={{ fontSize: isLarge ? '1em' : '0.8em' }}>{suitSymbols[card.suit]}</div>
      </div>

      {/* Center Symbol (Standard/Large Only) */}
      {!isMinimal && (
          <div className={`text-center ${colorClass} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`} style={{ fontSize: `${centerSize}px` }}>
            {suitSymbols[card.suit]}
          </div>
      )}

      {/* Minimal Mode: Large Center Rank */}
      {isMinimal && (
          <div className={`text-center font-bold ${colorClass} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`} style={{ fontSize: `${centerSize}px` }}>
             {rankString(card.rank)}
          </div>
      )}

      {/* Bottom Right Corner (Rotated) */}
      <div className={`text-right font-bold leading-none ${colorClass} rotate-180`} style={{ fontSize: `${cornerSize}px` }}>
        <div>{rankString(card.rank)}</div>
        <div style={{ fontSize: isLarge ? '1em' : '0.8em' }}>{suitSymbols[card.suit]}</div>
      </div>
    </div>
  );
};
