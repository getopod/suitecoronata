/**
 * Effect Compiler
 *
 * Transforms declarative EffectDefinitions into executable GameEffect objects.
 * This allows effects to be defined using pattern references instead of code.
 */

import { Card, Pile, GameState, GameEffect, MoveContext } from '../../types';
import { isHighestRank, isNextLowerInOrder, isNextHigherInOrder } from '../../utils/rankOrder';
import {
  EffectDefinition,
  PatternContext,
  ScoreContext,
  CoinContext,
  StateContext,
  MovementRule,
  ScoringRule,
  CoinRule,
  VisualRule,
  StateAction,
} from './types';
import {
  rankPatterns,
  suitPatterns,
  stackPatterns,
  specialRankPatterns,
  getCardColor,
} from './movement';
import { scorePatterns } from './scoring';
import { coinPatterns } from './coins';
import { visualPatterns } from './visual';
import { stateActions, executeStateActions } from './state';
import { evaluateTrigger } from './triggers';

// =============================================================================
// Compiler
// =============================================================================

/**
 * Compile an EffectDefinition into a GameEffect
 */
export function compileEffect(definition: EffectDefinition): GameEffect {
  const effect: GameEffect = {
    id: definition.id,
    name: definition.name,
    type: definition.type,
    description: definition.description,
    rarity: definition.rarity,
    cost: definition.cost,
    maxCharges: definition.maxCharges,
    chargeReset: definition.chargeReset,
  };

  // Compile canMove handler
  if (definition.movement) {
    effect.canMove = compileCanMove(definition.movement);
  }

  // Compile calculateScore handler
  if (definition.scoring?.length) {
    effect.calculateScore = compileScoring(definition.scoring);
  }

  // Compile calculateCoinTransaction handler
  if (definition.coins?.length) {
    effect.calculateCoinTransaction = compileCoinTransaction(definition.coins);
  }

  // Compile transformCardVisual handler
  if (definition.visuals?.length) {
    effect.transformCardVisual = compileVisual(definition.visuals);
  }

  // Compile onActivate handler
  if (definition.onActivate?.length || definition.effectState) {
    effect.onActivate = compileOnActivate(definition.onActivate || [], definition.effectState);
  }

  // Compile onMoveComplete handler
  if (definition.onMove?.length) {
    effect.onMoveComplete = compileOnMove(definition.onMove);
  }

  // Compile onEncounterStart handler
  if (definition.onEncounterStart?.length) {
    effect.onEncounterStart = compileOnEncounterStart(definition.onEncounterStart);
  }

  // Merge custom handlers (they take precedence)
  if (definition.custom) {
    if (definition.custom.canMove) {
      const compiledCanMove = effect.canMove;
      effect.canMove = (cards, source, target, defaultAllowed, state) => {
        // Try custom handler first
        const customResult = definition.custom!.canMove!(cards, source, target, defaultAllowed, state);
        if (customResult !== undefined) return customResult;
        // Fall back to compiled handler
        if (compiledCanMove) return compiledCanMove(cards, source, target, defaultAllowed, state);
        return defaultAllowed;
      };
    }

    if (definition.custom.interceptMove) {
      effect.interceptMove = definition.custom.interceptMove;
    }

    if (definition.custom.onMoveComplete) {
      const compiledOnMove = effect.onMoveComplete;
      effect.onMoveComplete = (state, context) => {
        let result = definition.custom!.onMoveComplete!(state, context);
        if (compiledOnMove) {
          const compiled = compiledOnMove(state, context);
          result = { ...compiled, ...result };
        }
        return result;
      };
    }

    if (definition.custom.onActivate) {
      const compiledOnActivate = effect.onActivate;
      effect.onActivate = (state, activeEffects) => {
        let result = definition.custom!.onActivate!(state, activeEffects);
        if (compiledOnActivate) {
          const compiled = compiledOnActivate(state, activeEffects);
          result = { ...compiled, ...result };
        }
        return result;
      };
    }

    if (definition.custom.onEncounterStart) {
      const compiledOnEncounter = effect.onEncounterStart;
      effect.onEncounterStart = (state) => {
        let result = definition.custom!.onEncounterStart!(state);
        if (compiledOnEncounter) {
          const compiled = compiledOnEncounter(state);
          result = { ...compiled, ...result };
        }
        return result;
      };
    }

    if (definition.custom.calculateScore) {
      const compiledScore = effect.calculateScore;
      effect.calculateScore = (score, context, state) => {
        let result = score;
        if (compiledScore) {
          result = compiledScore(result, context, state);
        }
        return definition.custom!.calculateScore!(result, context, state);
      };
    }

    if (definition.custom.calculateCoinTransaction) {
      const compiledCoin = effect.calculateCoinTransaction;
      effect.calculateCoinTransaction = (delta, context, state) => {
        let result = delta;
        if (compiledCoin) {
          result = compiledCoin(result, context, state);
        }
        return definition.custom!.calculateCoinTransaction!(result, context, state);
      };
    }

    if (definition.custom.transformCardVisual) {
      const compiledVisual = effect.transformCardVisual;
      effect.transformCardVisual = (card, pile) => {
        let result = {};
        if (compiledVisual) {
          result = compiledVisual(card, pile);
        }
        const custom = definition.custom!.transformCardVisual!(card, pile);
        return { ...result, ...custom };
      };
    }

    if (definition.custom.onEncounterComplete) {
      effect.onEncounterComplete = definition.custom.onEncounterComplete;
    }
  }

  return effect;
}

