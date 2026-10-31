import { clone, emptyItem, emptyGroup, escapeHTML as e, photoImage } from './models.js';
import { loadItems, saveItems } from './storage.js';
import { validateItem } from './validation.js';
import { preparePhoto } from './photos.js';
import { inventoryView, inventoryResults, matchingItems } from './views/inventory.js';
import { detailView } from './views/detail.js';
import { editorView, editorPhotos, editorGroups } from './views/editor.js';
import { button, emptyState } from './views/shared.js';

const app = document.getElementById('app');
let { items, error: storageError } = loadItems();
let route = '';
let search = '';
let draft = null;
let originalDraft = '';
let photoBusy = false;
let historyIndex = 0;
let restoringHistory = false;
let acceptingBack = false;
let discardResolve = null;
let confirmationTimer;
const dirty = () => draft !== null && JSON.stringify(draft) !== originalDraft;
const editorRoute = value => value === 'add' || value.startsWith('edit/');

function shell(content) {
  return `<header class="app-header"><div class="header-inner"><div class="brand"><div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><rect x="6" y="5" width="20" height="23" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M11 12h10M11 17h10M11 22h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></div><div><span class="brand-name">Jewelry inventory</span><span class="brand-description">Digital inventory cards</span></div></div><span class="local-label">Saved in this browser</span></div></header>
    ${content}<footer class="app-footer"><p>Local prototype · No account, uploads or syncing</p><nav class="footer-links" aria-label="Footer"><a href="/privacy" data-external>Privacy</a><a href="/support" data-external>Support</a><a href="https://superapp.dev" target="_blank" rel="noopener noreferrer">Built with Superapp</a></nav></footer>
    <dialog id="discard-dialog" aria-labelledby="discard-title" aria-describedby="discard-description"><h2 id="discard-title">Discard unsaved changes?</h2><p id="discard-description">Your changes have not been saved. Keep editing to finish this item, or discard your changes to leave.</p><div class="dialog-actions">${button('Discard changes', 'discard', { className: 'danger-text' })}${button('Keep editing', 'keep-editing', { primary: true })}</div></dialog>`;
}
function readRoute() { return location.hash.slice(1) || 'inventory'; }
function recordFor(value) { return items.find(item => item.id === value.split('/')[1]); }
function render(target, confirmation = '') {
  clearTimeout(confirmationTimer);
  route = target;
  photoBusy = false;
  let content;
  if (storageError || target === 'inventory') {
    draft = null;
    content = inventoryView(items, search, storageError);
    document.title = 'Inventory · Jewelry inventory';
  } else if (editorRoute(target)) {
    const editing = target.startsWith('edit/');
    const existing = editing ? recordFor(target) : null;
    if (editing && !existing) return renderNotFound();
    draft = editing ? clone(existing) : emptyItem();
    originalDraft = JSON.stringify(draft);
    photoBusy = false;
    content = editorView(draft, editing);
    document.title = `${editing ? 'Edit' : 'Add'} item · Jewelry inventory`;
  } else if (target.startsWith('item/')) {
    draft = null;
    const item = recordFor(target);
    if (!item) return renderNotFound();
    content = detailView(item, confirmation);
    document.title = `${item.inventory} · Jewelry inventory`;
  } else return renderNotFound();
  app.innerHTML = shell(content);
  wireDialog();
  window.scrollTo(0, 0);
  if (confirmation) confirmationTimer = setTimeout(() => document.querySelector('.save-confirmation')?.remove(), 6500);
}
function renderNotFound() {
  draft = null;
  app.innerHTML = shell(`<main class="page" id="main" tabindex="-1">${emptyState('Item not found', 'This item is not in the inventory saved in this browser.', button('Back to inventory', 'inventory', { primary: true }))}</main>`);
  wireDialog();
}
function requestDiscard() {
  if (!dirty() && !photoBusy) return Promise.resolve(true);
  if (discardResolve) return Promise.resolve(false);
  return new Promise(resolve => {
    discardResolve = resolve;
    document.getElementById('discard-dialog').showModal();
    document.querySelector('[data-action="keep-editing"]').focus();
  });
}
function settleDiscard(discard) {
  document.getElementById('discard-dialog').close();
  const resolve = discardResolve;
  discardResolve = null;
  resolve?.(discard);
}
function wireDialog() {
  document.getElementById('discard-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    settleDiscard(false);
  });
}
async function navigate(target, confirmation = '', saved = false) {
  if (!saved && !await requestDiscard()) return;
  historyIndex += 1;
  history.pushState({ jewelIndex: historyIndex }, '', `#${target}`);
  render(target, confirmation);
  document.getElementById('main')?.focus({ preventScroll: true });
}
window.addEventListener('popstate', async event => {
  if (restoringHistory) { restoringHistory = false; return; }
  const target = readRoute();
  const targetIndex = event.state?.jewelIndex;
  if (dirty() || photoBusy) {
    if (acceptingBack) acceptingBack = false;
    else if (Number.isInteger(targetIndex)) {
      const distance = targetIndex - historyIndex;
      restoringHistory = true;
      history.go(-distance);
      const discard = await requestDiscard();
      if (discard) { acceptingBack = true; history.go(distance); }
      return;
    } else {
      history.replaceState({ jewelIndex: historyIndex }, '', `#${route}`);
      if (await requestDiscard()) navigate(target, '', true);
      return;
    }
  }
  historyIndex = Number.isInteger(targetIndex) ? targetIndex : historyIndex + 1;
  history.replaceState({ jewelIndex: historyIndex }, '', `#${target}`);
  render(target);
  document.getElementById('main')?.focus({ preventScroll: true });
});
window.addEventListener('beforeunload', event => {
  if (dirty() || photoBusy) { event.preventDefault(); event.returnValue = ''; }
});

