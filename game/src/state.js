// Global save: L's suspicion meter (0-100), kept across chapters in localStorage.
const KEY = 'deathnote.save.v1';
const DEFAULTS = { suspicion: 0 };

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode / storage full: the game still runs, progress just isn't kept.
  }
}

export function getSuspicion() {
  return read().suspicion;
}

export function addSuspicion(delta) {
  const save = read();
  save.suspicion = Math.max(0, Math.min(100, save.suspicion + delta));
  write(save);
  return save.suspicion;
}
