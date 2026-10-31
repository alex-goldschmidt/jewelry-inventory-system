export const MATERIALS = ['Gold', 'Silver', 'Platinum', 'Palladium', 'Stainless steel', 'Other'];
export const GEMSTONES = ['Emerald', 'Diamond', 'Ruby', 'Sapphire', 'Pearl', 'Amethyst', 'Topaz', 'Other'];
export const STATUSES = ['Unknown', 'Available', 'Sold'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const newId = () => crypto.randomUUID();
export const clone = value => JSON.parse(JSON.stringify(value));
export function emptyGroup() {
  return { id: newId(), type: '', quantity: '', carats: '', purchaseRate: '', purchaseCode: '', sellingRate: '', sellingCode: '' };
}
export function emptyItem() {
  return { id: newId(), inventory: '', style: '', status: 'Unknown', material: '', month: '', year: '', materialCost: '', materialCode: '', productionCost: '', productionCode: '', retail: '', insurance: '', photos: [], groups: [], fictional: false };
}
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
export const provided = value => value !== '' && value !== null && value !== undefined;
export const textValue = value => provided(value) ? escapeHTML(value) : '<span class="not-provided">Not provided</span>';
export function money(value) {
  if (!provided(value)) return '<span class="not-provided">Not provided</span>';
  const [whole, decimal] = String(value).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return escapeHTML(`$${grouped}${decimal ? `.${decimal.padEnd(2, '0')}` : ''}`);
}
export function carats(value) {
  if (!provided(value)) return '<span class="not-provided">Not provided</span>';
  const [whole, decimal = ''] = String(value).split('.');
  return escapeHTML(`${whole}.${decimal.padEnd(3, '0')}`);
}
export function manufacture(item) {
  if (!item.month || !item.year) return '<span class="not-provided">Not provided</span>';
  return `${MONTHS[Number(item.month) - 1]} ${escapeHTML(item.year)}`;
}
export function statusBadge(status) {
  return `<span class="status status-${status.toLowerCase()}"><span aria-hidden="true" class="status-dot"></span>${status}</span>`;
}
export function photoPlaceholder(large = false) {
  return `<div class="photo-placeholder ${large ? 'large' : ''}"><svg aria-hidden="true" viewBox="0 0 48 48" fill="none"><rect x="8" y="10" width="32" height="28" rx="4" stroke="currentColor" stroke-width="1.5"/><circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="1.5"/><path d="m9 33 10-9 7 6 6-5 8 9" stroke="currentColor" stroke-width="1.5"/></svg><span>${large ? 'No photo provided' : 'No photo'}</span>${large ? '<small>Add a photograph when you edit this item.</small>' : ''}</div>`;
}
export function photoImage(photo, className = '', alt = '') {
  return `<img class="${className}" src="${escapeHTML(photo.data)}" alt="${escapeHTML(alt || photo.name || 'Item photograph')}">`;
}