app.addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'inventory-search') { search = input.value; updateSearch(); return; }
  if (!draft || !input.name) return;
  if (input.name.includes(':')) {
    const [id, key] = input.name.split(':');
    const group = draft.groups.find(value => value.id === id);
    if (group) group[key] = input.value;
  } else draft[input.name] = input.value;
  input.removeAttribute('aria-invalid');
  const error = document.getElementById(`${input.id}-error`);
  if (error) error.hidden = true;
});
function updateSearch() {
  document.getElementById('inventory-results').innerHTML = inventoryResults(items, search);
  const count = matchingItems(items, search).length;
  document.getElementById('result-count').textContent = `${count} ${count === 1 ? 'item' : 'items'}${search.trim() ? ' found' : ' in inventory'}`;
  document.querySelector('.search-clear').hidden = !search;
}
app.addEventListener('click', async event => {
  const externalLink = event.target.closest('a[data-external]');
  if (externalLink) {
    event.preventDefault();
    if (await requestDiscard()) { draft = null; photoBusy = false; location.href = externalLink.href; }
    return;
  }
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;
  const id = control.dataset.id;
  if (action === 'keep-editing' || action === 'discard') { settleDiscard(action === 'discard'); return; }
  if (action === 'inventory') return navigate('inventory');
  if (action === 'add') return navigate('add');
  if (action === 'view') return navigate(`item/${id}`);
  if (action === 'edit') return navigate(`edit/${id}`);
  if (action === 'reload') { ({ items, error: storageError } = loadItems()); render('inventory'); return; }
  if (action === 'clear-search') { search = ''; document.getElementById('inventory-search').value = ''; updateSearch(); document.getElementById('inventory-search').focus(); return; }
  if (action === 'select-photo') {
    const photo = recordFor(route)?.photos.find(value => value.id === id);
    if (photo) {
      document.getElementById('large-photo').innerHTML = photoImage(photo, 'detail-photo');
      document.querySelectorAll('.photo-thumb').forEach(thumb => { const selected = thumb.dataset.id === id; thumb.classList.toggle('selected', selected); thumb.setAttribute('aria-pressed', String(selected)); });
    }
    return;
  }
  if (!draft) return;
  if (action === 'cancel') return navigate(route.startsWith('edit/') ? `item/${draft.id}` : 'inventory');
  if (action === 'clear-date') {
    for (const key of ['month', 'year']) { draft[key] = ''; document.getElementById(key).value = ''; document.getElementById(`${key}-error`).hidden = true; document.getElementById(key).removeAttribute('aria-invalid'); }
  }
  if (action === 'add-group') {
    const group = emptyGroup(); draft.groups.push(group); refreshGroups(); document.getElementById(`group-${group.id}-type`).focus();
  }
  if (action === 'remove-group') {
    draft.groups = draft.groups.filter(group => group.id !== id); refreshGroups(); document.querySelector('[data-action="add-group"]').focus({ preventScroll: true });
  }
  if (action === 'make-cover') {
    const photo = draft.photos.find(value => value.id === id);
    if (photo) draft.photos = [photo, ...draft.photos.filter(value => value.id !== id)];
    refreshPhotos(); document.querySelector('[data-action="remove-photo"]')?.focus({ preventScroll: true });
  }
  if (action === 'remove-photo') { draft.photos = draft.photos.filter(value => value.id !== id); refreshPhotos(); document.getElementById('photo-input').focus({ preventScroll: true }); }
});
function refreshGroups() { document.getElementById('editor-groups').innerHTML = editorGroups(draft); }
function refreshPhotos() { document.getElementById('editor-photos').innerHTML = editorPhotos(draft); }
app.addEventListener('change', async event => {
  if (event.target.id !== 'photo-input' || !draft) return;
  const files = [...event.target.files];
  event.target.value = '';
  if (!files.length) return;
  const currentDraft = draft;
  const photoError = document.getElementById('photo-error');
  const progress = document.getElementById('photo-progress');
  photoError.hidden = true;
  photoBusy = true;
  const submit = document.querySelector('[type="submit"]');
  submit.disabled = true;
  event.target.disabled = true;
  const failures = [];
  for (const [index, file] of files.entries()) {
    if (draft !== currentDraft) break;
    progress.textContent = `Preparing photo ${index + 1} of ${files.length}…`;
    try {
      const photo = await preparePhoto(file);
      if (draft === currentDraft) { draft.photos.push(photo); refreshPhotos(); }
    } catch (error) { failures.push(error.message); }
  }
  if (draft !== currentDraft) return;
  photoBusy = false;
  submit.disabled = false;
  event.target.disabled = false;
  progress.textContent = failures.length ? '' : `${files.length} ${files.length === 1 ? 'photo' : 'photos'} added to this draft.`;
  if (failures.length) { photoError.textContent = failures.join(' '); photoError.hidden = false; }
});
app.addEventListener('submit', event => {
  if (event.target.id !== 'item-form') return;
  event.preventDefault();
  if (!draft || photoBusy) return;
  document.querySelectorAll('.field-error').forEach(element => { if (element.id !== 'photo-error') element.hidden = true; });
  document.querySelectorAll('[aria-invalid]').forEach(element => element.removeAttribute('aria-invalid'));
  const { item, errors } = validateItem(draft, items);
  const notice = document.getElementById('form-error');
  const entries = Object.entries(errors);
  if (entries.length) {
    notice.textContent = `Please check ${entries.length === 1 ? 'the highlighted field' : `the ${entries.length} highlighted fields`} below. Your changes have not been saved.`;
    notice.hidden = false;
    for (const [key, message] of entries) {
      const input = document.getElementById(key);
      const label = document.getElementById(`${key}-error`);
      if (input && label) { input.setAttribute('aria-invalid', 'true'); label.textContent = message; label.hidden = false; }
    }
    document.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  const updated = items.some(value => value.id === item.id) ? items.map(value => value.id === item.id ? item : value) : [...items, item];
  try {
    saveItems(updated);
    items = updated;
    navigate(`item/${item.id}`, 'Item saved.', true);
  } catch (error) { notice.textContent = error.message; notice.hidden = false; notice.scrollIntoView({ block: 'center', behavior: 'auto' }); }
});
history.replaceState({ jewelIndex: historyIndex }, '', `#${readRoute()}`);
render(readRoute());
