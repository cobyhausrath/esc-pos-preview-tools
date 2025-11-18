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
  flip: boolean;
  invert: boolean;
  width: number;
  height: number;
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
      flip: false,
      invert: false,
      width: 1,
      height: 1,
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
          // Also update width and height from the size byte
          const sizeValue = cmd.value as number;
          state.width = ((sizeValue & 0x30) >> 4) + 1;
          state.height = (sizeValue & 0x0f) + 1;
          break;

        case 'flip':
          state.flip = cmd.value as boolean;
          break;

        case 'invert':
          state.invert = cmd.value as boolean;
          break;

        case 'image':
          // Render image placeholder with byte count
          const imageInfo = cmd.value as string || 'unknown size';
          currentLine += `<span class="image-placeholder">[IMAGE: ${imageInfo}]</span>`;
          break;

        case 'barcode':
          // Render barcode placeholder with info
          const barcodeInfo = cmd.value as string || 'unknown';
          currentLine += `<span class="barcode-placeholder">[BARCODE: ${barcodeInfo}]</span>`;
          break;

        case 'qrcode':
          // Render QR code placeholder with info
          const qrcodeInfo = cmd.value as string || 'unknown';
          currentLine += `<span class="qrcode-placeholder">[QR CODE: ${qrcodeInfo}]</span>`;
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
          state.flip = false;
          state.invert = false;
          state.width = 1;
          state.height = 1;
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
    const classes: string[] = [];

    if (state.bold) {
      tags.push('strong');
    }
    if (state.underline) {
      tags.push('u');
    }

    // Add flip class if enabled
    if (state.flip) {
      classes.push('flip');
    }

    // Add invert class if enabled
    if (state.invert) {
      classes.push('invert');
    }

    // Get size class (for legacy ESC ! command)
    const sizeClass = this.getSizeClass(state.size);
    if (sizeClass) {
      classes.push(sizeClass);
    }

    // Add separate width/height classes if different from default
    if (state.width > 1) {
      classes.push(`width-${state.width}x`);
    }
    if (state.height > 1) {
      classes.push(`height-${state.height}x`);
    }

    // Wrap with span if we have classes
    if (classes.length > 0) {
      formatted = `<span class="${classes.join(' ')}">${formatted}</span>`;
    }

    // Apply formatting tags
    for (const tag of tags) {
      formatted = `<${tag}>${formatted}</${tag}>`;
    }

    return formatted;
  }

  private renderLine(content: string, state: RenderState): string {
    const alignClass = `align-${state.align}`;
    // If content is empty or only whitespace, render as empty line without formatting
    if (!content || content.trim().length === 0) {
      return `<div class="receipt-line ${alignClass}">&nbsp;</div>\n`;
    }
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
    // Calculate width based on character count for better readability
    // Courier New at 14px is approximately 8.5px per character
    const charWidth = 8.5;
    const pixelWidth = Math.round(this.printer.fonts.fontA.charactersPerLine * charWidth);

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
      word-break: break-all;
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

    /* Individual width/height multipliers (1-8x) */
    .width-2x { display: inline-block; transform: scaleX(2); transform-origin: left; }
    .width-3x { display: inline-block; transform: scaleX(3); transform-origin: left; }
    .width-4x { display: inline-block; transform: scaleX(4); transform-origin: left; }
    .width-5x { display: inline-block; transform: scaleX(5); transform-origin: left; }
    .width-6x { display: inline-block; transform: scaleX(6); transform-origin: left; }
    .width-7x { display: inline-block; transform: scaleX(7); transform-origin: left; }
    .width-8x { display: inline-block; transform: scaleX(8); transform-origin: left; }

    .height-2x { display: inline-block; transform: scaleY(2); transform-origin: top; }
    .height-3x { display: inline-block; transform: scaleY(3); transform-origin: top; }
    .height-4x { display: inline-block; transform: scaleY(4); transform-origin: top; }
    .height-5x { display: inline-block; transform: scaleY(5); transform-origin: top; }
    .height-6x { display: inline-block; transform: scaleY(6); transform-origin: top; }
    .height-7x { display: inline-block; transform: scaleY(7); transform-origin: top; }
    .height-8x { display: inline-block; transform: scaleY(8); transform-origin: top; }

    /* Flip (upside-down) effect */
    .flip {
      display: inline-block;
      transform: rotate(180deg);
    }

    /* Invert (white on black) effect */
    .invert {
      background-color: #000;
      color: #fff;
      padding: 0 2px;
    }

    strong {
      font-weight: bold;
      color: #000;
    }

    .invert strong {
      color: #fff;
    }

    u {
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
    }

    .image-placeholder {
      display: inline-block;
      background: #e0e0e0;
      border: 1px dashed #999;
      padding: 4px 8px;
      margin: 2px 0;
      color: #666;
      font-size: 12px;
      border-radius: 3px;
    }

    .barcode-placeholder {
      display: inline-block;
      background: #fff;
      border: 2px solid #333;
      padding: 8px 12px;
      margin: 4px 0;
      color: #333;
      font-size: 11px;
      font-family: 'Courier New', monospace;
      border-radius: 2px;
      font-weight: bold;
    }

    .qrcode-placeholder {
      display: inline-block;
      background: #fff;
      border: 2px solid #000;
      padding: 10px;
      margin: 4px 0;
      color: #000;
      font-size: 11px;
      font-family: 'Courier New', monospace;
      border-radius: 2px;
      font-weight: bold;
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