// =============================================================================
// Handler Compilers
// =============================================================================

/**
 * Compile movement rules into a canMove handler
 */
function compileCanMove(
  movement: EffectDefinition['movement']
): GameEffect['canMove'] {
  return (cards, source, target, defaultAllowed, state) => {
    const moving = cards[0];
    const targetCard = target.cards[target.cards.length - 1];

    // Build pattern context
    const ctx: PatternContext = {
      moving,
      target: targetCard,
      sourcePile: source,
      targetPile: target,
      state,
      moveContext: { source: source.id, target: target.id, cards },
      cards,
    };

    // Get the rule for this target pile type
    const rule = movement![target.type as keyof typeof movement] || movement!.any;
    if (!rule) return defaultAllowed;

    // Check appliesTo filter
    if (rule.appliesTo && !rule.appliesTo.includes(target.type)) {
      return defaultAllowed;
    }

    // Evaluate patterns
    let allowed = true;

    // Rank pattern
    if (rule.rank) {
      const rankEvaluator =
        rankPatterns[rule.rank as keyof typeof rankPatterns] ||
        specialRankPatterns[rule.rank as keyof typeof specialRankPatterns];

      if (rankEvaluator) {
        allowed = allowed && rankEvaluator(ctx, rule.params);
      }
    }

    // Suit pattern
    if (rule.suit && allowed) {
      const suitEvaluator = suitPatterns[rule.suit as keyof typeof suitPatterns];
      if (suitEvaluator) {
        allowed = allowed && suitEvaluator(ctx, rule.params);
      }
    }

    // Stack pattern
    if (rule.stack && allowed) {
      const stackEvaluator = stackPatterns[rule.stack as keyof typeof stackPatterns];
      if (stackEvaluator) {
        allowed = allowed && stackEvaluator(ctx, rule.params);
      }
    }

    return allowed;
  };
}

/**
 * Compile scoring rules into a calculateScore handler
 */
function compileScoring(rules: ScoringRule[]): GameEffect['calculateScore'] {
  return (currentScore, context, state) => {
    let score = currentScore;

    for (const rule of rules) {
      // Check trigger
      if (rule.trigger && !evaluateTrigger(rule.trigger, state, context)) {
        continue;
      }

      // Get evaluator
      const evaluator = scorePatterns[rule.pattern];
      if (!evaluator) continue;

      // Build context
      const cards = context.cards;
      const moving = cards[0];
      const targetPile = state.piles[context.target];
      const sourcePile = state.piles[context.source];
      const targetCard = targetPile?.cards[targetPile.cards.length - 1];

      const ctx: ScoreContext = {
        currentScore: score,
        moving,
        target: targetCard,
        sourcePile,
        targetPile,
        state,
        moveContext: context,
        cards,
      };

      score = evaluator(ctx, rule.params);
    }

    return score;
  };
}

