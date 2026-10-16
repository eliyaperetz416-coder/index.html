import { GAME_NAME } from './config.js';
import { Game } from './game.js';

document.title = GAME_NAME;
const t = document.querySelector('meta[name="apple-mobile-web-app-title"]');
if (t) t.content = GAME_NAME;

const game = new Game(document.getElementById('gl'));
window.__game = game; // handy for debugging / automated tests
game.start();
