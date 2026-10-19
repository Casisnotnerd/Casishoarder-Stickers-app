import { useEffect, useRef } from 'react';
import type { Rect } from '../image/geometry';

export function CropBox({ src, naturalW, naturalH, value, onChange }: {
  src: string; naturalW: number; naturalH: number; value: Rect; onChange: (r: Rect) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ sx: number; sy: number; start: Rect } | null>(null);

  const toImg = (clientX: number, clientY: number) => {
    const img = imgRef.current!;
    const rect = img.getBoundingClientRect();
    const scaleX = naturalW / rect.width;
    const scaleY = naturalH / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      const { x, y } = toImg(e.clientX, e.clientY);
      const d = drag.current;
      const nx = Math.min(d.start.x, x);
      const ny = Math.min(d.start.y, y);
      const nw = Math.abs(x - d.start.x);
      const nh = Math.abs(y - d.start.y);
      onChange({ x: nx, y: ny, w: Math.max(1, nw), h: Math.max(1, nh) });
    };
    const up = () => { drag.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [naturalW, naturalH, onChange]);

  const scale = 300 / naturalW;
  const dispW = naturalW * scale;
  const dispH = naturalH * scale;
  const rx = value.x * scale;
  const ry = value.y * scale;
  const rw = value.w * scale;
  const rh = value.h * scale;

  return (
    <div style={{ position: 'relative', width: dispW, height: dispH }}>
      <img ref={imgRef} src={src} alt="crop" style={{ width: dispW, height: dispH, display: 'block' }}
        onMouseDown={(e) => { const p = toImg(e.clientX, e.clientY); drag.current = { sx: p.x, sy: p.y, start: { x: p.x, y: p.y, w: 0, h: 0 } }; }} />
      <div style={{ position: 'absolute', left: rx, top: ry, width: rw, height: rh, border: '2px solid #f2a65a', background: 'rgba(242,166,90,0.2)', pointerEvents: 'none' }} />
    </div>
  );
}