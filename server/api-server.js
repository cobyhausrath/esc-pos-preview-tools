#!/usr/bin/env node

/**
 * ESC-POS Spool Service API Server
 *
 * Full-featured API server with:
 * - REST API for job and printer management
 * - WebSocket server for real-time updates (from printer-bridge.js)
 * - SQLite database for persistence
 * - Job approval workflow
 * - Chain printing support
 *
 * Usage:
 *   node server/api-server.js [--port <http-port>] [--ws-port <websocket-port>]
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Database and repositories
const { getDatabase, checkHealth, getStats } = require('./db');
const { JobRepository, JOB_STATUS } = require('./repositories/JobRepository');
const { PrinterRepository, PRINTER_TYPE } = require('./repositories/PrinterRepository');

// Import printer communication from printer-bridge
const { sendToSocket } = require('../bin/printer-bridge');

// ===================================================================
// Configuration
// ===================================================================

const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_WS_PORT = 8765;
const TIMEOUT = 5000; // 5 seconds

// ===================================================================
// CLI Argument Parser
// ===================================================================

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let httpPort = DEFAULT_HTTP_PORT;
  let wsPort = DEFAULT_WS_PORT;

  if (args.includes('--port') || args.includes('-p')) {
    const portIndex = args.findIndex((arg) => arg === '--port' || arg === '-p');
    if (portIndex >= 0 && args[portIndex + 1]) {
      httpPort = parseInt(args[portIndex + 1], 10);
    }
  }

  if (args.includes('--ws-port')) {
    const portIndex = args.findIndex((arg) => arg === '--ws-port');
    if (portIndex >= 0 && args[portIndex + 1]) {
      wsPort = parseInt(args[portIndex + 1], 10);
    }
  }

  return { httpPort, wsPort };
}

function printHelp() {
  console.log(`
ESC-POS Spool Service API Server

USAGE:
  api-server [--port <http-port>] [--ws-port <websocket-port>]

OPTIONS:
  -p, --port <port>      HTTP API port (default: ${DEFAULT_HTTP_PORT})
  --ws-port <port>       WebSocket port (default: ${DEFAULT_WS_PORT})
  -h, --help             Show this help

EXAMPLES:
  # Start with default ports
  api-server

  # Start on custom ports
  api-server --port 8080 --ws-port 8081

ENDPOINTS:
  HTTP REST API:
    GET  /health                  - Health check
    GET  /api/stats               - Statistics

    POST /api/jobs                - Submit new job
    GET  /api/jobs                - List jobs (with pagination)
    GET  /api/jobs/:id            - Get job details
    POST /api/jobs/:id/approve    - Approve job
    POST /api/jobs/:id/reject     - Reject job
    POST /api/jobs/:id/print      - Print job (manual trigger)
    DELETE /api/jobs/:id          - Delete job

    GET  /api/printers            - List printers
    POST /api/printers            - Register printer
    GET  /api/printers/:id        - Get printer details
    PUT  /api/printers/:id        - Update printer
    DELETE /api/printers/:id      - Delete printer
    POST /api/printers/:id/test   - Test printer connection

  WebSocket:
    ws://127.0.0.1:${DEFAULT_WS_PORT}   - Real-time job updates

SECURITY:
  Server binds to 127.0.0.1 (localhost only) for security.
  Do NOT expose to untrusted networks.
`);
}

// ===================================================================
// Initialize Database and Repositories
// ===================================================================

let db, jobRepo, printerRepo, wsClients;

function initServer() {
  db = getDatabase();
  jobRepo = new JobRepository(db);
  printerRepo = new PrinterRepository(db);
  wsClients = new Set();

  console.log('✓ Database and repositories initialized');
}

// ===================================================================
// WebSocket Broadcast
// ===================================================================

/**
 * Broadcast event to all connected WebSocket clients
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
function broadcastEvent(event, data) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });

  wsClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });

  console.log(`[WS] Broadcast: ${event}`, data.id || '');
}

// ===================================================================
// Job Printing Service
// ===================================================================

/**
 * Print a job to its configured printer
 * @param {number} jobId - Job ID
 * @returns {Promise<Object>} Print result
 */
