// HTML overlay on top of the 3D canvas (title cards, captions, letterbox, objectives).
const $ = (id) => document.getElementById(id);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const ui = {
  /** Shows the start screen and resolves on the first tap (needed to unlock audio on iOS). */
  waitForStart() {
    const el = $('start');
    return new Promise((resolve) => {
      el.addEventListener('click', () => { el.hidden = true; resolve(); }, { once: true });
    });
  },

  setLoading(text) {
    $('start-hint').textContent = text;
  },

  async titleCard(title, subtitle) {
    const el = $('title-card');
    el.querySelector('.t').textContent = title;
    el.querySelector('.s').textContent = subtitle;
    el.classList.add('show');
    await wait(3200);
    el.classList.remove('show');
    await wait(900);
  },

  fadeFromBlack() {
    $('fade').classList.add('clear');
  },

  async fadeToBlack() {
    const el = $('fade');
    if (!el.classList.contains('clear')) return;
    el.classList.add('fast');
    el.classList.remove('clear');
    await wait(500);
    el.classList.remove('fast');
  },

  letterbox(on) {
    document.body.classList.toggle('cinematic', on);
  },

  caption(cap) {
    const el = $('caption');
    if (!cap) { el.classList.remove('show'); return; }
    el.querySelector('.speaker').textContent = cap.speaker ?? '';
    el.querySelector('.text').textContent = cap.thought ? `(${cap.text})` : cap.text;
    el.classList.toggle('thought', !!cap.thought);
    el.classList.add('show');
  },

  /** Shows one caption line for its duration. */
  async say(line) {
    ui.caption(line);
    await wait((line.for ?? 2.5) * 1000);
    ui.caption(null);
    await wait(350);
  },

  objective(text) {
    const el = $('objective');
    if (!text) { el.classList.remove('show'); return; }
    el.querySelector('.text').textContent = text;
    el.classList.add('show');
  },
};
