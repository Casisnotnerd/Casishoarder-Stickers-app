import { PaddleOcrService, V5_MOBILE_MODEL } from 'ppu-paddle-ocr/web';

export interface OcrReader {
  read(blob: Blob): Promise<string>;
  close(): Promise<void>;
}

/** Loads the text reader once so many sheets can be read in a row (bulk add). */
export async function createOcrReader(): Promise<OcrReader> {
  const service = new PaddleOcrService({ model: V5_MOBILE_MODEL });
  await service.initialize();
  return {
    async read(blob: Blob) {
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const result = await service.recognize(canvas, { minimumConfidence: 0.5 });
      const items = (result.lines ?? []).flat().filter((r) => r.confidence >= 0.5);
      items.sort((a, b) => (a.box?.y ?? 0) - (b.box?.y ?? 0) || (a.box?.x ?? 0) - (b.box?.x ?? 0));
      return items.map((r) => r.text).join('\n').trim();
    },
    close: () => service.destroy(),
  };
}

export async function runOcr(blob: Blob): Promise<string> {
  const reader = await createOcrReader();
  try {
    return await reader.read(blob);
  } finally {
    await reader.close();
  }
}
