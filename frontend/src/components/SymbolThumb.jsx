import { useEffect, useRef } from 'react';
import { boundsOfMany } from '../cad/draw/geometry';
import { renderSymbolPrimitives, symbolSprite } from '../cad/symbolStore';
import { canvasPalette, subscribePlanTheme } from '../theme/planThemes';

function previewBox(def, sprite) {
  const drawn = boundsOfMany(sprite.primitives || []);
  if (drawn && drawn.maxX - drawn.minX > 1 && drawn.maxY - drawn.minY > 1) return drawn;
  const halfW = (def?.width || 40) / 2;
  const halfH = (def?.height || 50) / 2;
  return { minX: -halfW, minY: -halfH, maxX: halfW, maxY: halfH };
}

function drawingKey(def) {
  return [
    def?.type,
    def?.name,
    def?.prefix,
    def?.updatedAt || 0,
    def?.isCustom ? 1 : 0,
    def?.primitives?.length || 0,
    def?.activePrimitives?.length || 0
  ].join('|');
}

export default function SymbolThumb({ def }) {
  const canvasRef = useRef(null);
  const defRef = useRef(def);
  defRef.current = def;
  const key = drawingKey(def);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const paint = () => {
      const symbol = defRef.current;
      if (!symbol) return;
      const cssW = canvas.clientWidth || 32;
      const cssH = canvas.clientHeight || 32;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      const ctx = canvas.getContext('2d');
      const palette = canvasPalette();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = palette.canvas;
      ctx.fillRect(0, 0, cssW, cssH);

      const comp = {
        tag: symbol.prefix || '',
        state: { ...(symbol.defaultState || {}) },
        energized: false
      };
      const sprite = symbolSprite(symbol, comp);
      const box = previewBox(symbol, sprite);
      const pad = 2;
      const scale = Math.min(
        (cssW - pad * 2) / Math.max(box.maxX - box.minX, 1),
        (cssH - pad * 2) / Math.max(box.maxY - box.minY, 1)
      );

      ctx.save();
      ctx.translate(cssW / 2, cssH / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(box.minX + box.maxX) / 2, -(box.minY + box.maxY) / 2);
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'square';

      let drawn = false;
      if (typeof symbol.draw === 'function' && !symbol.isCustom) {
        symbol.draw(ctx, comp, false);
        drawn = true;
      }
      if (!drawn && sprite.primitives.length > 0) {
        renderSymbolPrimitives(ctx, sprite.primitives, comp, false, symbol);
      }

      (symbol.pins || []).forEach(pin => {
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, pin.r || symbol.pinRadius || 1.4, 0, Math.PI * 2);
        ctx.fillStyle = palette.pin;
        ctx.fill();
      });
      ctx.restore();
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    const unsubscribe = subscribePlanTheme(paint);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [key]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-8 w-8 shrink-0 rounded bg-autocad-canvas"
      aria-hidden="true"
    />
  );
}
