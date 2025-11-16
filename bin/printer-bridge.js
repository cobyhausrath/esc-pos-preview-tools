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
const DEFAULT_HOST = '127.0.0.1'; // localhost only by default (secure)
const DEFAULT_TIMEOUT = 5000; // 5 seconds

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
    let wsHost = DEFAULT_HOST;
    let timeout = DEFAULT_TIMEOUT;

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

    if (args.includes('--host')) {
        const hostIndex = args.findIndex(arg => arg === '--host');
        if (hostIndex >= 0 && args[hostIndex + 1]) {
            wsHost = args[hostIndex + 1];
            // Validate host format (basic check)
            if (!wsHost.match(/^(\d{1,3}\.){3}\d{1,3}$/) && wsHost !== 'localhost') {
                console.error(`Error: Invalid host '${wsHost}' (use IP address or 'localhost')`);
                process.exit(1);
            }
        }
    }

    if (args.includes('--timeout') || args.includes('-t')) {
        const timeoutIndex = args.findIndex(arg => arg === '--timeout' || arg === '-t');
        if (timeoutIndex >= 0 && args[timeoutIndex + 1]) {
            timeout = parseInt(args[timeoutIndex + 1], 10);
            if (isNaN(timeout) || timeout < 100 || timeout > 60000) {
                console.error(`Error: Invalid timeout '${args[timeoutIndex + 1]}' (must be between 100-60000ms)`);
                process.exit(1);
            }
        }
    }

    return { wsPort, wsHost, timeout };
}

