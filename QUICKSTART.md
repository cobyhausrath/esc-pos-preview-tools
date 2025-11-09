# Quick Start Guide

Get up and running with ESC-POS Preview Tools in minutes.

---

## Prerequisites

- **Node.js 16+** and **Yarn**
- **Python 3.7+**
- **Git**

---

## Installation

```bash
# Clone the repository
git clone https://github.com/cobyhausrath/esc-pos-preview-tools.git
cd esc-pos-preview-tools

# Install JavaScript dependencies
yarn install

# Install Python dependencies
pip install python-escpos pytest
```

---

## Quick Test - Everything Works?

```bash
# Test TypeScript library
yarn test:run

# Test Python tools
cd python && python test_escpos_verifier.py && cd ..

# If both pass, you're good to go! ✅
```

---

## How to Run: TypeScript Parser/Renderer

### Build the Library

```bash
yarn build
```

This creates:
- `dist/index.js` - CommonJS bundle
- `dist/index.mjs` - ES module bundle
- `dist/index.d.ts` - TypeScript types

### Generate Receipt Previews

```bash
yarn preview
```

This generates HTML previews of sample receipts in `test-output/`:
- Open `test-output/index.html` in your browser
- See visual previews of all sample files
- Toggle thermal printer filter

### Use as Library

```typescript
import { CommandParser, HTMLRenderer } from 'esc-pos-preview-tools';

// Read ESC-POS data
const escposData = Buffer.from([
  0x1B, 0x40,        // Initialize
  0x1B, 0x45, 0x01,  // Bold on
  ...Buffer.from('Hello World'),
  0x1B, 0x45, 0x00,  // Bold off
  0x0A               // Line feed
]);

// Parse commands
const parser = new CommandParser();
const result = parser.parse(escposData);

console.log(result.commands);  // Array of parsed commands

// Render to HTML
const renderer = new HTMLRenderer();
const html = renderer.render(result.commands);

console.log(html);  // HTML preview
```

### Run Tests

```bash
# Watch mode (auto-reruns on changes)
yarn test

# Run once
yarn test:run

# With coverage report
yarn test:coverage
```

### Development Mode

```bash
# Build and watch for changes
yarn dev
```

---

## How to Run: Python Verification Tools

### Command-Line Interface

```bash
cd python

# Convert ESC-POS to python-escpos code
python escpos_cli.py convert ../samples/minimal.bin -o output.py

# Display in terminal (no output file)
python escpos_cli.py convert ../samples/minimal.bin

# Convert and verify in one step
python escpos_cli.py convert ../samples/receipt.bin -o receipt.py --verify

# Verify existing code
python escpos_cli.py verify ../samples/minimal.bin -c my_code.py

# Verbose output (shows debug info)
python escpos_cli.py convert ../samples/minimal.bin --verbose
```

### Use as Library

```python
from escpos_verifier import EscPosVerifier

# Create verifier instance
verifier = EscPosVerifier()

# Read ESC-POS file
with open('../samples/minimal.bin', 'rb') as f:
    escpos_bytes = f.read()

# Convert to python-escpos code
python_code = verifier.bytes_to_python_escpos(escpos_bytes)
print(python_code)

# Output:
# from escpos.printer import Dummy
#
# p = Dummy()
# p.text('Hello\n')
# p.cut()

# Verify the conversion
success, message = verifier.verify(escpos_bytes, python_code)
print(message)

# Check for warnings
if verifier.warnings:
    print("Warnings:")
    for warning in verifier.warnings:
        print(f"  - {warning}")
```

### Bidirectional Conversion

```python
from escpos_verifier import EscPosVerifier

verifier = EscPosVerifier()

# Start with python-escpos code
code = """
from escpos.printer import Dummy

p = Dummy()
p.set(align='center', bold=True)
p.text('MY STORE\\n')
p.set(bold=False, align='left')
p.text('Item: $10.00\\n')
p.cut()
"""

# Execute to get ESC-POS bytes
escpos_bytes = verifier.execute_python_code(code)

# Convert back to Python (round-trip test)
regenerated_code = verifier.bytes_to_python_escpos(escpos_bytes)

# Verify semantic equivalence
success, message = verifier.verify(escpos_bytes, regenerated_code)
print(message)  # Should be semantically equivalent
```

### Run Tests

```bash
cd python

# Run all tests
python test_escpos_verifier.py

# OR with pytest (more output)
pytest test_escpos_verifier.py -v

# Run specific test
python -m unittest test_escpos_verifier.TestEscPosVerifier.test_bold
```

---

## How to Run: Browser Editor

### Start Local Server

```bash
# From project root
cd web
python3 -m http.server 8000
```

### Open in Browser

```
http://localhost:8000/editor.html
```

### Features

- **Live Preview**: Type python-escpos code, see instant preview
- **Import ESC-POS**: Load .bin files and convert to Python code
- **Export ESC-POS**: Save edited receipts as .bin files
- **Example Templates**: Try built-in examples
- **Runs Offline**: After initial load (Pyodide caches)

### First Load

**Wait 3-7 seconds** for Pyodide to load python-escpos.
Watch the status indicator at the top.

### Try It Out

1. Click "Example Templates" → "Simple Receipt"
2. Edit the Python code in the left panel
3. Watch the preview update on the right
4. Click "Export ESC-POS" to save as .bin file

---

