#!/usr/bin/env node

/**
 * printer-bridge - WebSocket to TCP bridge for browser-to-printer communication
 *
 * This server acts as a bridge between web browsers (using WebSocket) and
 * ESC-POS printers (using TCP sockets). This allows the web editor to send
 * print jobs directly to network printers.
 *
 * Usage:
 *   printer-bridge [--port <websocket-port>]
 *   printer-bridge --help
 *
 * Examples:
 *   printer-bridge                 # Start on default port 8765
 *   printer-bridge --port 9000     # Start on custom port
 */

const WebSocket = require('ws');
const net = require('net');
const http = require('http');

// ===================================================================
// Configuration
// ===================================================================

const DEFAULT_WS_PORT = 8765;
const TIMEOUT = 5000; // 5 seconds

// Printer database (from devices/printers.ts)
const PRINTERS = {
    'netum': {
        name: 'Netum 80-V-UL',
        host: '192.168.1.100',
        port: 9100,
        type: 'thermal',
        width: 80,
    },
};

// ===================================================================
// CLI Argument Parser
// ===================================================================

function parseArgs() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        process.exit(0);
    }

    let wsPort = DEFAULT_WS_PORT;

    if (args.includes('--port') || args.includes('-p')) {
        const portIndex = args.findIndex(arg => arg === '--port' || arg === '-p');
        if (portIndex >= 0 && args[portIndex + 1]) {
            wsPort = parseInt(args[portIndex + 1], 10);
            if (isNaN(wsPort) || wsPort < 1 || wsPort > 65535) {
                console.error(`Error: Invalid port '${args[portIndex + 1]}'`);
                process.exit(1);
            }
        }
    }

    return { wsPort };
}

function printHelp() {
    console.log(`
printer-bridge - WebSocket to TCP bridge for browser-to-printer communication

USAGE:
  printer-bridge [--port <port>]

OPTIONS:
  -p, --port <port>    WebSocket server port (default: ${DEFAULT_WS_PORT})
  -h, --help           Show this help

EXAMPLES:
  # Start with default port
  printer-bridge

  # Start on custom port
  printer-bridge --port 9000

PROTOCOL:
  The WebSocket server accepts JSON messages:

  Send to printer:
    {
      "action": "send",
      "printer": "netum",           // Or specify host/port
      "host": "192.168.1.100",     // Optional if printer name given
      "port": 9100,                 // Optional if printer name given
      "data": [0x1B, 0x40, ...]    // Array of bytes
    }

  List printers:
    {
      "action": "list"
    }

  Response:
    {
      "success": true,
      "message": "Sent 123 bytes",
      "bytesSent": 123
    }

  Error:
    {
      "success": false,
      "error": "Connection failed: ...",
      "code": "CONNECTION_ERROR"
    }

SECURITY:
  This server should only be run on localhost for development.
  Do NOT expose this server to the internet or untrusted networks.

NOTES:
  - Server binds to 127.0.0.1 (localhost only) for security
  - CORS is not needed as WebSocket connections are from same origin
  - Default timeout: 5 seconds per print job
`);
}

// ===================================================================
// TCP Socket Sender
// ===================================================================

/**
 * Send data to a TCP socket
 * @param {string} host - Printer host
 * @param {number} port - Printer port
 * @param {Buffer} data - Data to send
 * @returns {Promise<{bytesSent: number}>}
 */
function sendToSocket(host, port, data) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let connected = false;
        let bytesSent = 0;

        client.setTimeout(TIMEOUT);

        client.on('timeout', () => {
            client.destroy();
            reject({ code: 'TIMEOUT', message: `Connection timeout after ${TIMEOUT}ms` });
        });

        client.on('error', (err) => {
            reject({ code: 'CONNECTION_ERROR', message: err.message });
        });

        client.on('connect', () => {
            connected = true;
            client.write(data, (err) => {
                if (err) {
                    reject({ code: 'WRITE_ERROR', message: err.message });
                    return;
                }
                bytesSent = data.length;
            });
        });

        client.on('drain', () => {
            client.end();
        });

        client.on('close', () => {
            if (connected && bytesSent === data.length) {
                resolve({ bytesSent });
            } else if (!connected) {
                reject({ code: 'CONNECTION_CLOSED', message: 'Connection closed before sending data' });
            }
        });

        client.connect(port, host);
    });
}

