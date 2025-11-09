# ESC-POS to python-escpos Verification Tool

## Overview

This module provides **bidirectional conversion and verification** between raw ESC-POS byte sequences and python-escpos API calls. It enables:

1. **Parsing ESC-POS bytes** → **Generating python-escpos code**
2. **Executing python-escpos code** → **Producing ESC-POS bytes**
3. **Verifying semantic equivalence** between input and output

## Use Cases

### 1. Receipt Editing Workflow

```python
from escpos_verifier import EscPosVerifier

verifier = EscPosVerifier()

# 1. Import ESC-POS from any source
escpos_bytes = open('receipt.bin', 'rb').read()

# 2. Convert to editable Python code
python_code = verifier.bytes_to_python_escpos(escpos_bytes)

# 3. User edits the Python code
# ... (edit in IDE, web interface, etc.)

# 4. Generate new ESC-POS output
new_bytes = verifier.execute_python_code(python_code)

# 5. Verify it works
success, message = verifier.verify(escpos_bytes, python_code)
print(message)
```

### 2. Receipt Template Analysis

```python
# Analyze existing receipt templates
commands = verifier.parse_escpos(escpos_bytes)

for cmd in commands:
    print(f"{cmd.name}: {cmd.params}")
```

### 3. Code Generation for Documentation

```python
# Generate Python examples from real receipts
python_code = verifier.bytes_to_python_escpos(escpos_bytes)
print("Example usage:")
print(python_code)
```

## Installation

```bash
pip install python-escpos
```

## Quick Start

### Command-Line Demo

```bash
python escpos_verifier.py
```

Output:
```
============================================================
ESC-POS to python-escpos Verification Demo
============================================================

1. Parsing ESC-POS bytes...

2. Generated python-escpos code:
------------------------------------------------------------
from escpos.printer import Dummy

# Create a Dummy printer to capture output
p = Dummy()

# Execute commands
p.hw('init')
p.set(align='center')
p.set(bold=True)
p.text('MY STORE')
p.set(bold=False)
p.text('\n')
p.set(align='left')
p.text('Item: $9.99')
p.text('\n')
p.cut(mode='FULL')

# Get the generated ESC-POS bytes
escpos_output = p.output
------------------------------------------------------------

3. Verifying output...
✓ Verification successful: Semantically equivalent
...
```

### Python API

```python
from escpos_verifier import EscPosVerifier

# Create verifier
verifier = EscPosVerifier()

# Example ESC-POS sequence
escpos = bytes([
    0x1B, 0x40,              # Initialize
    0x1B, 0x61, 0x01,        # Center align
    ord('H'), ord('e'), ord('l'), ord('l'), ord('o'),
    0x0A,                     # Line feed
])

# Parse to structured commands
commands = verifier.parse_escpos(escpos)

# Generate python-escpos code
python_code = verifier.bytes_to_python_escpos(escpos)

# Execute and verify
success, message = verifier.verify(escpos, python_code)
```

## Supported ESC-POS Commands

| Command | ESC-POS Bytes | python-escpos API | Status |
|---------|---------------|-------------------|--------|
| Initialize | `ESC @` (0x1B 0x40) | `p.hw('init')` | ✅ |
| Bold | `ESC E n` (0x1B 0x45 n) | `p.set(bold=True/False)` | ✅ |
| Underline | `ESC - n` (0x1B 0x2D n) | `p.set(underline=n)` | ✅ |
| Alignment | `ESC a n` (0x1B 0x61 n) | `p.set(align='left/center/right')` | ✅ |
| Print Mode | `ESC ! n` (0x1B 0x21 n) | `p.set(width=, height=, bold=)` | ✅ |
| Character Size | `GS ! n` (0x1D 0x21 n) | `p.set(width=, height=)` | ✅ |
| Paper Cut | `GS V m` (0x1D 0x56 m) | `p.cut(mode='FULL/PART')` | ✅ |
| Line Feed | `LF` (0x0A) | `p.text('\n')` | ✅ |
| Plain Text | ASCII (0x20-0x7E) | `p.text('...')` | ✅ |

