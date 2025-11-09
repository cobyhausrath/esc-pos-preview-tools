# ESC/POS Preview Tools - Implementation Plan

## Project Vision

Build a passthrough socket proxy that intercepts ESC/POS print jobs, displays an HTML preview in a web interface, and allows users to approve or reject the print before forwarding it to the actual printer. The tool should work seamlessly with existing POS software without requiring code changes.

## Technical Architecture

### Core Components

#### 1. Proxy Server Module (`src/proxy/`)

**Purpose**: TCP socket server that acts as a transparent proxy between POS applications and thermal printers

**Key Files**:
- `ProxyServer.ts` - Main TCP proxy server
- `PrintJob.ts` - Print job data model
- `PrintQueue.ts` - Queue management for pending print jobs
- `SocketManager.ts` - Manage connections to clients and printers
- `JobApprovalHandler.ts` - Handle approve/reject logic

**Functionality**:
- Listen for incoming connections on configurable port (default 9100)
- Accept ESC/POS data from POS applications
- Forward approved data to actual printer
- Queue print jobs awaiting approval
- Handle connection lifecycle and errors
- Support multiple concurrent connections
- Timeout handling for stale jobs

**Configuration**:
```typescript
interface ProxyConfig {
  listenHost: string;      // Host to bind to (0.0.0.0 or localhost)
  listenPort: number;      // Port for POS apps to connect to
  printerHost: string;     // Actual printer IP address
  printerPort: number;     // Actual printer port
  webPort: number;         // Port for web interface
  autoApprove: boolean;    // Skip approval if true
  timeout: number;         // Job timeout in ms
  queueSize: number;       // Max queued jobs
}
```

#### 2. Parser Module (`src/parser/`)

**Purpose**: Parse ESC/POS byte sequences into structured command objects

**Key Files**:
- `CommandParser.ts` - Main parser class
- `CommandTypes.ts` - Type definitions for all ESC/POS commands
- `ByteStreamReader.ts` - Helper for reading byte sequences
- `EncodingHandler.ts` - Handle character encodings (CP437, CP850, etc.)

**Functionality**:
- Read ESC/POS byte sequences
- Identify command types (text, formatting, graphics, control)
- Parse command parameters
- Handle multi-byte commands
- Validate command syntax
- Support command chaining

**ESC/POS Commands to Support**:
```
Text Commands:
- ESC @ (Initialize)
- ESC ! (Print mode selection)
- ESC E (Bold on/off)
- ESC - (Underline on/off)
- ESC { (Upside-down on/off)
- GS ! (Character size)
- ESC a (Alignment)

Graphics Commands:
- ESC * (Bit image)
- GS v 0 (Raster image)
- GS ( k (QR code)
- GS k (Barcode)

Paper Control:
- LF (Line feed)
- ESC d (Print and feed)
- GS V (Cut paper)
- ESC p (Drawer kick)

Character Set:
- ESC t (Code page selection)
- ESC R (International character set)
```

#### 3. Renderer Module (`src/renderer/`)

**Purpose**: Convert parsed ESC/POS commands into HTML preview

**Key Files**:
- `HTMLRenderer.ts` - Main HTML rendering engine
- `TextRenderer.ts` - Handle text rendering with formatting
- `GraphicsRenderer.ts` - Handle images, barcodes, QR codes
- `StyleGenerator.ts` - Generate CSS for thermal paper appearance

**Functionality**:
- Generate HTML that mimics thermal paper appearance
- Apply text formatting (bold, size, alignment)
- Render graphics (images, barcodes) as data URLs or SVG
- Handle line feeds and spacing
- Create receipt-like visual output
- Support different paper widths

**Configuration Options**:
```typescript
interface RendererConfig {
  paperWidth: number;        // Characters per line (32, 42, 48)
  characterWidth: number;    // Pixels per character
  characterHeight: number;   // Pixels per character
  lineHeight: number;        // Pixels per line
  dpi: number;              // Dots per inch (203, 180)
  encoding: string;         // Default encoding
  fontFamily: string;       // Monospace font for thermal look
}
```

#### 4. Web Interface Module (`src/web/`)

**Purpose**: Browser-based UI for previewing and approving print jobs

**Key Files**:
- `WebServer.ts` - HTTP server for web interface
- `WebSocketHandler.ts` - Real-time updates via WebSocket
- `APIRoutes.ts` - REST API for job management
- `static/` - Static HTML/CSS/JS files for UI

**Functionality**:
- Display queued print jobs
- Show HTML preview of each job
- Approve/Reject buttons
- Real-time job notifications
- Print job history
- Configuration interface

**API Endpoints**:
```
GET  /api/jobs           - List pending jobs
GET  /api/jobs/:id       - Get specific job details
POST /api/jobs/:id/approve - Approve and forward to printer
POST /api/jobs/:id/reject  - Reject and discard job
GET  /api/history        - View print history
GET  /api/config         - Get current configuration
POST /api/config         - Update configuration
```

#### 5. Utilities Module (`src/utils/`)

**Purpose**: Shared utility functions

