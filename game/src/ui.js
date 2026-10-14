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

  objective(text) {
    const el = $('objective');
    el.querySelector('.text').textContent = text;
    el.classList.add('show');
  },
};
