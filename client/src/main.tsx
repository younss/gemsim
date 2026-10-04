import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Accessibility audit (development only): open the app with ?a11y, then run window.__axe.run()
if (import.meta.env.DEV && new URLSearchParams(location.search).has('a11y')) {
  import('axe-core').then(axe => {
    (window as any).__axe = axe.default ?? axe;
    console.info('[a11y] axe-core ready: await window.__axe.run(document, { runOnly: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"] })');
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
