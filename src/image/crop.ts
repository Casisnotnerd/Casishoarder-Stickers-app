import { fitWithin, type Rect } from './geometry';

export async function loadImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export async function cropToJpeg(img: ImageBitmap, rect: Rect, maxSide: number, quality: number): Promise<Blob> {
  const { w, h } = fitWithin(rect.w, rect.h, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available.');
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo.'))), 'image/jpeg', quality),
  );
}

/** Full photo ≈ 1600 px long side (target ~0.3 MB); thumbnail 400 px. */
export const PHOTO = { maxSide: 1600, quality: 0.82 };
export const THUMB = { maxSide: 400, quality: 0.75 };

/** Shrinks a picture (e.g. a 12-megapixel phone photo) so its long side is at most `maxSide`. */
export async function resizeImage(file: Blob, maxSide = 600): Promise<Blob> {
  const img = await loadImage(file);
  return cropToJpeg(img, { x: 0, y: 0, w: img.width, h: img.height }, maxSide, 0.85);
}
