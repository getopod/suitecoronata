# Effect System Debug Guide

This guide explains how to use the effect debugging and validation tools.

## Quick Start

### 1. Enable Debug Mode

In your component:

```typescript
import { useEffectDebugger } from '../hooks/useEffectDebugger';

function YourComponent() {
  // Enable in development
  const debug = useEffectDebugger(process.env.NODE_ENV === 'development');

  // Or toggle with state
  const [debugEnabled, setDebugEnabled] = useState(false);
  const debug = useEffectDebugger(debugEnabled);
}
```

### 2. Console Access

When enabled, you get global access:

```javascript
// In browser console:
window.effectDebugger.getLogs()           // Get all logs
window.effectDebugger.getRecentLogs(10)   // Get last 10 logs
window.printEffectReport()                 // Print performance report
```

---

## Features

### 📊 Performance Monitoring

Track how long each effect takes to execute:

```typescript
// In your code:
debug.printReport();
```

**Console output:**
```
Effect Performance Report:
  hoarder: 47 calls, 23.45ms total, 0.50ms avg
  compound_interest: 32 calls, 156.23ms total, 4.88ms avg
  schrodinger_deck: 15 calls, 1234.56ms total, 82.30ms avg  ⚠️ SLOW!
```

### 🔍 Execution Logs

See every effect hook execution:

```typescript
const logs = debug.getLogs();
logs.forEach(log => {
  console.log(`${log.effectName}.${log.hookName}`, log.duration + 'ms');
});
```

**Log structure:**
```typescript
{
  timestamp: 1702345678901,
  effectId: 'hoarder',
  effectName: 'Hoarder',
  hookName: 'calculateScore',
  inputs: ['[MoveContext]', '[GameState]'],
  output: 150,
  duration: 0.42,
  error?: 'Division by zero'
}
```

### ✅ Effect Validation

Check for issues before they cause problems:

```typescript
import { EFFECTS_REGISTRY } from '../data/effects';

debug.printValidation(EFFECTS_REGISTRY);
```

**Detects:**
- Duplicate effect IDs
- Effects without clear activation triggers
- Potentially expensive operations
- Missing conditional logic

**Example output:**
```
Validation Issues:
  ⚠️ [one_armed_bandit] Effect may have expensive iteration on every move
  ℹ️ [alchemist] Effect modifies both score and coins
  ❌ [duplicate_effect] Duplicate effect ID: duplicate_effect
```

### ⚔️ Conflict Detection

Find effects that might conflict:

```typescript
import { detectConflicts } from '../utils/effectDebug';
import { EFFECTS_REGISTRY } from '../data/effects';

const activeEffects = EFFECTS_REGISTRY.filter(e =>
  ['tower_of_babel', 'blacksmith', 'wizard'].includes(e.id)
);

const conflicts = detectConflicts(activeEffects);
conflicts.forEach(conflict => {
  console.warn(conflict.reason, conflict.effectIds);
});
```

**Example conflicts:**
```
❌ Tower of Babel removes foundations - foundation effects will not work
   Effects: tower_of_babel, blacksmith, wizard

⚠️ Multiple score modifiers - verify multiplication order
   Effects: hoarder, compound_interest, high_society
```

### 📝 State Diffing

See exactly what changed:

```typescript
import { diffGameState } from '../utils/effectDebug';

const before = gameState;
// ... perform move ...
const after = newGameState;

const diff = diffGameState(before, after);
console.log(diff);
```

**Output:**
```javascript
[
  { field: 'score', before: 100, after: 150 },
  { field: 'coins', before: 50, after: 55 },
  { field: 'piles.tableau-0.cards.length', before: 7, after: 6 },
  { field: 'effectState.hoarderStreak', before: 2, after: 3 }
]
```

---

## Integration Example

Here's a complete integration in App.tsx:

```typescript
import { useEffectDebugger } from './hooks/useEffectDebugger';
import { diffGameState } from './utils/effectDebug';

function App() {
  const [gameState, setGameState] = useState(initialState);

  // Enable debug in dev mode or with a toggle
  const debug = useEffectDebugger(true);

  // Validate effects on mount
  useEffect(() => {
    debug.printValidation(EFFECTS_REGISTRY);
  }, []);

  // Log state changes on every move
  const handleMove = (from: string, to: string) => {
    const before = gameState;
    const after = performMove(from, to, before);

    const diff = diffGameState(before, after);
    if (diff.length > 0) {
      console.group('Move:', from, '→', to);
      diff.forEach(d => {
        console.log(`  ${d.field}:`, d.before, '→', d.after);
      });
      console.groupEnd();
    }

    setGameState(after);
  };

  // Print performance report at game end
  const handleGameEnd = () => {
    debug.printReport();
    // Clear logs for next game
    debug.clearLogs();
  };
}
```

