/**
 * Mock data for UI development and testing.
 * Use this to develop UI components without needing the real backend.
 */

import { GameEffect, Wander } from '../types';

// ==========================================
// MOCK EFFECTS (minimal set for UI testing)
// ==========================================

export const MOCK_EFFECTS: GameEffect[] = [
  // Sample danger
  {
    id: 'mock_danger_1',
    name: 'Test Danger',
    type: 'danger',
    rarity: 'common',
    cost: 100,
    description: 'A mock danger effect for UI testing.',
  },
  // Sample fear
  {
    id: 'mock_fear_1',
    name: 'Test Fear',
    type: 'fear',
    rarity: 'rare',
    cost: 150,
    description: 'A mock fear effect for UI testing.',
  },
  // Sample blessing
  {
    id: 'mock_blessing_1',
    name: 'Test Blessing',
    type: 'blessing',
    rarity: 'uncommon',
    cost: 80,
    maxCharges: 3,
    chargeReset: 'encounter',
    description: 'A mock blessing with charges.',
  },
  // Sample exploit
  {
    id: 'mock_exploit_1',
    name: 'Test Exploit',
    type: 'exploit',
    rarity: 'epic',
    cost: 200,
    description: 'A mock exploit effect for UI testing.',
  },
  // Sample curse
  {
    id: 'mock_curse_1',
    name: 'Test Curse',
    type: 'curse',
    rarity: 'common',
    cost: 50,
    description: 'A mock curse effect for UI testing.',
  },
];

// ==========================================
// MOCK WANDERS (minimal set for UI testing)
// ==========================================

export const MOCK_WANDERS: Wander[] = [
  {
    id: 'mock_wander_1',
    label: 'The Mysterious Stranger',
    description: 'A hooded figure blocks your path. They seem to want something.',
    type: 'wander',
    choices: [
      {
        label: 'Offer coins (-10)',
        result: 'The stranger nods and steps aside.',
        effects: [{ type: 'modify_coin', params: [-10] }],
      },
      {
        label: 'Push past them',
        result: 'They curse you under their breath.',
        effects: [],
      },
    ],
  },
  {
    id: 'mock_wander_2',
    label: 'The Glowing Chest',
    description: 'A treasure chest sits alone in the clearing, glowing faintly.',
    type: 'wander',
    choices: [
      {
        label: 'Open it',
        result: 'Gold coins spill out!',
        effects: [{ type: 'modify_coin', params: [25] }],
      },
      {
        label: 'Leave it alone',
        result: 'You continue on your way.',
        effects: [],
      },
      {
        label: 'Kick it',
        result: 'It was a mimic! You barely escape.',
        effects: [{ type: 'modify_score', params: [-50] }],
      },
    ],
  },
  {
    id: 'mock_wander_3',
    label: 'The Crossroads',
    description: 'Three paths diverge before you.',
    type: 'wander',
    choices: [
      {
        label: 'Take the left path',
        result: 'A scenic route with small rewards.',
        effects: [{ type: 'modify_score', params: [10] }],
      },
      {
        label: 'Take the right path',
        result: 'A risky shortcut pays off.',
        effects: [{ type: 'modify_coin', params: [15] }],
      },
    ],
  },
];

// ==========================================
// PRESET CONFIGURATIONS
// ==========================================

/** No effects/wanders - pure solitaire */
export const STANDALONE_CONFIG = {
  effectsRegistry: [] as GameEffect[],
  wanderRegistry: [] as Wander[],
};

/** Minimal mock data for UI testing */
export const MOCK_CONFIG = {
  effectsRegistry: MOCK_EFFECTS,
  wanderRegistry: MOCK_WANDERS,
};

/** 
 * Import the real data for full game experience:
 * 
 * import { EFFECTS_REGISTRY } from './data/effects';
 * import { WANDER_REGISTRY } from './data/wanders';
 * 
 * export const FULL_CONFIG = {
 *   effectsRegistry: EFFECTS_REGISTRY,
 *   wanderRegistry: WANDER_REGISTRY,
 * };
 */