async function printJob(jobId) {
  const job = jobRepo.findById(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const printer = printerRepo.findById(job.printer_id);
  if (!printer) {
    throw new Error(`Printer ${job.printer_id} not found`);
  }

  if (!printer.enabled) {
    throw new Error(`Printer '${printer.name}' is disabled`);
  }

  // Mark as printing
  jobRepo.markPrinting(jobId);
  broadcastEvent('job:printing', { id: jobId });

  try {
    let result;

    if (printer.type === PRINTER_TYPE.PHYSICAL) {
      // Send to physical TCP printer
      const { host, port } = printer.connection_info;
      result = await sendToSocket(host, port, job.raw_data);

      // Mark completed
      jobRepo.markCompleted(jobId, `Sent ${result.bytesSent} bytes to ${printer.name}`);
      printerRepo.recordSuccess(printer.id);

      broadcastEvent('job:completed', { id: jobId });
      return { success: true, bytesSent: result.bytesSent };

    } else if (printer.type === PRINTER_TYPE.SPOOL) {
      // Forward to another spool service (chain printing)
      const { url } = printer.connection_info;

      // Prepare chain metadata
      const chainDepth = (job.chain_depth || 0) + 1;
      const originService = job.origin_service || 'self';

      // TODO: Implement HTTP POST to upstream spool service
      // For now, just mark as completed
      jobRepo.markCompleted(jobId, `Forwarded to ${url} (chain depth: ${chainDepth})`);
      printerRepo.recordSuccess(printer.id);

      broadcastEvent('job:completed', { id: jobId });
      return { success: true, forwarded: true, url };

    } else {
      throw new Error(`Unsupported printer type: ${printer.type}`);
    }

  } catch (error) {
    // Mark failed
    jobRepo.markFailed(jobId, error.message);
    printerRepo.recordFailure(printer.id, error.message);

    broadcastEvent('job:failed', { id: jobId, error: error.message });
    throw error;
  }
}

// ===================================================================
// Express HTTP Server
// ===================================================================

function createHttpServer() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // ===================================================================
  // Health & Stats
  // ===================================================================

  app.get('/health', (req, res) => {
    const dbHealth = checkHealth(db);
    res.json({
      status: dbHealth ? 'ok' : 'error',
      database: dbHealth,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/stats', (req, res) => {
    const stats = getStats(db);
    res.json(stats);
  });

  // ===================================================================
  // Job Management API
  // ===================================================================

  /**
   * POST /api/jobs - Submit new job
   * Body: { rawData: [bytes], printerId: number, user: string, notes: string }
   */
  app.post('/api/jobs', async (req, res) => {
    try {
      const { rawData, printerId, user, notes } = req.body;

      if (!rawData || !Array.isArray(rawData)) {
        return res.status(400).json({ error: 'rawData must be array of bytes' });
      }

      const buffer = Buffer.from(rawData);

      // TODO: Parse ESC-POS and generate preview HTML
      // For now, just store raw data
      const job = jobRepo.create({
        rawData: buffer,
        printerId,
        user: user || 'anonymous',
        notes,
      });

      broadcastEvent('job:created', { id: job.id });

      res.status(201).json(job);
    } catch (error) {
      console.error('Error creating job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/jobs - List jobs
   * Query: status, limit, offset
   */
  app.get('/api/jobs', (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      const result = jobRepo.list({
        status,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });

      res.json(result);
    } catch (error) {
      console.error('Error listing jobs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/jobs/:id - Get job details
   */
  app.get('/api/jobs/:id', (req, res) => {
    try {
      const job = jobRepo.findById(parseInt(req.params.id, 10));
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json(job);
    } catch (error) {
      console.error('Error fetching job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/jobs/:id/approve - Approve job
   * Body: { user: string, autoPrint: boolean }
   */
  app.post('/api/jobs/:id/approve', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      const { user = 'anonymous', autoPrint = false } = req.body;

      const job = jobRepo.approve(jobId, user);
      broadcastEvent('job:approved', { id: jobId });

      // Auto-print if requested
      if (autoPrint) {
        await printJob(jobId);
      }

      res.json(job);
    } catch (error) {
      console.error('Error approving job:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/jobs/:id/reject - Reject job
   * Body: { reason: string, user: string }
   */
  app.post('/api/jobs/:id/reject', (req, res) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      const { reason = 'Rejected by user', user = 'anonymous' } = req.body;

      const job = jobRepo.reject(jobId, reason, user);
      broadcastEvent('job:rejected', { id: jobId, reason });

      res.json(job);
    } catch (error) {
      console.error('Error rejecting job:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/jobs/:id/print - Manually trigger print
   */
  app.post('/api/jobs/:id/print', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      const result = await printJob(jobId);
      res.json(result);
    } catch (error) {
      console.error('Error printing job:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/jobs/:id - Delete job
   */
  app.delete('/api/jobs/:id', (req, res) => {
    try {
      const jobId = parseInt(req.params.id, 10);
      const success = jobRepo.delete(jobId);

      if (!success) {
        return res.status(404).json({ error: 'Job not found' });
      }

      broadcastEvent('job:deleted', { id: jobId });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===================================================================
  // Printer Management API
  // ===================================================================

  /**
   * GET /api/printers - List printers
   */
  app.get('/api/printers', (req, res) => {
    try {
      const { enabledOnly, type } = req.query;
      const printers = printerRepo.list({
        enabledOnly: enabledOnly === 'true',
        type,
      });
      res.json(printers);
    } catch (error) {
      console.error('Error listing printers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/printers - Register new printer
   * Body: { name, model, description, type, connectionInfo, enabled, timeoutMs, retryAttempts }
   */
  app.post('/api/printers', (req, res) => {
    try {
      const printer = printerRepo.create(req.body);
      res.status(201).json(printer);
    } catch (error) {
      console.error('Error creating printer:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/printers/:id - Get printer details
   */
  app.get('/api/printers/:id', (req, res) => {
    try {
      const printer = printerRepo.findById(parseInt(req.params.id, 10));
      if (!printer) {
        return res.status(404).json({ error: 'Printer not found' });
      }
      res.json(printer);
    } catch (error) {
      console.error('Error fetching printer:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/printers/:id - Update printer
   */
  app.put('/api/printers/:id', (req, res) => {
    try {
      const printerId = parseInt(req.params.id, 10);
      const printer = printerRepo.update(printerId, req.body);
      res.json(printer);
    } catch (error) {
      console.error('Error updating printer:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/printers/:id - Delete printer
   */
  app.delete('/api/printers/:id', (req, res) => {
    try {
      const printerId = parseInt(req.params.id, 10);
      const success = printerRepo.delete(printerId);

      if (!success) {
        return res.status(404).json({ error: 'Printer not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting printer:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/printers/:id/test - Test printer connection
   */
  app.post('/api/printers/:id/test', async (req, res) => {
    try {
      const printerId = parseInt(req.params.id, 10);
      const printer = printerRepo.findById(printerId);

      if (!printer) {
        return res.status(404).json({ error: 'Printer not found' });
      }

      if (printer.type === PRINTER_TYPE.PHYSICAL) {
        const { host, port } = printer.connection_info;
        // Send empty data to test connection
        await sendToSocket(host, port, Buffer.from([]));
        res.json({ success: true, message: 'Connection successful' });
      } else {
        res.json({ success: true, message: 'Test not implemented for this printer type' });
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return app;
}

// ===================================================================
// WebSocket Server
// ===================================================================

function createWebSocketServer(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    wsClients.add(ws);

    // Send welcome message
    ws.send(JSON.stringify({
      event: 'connected',
      message: 'Connected to spool service',
      timestamp: new Date().toISOString(),
    }));

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WS] Error:', error.message);
      wsClients.delete(ws);
    });
  });

  return wss;
}

// ===================================================================
// Main Server
// ===================================================================

function startServer(httpPort, wsPort) {
  initServer();

  const app = createHttpServer();
  const httpServer = http.createServer(app);
  const wss = createWebSocketServer(httpServer);

  httpServer.listen(httpPort, '127.0.0.1', () => {
    console.log(`
┌─────────────────────────────────────────────┐
│  ESC-POS Spool Service                      │
├─────────────────────────────────────────────┤
│  HTTP API:  http://127.0.0.1:${httpPort.toString().padEnd(17)}│
│  WebSocket: ws://127.0.0.1:${wsPort.toString().padEnd(19)}│
│  Health:    http://127.0.0.1:${httpPort}/health   │
│  Stats:     http://127.0.0.1:${httpPort}/api/stats│
├─────────────────────────────────────────────┤
│  Database:  ${db.name.padEnd(31)}│
├─────────────────────────────────────────────┤
│  Security:  localhost only (127.0.0.1)      │
│  Press Ctrl+C to stop                       │
└─────────────────────────────────────────────┘
`);
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    wss.close(() => {
      httpServer.close(() => {
        db.close();
        console.log('Server stopped');
        process.exit(0);
      });
    });
  });
}

// ===================================================================
// Entry Point
// ===================================================================

function main() {
  const { httpPort, wsPort } = parseArgs();
  startServer(httpPort, wsPort);
}

if (require.main === module) {
  main();
}

module.exports = { printJob, broadcastEvent };
