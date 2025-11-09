# ESC/POS Preview Tools

**Parse and render ESC/POS thermal printer commands as HTML** with bidirectional python-escpos conversion.

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]() [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## What Is This?

A TypeScript library and Python toolkit for working with ESC/POS thermal printer commands:

1. **Parser** - Convert ESC/POS byte sequences into structured commands
2. **Renderer** - Display receipts as HTML with thermal printer styling
3. **Python Bridge** - Convert between ESC/POS bytes and python-escpos code
4. **Browser Editor** - Edit receipts with live preview (powered by Pyodide)

---

## Quick Start

```bash
# Install
yarn add esc-pos-preview-tools

# Or with npm
npm install esc-pos-preview-tools
```

### Parse and Render

```typescript
import { CommandParser, HTMLRenderer } from 'esc-pos-preview-tools';

// Your ESC/POS data
const escposData = Buffer.from([
  0x1B, 0x40,        // ESC @ - Initialize
  0x1B, 0x45, 0x01,  // ESC E - Bold on
  ...Buffer.from('RECEIPT'),
  0x1B, 0x45, 0x00,  // ESC E - Bold off
  0x0A,              // LF - Line feed
  0x1B, 0x61, 0x01,  // ESC a - Center align
  ...Buffer.from('Thank you!'),
  0x0A,
  0x1D, 0x56, 0x00   // GS V - Cut paper
]);

// Parse
const parser = new CommandParser();
const { commands } = parser.parse(escposData);

// Render
const renderer = new HTMLRenderer();
const html = renderer.render(commands);

// Display in browser
document.getElementById('receipt').innerHTML = html;
```

### Convert to python-escpos

```bash
# Install Python tools
pip install python-escpos

# Convert ESC-POS file to Python code
python python/escpos_cli.py convert receipt.bin -o receipt.py
```

Output:
```python
from escpos.printer import Dummy

p = Dummy()
p.set(bold=True)
p.text('RECEIPT\n')
p.set(bold=False)
p.set(align='center')
p.text('Thank you!\n')
p.cut()
```

---

## Features

### Core Library (TypeScript/JavaScript)

✅ **Parse ESC/POS Commands**
- Text formatting (bold, underline, sizes)
- Alignment (left, center, right)
- Character modes (width, height)
- Paper control (line feed, cut)
- 9+ command types supported

✅ **Render to HTML**
- Thermal printer styling
- Fixed-width receipt layout
- Visual filter for authentic look
- Responsive design

✅ **TypeScript Support**
- Full type definitions
- Strict type checking
- IntelliSense support

### Python Tools

✅ **Bidirectional Conversion**
- ESC-POS bytes → python-escpos code
- python-escpos code → ESC-POS bytes
- Semantic verification

✅ **Command-Line Interface**
- Convert files
- Verify conversions
- Batch processing

✅ **Security**
- AST-based code validation
- Input size limits
- Safe code execution

### Browser Editor

✅ **In-Browser Editing**
- Real-time preview
- Powered by Pyodide (Python in WebAssembly)
- Import/export ESC-POS files
- Example templates

✅ **Zero Installation**
- Runs entirely in browser
- No server required
- Offline capable

---

## Use Cases

- **Development** - Test receipt layouts without a physical printer
- **Debugging** - Understand what ESC-POS commands do
- **Testing** - Automated receipt testing
- **Documentation** - Generate receipt examples
- **Education** - Learn ESC-POS command structure
- **Conversion** - Convert between binary and readable code

---

## Supported Commands

| Command | Hex | Description | Status |
|---------|-----|-------------|--------|
| **Text Formatting** |
| ESC @ | 1B 40 | Initialize printer | ✅ |
| ESC E | 1B 45 n | Bold on/off | ✅ |
| ESC - | 1B 2D n | Underline on/off | ✅ |
| ESC ! | 1B 21 n | Print mode | ✅ |
| GS ! | 1D 21 n | Character size | ✅ |
| **Alignment** |
| ESC a | 1B 61 n | Text alignment | ✅ |
| **Paper Control** |
| LF | 0A | Line feed | ✅ |
| GS V | 1D 56 m | Paper cut | ✅ |
| **Graphics** |
| ESC * | 1B 2A ... | Bit image | ⏳ Planned |
| GS v 0 | 1D 76 30 ... | Raster image | ⏳ Planned |
| **Barcodes & QR** |
| GS k | 1D 6B ... | Barcode | ⏳ Planned |
| GS ( k | 1D 28 6B ... | QR code | ⏳ Planned |

**Legend:** ✅ Supported | ⏳ Planned | ❌ Not yet

---

## Installation

### TypeScript/JavaScript

```bash
# With Yarn
yarn add esc-pos-preview-tools

# With npm
npm install esc-pos-preview-tools
```

### Python Tools

```bash
# Install python-escpos
pip install python-escpos

# Clone repository for tools
git clone https://github.com/cobyhausrath/esc-pos-preview-tools.git
cd esc-pos-preview-tools/python
```

---

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[CLAUDE.md](CLAUDE.md)** - Developer notes and conventions
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current status and roadmap
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[docs/](docs/)** - Detailed technical docs

---

## Examples

### Simple Text

```typescript
import { CommandParser, HTMLRenderer } from 'esc-pos-preview-tools';

const data = Buffer.from([
  0x1B, 0x40,  // Initialize
  ...Buffer.from('Hello World\n'),
  0x1D, 0x56, 0x00  // Cut
]);

const parser = new CommandParser();
const renderer = new HTMLRenderer();
const html = renderer.render(parser.parse(data).commands);
```

### Formatted Receipt

```typescript
const data = Buffer.from([
  0x1B, 0x40,        // Initialize
  0x1B, 0x61, 0x01,  // Center align
  0x1B, 0x45, 0x01,  // Bold on
  0x1D, 0x21, 0x11,  // Double size
  ...Buffer.from('MY STORE\n'),
  0x1D, 0x21, 0x00,  // Normal size
  0x1B, 0x45, 0x00,  // Bold off
  0x1B, 0x61, 0x00,  // Left align
  ...Buffer.from('Item 1: $10.00\n'),
  ...Buffer.from('Item 2: $5.99\n'),
  0x1B, 0x61, 0x01,  // Center
  ...Buffer.from('Thank you!\n'),
  0x1D, 0x56, 0x00   // Cut
]);
```

### Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { CommandParser, HTMLRenderer } from 'https://unpkg.com/esc-pos-preview-tools';

    // Your ESC-POS data here
    const data = new Uint8Array([0x1B, 0x40, ...]);

    const parser = new CommandParser();
    const renderer = new HTMLRenderer();
    const html = renderer.render(parser.parse(data).commands);

    document.getElementById('receipt').innerHTML = html;
  </script>
</head>
<body>
  <div id="receipt"></div>
</body>
</html>
```

---

## Python CLI Examples

```bash
# Convert ESC-POS to Python code
python python/escpos_cli.py convert receipt.bin -o receipt.py

# Verify conversion
python python/escpos_cli.py verify receipt.bin -c receipt.py

# Convert and verify
python python/escpos_cli.py convert receipt.bin --verify

# Verbose output
python python/escpos_cli.py convert receipt.bin --verbose
```

---

## Development

```bash
# Clone repository
git clone https://github.com/cobyhausrath/esc-pos-preview-tools.git
cd esc-pos-preview-tools

# Install dependencies
yarn install
pip install python-escpos pytest

# Run tests
yarn test:run
cd python && python test_escpos_verifier.py

# Build
yarn build

# Generate previews
yarn preview
# Open test-output/index.html
```

See **[QUICKSTART.md](QUICKSTART.md)** for complete development guide.

---

## Project Structure

```
esc-pos-preview-tools/
├── src/                    # TypeScript library
│   ├── parser/            # ESC-POS command parser
│   ├── renderer/          # HTML renderer
│   └── index.ts           # Main entry
├── python/                 # Python tools
│   ├── escpos_verifier.py # Verification system
│   ├── escpos_cli.py      # Command-line tool
│   └── escpos_constants.py # ESC-POS constants
├── web/                    # Browser editor
│   └── editor.html        # Pyodide-powered editor
├── samples/                # Sample ESC-POS files
│   ├── minimal.bin
│   ├── formatting.bin
│   └── receipt.bin
├── docs/                   # Documentation
└── test/                   # Test suite
```

---

## Roadmap

### ✅ Phase 1: Foundation (Complete)
- Parser for basic text commands
- HTML renderer with thermal styling
- Test suite
- Sample files

### ✅ Phase 2: Python Tools (Complete)
- Bidirectional ESC-POS ↔ python-escpos
- CLI tool
- Browser editor with Pyodide
- Security validation

### 🚧 Phase 3: Graphics (In Progress)
- Image rendering (ESC *, GS v)
- Barcode support (GS k)
- QR code support (GS ( k)
- Logo preview

### ⏳ Phase 4: Advanced Features (Planned)
- Complete command coverage
- Character encoding (code pages)
- International character sets
- More export formats (PDF, PNG)

### 💭 Future Vision
- Passthrough proxy server (intercept print jobs)
- Print approval workflow
- Job queue management
- REST API

See **[PROJECT_STATUS.md](PROJECT_STATUS.md)** for detailed roadmap.

---

## Browser Editor Demo

Try the live editor at: **[GitHub Pages Demo](https://cobyhausrath.github.io/esc-pos-preview-tools/)**

Features:
- Write python-escpos code
- See instant preview
- Import/export ESC-POS files
- Example templates
- Runs entirely in browser

---

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Areas where help is needed:
- Graphics/image rendering (high priority)
- Barcode and QR code support
- Additional ESC-POS commands
- Test coverage
- Documentation

---

## Testing

### TypeScript Tests

```bash
yarn test           # Watch mode
yarn test:run       # Run once
yarn test:coverage  # With coverage
```

16 tests covering:
- Command parsing
- HTML rendering
- Edge cases
- Error handling

### Python Tests

```bash
cd python
python test_escpos_verifier.py
# or
pytest test_escpos_verifier.py -v
```

18 tests covering:
- ESC-POS parsing
- Python code generation
- Bidirectional conversion
- Security validation

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- **python-escpos** - Python ESC-POS library
- **Pyodide** - Python in WebAssembly
- **ESC-POS specification** - Epson, Star Micronics, and others

---

## FAQ

**Q: Can this print to an actual printer?**
A: Not directly. This library parses and previews ESC-POS commands. To print, send the ESC-POS bytes to a thermal printer via USB, network, or bluetooth using another library.

**Q: Does it support all ESC-POS commands?**
A: Not yet. We support basic text formatting and paper control. Graphics, barcodes, and QR codes are planned next.

**Q: Can I use this in a web browser?**
A: Yes! The library works in browsers. The browser editor uses Pyodide to run python-escpos client-side.

**Q: Is the browser editor safe?**
A: Yes. Pyodide runs in a WebAssembly sandbox with no file system or network access. Python code is validated before execution.

**Q: What about the proxy server mentioned in old docs?**
A: That's a future vision, not currently implemented. The focus is on making the parser/renderer excellent first.

**Q: How do I add support for a new command?**
A: See [CLAUDE.md](CLAUDE.md) section "Adding New ESC-POS Commands" for step-by-step guide.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/cobyhausrath/esc-pos-preview-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/cobyhausrath/esc-pos-preview-tools/discussions)
- **Documentation**: See `docs/` directory

---

**Made with ❤️ for the thermal printing community**