/**
 * Compile coin rules into a calculateCoinTransaction handler
 */
function compileCoinTransaction(rules: CoinRule[]): GameEffect['calculateCoinTransaction'] {
  return (currentDelta, context, state) => {
    let delta = currentDelta;

    for (const rule of rules) {
      // Check trigger
      if (rule.trigger && !evaluateTrigger(rule.trigger, state, context)) {
        continue;
      }

      // Get evaluator
      const evaluator = coinPatterns[rule.pattern];
      if (!evaluator) continue;

      // Build context
      const cards = context.cards;
      const moving = cards[0];
      const targetPile = state.piles[context.target];
      const sourcePile = state.piles[context.source];
      const targetCard = targetPile?.cards[targetPile.cards.length - 1];

      const ctx: CoinContext = {
        currentDelta: delta,
        moving,
        target: targetCard,
        sourcePile,
        targetPile,
        state,
        moveContext: context,
        cards,
      };

      delta = evaluator(ctx, rule.params);
    }

    return delta;
  };
}

/**
 * Compile visual rules into a transformCardVisual handler
 */
function compileVisual(rules: VisualRule[]): GameEffect['transformCardVisual'] {
  return (card, pile) => {
    let result: Partial<Card> = {};

    for (const rule of rules) {
      // Check appliesTo filter
      if (rule.appliesTo && pile && !rule.appliesTo.includes(pile.type)) {
        continue;
      }

      // Note: triggers for visuals would need state, which we don't have here
      // Skip trigger evaluation for now

      // Get evaluator
      const evaluator = visualPatterns[rule.pattern];
      if (!evaluator) continue;

      // We don't have full state here, so pass empty state
      const changes = evaluator(card, pile, {} as GameState, rule.params);

      // Merge changes
      if (changes.meta && result.meta) {
        result = {
          ...result,
          ...changes,
          meta: { ...result.meta, ...changes.meta },
        };
      } else {
        result = { ...result, ...changes };
      }
    }

    return result;
  };
}

/**
 * Compile onActivate actions
 */
function compileOnActivate(
  actions: StateAction[],
  initialState?: Record<string, any>
): GameEffect['onActivate'] {
  return (state, activeEffects) => {
    const ctx: StateContext = { state, activeEffects };

    // Initialize effect state
    let result: Partial<GameState> = {};
    if (initialState) {
      result.effectState = { ...state.effectState, ...initialState };
    }

    // Execute actions
    if (actions.length > 0) {
      const actionResults = executeStateActions(ctx, actions);
      result = {
        ...result,
        ...actionResults,
        effectState: { ...result.effectState, ...actionResults.effectState },
      };
    }

    return result;
  };
}

/**
 * Compile onMoveComplete actions
 */
function compileOnMove(actions: StateAction[]): GameEffect['onMoveComplete'] {
  return (state, context) => {
    // Filter actions by trigger
    const triggeredActions = actions.filter(action => {
      if (!action.trigger) return true;
      return evaluateTrigger(action.trigger, state, context);
    });

    if (triggeredActions.length === 0) return {};

    const ctx: StateContext = { state, activeEffects: [] };
    return executeStateActions(ctx, triggeredActions);
  };
}

/**
 * Compile onEncounterStart actions
 */
function compileOnEncounterStart(actions: StateAction[]): GameEffect['onEncounterStart'] {
  return (state) => {
    const ctx: StateContext = { state, activeEffects: [] };
    return executeStateActions(ctx, actions);
  };
}

// =============================================================================
// Batch Compilation
// =============================================================================

/**
 * Compile multiple effect definitions
 */
export function compileEffects(definitions: EffectDefinition[]): GameEffect[] {
  return definitions.map(compileEffect);
}

/**
 * Create a registry from definitions
 */
export function createRegistryFromDefinitions(definitions: EffectDefinition[]): GameEffect[] {
  return compileEffects(definitions);
}
