// Settings and pause screens (templates).

import { esc } from './dom.js';
import { GAME_NAME } from '../config/game.js';

const CONTROLS = [
  ['drag', 'Hold & drag', 'Hold anywhere to drive, slide to steer, lift to brake.'],
  ['buttons', 'Left / right buttons', 'Hold a button to drive and steer that way. Both = straight.'],
  ['wheel', 'Steering wheel', 'Touch the wheel to drive, turn it to steer.'],
];
const QUALITY = [
  ['auto', 'Auto'],
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
];

const toggle = (action, on, label) => `
  <button class="set-row" data-action="${action}">
    <span>${label}</span><span class="switch ${on ? 'on' : ''}"><i></i></span>
  </button>`;

export const SETTINGS_TEMPLATES = {
  settings: (d) => `
    <div class="screen settings">
      <div class="topbar">
        <button class="back" data-action="${d.back}" aria-label="Back">&#8249;</button>
        <h2 class="title">SETTINGS</h2>
        <span style="width:44px"></span>
      </div>
      <div class="scroll">
        <h3 class="group-title">CONTROLS</h3>
        ${CONTROLS.map(([id, name, hint]) => `
          <button class="ctrl-card ${d.control === id ? 'on' : ''}" data-action="setControl" data-id="${id}">
            <span class="ctrl-icon ${id}"></span>
            <span class="ctrl-text"><b>${name}</b><small>${hint}</small></span>
          </button>`).join('')}
        <p class="set-note">Keyboard always works too: W / Up drive, A D steer, S brake, Shift nitro.</p>

        <h3 class="group-title">SOUND</h3>
        ${toggle('toggleSound', d.sound, 'Sound effects and engine')}
        <label class="set-row slider">
          <span>Volume</span>
          <input type="range" min="0" max="100" value="${Math.round(d.volume * 100)}" data-input="volume" ${d.sound ? '' : 'disabled'} />
        </label>
        ${toggle('toggleHaptics', d.haptics, 'Vibration (where supported)')}

        <h3 class="group-title">GRAPHICS</h3>
        <div class="segmented">
          ${QUALITY.map(([id, name]) => `<button class="${d.quality === id ? 'on' : ''}" data-action="setQuality" data-id="${id}">${name}</button>`).join('')}
        </div>
        <p class="set-note">Now running: ${esc(d.activeQuality)}. Low is fastest on older phones; High adds bloom glow.</p>

        <h3 class="group-title">PROGRESS</h3>
        <button class="danger wide" data-action="askReset">Reset all progress</button>
        <p class="set-note center">${esc(GAME_NAME)} · build ${esc(d.build)}</p>
      </div>
    </div>`,

  pause: (d) => `
    <div class="screen pause">
      <div class="grow"></div>
      <h2 class="pause-title">PAUSED</h2>
      <p class="pause-track">${esc(d.track)}</p>
      <button class="primary big" data-action="resume">RESUME</button>
      <div class="row">
        <button class="ghost" data-action="restart">Restart</button>
        <button class="ghost" data-action="pauseSettings">Settings</button>
      </div>
      <button class="ghost wide quit" data-action="quit">Quit to menu</button>
      <div class="grow"></div>
    </div>`,
};
