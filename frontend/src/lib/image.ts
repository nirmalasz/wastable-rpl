const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1600;

/**
 * Validates a picked or captured photo and re-encodes it as a web-friendly JPEG. Re-encoding
 * drops EXIF metadata, which often contains the GPS position the photo was taken at.
 * Throws an Error with a message that is safe to show to the user.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Please choose a JPG, PNG or WebP photo.');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That photo could not be opened. Try a different one.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob || blob.size > MAX_BYTES) {
    throw new Error('That photo is too large. Please choose a smaller one (up to 5 MB).');
  }
  return blob;
}
