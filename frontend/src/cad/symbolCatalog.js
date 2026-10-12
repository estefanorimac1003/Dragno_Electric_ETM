// Symbol catalog with IEC 60617 / DIN standard electrical symbols
// Designed for AutoCAD dark-mode rendering and DXF vector export

export const CATEGORIES = [
  'Lo más usado',
  'Potenciales y Señales',
  'Protección Eléctrica',
  'Mandos y Actuadores',
  'Cargas y Motores',
];

const SOURCE_STROKE = '#00e5ff';

function poleCenters(count) {
  const gap = count >= 5 ? 15 : 18;
  const origin = -((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => origin + index * gap);
}

// Circle with a stem. The label sits above the circle. Each stem is a
// connection pin that feeds live, neutral or earth into the solver.
function definePotential({ type, name, prefix, voltage, poles, earth = false }) {
  const figures = { circles: [], lines: [], texts: [] };
  let pins = [];
  let width = 30;
  let height = 48;

  if (earth) {
    pins = [{ id: 'PE', label: 'PE', x: 0, y: -18, potential: 'ground' }];
    figures.lines.push(
      { x1: 0, y1: -18, x2: 0, y2: -4 },
      { x1: -13, y1: -4, x2: 13, y2: -4 },
      { x1: -8, y1: 2, x2: 8, y2: 2 },
      { x1: -4, y1: 8, x2: 4, y2: 8 }
    );
    width = 32;
    height = 42;
  } else {
    const xs = poleCenters(poles.length);
    const cy = -4;
    const radius = 6.2;
    const pinY = 18;
    const labelY = -17;
    poles.forEach((pole, index) => {
      const x = xs[index];
      figures.circles.push({ x, y: cy, r: radius });
      figures.lines.push({ x1: x, y1: cy + radius, x2: x, y2: pinY });
      if (pole.mark === 'bar') {
        figures.lines.push({ x1: x - 7, y1: labelY, x2: x + 7, y2: labelY });
      } else if (pole.label) {
        figures.texts.push({ x, y: labelY, text: pole.label });
      }
      pins.push({
        id: pole.id,
        label: pole.label,
        x,
        y: pinY,
        potential: pole.potential
      });
    });
    const gap = poles.length >= 5 ? 15 : 18;
    width = Math.max(28, (poles.length - 1) * gap + 28);
    height = 50;
  }

  const kinds = new Set(pins.map(pin => pin.potential));
  const primitives = [
    ...figures.circles.map((circle, index) => ({
      id: `${type}-c${index}`,
      type: 'circle',
      cx: circle.x,
      cy: circle.y,
      r: circle.r,
      stroke: SOURCE_STROKE,
      strokeWidth: 2,
      fill: 'none'
    })),
    ...figures.lines.map((line, index) => ({
      id: `${type}-l${index}`,
      type: 'line',
      x1: line.x1,
      y1: line.y1,
      x2: line.x2,
      y2: line.y2,
      stroke: SOURCE_STROKE,
      strokeWidth: 2
    })),
    ...figures.texts.map((text, index) => ({
      id: `${type}-t${index}`,
      type: 'text',
      x: text.x,
      y: text.y,
      text: text.text,
      color: SOURCE_STROKE,
      fontSize: 8,
      align: 'center'
    }))
  ];

  return {
    type,
    name,
    prefix,
    category: 'Potenciales y Señales',
    width,
    height,
    role: 'source',
    potentialType: kinds.size === 1 ? [...kinds][0] : 'mixed',
    voltage,
    pinRadius: 1.6,
    pins,
    primitives,
    figures,
    draw(ctx) {
      ctx.save();
      ctx.strokeStyle = SOURCE_STROKE;
      ctx.fillStyle = SOURCE_STROKE;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'miter';
      figures.circles.forEach(circle => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.beginPath();
      figures.lines.forEach(line => {
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
      });
      ctx.stroke();
      ctx.font = 'bold 8px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      figures.texts.forEach(text => {
        ctx.fillText(text.text, text.x, text.y);
      });
      ctx.restore();
    }
  };
}

const phase = (index) => ({ id: `L${index}`, label: `L${index}`, potential: 'live' });
const neutralPole = (id, label) => ({ id, label, potential: 'neutral' });
const earthPole = (id, label) => ({ id, label, potential: 'ground' });

