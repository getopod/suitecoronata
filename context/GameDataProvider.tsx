import React, { createContext, useContext, ReactNode } from 'react';
import { GameEffect, Wander } from '../types';

// ==========================================
// GAME DATA CONTEXT
// This allows the UI to work independently of concrete effect/wander implementations
// ==========================================

export interface GameDataContextType {
  effectsRegistry: GameEffect[];
  wanderRegistry: Wander[];
  getEffectById: (id: string) => GameEffect | undefined;
  getEffectsByType: (type: string) => GameEffect[];
  getWanderById: (id: string) => Wander | undefined;
}

const defaultContext: GameDataContextType = {
  effectsRegistry: [],
  wanderRegistry: [],
  getEffectById: () => undefined,
  getEffectsByType: () => [],
  getWanderById: () => undefined,
};

const GameDataContext = createContext<GameDataContextType>(defaultContext);

export const useGameData = () => useContext(GameDataContext);

interface GameDataProviderProps {
  children: ReactNode;
  effectsRegistry?: GameEffect[];
  wanderRegistry?: Wander[];
}

export const GameDataProvider: React.FC<GameDataProviderProps> = ({
  children,
  effectsRegistry = [],
  wanderRegistry = [],
}) => {
  const getEffectById = (id: string) => effectsRegistry.find(e => e.id === id);
  const getEffectsByType = (type: string) => effectsRegistry.filter(e => e.type === type);
  const getWanderById = (id: string) => wanderRegistry.find(w => w.id === id);

  return (
    <GameDataContext.Provider
      value={{
        effectsRegistry,
        wanderRegistry,
        getEffectById,
        getEffectsByType,
        getWanderById,
      }}
    >
      {children}
    </GameDataContext.Provider>
  );
};

// Empty/Stub provider for standalone UI testing
export const StandaloneGameDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <GameDataProvider effectsRegistry={[]} wanderRegistry={[]}>
    {children}
  </GameDataProvider>
);
