import { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import type { Point, Rect } from '../image/geometry';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const CORNERS: Exclude<Mode, 'move'>[] = ['nw', 'ne', 'sw', 'se'];

interface Props {
  src: string;
  naturalW: number;
  naturalH: number;
  boxes: Rect[];
  onChange: (boxes: Rect[]) => void;
}

/** Shows the group photo with one numbered box per sheet: drag to move, drag a corner to resize, ✕ to remove. */
export function BoxEditor({ src, naturalW, naturalH, boxes, onChange }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; mode: Mode; start: Point; orig: Rect } | null>(null);
  const min = Math.round(Math.min(naturalW, naturalH) * 0.05);

  const toNatural = (e: React.PointerEvent): Point => {
    const r = area.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * naturalW) / r.width, y: ((e.clientY - r.top) * naturalH) / r.height };
  };

  const begin = (e: React.PointerEvent, i: number, mode: Mode) => {
    e.stopPropagation();
    area.current?.setPointerCapture(e.pointerId);
    drag.current = { i, mode, start: toNatural(e), orig: boxes[i] };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toNatural(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    let { x, y, w, h } = d.orig;
    if (d.mode === 'move') {
      x = Math.min(Math.max(0, x + dx), naturalW - w);
      y = Math.min(Math.max(0, y + dy), naturalH - h);
    } else {
      let x2 = x + w, y2 = y + h;
      if (d.mode.includes('w')) x = Math.min(Math.max(0, x + dx), x2 - min);
      if (d.mode.includes('e')) x2 = Math.max(Math.min(naturalW, x2 + dx), x + min);
      if (d.mode.includes('n')) y = Math.min(Math.max(0, y + dy), y2 - min);
      if (d.mode.includes('s')) y2 = Math.max(Math.min(naturalH, y2 + dy), y + min);
      w = x2 - x; h = y2 - y;
    }
    const next = [...boxes];
    next[d.i] = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    onChange(next);
  };

  const add = () => {
    const w = Math.round(naturalW * 0.35), h = Math.round(naturalH * 0.3);
    onChange([...boxes, { x: Math.round((naturalW - w) / 2), y: Math.round((naturalH - h) / 2), w, h }]);
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div className="boxes">
      <div ref={area} className="boxes-area" onPointerMove={move}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <img src={src} alt="Group photo of sticker sheets" draggable={false} />
        {boxes.map((b, i) => (
          <div key={i} className="sheet-box" aria-label={`Sheet ${i + 1}`}
            style={{ left: pct(b.x, naturalW), top: pct(b.y, naturalH), width: pct(b.w, naturalW), height: pct(b.h, naturalH) }}
            onPointerDown={(e) => begin(e, i, 'move')}>
            <span className="box-num">{i + 1}</span>
            <button type="button" className="box-remove" aria-label={`Remove sheet ${i + 1}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onChange(boxes.filter((_, j) => j !== i))}>
              <X size={14} aria-hidden />
            </button>
            {CORNERS.map((c) => (
              <span key={c} className={`box-handle ${c}`} onPointerDown={(e) => begin(e, i, c)} />
            ))}
          </div>
        ))}
      </div>
      <button type="button" onClick={add}><Plus size={16} aria-hidden style={{ verticalAlign: -3 }} /> Add a box</button>
      <p className="hint">Drag a box to move it, drag its corners to resize, ✕ to remove. One box per sheet.</p>
    </div>
  );
}