### Future Expansion

Commands that can be added:
- Graphics (raster images, logos)
- Barcodes (CODE39, CODE128, EAN13, etc.)
- QR codes
- Character encodings (CP437, CP850, etc.)
- International character sets
- Advanced formatting (reverse video, rotation, etc.)

## API Reference

### `EscPosVerifier`

Main class for ESC-POS verification.

#### Methods

##### `parse_escpos(data: bytes) -> List[ParsedCommand]`

Parse raw ESC-POS bytes into structured commands.

**Parameters:**
- `data`: Raw ESC-POS byte sequence

**Returns:**
- List of `ParsedCommand` objects

**Example:**
```python
commands = verifier.parse_escpos(b'\x1b\x40Hello\x0a')
# [
#   ParsedCommand(name='initialize', ...),
#   ParsedCommand(name='text', params={'text': 'Hello'}),
#   ParsedCommand(name='line_feed', ...)
# ]
```

##### `generate_python_code(commands: List[ParsedCommand]) -> str`

Generate python-escpos code from parsed commands.

**Parameters:**
- `commands`: List of parsed commands

**Returns:**
- Complete Python script as string

##### `bytes_to_python_escpos(escpos_bytes: bytes) -> str`

Convert ESC-POS bytes directly to python-escpos code (convenience method).

**Parameters:**
- `escpos_bytes`: Raw ESC-POS byte sequence

**Returns:**
- Complete Python script using python-escpos API

**Example:**
```python
code = verifier.bytes_to_python_escpos(escpos_bytes)
print(code)
# from escpos.printer import Dummy
# ...
# p.text('Hello\n')
```

##### `execute_python_code(code: str) -> bytes`

Execute python-escpos code and return generated bytes.

**Parameters:**
- `code`: Python code string to execute

**Returns:**
- Generated ESC-POS bytes

**Raises:**
- `RuntimeError`: If execution fails

##### `verify(original_bytes: bytes, generated_code: str, semantic: bool = True) -> Tuple[bool, str]`

Verify that python-escpos code generates equivalent output.

**Parameters:**
- `original_bytes`: Original ESC-POS byte sequence
- `generated_code`: Generated python-escpos code
- `semantic`: If True (default), compare semantic equivalence. If False, require byte-for-byte match.

**Returns:**
- Tuple of (success: bool, message: str)

**Example:**
```python
success, message = verifier.verify(original, code)
if success:
    print("✓ Verified!")
else:
    print(f"✗ Failed: {message}")
```

### `ParsedCommand`

Data class representing a parsed ESC-POS command.

**Attributes:**
- `name` (str): Command name (e.g., 'text', 'bold', 'align')
- `escpos_bytes` (bytes): Original ESC-POS byte sequence
- `python_call` (str): Equivalent python-escpos API call
- `params` (Dict[str, Any]): Command parameters

## Verification Modes

### Semantic Verification (Default)

Compares commands semantically, ignoring python-escpos implementation details:

```python
success, msg = verifier.verify(original, code, semantic=True)
```

**Why semantic?**
- python-escpos adds implementation-specific commands (e.g., `ESC t` for character table)
- These don't affect visual output
- Semantic verification focuses on what matters

### Byte-for-Byte Verification

Requires exact byte match:

```python
success, msg = verifier.verify(original, code, semantic=False)
```

**When to use:**
- Low-level debugging
- Protocol compliance testing
- When implementation details matter

## Testing

Run the comprehensive test suite:

```bash
python test_escpos_verifier.py
```

**Test coverage:**
- 18 test cases
- All basic ESC-POS commands
- Edge cases (empty input, truncated sequences)
- Round-trip verification
- Code generation
- Semantic equivalence

## Browser Integration

See [BROWSER_INTEGRATION.md](../docs/BROWSER_INTEGRATION.md) for details on running this in-browser with Pyodide.

### Quick Demo

