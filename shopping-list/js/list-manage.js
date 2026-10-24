// "List settings": rename, join code (copy / link / share / replace), members, leave and
// delete. Also the invitation link (?join=CODE).
import { state } from './state.js';
import { $ } from './util.js';
import { t } from './i18n.js';
import { escapeHtml } from './html.js';
import { showToast, messageFor } from './ui.js';
import { confirmDialog, initConfirm } from './confirm.js';
import { inviteUrl, parseJoinParam } from './codes.js';
import { renameList, leaveList, deleteList, renewJoinCode, joinList } from './sync.js';

const activeList = () => state.lists.find((l) => l.id === state.activeListId);

export function applyListManageLanguage() {
  const dict = t();
  $('manageListBtn').textContent = dict.manageListLabel;
  $('listManageTitle').textContent = dict.manageListLabel;
  $('manageNameLabel').textContent = dict.listNameLabel;
  $('manageCodeLabel').textContent = dict.joinCodeTitle;
  $('copyCodeBtn').textContent = dict.copyCodeLabel;
  $('copyLinkBtn').textContent = dict.copyLinkLabel;
  $('shareBtn').textContent = dict.shareLabel;
  $('newCodeBtn').textContent = dict.newCodeLabel;
  $('ownerLeaveHint').textContent = dict.ownerLeaveHint;
  $('leaveListBtn').textContent = dict.leaveListLabel;
  $('deleteListBtn').textContent = dict.deleteListLabel;
  $('closeManageBtn').textContent = dict.close;
  if ($('listManageOverlay').classList.contains('show')) renderListManage();
}

function renderListManage() {
  const list = activeList();
  if (!list) { close(); return; }
  const dict = t();
  const uid = state.user.uid;
  const isOwner = list.ownerUid === uid;
  const names = list.memberNames || {};

  if (document.activeElement !== $('manageName')) $('manageName').value = list.name;
  $('manageCode').textContent = list.code;
  $('newCodeBtn').hidden = !isOwner;
  $('manageMembersLabel').textContent = dict.membersTitleFn(list.members.length);
  $('memberList').innerHTML = list.members.map((member) => {
    const badges = [member === list.ownerUid ? dict.ownerBadge : '', member === uid ? dict.youBadge : ''].filter(Boolean);
    return `<li><span class="member-name">${escapeHtml(names[member] || dict.memberUnknown)}</span>${
      badges.map((b) => `<span class="member-badge">${escapeHtml(b)}</span>`).join('')}</li>`;
  }).join('');
  // The owner cannot leave (the list would have no owner); they can delete it instead.
  $('leaveListBtn').hidden = isOwner;
  $('ownerLeaveHint').hidden = !isOwner || list.members.length < 2;
  $('deleteListBtn').hidden = !isOwner;
}

function open() {
  if (!activeList()) return;
  $('listPickerOverlay').classList.remove('show');
  renderListManage();
  $('listManageOverlay').classList.add('show');
}

function close() {
  $('listManageOverlay').classList.remove('show');
}

async function copy(text, doneMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers / blocked clipboard: fall back to selecting a hidden field.
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(field);
    field.select();
    try { document.execCommand('copy'); } finally { field.remove(); }
  }
  showToast(doneMessage);
}

const linkFor = (list) => inviteUrl(location.href, list.code);

async function share() {
  const list = activeList();
  if (!list) return;
  const link = linkFor(list);
  const text = t().shareTextFn(list.name, link);
  if (navigator.share) {
    try { await navigator.share({ text }); } catch { /* the user closed the share sheet */ }
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

// ---------- invitation link ----------
// "?join=CODE": keep the code until the user is signed in and their lists are loaded,
// and take it out of the address so a refresh does not ask again.
export function captureInvite() {
  const code = parseJoinParam(location.search);
  if (!code) return;
  try { sessionStorage.setItem('pendingJoin', code); } catch { /* private mode: link not remembered */ }
  history.replaceState(null, '', location.pathname + location.hash);
}

let offering = false;
async function offerPendingJoin() {
  let code = null;
  try { code = sessionStorage.getItem('pendingJoin'); } catch { /* ignore */ }
  if (!code || offering || !state.user) return;
  offering = true;
  try { sessionStorage.removeItem('pendingJoin'); } catch { /* ignore */ }
  try {
    if (state.lists.some((l) => l.code === code)) return; // already in it
    const yes = await confirmDialog({ text: t().inviteFn(code), okLabel: t().joinNowLabel, cancelLabel: t().notNowLabel });
    if (!yes) return;
    const error = { textContent: '' };
    if (!(await joinList(code, error, { disabled: false }))) showToast(error.textContent || messageFor());
  } finally {
    offering = false;
  }
}

export function initListManage() {
  initConfirm();
  const overlay = $('listManageOverlay');

  $('manageListBtn').addEventListener('click', open);
  const title = $('headerTitle');
  title.addEventListener('click', open);
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

  $('closeManageBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.addEventListener('lists-changed', () => {
    if (overlay.classList.contains('show')) renderListManage();
    offerPendingJoin();
  });

  const rename = () => { const list = activeList(); if (list) renameList(list.id, $('manageName').value); };
  $('manageRenameBtn').addEventListener('click', rename);
  $('manageName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); rename(); } });

  $('copyCodeBtn').addEventListener('click', () => { const l = activeList(); if (l) copy(l.code, t().codeCopied); });
  $('copyLinkBtn').addEventListener('click', () => { const l = activeList(); if (l) copy(linkFor(l), t().linkCopied); });
  $('shareBtn').addEventListener('click', share);

  $('newCodeBtn').addEventListener('click', async () => {
    const list = activeList();
    if (!list || !(await confirmDialog({ text: t().confirmNewCode, okLabel: t().newCodeLabel }))) return;
    await renewJoinCode(list.id);
  });

  $('leaveListBtn').addEventListener('click', async () => {
    const list = activeList();
    if (!list || !(await confirmDialog({ text: t().confirmLeaveFn(list.name), okLabel: t().leaveListLabel, danger: true }))) return;
    close();
    leaveList(list.id);
  });

  $('deleteListBtn').addEventListener('click', async () => {
    const list = activeList();
    if (!list || !(await confirmDialog({ text: t().confirmDeleteFn(list.name), okLabel: t().deleteListLabel, danger: true }))) return;
    if (await deleteList(list.id)) close();
  });
}
