// Technical CAD Drawing Frame & Title Block (Marco y Cajetín Normalizado IEC / DIN A4 / A3)

import { canvasPalette } from '../theme/planThemes';

function cadFont(palette, size, bold) {
  const family = palette.board ? 'Palatino Linotype, Palatino, Georgia, serif' : 'Consolas, monospace';
  return `${bold ? 'bold ' : ''}${size}px ${family}`;
}

function drawWarcraftBoard(ctx, palette, w, h, margin) {
  const edge = 7;
  ctx.fillStyle = palette.sheetEdge;
  ctx.fillRect(edge, edge, w - edge * 2, h - edge * 2);

  const rail = palette.rail || palette.sheetInk;
  ctx.fillStyle = rail;
  ctx.fillRect(edge + 10, edge + 5, w - (edge + 10) * 2, margin - edge - 11);
  ctx.fillRect(edge + 10, h - margin + 6, w - (edge + 10) * 2, margin - edge - 12);
  ctx.fillRect(edge + 5, margin - 2, margin - edge - 12, h - (margin - 2) * 2);
  ctx.fillRect(w - margin + 7, margin - 2, margin - edge - 13, h - (margin - 2) * 2);

  const slate = ctx.createLinearGradient(margin, margin, w - margin, h - margin);
  slate.addColorStop(0, palette.sheet);
  slate.addColorStop(1, palette.sheetShade);
  ctx.fillStyle = slate;
  ctx.fillRect(margin, margin, w - margin * 2, h - margin * 2);
  if (palette.vignette) {
    const shade = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.62);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, palette.vignette);
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.clip();
    ctx.fillStyle = shade;
    ctx.fillRect(margin, margin, w - margin * 2, h - margin * 2);
    ctx.restore();
  }

  ctx.strokeStyle = palette.sheetInk;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(edge + 1.5, edge + 1.5, w - (edge + 1.5) * 2, h - (edge + 1.5) * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

  ctx.fillStyle = palette.sheetInk;
  [
    [edge + 3, edge + 3, 1, 1],
    [w - edge - 3, edge + 3, -1, 1],
    [edge + 3, h - edge - 3, 1, -1],
    [w - edge - 3, h - edge - 3, -1, -1]
  ].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sx * 52, y);
    ctx.lineTo(x + sx * 52, y + sy * 8);
    ctx.lineTo(x + sx * 8, y + sy * 8);
    ctx.lineTo(x + sx * 8, y + sy * 52);
    ctx.lineTo(x, y + sy * 52);
    ctx.closePath();
    ctx.fill();
  });
}

export const SHEET_SIZES = {
  A4_HORIZONTAL: { name: 'A4 Horizontal', width: 1100, height: 750, cols: 8, rows: 6 },
  A3_HORIZONTAL: { name: 'A3 Horizontal', width: 1400, height: 950, cols: 10, rows: 8 },
  A4_VERTICAL: { name: 'A4 Vertical', width: 750, height: 1100, cols: 6, rows: 8 },
};

/**
 * Draw technical CAD sheet border and coordinate grid margins
 */
export function drawSheetBorder(ctx, sheetConfig) {
  const size = SHEET_SIZES[sheetConfig.sizeKey] || SHEET_SIZES.A4_HORIZONTAL;
  const margin = 30;
  const w = size.width;
  const h = size.height;

  const palette = canvasPalette();
  ctx.save();

  if (palette.board) {
    drawWarcraftBoard(ctx, palette, w, h, margin);
  } else {
  const paper = ctx.createLinearGradient(0, 0, w, h);
  paper.addColorStop(0, palette.sheet);
  paper.addColorStop(1, palette.sheetShade);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  if (palette.vignette) {
    const glow = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
    glow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    glow.addColorStop(1, palette.vignette);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.strokeStyle = palette.sheetEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  if (palette.doubleLine) {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = palette.ornate ? 2.4 : 1.25;
    ctx.strokeRect(11, 11, w - 22, h - 22);
  }

  ctx.strokeStyle = palette.sheetInk;
  ctx.lineWidth = 1.5;
  if (palette.glow) {
    ctx.shadowColor = palette.sheetInk;
    ctx.shadowBlur = 10;
  }
  ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
  ctx.shadowBlur = 0;
  }

  // Coordinate grid margin ticks & labels (A, B, C, D... on X, 1, 2, 3, 4... on Y)
  const cols = size.cols;
  const rows = size.rows;
  const colWidth = (w - margin * 2) / cols;
  const rowHeight = (h - margin * 2) / rows;

  ctx.fillStyle = palette.board ? (palette.letter || '#302010') : palette.sheetInk;
  ctx.strokeStyle = palette.board ? (palette.letter || '#302010') : palette.sheetInk;
  ctx.font = cadFont(palette, palette.board ? 12 : 10, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Columns: A, B, C, D, E, F...
  for (let c = 0; c < cols; c++) {
    const letter = String.fromCharCode(65 + c);
    const x = margin + c * colWidth + colWidth / 2;
    // Top label
    ctx.fillText(letter, x, margin - 12);
    // Bottom label
    ctx.fillText(letter, x, h - margin + 12);

    // Ticks
    if (c > 0) {
      const tx = margin + c * colWidth;
      ctx.beginPath();
      ctx.moveTo(tx, margin - 6);
      ctx.lineTo(tx, margin);
      ctx.moveTo(tx, h - margin);
      ctx.lineTo(tx, h - margin + 6);
      ctx.stroke();
    }
  }

  // Rows: 1, 2, 3, 4...
  for (let r = 0; r < rows; r++) {
    const num = String(r + 1);
    const y = margin + r * rowHeight + rowHeight / 2;
    // Left label
    ctx.fillText(num, margin - 14, y);
    // Right label
    ctx.fillText(num, w - margin + 14, y);

    // Ticks
    if (r > 0) {
      const ty = margin + r * rowHeight;
      ctx.beginPath();
      ctx.moveTo(margin - 6, ty);
      ctx.lineTo(margin, ty);
      ctx.moveTo(w - margin, ty);
      ctx.lineTo(w - margin + 6, ty);
      ctx.stroke();
    }
  }

  if (palette.ornate) {
    ctx.fillStyle = palette.accent;
    const stud = 7;
    [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x, y - stud);
      ctx.lineTo(x + stud, y);
      ctx.lineTo(x, y + stud);
      ctx.lineTo(x - stud, y);
      ctx.closePath();
      ctx.fill();
    });
  }

  // Draw Title Block (Cajetín) at Bottom Right
  drawTitleBlock(ctx, w - margin, h - margin, sheetConfig, palette);

  ctx.restore();
}