Open `web/editor.html` in a browser to see the real-time editor in action:

1. **Loads Pyodide** (Python in WebAssembly)
2. **Installs python-escpos** automatically
3. **Provides live preview** as you type
4. **Import/export** ESC-POS files
5. **Example templates** included

## Performance

### Python (Native)

- **Parsing**: ~0.1ms per command
- **Code generation**: ~0.5ms for typical receipt
- **Execution**: ~10-50ms (depends on complexity)
- **Verification**: ~20-100ms (includes execution + parsing)

### Browser (Pyodide)

- **Initial load**: 3-7 seconds (one-time)
- **Code execution**: ~10-50ms (same as native)
- **Preview update**: <100ms (feels instant)

## Limitations

### Current Limitations

1. **Graphics not supported**: Images, logos, raster graphics
2. **No barcode/QR parsing**: Can't convert codes to Python
3. **ASCII text only**: International characters need work
4. **Basic commands only**: Advanced features not yet implemented

### Design Limitations

1. **python-escpos adds commands**: Implementation details differ
2. **Semantic equivalence required**: Byte-for-byte match rarely possible
3. **Execution requires Dummy printer**: Can't test with real hardware

## Contributing

To add support for more ESC-POS commands:

1. **Add parsing** in `_parse_esc_sequence()` or `_parse_gs_sequence()`
2. **Map to python-escpos** API call in `python_call` field
3. **Add test case** in `test_escpos_verifier.py`
4. **Update documentation** in this README

Example:

```python
# In _parse_esc_sequence():
elif command == 0x4D:  # ESC M - Select character font
    if self.position + 2 >= len(data):
        self.position += 2
        return
    font = data[self.position + 2]
    self.commands.append(ParsedCommand(
        name="font",
        escpos_bytes=bytes([0x1B, 0x4D, font]),
        python_call=f"p.set(font='{chr(ord('a') + font)}')",
        params={"font": font}
    ))
    self.position += 3
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           ESC-POS Byte Stream              │
│         (from printer, file, etc.)         │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │   parse_escpos()     │
       │  (Byte-by-byte scan) │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │  List[ParsedCommand] │
       │  (Structured data)   │
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │ generate_python_code()│
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │   Python Script      │
       │  (using python-escpos)│
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │  execute_python_code()│
       └──────────┬───────────┘
                  │
                  ▼
       ┌──────────────────────┐
       │  ESC-POS Byte Stream │
       │   (new output)       │
       └──────────────────────┘
```

## Examples

### Example 1: Simple Receipt

```python
escpos = bytes([
    0x1B, 0x40,              # Initialize
    0x1B, 0x61, 0x01,        # Center
    ord('T'), ord('E'), ord('S'), ord('T'),
    0x0A,                     # Line feed
])

code = verifier.bytes_to_python_escpos(escpos)
```

Generated code:
```python
from escpos.printer import Dummy

# Create a Dummy printer to capture output
p = Dummy()

# Execute commands
p.hw('init')
p.set(align='center')
p.text('TEST')
p.text('\n')

# Get the generated ESC-POS bytes
escpos_output = p.output
```

### Example 2: Formatted Text

```python
escpos = bytes([
    0x1B, 0x45, 0x01,        # Bold on
    ord('B'), ord('O'), ord('L'), ord('D'),
    0x1B, 0x45, 0x00,        # Bold off
    0x0A,
])

commands = verifier.parse_escpos(escpos)
for cmd in commands:
    print(f"{cmd.name:15} {cmd.python_call}")
```

Output:
```
bold            p.set(bold=True)
text            p.text('BOLD')
bold            p.set(bold=False)
line_feed       p.text('\n')
```

## License

Same as parent project (MIT).

## Related Projects

- **python-escpos**: https://github.com/python-escpos/python-escpos
- **esc-pos-preview-tools**: Parent project
- **Pyodide**: https://pyodide.org/

## Support

For issues or questions:
1. Check the [documentation](../docs/)
2. Run the test suite
3. Open an issue on GitHub
