// The list picker (header button), the first-run welcome screen and the
// "try again" button: the screens around creating, joining and switching lists.
import { state } from './state.js';
import { $, escapeHtml } from './util.js';
import { t } from './i18n.js';
import { createList, joinList, switchToList, initForUser } from './sync.js';

function renderListPicker() {
  const listPickerItemsEl = $('listPickerItems');
  if (state.lists.length === 0) {
    listPickerItemsEl.innerHTML = `<p class="stats-empty">${t().noListsYet}</p>`;
  } else {
    listPickerItemsEl.innerHTML = state.lists.map(list => `
      <div class="list-picker-item${list.id === state.activeListId ? ' active' : ''}" data-id="${list.id}">
        <div>
          <div class="list-name">${escapeHtml(list.name)}</div>
          <div class="list-code">${t().joinCodeLabel}: ${list.code}</div>
        </div>
        ${list.id === state.activeListId ? '✓' : ''}
      </div>
    `).join('');
  }
  $('signedInEmail').textContent = state.user ? state.user.email : '';
}

export function initListUi() {
  const listPickerOverlay = $('listPickerOverlay');
  const newListNameInput = $('newListNameInput');
  const createListBtn = $('createListBtn');
  const joinCodeInput = $('joinCodeInput');
  const joinListBtn = $('joinListBtn');

  $('listPickerBtn').addEventListener('click', () => {
    listPickerOverlay.classList.add('show');
    renderListPicker();
  });
  $('closeListPickerBtn').addEventListener('click', () => listPickerOverlay.classList.remove('show'));
  listPickerOverlay.addEventListener('click', (e) => {
    if (e.target === listPickerOverlay) listPickerOverlay.classList.remove('show');
  });

  createListBtn.addEventListener('click', async () => {
    if (await createList(newListNameInput.value, $('createListError'), createListBtn)) {
      newListNameInput.value = '';
      renderListPicker();
    }
  });

  joinListBtn.addEventListener('click', async () => {
    if (await joinList(joinCodeInput.value, $('joinListError'), joinListBtn)) {
      joinCodeInput.value = '';
      renderListPicker();
    }
  });

  $('listPickerItems').addEventListener('click', (e) => {
    const item = e.target.closest('.list-picker-item');
    if (item) {
      switchToList(item.dataset.id);
      listPickerOverlay.classList.remove('show');
    }
  });

  // First-run screen: same actions, shown when the user has no list at all
  const welcomeNewListInput = $('welcomeNewListInput');
  const welcomeCreateBtn = $('welcomeCreateBtn');
  const welcomeJoinInput = $('welcomeJoinInput');
  const welcomeJoinBtn = $('welcomeJoinBtn');

  const submitWelcomeCreate = async () => {
    if (await createList(welcomeNewListInput.value, $('welcomeCreateError'), welcomeCreateBtn)) welcomeNewListInput.value = '';
  };
  const submitWelcomeJoin = async () => {
    if (await joinList(welcomeJoinInput.value, $('welcomeJoinError'), welcomeJoinBtn)) welcomeJoinInput.value = '';
  };
  welcomeCreateBtn.addEventListener('click', submitWelcomeCreate);
  welcomeJoinBtn.addEventListener('click', submitWelcomeJoin);
  welcomeNewListInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitWelcomeCreate(); });
  welcomeJoinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitWelcomeJoin(); });

  $('retryLoadBtn').addEventListener('click', initForUser);
}

// Closes the picker (used when the user signs out).
export function closeListPicker() {
  $('listPickerOverlay').classList.remove('show');
}
