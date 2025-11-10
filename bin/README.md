# escpos-send - Network Printer CLI Tool

Send ESC-POS binary files to network thermal printers via TCP socket.

This is a replacement for `nc` (netcat) specifically designed for ESC-POS printers.

## Installation

```bash
# Install globally
npm install -g esc-pos-preview-tools

# Or use locally
npm install esc-pos-preview-tools
npx escpos-send --help
```

## Usage

### Basic Usage

```bash
# Send file to printer by IP and port
escpos-send 192.168.1.100 9100 receipt.bin

# Send file to configured printer
escpos-send --printer netum receipt.bin

# Pipe from stdin
cat receipt.bin | escpos-send 192.168.1.100 9100

# Use with python-escpos
python -c "from escpos.printer import Dummy; p=Dummy(); p.text('Test')" | \
  escpos-send 192.168.1.100 9100
```

### Options

```
-p, --printer <name>    Use configured printer by name
--list-printers         List configured printers
-h, --help              Show this help
-v, --version           Show version
```

### List Configured Printers

```bash
escpos-send --list-printers
```

Output:
```
Configured Printers:

  netum           Netum 80-V-UL
                  192.168.1.100:9100 (80mm)
```

## Configuration

To add printers, edit `bin/escpos-send.js` and add entries to the `PRINTERS` object:

```javascript
const PRINTERS = {
    'my-printer': {
        name: 'My Printer Model',
        host: '192.168.1.100',
        port: 9100,
        type: 'thermal',
        width: 80,
    },
    // Add more...
};
```

Or use the `devices/printers.ts` database (TypeScript).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (invalid arguments, connection failed) |
| 2 | File not found |
| 3 | Connection timeout |

## Examples

### Send sample receipt

```bash
escpos-send 192.168.1.100 9100 samples/receipt.bin
```

### Use with editor output

```bash
# Export from editor, then send
node -e "console.log('Test')" | escpos-send --printer netum
```

### Test connection

```bash
# Send minimal test
echo -ne '\x1B\x40Hello\x0A\x1D\x56\x00' | escpos-send 192.168.1.100 9100
```

### Chain with converter

```bash
# Convert Python code to ESC-POS and send
python python/escpos_cli.py execute receipt.py | \
  escpos-send --printer netum
```

## Common Ports

- **9100**: Standard RAW TCP port for ESC-POS printers
- **9101**: Alternate port
- **515**: LPD (Line Printer Daemon) protocol

## Troubleshooting

### Connection refused

```
Error: Connection error: connect ECONNREFUSED
```

**Solutions:**
- Check printer IP address and port
- Ensure printer is on the network
- Verify firewall settings
- Try `ping <printer-ip>` to test connectivity

### Timeout

```
Error: Connection timeout after 5000ms
```

**Solutions:**
- Printer may be off or unreachable
- Check network connection
- Verify printer supports RAW TCP (port 9100)

### No data sent

```
Warning: No data to send (0 bytes)
```

**Solutions:**
- Check input file exists and has content
- If using stdin, ensure data is being piped

## Technical Details

- **Protocol**: RAW TCP socket
- **Timeout**: 5 seconds
- **Buffer size**: Unlimited (entire file loaded into memory)
- **Binary safe**: Yes (does not modify data)

## Comparison to `nc` (netcat)

| Feature | escpos-send | nc |
|---------|-------------|-----|
| Printer database | ✅ Yes | ❌ No |
| Named printers | ✅ Yes | ❌ No |
| ESC-POS specific | ✅ Yes | ❌ General |
| Progress output | ✅ Yes | ❌ No |
| Exit codes | ✅ Specific | ⚠️ Generic |
| Timeout handling | ✅ Built-in | ⚠️ Manual |

## License

MIT - See LICENSE file for details
