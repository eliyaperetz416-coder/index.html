// Swipe a row toward the end of the line to tick it, toward the start to delete it
// (see gestures.js; mirrored automatically in right-to-left languages). The row follows
// the finger over a green / red background; a short swipe snaps back.
import { $ } from './util.js';
import { isHorizontalDrag, logicalOffset, swipeOutcome, clampOffset } from './gestures.js';

const IGNORE = '.checkbox, .delete-btn, .urgency-btn, .urgency-menu';

export function initSwipe({ onTick, onDelete }) {
  const list = $('list');
  let drag = null;
  let suppressClick = false;

  const dir = () => document.documentElement.getAttribute('dir') || 'ltr';

  list.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const row = e.target.closest('.item');
    if (!row || e.target.closest(IGNORE)) return;
    drag = { row, wrap: row.parentElement, id: row.querySelector('.checkbox').dataset.id, x: e.clientX, y: e.clientY, dx: 0, active: false, pointerId: e.pointerId, width: row.offsetWidth };
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.active) {
      if (!isHorizontalDrag(dx, dy)) return;
      drag.active = true;
      drag.row.classList.add('dragging');
      try { drag.row.setPointerCapture(e.pointerId); } catch { /* not capturable: keep going */ }
    }
    drag.dx = clampOffset(dx);
    drag.row.style.transform = `translateX(${drag.dx}px)`;
    drag.wrap.dataset.swipe = logicalOffset(drag.dx, dir()) > 0 ? 'tick' : 'delete';
    drag.wrap.classList.toggle('armed', swipeOutcome(drag.dx, { dir: dir(), width: drag.width }) !== null);
  });

  function finish(e, cancelled) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { row, wrap, id, dx, width, active } = drag;
    drag = null;
    if (!active) return;
    // The click that follows a drag must not open the editor.
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    row.classList.remove('dragging');
    const outcome = cancelled ? null : swipeOutcome(dx, { dir: dir(), width });
    if (!outcome) {
      row.style.transform = '';
      wrap.classList.remove('armed');
      delete wrap.dataset.swipe;
      return;
    }
    row.style.transform = `translateX(${dx > 0 ? '110%' : '-110%'})`;
    row.style.opacity = '0';
    setTimeout(() => (outcome === 'tick' ? onTick(id) : onDelete(id)), 160);
  }

  list.addEventListener('pointerup', (e) => finish(e, false));
  list.addEventListener('pointercancel', (e) => finish(e, true));

  list.addEventListener('click', (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
