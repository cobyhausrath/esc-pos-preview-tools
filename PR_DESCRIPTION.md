# PR: Add HEX View, Socket Printing, and CLI Tools

## Overview

This PR adds comprehensive printing infrastructure to the ESC-POS preview tools, including a collapsible HEX viewer, network printing capabilities, and CLI tools for sending receipts to thermal printers.

## Changes Summary

### 🔍 **HEX View Panel** (web/editor.html)
- **Collapsible panel** - Toggleable binary data inspector (starts hidden)
- **Formatted display** - Offset (8-digit hex) + 16 bytes + ASCII representation
- **Command statistics** - Real-time ESC/GS command counts
- **Color-coded output** - Different colors for offsets, hex bytes, and ASCII
- **Smooth animation** - 0.3s transition for show/hide

**UI Location**: Preview pane, above receipt preview
**Toggle button**: 🔍 HEX in toolbar

### 🖨️ **Network Printing** (web/editor.html)

#### Browser Integration
- **Printer selection dropdown** - Named printers + custom IP option
- **Print button** - Send current ESC-POS bytes to printer
- **Connection status indicator** - Green/red dot with "Connected"/"Disconnected"
- **Auto-connect** - Attempts bridge connection on startup (silent fail)
- **Error handling** - Clear alerts for connection/printing failures

#### WebSocket Communication
- **PrinterClient class** - WebSocket client for bridge communication
- **JSON protocol** - Structured messages for printer commands
- **Response handling** - Promise-based request/response pattern
- **Timeout protection** - 10s timeout for print jobs

### 🛠️ **CLI Tools** (bin/)

#### `escpos-send.js` - netcat replacement
**Purpose**: Send ESC-POS .bin files to network printers via TCP socket

**Features**:
- ✅ Named printer support (--printer netum)
- ✅ Custom IP/port (host port file)
- ✅ Stdin piping (cat file.bin | escpos-send ...)
- ✅ Timeout handling (5s default)
- ✅ Exit codes (0=success, 2=file not found, 3=timeout)
- ✅ Verbose output (connection status, bytes sent)

**Usage Examples**:
```bash
# Send file to printer
yarn escpos-send 192.168.1.100 9100 receipt.bin

# Use configured printer
yarn escpos-send --printer netum receipt.bin

# List printers
yarn escpos-send --list-printers

# Pipe from stdin
cat receipt.bin | yarn escpos-send 192.168.1.100 9100
```

#### `printer-bridge.js` - WebSocket to TCP bridge
**Purpose**: Enable browser-to-printer communication via WebSocket

