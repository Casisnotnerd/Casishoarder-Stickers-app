import { useState, type CSSProperties } from 'react';
import { frameLayout, parseFrame } from '../domain/tileFrame';

/** An artist picture shown in a 4:3 box exactly as framed in the editor (same look on every screen width). */
export function FramedPicture({ src, frame, className, alt = '' }: { src: string; frame: string | null; className?: string; alt?: string }) {
  const [aspect, setAspect] = useState<number | null>(null);
  let style: CSSProperties = { inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
  if (aspect) {
    const l = frameLayout(parseFrame(frame), aspect);
    style = { width: `${l.widthPct}%`, height: `${l.heightPct}%`, left: `${l.leftPct}%`, top: `${l.topPct}%` };
  }
  return (
    <div className={`framed${className ? ` ${className}` : ''}`}>
      <img src={src} alt={alt} draggable={false} style={style}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          if (w && h) setAspect(w / h);
        }} />
    </div>
  );
}