function printHelp() {
    console.log(`
printer-bridge - WebSocket to TCP bridge for browser-to-printer communication

USAGE:
  printer-bridge [OPTIONS]

OPTIONS:
  -p, --port <port>       WebSocket server port (default: ${DEFAULT_WS_PORT})
      --host <host>       Bind address (default: ${DEFAULT_HOST})
                          Use 0.0.0.0 to allow external connections
                          WARNING: Only use 0.0.0.0 on trusted networks!
  -t, --timeout <ms>      Printer connection timeout in ms (default: ${DEFAULT_TIMEOUT})
                          Range: 100-60000ms
  -h, --help              Show this help

EXAMPLES:
  # Start with default settings (localhost only)
  printer-bridge

  # Start on custom port
  printer-bridge --port 9000

  # Allow external connections (USE WITH CAUTION!)
  printer-bridge --host 0.0.0.0

  # Custom timeout for slow printers
  printer-bridge --timeout 10000

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

  Query printer status:
    {
      "action": "status",
      "printer": "netum",           // Or specify host/port
      "host": "192.168.1.100",     // Optional if printer name given
      "port": 9100                  // Optional if printer name given
    }

  List printers:
    {
      "action": "list"
    }

  Response (send):
    {
      "success": true,
      "message": "Sent 123 bytes",
      "bytesSent": 123
    }

  Response (status):
    {
      "success": true,
      "status": {
        "online": true,
        "paperStatus": "ok" | "low" | "out" | "unknown",
        "coverOpen": false,
        "error": false,
        "errorMessage": null,
        "supported": true,
        "details": { ... }
      }
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

  Using --host 0.0.0.0 allows connections from any network interface.
  Only use this on trusted private networks, never on public networks!

NOTES:
  - Server binds to 127.0.0.1 (localhost only) by default for security
  - Use --host 0.0.0.0 to allow external connections (trusted networks only)
  - CORS is not needed as WebSocket connections are from same origin
  - Timeout applies to both print jobs and status queries
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
 * @param {number} timeout - Connection timeout in ms
 * @returns {Promise<{bytesSent: number}>}
 */
function sendToSocket(host, port, data, timeout = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let connected = false;
        let bytesSent = 0;

        client.setTimeout(timeout);

        client.on('timeout', () => {
            client.destroy();
            reject({ code: 'TIMEOUT', message: `Connection timeout after ${timeout}ms` });
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
// Printer Status Query
// ===================================================================

/**
 * Parse printer status byte (DLE EOT responses)
 * @param {number} statusByte - Status byte from printer
 * @param {number} queryType - Query type (1-4)
 * @returns {Object} Parsed status information
 */
function parseStatusByte(statusByte, queryType) {
    const status = {};

    switch (queryType) {
        case 1: // Printer status (DLE EOT 1)
            // Bit 2: Drawer status
            status.drawerOpen = !!(statusByte & 0x04);
            // Bit 3: Online/offline (0=online, 1=offline)
            status.online = !(statusByte & 0x08);
            // Bit 5: Wait for on-line recover
            status.waitingForRecovery = !!(statusByte & 0x20);
            break;

        case 2: // Off-line status (DLE EOT 2)
            // Bit 2: Top cover (0=close, 1=open)
            status.coverOpen = !!(statusByte & 0x04);
            // Bit 3: Paper feed button (0=not pressed, 1=pressed)
            status.paperFeedButton = !!(statusByte & 0x08);
            // Bit 5: Paper shortage (0=no shortage, 1=shortage/low)
            status.paperShortage = !!(statusByte & 0x20);
            // Bit 6: Error flag (0=no error, 1=error)
            status.error = !!(statusByte & 0x40);
            break;

        case 3: // Error status (DLE EOT 3)
            // Bit 3: Auto-cutter error
            status.cutterError = !!(statusByte & 0x08);
            // Bit 5: Unrecoverable error
            status.unrecoverableError = !!(statusByte & 0x20);
            // Bit 6: Temperature/voltage over range
            status.temperatureError = !!(statusByte & 0x40);
            break;

        case 4: // Paper roll sensor status (DLE EOT 4)
            // Bits 2-3: Paper near-end sensor (0x0C = 12 = paper near end)
            status.paperNearEnd = (statusByte & 0x0C) === 0x0C;
            // Bits 5-6: Paper present sensor (0x60 = 96 = paper not present)
            status.paperNotPresent = (statusByte & 0x60) === 0x60;
            break;
    }

    return status;
}

/**
 * Query printer status using ESC-POS commands
 * @param {string} host - Printer host
 * @param {number} port - Printer port
 * @param {number} timeout - Status query timeout in ms
 * @returns {Promise<Object>} Status information
 */
function queryPrinterStatus(host, port, timeout = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let statusResponses = [];
        let queryIndex = 0;

        // Constants for query timing
        const STATUS_TIMEOUT_MS = Math.min(timeout, 2000); // Use configured timeout, max 2s per query
        const QUERY_DELAY_MS = 50;

        const queries = [
            Buffer.from([0x10, 0x04, 0x01]), // DLE EOT 1 - Printer status
            Buffer.from([0x10, 0x04, 0x02]), // DLE EOT 2 - Offline status
            Buffer.from([0x10, 0x04, 0x03]), // DLE EOT 3 - Error status
            Buffer.from([0x10, 0x04, 0x04]), // DLE EOT 4 - Paper sensor
        ];

        console.log(`[Status Query] Starting query to ${host}:${port}`);
        client.setTimeout(STATUS_TIMEOUT_MS);

        client.on('timeout', () => {
            console.log('[Status Query] Timeout');
            client.destroy();
            reject({ code: 'TIMEOUT', message: 'Status query timeout' });
        });

        client.on('error', (err) => {
            console.log(`[Status Query] Error: ${err.message}`);
            reject({ code: 'CONNECTION_ERROR', message: err.message });
        });

        client.on('connect', () => {
            console.log('[Status Query] Connected, sending first query');
            client.write(queries[queryIndex]);
        });

        client.on('data', (data) => {
            // DLE EOT responses should be exactly 1 byte
            // TCP is a stream protocol, so handle various data chunk sizes
            if (data.length === 1) {
                const statusByte = data[0];
                console.log(`[Status Query] Response ${queryIndex + 1}: 0x${statusByte.toString(16).padStart(2, '0')}`);

                statusResponses.push({
                    type: queryIndex + 1,
                    byte: statusByte
                });

                // Reset timeout for next query
                client.setTimeout(STATUS_TIMEOUT_MS);

                // Send next query or finish
                queryIndex++;
                if (queryIndex < queries.length) {
                    setTimeout(() => {
                        client.write(queries[queryIndex]);
                    }, QUERY_DELAY_MS);
                } else {
                    client.end();
                }
            } else if (data.length > 1) {
                // Handle case where multiple responses arrive in one chunk
                console.log(`[Status Query] Warning: Received ${data.length} bytes, expected 1. Using first byte.`);
                const statusByte = data[0];

                statusResponses.push({
                    type: queryIndex + 1,
                    byte: statusByte
                });

                // Reset timeout
                client.setTimeout(STATUS_TIMEOUT_MS);

                queryIndex++;
                if (queryIndex < queries.length) {
                    setTimeout(() => {
                        client.write(queries[queryIndex]);
                    }, QUERY_DELAY_MS);
                } else {
                    client.end();
                }
            } else {
                // Received empty data, ignore
                console.log('[Status Query] Warning: Received empty data chunk');
            }
        });

        client.on('close', () => {
            console.log(`[Status Query] Connection closed. Responses: ${statusResponses.length}/${queries.length}`);

            if (statusResponses.length === 0) {
                reject({
                    code: 'NO_RESPONSE',
                    message: 'Printer did not respond to status queries (may not support status commands)'
                });
                return;
            }

            // Parse all responses
            let combinedStatus = {
                online: true,
                paperStatus: 'ok',
                coverOpen: false,
                error: false,
                errorMessage: null,
                supported: true,
                details: {}
            };

            statusResponses.forEach(response => {
                const parsed = parseStatusByte(response.byte, response.type);
                Object.assign(combinedStatus.details, parsed);

                // Update high-level status based on response type
                if (response.type === 1) {
                    // Printer status
                    if (parsed.online === false) {
                        combinedStatus.online = false;
                        combinedStatus.error = true;
                        combinedStatus.errorMessage = 'Printer is offline';
                    }
                }

                if (response.type === 2) {
                    // Off-line status
                    if (parsed.coverOpen) {
                        combinedStatus.coverOpen = true;
                        combinedStatus.error = true;
                        combinedStatus.errorMessage = 'Printer cover is open';
                    }
                    if (parsed.paperShortage) {
                        combinedStatus.paperStatus = 'low';
                        // Paper shortage is a warning, not always an error
                    }
                    if (parsed.error && !combinedStatus.errorMessage) {
                        combinedStatus.error = true;
                        combinedStatus.errorMessage = 'Printer has an error';
                    }
                }

                if (response.type === 3) {
                    // Error status
                    if (parsed.cutterError) {
                        combinedStatus.error = true;
                        if (!combinedStatus.errorMessage) {
                            combinedStatus.errorMessage = 'Auto-cutter error';
                        }
                    }
                    if (parsed.unrecoverableError) {
                        combinedStatus.error = true;
                        if (!combinedStatus.errorMessage) {
                            combinedStatus.errorMessage = 'Unrecoverable printer error';
                        }
                    }
                    if (parsed.temperatureError) {
                        combinedStatus.error = true;
                        if (!combinedStatus.errorMessage) {
                            combinedStatus.errorMessage = 'Print head temperature/voltage error';
                        }
                    }
                }

                if (response.type === 4) {
                    // Paper roll sensor status
                    if (parsed.paperNotPresent) {
                        combinedStatus.paperStatus = 'out';
                        combinedStatus.error = true;
                        if (!combinedStatus.errorMessage) {
                            combinedStatus.errorMessage = 'Paper out';
                        }
                    } else if (parsed.paperNearEnd) {
                        // Only set to low if not already set to out
                        if (combinedStatus.paperStatus !== 'out') {
                            combinedStatus.paperStatus = 'low';
                        }
                    }
                }
            });

            resolve(combinedStatus);
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
 * @param {number} timeout - Printer connection timeout in ms
 */
async function handleMessage(ws, message, timeout = DEFAULT_TIMEOUT) {
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
            const result = await sendToSocket(host, port, buffer, timeout);
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

    if (action === 'status') {
        // Query printer status
        let { printer, host, port } = request;

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

        // Query status
        try {
            const status = await queryPrinterStatus(host, port, timeout);
            ws.send(JSON.stringify({
                success: true,
                status: status
            }));
        } catch (error) {
            // If printer doesn't support status queries, return a basic status
            if (error.code === 'NO_RESPONSE') {
                ws.send(JSON.stringify({
                    success: true,
                    status: {
                        online: true,
                        paperStatus: 'unknown',
                        coverOpen: false,
                        error: false,
                        errorMessage: null,
                        supported: false,
                        details: {}
                    },
                    warning: error.message
                }));
            } else {
                ws.send(JSON.stringify({
                    success: false,
                    error: error.message,
                    code: error.code || 'UNKNOWN_ERROR'
                }));
            }
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
 * @param {string} host - Host to bind to
 * @param {number} timeout - Printer connection timeout in ms
 */
function startServer(port, host, timeout) {
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
            handleMessage(ws, message.toString(), timeout);
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

    server.listen(port, host, () => {
        const securityNote = host === '0.0.0.0'
            ? '⚠️  EXTERNAL ACCESS ENABLED ⚠️'
            : 'localhost only (127.0.0.1)';

        console.log(`
┌─────────────────────────────────────────────┐
│  Printer Bridge Server                      │
├─────────────────────────────────────────────┤
│  WebSocket: ws://${host}:${port.toString().padEnd(19 - host.length)}│
│  Health:    http://${host}:${port}/health${' '.repeat(Math.max(0, 11 - host.length))}│
├─────────────────────────────────────────────┤
│  Configured Printers:                       │
${Object.entries(PRINTERS).map(([name, p]) =>
    `│    ${name.padEnd(10)} ${p.host}:${p.port}`.padEnd(46) + '│'
).join('\n')}
├─────────────────────────────────────────────┤
│  Timeout: ${timeout}ms${' '.repeat(35 - timeout.toString().length)}│
│  Security: ${securityNote.padEnd(29)}│
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
    const { wsPort, wsHost, timeout } = parseArgs();
    startServer(wsPort, wsHost, timeout);
}

if (require.main === module) {
    main();
}

module.exports = {
    sendToSocket,
    handleMessage,
    parseStatusByte,
    queryPrinterStatus
};
