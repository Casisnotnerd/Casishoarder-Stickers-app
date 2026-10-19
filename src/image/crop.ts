import type { Rect } from './geometry';

export const PHOTO = { maxSide: 1600, quality: 0.85 };
export const THUMB = { maxSide: 400, quality: 0.7 };

export async function loadImage(file: File | Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export async function cropToJpeg(img: ImageBitmap, rect: Rect, maxSide: number, quality: number): Promise<Blob> {
  const { w, h } = fitWithinRect(rect.w, rect.h, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality);
  });
}

function fitWithinRect(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const scale = max / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}