# Browser Integration with Pyodide

## Overview

This document describes how to run python-escpos in the browser using Pyodide (Python compiled to WebAssembly) for real-time receipt editing with instant preview.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Environment                      │
│                                                               │
│  ┌─────────────────┐    ┌──────────────────┐                │
│  │  User Interface  │───▶│  Code Editor     │                │
│  │  (HTML/CSS)     │    │  (Monaco/Ace)    │                │
│  └─────────────────┘    └──────────────────┘                │
│           │                      │                            │
│           ▼                      ▼                            │
│  ┌──────────────────────────────────────────┐               │
│  │         Pyodide Runtime                   │               │
│  │  ┌────────────────────────────────────┐  │               │
│  │  │      python-escpos Library        │  │               │
│  │  │      (installed via micropip)     │  │               │
│  │  └────────────────────────────────────┘  │               │
│  │  ┌────────────────────────────────────┐  │               │
│  │  │    escpos_verifier.py Module      │  │               │
│  │  └────────────────────────────────────┘  │               │
│  └──────────────────────────────────────────┘               │
│           │                      │                            │
│           ▼                      ▼                            │
│  ┌─────────────────┐    ┌──────────────────┐                │
│  │  ESC-POS Bytes   │───▶│  HTML Renderer   │                │
│  │  (Binary Output) │    │  (TypeScript)    │                │
│  └─────────────────┘    └──────────────────┘                │
│                                  │                            │
│                                  ▼                            │
│                          ┌──────────────────┐                │
│                          │  Receipt Preview │                │
│                          │  (Live Update)   │                │
│                          └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

1. **Zero Server Dependency**: Everything runs client-side
2. **Real-time Preview**: Instant feedback as you type python-escpos code
3. **Bidirectional Editing**:
   - Import ESC-POS from any source
   - Edit as python-escpos code
   - Generate new ESC-POS output
   - Preview in real-time
4. **Offline Capable**: Works without internet after initial load
5. **No Installation**: Users just need a web browser

## Implementation Steps

### 1. Load Pyodide

```html
<!DOCTYPE html>
<html>
<head>
    <title>ESC-POS Receipt Editor</title>
    <script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>
</head>
<body>
    <script type="module">
        // Initialize Pyodide
        let pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
        });

        console.log("Pyodide loaded successfully!");
    </script>
</body>
</html>
```

### 2. Install python-escpos

```javascript
async function setupPythonEnvironment() {
    // Load micropip for package installation
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");

    // Install python-escpos
    await micropip.install("python-escpos");

    // Load the verifier module
    await pyodide.runPythonAsync(`
        from escpos.printer import Dummy
        import js

        # Make it available globally
        globals()['Dummy'] = Dummy
    `);

    console.log("python-escpos installed!");
}
```

### 3. Load Verification Module

```javascript
async function loadVerifier() {
    // Fetch the verifier module
    const response = await fetch('/python/escpos_verifier.py');
    const verifierCode = await response.text();

    // Load it into Pyodide
    await pyodide.runPythonAsync(verifierCode);

    // Create verifier instance
    await pyodide.runPythonAsync(`
        verifier = EscPosVerifier()
    `);

    console.log("Verifier loaded!");
}
```

### 4. Convert ESC-POS to Python Code

```javascript
async function escposToPython(escposBytes) {
    // Convert JavaScript Uint8Array to Python bytes
    pyodide.globals.set("escpos_input", escposBytes);

    // Run conversion
    const pythonCode = await pyodide.runPythonAsync(`
        import js

        # Convert JS array to Python bytes
        escpos_bytes = bytes(escpos_input)

        # Convert to python-escpos code
        python_code = verifier.bytes_to_python_escpos(escpos_bytes)
        python_code
    `);

    return pythonCode;
}
```

### 5. Execute Python Code and Get ESC-POS Output

```javascript
async function pythonToEscpos(pythonCode) {
    // Execute the code and get output
    const output = await pyodide.runPythonAsync(`
        # Execute the user's code
        exec("""${pythonCode.replace(/"/g, '\\"')}""")

        # Return as JavaScript array
        list(escpos_output)
    `);

    // Convert Python list to Uint8Array
    return new Uint8Array(output);
}
```

### 6. Real-time Editor with Preview

