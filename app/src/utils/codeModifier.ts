import { AlignmentType } from '../types';

/**
 * CodeModifier - Intelligently modify Python python-escpos code
 *
 * This class provides methods to modify python-escpos code based on user
 * interactions with the receipt preview. It maps preview lines to source
 * code lines and inserts/updates p.set() calls appropriately.
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
      const line = this.lines[i].trim();

      // Skip comment lines
      if (line.startsWith('#')) continue;

      // Check if this line contains a p.text() call
      if (textCallRegex.test(this.lines[i])) {
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
    const indentMatch = targetLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    const setCall = `${indent}p.set(${attribute}=${formattedValue})`;

    // Check if previous line has a set() call for this attribute
    if (lineNumber > 0) {
      const prevLine = this.lines[lineNumber - 1];
      if (prevLine.includes(`p.set(${attribute}=`)) {
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
   * Get the modified code
   *
   * @returns Modified Python code as a string
   */
  getModifiedCode(): string {
    return this.lines.join('\n');
  }
}