// ===================================================================
// WebSocket Message Handler
// ===================================================================

/**
 * Handle incoming WebSocket message
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} message - JSON message
 */
async function handleMessage(ws, message) {
    let request;

    try {
        request = JSON.parse(message);
    } catch (err) {
        ws.send(JSON.stringify({
            success: false,
            error: 'Invalid JSON',
            code: 'PARSE_ERROR'
        }));
        return;
    }

    const { action } = request;

    if (action === 'list') {
        // List configured printers
        ws.send(JSON.stringify({
            success: true,
            printers: PRINTERS
        }));
        return;
    }

    if (action === 'send') {
        // Send data to printer
        let { printer, host, port, data } = request;

        // Resolve printer name to host/port
        if (printer && PRINTERS[printer]) {
            host = PRINTERS[printer].host;
            port = PRINTERS[printer].port;
        }

        // Validate
        if (!host || !port) {
            ws.send(JSON.stringify({
                success: false,
                error: 'Missing host or port',
                code: 'INVALID_REQUEST'
            }));
            return;
        }

        if (!data || !Array.isArray(data)) {
            ws.send(JSON.stringify({
                success: false,
                error: 'Missing or invalid data (must be array of bytes)',
                code: 'INVALID_DATA'
            }));
            return;
        }

        // Convert to Buffer
        const buffer = Buffer.from(data);

        // Send to printer
        try {
            const result = await sendToSocket(host, port, buffer);
            ws.send(JSON.stringify({
                success: true,
                message: `Sent ${result.bytesSent} bytes to ${host}:${port}`,
                bytesSent: result.bytesSent
            }));
        } catch (error) {
            ws.send(JSON.stringify({
                success: false,
                error: error.message,
                code: error.code || 'UNKNOWN_ERROR'
            }));
        }

        return;
    }

    // Unknown action
    ws.send(JSON.stringify({
        success: false,
        error: `Unknown action: ${action}`,
        code: 'UNKNOWN_ACTION'
    }));
}

// ===================================================================
// WebSocket Server
// ===================================================================

/**
 * Create and start WebSocket server
 * @param {number} port - Port to listen on
 */
function startServer(port) {
    // Create HTTP server for WebSocket
    const server = http.createServer((req, res) => {
        // Health check endpoint
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', printers: Object.keys(PRINTERS) }));
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    });

    // Create WebSocket server
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('Client connected');

        ws.on('message', (message) => {
            console.log('Received:', message.toString().substring(0, 100));
            handleMessage(ws, message.toString());
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error.message);
        });

        // Send welcome message
        ws.send(JSON.stringify({
            success: true,
            message: 'Connected to printer bridge',
            printers: Object.keys(PRINTERS)
        }));
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`
┌─────────────────────────────────────────────┐
│  Printer Bridge Server                      │
├─────────────────────────────────────────────┤
│  WebSocket: ws://127.0.0.1:${port.toString().padEnd(19)}│
│  Health:    http://127.0.0.1:${port}/health   │
├─────────────────────────────────────────────┤
│  Configured Printers:                       │
${Object.entries(PRINTERS).map(([name, p]) =>
    `│    ${name.padEnd(10)} ${p.host}:${p.port}`.padEnd(46) + '│'
).join('\n')}
├─────────────────────────────────────────────┤
│  Security: localhost only (127.0.0.1)       │
│  Press Ctrl+C to stop                       │
└─────────────────────────────────────────────┘
`);
    });

    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down...');
        wss.close(() => {
            server.close(() => {
                console.log('Server stopped');
                process.exit(0);
            });
        });
    });
}

// ===================================================================
// Main
// ===================================================================

function main() {
    const { wsPort } = parseArgs();
    startServer(wsPort);
}

if (require.main === module) {
    main();
}

module.exports = { sendToSocket, handleMessage };
