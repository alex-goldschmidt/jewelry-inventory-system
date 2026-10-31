import { clone } from './models.js';
import { sampleData } from './sample-data.js';

export const STORAGE_KEY = 'jewelry-inventory-prototype-v1';
function validNumeric(value) {
  return typeof value === 'string' && (value === '' || /^\d{1,12}(\.\d{1,6})?$/.test(value));
}
function validPhoto(photo) {
  return photo && typeof photo.id === 'string' && typeof photo.name === 'string' && typeof photo.data === 'string'
    && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.data);
}
function validGroup(group) {
  return group && ['id', 'type', 'purchaseCode', 'sellingCode'].every(key => typeof group[key] === 'string')
    && ['quantity', 'carats', 'purchaseRate', 'sellingRate'].every(key => validNumeric(group[key]));
}
function validItem(item) {
  const textKeys = ['id', 'inventory', 'style', 'material', 'month', 'year', 'materialCode', 'productionCode'];
  return item && textKeys.every(key => typeof item[key] === 'string') && ['Unknown', 'Available', 'Sold'].includes(item.status)
    && ['materialCost', 'productionCost', 'retail', 'insurance'].every(key => validNumeric(item[key]))
    && Array.isArray(item.photos) && item.photos.every(validPhoto) && Array.isArray(item.groups) && item.groups.every(validGroup);
}
export function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const items = clone(sampleData);
      saveItems(items);
      return { items, error: null };
    }
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !Array.isArray(saved.items) || !saved.items.every(validItem)) throw new Error('unreadable');
    return { items: saved.items, error: null };
  } catch {
    return { items: [], error: 'Your saved inventory could not be opened. Nothing has been overwritten. Check that this browser allows local storage, or return to the browser profile you used before.' };
  }
}
export function saveItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
  } catch {
    throw new Error('This browser could not save the item. Your draft is still here. Browser storage may be full or unavailable. Try removing a few photos, or allow site storage, then save again.');
  }
}