**Key Files**:
- `ByteUtils.ts` - Byte manipulation helpers
- `EncodingTables.ts` - Character encoding tables
- `ImageUtils.ts` - Image processing utilities
- `BarcodeGenerator.ts` - Barcode generation
- `QRCodeGenerator.ts` - QR code generation

### Data Flow

```
┌──────────────┐
│  POS App     │
└──────┬───────┘
       │ ESC/POS bytes via TCP
       ↓
┌──────────────────────┐
│  Proxy Server        │
│  - Receive data      │
│  - Create print job  │
└──────┬───────────────┘
       │
       ├─────────────────────────────┐
       │                             │
       ↓                             ↓
┌──────────────┐            ┌────────────────┐
│ Print Queue  │            │ Web Interface  │
│ (pending)    │◄───────────┤ (WebSocket)    │
└──────┬───────┘            └────────┬───────┘
       │                             │
       ↓                             │
┌──────────────┐                     │
│ Parser       │                     │
│ (parse ESC)  │                     │
└──────┬───────┘                     │
       │                             │
       ↓                             │
┌──────────────┐                     │
│ HTML         │                     │
│ Renderer     │────────────────────►│
└──────────────┘    Preview HTML     │
                                     │
                            User approves/rejects
                                     │
       ┌─────────────────────────────┘
       │
       ↓
┌──────────────────┐
│ Forward to       │
│ Printer (9100)   │
└──────────────────┘
```

## Implementation Phases

### Phase 1: Foundation & Proxy Server (Week 1-2)

**Goals**: Set up project structure and basic passthrough proxy

- [x] Initialize project with TypeScript and Yarn
- [ ] Set up build tooling (tsup or esbuild)
- [ ] Configure ESLint, Prettier
- [ ] Set up testing framework (Vitest)
- [ ] Implement basic TCP proxy server
- [ ] Accept connections and forward data
- [ ] Handle printer connection
- [ ] Basic error handling and logging

**Deliverables**:
- Project skeleton
- Working passthrough proxy (no preview yet)
- Basic tests

### Phase 2: Parser & HTML Rendering (Week 3-4)

**Goals**: Parse ESC/POS and generate HTML preview

- [ ] Implement ByteStreamReader
- [ ] Implement CommandParser for basic commands
- [ ] Define CommandTypes interfaces
- [ ] Implement HTMLRenderer for text
- [ ] Support basic text formatting (bold, size)
- [ ] Handle character encodings (CP437)
- [ ] Generate thermal paper-styled HTML
- [ ] Write parser and renderer tests

**Deliverables**:
- Working parser for common commands
- HTML preview of text content
- Thermal paper CSS styling

### Phase 3: Web Interface (Week 5-6)

**Goals**: Build approval UI

- [ ] Implement HTTP server for web UI
- [ ] Create print job queue system
- [ ] Build preview page with approve/reject buttons
- [ ] Implement WebSocket for real-time updates
- [ ] Create REST API endpoints
- [ ] Add basic job management UI
- [ ] Integrate preview with approval workflow

**Deliverables**:
- Working web interface
- Job queue management
- Approve/reject functionality
- End-to-end working system

### Phase 4: Enhanced Rendering (Week 7-8)

**Goals**: Support graphics and advanced formatting

- [ ] Implement barcode rendering (Code39, Code128, EAN)
- [ ] Add QR code support
- [ ] Render raster/bitmap images
- [ ] Support text alignment
- [ ] Handle underline, reverse printing
- [ ] Add logo/image caching
- [ ] Test with real POS receipts

**Deliverables**:
- Full graphics support
- Comprehensive receipt rendering
- Real-world compatibility

### Phase 5: User Experience (Week 9-10)

**Goals**: Improve usability and features

- [ ] Add print job history
- [ ] Implement auto-approve rules
- [ ] Add configuration UI
- [ ] Support multiple printer profiles
- [ ] Add keyboard shortcuts
- [ ] Improve preview styling
- [ ] Add print queue management

**Deliverables**:
- Polished UI
- History and logging
- Configuration system

### Phase 6: CLI & Standalone Mode (Week 11)

**Goals**: Support headless operation

- [ ] Create CLI for starting proxy
- [ ] Support config file
- [ ] Add auto-approve mode
- [ ] Logging options
- [ ] Daemon mode
- [ ] System service templates

**Deliverables**:
- CLI tool
- Headless operation mode
- Service deployment guides

### Phase 7: Testing & Optimization (Week 12)

**Goals**: Ensure reliability and performance

- [ ] Integration tests for full workflow
- [ ] Load testing with multiple jobs
- [ ] Memory leak detection
- [ ] Optimize rendering performance
- [ ] Handle edge cases
- [ ] Cross-platform testing

**Deliverables**:
- Comprehensive test suite
- Performance benchmarks
- Bug fixes

### Phase 8: Documentation & Release (Week 13-14)

**Goals**: Production-ready v1.0 release

- [ ] Complete user documentation
- [ ] API reference
- [ ] Deployment guides
- [ ] Video tutorials
- [ ] Example configurations
- [ ] Security audit
- [ ] Publish to npm

