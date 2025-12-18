/**
 * Pattern-based Rules Engine
 *
 * This is the main entry point for the rules engine system.
 * It provides a declarative way to define game effects using patterns.
 *
 * ## Architecture
 *
 * The engine is organized into several layers:
 *
 * 1. **Patterns** - Reusable building blocks for game mechanics
 *    - Movement patterns (rank, suit, stack)
 *    - Scoring patterns
 *    - Coin transaction patterns
 *    - Visual transformation patterns
 *    - State action patterns
 *    - Trigger patterns
 *
 * 2. **Definitions** - Declarative effect configurations
 *    - Blessings (positive effects)
 *    - Exploits (powerful effects)
 *    - Curses (challenge effects)
 *
 * 3. **Compiler** - Transforms definitions into executable effects
 *
 * ## Usage
 *
 * ```typescript
 * import { compileEffect, EffectDefinition } from './engine';
 *
 * // Define an effect using patterns
 * const myEffect: EffectDefinition = {
 *   id: 'my_effect',
 *   name: 'My Effect',
 *   type: 'blessing',
 *   description: 'Does something cool',
 *   movement: {
 *     tableau: {
 *       rank: 'rank_within_range',
 *       params: { range: 2 }
 *     }
 *   },
 *   scoring: [
 *     { pattern: 'percentage_multiplier', params: { multiplier: 1.5 } }
 *   ]
 * };
 *
 * // Compile to a GameEffect
 * const gameEffect = compileEffect(myEffect);
 *
 * // Use with the game engine
 * activeEffects.push(gameEffect);
 * ```
 *
 * ## Pattern Reference
 *
 * See the individual pattern files for available patterns:
 * - `patterns/movement.ts` - Movement patterns (rank, suit, stack)
 * - `patterns/scoring.ts` - Scoring patterns
 * - `patterns/coins.ts` - Coin transaction patterns
 * - `patterns/visual.ts` - Visual transformation patterns
 * - `patterns/state.ts` - State action patterns
 * - `patterns/triggers.ts` - Trigger condition patterns
 */

// Re-export everything from patterns
export * from './patterns';

// Re-export definitions
export {
  EFFECT_DEFINITIONS,
  ALL_DEFINITIONS,
  compileAllEffects,
  getCompiledEffect,
  getCompiledEffectsByType,
  BLESSING_DEFINITIONS,
  EXPLOIT_DEFINITIONS,
  CURSE_DEFINITIONS,
} from './definitions';
