// Industrial DXF Generator conforming to AutoCAD DXF standard (Release 12 / R2000 ASCII)
// Exports layers, line entities, circles, arcs, and text with exact coordinates and colors

import { layerState, outlineSegments } from '../../frontend/src/cad/draw/geometry.js';
import { SYMBOL_DEFINITIONS } from '../../frontend/src/cad/symbolCatalog.js';
import { normalizeRotation, rotateOffset } from '../../frontend/src/cad/componentPose.js';
import { componentLabels, nameLinePositions } from '../../frontend/src/cad/componentLabel.js';
import { negationMarks } from '../../frontend/src/cad/outputNot.js';
import { motorArrowGeometry, motorTurnOf } from '../../frontend/src/cad/motorTurn.js';

function spritePrimitives(def, comp) {
  if (!def) return [];
  const state = comp?.state || {};
  let actuated = false;
  if (def.role === 'coil' || def.role === 'load' || def.role === 'motor') actuated = !!comp?.energized;
  else if (def.switchType === 'thermal' || def.linkedRole === 'thermal') actuated = state.tripped === true;
  else if (def.contactType === 'NC' || def.switchType === 'momentary_NC') {
    actuated = state.pressed === true || state.closed === false;
  } else if (def.switchType === 'breaker') actuated = state.closed === false;
  else if (def.role === 'switch' || def.role === 'contact') actuated = !!(state.pressed || state.closed);
  else actuated = !!comp?.energized;
  if (actuated && Array.isArray(def.activePrimitives) && def.activePrimitives.length > 0) return def.activePrimitives;
  return def.primitives || [];
}

