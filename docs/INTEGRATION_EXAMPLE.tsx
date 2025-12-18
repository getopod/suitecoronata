/**
 * INTEGRATION EXAMPLE
 *
 * This file shows how to integrate the effect debug tools into App.tsx
 * Copy the relevant parts into your actual App.tsx
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useEffectDebugger } from './hooks/useEffectDebugger';
import { diffGameState, detectConflicts } from './utils/effectDebug';
import { EFFECTS_REGISTRY } from './data/effects';
import { GameState, GameEffect } from './types';

function AppWithDebug() {
  const [gameState, setGameState] = useState<GameState>(/* initial state */);
  const [activeEffects, setActiveEffects] = useState<string[]>([]);

  // ==================== 1. ENABLE DEBUGGER ====================

  // Option A: Always on in development
  const debug = useEffectDebugger(process.env.NODE_ENV === 'development');

  // Option B: With toggle (add a debug button to UI)
  const [debugEnabled, setDebugEnabled] = useState(false);
  const debug = useEffectDebugger(debugEnabled);

  // ==================== 2. VALIDATE ON MOUNT ====================

  useEffect(() => {
    // Validate all effects when app loads
    debug.printValidation(EFFECTS_REGISTRY);

    // Check for conflicts in starting effects
    if (activeEffects.length > 0) {
      const activeEffectDefs = EFFECTS_REGISTRY.filter(e =>
        activeEffects.includes(e.id)
      );
      const conflicts = detectConflicts(activeEffectDefs);
      if (conflicts.length > 0) {
        console.warn('⚠️ Effect conflicts detected:', conflicts);
      }
    }
  }, []); // Run once on mount

  // ==================== 3. ENFORCE EFFECT ORDER ====================

  // Modify getEffects to sort by type
  const getEffects = useCallback(() => {
    const typeOrder: Record<string, number> = {
      curse: 0,
      exploit: 1,
      blessing: 2,
      // Handle other types
      epic: 3,
      legendary: 4,
      rare: 5,
      uncommon: 6
    };

    return EFFECTS_REGISTRY
      .filter(e => activeEffects.includes(e.id))
      .sort((a, b) => {
        const orderA = typeOrder[a.type] ?? 999;
        const orderB = typeOrder[b.type] ?? 999;
        return orderA - orderB;
      });
  }, [activeEffects]);

  // ==================== 4. LOG STATE CHANGES ====================

  const performMove = useCallback((
    sourcePileId: string,
    targetPileId: string,
    cards: Card[]
  ) => {
    const before = gameState;

    // ... your existing move logic here ...
    const after = newGameState;

    // Log the diff in development
    if (process.env.NODE_ENV === 'development') {
      const diff = diffGameState(before, after);
      if (diff.length > 0) {
        console.group(`🎴 Move: ${sourcePileId} → ${targetPileId}`);
        diff.forEach(d => {
          console.log(`  ${d.field}:`, d.before, '→', d.after);
        });
        console.groupEnd();
      }
    }

    setGameState(after);
  }, [gameState]);

  // ==================== 5. CHECK CONFLICTS ON EFFECT CHANGES ====================

  useEffect(() => {
    if (activeEffects.length > 1) {
      const effectDefs = EFFECTS_REGISTRY.filter(e =>
        activeEffects.includes(e.id)
      );
      const conflicts = detectConflicts(effectDefs);

      // Warn about blocking conflicts
      const blocking = conflicts.filter(c => c.severity === 'blocking');
      if (blocking.length > 0) {
        console.error('❌ BLOCKING CONFLICTS:', blocking);
        // Optionally show UI warning
      }

      // Log warnings
      const warnings = conflicts.filter(c => c.severity === 'warning');
      if (warnings.length > 0) {
        console.warn('⚠️ Effect warnings:', warnings);
      }
    }
  }, [activeEffects]);

  // ==================== 6. PERFORMANCE REPORT AT GAME END ====================

  const handleGameEnd = useCallback(() => {
    // Print performance report
    console.log('📊 Game Performance Report:');
    debug.printReport();

    // Get specific stats
    const stats = debug.debugger.getPerformanceStats();
    const slowEffects = Object.entries(stats)
      .filter(([_, stat]) => stat.avgDuration > 5) // Effects taking >5ms
      .sort((a, b) => b[1].avgDuration - a[1].avgDuration);

    if (slowEffects.length > 0) {
      console.warn('⚠️ Slow effects detected:', slowEffects);
    }

    // Clear logs for next game
    debug.clearLogs();
  }, [debug]);

  // ==================== 7. DEBUG UI (OPTIONAL) ====================

  const DebugPanel = () => {
    if (!debugEnabled) return null;

    return (
      <div style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        maxWidth: '400px',
        maxHeight: '300px',
        overflow: 'auto'
      }}>
        <h4>Effect Debugger</h4>
        <button onClick={() => debug.printReport()}>
          Print Performance
        </button>
        <button onClick={() => debug.clearLogs()}>
          Clear Logs
        </button>
        <div>
          <h5>Recent Activity:</h5>
          {debug.getLogs().slice(-5).map((log, i) => (
            <div key={i}>
              {log.effectName}.{log.hookName} ({log.duration.toFixed(2)}ms)
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ==================== 8. MAIN RENDER ====================

  return (
    <div>
      {/* Your existing game UI */}

      {/* Add debug toggle button (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => setDebugEnabled(!debugEnabled)}
          style={{
            position: 'fixed',
            top: 10,
            right: 10,
            zIndex: 9999
          }}
        >
          {debugEnabled ? '🐛 Debug ON' : '🐛 Debug OFF'}
        </button>
      )}

      {/* Optional debug panel */}
      <DebugPanel />
    </div>
  );
}

// ==================== 9. GLOBAL DEBUG UTILITIES ====================

// Add these to window for console access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__debugGameState = () => {
    console.log('Current game state:', gameState);
  };

  (window as any).__validateEffects = () => {
    const debug = useEffectDebugger(true);
    debug.printValidation(EFFECTS_REGISTRY);
  };

  (window as any).__checkConflicts = (effectIds: string[]) => {
    const effects = EFFECTS_REGISTRY.filter(e => effectIds.includes(e.id));
    const conflicts = detectConflicts(effects);
    console.log('Conflicts:', conflicts);
    return conflicts;
  };

  console.log('🐛 Debug utilities loaded:');
  console.log('  window.__debugGameState()');
  console.log('  window.__validateEffects()');
  console.log('  window.__checkConflicts([...effectIds])');
  console.log('  window.effectDebugger');
  console.log('  window.printEffectReport()');
}

// ==================== 10. EXAMPLE CONSOLE COMMANDS ====================

/*
Open browser console and try:

// Get all logs
window.effectDebugger.getLogs()

// Get logs for specific effect
window.effectDebugger.getLogsByEffect('hoarder')

// Print performance report
window.printEffectReport()

// Check for slow effects
const stats = window.effectDebugger.getPerformanceStats()
Object.entries(stats)
  .filter(([_, s]) => s.avgDuration > 5)
  .forEach(([id, s]) => console.log(id, s.avgDuration + 'ms'))

// Validate all effects
window.__validateEffects()

// Check conflicts between specific effects
window.__checkConflicts(['tower_of_babel', 'blacksmith', 'wizard'])

// Get errors
window.effectDebugger.getErrors()

// Clear logs
window.effectDebugger.clear()
*/

export default AppWithDebug;