---

## Debug Console Commands

When debugger is enabled, use these in browser console:

```javascript
// Get logs
window.effectDebugger.getLogs()
window.effectDebugger.getLogsByEffect('hoarder')
window.effectDebugger.getRecentLogs(5)

// Performance
window.effectDebugger.getPerformanceStats()
window.printEffectReport()

// Errors
window.effectDebugger.getErrors()

// Control
window.effectDebugger.enable()
window.effectDebugger.disable()
window.effectDebugger.clear()
```

---

## Performance Tips

Based on validation warnings, optimize slow effects:

### ❌ Before (Expensive)
```typescript
onMoveComplete: (state) => {
  let count = 0;
  Object.values(state.piles).forEach(p =>
    p.cards.forEach(c => {
      if (c.faceUp && c.rank === 7) count++;
    })
  );
  // Do something...
}
```

### ✅ After (Optimized)
```typescript
onMoveComplete: (state, context) => {
  // Early exit - only check if we just revealed a 7
  if (context.cards[0].rank !== 7 || !context.cards[0].faceUp) {
    return {};
  }

  // Now do the expensive check
  let count = 0;
  Object.values(state.piles).forEach(p =>
    p.cards.forEach(c => {
      if (c.faceUp && c.rank === 7) count++;
    })
  );
  // Do something...
}
```

---

## Effect Execution Order

Effects are executed in type order: **Curses → Exploits → Blessings**

This is enforced in `getEffects()`:

```typescript
const getEffects = () => {
  const typeOrder = { curse: 0, exploit: 1, blessing: 2 };
  return effectsRegistry
    .filter(e => activeEffects.includes(e.id))
    .sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
};
```

**Why this order?**
- **Curses** apply restrictions first
- **Exploits** work within those restrictions
- **Blessings** apply final bonuses

---

## Typed Meta Properties

All card/pile meta properties are now typed for better autocomplete:

```typescript
// Before (untyped)
card.meta?.isKey  // No autocomplete, easy to typo

// After (typed)
card.meta?.isKey  // ✅ Autocomplete works!
card.meta?.isWild // ✅ Shows all available properties
card.meta?.glow   // ✅ Shows valid values: 'gold' | 'purple' | 'red'
```

**Available card meta properties:**
- Special types: `isKey`, `isWild`, `isBandage`, `isWound`, `isFearSkip`
- State: `locked`, `persistent`, `stolen`, `cursed`, `blessed`
- Visual: `blurred`, `highlighted`, `animated`, `glow`, `opacity`, `scale`
- Quest: `isQuestItem`, `questType`, `showKey`, `showWound`

**Available pile meta properties:**
- `isWildFoundation`, `isPhantom`, `tier`

All meta interfaces include `[key: string]: any` for extensibility.

---

## Best Practices

1. **Enable debug in development only**
   ```typescript
   useEffectDebugger(process.env.NODE_ENV === 'development')
   ```

2. **Run validation after adding new effects**
   ```typescript
   debug.printValidation(EFFECTS_REGISTRY);
   ```

3. **Check performance after complex effects**
   ```typescript
   debug.printReport();
   ```

4. **Use typed meta properties**
   ```typescript
   // Good
   card.meta?.isKey

   // Bad
   card.meta?.['isKey']
   ```

5. **Detect conflicts when effects are combined**
   ```typescript
   const conflicts = detectConflicts(activeEffects);
   if (conflicts.length > 0) {
     console.warn('Effect conflicts detected!', conflicts);
   }
   ```

---

## Troubleshooting

### "Effect seems to execute multiple times"

Check the logs:
```javascript
window.effectDebugger.getLogsByEffect('your_effect_id')
```

Common causes:
- Effect has multiple hooks (`canMove`, `onMoveComplete`, etc.)
- Effect runs on every frame via `transformCardVisual`
- State update triggers re-render which re-runs effect

### "Effect conflicts with another effect"

Run conflict detection:
```typescript
const conflicts = detectConflicts(activeEffects);
console.log(conflicts);
```

### "Performance is slow"

Print performance report:
```javascript
window.printEffectReport()
```

Look for effects with high `avgDuration` or `totalDuration`.

### "Effect not working as expected"

Check the execution logs:
```javascript
const logs = window.effectDebugger.getRecentLogs(20);
logs.forEach(log => console.log(log.effectName, log.hookName, log.output));
```

---

## TypeScript Support

All debug tools have full TypeScript support:

```typescript
import {
  effectDebugger,
  EffectLog,
  StateDiff,
  ValidationIssue,
  EffectConflict,
  validateEffects,
  detectConflicts,
  diffGameState
} from './utils/effectDebug';
```

Enjoy debugging! 🐛
