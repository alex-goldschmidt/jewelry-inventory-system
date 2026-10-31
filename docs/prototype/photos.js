import { newId } from './models.js';

export async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error(`“${file.name}” could not be added. Choose a JPEG, PNG, or WebP image. For HEIC photos, export a JPEG from Photos first.`);
  }
  if (file.size > 20 * 1024 * 1024) throw new Error(`“${file.name}” is too large. Choose a photo smaller than 20 MB.`);
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const loaded = new Image();
      loaded.onload = () => resolve(loaded);
      loaded.onerror = () => reject(new Error(`“${file.name}” could not be opened. Try another image.`));
      loaded.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the photo. Try again in Safari or Chrome.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.76);
    if (data.length > 900000) throw new Error(`“${file.name}” is too detailed for prototype storage. Choose a smaller photo.`);
    return { id: newId(), name: file.name, data };
  } finally {
    URL.revokeObjectURL(url);
  }
}
