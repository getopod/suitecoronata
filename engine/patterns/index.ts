/**
 * Pattern-based Rules Engine
 *
 * This module provides a declarative system for defining game effects.
 * Instead of writing code for each effect, effects can be defined using
 * pattern references and parameters.
 *
 * @example
 * ```typescript
 * import { compileEffect, EffectDefinition } from './engine/patterns';
 *
 * const blacksmith: EffectDefinition = {
 *   id: 'blacksmith',
 *   name: 'Blacksmith',
 *   type: 'blessing',
 *   description: 'Foundation plays allow ±1 rank.',
 *   movement: {
 *     foundation: {
 *       rank: 'rank_within_range',
 *       params: { range: 1 }
 *     }
 *   }
 * };
 *
 * const gameEffect = compileEffect(blacksmith);
 * ```
 */

// Types
export type {
  PatternContext,
  ScoreContext,
  CoinContext,
  StateContext,
  MovementEvaluator,
  ScoreEvaluator,
  CoinEvaluator,
  VisualEvaluator,
  StateEvaluator,
  TriggerEvaluator,
  RankPatternId,
  SuitPatternId,
  StackPatternId,
  SpecialRankPatternId,
  ScorePatternId,
  CoinPatternId,
  VisualPatternId,
  StateActionId,
  TriggerPatternId,
  MinigameTrigger,
  MovementRule,
  ScoringRule,
  CoinRule,
  VisualRule,
  StateAction,
  EffectDefinition,
} from './types';

// Movement patterns
export {
  rankPatterns,
  suitPatterns,
  stackPatterns,
  specialRankPatterns,
  movementPatternRegistry,
  getMovementPattern,
  evaluateMovementPatterns,
  getCardColor,
} from './movement';

// Scoring patterns
export {
  scorePatterns,
  getScorePattern,
  evaluateScorePatterns,
} from './scoring';

// Coin patterns
export {
  coinPatterns,
  getCoinPattern,
  evaluateCoinPatterns,
} from './coins';

// Visual patterns
export {
  visualPatterns,
  getVisualPattern,
  evaluateVisualPatterns,
} from './visual';

// State actions
export {
  stateActions,
  getStateAction,
  executeStateActions,
  createSpecialCard,
} from './state';

// Triggers
export {
  triggerPatterns,
  parseTriggerString,
  evaluateTrigger,
  MINIGAME_TRIGGERS,
  checkMinigamePatterns,
} from './triggers';

// Compiler
export {
  compileEffect,
  compileEffects,
  createRegistryFromDefinitions,
} from './compiler';
