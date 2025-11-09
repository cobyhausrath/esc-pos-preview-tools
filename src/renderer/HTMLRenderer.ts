/**
 * HTML Renderer for ESC/POS commands
 */

import { Command } from '../parser/types';

interface RenderState {
  bold: boolean;
  underline: boolean;
  align: string;
  size: number;
}

export class HTMLRenderer {
  private width: number;

  constructor(options: { width?: number } = {}) {
    this.width = options.width || 48;
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
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESC/POS Preview - Thermal Printer Simulation</title>
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
      /* Thermal paper background - slightly off-white/yellowish */
      background: linear-gradient(to bottom, #fdfcf7 0%, #f8f7f2 100%);
      width: ${this.width * 10}px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      font-size: 14px;
      line-height: 1.5;
      position: relative;

      /* Simulate thermal printer texture and grain - very subtle */
      background-image:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 1px,
          rgba(0,0,0,0.008) 1px,
          rgba(0,0,0,0.008) 2px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 1px,
          rgba(0,0,0,0.005) 1px,
          rgba(0,0,0,0.005) 2px
        );
    }

    .receipt-line {
      white-space: pre-wrap;
      word-wrap: break-word;
      /* Simulate thermal printer dot matrix text */
      color: #000;
      text-rendering: optimizeSpeed;
      -webkit-font-smoothing: none;
      -moz-osx-font-smoothing: grayscale;
      font-smooth: never;

      /* Add very slight blur to simulate thermal printer resolution (203 DPI) */
      filter: blur(0.3px);
    }

    .align-left { text-align: left; }
    .align-center { text-align: center; }
    .align-right { text-align: right; }

    .size-wide {
      font-size: 200%;
      letter-spacing: 0.1em;
      /* Larger text gets slightly more blur */
      filter: blur(0.35px);
    }
    .size-tall {
      font-size: 200%;
      line-height: 2;
      filter: blur(0.35px);
    }
    .size-double {
      font-size: 200%;
      letter-spacing: 0.1em;
      line-height: 2;
      filter: blur(0.35px);
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

    /* Add info banner */
    .thermal-info {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div class="thermal-info">
    🖨️ Thermal Printer Simulation<br>
    Resolution: 203 DPI (80mm)
  </div>
  <div class="receipt-container">
`;
  }

  private getFooter(): string {
    return `  </div>
</body>
</html>`;
  }
}
