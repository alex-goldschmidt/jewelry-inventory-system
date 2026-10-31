import { escapeHTML as e, money, textValue, photoImage, photoPlaceholder } from '../models.js';

export function button(label, action, options = {}) {
  return `<button type="${options.submit ? 'submit' : 'button'}" class="button ${options.primary ? 'primary' : ''} ${options.className || ''}" ${action ? `data-action="${action}"` : ''} ${options.data || ''}>${label}</button>`;
}
export function field(label, key, value, { options, help, required = false, numeric = false, integer = false, maxlength = 100, scope = '' } = {}) {
  const id = e(scope ? `group-${scope}-${key}` : key);
  const name = e(scope ? `${scope}:${key}` : key);
  const descriptions = `${help ? `${id}-help ` : ''}${id}-error`;
  const input = options ? `<select id="${id}" name="${name}" ${required ? 'aria-required="true"' : ''} aria-describedby="${descriptions}">${options.map(option => {
    const [optionValue, text] = Array.isArray(option) ? option : [option, option];
    return `<option value="${e(optionValue)}" ${String(value) === String(optionValue) ? 'selected' : ''}>${e(text)}</option>`;
  }).join('')}</select>` : `<input id="${id}" name="${name}" value="${e(value)}" ${numeric ? `inputmode="${integer ? 'numeric' : 'decimal'}"` : ''} maxlength="${maxlength}" ${required ? 'aria-required="true"' : ''} aria-describedby="${descriptions}" autocomplete="off">`;
  return `<div class="field"><label for="${id}">${label}${required ? ' <span class="required-label">Required</span>' : ''}</label>${input}${help ? `<p class="field-help" id="${id}-help">${help}</p>` : ''}<p class="field-error" id="${id}-error" hidden></p></div>`;
}
export function financialFields(amountLabel, amountKey, amount, codeLabel, codeKey, code, scope = '') {
  return `<div class="amount-code-pair">${field(amountLabel, amountKey, amount, { numeric: true, scope })}${field(codeLabel, codeKey, code, { scope })}</div>`;
}
export function financialRow(label, amount, code, perCarat = false) {
  return `<div class="financial-row"><div><span class="row-label">${label}</span><strong>${money(amount)}${perCarat && amount !== '' ? '<small> / carat</small>' : ''}</strong></div><div class="code-value"><span class="row-label">Code</span><span>${textValue(code)}</span></div></div>`;
}
export function cover(item, large = false) {
  return item.photos.length ? photoImage(item.photos[0], large ? 'detail-photo' : 'inventory-photo', `Photograph of ${item.inventory}`) : photoPlaceholder(large);
}
export function emptyState(title, description, action) {
  return `<div class="empty-state"><h2>${title}</h2><p>${description}</p>${action || ''}</div>`;
}
