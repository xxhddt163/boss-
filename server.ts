import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initWebSocketServer } from './server/ws.ts';
import { loadDB } from './server/db.ts';
import { authRouter } from './server/routes/auth.ts';
import { channelsRouter } from './server/routes/channels.ts';
import { adminRouter } from './server/routes/admin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Initialize persistent database
  loadDB();

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/channels', channelsRouter);
  app.use('/api/admin', adminRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      protocol: req.protocol,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      time: new Date().toISOString(),
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Check if direct SSL certificates are provided for standalone HTTPS
  const defaultCertPath = path.resolve(__dirname, 'certs', 'server.crt');
  const defaultKeyPath = path.resolve(__dirname, 'certs', 'server.key');
  const customCertPath = process.env.SSL_CERT_PATH;
  const customKeyPath = process.env.SSL_KEY_PATH;

  const certPath = customCertPath && fs.existsSync(customCertPath)
    ? customCertPath
    : fs.existsSync(defaultCertPath)
    ? defaultCertPath
    : null;

  const keyPath = customKeyPath && fs.existsSync(customKeyPath)
    ? customKeyPath
    : fs.existsSync(defaultKeyPath)
    ? defaultKeyPath
    : null;

  let server: http.Server | https.Server;
  let isHttps = false;

  if (certPath && keyPath) {
    try {
      const sslOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
      server = https.createServer(sslOptions, app);
      isHttps = true;
      console.log(`[HTTPS] Loaded SSL certificates from:\n  Cert: ${certPath}\n  Key:  ${keyPath}`);
    } catch (err) {
      console.error('[HTTPS] Failed to load SSL certificates, falling back to HTTP:', err);
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }

  // Attach WebSocket server (automatically supports WS over HTTP and WSS over HTTPS)
  initWebSocketServer(server);

  server.listen(PORT, '0.0.0.0', () => {
    const proto = isHttps ? 'https' : 'http';
    console.log(`Snowman Tracker Server listening on ${proto}://0.0.0.0:${PORT}`);
  });

  // Optional: Auto redirect HTTP port (e.g. 80) to HTTPS port if configured
  if (isHttps && process.env.HTTP_REDIRECT_PORT) {
    const redirectPort = parseInt(process.env.HTTP_REDIRECT_PORT, 10);
    if (!isNaN(redirectPort) && redirectPort !== PORT) {
      http
        .createServer((req, res) => {
          const host = req.headers.host?.split(':')[0] || 'localhost';
          const targetPort = PORT === 443 ? '' : `:${PORT}`;
          res.writeHead(301, { Location: `https://${host}${targetPort}${req.url}` });
          res.end();
        })
        .listen(redirectPort, '0.0.0.0', () => {
          console.log(`[HTTP Redirect] Auto-redirecting HTTP :${redirectPort} -> HTTPS :${PORT}`);
        });
    }
  }
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
