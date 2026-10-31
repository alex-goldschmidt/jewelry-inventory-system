import { clone, MATERIALS, STATUSES } from './models.js';

const decimalPattern = /^\d+(?:\.\d+)?$/;
function normalizeDecimal(value) {
  const [whole, fraction] = value.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  return fraction === undefined ? normalizedWhole : `${normalizedWhole}.${fraction}`;
}
function numeric(value, key, errors, { integer = false, maxDecimals = 2 } = {}) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!decimalPattern.test(trimmed)) {
    errors[key] = integer ? 'Enter a positive whole number, such as 3.' : 'Enter a number of zero or more, without a dollar sign or commas.';
    return trimmed;
  }
  const [whole, fraction = ''] = trimmed.split('.');
  if (integer && (fraction.length > 0 || Number(trimmed) < 1)) errors[key] = 'Enter a positive whole number, such as 3.';
  else if (whole.replace(/^0+/, '').length > 12) errors[key] = 'Use no more than 12 digits before the decimal point.';
  else if (fraction.length > maxDecimals) errors[key] = `Use no more than ${maxDecimals} decimal places.`;
  return normalizeDecimal(trimmed);
}
export function validateItem(draft, items) {
  const item = clone(draft);
  const errors = {};
  for (const key of ['inventory', 'style', 'materialCode', 'productionCode']) item[key] = item[key].trim();
  if (!item.inventory) errors.inventory = 'Enter an inventory number.';
  else if (items.some(other => other.id !== item.id && other.inventory.trim().toLowerCase() === item.inventory.toLowerCase())) errors.inventory = 'This inventory number is already in use. Give each piece its own number.';
  if (!MATERIALS.includes(item.material)) errors.material = 'Choose the main material.';
  if (!STATUSES.includes(item.status)) errors.status = 'Choose Unknown, Available, or Sold.';
  item.year = String(item.year).trim();
  if ((item.month && !item.year) || (!item.month && item.year)) errors.year = 'Provide both month and year, or clear the date.';
  else if (item.year && (!/^\d{4}$/.test(item.year) || Number(item.year) < 1000 || Number(item.year) > 9999)) errors.year = 'Enter a four-digit year, such as 2026.';
  if (item.month && !/^(?:[1-9]|1[0-2])$/.test(item.month)) errors.month = 'Choose a month.';
  for (const key of ['materialCost', 'productionCost', 'retail', 'insurance']) item[key] = numeric(item[key], key, errors);
  item.groups.forEach(group => {
    for (const key of ['type', 'purchaseCode', 'sellingCode']) group[key] = group[key].trim();
    const prefix = `group-${group.id}-`;
    group.quantity = numeric(group.quantity, `${prefix}quantity`, errors, { integer: true, maxDecimals: 0 });
    group.carats = numeric(group.carats, `${prefix}carats`, errors, { maxDecimals: 6 });
    group.purchaseRate = numeric(group.purchaseRate, `${prefix}purchaseRate`, errors);
    group.sellingRate = numeric(group.sellingRate, `${prefix}sellingRate`, errors);
  });
  return { item, errors };
}
