import './styles/main.css';
import { Game } from './game/game.js';

const TIPS = [
  'Tip: flick up (or tap a second finger) to fire nitro',
  'Tip: steer hard at speed to drift and fill your nitro',
  'Tip: squeeze past hazards for near-miss combos',
  'Tip: lift your finger to brake and time the lasers',
  'Tip: idle earnings keep paying while you are away',
];
const tip = document.querySelector('.loading-tip');
if (tip) tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

// Let the loading screen paint before the (synchronous) world building starts.
requestAnimationFrame(() =>
  setTimeout(() => {
    const game = new Game();
    game.boot();
    // Test hook for the end-to-end scripts (and handy in the console).
    window.__game = game;
  }, 30),
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('sw', e)));
}
