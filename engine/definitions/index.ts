/**
 * Effect Definitions Index
 *
 * This module exports all effect definitions and provides utilities
 * for working with them.
 */

import { GameEffect } from '../../types';
import { EffectDefinition } from '../patterns/types';
import { compileEffect, compileEffects } from '../patterns/compiler';
import { BLESSING_DEFINITIONS } from './blessings';
import { EXPLOIT_DEFINITIONS } from './exploits';
import { CURSE_DEFINITIONS } from './curses';
import { PATTERN_DEFINITIONS } from './patterns';

// =============================================================================
// All Definitions
// =============================================================================

/**
 * All effect definitions organized by type
 */
export const EFFECT_DEFINITIONS = {
  blessings: BLESSING_DEFINITIONS,
  exploits: EXPLOIT_DEFINITIONS,
  curses: CURSE_DEFINITIONS,
  patterns: PATTERN_DEFINITIONS,
};

/**
 * Flat array of all definitions
 */
export const ALL_DEFINITIONS: EffectDefinition[] = [
  ...BLESSING_DEFINITIONS,
  ...EXPLOIT_DEFINITIONS,
  ...CURSE_DEFINITIONS,
  ...PATTERN_DEFINITIONS,
];

// =============================================================================
// Compiled Effects
// =============================================================================

/**
 * Compile all definitions into GameEffect objects
 */
export function compileAllEffects(): GameEffect[] {
  return compileEffects(ALL_DEFINITIONS);
}

/**
 * Get a compiled effect by ID
 */
export function getCompiledEffect(id: string): GameEffect | undefined {
  const definition = ALL_DEFINITIONS.find(d => d.id === id);
  if (!definition) return undefined;
  return compileEffect(definition);
}

/**
 * Get compiled effects by type
 */
export function getCompiledEffectsByType(type: 'blessing' | 'exploit' | 'curse'): GameEffect[] {
  const definitions = ALL_DEFINITIONS.filter(d => d.type === type);
  return compileEffects(definitions);
}

// =============================================================================
// Re-exports
// =============================================================================

export { BLESSING_DEFINITIONS } from './blessings';
export { EXPLOIT_DEFINITIONS } from './exploits';
export { CURSE_DEFINITIONS } from './curses';
export { PATTERN_DEFINITIONS } from './patterns';
