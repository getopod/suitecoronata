import { GameEffect, GameState, MoveContext, Card, Pile } from '../types';

// ==================== EFFECT EXECUTION LOGGER ====================

export interface EffectLog {
  timestamp: number;
  effectId: string;
  effectName: string;
  hookName: string;
  inputs: any;
  output: any;
  duration: number;
  error?: string;
}

export interface StateDiff {
  field: string;
  before: any;
  after: any;
}

class EffectDebugger {
  private logs: EffectLog[] = [];
  private enabled: boolean = false;
  private maxLogs: number = 1000;

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  clear() {
    this.logs = [];
  }

  getLogs() {
    return [...this.logs];
  }

  getLogsByEffect(effectId: string) {
    return this.logs.filter(log => log.effectId === effectId);
  }

  getRecentLogs(count: number = 10) {
    return this.logs.slice(-count);
  }

  // Wrap an effect hook with logging
  wrapHook<T extends (...args: any[]) => any>(
    effect: GameEffect,
    hookName: string,
    hookFn: T
  ): T {
    if (!this.enabled) return hookFn;

    return ((...args: any[]) => {
      const startTime = performance.now();
      let output: any;
      let error: string | undefined;

      try {
        output = hookFn(...args);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        const duration = performance.now() - startTime;

        this.logs.push({
          timestamp: Date.now(),
          effectId: effect.id,
          effectName: effect.name,
          hookName,
          inputs: this.sanitizeInputs(args),
          output: this.sanitizeOutput(output),
          duration,
          error
        });

        // Trim logs if needed
        if (this.logs.length > this.maxLogs) {
          this.logs = this.logs.slice(-this.maxLogs);
        }
      }

      return output;
    }) as T;
  }

  private sanitizeInputs(args: any[]): any {
    // Reduce verbosity - just keep key info
    return args.map(arg => {
      if (Array.isArray(arg)) {
        if (arg.length > 0 && 'id' in arg[0]) {
          return `[${arg.length} cards]`;
        }
        return arg;
      }
      if (arg && typeof arg === 'object') {
        if ('piles' in arg) {
          return '[GameState]';
        }
        if ('id' in arg && 'type' in arg && 'cards' in arg) {
          return `Pile(${arg.id}, ${arg.cards.length} cards)`;
        }
        if ('source' in arg && 'target' in arg) {
          return `Move(${arg.source} → ${arg.target})`;
        }
      }
      return arg;
    });
  }

  private sanitizeOutput(output: any): any {
    if (!output) return output;
    if (typeof output !== 'object') return output;

    // For partial state updates, just show what changed
    if ('piles' in output) {
      return { ...output, piles: '[piles updated]' };
    }

    return output;
  }

  // Get performance stats
  getPerformanceStats() {
    const stats: Record<string, { count: number; totalDuration: number; avgDuration: number }> = {};

    this.logs.forEach(log => {
      if (!stats[log.effectId]) {
        stats[log.effectId] = { count: 0, totalDuration: 0, avgDuration: 0 };
      }
      stats[log.effectId].count++;
      stats[log.effectId].totalDuration += log.duration;
    });

    Object.values(stats).forEach(stat => {
      stat.avgDuration = stat.totalDuration / stat.count;
    });

    return stats;
  }

  // Get error summary
  getErrors() {
    return this.logs.filter(log => log.error);
  }
}

// Singleton instance
export const effectDebugger = new EffectDebugger();

// ==================== STATE DIFF UTILITIES ====================

export function diffGameState(before: GameState, after: GameState): StateDiff[] {
  const diffs: StateDiff[] = [];

  // Check simple fields
  const simpleFields: (keyof GameState)[] = [
    'score', 'coins', 'moves', 'scoreMultiplier', 'coinMultiplier',
    'isLevelComplete', 'isGameOver', 'currentScoreGoal'
  ];

  simpleFields.forEach(field => {
    if (before[field] !== after[field]) {
      diffs.push({ field, before: before[field], after: after[field] });
    }
  });

  // Check pile changes
  const pileDiffs = diffPiles(before.piles, after.piles);
  diffs.push(...pileDiffs);

  // Check effectState changes
  const effectStateDiffs = diffObjects('effectState', before.effectState, after.effectState);
  diffs.push(...effectStateDiffs);

  return diffs;
}