export const SYMBOL_DEFINITIONS = {
  // ==========================================
  // POTENCIALES Y SEÑALES
  // Circle + stem. These pins are the voltage sources for the wires.
  // ==========================================
  SOURCE_3P: definePotential({
    type: 'SOURCE_3P',
    name: 'Trifásica L1 L2 L3',
    prefix: '3F',
    voltage: '400V',
    poles: [phase(1), phase(2), phase(3)]
  }),

  SOURCE_3PN: definePotential({
    type: 'SOURCE_3PN',
    name: 'Alimentación L1 L2 L3 N',
    prefix: '4F',
    voltage: '400V',
    poles: [phase(1), phase(2), phase(3), neutralPole('N', 'N')]
  }),

  SOURCE_3PNPE: definePotential({
    type: 'SOURCE_3PNPE',
    name: 'Alimentación L1 L2 L3 N PE',
    prefix: '5F',
    voltage: '400V',
    poles: [phase(1), phase(2), phase(3), neutralPole('N', 'N'), earthPole('PE', 'PE')]
  }),

  SOURCE_L: definePotential({
    type: 'SOURCE_L',
    name: 'Fase (L)',
    prefix: 'L',
    voltage: '230V',
    poles: [{ id: 'L', label: 'L', potential: 'live' }]
  }),

  SOURCE_N: definePotential({
    type: 'SOURCE_N',
    name: 'Neutro (N)',
    prefix: 'N',
    voltage: '0V',
    poles: [neutralPole('N', 'N')]
  }),

  SOURCE_LN: definePotential({
    type: 'SOURCE_LN',
    name: 'Fase y neutro',
    prefix: 'LN',
    voltage: '230V',
    poles: [{ id: 'L', label: 'L', potential: 'live' }, neutralPole('N', 'N')]
  }),

  SOURCE_LNPE: definePotential({
    type: 'SOURCE_LNPE',
    name: 'Fase, neutro y PE',
    prefix: 'LNP',
    voltage: '230V',
    poles: [{ id: 'L', label: 'L', potential: 'live' }, neutralPole('N', 'N'), earthPole('PE', 'PE')]
  }),

  SOURCE_PLUS: definePotential({
    type: 'SOURCE_PLUS',
    name: 'Positivo (+)',
    prefix: '+',
    voltage: '24VDC',
    poles: [{ id: 'POS', label: '+', potential: 'live' }]
  }),

  SOURCE_0V: definePotential({
    type: 'SOURCE_0V',
    name: 'Cero voltios (0V)',
    prefix: '0V',
    voltage: '0V',
    poles: [{ id: '0V', label: '0V', potential: 'neutral', mark: 'bar' }]
  }),

  SOURCE_DC: definePotential({
    type: 'SOURCE_DC',
    name: 'Continua (+ / −)',
    prefix: 'DC',
    voltage: '24VDC',
    poles: [
      { id: 'POS', label: '+', potential: 'live' },
      { id: 'NEG', label: '−', potential: 'neutral' }
    ]
  }),

  SOURCE_PE_MARK: definePotential({
    type: 'SOURCE_PE_MARK',
    name: 'Protección (PE)',
    prefix: 'PE',
    poles: [earthPole('PE', 'PE')]
  }),

  SOURCE_PE: definePotential({
    type: 'SOURCE_PE',
    name: 'Tierra',
    prefix: 'GND',
    earth: true
  }),

  DC_24V: {
    type: 'DC_24V',
    name: 'Fuente DC (+24V / 0V)',
    prefix: 'G',
    category: 'Potenciales y Señales',
    width: 50,
    height: 50,
    role: 'source',
    potentialType: 'dc_supply',
    voltage: '24VDC',
    pins: [
      { id: 'POS', label: '+', x: -15, y: 25, potential: 'live' },
      { id: 'NEG', label: '-', x: 15, y: 25, potential: 'neutral' }
    ],
    draw(ctx, comp, sim) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.fillStyle = '#151921';
      ctx.lineWidth = 1.5;

      // Box
      ctx.fillRect(-22, -22, 44, 40);
      ctx.strokeRect(-22, -22, 44, 40);

      // Pins
      ctx.beginPath();
      ctx.moveTo(-15, 18);
      ctx.lineTo(-15, 25);
      ctx.moveTo(15, 18);
      ctx.lineTo(15, 25);
      ctx.stroke();

      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 11px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText('+', -15, 10);

      ctx.fillStyle = '#00b0ff';
      ctx.fillText('-', 15, 10);

      ctx.fillStyle = '#ffd600';
      ctx.font = '9px Consolas';
      ctx.fillText('24VDC', 0, -5);
    }
  },

  // ==========================================
  // PROTECCIÓN ELÉCTRICA
  // ==========================================
  BREAKER_1P: {
    type: 'BREAKER_1P',
    name: 'Disyuntor Unipolar 1P (-F)',
    prefix: 'QM',
    category: 'Protección Eléctrica',
    width: 30,
    height: 50,
    role: 'switch',
    switchType: 'breaker',
    defaultState: { closed: true },
    pins: [
      { id: '1', label: '1', x: 0, y: -25 },
      { id: '2', label: '2', x: 0, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isClosed = comp.state?.closed ?? true;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;

      // Top & Bottom terminal lines
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -12);
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 25);
      ctx.stroke();

      // Switch contact arm
      ctx.beginPath();
      if (isClosed) {
        ctx.moveTo(0, 12);
        ctx.lineTo(0, -12);
      } else {
        ctx.moveTo(0, 12);
        ctx.lineTo(12, -10);
      }
      ctx.stroke();

      // Breaker thermal-magnetic mark (semi-rectangle / cross)
      ctx.beginPath();
      ctx.moveTo(isClosed ? -4 : 6, 0);
      ctx.lineTo(isClosed ? 4 : 14, 0);
      ctx.stroke();

      // Pin labels
      ctx.fillStyle = '#81d4fa';
      ctx.font = '9px Consolas';
      ctx.textAlign = 'right';
      ctx.fillText('1', -5, -16);
      ctx.fillText('2', -5, 20);
    }
  },

  BREAKER_3P: {
    type: 'BREAKER_3P',
    name: 'Guardamotor / Disyuntor 3P (-QM)',
    prefix: 'QM',
    category: 'Protección Eléctrica',
    width: 60,
    height: 55,
    role: 'switch',
    switchType: 'breaker',
    defaultState: { closed: true },
    pins: [
      { id: '1', label: '1', x: -20, y: -25 },
      { id: '2', label: '2', x: -20, y: 25 },
      { id: '3', label: '3', x: 0, y: -25 },
      { id: '4', label: '4', x: 0, y: 25 },
      { id: '5', label: '5', x: 20, y: -25 },
      { id: '6', label: '6', x: 20, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isClosed = comp.state?.closed ?? true;
      ctx.strokeStyle = isClosed ? '#00e5ff' : '#ff3d00';
      ctx.lineWidth = 2;

      const poles = [-20, 0, 20];
      poles.forEach((x, idx) => {
        // Upper & lower terminals
        ctx.beginPath();
        ctx.moveTo(x, -25);
        ctx.lineTo(x, -12);
        ctx.moveTo(x, 12);
        ctx.lineTo(x, 25);
        ctx.stroke();

        // Contact blade
        ctx.beginPath();
        if (isClosed) {
          ctx.moveTo(x, 12);
          ctx.lineTo(x, -12);
        } else {
          ctx.moveTo(x, 12);
          ctx.lineTo(x + 10, -10);
        }
        ctx.stroke();

        // Thermal hook symbol
        ctx.beginPath();
        ctx.moveTo(x - 3, -12);
        ctx.lineTo(x + 3, -12);
        ctx.stroke();
      });

      // Gang dashed bar linking all 3 poles
      ctx.strokeStyle = '#ffd600';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pins 1,3,5 & 2,4,6
      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText('1', -20, -16);
      ctx.fillText('3', 0, -16);
      ctx.fillText('5', 20, -16);
      ctx.fillText('2', -20, 20);
      ctx.fillText('4', 0, 20);
      ctx.fillText('6', 20, 20);
    }
  },

  THERMAL_RELAY: {
    type: 'THERMAL_RELAY',
    name: 'Relé Térmico Sobrecarga (-FR)',
    prefix: 'FR',
    category: 'Protección Eléctrica',
    width: 60,
    height: 50,
    role: 'switch',
    switchType: 'thermal',
    defaultState: { closed: true, tripped: false },
    pins: [
      { id: '1', label: '1', x: -20, y: -25 },
      { id: '2', label: '2', x: -20, y: 25 },
      { id: '3', label: '3', x: 0, y: -25 },
      { id: '4', label: '4', x: 0, y: 25 },
      { id: '5', label: '5', x: 20, y: -25 },
      { id: '6', label: '6', x: 20, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isTripped = comp.state?.tripped ?? false;
      ctx.strokeStyle = isTripped ? '#ff3d00' : '#00e5ff';
      ctx.lineWidth = 2;

      const poles = [-20, 0, 20];
      poles.forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, -25);
        ctx.lineTo(x, -8);
        ctx.stroke();

        // Bimetal rectangle symbol
        ctx.strokeRect(x - 4, -8, 8, 16);

        ctx.beginPath();
        ctx.moveTo(x, 8);
        ctx.lineTo(x, 25);
        ctx.stroke();
      });

      // Dashed gang link
      ctx.strokeStyle = '#ff9100';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  THERMAL_CONTACT_NC: {
    type: 'THERMAL_CONTACT_NC',
    name: 'Contacto Auxiliar Térmico 95-96 NC (-FR)',
    prefix: 'FR',
    category: 'Protección Eléctrica',
    width: 30,
    height: 50,
    role: 'contact',
    contactType: 'NC',
    linkedRole: 'thermal',
    pins: [
      { id: '95', label: '95', x: 0, y: -25 },
      { id: '96', label: '96', x: 0, y: 25 }
    ],
    draw(ctx, comp, sim) {
      // In normal condition NC is closed; when tripped it opens
      const isTripped = comp.state?.tripped ?? false;
      const isOpen = isTripped;

      ctx.strokeStyle = isOpen ? '#ff3d00' : '#00e5ff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -10);
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 25);
      ctx.stroke();

      ctx.beginPath();
      if (!isOpen) {
        ctx.moveTo(0, 10);
        ctx.lineTo(0, -10);
        // NC bridge diagonal notch
        ctx.moveTo(-5, -10);
        ctx.lineTo(5, -10);
      } else {
        ctx.moveTo(0, 10);
        ctx.lineTo(12, -8);
      }
      ctx.stroke();

      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'right';
      ctx.fillText('95', -5, -15);
      ctx.fillText('96', -5, 20);
    }
  },

  // ==========================================
  // MANDOS Y ACTUADORES
  // ==========================================
  BUTTON_NO: {
    type: 'BUTTON_NO',
    name: 'Pulsador NA Marcha / Start (-SB)',
    prefix: 'SB',
    category: 'Mandos y Actuadores',
    width: 30,
    height: 50,
    role: 'switch',
    switchType: 'momentary_NO',
    defaultState: { closed: false, pressed: false },
    pins: [
      { id: '13', label: '13', x: 0, y: -25 },
      { id: '14', label: '14', x: 0, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isPressed = comp.state?.pressed || comp.state?.closed;
      ctx.strokeStyle = isPressed ? '#00e676' : '#00e5ff';
      ctx.lineWidth = 2;

      // Vertical terminal lines
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -10);
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 25);
      ctx.stroke();

      // Pushbutton actuator bar & blade
      ctx.beginPath();
      if (isPressed) {
        ctx.moveTo(0, 10);
        ctx.lineTo(0, -10);
        // Pushbutton cap bar
        ctx.moveTo(-8, 0);
        ctx.lineTo(-14, 0);
        ctx.moveTo(-14, -6);
        ctx.lineTo(-14, 6);
      } else {
        ctx.moveTo(0, 10);
        ctx.lineTo(10, -8);
        ctx.moveTo(6, 0);
        ctx.lineTo(0, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
      }
      ctx.stroke();

      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'right';
      ctx.fillText('13', -5, -16);
      ctx.fillText('14', -5, 20);
    }
  },

  BUTTON_NC: {
    type: 'BUTTON_NC',
    name: 'Pulsador NC Paro / Stop (-SB)',
    prefix: 'SB',
    category: 'Mandos y Actuadores',
    width: 30,
    height: 50,
    role: 'switch',
    switchType: 'momentary_NC',
    defaultState: { closed: true, pressed: false },
    pins: [
      { id: '11', label: '11', x: 0, y: -25 },
      { id: '12', label: '12', x: 0, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isPressed = comp.state?.pressed || !comp.state?.closed;
      ctx.strokeStyle = isPressed ? '#ff3d00' : '#00e5ff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -10);
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 25);
      ctx.stroke();

      ctx.beginPath();
      if (!isPressed) {
        // Closed at rest
        ctx.moveTo(0, 10);
        ctx.lineTo(0, -10);
        ctx.moveTo(-5, -10);
        ctx.lineTo(5, -10);
        // Pushbutton bar
        ctx.moveTo(0, 0);
        ctx.lineTo(-6, 0);
        ctx.moveTo(-6, -6);
        ctx.lineTo(-6, 6);
      } else {
        // Opened when pressed
        ctx.moveTo(0, 10);
        ctx.lineTo(12, -8);
        ctx.moveTo(6, 0);
        ctx.lineTo(0, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
      }
      ctx.stroke();

      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'right';
      ctx.fillText('11', -5, -16);
      ctx.fillText('12', -5, 20);
    }
  },

  // Contactor: the coil is a square with a lead above and a lead below.
  // The switch is the contact that coil pulls in. Both share the tag -Kn.
  CONTACTOR_COIL: {
    type: 'CONTACTOR_COIL',
    name: 'Bobina de contactor',
    prefix: '-K',
    category: 'Lo más usado',
    library: true,
    width: 34,
    height: 56,
    role: 'coil',
    io: 'out',
    pinRadius: 1.6,
    pinLinks: [],
    pins: [
      { id: 'A1', label: 'A1', x: 0, y: -25 },
      { id: 'A2', label: 'A2', x: 0, y: 25 }
    ],
    primitives: [
      { id: 'coil-top', type: 'line', x1: 0, y1: -25, x2: 0, y2: -12, stroke: '#00e5ff', strokeWidth: 2 },
      { id: 'coil-box', type: 'rect', x: -12, y: -12, width: 24, height: 24, stroke: '#00e5ff', strokeWidth: 2, fill: 'none' },
      { id: 'coil-bottom', type: 'line', x1: 0, y1: 12, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 }
    ],
    draw(ctx, comp) {
      const isEnergized = !!comp?.energized;
      ctx.strokeStyle = isEnergized ? '#00e676' : '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -12);
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 25);
      ctx.stroke();
      if (isEnergized) {
        ctx.fillStyle = 'rgba(0, 230, 118, 0.22)';
        ctx.fillRect(-12, -12, 24, 24);
      }
      ctx.strokeRect(-12, -12, 24, 24);
    }
  },

  CONTACTOR_CONTACT: {
    type: 'CONTACTOR_CONTACT',
    name: 'Switch del contactor',
    prefix: '-K',
    category: 'Lo más usado',
    library: true,
    width: 30,
    height: 56,
    role: 'contact',
    io: 'out',
    contactType: 'NO',
    followsRole: 'coil',
    defaultState: { closed: false },
    pinRadius: 1.6,
    pinLinks: [
      { id: 'link_13_14', from: '13', to: '14' }
    ],
    pins: [
      { id: '13', label: '13', x: 0, y: -25 },
      { id: '14', label: '14', x: 0, y: 25 }
    ],
    primitives: [
      { id: 'sw-top', type: 'line', x1: 0, y1: -25, x2: 0, y2: -10, stroke: '#00e5ff', strokeWidth: 2 },
      { id: 'sw-bottom', type: 'line', x1: 0, y1: 10, x2: 0, y2: 25, stroke: '#00e5ff', strokeWidth: 2 },
      { id: 'sw-blade', type: 'line', x1: 0, y1: 10, x2: 11, y2: -8, stroke: '#00e5ff', strokeWidth: 2, isBlade: true }
    ],
    draw(ctx, comp) {
      const isClosed = !!comp?.state?.closed;
      ctx.strokeStyle = isClosed ? '#00e676' : '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -10);
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 25);
      if (isClosed) {
        ctx.moveTo(0, 10);
        ctx.lineTo(0, -10);
      } else {
        ctx.moveTo(0, 10);
        ctx.lineTo(11, -8);
      }
      ctx.stroke();
    }
  },

  COIL: {
    type: 'COIL',
    name: 'Bobina de Contactor / Relé (-KM)',
    prefix: 'KM',
    category: 'Lo más usado',
    width: 34,
    height: 55,
    role: 'coil',
    pins: [
      { id: 'A1', label: 'A1', x: 0, y: -25 },
      { id: 'A2', label: 'A2', x: 0, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isEnergized = comp.energized;
      ctx.strokeStyle = isEnergized ? '#00e676' : '#00e5ff';
      ctx.lineWidth = 2;

      // Upper & lower terminal leads
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -15);
      ctx.moveTo(0, 15);
      ctx.lineTo(0, 25);
      ctx.stroke();

      // Coil rectangle box
      ctx.fillStyle = isEnergized ? 'rgba(0, 230, 118, 0.25)' : '#141822';
      ctx.fillRect(-12, -15, 24, 30);
      ctx.strokeRect(-12, -15, 24, 30);

      // Diagonal line inside coil or active glow
      if (isEnergized) {
        ctx.save();
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00e676';
        ctx.fill();
        ctx.restore();
      }

      // Pin labels A1, A2
      ctx.fillStyle = '#81d4fa';
      ctx.font = 'bold 8px Consolas';
      ctx.textAlign = 'right';
      ctx.fillText('A1', -14, -18);
      ctx.fillText('A2', -14, 22);

      // Tag inside coil
      ctx.fillStyle = isEnergized ? '#ffffff' : '#ffd600';
      ctx.font = 'bold 9px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText(comp.tag || 'KM1', 0, isEnergized ? 9 : 3);
    }
  },

  CONTACT_NO: {
    type: 'CONTACT_NO',
    name: 'Contacto Auxiliar NA (13-14) (-KM)',
    prefix: 'KM',
    category: 'Lo más usado',
    width: 30,
    height: 50,
    role: 'contact',
    contactType: 'NO',
    pins: [
      { id: '13', label: '13', x: 0, y: -25 },
      { id: '14', label: '14', x: 0, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isClosed = comp.state?.closed ?? false;
      ctx.strokeStyle = isClosed ? '#00e676' : '#00e5ff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -10);
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 25);
      ctx.stroke();

      ctx.beginPath();
      if (isClosed) {
        ctx.moveTo(0, 10);
        ctx.lineTo(0, -10);
      } else {
        ctx.moveTo(0, 10);
        ctx.lineTo(10, -8);
      }
      ctx.stroke();

      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'right';
      ctx.fillText('13', -5, -16);
      ctx.fillText('14', -5, 20);
    }
  },

  CONTACT_NC: {
    type: 'CONTACT_NC',
    name: 'Contacto Auxiliar NC (21-22) (-KM)',
    prefix: 'KM',
    category: 'Lo más usado',
    width: 30,
    height: 50,
    role: 'contact',
    contactType: 'NC',
    pins: [
      { id: '21', label: '21', x: 0, y: -25 },
      { id: '22', label: '22', x: 0, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isClosed = comp.state?.closed ?? true;
      ctx.strokeStyle = isClosed ? '#00e5ff' : '#ff3d00';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -10);
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 25);
      ctx.stroke();

      ctx.beginPath();
      if (isClosed) {
        ctx.moveTo(0, 10);
        ctx.lineTo(0, -10);
        ctx.moveTo(-5, -10);
        ctx.lineTo(5, -10);
      } else {
        ctx.moveTo(0, 10);
        ctx.lineTo(10, -8);
      }
      ctx.stroke();

      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'right';
      ctx.fillText('21', -5, -16);
      ctx.fillText('22', -5, 20);
    }
  },

  POWER_CONTACTS_3P: {
    type: 'POWER_CONTACTS_3P',
    name: 'Contactos Principales de Potencia 3P (-KM)',
    prefix: 'KM',
    category: 'Lo más usado',
    width: 60,
    height: 55,
    role: 'contact',
    contactType: 'power_3p',
    pins: [
      { id: '1', label: '1', x: -20, y: -25 },
      { id: '2', label: '2', x: -20, y: 25 },
      { id: '3', label: '3', x: 0, y: -25 },
      { id: '4', label: '4', x: 0, y: 25 },
      { id: '5', label: '5', x: 20, y: -25 },
      { id: '6', label: '6', x: 20, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isClosed = comp.state?.closed ?? false;
      ctx.strokeStyle = isClosed ? '#00e676' : '#00e5ff';
      ctx.lineWidth = 2;

      const poles = [-20, 0, 20];
      poles.forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, -25);
        ctx.lineTo(x, -10);
        ctx.moveTo(x, 10);
        ctx.lineTo(x, 25);
        ctx.stroke();

        ctx.beginPath();
        if (isClosed) {
          ctx.moveTo(x, 10);
          ctx.lineTo(x, -10);
        } else {
          ctx.moveTo(x, 10);
          ctx.lineTo(x + 10, -8);
        }
        ctx.stroke();
      });

      // Gang dashed bar
      ctx.strokeStyle = '#ffd600';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText('1', -20, -16);
      ctx.fillText('3', 0, -16);
      ctx.fillText('5', 20, -16);
      ctx.fillText('2', -20, 20);
      ctx.fillText('4', 0, 20);
      ctx.fillText('6', 20, 20);
    }
  },

  // ==========================================
  // CARGAS Y MOTORES
  // ==========================================
  PILOT_LIGHT: {
    type: 'PILOT_LIGHT',
    name: 'Piloto de Señalización (-HL / -H)',
    prefix: 'HL',
    category: 'Cargas y Motores',
    width: 34,
    height: 50,
    role: 'load',
    pins: [
      { id: 'X1', label: 'X1', x: 0, y: -25 },
      { id: 'X2', label: 'X2', x: 0, y: 25 }
    ],
    draw(ctx, comp, sim) {
      const isLit = comp.energized;
      const lightColor = comp.color || '#ffd600'; // Yellow, Green, Red

      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;

      // Terminal lines
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -12);
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 25);
      ctx.stroke();

      // Lamp circle
      ctx.save();
      if (isLit) {
        ctx.shadowColor = lightColor;
        ctx.shadowBlur = 18;
      }
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = isLit ? lightColor : '#181d26';
      ctx.fill();
      ctx.strokeStyle = isLit ? '#ffffff' : '#00e5ff';
      ctx.stroke();
      ctx.restore();

      // Cross inside circle (X)
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(8, -8);
      ctx.lineTo(-8, 8);
      ctx.strokeStyle = isLit ? '#000000' : '#00e5ff';
      ctx.stroke();

      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'right';
      ctx.fillText('X1', -14, -18);
      ctx.fillText('X2', -14, 22);
    }
  },

  MOTOR_3P: {
    type: 'MOTOR_3P',
    name: 'Motor Trifásico Asíncrono 3~ (-M)',
    prefix: 'M',
    category: 'Cargas y Motores',
    width: 60,
    height: 65,
    role: 'motor',
    voltage: '400V 50Hz',
    power: '4kW',
    pins: [
      { id: 'U1', label: 'U1', x: -20, y: -30 },
      { id: 'V1', label: 'V1', x: 0, y: -30 },
      { id: 'W1', label: 'W1', x: 20, y: -30 },
      { id: 'PE', label: 'PE', x: 25, y: 15 }
    ],
    draw(ctx, comp, sim) {
      const isRunning = comp.energized;

      ctx.strokeStyle = isRunning ? '#00e676' : '#00e5ff';
      ctx.lineWidth = 2;

      // Terminals U1, V1, W1
      [-20, 0, 20].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, -30);
        ctx.lineTo(x, -18);
        ctx.stroke();
      });

      // PE ground pin lead
      ctx.beginPath();
      ctx.moveTo(18, 15);
      ctx.lineTo(25, 15);
      ctx.stroke();

      // Main motor circle
      ctx.save();
      if (isRunning) {
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 15;
      }
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fillStyle = isRunning ? '#143823' : '#141822';
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // "M 3~" Text
      ctx.fillStyle = isRunning ? '#00e676' : '#ffffff';
      ctx.font = 'bold 11px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText('M', 0, -2);
      ctx.font = '9px Consolas';
      ctx.fillText('3 ~', 0, 10);

      // Rotation indication if running
      if (isRunning) {
        ctx.save();
        ctx.strokeStyle = '#ffd600';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -0.2 * Math.PI, 0.4 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = '#81d4fa';
      ctx.font = '8px Consolas';
      ctx.textAlign = 'center';
      ctx.fillText('U1', -20, -22);
      ctx.fillText('V1', 0, -22);
      ctx.fillText('W1', 20, -22);
      ctx.fillText('PE', 32, 18);
    }
  },

  // ==========================================
  // CONECTORES Y BORNES
  // ==========================================
  TERMINAL_BLOCK: {
    type: 'TERMINAL_BLOCK',
    name: 'Borne de Paso / Clemencia (-X)',
    prefix: 'X',
    category: 'Lo más usado',
    width: 20,
    height: 40,
    role: 'passive',
    pins: [
      { id: '1', label: '1', x: 0, y: -20 },
      { id: '2', label: '2', x: 0, y: 20 }
    ],
    draw(ctx, comp, sim) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, -5);
      ctx.moveTo(0, 5);
      ctx.lineTo(0, 20);
      ctx.stroke();

      // Terminal circle
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#151921';
      ctx.fill();
      ctx.stroke();
    }
  }
};
