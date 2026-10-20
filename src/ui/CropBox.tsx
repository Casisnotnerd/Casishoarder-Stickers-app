import { useRef } from 'react';
import { fullRect, normalizeRect, type Point, type Rect } from '../image/geometry';

interface Props {
  src: string;
  naturalW: number;
  naturalH: number;
  value: Rect;
  onChange: (r: Rect) => void;
}

export function CropBox({ src, naturalW, naturalH, value, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<Point | null>(null);

  const toNatural = (e: React.PointerEvent): Point => {
    const r = box.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * naturalW) / r.width, y: ((e.clientY - r.top) * naturalH) / r.height };
  };

  return (
    <div className="crop">
      <div
        ref={box}
        className="crop-area"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = toNatural(e);
        }}
        onPointerMove={(e) => {
          if (start.current) onChange(normalizeRect(start.current, toNatural(e), naturalW, naturalH));
        }}
        onPointerUp={() => {
          start.current = null;
          if (value.w < 20 || value.h < 20) onChange(fullRect(naturalW, naturalH));
        }}
      >
        <img src={src} alt="Photo to crop" draggable={false} />
        <div
          className="crop-rect"
          style={{
            left: `${(value.x / naturalW) * 100}%`,
            top: `${(value.y / naturalH) * 100}%`,
            width: `${(value.w / naturalW) * 100}%`,
            height: `${(value.h / naturalH) * 100}%`,
          }}
        />
      </div>
      <p className="hint">Drag across the sheet to crop it. Tap once to reset.</p>
    </div>
  );
}
