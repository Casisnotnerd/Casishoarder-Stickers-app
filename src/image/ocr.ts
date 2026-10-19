import { createWorker } from 'tesseract.js';

export async function preprocessImage(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const minW = 1000;
  const scale = bmp.width < minW ? minW / bmp.width : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  // grayscale + contrast stretch
  let min = 255, max = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const g = Math.round(0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < img.data.length; i += 4) {
    const g = Math.round(((img.data[i] - min) / range) * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

export async function runOcr(blob: Blob): Promise<string> {
  const processed = await preprocessImage(blob);
  const worker = await createWorker('eng+kor');
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' } as any);
    const { data } = await worker.recognize(processed);
    return (data.text ?? '').trim();
  } finally {
    await worker.terminate();
  }
}