export function generateDxf(sheetData, options = {}) {
  const {
    sheetConfig = { width: 1100, height: 750, projectName: 'PROYECTO', sheetTitle: 'CIRCUITO 1' },
    components = [],
    wires = []
  } = sheetData;

  const sheetH = sheetConfig.height || 750;
  const sheetW = sheetConfig.width || 1100;

  // Invert Y coordinate from Canvas (0 at top) to AutoCAD (0 at bottom)
  const toCadY = (y) => (sheetH - y).toFixed(2);
  const toCadX = (x) => Number(x).toFixed(2);

  let dxf = '';

  // 1. HEADER SECTION
  dxf += '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n';

  // 2. TABLES SECTION (LAYERS DEFINITIONS)
  dxf += '0\nSECTION\n2\nTABLES\n';
  dxf += '0\nTABLE\n2\nLAYER\n70\n6\n';

  const layers = [
    { name: '0', color: 7 }, // White
    { name: 'ESQ_MARCO', color: 3 }, // Green
    { name: 'ESQ_CABLES_CONTROL', color: 4 }, // Cyan
    { name: 'ESQ_CABLES_POTENCIA', color: 1 }, // Red
    { name: 'ESQ_SIMBOLOS', color: 7 }, // White
    { name: 'ESQ_TERMINALES', color: 5 }, // Blue
    { name: 'ESQ_TEXTOS', color: 2 }, // Yellow
  ];

  layers.forEach(l => {
    dxf += '0\nLAYER\n';
    dxf += `2\n${l.name}\n`;
    dxf += '70\n0\n';
    dxf += `62\n${l.color}\n`;
    dxf += '6\nCONTINUOUS\n';
  });

  dxf += '0\nENDTAB\n';
  dxf += '0\nENDSEC\n';

  // 3. BLOCKS SECTION
  dxf += '0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n';

  // 4. ENTITIES SECTION
  dxf += '0\nSECTION\n2\nENTITIES\n';

  // Helper: add LINE entity
  const addLine = (x1, y1, x2, y2, layer = 'ESQ_SIMBOLOS', color = null) => {
    dxf += '0\nLINE\n';
    dxf += `8\n${layer}\n`;
    if (color !== null) dxf += `62\n${color}\n`;
    dxf += `10\n${toCadX(x1)}\n`;
    dxf += `20\n${toCadY(y1)}\n`;
    dxf += '30\n0.0\n';
    dxf += `11\n${toCadX(x2)}\n`;
    dxf += `21\n${toCadY(y2)}\n`;
    dxf += '31\n0.0\n';
  };

  // Helper: add CIRCLE entity
  const addCircle = (cx, cy, r, layer = 'ESQ_SIMBOLOS', color = null) => {
    dxf += '0\nCIRCLE\n';
    dxf += `8\n${layer}\n`;
    if (color !== null) dxf += `62\n${color}\n`;
    dxf += `10\n${toCadX(cx)}\n`;
    dxf += `20\n${toCadY(cy)}\n`;
    dxf += '30\n0.0\n';
    dxf += `40\n${Number(r).toFixed(2)}\n`;
  };

  // Helper: add TEXT entity
  const addText = (text, x, y, height = 3.5, layer = 'ESQ_TEXTOS', color = null, align = 'left') => {
    if (!text) return;
    dxf += '0\nTEXT\n';
    dxf += `8\n${layer}\n`;
    if (color !== null) dxf += `62\n${color}\n`;
    dxf += `10\n${toCadX(x)}\n`;
    dxf += `20\n${toCadY(y)}\n`;
    dxf += '30\n0.0\n';
    dxf += `40\n${Number(height).toFixed(2)}\n`;
    dxf += `1\n${text}\n`;
    if (align === 'right' || align === 'center') {
      dxf += `72\n${align === 'center' ? 1 : 2}\n`;
      dxf += `11\n${toCadX(x)}\n`;
      dxf += `21\n${toCadY(y)}\n`;
      dxf += '31\n0.0\n';
    }
  };

  // --- DRAW SHEET BORDER & TITLE BLOCK (MARCO Y CAJETÍN) ---
  const margin = 30;
  // Outer frame
  addLine(margin, margin, sheetW - margin, margin, 'ESQ_MARCO');
  addLine(sheetW - margin, margin, sheetW - margin, sheetH - margin, 'ESQ_MARCO');
  addLine(sheetW - margin, sheetH - margin, margin, sheetH - margin, 'ESQ_MARCO');
  addLine(margin, sheetH - margin, margin, margin, 'ESQ_MARCO');

  // Title Block (Cajetín) at Bottom Right
  const tbW = 280;
  const tbH = 95;
  const tbRight = sheetW - margin;
  const tbBottom = sheetH - margin;
  const tbLeft = tbRight - tbW;
  const tbTop = tbBottom - tbH;

  addLine(tbLeft, tbTop, tbRight, tbTop, 'ESQ_MARCO');
  addLine(tbLeft, tbTop, tbLeft, tbBottom, 'ESQ_MARCO');
  addLine(tbLeft, tbTop + 30, tbRight, tbTop + 30, 'ESQ_MARCO');
  addLine(tbLeft, tbTop + 60, tbRight, tbTop + 60, 'ESQ_MARCO');
  addLine(tbLeft + 140, tbTop, tbLeft + 140, tbTop + 60, 'ESQ_MARCO');
  addLine(tbLeft + 210, tbTop + 60, tbLeft + 210, tbBottom, 'ESQ_MARCO');

  // Title Block texts
  addText('PROYECTO: ' + (sheetConfig.projectName || 'DRAGNO ELECTRIC CAD'), tbLeft + 6, tbTop + 15, 3.0, 'ESQ_TEXTOS');
  addText('PLANO: ' + (sheetConfig.sheetTitle || 'ESQUEMA ELECTRICO'), tbLeft + 146, tbTop + 15, 3.0, 'ESQ_TEXTOS', 2);
  addText('EMPRESA: ' + (sheetConfig.company || 'CONTROLMAX 360'), tbLeft + 6, tbTop + 45, 2.5, 'ESQ_TEXTOS', 4);
  addText('FECHA: ' + (sheetConfig.date || new Date().toLocaleDateString()), tbLeft + 146, tbTop + 45, 2.5, 'ESQ_TEXTOS');
  addText('NORMA: IEC 60617', tbLeft + 6, tbTop + 75, 2.5, 'ESQ_TEXTOS', 3);
  addText('HOJA: 1/1', tbLeft + 216, tbTop + 75, 2.5, 'ESQ_TEXTOS');

  // --- DRAW WIRES ---
  wires.forEach(w => {
    const isPower = w.wireType === 'power' || (w.color && (w.color.includes('red') || w.color.includes('orange')));
    const layer = isPower ? 'ESQ_CABLES_POTENCIA' : 'ESQ_CABLES_CONTROL';
    const color = isPower ? 1 : 4;

    if (w.waypoints && w.waypoints.length >= 2) {
      for (let i = 0; i < w.waypoints.length - 1; i++) {
        addLine(w.waypoints[i].x, w.waypoints[i].y, w.waypoints[i + 1].x, w.waypoints[i + 1].y, layer, color);
      }
    }
  });

  // --- DRAW COMPONENTS ---
  const placeLine = addLine;
  const placeCircle = addCircle;
  const placeText = addText;
  components.forEach(comp => {
    const cx = comp.x;
    const cy = comp.y;
    const tag = comp.tag || comp.type;
    const rotation = normalizeRotation(comp.rotation);
    const spin = (x, y) => {
      const turned = rotateOffset(x - cx, y - cy, rotation);
      return { x: cx + turned.x, y: cy + turned.y };
    };
    const addLine = (x1, y1, x2, y2, layer, color) => {
      const a = spin(x1, y1);
      const b = spin(x2, y2);
      placeLine(a.x, a.y, b.x, b.y, layer, color);
    };
    const addCircle = (x, y, r, layer, color) => {
      const center = spin(x, y);
      placeCircle(center.x, center.y, r, layer, color);
    };
    const addText = (text, x, y, height, layer, color) => {
      const point = spin(x, y);
      placeText(text, point.x, point.y, height, layer, color);
    };
    const def = (options.symbolDefs && options.symbolDefs[comp.type]) || SYMBOL_DEFINITIONS[comp.type];
    const labels = componentLabels(comp, def);
    placeText(labels.tag, labels.tagX, labels.tagY, 3.5, 'ESQ_TEXTOS', 2, 'right');
    const nameLayout = nameLinePositions(comp, def);
    nameLayout.lines.forEach(line => {
      if (!line.text) return;
      const height = Math.max(1.6, nameLayout.style.size / 4);
      const align = nameLayout.style.align;
      placeText(line.text, line.x, line.y, height, 'ESQ_TEXTOS', 7, align);
      if (nameLayout.style.bold) placeText(line.text, line.x + 0.35, line.y, height, 'ESQ_TEXTOS', 7, align);
    });

    negationMarks(comp, def).forEach(mark => {
      addCircle(cx + mark.x, cy + mark.y, mark.r, 'ESQ_SIMBOLOS', 2);
    });
    if (def?.role === 'motor') {
      const arrow = motorArrowGeometry(motorTurnOf(comp));
      for (let index = 0; index < arrow.points.length - 1; index += 1) {
        const from = arrow.points[index];
        const to = arrow.points[index + 1];
        addLine(cx + from.x, cy + from.y, cx + to.x, cy + to.y, 'ESQ_SIMBOLOS', 2);
      }
      const [tip, left, right] = arrow.head;
      addLine(cx + tip.x, cy + tip.y, cx + left.x, cy + left.y, 'ESQ_SIMBOLOS', 2);
      addLine(cx + tip.x, cy + tip.y, cx + right.x, cy + right.y, 'ESQ_SIMBOLOS', 2);
    }

    const customDef = options.symbolDefs ? options.symbolDefs[comp.type] : null;
    const drawnPrimitives = customDef ? spritePrimitives(customDef, comp) : [];
    if (drawnPrimitives.length > 0) {
      drawnPrimitives.forEach(prim => {
        if (!layerState(customDef.layers, prim.layerId).visible) return;
        if (prim.type === 'circle') {
          addCircle(cx + prim.cx, cy + prim.cy, prim.r, 'ESQ_SIMBOLOS');
        } else if (prim.type === 'text') {
          addText((prim.text || '').replace('{tag}', tag), cx + prim.x, cy + prim.y, (prim.fontSize || 10) / 4, 'ESQ_TEXTOS');
        } else {
          outlineSegments(prim).forEach(([start, end]) => {
            addLine(cx + start.x, cy + start.y, cx + end.x, cy + end.y, 'ESQ_SIMBOLOS');
          });
        }
      });

      if (customDef.pins) {
        customDef.pins.forEach(pin => {
          addText(pin.label || pin.id, cx + pin.x - 6, cy + pin.y, 2.0, 'ESQ_TERMINALES');
        });
      }
      return;
    }

    // Symbol specific DXF vector geometries
    const source = SYMBOL_DEFINITIONS[comp.type];
    if (source?.primitives?.length && !source.figures) {
      source.primitives.forEach(prim => {
        if (prim.type === 'circle') {
          addCircle(cx + prim.cx, cy + prim.cy, prim.r, 'ESQ_SIMBOLOS');
        } else if (prim.type === 'text') {
          addText((prim.text || '').replace('{tag}', tag), cx + prim.x, cy + prim.y, (prim.fontSize || 10) / 4, 'ESQ_TEXTOS');
        } else {
          outlineSegments(prim).forEach(([start, end]) => {
            addLine(cx + start.x, cy + start.y, cx + end.x, cy + end.y, 'ESQ_SIMBOLOS');
          });
        }
      });
      (source.pins || []).forEach(pin => {
        addText(pin.label || pin.id, cx + pin.x - 6, cy + pin.y, 2.0, 'ESQ_TERMINALES');
      });
      return;
    }
    if (source?.figures) {
      source.figures.circles.forEach(circle => {
        addCircle(cx + circle.x, cy + circle.y, circle.r, 'ESQ_SIMBOLOS');
      });
      source.figures.lines.forEach(line => {
        addLine(cx + line.x1, cy + line.y1, cx + line.x2, cy + line.y2, 'ESQ_SIMBOLOS');
      });
      source.figures.texts.forEach(text => {
        addText(text.text, cx + text.x, cy + text.y, 2.2, 'ESQ_TEXTOS');
      });
      return;
    }

    switch (comp.type) {
      case 'COIL':
        addLine(cx, cy - 25, cx, cy - 15, 'ESQ_SIMBOLOS');
        addLine(cx, cy + 15, cx, cy + 25, 'ESQ_SIMBOLOS');
        // Rectangle
        addLine(cx - 12, cy - 15, cx + 12, cy - 15, 'ESQ_SIMBOLOS');
        addLine(cx + 12, cy - 15, cx + 12, cy + 15, 'ESQ_SIMBOLOS');
        addLine(cx + 12, cy + 15, cx - 12, cy + 15, 'ESQ_SIMBOLOS');
        addLine(cx - 12, cy + 15, cx - 12, cy - 15, 'ESQ_SIMBOLOS');
        addText('A1', cx - 20, cy - 16, 2.0, 'ESQ_TERMINALES');
        addText('A2', cx - 20, cy + 22, 2.0, 'ESQ_TERMINALES');
        break;

      case 'CONTACT_NO':
      case 'BUTTON_NO':
        addLine(cx, cy - 25, cx, cy - 10, 'ESQ_SIMBOLOS');
        addLine(cx, cy + 10, cx, cy + 25, 'ESQ_SIMBOLOS');
        addLine(cx, cy + 10, cx + 10, cy - 8, 'ESQ_SIMBOLOS');
        addText('13', cx - 15, cy - 16, 2.0, 'ESQ_TERMINALES');
        addText('14', cx - 15, cy + 20, 2.0, 'ESQ_TERMINALES');
        break;

      case 'CONTACT_NC':
      case 'BUTTON_NC':
        addLine(cx, cy - 25, cx, cy - 10, 'ESQ_SIMBOLOS');
        addLine(cx, cy + 10, cx, cy + 25, 'ESQ_SIMBOLOS');
        addLine(cx, cy + 10, cx, cy - 10, 'ESQ_SIMBOLOS');
        addLine(cx - 5, cy - 10, cx + 5, cy - 10, 'ESQ_SIMBOLOS');
        addText('21', cx - 15, cy - 16, 2.0, 'ESQ_TERMINALES');
        addText('22', cx - 15, cy + 20, 2.0, 'ESQ_TERMINALES');
        break;

      case 'POWER_CONTACTS_3P':
      case 'BREAKER_3P':
        [-20, 0, 20].forEach(ox => {
          addLine(cx + ox, cy - 25, cx + ox, cy - 10, 'ESQ_SIMBOLOS');
          addLine(cx + ox, cy + 10, cx + ox, cy + 25, 'ESQ_SIMBOLOS');
          addLine(cx + ox, cy + 10, cx + ox + 8, cy - 8, 'ESQ_SIMBOLOS');
        });
        addLine(cx - 20, cy, cx + 20, cy, 'ESQ_SIMBOLOS', 2);
        break;

      case 'MOTOR_3P':
        [-20, 0, 20].forEach(ox => {
          addLine(cx + ox, cy - 30, cx + ox, cy - 18, 'ESQ_SIMBOLOS');
        });
        addCircle(cx, cy, 18, 'ESQ_SIMBOLOS', 3);
        addText('M 3~', cx - 8, cy - 2, 3.5, 'ESQ_TEXTOS');
        break;

      case 'PILOT_LIGHT':
        addLine(cx, cy - 25, cx, cy - 12, 'ESQ_SIMBOLOS');
        addLine(cx, cy + 12, cx, cy + 25, 'ESQ_SIMBOLOS');
        addCircle(cx, cy, 12, 'ESQ_SIMBOLOS');
        addLine(cx - 8, cy - 8, cx + 8, cy + 8, 'ESQ_SIMBOLOS');
        addLine(cx + 8, cy - 8, cx - 8, cy + 8, 'ESQ_SIMBOLOS');
        addText('X1', cx - 16, cy - 16, 2.0, 'ESQ_TERMINALES');
        addText('X2', cx - 16, cy + 20, 2.0, 'ESQ_TERMINALES');
        break;

      default:
        // Generic box representation for any unlisted symbol
        addLine(cx - 15, cy - 15, cx + 15, cy - 15, 'ESQ_SIMBOLOS');
        addLine(cx + 15, cy - 15, cx + 15, cy + 15, 'ESQ_SIMBOLOS');
        addLine(cx + 15, cy + 15, cx - 15, cy + 15, 'ESQ_SIMBOLOS');
        addLine(cx - 15, cy + 15, cx - 15, cy - 15, 'ESQ_SIMBOLOS');
        break;
    }
  });

  // 5. END OF ENTITIES & FILE
  dxf += '0\nENDSEC\n0\nEOF\n';

  return dxf;
}
