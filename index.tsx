
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import { SessionProvider } from './components/SessionContext';
import { registerSW } from 'virtual:pwa-register';
import './index.css';

// Register the service worker for offline support
registerSW({ 
  immediate: true,
  onNeedRefresh() {
    console.log('App content update available. Please refresh.');
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
});

const container = document.getElementById('root');
if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <SessionProvider>
          <App />
        </SessionProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to render application:', error);
    // Display a simple error message if rendering fails
    container.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; color: white; background: #111;">
        <h2>Initialization Failed</h2>
        <p>There was an error starting the application. Please check the console for details.</p>
        <pre style="color: #ff5555; overflow: auto; max-width: 100%; font-size: 12px;">${error instanceof Error ? error.message : String(error)}</pre>
      </div>
    `;
  }
}