**Deliverables**:
- Complete documentation
- Published v1.0 package
- Production-ready tool

## Technology Stack

### Core
- **Language**: TypeScript
- **Runtime**: Node.js 16+
- **Build Tool**: tsup or esbuild
- **Package Manager**: Yarn
- **Testing**: Vitest

### Server Dependencies
- **TCP Server**: Node.js `net` module (built-in)
- **HTTP Server**: Express or Fastify
- **WebSocket**: ws or socket.io
- **Encoding**: iconv-lite

### Rendering Dependencies
- **Barcode Generation**: jsbarcode or bwip-js
- **QR Code**: qrcode
- **HTML Templates**: Handlebars or EJS (optional)

### Development
- **Linting**: ESLint with TypeScript plugin
- **Formatting**: Prettier
- **Type Checking**: TypeScript strict mode
- **Documentation**: TypeDoc
- **CI/CD**: GitHub Actions

### Web Interface
- **Backend**: Express
- **Frontend**: Vanilla JS or lightweight framework (Alpine.js)
- **Styling**: CSS with thermal paper theme
- **Real-time**: WebSocket for live updates

## API Design

### Proxy Server API

```typescript
import { ESCPOSProxy } from 'esc-pos-preview-tools';

// Start proxy server
const proxy = new ESCPOSProxy({
  listenHost: '0.0.0.0',
  listenPort: 9100,
  printerHost: '192.168.1.100',
  printerPort: 9100,
  webPort: 3000,
  autoApprove: false,
  timeout: 30000,
  queueSize: 100
});

// Event handlers
proxy.on('job:received', (job) => {
  console.log('New print job:', job.id);
});

proxy.on('job:approved', (job) => {
  console.log('Job approved:', job.id);
});

proxy.on('job:rejected', (job) => {
  console.log('Job rejected:', job.id);
});

proxy.on('error', (error) => {
  console.error('Proxy error:', error);
});

// Start server
await proxy.start();

// Stop server
await proxy.stop();
```

### Parser API (Library Usage)

```typescript
import { ESCPOSParser } from 'esc-pos-preview-tools/parser';

const parser = new ESCPOSParser();
const commands = parser.parse(buffer);

// Get detailed command info
commands.forEach(cmd => {
  console.log(cmd.type, cmd.params, cmd.description);
});
```

### Renderer API (Library Usage)

```typescript
import { HTMLRenderer } from 'esc-pos-preview-tools/renderer';

const renderer = new HTMLRenderer({
  width: 48,
  encoding: 'cp437'
});

const html = renderer.render(commands);
console.log(html);
```

### REST API (Web Interface)

```
GET  /api/jobs
     Response: { jobs: [{ id, timestamp, status, preview }] }

GET  /api/jobs/:id
     Response: { id, timestamp, status, rawData, preview, commands }

POST /api/jobs/:id/approve
     Response: { success: true, message: "Job sent to printer" }

POST /api/jobs/:id/reject
     Response: { success: true, message: "Job discarded" }

GET  /api/history
     Response: { jobs: [...], total, page, pageSize }

GET  /api/config
     Response: { listenPort, printerHost, printerPort, autoApprove, ... }

POST /api/config
     Body: { autoApprove: true, ... }
     Response: { success: true, config: {...} }
```

## Testing Strategy

### Unit Tests
- Test each module independently
- Mock dependencies
- Achieve >80% code coverage
- Test edge cases and error handling

### Integration Tests
- Test complete workflows
- Test parser → renderer → exporter pipeline
- Verify output correctness

### Visual Regression Tests
- Compare rendered output against snapshots
- Test various ESC/POS command combinations
- Ensure consistent rendering

### Performance Tests
- Benchmark parsing speed
- Test large command sequences
- Memory usage profiling

## Security Considerations

- **Input Validation**: Validate all ESC/POS input to prevent buffer overflows
- **Resource Limits**: Limit maximum paper length and image sizes
- **Dependency Auditing**: Regular security audits of dependencies
- **Safe Rendering**: Sanitize HTML output to prevent XSS
- **File Upload**: If supporting file uploads, validate file types and sizes

## Performance Goals

- Parse 1MB of ESC/POS commands in <100ms
- Render typical receipt (100 lines) in <50ms
- Export to PNG in <200ms
- Support receipts up to 10,000 lines
- Bundle size <100KB (gzipped)

## Documentation Plan

### User Documentation
- Getting Started Guide
- API Reference
- Usage Examples
- Command Reference
- FAQ

### Developer Documentation
- Architecture Overview
- Contributing Guide
- Code Style Guide
- Testing Guide
- Release Process

## Success Metrics

- 100+ GitHub stars in first 6 months
- 1,000+ npm downloads per month
- Used by at least 5 commercial projects
- <5 open critical bugs
- >90% test coverage
- Complete documentation
- Active community engagement

## Future Enhancements

- Real-time collaboration features
- Cloud-based preview service
- Browser extension for inspecting ESC/POS
- IDE plugins (VS Code, etc.)
- Mobile app for preview
- Support for other printer languages (ZPL, CPCL)
- AI-powered command suggestions
- Visual receipt designer
- Template library
