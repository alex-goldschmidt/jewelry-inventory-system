import { escapeHTML as e, MATERIALS, GEMSTONES, MONTHS, STATUSES, photoImage } from '../models.js';
import { button, field, financialFields } from './shared.js';

export function editorView(item, editing) {
  return `<main id="main" class="page editor-page" tabindex="-1"><div class="page-heading"><div><p class="eyebrow">${editing ? 'UPDATE INVENTORY CARD' : 'NEW INVENTORY CARD'}</p><h1>${editing ? 'Edit item' : 'Add item'}</h1><p class="intro">${editing ? `Update the details for ${e(item.inventory)}.` : 'Give each physical piece its own inventory card.'}</p></div>${button('Cancel', 'cancel')}</div>
  <div class="form-guide"><strong>Only inventory number and main material are required.</strong><span>Leave anything you don’t know blank. Amounts are in dollars.</span></div>
  <form id="item-form" novalidate><p id="form-error" class="notice error-notice" role="alert" hidden></p>
  ${itemInformation(item)}${photographs(item)}${materialSection(item)}${gemstoneSection(item)}${pricingSection(item)}
  <div class="form-actions"><p>Changes are saved only when you select “Save item.”</p><div>${button('Cancel', 'cancel')}${button('Save item', '', { primary: true, submit: true })}</div></div></form></main>`;
}
function sectionTitle(number, title, subtitle = '') {
  return `<div class="form-section-title"><span class="section-number" aria-hidden="true">${number}</span><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div></div>`;
}
function itemInformation(item) {
  return `<section class="form-section" aria-label="Item information">${sectionTitle('01', 'Item information')}
    <div class="fields-grid">${field('Inventory number', 'inventory', item.inventory, { required: true })}${field('Style number', 'style', item.style, { help: 'More than one piece can share a style number.' })}${field('Status', 'status', item.status, { options: STATUSES })}<div class="date-fields"><div class="date-pair">${field('Manufacture month', 'month', item.month, { options: [['', 'Not provided'], ...MONTHS.map((month, index) => [String(index + 1), month])] })}${field('Manufacture year', 'year', item.year, { numeric: true, integer: true, maxlength: 4 })}</div>${button('Clear date', 'clear-date', { className: 'text-button' })}</div></div>
  </section>`;
}
function photographs(item) {
  return `<section class="form-section" aria-label="Photographs">${sectionTitle('02', 'Photographs', 'The cover photo is shown in the inventory list.')}<div id="editor-photos">${editorPhotos(item)}</div><div class="photo-upload"><label class="button" for="photo-input"><span aria-hidden="true">＋</span> Add photos</label><input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp" multiple class="sr-only"><p>JPEG, PNG or WebP. Smaller copies are saved in this browser.</p></div><p id="photo-error" class="field-error" role="alert" hidden></p><p id="photo-progress" class="field-help" role="status"></p></section>`;
}
export function editorPhotos(item) {
  if (!item.photos.length) return '<div class="no-photos"><strong>No photos added</strong><span>You can add photos now or later.</span></div>';
  return `<div class="editor-photo-grid">${item.photos.map((photo, index) => `<div class="editor-photo">${photoImage(photo)}<p class="photo-name" title="${e(photo.name)}">${e(photo.name)}</p><div class="photo-controls">${index === 0 ? '<span class="cover-label">✓ Cover photo</span>' : button('Make cover', 'make-cover', { data: `data-id="${e(photo.id)}"` })}${button('Remove photo', 'remove-photo', { className: 'text-button danger-text', data: `data-id="${e(photo.id)}" aria-label="Remove photo ${index + 1}"` })}</div></div>`).join('')}</div>`;
}
function materialSection(item) {
  return `<section class="form-section" aria-label="Material and material cost">${sectionTitle('03', 'Material and material cost')}<div class="fields-grid"><div>${field('Main material', 'material', item.material, { required: true, options: [['', 'Choose main material'], ...MATERIALS] })}<p class="field-help">Local lookup choices for this prototype.</p></div>${financialFields('Material cost ($)', 'materialCost', item.materialCost, 'Material cost code', 'materialCode', item.materialCode)}</div></section>`;
}
function gemstoneSection(item) {
  return `<section class="form-section" aria-label="Gemstone groups">${sectionTitle('04', 'Gemstone groups', 'Keep stones of the same type together in one group.')}<div id="editor-groups">${editorGroups(item)}</div>${button('<span aria-hidden="true">＋</span> Add gemstone group', 'add-group')}</section>`;
}
export function editorGroups(item) {
  if (!item.groups.length) return '<p class="no-groups">No gemstone groups added. This section is optional.</p>';
  return item.groups.map((group, index) => `<div class="editor-group"><div class="editor-group-heading"><h3>Group ${index + 1}</h3>${button('Remove group', 'remove-group', { className: 'text-button danger-text', data: `data-id="${e(group.id)}" aria-label="Remove gemstone group ${index + 1}"` })}</div><div class="fields-grid group-fields">
  ${field('Gemstone type', 'type', group.type, { scope: group.id, options: [['', 'Not provided'], ...GEMSTONES, ...(!GEMSTONES.includes(group.type) && group.type ? [group.type] : [])] })}<div class="quantity-carats">${field('Quantity', 'quantity', group.quantity, { scope: group.id, numeric: true, integer: true })}${field('Total carats', 'carats', group.carats, { scope: group.id, numeric: true, help: 'Combined weight of all stones in this group.' })}</div>
  ${financialFields('Purchase rate per carat ($)', 'purchaseRate', group.purchaseRate, 'Purchase rate code', 'purchaseCode', group.purchaseCode, group.id)}${financialFields('Selling rate per carat ($)', 'sellingRate', group.sellingRate, 'Selling rate code', 'sellingCode', group.sellingCode, group.id)}</div></div>`).join('');
}
function pricingSection(item) {
  return `<section class="form-section" aria-label="Pricing and valuation">${sectionTitle('05', 'Pricing and valuation')}<div class="fields-grid">${financialFields('Recorded production cost ($)', 'productionCost', item.productionCost, 'Production cost code', 'productionCode', item.productionCode)}<div class="pricing-help">Enter the recorded cost directly. This field is not calculated.</div>${field('Retail selling price ($)', 'retail', item.retail, { numeric: true })}${field('Insurance value ($)', 'insurance', item.insurance, { numeric: true, help: 'Enter independently from the retail selling price.' })}</div></section>`;
}
