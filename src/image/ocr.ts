import { createWorker } from 'tesseract.js';

export async function runOcr(blob: Blob): Promise<string> {
  const worker = await createWorker('eng+kor');
  try {
    const { data } = await worker.recognize(blob);
    return (data.text ?? '').trim();
  } finally {
    await worker.terminate();
  }
}