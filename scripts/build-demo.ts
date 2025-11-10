#!/usr/bin/env tsx

/**
 * Build script for generating demo pages
 * Creates a GitHub Pages site demonstrating ESC/POS command comparisons
 */

import { writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { CommandParser } from '../src/parser/CommandParser';
import { HTMLRenderer } from '../src/renderer/HTMLRenderer';
import { examples, DemoExample } from '../demo/examples';

const OUTPUT_DIR = join(process.cwd(), 'demo-output');
const WEB_DIR = join(process.cwd(), 'web');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Copy directory recursively
 */
function copyDirectory(src: string, dest: string) {
  if (!existsSync(src)) {
    console.log(`⚠️  Source directory not found: ${src}`);
    return;
  }

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src);

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Convert byte array to hex string for display
 */
function bytesToHex(bytes: Uint8Array): string {
  const hexLines: string[] = [];
  const bytesPerLine = 16;

  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const lineBytes = bytes.slice(i, i + bytesPerLine);
    const hex = Array.from(lineBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    const offset = i.toString(16).padStart(4, '0').toUpperCase();
    hexLines.push(`${offset}:  ${hex}`);
  }

  return hexLines.join('\n');
}

/**
 * Annotate hex bytes with ESC/POS command descriptions
 */
function annotateBytes(bytes: Uint8Array): string {
  const parser = new CommandParser();
  const parseResult = parser.parse(Buffer.from(bytes));

  let output = '';
  let byteIndex = 0;

  for (const cmd of parseResult.commands) {
    const cmdBytes = bytes.slice(byteIndex, byteIndex + (cmd.raw?.length || 0));
    const hex = Array.from(cmdBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    let description = '';
    switch (cmd.type) {
      case 'initialize':
        description = 'Initialize printer (ESC @)';
        break;
      case 'bold':
        description = `Bold ${cmd.enabled ? 'ON' : 'OFF'} (ESC E)`;
        break;
      case 'underline':
        description = `Underline ${cmd.mode === 0 ? 'OFF' : cmd.mode === 1 ? 'ON (1px)' : 'ON (2px)'} (ESC -)`;
        break;
      case 'align':
        description = `Align: ${cmd.alignment} (ESC a)`;
        break;
      case 'size':
        description = `Size: ${cmd.width}x${cmd.height} (ESC !)`;
        break;
      case 'cut':
        description = 'Paper cut (GS V)';
        break;
      case 'text':
        description = `Text: "${cmd.content}"`;
        break;
      case 'linefeed':
        description = 'Line feed (LF)';
        break;
      default:
        description = `Unknown command: ${cmd.type}`;
    }

    if (hex) {
      output += `${hex.padEnd(48)}  // ${description}\n`;
    }
    byteIndex += cmdBytes.length;
  }

  return output;
}

/**
 * Generate HTML page for a single example
 */
function generateExamplePage(example: DemoExample, index: number): string {
  const parser = new CommandParser();
  const renderer = new HTMLRenderer();

  const parseResult = parser.parse(Buffer.from(example.escPosBytes));
  const previewHtml = renderer.render(parseResult.commands);
  const hexDump = bytesToHex(example.escPosBytes);
  const annotatedBytes = annotateBytes(example.escPosBytes);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${example.title} - ESC/POS Preview Demo</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
    }

    header h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }

    nav {
      background: #f8f9fa;
      padding: 15px 30px;
      border-bottom: 1px solid #e0e0e0;
    }

    nav a {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }

    nav a:hover {
      text-decoration: underline;
    }

    .content {
      padding: 30px;
    }

    .description {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
      border-left: 4px solid #667eea;
    }

    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }

    @media (max-width: 1200px) {
      .comparison-grid {
        grid-template-columns: 1fr;
      }
    }

    .panel {
      background: #f8f9fa;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }

    .panel-header {
      background: #667eea;
      color: white;
      padding: 12px 16px;
      font-weight: 600;
      font-size: 0.95em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .panel-content {
      padding: 16px;
    }

    pre {
      background: #282c34;
      color: #abb2bf;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
    }

    .python-code {
      color: #e06c75;
    }

    .hex-dump {
      color: #98c379;
    }

    .annotated-bytes {
      color: #61afef;
      font-size: 12px;
    }

    .preview-wrapper {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 300px;
      padding: 20px;
      background: white;
    }

    .preview-wrapper iframe {
      border: 2px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      background: white;
      width: 100%;
      min-height: 400px;
    }

    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }

    .tab-button {
      padding: 8px 16px;
      background: #e0e0e0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    }

    .tab-button:hover {
      background: #d0d0d0;
    }

    .tab-button.active {
      background: #667eea;
      color: white;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${example.title}</h1>
      <p>Comparing python-escpos commands with raw ESC/POS bytes and visual preview</p>
    </header>

    <nav>
      <a href="index.html">← Back to Examples</a>
    </nav>

    <div class="content">
      <div class="description">
        <h2>Description</h2>
        ${example.description.split('\n').map(line => `<p>${line.trim()}</p>`).join('')}
      </div>

      <div class="comparison-grid">
        <div class="panel">
          <div class="panel-header">Python-escpos Code</div>
          <div class="panel-content">
            <pre class="python-code">${escapeHtml(example.pythonCode.trim())}</pre>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">Raw ESC/POS Bytes</div>
          <div class="panel-content">
            <div class="tabs">
              <button class="tab-button active" onclick="showTab('hex', this)">Hex Dump</button>
              <button class="tab-button" onclick="showTab('annotated', this)">Annotated</button>
            </div>
            <div id="hex" class="tab-content active">
              <pre class="hex-dump">${hexDump}</pre>
            </div>
            <div id="annotated" class="tab-content">
              <pre class="annotated-bytes">${annotatedBytes}</pre>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">Visual Preview</div>
          <div class="panel-content">
            <div class="preview-wrapper">
              <iframe srcdoc="${escapeHtml(previewHtml)}" style="width: 100%; height: 600px;"></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer>
      <p>Generated by ESC/POS Preview Tools | <a href="https://github.com/cobyhausrath/esc-pos-preview-tools" target="_blank">GitHub</a></p>
    </footer>
  </div>

  <script>
    function showTab(tabId, button) {
      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });

      // Deactivate all tab buttons
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
      });

      // Show selected tab
      document.getElementById(tabId).classList.add('active');
      button.classList.add('active');
    }
  </script>