## How to Run: Demo Pages

### Build Demo

```bash
yarn demo:build
```

This creates demo pages in `demo/`:
- `demo/index.html` - Demo gallery
- `demo/simple.html` - Simple example
- `demo/formatted.html` - Formatted text
- `demo/receipt.html` - Full receipt

### View Demo Locally

```bash
# Serve demo directory
cd demo
python3 -m http.server 8000

# Open http://localhost:8000
```

### Deploy to GitHub Pages

Demos auto-deploy on push to `main`:
```bash
git push origin main
# Wait ~1 minute for GitHub Actions
# Visit: https://[username].github.io/esc-pos-preview-tools/
```

---

## Common Workflows

### Workflow 1: Preview Existing Receipt

```bash
# You have: receipt.bin
# You want: HTML preview

# Option A: Use Python CLI + browser
python python/escpos_cli.py convert receipt.bin -o receipt.py
# Open web/editor.html, paste code, see preview

# Option B: Use TypeScript (need to write code)
node -e "
const { CommandParser, HTMLRenderer } = require('./dist');
const fs = require('fs');
const data = fs.readFileSync('receipt.bin');
const parser = new CommandParser();
const renderer = new HTMLRenderer();
const result = parser.parse(data);
const html = renderer.render(result.commands);
console.log(html);
" > preview.html
```

### Workflow 2: Create New Receipt

```bash
# Open browser editor
cd web && python3 -m http.server 8000
# Open http://localhost:8000/editor.html

# Write python-escpos code in editor
# See live preview
# Export as .bin file when done
```

### Workflow 3: Test python-escpos Code

```bash
# You have: my_receipt.py (python-escpos code)
# You want: Verify it works

cd python
python << 'EOF'
from escpos_verifier import EscPosVerifier

# Read your code
with open('my_receipt.py', 'r') as f:
    code = f.read()

# Execute it
verifier = EscPosVerifier()
escpos_bytes = verifier.execute_python_code(code)

print(f"Generated {len(escpos_bytes)} bytes")

# Verify round-trip
regenerated = verifier.bytes_to_python_escpos(escpos_bytes)
success, msg = verifier.verify(escpos_bytes, regenerated)
print(msg)
EOF
```

### Workflow 4: Debug ESC-POS Commands

```bash
# You have: weird.bin (unknown ESC-POS data)
# You want: Understand what it does

cd python
python << 'EOF'
import logging
logging.basicConfig(level=logging.DEBUG)

from escpos_verifier import EscPosVerifier

with open('weird.bin', 'rb') as f:
    data = f.read()

# Show hex dump
print("Hex dump:")
print(' '.join(f'{b:02X}' for b in data))
print()

# Parse with detailed logging
verifier = EscPosVerifier()
commands = verifier.parse_escpos(data)

print(f"\nParsed {len(commands)} commands:")
for cmd in commands:
    print(f"  {cmd}")

# Check warnings
if verifier.warnings:
    print("\nWarnings:")
    for w in verifier.warnings:
        print(f"  - {w}")
EOF
```

---

## Development Workflow

### Adding a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes to src/ or python/

# 3. Add tests
# - TypeScript: src/**/*.test.ts
# - Python: python/test_escpos_verifier.py

# 4. Run tests
yarn test:run
cd python && python test_escpos_verifier.py && cd ..

# 5. Build and preview
yarn build
yarn preview

# 6. Commit
git add .
git commit -m "feat: add my feature"

# 7. Push
git push origin feature/my-feature
```

### Making a Release

```bash
# 1. Update version in package.json
# 2. Update CHANGELOG.md
# 3. Run all tests
yarn test:run
cd python && python test_escpos_verifier.py && cd ..

# 4. Build
yarn build

# 5. Commit and tag
git add .
git commit -m "chore: release v0.2.0"
git tag v0.2.0
git push origin main --tags

# 6. GitHub Actions will auto-deploy docs
# 7. Publish to npm (manual)
npm publish
```

---

## Troubleshooting

### Tests Fail

```bash
# Clean and rebuild
rm -rf node_modules dist
yarn install
yarn build
yarn test:run
```

### Python Import Errors

```bash
# Make sure you're in the python/ directory
cd python

# Install dependencies
pip install python-escpos pytest

# Check Python version (need 3.7+)
python --version
```

### Browser Editor Stuck Loading

- **Check browser console** for errors
- **Wait longer** - First load takes 3-7 seconds
- **Try different browser** - Chrome/Firefox work best
- **Clear cache** and reload

### Build Errors

```bash
# Check Node version (need 16+)
node --version

# Check Yarn version
yarn --version

# Reinstall dependencies
rm -rf node_modules yarn.lock
yarn install
```

---

## Next Steps

- **Read**: [CLAUDE.md](CLAUDE.md) - Project notes for developers
- **Explore**: [samples/README.md](samples/README.md) - Sample ESC-POS files
- **Contribute**: [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- **Plan**: [PROJECT_STATUS.md](PROJECT_STATUS.md) - Current status and roadmap

---

## Need Help?

- **Issues**: https://github.com/cobyhausrath/esc-pos-preview-tools/issues
- **Discussions**: https://github.com/cobyhausrath/esc-pos-preview-tools/discussions
- **Docs**: Check `docs/` directory for detailed documentation

---

**Happy Receipt Hacking! 🧾✨**
