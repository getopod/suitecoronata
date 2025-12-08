import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ==========================================
// CONFIGURATION MODES
// ==========================================
// Choose your mode by uncommenting one of the imports below:

// MODE 1: Standalone (No effects - pure solitaire UI)
// import { STANDALONE_CONFIG as CONFIG } from './data/mocks';

// MODE 2: Mock Data (Minimal effects for UI development)
// import { MOCK_CONFIG as CONFIG } from './data/mocks';

// MODE 3: Full Game (All effects and wanders)
// import { EFFECTS_REGISTRY } from './data/effects';
// import { WANDER_REGISTRY } from './data/wanders';
// const CONFIG = { effectsRegistry: EFFECTS_REGISTRY, wanderRegistry: WANDER_REGISTRY };

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <div className="dark">
      {/* 
        To use a specific mode, uncomment the CONFIG import above and use:
        <App effectsRegistry={CONFIG.effectsRegistry} wanderRegistry={CONFIG.wanderRegistry} />
        
        Default: Standalone mode (no props = empty registries)
      */}
      <App />
    </div>
  </React.StrictMode>
);