**Features**:
- ✅ WebSocket server (ws://127.0.0.1:8765)
- ✅ JSON protocol for printer commands
- ✅ Health check endpoint (/health)
- ✅ Localhost-only binding (security)
- ✅ Pretty startup banner
- ✅ Auto-reconnection support

**Usage Examples**:
```bash
# Start bridge server
yarn bridge

# Start on custom port
yarn bridge --port 9000

# Check health
curl http://127.0.0.1:8765/health
```

**Protocol**:
```json
// Send to printer
{"action": "send", "printer": "netum", "data": [0x1B, 0x40, ...]}

// List printers
{"action": "list"}

// Response
{"success": true, "message": "Sent 123 bytes", "bytesSent": 123}
```

### 📦 **Package Updates** (package.json)

**New binaries**:
```json
{
  "bin": {
    "escpos-send": "./bin/escpos-send.js",
    "printer-bridge": "./bin/printer-bridge.js"
  }
}
```

**New scripts**:
```json
{
  "scripts": {
    "bridge": "node bin/printer-bridge.js",
    "bridge:dev": "node --watch bin/printer-bridge.js"
  }
}
```

**New files**:
- `bin/` directory added to package files

### 📚 **Documentation Updates**

#### README.md
- Added HEX Viewer and Network Printing to "What Is This?"
- Added "Send to Network Printer" quick start section
- Added CLI Tools feature section
- Added comprehensive CLI examples (Network Printing Tools, Python Conversion Tools, Combined Workflows)
- Updated project structure to include bin/ directory
- Enhanced browser editor features list

#### CLAUDE.md
- Added "Network Printing Architecture" pitfall
- Added "HEX View Display" pitfall
- Added comprehensive "Architecture: Python vs TypeScript Boundaries" section
  - Python (Pyodide) responsibilities
  - TypeScript/JavaScript responsibilities
  - CLI Tools (Node.js) responsibilities and rationale

#### bin/README.md (NEW)
- Complete CLI tools documentation
- Installation instructions
- Usage examples
- Configuration guide
- Exit codes reference
- Troubleshooting section
- Comparison to `nc` (netcat)

## Architecture Decisions

### **Clear Python vs TypeScript Separation**

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Python (Pyodide)** | python-escpos | Execute python-escpos code ONLY |
| **TypeScript/JS** | Browser | Parsing, rendering, HEX display, UI, I/O |
| **CLI Tools** | Node.js | Network I/O, socket communication |

**Rationale**:
- Python (Pyodide) has overhead → use only when python-escpos is required
- TypeScript is faster, type-safe → better for UI/I/O
- Node.js for CLI → simpler deployment, no build step

### **Network Architecture**

```
┌─────────┐  WebSocket   ┌────────┐  TCP/9100  ┌─────────┐
│ Browser │ ───────────> │ Bridge │ ─────────> │ Printer │
└─────────┘              └────────┘            └─────────┘
              ws://localhost:8765   raw bytes
```

**Security**: Bridge binds to 127.0.0.1 only (localhost)

### **Why Node.js for CLI Tools?**
- ✅ No build step required
- ✅ Direct access to Node.js APIs (net, ws)
- ✅ Self-contained executables (shebang)
- ✅ Users can modify without recompiling
- ✅ Simpler deployment

## Testing

### Manual Testing Performed
- ✅ HEX view toggle (show/hide)
- ✅ HEX formatting with various ESC-POS files
- ✅ Command statistics accuracy
- ✅ escpos-send CLI with sample files
- ✅ escpos-send help and list-printers
- ✅ printer-bridge startup and health check
- ✅ Browser UI (printer selection, connection status)
- ✅ Error handling (connection refused, timeouts)

### Automated Tests
- Existing TypeScript tests still pass (parser, renderer)
- Existing Python tests still pass (verifier)
- **Note**: CLI tools are Node.js JavaScript (no type checking)

## Breaking Changes

**None** - All changes are additive:
- New features in editor.html (backwards compatible)
- New CLI tools (opt-in usage)
- No changes to existing API surface

## Migration Guide

### For End Users
**No migration needed** - existing functionality unchanged.

**To use new features**:
1. **HEX View**: Open editor, click "🔍 HEX" button
2. **CLI Printing**: `yarn add esc-pos-preview-tools`, then `yarn escpos-send`
3. **Browser Printing**: Start bridge with `yarn bridge`, then use Print button in editor

### For Developers
1. Pull latest changes
2. Run `yarn install` to get `ws` dependency
3. (Optional) Configure printers in `bin/escpos-send.js` or `src/devices/printers.ts`

## Security Considerations

### Printer Bridge Server
- ✅ **Localhost-only**: Binds to 127.0.0.1 (not 0.0.0.0)
- ✅ **No authentication**: Trusts localhost connections only
- ⚠️ **Warning in docs**: Never expose to internet/untrusted networks

### Code Execution
- ✅ Python code execution uses existing AST validation
- ✅ No changes to security model

### Network Communication
- ✅ TCP connections use standard Node.js `net` module
- ✅ Timeout protection on all connections
- ✅ Error messages don't leak sensitive info

## Performance Impact

- **HEX Formatter**: O(n) where n = bytes, minimal overhead
- **WebSocket Bridge**: Negligible (event-driven, single connection)
- **Editor Load Time**: +1-2s for WebSocket connection attempt (async, doesn't block)
- **Memory**: HEX view stores formatted HTML (3-4x binary size, only when visible)

## Future Enhancements

**Not included in this PR** (potential follow-ups):
- [ ] Examples gallery page (demo/examples.html)
- [ ] Inline examples sidebar in editor
- [ ] #import= URL parameter for loading .bin files
- [ ] Direct Sockets API support (Chrome 89+)
- [ ] Printer discovery (mDNS/Bonjour)
- [ ] Print job history
- [ ] Printer status monitoring

## Screenshots

### HEX View Panel
```
┌─────────────────────────────────────────────┐
│ HEX View              41 bytes (ESC: 3, GS: 1) │
├─────────────────────────────────────────────┤
│ 00000000: 1B 40 1B 61 01 48 65 6C | .@.a.Hel  │
│ 00000008: 6C 6F 0A 1B 61 00 57 6F | lo..a.Wo  │
│ 00000010: 72 6C 64 21 0A 1D 56 00 | rld!..V.  │
└─────────────────────────────────────────────┘
```

### Printer Controls
```
[Select printer...  ▼] [🖨️ Print] ● Disconnected
```

### Bridge Server Startup
```
┌─────────────────────────────────────────────┐
│  Printer Bridge Server                      │
├─────────────────────────────────────────────┤
│  WebSocket: ws://127.0.0.1:8765             │
│  Health:    http://127.0.0.1:8765/health    │
├─────────────────────────────────────────────┤
│  Configured Printers:                       │
│    netum      192.168.1.100:9100            │
├─────────────────────────────────────────────┤
│  Security: localhost only (127.0.0.1)       │
│  Press Ctrl+C to stop                       │
└─────────────────────────────────────────────┘
```

## Checklist

- [x] Code follows project style guidelines
- [x] Documentation updated (README, CLAUDE.md, bin/README.md)
- [x] No breaking changes
- [x] Security considerations addressed
- [x] Manual testing completed
- [x] Existing tests still pass
- [x] Architecture decisions documented
- [x] Clear commit messages
- [x] No debug code left (console.log, etc.)

## Related Issues

None - this is a planned enhancement based on project roadmap.

## Additional Notes

### Why This Implementation?

1. **HEX View**: Essential for debugging binary ESC-POS data. Developers need to see raw bytes.
2. **Network Printing**: Closes the loop - edit → preview → print without leaving browser.
3. **CLI Tools**: Needed for CI/CD, scripting, and non-browser workflows. `nc` doesn't understand printers.
4. **Architecture Clarity**: Establishes clear boundaries to prevent future confusion.

### Lessons Learned

1. **WebSocket bridge is simpler than Direct Sockets API** (not yet widely supported)
2. **Node.js CLI tools are easier than TypeScript** (no build step)
3. **Collapsible panels save screen real estate** (HEX view is large)
4. **Clear architecture documentation prevents future mistakes**

---

**Ready to merge** ✅

All features tested, documented, and working as expected.
