import { escapeHTML as e, money, textValue, statusBadge } from '../models.js';
import { button, cover, emptyState } from './shared.js';

export function matchingItems(items, search) {
  const query = search.trim().toLowerCase();
  return items.filter(item => item.inventory.toLowerCase().includes(query) || item.style.toLowerCase().includes(query));
}
export function inventoryResults(items, search) {
  const matches = matchingItems(items, search);
  if (!matches.length) return emptyState(search.trim() ? 'No matching items' : 'Your inventory is ready for its first piece', search.trim() ? 'Try another inventory or style number, or clear your search.' : 'Add an item to start your digital inventory.', button(search.trim() ? 'Clear search' : 'Add item', search.trim() ? 'clear-search' : 'add', { primary: true }));
  return `<div class="inventory-table" role="table" aria-label="Jewelry inventory"><div class="list-head" role="row"><span role="columnheader">Photograph</span><span role="columnheader">Inventory number</span><span role="columnheader">Style number</span><span role="columnheader">Retail selling price</span><span role="columnheader">Status</span><span role="columnheader" class="sr-only">Open item</span></div>${matches.map(item => `<div class="inventory-row" role="row">
    <div class="thumbnail" role="cell">${cover(item)}</div>
    <div class="inventory-number" role="cell"><span class="mobile-label">Inventory number</span><strong>${e(item.inventory)}</strong>${item.fictional ? '<span class="sample-label">Fictional sample</span>' : ''}</div>
    <div class="style-cell" role="cell"><span class="mobile-label">Style number</span>${textValue(item.style)}</div>
    <div class="price-cell" role="cell"><span class="mobile-label">Retail selling price</span><strong>${money(item.retail)}</strong></div>
    <div class="status-cell" role="cell"><span class="mobile-label">Status</span>${statusBadge(item.status)}</div>
    <div class="view-cell" role="cell">${button('View item <span aria-hidden="true">→</span>', 'view', { data: `data-id="${e(item.id)}" aria-label="View item ${e(item.inventory)}"` })}</div>
  </div>`).join('')}</div>`;
}
export function inventoryView(items, search, error) {
  const count = matchingItems(items, search).length;
  return `<main id="main" class="page inventory-page" tabindex="-1">
    <div class="page-heading"><div><p class="eyebrow">YOUR COLLECTION</p><h1>Inventory</h1><p class="intro">Find a piece. Keep every detail together.</p></div>${error ? '' : button('<span aria-hidden="true">＋</span> Add item', 'add', { primary: true })}</div>
    ${error ? `<div class="notice error-notice" role="alert"><h2>Saved inventory is unavailable</h2><p>${e(error)}</p>${button('Try again', 'reload')}</div>` : `
    <div class="search-area"><label for="inventory-search">Search inventory or style number</label><div class="search-control"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.8"/></svg><input type="search" id="inventory-search" value="${e(search)}" autocomplete="off" placeholder="For example, D2439 or IR 891">${button('Clear search', 'clear-search', { className: 'text-button search-clear', data: search ? '' : 'hidden' })}</div></div>
    <div class="list-summary"><p id="result-count" aria-live="polite">${count} ${count === 1 ? 'item' : 'items'}${search.trim() ? ' found' : ' in inventory'}</p><p>One record for each piece</p></div>
    <section id="inventory-results" aria-label="Inventory results">${inventoryResults(items, search)}</section>
    <p class="sample-note">D2439 uses your supplied details. Items labeled “Fictional sample” are examples only.</p>`}
  </main>`;
}
