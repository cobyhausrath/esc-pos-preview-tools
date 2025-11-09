# ESC/POS Preview Tools

Parse ESC/POS commands to make an HTML preview of what would be printed. Provides a passthrough socket for use with existing tools and the ability to accept/reject a previewed job before forwarding it to the printer.

## Overview

ESC/POS (Epson Standard Code for Point of Sale) is a command language used by thermal receipt printers. This tool acts as a proxy between your POS software and the thermal printer, intercepting print jobs to display an HTML preview and allowing you to approve or reject the print before it's sent to the physical printer.

## Key Features

- **HTML Preview**: Real-time visual preview of ESC/POS commands as they would appear on thermal paper
- **Passthrough Socket**: Transparent proxy that sits between your application and the printer
- **Print Job Approval**: Review and approve/reject print jobs before they reach the printer
- **Command Parser**: Parse and interpret ESC/POS byte sequences
- **Web Interface**: Browser-based preview and approval interface
- **Compatible with Existing Tools**: Works seamlessly with your current POS software
- **Multiple Printer Profiles**: Support for different printer widths and capabilities

## Use Cases

- **Print Job Review**: Preview receipts before printing to catch errors
- **Testing**: Test receipt layouts without wasting paper
- **Development**: Develop and debug POS integrations without physical printers
- **Quality Control**: Verify print output before customer-facing receipts
- **Training**: Learn how different ESC/POS commands affect output

## Installation

```bash
yarn add esc-pos-preview-tools
```

Or with npm:

```bash
npm install esc-pos-preview-tools
```

## Quick Start

### As a Passthrough Proxy

```javascript
import { ESCPOSProxy } from 'esc-pos-preview-tools';

// Start the proxy server
const proxy = new ESCPOSProxy({
  listenPort: 9100,           // Port your POS software connects to
  printerHost: '192.168.1.100', // Your actual printer's IP
  printerPort: 9100,           // Your actual printer's port
  webPort: 3000,               // Web interface port
  autoApprove: false           // Require manual approval
});

proxy.start();

// Configure your POS software to print to localhost:9100
// Open http://localhost:3000 in your browser to preview and approve prints
```

### As a Library

```javascript
import { ESCPOSParser, HTMLRenderer } from 'esc-pos-preview-tools';

// Parse ESC/POS commands
const parser = new ESCPOSParser();
const commands = Buffer.from([
  0x1B, 0x40,        // Initialize printer
  0x1B, 0x45, 0x01,  // Bold on
  0x48, 0x65, 0x6C, 0x6C, 0x6F, // "Hello"
  0x1B, 0x45, 0x00,  // Bold off
  0x0A               // Line feed
]);

const parsed = parser.parse(commands);

// Render to HTML
const renderer = new HTMLRenderer({ width: 48 });
const html = renderer.render(parsed);
console.log(html);
```

## How It Works

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│             │         │   ESC/POS Proxy  │         │             │
│  POS App    │────────▶│                  │────────▶│   Printer   │
│             │  :9100  │  - Parse         │  :9100  │             │
└─────────────┘         │  - Preview       │         └─────────────┘
                        │  - Approve/Reject│
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Web Interface  │
                        │   (Browser)     │
                        │   :3000         │
                        └─────────────────┘
```

1. Your POS application sends print data to the proxy (localhost:9100)
2. The proxy parses the ESC/POS commands and generates an HTML preview
3. The preview appears in your browser with Approve/Reject buttons
4. If approved, the data is forwarded to the actual printer
5. If rejected, the print job is discarded

## Supported ESC/POS Commands

The library aims to support the most common ESC/POS commands:

### Text Formatting
- Bold, underline, double-width, double-height
- Font selection (Font A, Font B)
- Character size scaling
- Text alignment (left, center, right)
- Reverse/inverse printing

### Graphics
- Raster bit images
- Column format bit images
- QR codes
- Barcodes (various formats)

### Paper Control
- Line feed
- Paper cut
- Drawer kick
- Beeper/buzzer

### Character Encoding
- Code pages (CP437, CP850, CP858, etc.)
- International character sets

## Project Structure

```
esc-pos-preview-tools/
├── src/
│   ├── proxy/          # Passthrough socket proxy server
│   ├── parser/         # ESC/POS command parser
│   ├── renderer/       # HTML rendering engine
│   ├── web/            # Web interface for preview/approval
│   ├── utils/          # Utility functions
│   └── index.ts        # Main entry point
├── docs/               # Documentation
├── examples/           # Usage examples
├── tests/              # Test suite
└── package.json
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Roadmap

### Phase 1: Core Functionality
- [ ] ESC/POS command parser
- [ ] HTML renderer for basic text
- [ ] Socket passthrough proxy
- [ ] Basic web interface for preview

### Phase 2: Enhanced Rendering
- [ ] Text formatting (bold, underline, sizes)
- [ ] Character encodings (CP437, etc.)
- [ ] Barcode rendering
- [ ] QR code rendering
- [ ] Image/logo rendering

### Phase 3: User Experience
- [ ] Print job queue management
- [ ] Approval workflow UI
- [ ] Print history
- [ ] Configuration UI
- [ ] Multiple printer support

### Phase 4: Advanced Features
- [ ] Auto-approve rules (e.g., specific job types)
- [ ] Print job templates
- [ ] Export preview as image/PDF
- [ ] WebSocket for real-time updates
- [ ] CLI for headless operation

## Resources

- [ESC/POS Command Reference](https://reference.epson-biz.com/modules/ref_escpos/index.php)
- [Thermal Printer Standards](https://www.epson.com/Support/wa00821)

## Acknowledgments

Inspired by the need for easier ESC/POS development and testing workflows.