/**
 * Draw technical title block (Cajetín)
 */
function drawTitleBlock(ctx, right, bottom, config, palette) {
  const tbW = 280;
  const tbH = 95;
  const left = right - tbW;
  const top = bottom - tbH;
  const scroll = !!palette.board;
  const labelInk = scroll ? '#6b4a28' : palette.titleLabel;
  const valueInk = scroll ? '#2c1c10' : palette.titleValue;
  const nameInk = scroll ? '#7a4e18' : palette.gold;
  const companyInk = scroll ? '#5c3a16' : palette.accent;
  const liveInk = scroll ? '#1d5e42' : palette.live;
  const bodyLeft = scroll ? left + 12 : left;
  const bodyWidth = scroll ? tbW - 24 : tbW;

  if (scroll) {
    ctx.fillStyle = '#c6a56e';
    ctx.beginPath();
    ctx.ellipse(left + 10, top + tbH / 2, 11, tbH / 2 - 1, 0, 0, Math.PI * 2);
    ctx.ellipse(right - 10, top + tbH / 2, 11, tbH / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = scroll ? '#e7d3a4' : palette.sheetPanel;
  ctx.fillRect(bodyLeft, top, bodyWidth, tbH);

  ctx.strokeStyle = scroll ? '#6a4a28' : palette.sheetInk;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bodyLeft, top, bodyWidth, tbH);

  // Horizontal internal dividing lines
  const h1 = top + 30;
  const h2 = top + 60;
  ctx.beginPath();
  ctx.moveTo(bodyLeft, h1);
  ctx.lineTo(bodyLeft + bodyWidth, h1);
  ctx.moveTo(bodyLeft, h2);
  ctx.lineTo(bodyLeft + bodyWidth, h2);
  ctx.stroke();

  // Vertical dividing lines
  const v1 = left + 140;
  const v2 = left + 210;
  ctx.beginPath();
  ctx.moveTo(v1, top);
  ctx.lineTo(v1, h2);
  ctx.moveTo(v2, h2);
  ctx.lineTo(v2, bottom);
  ctx.stroke();

  // Text contents
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Field: Project Name
  ctx.fillStyle = labelInk;
  ctx.font = cadFont(palette, 8, false);
  ctx.fillText('PROYECTO:', bodyLeft + 6, top + 4);
  ctx.fillStyle = valueInk;
  ctx.font = cadFont(palette, 10, true);
  ctx.fillText(config.projectName || 'DRAGNO ELECTRIC CAD', bodyLeft + 6, top + 15);

  // Field: Sheet Title
  ctx.fillStyle = labelInk;
  ctx.font = cadFont(palette, 8, false);
  ctx.fillText('PLANO / CIRCUITO:', v1 + 6, top + 4);
  ctx.fillStyle = nameInk;
  ctx.font = cadFont(palette, 10, true);
  ctx.fillText(config.sheetTitle || 'Circuito de Control', v1 + 6, top + 15);

  // Field: Company / Designer
  ctx.fillStyle = labelInk;
  ctx.font = cadFont(palette, 8, false);
  ctx.fillText('EMPRESA / DISEÑADOR:', bodyLeft + 6, h1 + 4);
  ctx.fillStyle = companyInk;
  ctx.font = cadFont(palette, 9, true);
  ctx.fillText(config.company || 'INGENIERÍA ELÉCTRICA', bodyLeft + 6, h1 + 15);

  // Field: Date
  ctx.fillStyle = labelInk;
  ctx.font = cadFont(palette, 8, false);
  ctx.fillText('FECHA:', v1 + 6, h1 + 4);
  ctx.fillStyle = valueInk;
  ctx.font = cadFont(palette, 9, false);
  ctx.fillText(config.date || new Date().toLocaleDateString(), v1 + 6, h1 + 15);

  // Bottom row: Standard / Normative
  ctx.fillStyle = liveInk;
  ctx.font = cadFont(palette, 10, true);
  ctx.fillText('IEC 60617 / DIN', bodyLeft + 6, h2 + 10);

  // Bottom row: Page number
  ctx.fillStyle = labelInk;
  ctx.font = cadFont(palette, 8, false);
  ctx.fillText('HOJA:', v2 + 6, h2 + 4);
  ctx.fillStyle = valueInk;
  ctx.font = cadFont(palette, 10, true);
  ctx.fillText(`${config.pageIndex || 1} / ${config.totalPages || 1}`, v2 + 6, h2 + 15);
}
