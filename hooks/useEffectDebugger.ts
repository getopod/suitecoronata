import { useEffect, useCallback } from 'react';
import { effectDebugger, printPerformanceReport, printValidationReport } from '../utils/effectDebug';
import { GameEffect } from '../types';

export function useEffectDebugger(enabled: boolean = false) {
  useEffect(() => {
    if (enabled) {
      effectDebugger.enable();
      console.log('🔍 Effect debugger enabled');
    } else {
      effectDebugger.disable();
    }

    return () => {
      if (enabled) {
        effectDebugger.disable();
      }
    };
  }, [enabled]);

  const printReport = useCallback(() => {
    printPerformanceReport();
  }, []);

  const printValidation = useCallback((effects: GameEffect[]) => {
    printValidationReport(effects);
  }, []);

  const getLogs = useCallback(() => {
    return effectDebugger.getLogs();
  }, []);

  const clearLogs = useCallback(() => {
    effectDebugger.clear();
  }, []);

  return {
    printReport,
    printValidation,
    getLogs,
    clearLogs,
    debugger: effectDebugger
  };
}

// Add to window for console access during development
if (typeof window !== 'undefined') {
  (window as any).effectDebugger = effectDebugger;
  (window as any).printEffectReport = printPerformanceReport;
}
