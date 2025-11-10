# 🔥 CRITICAL: Import .bin Files and Convert to python-escpos Code

## Problem
Users can currently:
- ✅ Write python-escpos code → Generate ESC-POS bytes
- ✅ Import .bin files → View preview
- ❌ **Import .bin files → Generate python-escpos code** ← MISSING!

This is a **critical bidirectional workflow gap**. Users cannot:
- Import receipts from physical printers
- Reverse-engineer existing ESC-POS output
- Learn from real-world examples
- Debug what actual printers are producing

## Current State

The `importFile()` method in `web/editor.html` only renders the preview:

```javascript
async importFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  this.renderPreview(bytes);  // ✓ Preview works
  // ✗ No code generation!
}
```

## Proposed Solution

### Architecture
Reuse the **existing Python verification system** from `python/escpos_verifier.py`!

The verifier already:
- ✅ Parses ESC-POS bytes
- ✅ Understands printer state (alignment, bold, underline, etc.)
- ✅ Generates python-escpos code from parsed commands

**We just need to expose it in the browser via Pyodide!**

### Implementation Plan

#### 1. Load escpos_verifier.py in Pyodide

```javascript
async init() {
  // ... existing Pyodide setup

  // Load our verifier module
  await this.pyodide.runPythonAsync(`
    import micropip
    await micropip.install('python-escpos')

    # Load escpos_verifier.py from embedded source
    exec('''${ESCPOS_VERIFIER_SOURCE}''')
  `);
}
```

#### 2. Convert bytes to python-escpos code

```javascript
async importFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Convert bytes to Python code using verifier
  const pythonCode = await this.pyodide.runPythonAsync(`
from escpos_verifier import EscPosVerifier

verifier = EscPosVerifier()
escpos_bytes = bytes(${JSON.stringify(Array.from(bytes))})
python_code = verifier.to_python_code(escpos_bytes)
python_code
  `);

  // Update editor with generated code
  document.getElementById('editor').value = pythonCode;

  // Run to show preview
  this.runCode();

  this.updateStatus('success', `Imported ${bytes.length} bytes`);
}
```

#### 3. Embed escpos_verifier.py in editor.html

Options:
- **Option A**: Fetch from `/python/escpos_verifier.py` at runtime
- **Option B**: Inline the source in editor.html during build
- **Option C**: Bundle with Pyodide packages

Recommended: **Option A** (simpler, keeps code separate)

### Expected Workflow

**User perspective:**
1. Click "📁 Import" button
2. Select `.bin` file from disk (e.g., from physical printer)
3. **Magic happens** ✨
4. Editor populated with python-escpos code
5. Preview shows rendered receipt
6. User can edit and customize

### Example

**Input:** `sample.bin` containing:
```
1B 40          (ESC @ - Initialize)
1B 61 01       (ESC a 1 - Center align)
1B 45 01       (ESC E 1 - Bold on)
48 45 4C 4C 4F (ASCII "HELLO")
0A             (LF)
```

**Output in editor:**
```python
from escpos.printer import Dummy

# Create printer
p = Dummy()

# Initialize
p._raw(b'\x1b@')

# Center alignment
p.set(align='center')

# Bold text
p.set(bold=True)
p.text('HELLO\n')
```

## Technical Challenges

### 1. State Reconstruction
The verifier must track:
- Alignment state (left/center/right)
- Text formatting (bold, underline, size)
- Character encoding
- When to emit `.set()` vs `.text()` calls

**Solution**: Existing `escpos_verifier.py` already does this!

### 2. Code Style
Generated code should match editor conventions:
- Use `Dummy()` printer
- Group related `.set()` calls
- Add helpful comments for unknown commands

### 3. Unknown/Unsupported Commands
Some bytes may be unknown or unsupported:

**Solution**:
- Add as raw bytes: `p._raw(b'\x1b\x??\x??')`
- Include warning comments
- Log to console

### 4. Performance
Large .bin files (>100KB) may be slow:

**Solution**:
- Show loading indicator
- Use Web Worker (future enhancement)
- Warn on files >1MB

## Implementation Checklist

### Phase 1: Basic Import
- [ ] Fetch `escpos_verifier.py` into Pyodide runtime
- [ ] Add `to_python_code()` method to verifier if missing
- [ ] Wire up import button to call verifier
- [ ] Display generated code in editor
- [ ] Handle basic commands (ESC @, ESC a, ESC E, text)

### Phase 2: Enhanced Conversion
- [ ] Support all ESC commands (underline, size, etc.)
- [ ] Support GS commands (cut, character size)
- [ ] Generate clean, readable code
- [ ] Add comments for command groups
- [ ] Handle unknown bytes gracefully

### Phase 3: Polish
- [ ] Add loading indicator for large files
- [ ] Show conversion warnings in UI
- [ ] Add "Import from URL" option
- [ ] Add "Import from example library"
- [ ] Add undo/redo for imports

## File Structure

```
web/
  editor.html           # Updated with import logic
python/
  escpos_verifier.py    # ✓ Already exists!
  escpos_constants.py   # ✓ Already exists!
```

## Related Issues
- Depends on: #N/A (verifier already exists)
- Blocks: Context menu editing (needs to understand code structure)
- Related: HEX view inline editing (alternative approach)

## References
- Existing: `python/escpos_verifier.py` - Already implements parsing!
- Existing: `python/test_escpos_verifier.py` - Test cases show expected behavior

## Acceptance Criteria
- [ ] Import .bin button loads file
- [ ] File bytes converted to python-escpos code
- [ ] Generated code appears in editor
- [ ] Preview renders correctly
- [ ] Code is human-readable and editable
- [ ] Works with all sample .bin files in `/samples`
- [ ] Handles unknown commands gracefully
- [ ] Shows clear error messages on failure
- [ ] Performance acceptable (<2s for typical receipts)

## Priority
**🔥 CRITICAL** - This is a core feature that enables the bidirectional workflow. Without it, users can only create receipts from scratch, not learn from or edit existing ones.

## Complexity
**Medium-High** - The hard work is already done in `escpos_verifier.py`. Main challenge is integrating with Pyodide and ensuring code quality.
