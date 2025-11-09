# ESC/POS Preview Tools

A comprehensive toolkit for previewing and visualizing ESC/POS printer commands without needing physical hardware.

## Overview

ESC/POS (Epson Standard Code for Point of Sale) is a command language used by thermal receipt printers. This project provides tools to preview, debug, and test ESC/POS commands by rendering them visually in a browser or other output formats, eliminating the need for physical printers during development.

## Features

- **Visual Preview**: Render ESC/POS commands as they would appear on thermal paper
- **Command Parser**: Parse and interpret ESC/POS byte sequences
- **Multiple Output Formats**: Preview as HTML, image, or PDF
- **Real-time Rendering**: See changes as you modify commands
- **Command Inspector**: Debug and inspect individual ESC/POS commands
- **Multiple Printer Profiles**: Support for different printer widths and capabilities
- **Cross-platform**: Works in browsers and Node.js environments

## Use Cases

- **Development**: Test receipt layouts without physical printers
- **Debugging**: Visualize complex ESC/POS command sequences
- **Documentation**: Generate visual examples of receipt designs
- **Testing**: Automated visual regression testing for receipt printing
- **Education**: Learn ESC/POS commands with instant visual feedback

## Installation

```bash
npm install esc-pos-preview-tools
```

Or with yarn:

```bash
yarn add esc-pos-preview-tools
```

## Quick Start

```javascript
import { ESCPOSPreview } from 'esc-pos-preview-tools';

// Create a preview instance
const preview = new ESCPOSPreview({
  width: 48, // Characters per line (typically 32, 42, or 48)
  encoding: 'cp437'
});

// Parse and render ESC/POS commands
const commands = Buffer.from([
  0x1B, 0x40,        // Initialize printer
  0x1B, 0x45, 0x01,  // Bold on
  0x48, 0x65, 0x6C, 0x6C, 0x6F, // "Hello"
  0x1B, 0x45, 0x00,  // Bold off
  0x0A               // Line feed
]);

const result = preview.render(commands);

// Output to different formats
preview.toHTML();   // Get HTML representation
preview.toCanvas(); // Render to HTML5 Canvas
preview.toPNG();    // Export as PNG image
preview.toPDF();    // Export as PDF
```

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
│   ├── parser/         # ESC/POS command parser
│   ├── renderer/       # Rendering engine
│   ├── exporters/      # Export to different formats
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

- [ ] Core parser implementation
- [ ] Basic text rendering
- [ ] HTML output
- [ ] Canvas rendering
- [ ] Image export (PNG/JPG)
- [ ] PDF export
- [ ] Barcode support
- [ ] QR code support
- [ ] Web-based demo/playground
- [ ] CLI tool
- [ ] Browser extension

## Resources

- [ESC/POS Command Reference](https://reference.epson-biz.com/modules/ref_escpos/index.php)
- [Thermal Printer Standards](https://www.epson.com/Support/wa00821)

## Acknowledgments

Inspired by the need for easier ESC/POS development and testing workflows.
