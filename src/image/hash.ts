export async function computeImageHash(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const size = 9;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, size, 8);
  const data = ctx.getImageData(0, 0, size, 8).data;
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
  }
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = gray[y * size + x];
      const right = gray[y * size + x + 1];
      bits += left > right ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    dist += [0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4][x];
  }
  return dist;
}