/**
 * HTML Renderer for ESC/POS commands
 */

import { Command } from '../parser/types';
import { getPreferredPrinter, getPrinterById, PrinterDevice } from '../devices/printers';

interface RenderState {
  bold: boolean;
  underline: boolean;
  align: string;
  size: number;
}

interface HTMLRendererOptions {
  /** Character width (deprecated - use printer instead) */
  width?: number;
  /** Printer device ID or device object */
  printer?: string | PrinterDevice;
}

export class HTMLRenderer {
  private printer: PrinterDevice;

  constructor(options: HTMLRendererOptions = {}) {
    // Determine printer configuration
    if (typeof options.printer === 'string') {
      this.printer = getPrinterById(options.printer) || getPreferredPrinter();
    } else if (options.printer) {
      this.printer = options.printer;
    } else {
      this.printer = getPreferredPrinter();
    }

    // Legacy width option support - if provided, we could create a custom printer
    // For now, we ignore it and use the printer's default width
    if (options.width) {
      console.warn('HTMLRenderer: width option is deprecated, use printer option instead');
    }
  }

  render(commands: Command[]): string {
    const state: RenderState = {
      bold: false,
      underline: false,
      align: 'left',
      size: 0,
    };

    let html = this.getHeader();
    let currentLine = '';
    let openTags: string[] = [];

    for (const cmd of commands) {
      switch (cmd.type) {
        case 'text':
          // Apply current formatting
          const formatted = this.formatText(
            cmd.value as string,
            state,
            openTags
          );
          currentLine += formatted;
          break;

        case 'bold':
          state.bold = cmd.value as boolean;
          break;

        case 'underline':
          state.underline = cmd.value as boolean;
          break;

        case 'align':
          state.align = cmd.value as string;
          break;

        case 'size':
          state.size = cmd.value as number;
          break;

        case 'linefeed':
          html += this.renderLine(currentLine, state);
          currentLine = '';
          openTags = [];
          break;

        case 'initialize':
          // Reset state
          state.bold = false;
          state.underline = false;
          state.align = 'left';
          state.size = 0;
          break;
      }
    }

    // Render any remaining line
    if (currentLine) {
      html += this.renderLine(currentLine, state);
    }

    html += this.getFooter();
    return html;
  }

  private formatText(
    text: string,
    state: RenderState,
    _openTags: string[]
  ): string {
    let formatted = text;
    const tags: string[] = [];

    if (state.bold) {
      tags.push('strong');
    }
    if (state.underline) {
      tags.push('u');
    }

    // Get size class
    const sizeClass = this.getSizeClass(state.size);
    if (sizeClass) {
      formatted = `<span class="${sizeClass}">${formatted}</span>`;
    }

    // Apply formatting tags
    for (const tag of tags) {
      formatted = `<${tag}>${formatted}</${tag}>`;
    }

    return formatted;
  }

  private renderLine(content: string, state: RenderState): string {
    const alignClass = `align-${state.align}`;
    return `<div class="receipt-line ${alignClass}">${content}</div>\n`;
  }

  private getSizeClass(sizeMode: number): string | null {
    if (sizeMode === 0) return null;

    const doubleHeight = (sizeMode & 0x10) !== 0;
    const doubleWidth = (sizeMode & 0x20) !== 0;

    if (doubleHeight && doubleWidth) return 'size-double';
    if (doubleHeight) return 'size-tall';
    if (doubleWidth) return 'size-wide';

    return null;
  }

  private getHeader(): string {
    const pixelWidth = Math.round((this.printer.printableWidthMm / 25.4) * 96); // Convert mm to CSS pixels at 96 DPI

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESC/POS Preview - ${this.printer.manufacturer} ${this.printer.model}</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
      font-family: 'Courier New', 'Liberation Mono', monospace;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }
    .receipt-container {
      /* Thermal paper background - subtle off-white with hint of warmth */
      background: #fdfcfa;
      width: ${pixelWidth}px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      font-size: 14px;
      line-height: 1.5;
      position: relative;
      transition: all 0.3s ease;
    }

    /* Thermal filter active state */
    body.thermal-filter .receipt-container {
      background: linear-gradient(to bottom, #fdfcf7 0%, #f8f7f2 100%);
      background-image:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 1px,
          rgba(0,0,0,0.012) 1px,
          rgba(0,0,0,0.012) 2px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 1px,
          rgba(0,0,0,0.008) 1px,
          rgba(0,0,0,0.008) 2px
        ),
        linear-gradient(to bottom, #fdfcf7 0%, #f8f7f2 100%);
    }

    .receipt-line {
      white-space: pre-wrap;
      word-break: normal;
      overflow-wrap: normal;
      color: #000;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      transition: all 0.3s ease;
    }

    /* Thermal filter text effects */
    body.thermal-filter .receipt-line {
      -webkit-font-smoothing: none;
      -moz-osx-font-smoothing: grayscale;
      font-smooth: never;
      filter: blur(0.25px);
    }

    .align-left { text-align: left; }
    .align-center { text-align: center; }
    .align-right { text-align: right; }

    .size-wide {
      font-size: 200%;
      letter-spacing: 0.1em;
    }
    .size-tall {
      font-size: 200%;
      line-height: 2;
    }
    .size-double {
      font-size: 200%;
      letter-spacing: 0.1em;
      line-height: 2;
    }

    body.thermal-filter .size-wide,
    body.thermal-filter .size-tall,
    body.thermal-filter .size-double {
      filter: blur(0.3px);
    }

    strong {
      font-weight: bold;
      color: #000;
    }

    u {
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
    }

    /* Control panel */
    .controls {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.85);
      color: #fff;
      padding: 12px;
      border-radius: 6px;
      font-size: 11px;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 1000;
      min-width: 200px;
    }

    .controls h3 {
      margin: 0 0 8px 0;
      font-size: 12px;
      font-weight: 600;
    }

    .toggle-container {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #555;
      transition: 0.3s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: #2196F3;
    }

    input:checked + .slider:before {
      transform: translateX(20px);
    }

    .toggle-label {
      font-size: 11px;
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="controls">
    <h3>🖨️ Thermal Printer Preview</h3>
    <div style="font-size: 10px; color: #aaa; margin-bottom: 8px;">
      <strong>${this.printer.manufacturer} ${this.printer.model}</strong><br>
      Resolution: ${this.printer.dpi} DPI<br>
      Paper: ${this.printer.paperWidthMm}mm (${this.printer.printableWidthMm}mm printable)<br>
      Width: ${this.printer.fonts.fontA.charactersPerLine} chars (Font A)
    </div>
    <div class="toggle-container">
      <label class="toggle-switch">
        <input type="checkbox" id="thermalToggle">
        <span class="slider"></span>
      </label>
      <label for="thermalToggle" class="toggle-label">Realistic Filter</label>
    </div>
  </div>
  <div class="receipt-container">
`;
  }

  private getFooter(): string {
    return `  </div>
  <script>
    // Thermal filter toggle functionality
    const toggle = document.getElementById('thermalToggle');
    const body = document.body;

    // Load saved preference from localStorage
    const savedPreference = localStorage.getItem('thermalFilter');
    if (savedPreference === 'true') {
      toggle.checked = true;
      body.classList.add('thermal-filter');
    }

    // Handle toggle changes
    toggle.addEventListener('change', function() {
      if (this.checked) {
        body.classList.add('thermal-filter');
        localStorage.setItem('thermalFilter', 'true');
      } else {
        body.classList.remove('thermal-filter');
        localStorage.setItem('thermalFilter', 'false');
      }
    });
  </script>
</body>
</html>`;
  }
}
