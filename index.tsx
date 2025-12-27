import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { EFFECTS_REGISTRY } from './data/effects';
import { WANDER_REGISTRY } from './data/wanders';
import { AuthProvider } from './contexts/AuthContext';

const CONFIG = { effectsRegistry: EFFECTS_REGISTRY, wanderRegistry: WANDER_REGISTRY };

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <div className='dark'>
        <App effectsRegistry={CONFIG.effectsRegistry} wanderRegistry={CONFIG.wanderRegistry} />
      </div>
    </AuthProvider>
  </React.StrictMode>
);
