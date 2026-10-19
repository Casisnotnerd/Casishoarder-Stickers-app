import { createWorker } from 'tesseract.js';

export async function preprocessImage(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const minW = 1200;
  const scale = bmp.width < minW ? minW / bmp.width : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

export async function runOcr(blob: Blob): Promise<string> {
  const processed = await preprocessImage(blob);
  const worker = await createWorker('eng+kor');
  try {
    const { data } = await worker.recognize(processed);
    return (data.text ?? '').trim();
  } finally {
    await worker.terminate();
  }
}