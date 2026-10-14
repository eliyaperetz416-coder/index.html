// Global save: L's suspicion meter (0-100), kept across chapters in localStorage.
// Each chapter stores its own result, so replaying a chapter replaces its effect instead of stacking it.
const KEY = 'deathnote.save.v2';

function read() {
  try {
    return { chapters: {}, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { chapters: {} };
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
  const total = Object.values(read().chapters).reduce((sum, c) => sum + (c.suspicion ?? 0), 0);
  return Math.max(0, Math.min(100, total));
}

/** Records a chapter's outcome; returns the meter before and after. */
export function setChapterResult(chapterId, result) {
  const before = getSuspicion();
  const save = read();
  save.chapters[chapterId] = result;
  write(save);
  return { before, after: getSuspicion() };
}