</body>
</html>`;
}

/**
 * Generate the main index page
 */
function generateIndexPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESC/POS Preview Tools - Demo Gallery</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }

    .hero {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 60px 20px;
      text-align: center;
    }

    .hero h1 {
      font-size: 3em;
      margin-bottom: 20px;
    }

    .hero p {
      font-size: 1.3em;
      opacity: 0.95;
      max-width: 800px;
      margin: 0 auto 30px;
    }

    .hero-buttons {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      padding: 12px 24px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
      display: inline-block;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    .btn-secondary {
      background: transparent;
      border: 2px solid white;
      color: white;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .intro {
      text-align: center;
      margin-bottom: 50px;
    }

    .intro h2 {
      font-size: 2em;
      margin-bottom: 15px;
      color: #667eea;
    }

    .intro p {
      font-size: 1.1em;
      color: #666;
      max-width: 800px;
      margin: 0 auto;
    }

    .examples-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 30px;
      margin-bottom: 50px;
    }

    .example-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .example-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0,0,0,0.15);
    }

    .example-number {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      font-size: 2.5em;
      font-weight: bold;
      text-align: center;
    }

    .example-content {
      padding: 25px;
    }

    .example-content h3 {
      font-size: 1.5em;
      margin-bottom: 12px;
      color: #333;
    }

    .example-content p {
      color: #666;
      line-height: 1.6;
    }

    .features {
      background: white;
      border-radius: 8px;
      padding: 40px;
      margin-bottom: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .features h2 {
      font-size: 2em;
      margin-bottom: 30px;
      color: #667eea;
      text-align: center;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 30px;
    }

    .feature {
      text-align: center;
    }

    .feature-icon {
      font-size: 3em;
      margin-bottom: 15px;
    }

    .feature h3 {
      margin-bottom: 10px;
      color: #333;
    }

    .feature p {
      color: #666;
    }

    footer {
      background: white;
      padding: 30px;
      text-align: center;
      margin-top: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    footer p {
      color: #666;
      margin-bottom: 10px;
    }

    footer a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1>ESC/POS Preview Tools</h1>
    <p>Parse, render, and preview thermal receipt printer commands in your browser</p>
    <div class="hero-buttons">
      <a href="editor.html" class="btn">📱 Try the PWA Editor</a>
      <a href="https://github.com/cobyhausrath/esc-pos-preview-tools" class="btn btn-secondary">View on GitHub</a>
      <a href="https://www.npmjs.com/package/esc-pos-preview-tools" class="btn btn-secondary">Install via NPM</a>
    </div>
  </div>

  <div class="container">
    <div class="intro">
      <h2>Interactive Demonstrations</h2>
      <p>
        Explore how python-escpos commands translate to raw ESC/POS bytes and see the visual preview output.
        Each example shows side-by-side comparisons to help you understand thermal receipt printer programming.
      </p>
    </div>

    <div class="examples-grid">
${examples
  .map(
    (example, index) => `      <a href="example-${index + 1}.html" class="example-card">
        <div class="example-number">${String(index + 1).padStart(2, '0')}</div>
        <div class="example-content">
          <h3>${example.title}</h3>
          <p>${example.description.split('\n')[0].trim()}</p>
        </div>
      </a>`
  )
  .join('\n')}
    </div>

    <div class="features">
      <h2>Why Use ESC/POS Preview Tools?</h2>
      <div class="feature-grid">
        <div class="feature">
          <div class="feature-icon">📱</div>
          <h3>PWA Mobile Editor</h3>
          <p>Share to-do lists and images from your phone for instant printing</p>
        </div>
        <div class="feature">
          <div class="feature-icon">🔍</div>
          <h3>Visual Preview</h3>
          <p>See exactly how your receipts will look before printing</p>
        </div>
        <div class="feature">
          <div class="feature-icon">🔄</div>
          <h3>Passthrough Proxy</h3>
          <p>Intercept and review print jobs in real-time</p>
        </div>
        <div class="feature">
          <div class="feature-icon">📝</div>
          <h3>Command Parsing</h3>
          <p>Decode ESC/POS byte sequences into readable commands</p>
        </div>
        <div class="feature">
          <div class="feature-icon">🎨</div>
          <h3>HTML Rendering</h3>
          <p>Convert printer commands to beautiful HTML previews</p>
        </div>
        <div class="feature">
          <div class="feature-icon">📴</div>
          <h3>Offline Support</h3>
          <p>PWA works offline with service worker caching</p>
        </div>
      </div>
    </div>

    <footer>
      <p><strong>ESC/POS Preview Tools</strong></p>
      <p>A Node.js library for parsing and rendering thermal receipt printer commands</p>
      <p>
        <a href="https://github.com/cobyhausrath/esc-pos-preview-tools">GitHub</a> •
        <a href="https://www.npmjs.com/package/esc-pos-preview-tools">NPM</a> •
        <a href="https://github.com/cobyhausrath/esc-pos-preview-tools/blob/main/LICENSE">MIT License</a>
      </p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML for safe embedding
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Main build function
 */
function build() {
  console.log('🚀 Building demo pages...\n');

  // Generate example pages
  examples.forEach((example, index) => {
    const filename = `example-${index + 1}.html`;
    const html = generateExamplePage(example, index);
    const filepath = join(OUTPUT_DIR, filename);
    writeFileSync(filepath, html, 'utf-8');
    console.log(`✅ Generated: ${filename} - ${example.title}`);
  });

  // Generate index page
  const indexHtml = generateIndexPage();
  const indexPath = join(OUTPUT_DIR, 'index.html');
  writeFileSync(indexPath, indexHtml, 'utf-8');
  console.log(`✅ Generated: index.html`);

  // Copy web/ directory for PWA editor
  console.log('\n📱 Copying PWA editor...');
  copyDirectory(WEB_DIR, OUTPUT_DIR);
  console.log(`✅ Copied PWA files from web/ to demo-output/`);

  console.log(`\n✨ Demo build complete! Output: ${OUTPUT_DIR}`);
  console.log(`📂 Total files: ${examples.length + 1} + PWA files`);
}

// Run the build
build();
