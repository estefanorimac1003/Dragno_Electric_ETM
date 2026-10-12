import os from 'os';

// Terminal ANSI Color Codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
};

function getTimestamp() {
  const d = new Date();
  return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export const logger = {
  info(tag, message, extra = null) {
    const time = `${c.gray}[${getTimestamp()}]${c.reset}`;
    const badge = `${c.cyan}${c.bold}[INFO::${tag}]${c.reset}`;
    console.log(`${time} ${badge} ${message}`);
    if (extra) console.log(`${c.gray}   └─ Detalle:${c.reset}`, extra);
  },

  success(tag, message, extra = null) {
    const time = `${c.gray}[${getTimestamp()}]${c.reset}`;
    const badge = `${c.green}${c.bold}[OK::${tag}]${c.reset}`;
    console.log(`${time} ${badge} ${message}`);
    if (extra) console.log(`${c.gray}   └─ Datos:${c.reset}`, extra);
  },

  warn(tag, message, extra = null) {
    const time = `${c.gray}[${getTimestamp()}]${c.reset}`;
    const badge = `${c.yellow}${c.bold}[ADVERTENCIA::${tag}]${c.reset}`;
    console.warn(`${time} ${badge} ${c.yellow}${message}${c.reset}`);
    if (extra) console.warn(`${c.gray}   └─ Contexto:${c.reset}`, extra);
  },

  error(tag, message, err = null) {
    const time = `${c.gray}[${getTimestamp()}]${c.reset}`;
    const badge = `${c.bgRed}${c.white}${c.bold} [ERROR::${tag}] ${c.reset}`;
    console.error(`\n${time} ${badge} ${c.red}${c.bold}${message}${c.reset}`);
    if (err) {
      if (err.stack) {
        console.error(`${c.red}${err.stack}${c.reset}\n`);
      } else {
        console.error(`${c.red}Detalles del error:`, err, `${c.reset}\n`);
      }
    }
  },

  http(method, url, statusCode, durationMs, reqSize = 0, resSize = 0, ip = '') {
    const time = `${c.gray}[${getTimestamp()}]${c.reset}`;
    
    // Status color
    let statusColor = c.green;
    if (statusCode >= 400 && statusCode < 500) statusColor = c.yellow;
    if (statusCode >= 500) statusColor = c.red;

    // Method color
    let methodColor = c.cyan;
    if (method === 'POST') methodColor = c.magenta;
    if (method === 'DELETE') methodColor = c.red;
    if (method === 'PUT') methodColor = c.yellow;

    const methodBadge = `${methodColor}${c.bold}${method.padEnd(6)}${c.reset}`;
    const statusBadge = `${statusColor}${c.bold}${statusCode}${c.reset}`;
    const durationBadge = `${c.gray}(${durationMs.toFixed(1)}ms)${c.reset}`;
    const sizeBadge = reqSize ? `${c.dim}[In: ${(reqSize / 1024).toFixed(1)}KB]${c.reset}` : '';
    const ipStr = ip ? `${c.dim}${ip}${c.reset}` : '';

    console.log(`${time} ${c.blue}[HTTP]${c.reset} ${methodBadge} ${url} ${statusBadge} ${durationBadge} ${sizeBadge} ${ipStr}`);
  },

  banner(port) {
    const mem = process.memoryUsage();
    const memRssMB = (mem.rss / 1024 / 1024).toFixed(1);
    const memHeapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);

    console.log(`\n${c.cyan}${c.bold}======================================================================${c.reset}`);
    console.log(`${c.yellow}${c.bold}       ⚡  DRAGNO ELECTRIC CAD - SERVIDOR BACKEND ACTIVO  ⚡          ${c.reset}`);
    console.log(`${c.cyan}======================================================================${c.reset}`);
    console.log(`  ${c.white}${c.bold}Puerto de Escucha:${c.reset}     http://localhost:${port}`);
    console.log(`  ${c.white}${c.bold}Proceso PID:${c.reset}           ${process.pid}`);
    console.log(`  ${c.white}${c.bold}Versión Node.js:${c.reset}       ${process.version}`);
    console.log(`  ${c.white}${c.bold}Plataforma / SO:${c.reset}       ${os.type()} ${os.release()} (${os.arch()})`);
    console.log(`  ${c.white}${c.bold}Memoria Usada:${c.reset}         ${memHeapMB} MB (Heap) / ${memRssMB} MB (RSS)`);
    console.log(`  ${c.white}${c.bold}Directorio de Trabajo:${c.reset} ${process.cwd()}`);
    console.log(`  ${c.white}${c.bold}Endpoints Activos:${c.reset}`);
    console.log(`     • ${c.green}GET${c.reset}  /api/health            (Verificación de estado)`);
    console.log(`     • ${c.green}GET${c.reset}  /api/projects/presets  (Esquemas preconfigurados)`);
    console.log(`     • ${c.magenta}POST${c.reset} /api/dxf/export        (Generador y conversión DXF)`);
    console.log(`${c.cyan}----------------------------------------------------------------------${c.reset}`);
    console.log(`  ${c.gray}Registrando todas las peticiones, eventos y posibles errores en vivo...${c.reset}\n`);
  }
};
