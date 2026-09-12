// ============================================================================
// GEMSIM: MAIN SERVER ENTRY POINT
// Express REST API + WebSocket Real-Time Telemetry Server
// ============================================================================

import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { scenariosRouter } from './routes/scenarios.js';
import { sessionsRouter } from './routes/sessions.js';
import { studioRouter } from './routes/studio.js';
import { aiRouter } from './routes/ai.js';
import { docsRouter } from './routes/docs.js';
import { initWebSocketServer } from './socket/handler.js';
import { DatabaseRepository } from './db/index.js';
import { AIRegistry } from './ai/registry.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Initialize DB and AI Singleton
const db = DatabaseRepository.getInstance();
const aiRegistry = AIRegistry.getInstance();

// REST API Routes
app.use('/api/scenarios', scenariosRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/studio', studioRouter);
app.use('/api/ai', aiRouter);
app.use('/api/docs', docsRouter);

// System Health Check
app.get('/api/health', (req, res) => {
  const activeAi = aiRegistry.getActiveProvider();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    aiProvider: activeAi.providerType,
    sessionsCount: db.getSessions().length,
    scenariosCount: db.getScenarios().length,
  });
});

// Serve frontend SPA static assets if built
const clientDistPath = path.resolve(__dirname, '../public');
if (fs.existsSync(clientDistPath)) {
  console.log(`[GemSim Server] Serving static SPA assets from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  console.log(`[GemSim Server] Running in API mode (Client dev server expected on port 3000)`);
}

// Attach WebSockets
initWebSocketServer(server);

// Start HTTP Server
server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`💎 GemSim Platform Server online at http://${HOST}:${PORT}`);
  console.log(`🌐 Real-time WebSocket gateway at ws://${HOST}:${PORT}/ws`);
  console.log(`🤖 Active AI Engine: ${aiRegistry.getActiveProvider().providerType}`);
  console.log(`=======================================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[GemSim Server] Received SIGTERM. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
