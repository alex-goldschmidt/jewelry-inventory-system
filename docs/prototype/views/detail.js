import { escapeHTML as e, textValue, money, carats, manufacture, statusBadge, photoImage } from '../models.js';
import { button, cover, financialRow } from './shared.js';

export function detailView(item, confirmation = '') {
  return `<main id="main" class="page detail-page" tabindex="-1">
    <div class="back-row">${button('<span aria-hidden="true">←</span> Back to inventory', 'inventory', { className: 'text-button back-button' })}<span class="eyebrow">INVENTORY CARD</span></div>
    ${confirmation ? `<div class="save-confirmation" role="status"><span aria-hidden="true">✓</span> ${e(confirmation)}</div>` : ''}
    <div class="page-heading detail-heading"><div><h1>${e(item.inventory)}</h1><div class="detail-subtitle"><span>Style number <strong>${textValue(item.style)}</strong></span>${statusBadge(item.status)}</div>${item.fictional ? '<p class="fictional-note">Fictional sample item — editable demonstration data.</p>' : ''}</div>${button('Edit item', 'edit', { primary: true, data: `data-id="${e(item.id)}"` })}</div>
    <div class="detail-layout"><section class="photo-section" aria-label="Item photographs"><div id="large-photo" class="large-photo">${cover(item, true)}</div>${photoThumbnails(item)}${item.status === 'Unknown' ? '<p class="photo-caption">Status is unknown; it has not been confirmed.</p>' : ''}</section>
    <section class="item-card" aria-label="Item information and pricing"><div class="retail-block"><span class="row-label">Retail selling price</span><p class="retail-price">${money(item.retail)}</p></div>
    <dl class="material-summary"><div><dt>Main material</dt><dd>${textValue(item.material)}</dd></div><div><dt>Manufacture month/year</dt><dd>${manufacture(item)}</dd></div></dl>
    <div class="financial-section"><h2>Costs &amp; valuation</h2>${financialRow('Material cost', item.materialCost, item.materialCode)}${financialRow('Recorded production cost', item.productionCost, item.productionCode)}<div class="financial-row insurance-row"><div><span class="row-label">Insurance value</span><strong>${money(item.insurance)}</strong></div></div></div></section></div>
    <section class="gemstone-section" aria-labelledby="gemstone-heading"><div class="section-heading"><h2 id="gemstone-heading">Gemstone groups</h2><span class="section-count">${item.groups.length} ${item.groups.length === 1 ? 'group' : 'groups'}</span></div>${item.groups.length ? `<div class="gemstone-grid">${item.groups.map(gemstoneCard).join('')}</div>` : '<p class="not-provided empty-groups">No gemstone groups provided.</p>'}</section>
  </main>`;
}
function photoThumbnails(item) {
  if (item.photos.length < 2) return '';
  return `<div class="photo-thumbnails">${item.photos.map((photo, index) => `<button type="button" data-action="select-photo" data-id="${e(photo.id)}" class="photo-thumb ${index === 0 ? 'selected' : ''}" aria-pressed="${index === 0}">${photoImage(photo, '', `Photograph ${index + 1} of ${item.inventory}`)}<span>${index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</span></button>`).join('')}</div>`;
}
function gemstoneCard(group, index) {
  return `<article class="gemstone-card"><div class="gemstone-title"><span class="group-index">${String(index + 1).padStart(2, '0')}</span><h3>${group.type ? e(group.type) : 'Type not provided'}</h3></div><dl class="gemstone-summary"><div><dt>Quantity</dt><dd>${textValue(group.quantity)}</dd></div><div><dt>Total carats</dt><dd>${carats(group.carats)}</dd></div></dl><p class="field-help carat-help">Combined weight of all stones in this group.</p>${financialRow('Purchase rate', group.purchaseRate, group.purchaseCode, true)}${financialRow('Selling rate', group.sellingRate, group.sellingCode, true)}</article>`;
}