function diffPiles(before: Record<string, Pile>, after: Record<string, Pile>): StateDiff[] {
  const diffs: StateDiff[] = [];

  const allPileIds = new Set([...Object.keys(before), ...Object.keys(after)]);

  allPileIds.forEach(pileId => {
    const beforePile = before[pileId];
    const afterPile = after[pileId];

    if (!beforePile && afterPile) {
      diffs.push({ field: `piles.${pileId}`, before: undefined, after: 'created' });
    } else if (beforePile && !afterPile) {
      diffs.push({ field: `piles.${pileId}`, before: 'existed', after: 'deleted' });
    } else if (beforePile && afterPile) {
      if (beforePile.cards.length !== afterPile.cards.length) {
        diffs.push({
          field: `piles.${pileId}.cards.length`,
          before: beforePile.cards.length,
          after: afterPile.cards.length
        });
      }
      if (beforePile.locked !== afterPile.locked) {
        diffs.push({
          field: `piles.${pileId}.locked`,
          before: beforePile.locked,
          after: afterPile.locked
        });
      }
      if (beforePile.hidden !== afterPile.hidden) {
        diffs.push({
          field: `piles.${pileId}.hidden`,
          before: beforePile.hidden,
          after: afterPile.hidden
        });
      }
    }
  });

  return diffs;
}

function diffObjects(prefix: string, before: any, after: any): StateDiff[] {
  const diffs: StateDiff[] = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  allKeys.forEach(key => {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diffs.push({
        field: `${prefix}.${key}`,
        before: beforeVal,
        after: afterVal
      });
    }
  });

  return diffs;
}

// ==================== EFFECT VALIDATION ====================

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  effectId: string;
  message: string;
}