```javascript
class ReceiptEditor {
    constructor() {
        this.editor = null;
        this.pyodide = null;
        this.debounceTimer = null;
    }

    async init() {
        // Load Pyodide
        this.pyodide = await loadPyodide();
        await this.setupPython();

        // Setup code editor (Monaco or similar)
        this.setupEditor();

        // Setup preview
        this.setupPreview();
    }

    async setupPython() {
        await this.pyodide.loadPackage("micropip");
        const micropip = this.pyodide.pyimport("micropip");
        await micropip.install("python-escpos");

        // Load verifier
        const response = await fetch('/python/escpos_verifier.py');
        const code = await response.text();
        await this.pyodide.runPythonAsync(code);
        await this.pyodide.runPythonAsync('verifier = EscPosVerifier()');
    }

    setupEditor() {
        // Initialize Monaco editor or similar
        this.editor = monaco.editor.create(document.getElementById('editor'), {
            value: this.getDefaultCode(),
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true
        });

        // Add change listener
        this.editor.onDidChangeModelContent(() => {
            this.onCodeChange();
        });
    }

    onCodeChange() {
        // Debounce to avoid excessive updates
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.updatePreview();
        }, 300); // 300ms debounce
    }

    async updatePreview() {
        try {
            const code = this.editor.getValue();

            // Execute python-escpos code
            const escposBytes = await this.pythonToEscpos(code);

            // Render preview
            await this.renderPreview(escposBytes);

            // Show success
            this.showStatus('✓ Valid', 'success');

        } catch (error) {
            // Show error
            this.showStatus(`✗ Error: ${error.message}`, 'error');
        }
    }

    async pythonToEscpos(code) {
        // Escape code for Python execution
        const escapedCode = code.replace(/\\/g, '\\\\')
                                .replace(/"/g, '\\"')
                                .replace(/\n/g, '\\n');

        const output = await this.pyodide.runPythonAsync(`
            from escpos.printer import Dummy
            import io

            # Execute user code
            p = Dummy()
            exec("""${escapedCode}""")

            # Get output as list
            list(p.output)
        `);

        return new Uint8Array(output);
    }

    async renderPreview(escposBytes) {
        // Use existing TypeScript renderer
        const parser = new CommandParser();
        const renderer = new HTMLRenderer();

        const buffer = Buffer.from(escposBytes);
        const parseResult = parser.parse(buffer);
        const html = renderer.render(parseResult.commands);

        // Display in preview pane
        document.getElementById('preview').innerHTML = html;
    }

    async importEscpos(escposBytes) {
        // Convert to python-escpos code
        this.pyodide.globals.set("input_bytes", escposBytes);

        const pythonCode = await this.pyodide.runPythonAsync(`
            escpos_bytes = bytes(input_bytes)
            verifier.bytes_to_python_escpos(escpos_bytes)
        `);

        // Set in editor
        this.editor.setValue(pythonCode);
    }

    getDefaultCode() {
        return `from escpos.printer import Dummy

# Create printer
p = Dummy()

# Your receipt code here
p.set(align='center')
p.set(bold=True)
p.text('MY STORE\\n')
p.set(bold=False)

p.set(align='left')
p.text('Item 1: $10.00\\n')
p.text('Item 2: $5.99\\n')

p.text('\\n')
p.set(align='center')
p.text('Thank you!\\n')

p.cut(mode='FULL')
`;
    }

    showStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
    }
}

// Initialize when page loads
window.addEventListener('load', async () => {
    const editor = new ReceiptEditor();
    await editor.init();

    // Expose for debugging
    window.receiptEditor = editor;
});
```

## HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ESC-POS Receipt Editor</title>

    <!-- Pyodide -->
    <script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>

    <!-- Monaco Editor -->
    <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js"></script>

    <style>
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        .editor-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .preview-pane {
            flex: 0 0 400px;
            border-left: 1px solid #ddd;
            overflow-y: auto;
            padding: 20px;
            background: #f5f5f5;
        }

        .toolbar {
            padding: 10px;
            background: #2c2c2c;
            color: white;
            display: flex;
            gap: 10px;
            align-items: center;
        }

        #editor {
            flex: 1;
        }

        .status {
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 14px;
        }

        .status.success {
            background: #4caf50;
            color: white;
        }

        .status.error {
            background: #f44336;
            color: white;
        }

        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background: #007acc;
            color: white;
            cursor: pointer;
            font-size: 14px;
        }

        button:hover {
            background: #005a9e;
        }
    </style>
