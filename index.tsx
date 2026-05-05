
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
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
  const root = createRoot(container);
  root.render(<App />);
}
