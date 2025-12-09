import { Rank } from '../types';

// Queen is the highest card, followed by King, Jack, then 10 down to Ace.
// These helpers convert ranks to an ordered value so ±1 comparisons respect the custom ordering.
export const getOrderedRankValue = (rank: Rank): number => {
  if (rank === 12) return 13; // Queen is highest
  if (rank === 13) return 12; // King is second-highest
  return rank;
};

const fromOrderedRankValue = (value: number): Rank | null => {
  if (value < 1 || value > 13) return null;
  if (value === 13) return 12;
  if (value === 12) return 13;
  return value as Rank;
};

export const isHighestRank = (rank: Rank): boolean => getOrderedRankValue(rank) === 13;
export const isLowestRank = (rank: Rank): boolean => getOrderedRankValue(rank) === 1;

// For tableau (descending): can place `moving` onto `target` when target is exactly one step higher.
export const isNextLowerInOrder = (moving: Rank, target: Rank): boolean => {
  return getOrderedRankValue(target) === getOrderedRankValue(moving) + 1;
};

// For foundation (ascending): moving must be exactly one step higher than target.
export const isNextHigherInOrder = (moving: Rank, target: Rank): boolean => {
  return getOrderedRankValue(moving) === getOrderedRankValue(target) + 1;
};

export const getNextLowerRank = (rank: Rank): Rank | null => {
  const nextVal = getOrderedRankValue(rank) - 1;
  return fromOrderedRankValue(nextVal);
};

export const getNextHigherRank = (rank: Rank): Rank | null => {
  const nextVal = getOrderedRankValue(rank) + 1;
  return fromOrderedRankValue(nextVal);
};