</head>
<body>
    <div class="editor-pane">
        <div class="toolbar">
            <button id="run-btn">▶ Run</button>
            <button id="import-btn">📁 Import ESC-POS</button>
            <button id="export-btn">💾 Export</button>
            <div id="status" class="status">Ready</div>
        </div>
        <div id="editor"></div>
    </div>

    <div class="preview-pane">
        <h3>Preview</h3>
        <div id="preview">
            <!-- Receipt preview will appear here -->
        </div>
    </div>

    <script src="receipt-editor.js"></script>
</body>
</html>
```

## Performance Considerations

### Initial Load Time

- **Pyodide**: ~20MB download, takes 2-5 seconds to load
- **python-escpos**: ~500KB, takes 1-2 seconds to install
- **Total initial load**: 3-7 seconds

**Optimization strategies**:
1. Show loading progress indicator
2. Cache Pyodide and packages in Service Worker
3. Use lazy loading for non-critical features

### Runtime Performance

- **Code execution**: ~10-50ms (fast enough for real-time)
- **Preview rendering**: ~5-20ms (depends on receipt complexity)
- **Total update latency**: <100ms (feels instant)

**Optimization strategies**:
1. Debounce editor changes (300ms)
2. Use Web Workers for heavy processing
3. Implement virtual scrolling for long receipts

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |

**Requirements**:
- WebAssembly support
- ES6 modules
- Async/await

## Deployment

### Option 1: Static Hosting (Recommended)

Deploy to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront

**Advantages**:
- No server needed
- Scales infinitely
- Zero maintenance
- Free tier available

### Option 2: Self-Hosted

Bundle all assets and serve locally:

```bash
# Build the application
npm run build

# Serve locally
npx serve dist/
```

### Option 3: Progressive Web App (PWA)

Add offline support with Service Worker:

```javascript
// service-worker.js
const CACHE_NAME = 'escpos-editor-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/receipt-editor.js',
    '/python/escpos_verifier.py',
    'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js',
    'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.asm.wasm',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});
```

## Security Considerations

### Code Execution Safety

Pyodide runs in a sandboxed environment:
- No access to file system
- No network access (unless explicitly allowed)
- No access to system calls

**User code safety**:
- All python-escpos code runs in isolated context
- Cannot access browser APIs unless bridged
- Cannot execute arbitrary system commands

### Content Security Policy

Recommended CSP headers:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net;
               style-src 'self' 'unsafe-inline';">
```

## Example Use Cases

### 1. Receipt Template Editor

```javascript
// Load template from file
const file = await fileInput.files[0];
const bytes = new Uint8Array(await file.arrayBuffer());

// Convert to editable Python code
const code = await editor.importEscpos(bytes);

// User edits the code
// ...

// Export back to ESC-POS
const newBytes = await editor.pythonToEscpos(code);
const blob = new Blob([newBytes], { type: 'application/octet-stream' });
saveAs(blob, 'receipt.bin');
```

### 2. Real-time Receipt Designer

```javascript
// User types Python code
editor.onDidChangeModelContent(async () => {
    try {
        const escposBytes = await pythonToEscpos(editor.getValue());
        renderPreview(escposBytes);
    } catch (error) {
        showError(error);
    }
});
```

### 3. Receipt Testing Tool

```javascript
// Test different receipts quickly
const templates = {
    'basic': 'p.text("Hello\\n")',
    'formatted': 'p.set(bold=True); p.text("Bold\\n")',
    'complex': '...'
};

// Switch between templates
function loadTemplate(name) {
    editor.setValue(templates[name]);
    // Preview updates automatically
}
```

## Next Steps

1. **Create prototype HTML/JS interface** (see prototype implementation below)
2. **Integrate with existing TypeScript renderer**
3. **Add file import/export functionality**
4. **Implement template library**
5. **Add syntax highlighting for ESC-POS commands in comments**
6. **Build example gallery**

## Resources

- **Pyodide Documentation**: https://pyodide.org/en/stable/
- **python-escpos Documentation**: https://python-escpos.readthedocs.io/
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/
- **WebAssembly**: https://webassembly.org/

## Conclusion

Running python-escpos in the browser with Pyodide is not only possible but **ideal** for this use case:

✅ **Zero installation** - just open a web page
✅ **Real-time feedback** - instant preview as you type
✅ **Bidirectional editing** - import/edit/export seamlessly
✅ **Offline capable** - works without internet
✅ **Platform independent** - runs anywhere with a browser
✅ **Easy deployment** - static hosting is cheap/free

The initial load time (3-7 seconds) is a small price for the convenience of a fully client-side solution.
