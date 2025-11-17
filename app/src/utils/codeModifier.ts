import { AlignmentType, FontType } from '../types';

/**
 * CodeModifier - Intelligently modify Python python-escpos code
 *
 * This class provides methods to modify python-escpos code based on user
 * interactions with the receipt preview. It maps preview lines to source
 * code lines and inserts/updates p.set() calls appropriately.
 *
 * Supports:
 * - Text formatting (bold, underline, font, size, invert, flip, etc.)
 * - Content conversion (text to barcode/QR, image format changes)
 * - Alignment changes
 */
export class CodeModifier {
  private lines: string[];

  constructor(pythonCode: string) {
    this.lines = pythonCode.split('\n');
  }

  /**
   * Find the code line that generates a specific preview line
   *
   * Uses regex to match p.text() calls while avoiding false positives
   * from comments, string literals, or other objects.
   *
   * @param previewLine - Preview line number (0-indexed)
   * @returns Code line number or -1 if not found
   */
  findCodeLineForPreviewLine(previewLine: number): number {
    let textCallCount = 0;
    // Match p.text( at start of line (optionally indented, not in comments)
    // Handles variations like: p.text(, p . text(, etc.
    const textCallRegex = /^\s*p\s*\.\s*text\s*\(/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line) continue;

      const trimmedLine = line.trim();

      // Skip comment lines
      if (trimmedLine.startsWith('#')) continue;

      // Check if this line contains a p.text() call
      if (textCallRegex.test(line)) {
        if (textCallCount === previewLine) {
          return i;
        }
        textCallCount++;
      }
    }
    return -1;
  }

  /**
   * Insert or update a .set() call before a specific line
   *
   * If the previous line already has a p.set() call for the same attribute,
   * it will be updated. Otherwise, a new line is inserted.
   *
   * Preserves the indentation of the target line to avoid IndentationError.
   *
   * @param lineNumber - Line number to insert before
   * @param attribute - Attribute to set (e.g., 'bold', 'align')
   * @param value - Value to set
   */
  insertSetCall(
    lineNumber: number,
    attribute: string,
    value: string | boolean | number
  ): void {
    // Validate line number
    if (lineNumber < 0 || lineNumber >= this.lines.length) {
      console.error(
        `Invalid line number: ${lineNumber} (code has ${this.lines.length} lines)`
      );
      return;
    }

    // Format the value for Python
    let formattedValue: string;
    if (typeof value === 'boolean') {
      formattedValue = value ? 'True' : 'False';
    } else if (typeof value === 'string') {
      // Escape backslashes and single quotes to prevent Python syntax errors
      const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      formattedValue = `'${escaped}'`;
    } else {
      formattedValue = value.toString();
    }

    // Get indentation from the target line
    const targetLine = this.lines[lineNumber];
    if (!targetLine) {
      console.error(`Target line ${lineNumber} is undefined`);
      return;
    }

    const indentMatch = targetLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    const setCall = `${indent}p.set(${attribute}=${formattedValue})`;

    // Check if previous line has a set() call for this attribute
    if (lineNumber > 0) {
      const prevLine = this.lines[lineNumber - 1];
      if (prevLine && prevLine.includes(`p.set(${attribute}=`)) {
        // Update existing set() call, preserving indentation
        this.lines[lineNumber - 1] = setCall;
        return;
      }
    }

    // Insert new set() call with proper indentation
    this.lines.splice(lineNumber, 0, setCall);
  }

  /**
   * Toggle boolean attribute (bold, underline)
   *
   * @param lineNumber - Line number to modify
   * @param attribute - Attribute to toggle
   * @param currentValue - Current value
   */
  toggleAttribute(
    lineNumber: number,
    attribute: 'bold' | 'underline',
    currentValue: boolean
  ): void {
    const newValue = !currentValue;

    // For underline, python-escpos uses 1/0 instead of True/False
    if (attribute === 'underline') {
      this.insertSetCall(lineNumber, attribute, newValue ? 1 : 0);
    } else {
      this.insertSetCall(lineNumber, attribute, newValue);
    }
  }

  /**
   * Change alignment for a line
   *
   * @param lineNumber - Line number to modify
   * @param newAlign - New alignment ('left', 'center', 'right')
   */
  changeAlignment(lineNumber: number, newAlign: AlignmentType): void {
    this.insertSetCall(lineNumber, 'align', newAlign);
  }

  /**
   * Set a generic attribute (font, invert, flip, etc.)
   *
   * @param lineNumber - Line number to modify
   * @param attribute - Attribute name
   * @param value - Attribute value
   */
  setGenericAttribute(
    lineNumber: number,
    attribute: string,
    value: string | boolean | number
  ): void {
    this.insertSetCall(lineNumber, attribute, value);
  }

  /**
   * Change font for a line
   *
   * @param lineNumber - Line number to modify
   * @param newFont - New font ('a', 'b', 'c')
   */
  changeFont(lineNumber: number, newFont: FontType): void {
    this.insertSetCall(lineNumber, 'font', newFont);
  }

  /**
   * Change text size (width or height multiplier)
   *
   * @param lineNumber - Line number to modify
   * @param dimension - 'width' or 'height'
   * @param value - Multiplier value (1-8)
   */
  changeSize(lineNumber: number, dimension: 'width' | 'height', value: number): void {
    // Validate range (ESC-POS supports 1-8x multipliers)
    if (value < 1 || value > 8) {
      console.error(`Invalid ${dimension} value: ${value}, must be 1-8`);
      return;
    }
    this.insertSetCall(lineNumber, dimension, value);
  }

  /**
   * Convert a p.text() call to p.barcode()
   *
   * @param lineNumber - Line number to modify
   * @param barcodeType - Barcode type (e.g., 'CODE39', 'EAN13')
   */
  convertTextToBarcode(lineNumber: number, barcodeType: string = 'CODE39'): void {
    if (lineNumber < 0 || lineNumber >= this.lines.length) {
      console.error(`Invalid line number: ${lineNumber}`);
      return;
    }

    const line = this.lines[lineNumber];
    if (!line) {
      console.error(`Line ${lineNumber} is undefined`);
      return;
    }

    const textCallRegex = /p\s*\.\s*text\s*\((.*)\)/;
    const match = line.match(textCallRegex);

    if (match && match[1]) {
      // Extract the text argument (first argument to p.text())
      const args = match[1];
      // Get indentation
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';

      // Replace p.text() with p.barcode()
      this.lines[lineNumber] = `${indent}p.barcode(${args}, '${barcodeType}')`;
    }
  }

  /**
   * Convert a p.text() call to p.qr()
   *
   * @param lineNumber - Line number to modify
   */
  convertTextToQR(lineNumber: number): void {
    if (lineNumber < 0 || lineNumber >= this.lines.length) {
      console.error(`Invalid line number: ${lineNumber}`);
      return;
    }

    const line = this.lines[lineNumber];
    if (!line) {
      console.error(`Line ${lineNumber} is undefined`);
      return;
    }

    const textCallRegex = /p\s*\.\s*text\s*\((.*)\)/;
    const match = line.match(textCallRegex);

    if (match && match[1]) {
      // Extract the text argument
      const args = match[1];
      // Get indentation
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';

      // Replace p.text() with p.qr()
      this.lines[lineNumber] = `${indent}p.qr(${args})`;
    }
  }

  /**
   * Change image implementation format
   *
   * @param lineNumber - Line number to modify
   * @param impl - Implementation method ('bitImageColumn', 'bitImageRaster', etc.)
   */
  changeImageFormat(lineNumber: number, impl: string): void {
    if (lineNumber < 0 || lineNumber >= this.lines.length) {
      console.error(`Invalid line number: ${lineNumber}`);
      return;
    }

    const line = this.lines[lineNumber];
    if (!line) {
      console.error(`Line ${lineNumber} is undefined`);
      return;
    }

    const imageCallRegex = /p\s*\.\s*image\s*\((.*)\)/;
    const match = line.match(imageCallRegex);

    if (match && match[1]) {
      const args = match[1];
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';

      // Parse existing arguments to preserve non-impl parameters
      // For simplicity, we'll replace the entire impl parameter or add it
      let newArgs = args;

      // Check if impl is already present
      if (args.includes('impl=')) {
        // Replace existing impl value
        newArgs = args.replace(/impl\s*=\s*['"][^'"]*['"]/, `impl='${impl}'`);
      } else {
        // Add impl parameter (assuming first arg is the image)
        const firstArgEnd = args.indexOf(',') !== -1 ? args.indexOf(',') : args.length;
        const firstArg = args.substring(0, firstArgEnd);
        newArgs = `${firstArg}, impl='${impl}'`;
      }

      this.lines[lineNumber] = `${indent}p.image(${newArgs})`;
    }
  }

  /**
   * Parse a python-escpos command and apply it to the code
   *
   * This is a general-purpose method that can handle any python-escpos command
   * string (e.g., "p.set(bold=True)", "p.barcode('123', 'CODE39')")
   *
   * @param lineNumber - Preview line number
   * @param pythonCode - Python code snippet to apply
   */
  applyCommand(lineNumber: number, pythonCode: string): void {
    const codeLineNumber = this.findCodeLineForPreviewLine(lineNumber);
    if (codeLineNumber === -1) {
      console.error(`Could not find code line for preview line ${lineNumber}`);
      return;
    }

    // Detect command type
    if (pythonCode.includes('p.set(')) {
      // Extract attribute and value from p.set() call
      const setMatch = pythonCode.match(/p\.set\(([^=]+)=(.+)\)/);
      if (!setMatch || !setMatch[1] || !setMatch[2]) {
        console.warn(`Failed to parse p.set() command: ${pythonCode}`);
        return;
      }

      const attribute = setMatch[1].trim();
      let value: string | boolean | number = setMatch[2].trim();

      // Parse value
      if (value === 'True') value = true;
      else if (value === 'False') value = false;
      else if (value.startsWith("'") || value.startsWith('"')) {
        value = value.slice(1, -1); // Remove quotes
      } else if (!isNaN(Number(value))) {
        value = Number(value);
      }

      this.insertSetCall(codeLineNumber, attribute, value);
    } else if (pythonCode.includes('p.barcode(')) {
      // Extract barcode type
      const barcodeMatch = pythonCode.match(/p\.barcode\([^,]+,\s*['"]([^'"]+)['"]\)/);
      const barcodeType = (barcodeMatch && barcodeMatch[1]) ? barcodeMatch[1] : 'CODE39';
      this.convertTextToBarcode(codeLineNumber, barcodeType);
    } else if (pythonCode.includes('p.qr(')) {
      this.convertTextToQR(codeLineNumber);
    } else if (pythonCode.includes('p.image(')) {
      // Extract impl parameter
      const implMatch = pythonCode.match(/impl\s*=\s*['"]([^'"]+)['"]/);
      if (!implMatch || !implMatch[1]) {
        console.warn(`Failed to parse p.image() impl parameter: ${pythonCode}`);
        return;
      }
      this.changeImageFormat(codeLineNumber, implMatch[1]);
    } else {
      console.warn(`Unrecognized python-escpos command: ${pythonCode}`);
    }
  }

  /**
   * Get the modified code
   *
   * @returns Modified Python code as a string
   */
  getModifiedCode(): string {
    return this.lines.join('\n');
  }
}
