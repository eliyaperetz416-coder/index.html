import './styles/main.css';
import { Game } from './game/game.js';

const game = new Game();
game.boot();

// Test hook for the end-to-end scripts (and handy in the console).
window.__game = game;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('sw', e)));
}
