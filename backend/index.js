import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDxf } from './services/dxfGenerator.js';
import { SAMPLE_PROJECTS } from './sampleProjects.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Global process exception traps so errors never fail silently
process.on('uncaughtException', (err) => {
  logger.error('PROCESO::EXCEPCIÓN_NO_CAPTURADA', 'Ocurrió un error crítico no capturado en el hilo principal', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('PROCESO::PROMESA_RECHAZADA', 'Promesa asíncrona rechazada sin catch()', reason);
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Request Performance & Access Logging Middleware
app.use((req, res, next) => {
  const startTime = performance.now();
  const reqSize = parseInt(req.headers['content-length'] || '0', 10);
  const clientIp = req.ip || req.socket.remoteAddress || '';

  // Intercept response finish event
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    logger.http(req.method, req.originalUrl || req.url, res.statusCode, duration, reqSize, 0, clientIp);
  });

  next();
});

// 1. Health Check
app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage();
  const healthData = {
    status: 'ok',
    service: 'Dragno Electric CAD API',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: {
      heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
      rss: (mem.rss / 1024 / 1024).toFixed(2)
    },
    timestamp: new Date().toISOString()
  };

  logger.info('HEALTH', `Healthcheck solicitado desde ${req.ip || 'localhost'}. Estado: OK`, healthData);
  res.json(healthData);
});

// 2. Presets & Starter Projects
app.get('/api/projects/presets', (req, res) => {
  logger.info('PROYECTOS', `Entregando ${SAMPLE_PROJECTS.length} esquema(s) predeterminado(s) industriales.`);
  res.json(SAMPLE_PROJECTS);
});

// 3. DXF Export API Endpoint
app.post('/api/dxf/export', (req, res) => {
  const tStart = performance.now();
  try {
    const { sheetConfig = {}, components = [], wires = [], filename } = req.body;

    logger.info('DXF-EXPORT', `Iniciando generación de plano CAD...`, {
      plano: sheetConfig.sheetTitle || 'Sin título',
      formato: sheetConfig.sizeKey || 'A4_HORIZONTAL',
      totalComponentes: components.length,
      totalCables: wires.length
    });

    if (!Array.isArray(components) || !Array.isArray(wires)) {
      const err = new Error('Los campos "components" y "wires" deben ser listas de objetos válidas.');
      logger.warn('DXF-EXPORT', 'Petición inválida recibida en /api/dxf/export', { body: req.body });
      return res.status(400).json({ error: err.message });
    }

    // Component breakdown for transparency
    const compTypes = {};
    components.forEach(c => {
      compTypes[c.type] = (compTypes[c.type] || 0) + 1;
    });

    logger.info('DXF-EXPORT', `Desglose de dispositivos a vectorizar:`, compTypes);

    // Generate standard AutoCAD DXF R12 / R2000
    const dxfContent = generateDxf({
      sheetConfig,
      components,
      wires
    });

    const elapsed = (performance.now() - tStart).toFixed(2);
    const sizeKB = (Buffer.byteLength(dxfContent, 'utf8') / 1024).toFixed(2);
    const exportFileName = filename || `plano_${Date.now()}.dxf`;

    logger.success('DXF-EXPORT', `Plano DXF generado exitosamente en ${elapsed}ms`, {
      archivo: exportFileName,
      tamañoDXF: `${sizeKB} KB`,
      totalLineasDXF: dxfContent.split('\n').length
    });

    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);
    res.send(dxfContent);
  } catch (error) {
    logger.error('DXF-EXPORT', 'Error crítico durante la generación del archivo DXF', error);
    res.status(500).json({
      error: 'Error interno al generar el plano DXF',
      mensaje: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 4. In production, serve frontend client
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    logger.warn('ROUTER', `Ruta API desconocida: ${req.method} ${req.originalUrl}`);
    return res.status(404).json({ error: `Ruta API no encontrada: ${req.originalUrl}` });
  }

  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Dragno Electric Backend</title></head>
          <body style="background:#0c0e12; color:#00e5ff; font-family:monospace; padding:40px;">
            <h2>⚡ Dragno Electric CAD Backend API</h2>
            <p>El servidor API está operando en el puerto ${PORT}.</p>
            <p>Para abrir la interfaz de usuario en desarrollo, ve a: <a style="color:#ffd600" href="http://localhost:5173">http://localhost:5173</a></p>
          </body>
        </html>
      `);
    }
  });
});

// Global Express Error Handler Middleware
app.use((err, req, res, next) => {
  logger.error('EXPRESS::MIDDLEWARE', `Excepción no controlada en ${req.method} ${req.url}`, err);
  res.status(500).json({
    error: 'Error interno del servidor',
    detalle: err.message,
    ruta: req.originalUrl
  });
});

// Start Server & Print System Banner
app.listen(PORT, () => {
  logger.banner(PORT);
});
