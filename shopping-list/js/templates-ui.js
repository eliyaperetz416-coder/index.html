// The templates sheet: save the current list as a template, add a template's items to
// the list in one tap (skipping what is already there), delete saved ones.
import { state } from './state.js';
import { $ } from './util.js';
import { t } from './i18n.js';
import { escapeHtml } from './html.js';
import { showToast } from './ui.js';
import { confirmDialog } from './confirm.js';
import { builtinTemplates, templateFromItems, itemsToAdd } from './templates.js';
import { addItemDocs, deleteItemsDoc, saveTemplateDoc, deleteTemplateDoc } from './sync.js';

export function applyTemplatesLanguage() {
  const dict = t();
  $('templatesLabel').textContent = dict.templatesLabel;
  $('templatesTitle').textContent = dict.templatesTitle;
  $('saveTemplateLabel').textContent = dict.saveAsTemplateLabel;
  $('templateName').placeholder = dict.templateNamePlaceholder;
  $('savedTemplatesLabel').textContent = dict.savedTemplatesTitle;
  $('builtinTemplatesLabel').textContent = dict.builtinTemplatesTitle;
  $('closeTemplatesBtn').textContent = dict.close;
  if ($('templatesOverlay').classList.contains('show')) renderTemplates();
}

// "Milk, Eggs, Bread +9"
function preview(items) {
  const names = items.slice(0, 3).map((i) => i.name).join(', ');
  return items.length > 3 ? `${names} +${items.length - 3}` : names;
}

function row(template) {
  const dict = t();
  return `<li class="template-row" data-id="${escapeHtml(template.id)}">
    <div class="template-info">
      <span class="template-name">${escapeHtml(template.name)}</span>
      <span class="template-sub">${escapeHtml(dict.templateItemsFn(template.items.length))} · ${escapeHtml(preview(template.items))}</span>
    </div>
    <button type="button" class="chip-btn template-add" data-action="add">${escapeHtml(dict.addTemplateLabel)}</button>
    ${template.builtin ? '' : `<button type="button" class="delete-btn" data-action="delete" aria-label="${escapeHtml(dict.deleteLabel)}">✕</button>`}
  </li>`;
}

function renderTemplates() {
  $('savedTemplates').innerHTML = state.templates.length
    ? state.templates.map(row).join('')
    : `<li class="stats-empty">${escapeHtml(t().templatesEmpty)}</li>`;
  $('builtinTemplates').innerHTML = builtinTemplates(state.lang).map(row).join('');
}

const allTemplates = () => [...state.templates, ...builtinTemplates(state.lang)];

function addTemplate(template) {
  const entries = itemsToAdd(template, state.items);
  const created = entries.length ? addItemDocs(entries) : [];
  $('templatesOverlay').classList.remove('show');
  showToast(t().templateAddedFn(created.length), created.length ? {
    actionLabel: t().undoLabel,
    onAction: () => deleteItemsDoc(created),
  } : {});
}

export function initTemplatesUi() {
  const overlay = $('templatesOverlay');
  const open = () => { renderTemplates(); overlay.classList.add('show'); };
  const close = () => overlay.classList.remove('show');

  $('templatesBtn').addEventListener('click', open);
  $('closeTemplatesBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.addEventListener('templates-changed', () => { if (overlay.classList.contains('show')) renderTemplates(); });

  const save = () => {
    const template = templateFromItems($('templateName').value, state.items);
    if (!template.name) { $('templateName').focus(); return; }
    if (template.items.length === 0) { showToast(t().nothingToSave); return; }
    saveTemplateDoc(template);
    $('templateName').value = '';
    showToast(t().templateSavedFn(template.name));
  };
  $('saveTemplateBtn').addEventListener('click', save);
  $('templateName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });

  overlay.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const template = allTemplates().find((tpl) => tpl.id === button.closest('.template-row').dataset.id);
    if (!template) return;
    if (button.dataset.action === 'add') addTemplate(template);
    else if (await confirmDialog({ text: t().confirmDeleteTemplateFn(template.name), okLabel: t().deleteLabel, danger: true })) deleteTemplateDoc(template.id);
  });
}
