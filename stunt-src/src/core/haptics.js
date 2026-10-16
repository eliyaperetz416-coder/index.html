// Haptics where supported. Android and most browsers: the Vibration API. iPhone Safari has no
// Vibration API, but toggling a native switch control gives a light system tick (iOS 18+), which
// we use for short taps when nothing else is available.

let enabled = true;
let iosSwitch = null;

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function setHaptics(on) {
  enabled = on;
}

/** pattern: ms or [on, off, on, ...]. Strength is approximated on iOS by the number of ticks. */
export function haptic(pattern = 15) {
  if (!enabled) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
      return;
    }
    const pulses = Array.isArray(pattern) ? Math.ceil(pattern.length / 2) : 1;
    for (let i = 0; i < Math.min(3, pulses); i++) setTimeout(iosTick, i * 70);
  } catch {
    // Not supported: silently do nothing.
  }
}

export const HAPTIC = {
  tap: 10,
  hit: [40, 30, 40],
  crash: [80, 40, 80],
  land: 25,
  boost: 20,
  nitro: [20, 20, 40],
  nearMiss: 12,
  ram: [50, 20, 50],
};