export function validateEffects(effects: GameEffect[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for duplicate IDs
  const ids = effects.map(e => e.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  duplicates.forEach(id => {
    issues.push({
      severity: 'error',
      effectId: id,
      message: `Duplicate effect ID: ${id}`
    });
  });

  effects.forEach(effect => {
    // Check for effects that modify the same state properties
    if (effect.calculateScore && effect.calculateCoinTransaction) {
      issues.push({
        severity: 'info',
        effectId: effect.id,
        message: 'Effect modifies both score and coins'
      });
    }

    // Check for effects that have activation but no clear trigger
    if (effect.onActivate && !effect.cost && !effect.maxCharges) {
      issues.push({
        severity: 'warning',
        effectId: effect.id,
        message: 'Effect has onActivate but no cost or charge limit - when is it activated?'
      });
    }

    // Check for potentially expensive operations
    if (effect.onMoveComplete || effect.canMove) {
      const code = effect.onMoveComplete?.toString() || effect.canMove?.toString() || '';
      if (code.includes('Object.values(state.piles)') || code.includes('forEach')) {
        issues.push({
          severity: 'warning',
          effectId: effect.id,
          message: 'Effect may have expensive iteration on every move'
        });
      }
    }

    // Check for transformCardVisual without obvious condition
    if (effect.transformCardVisual) {
      const code = effect.transformCardVisual.toString();
      if (!code.includes('if') && !code.includes('?')) {
        issues.push({
          severity: 'info',
          effectId: effect.id,
          message: 'transformCardVisual has no conditional logic - applies to all cards'
        });
      }
    }
  });

  return issues;
}

// ==================== CONFLICT DETECTION ====================

export interface EffectConflict {
  effectIds: string[];
  reason: string;
  severity: 'blocking' | 'warning';
}

export function detectConflicts(effects: GameEffect[]): EffectConflict[] {
  const conflicts: EffectConflict[] = [];

  // Check for conflicting movement rules
  const movementEffects = effects.filter(e => e.canMove);
  if (movementEffects.length > 3) {
    conflicts.push({
      effectIds: movementEffects.map(e => e.id),
      reason: 'Multiple movement rule modifiers may conflict',
      severity: 'warning'
    });
  }

  // Check for scoring multipliers that might stack unexpectedly
  const scoringEffects = effects.filter(e => e.calculateScore);
  if (scoringEffects.length > 2) {
    conflicts.push({
      effectIds: scoringEffects.map(e => e.id),
      reason: 'Multiple score modifiers - verify multiplication order',
      severity: 'warning'
    });
  }

  // Check for specific known conflicts
  const effectIds = effects.map(e => e.id);

  // Tower of Babel removes foundations - conflicts with foundation-based effects
  if (effectIds.includes('tower_of_babel')) {
    const foundationEffects = effects.filter(e =>
      e.description.toLowerCase().includes('foundation') ||
      e.id.includes('foundation')
    );
    if (foundationEffects.length > 1) {
      conflicts.push({
        effectIds: ['tower_of_babel', ...foundationEffects.map(e => e.id)],
        reason: 'Tower of Babel removes foundations - foundation effects will not work',
        severity: 'blocking'
      });
    }
  }

  // Street Smarts changes win condition - conflicts with score-based effects
  if (effectIds.includes('street_smarts')) {
    const scoreEffects = effects.filter(e =>
      e.calculateScore ||
      e.description.toLowerCase().includes('score') ||
      e.description.toLowerCase().includes('point')
    );
    if (scoreEffects.length > 1) {
      conflicts.push({
        effectIds: ['street_smarts', ...scoreEffects.map(e => e.id)],
        reason: 'Street Smarts makes score irrelevant - score modifiers have no effect',
        severity: 'warning'
      });
    }
  }

  return conflicts;
}

// ==================== CONSOLE LOGGING HELPERS ====================

export function logEffectExecution(log: EffectLog) {
  const emoji = log.error ? '❌' : '✅';
  console.log(
    `${emoji} [${log.effectName}] ${log.hookName}`,
    `(${log.duration.toFixed(2)}ms)`,
    log.error ? `ERROR: ${log.error}` : ''
  );
}

export function printStateDiff(diff: StateDiff[]) {
  if (diff.length === 0) {
    console.log('No state changes');
    return;
  }

  console.group('State Changes:');
  diff.forEach(d => {
    console.log(`  ${d.field}: ${JSON.stringify(d.before)} → ${JSON.stringify(d.after)}`);
  });
  console.groupEnd();
}

export function printPerformanceReport() {
  const stats = effectDebugger.getPerformanceStats();
  const sorted = Object.entries(stats).sort((a, b) => b[1].totalDuration - a[1].totalDuration);

  console.group('Effect Performance Report:');
  sorted.forEach(([effectId, stat]) => {
    console.log(
      `${effectId}: ${stat.count} calls, ${stat.totalDuration.toFixed(2)}ms total, ${stat.avgDuration.toFixed(2)}ms avg`
    );
  });
  console.groupEnd();
}

export function printValidationReport(effects: GameEffect[]) {
  const issues = validateEffects(effects);
  const conflicts = detectConflicts(effects);

  if (issues.length === 0 && conflicts.length === 0) {
    console.log('✅ No issues found');
    return;
  }

  if (issues.length > 0) {
    console.group('Validation Issues:');
    issues.forEach(issue => {
      const emoji = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${emoji} [${issue.effectId}] ${issue.message}`);
    });
    console.groupEnd();
  }

  if (conflicts.length > 0) {
    console.group('Effect Conflicts:');
    conflicts.forEach(conflict => {
      const emoji = conflict.severity === 'blocking' ? '❌' : '⚠️';
      console.log(`${emoji} ${conflict.reason}`);
      console.log(`   Effects: ${conflict.effectIds.join(', ')}`);
    });
    console.groupEnd();
  }
}
