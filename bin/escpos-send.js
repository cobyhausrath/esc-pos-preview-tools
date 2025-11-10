#!/usr/bin/env node

/**
 * escpos-send - Send ESC-POS binary files to network printers via TCP socket
 *
 * This is a replacement for `nc` (netcat) specifically designed for sending
 * ESC-POS data to thermal printers.
 *
 * Usage:
 *   escpos-send <host> <port> <file>
 *   escpos-send --printer <printer-name> <file>
 *   cat receipt.bin | escpos-send <host> <port>
 *
 * Examples:
 *   escpos-send 192.168.1.100 9100 receipt.bin
 *   escpos-send --printer netum receipt.bin
 *   echo "Hello" | escpos-send 192.168.1.100 9100
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

// ===================================================================
// Printer Database (from devices/printers.ts)
// ===================================================================

const PRINTERS = {
    'netum': {
        name: 'Netum 80-V-UL',
        host: '192.168.1.100',
        port: 9100,
        type: 'thermal',
        width: 80,
    },
    // Add more printers here as needed
};

// ===================================================================
// CLI Argument Parser
// ===================================================================

function parseArgs() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printHelp();
        process.exit(0);
    }

    if (args.includes('--version') || args.includes('-v')) {
        console.log('escpos-send v0.1.0');
        process.exit(0);
    }

    if (args.includes('--list-printers')) {
        listPrinters();
        process.exit(0);
    }

    let host, port, filePath, printerName;

    // Check for --printer flag
    if (args[0] === '--printer' || args[0] === '-p') {
        if (args.length < 2) {
            console.error('Error: --printer requires a printer name');
            process.exit(1);
        }
        printerName = args[1];
        const printer = PRINTERS[printerName];
        if (!printer) {
            console.error(`Error: Printer '${printerName}' not found`);
            console.error('Available printers:', Object.keys(PRINTERS).join(', '));
            process.exit(1);
        }
        host = printer.host;
        port = printer.port;
        filePath = args[2]; // Optional, can be stdin
    } else {
        // Traditional host port [file] format
        if (args.length < 2) {
            console.error('Error: Requires at least host and port');
            printHelp();
            process.exit(1);
        }
        host = args[0];
        port = parseInt(args[1], 10);
        filePath = args[2]; // Optional, can be stdin

        if (isNaN(port) || port < 1 || port > 65535) {
            console.error(`Error: Invalid port '${args[1]}'`);
            process.exit(1);
        }
    }

    return { host, port, filePath, printerName };
}

function printHelp() {
    console.log(`
escpos-send - Send ESC-POS binary files to network printers via TCP socket

USAGE:
  escpos-send <host> <port> [file]
  escpos-send --printer <name> [file]
  cat file.bin | escpos-send <host> <port>

ARGUMENTS:
  <host>    Printer IP address or hostname
  <port>    TCP port (usually 9100 for ESC-POS printers)
  [file]    Path to .bin file (optional, defaults to stdin)

OPTIONS:
  -p, --printer <name>    Use configured printer by name
  --list-printers         List configured printers
  -h, --help              Show this help
  -v, --version           Show version

EXAMPLES:
  # Send file to printer by IP
  escpos-send 192.168.1.100 9100 receipt.bin

  # Use configured printer
  escpos-send --printer netum receipt.bin

  # Pipe from stdin
  cat receipt.bin | escpos-send 192.168.1.100 9100

  # List configured printers
  escpos-send --list-printers

EXIT CODES:
  0    Success
  1    Error (invalid arguments, connection failed, etc.)
  2    File not found
  3    Connection timeout

NOTES:
  - Default timeout: 5 seconds
  - Common ESC-POS port: 9100
  - Supports both binary and text data
`);
}

function listPrinters() {
    console.log('\nConfigured Printers:\n');
    for (const [name, printer] of Object.entries(PRINTERS)) {
        console.log(`  ${name.padEnd(15)} ${printer.name}`);
        console.log(`  ${''.padEnd(15)} ${printer.host}:${printer.port} (${printer.width}mm)`);
        console.log('');
    }
}

// ===================================================================
// TCP Socket Sender
// ===================================================================

/**
 * Send data to a TCP socket
 * @param {string} host - Hostname or IP
 * @param {number} port - Port number
 * @param {Buffer} data - Data to send
 * @returns {Promise<void>}
 */
function sendToSocket(host, port, data) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        const timeout = 5000; // 5 seconds

        let connected = false;
        let bytesSent = 0;

        // Set timeout
        client.setTimeout(timeout);

        client.on('timeout', () => {
            client.destroy();
            reject(new Error(`Connection timeout after ${timeout}ms`));
        });

        client.on('error', (err) => {
            reject(new Error(`Connection error: ${err.message}`));
        });

        client.on('connect', () => {
            connected = true;
            console.error(`Connected to ${host}:${port}`);
            console.error(`Sending ${data.length} bytes...`);

            // Send data
            client.write(data, (err) => {
                if (err) {
                    reject(new Error(`Write error: ${err.message}`));
                    return;
                }
                bytesSent = data.length;
            });
        });

        client.on('drain', () => {
            // All data has been sent
            console.error(`Sent ${bytesSent} bytes successfully`);
            client.end();
        });

        client.on('close', () => {
            if (connected && bytesSent === data.length) {
                console.error('Connection closed');
                resolve();
            } else if (!connected) {
                reject(new Error('Connection closed before sending data'));
            }
        });

        // Connect
        console.error(`Connecting to ${host}:${port}...`);
        client.connect(port, host);
    });
}

// ===================================================================
// Data Reader
// ===================================================================

/**
 * Read data from file or stdin
 * @param {string|undefined} filePath - Path to file, or undefined for stdin
 * @returns {Promise<Buffer>}
 */
function readData(filePath) {
    return new Promise((resolve, reject) => {
        if (filePath) {
            // Read from file
            if (!fs.existsSync(filePath)) {
                reject(new Error(`File not found: ${filePath}`));
                return;
            }

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    reject(new Error(`Failed to read file: ${err.message}`));
                    return;
                }
                console.error(`Read ${data.length} bytes from ${filePath}`);
                resolve(data);
            });
        } else {
            // Read from stdin
            const chunks = [];

            process.stdin.on('readable', () => {
                let chunk;
                while ((chunk = process.stdin.read()) !== null) {
                    chunks.push(chunk);
                }
            });

            process.stdin.on('end', () => {
                const data = Buffer.concat(chunks);
                console.error(`Read ${data.length} bytes from stdin`);
                resolve(data);
            });

            process.stdin.on('error', (err) => {
                reject(new Error(`Failed to read stdin: ${err.message}`));
            });
        }
    });
}

// ===================================================================
// Main
// ===================================================================

async function main() {
    try {
        const { host, port, filePath, printerName } = parseArgs();

        if (printerName) {
            console.error(`Using printer: ${printerName} (${PRINTERS[printerName].name})`);
        }

        // Read data
        const data = await readData(filePath);

        if (data.length === 0) {
            console.error('Warning: No data to send (0 bytes)');
            process.exit(1);
        }

        // Send to socket
        await sendToSocket(host, port, data);

        console.error('✓ Success');
        process.exit(0);

    } catch (error) {
        console.error(`✗ Error: ${error.message}`);

        if (error.message.includes('File not found')) {
            process.exit(2);
        } else if (error.message.includes('timeout')) {
            process.exit(3);
        } else {
            process.exit(1);
        }
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { sendToSocket, readData };
