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
   * This works by counting p.text() calls in the code. Each p.text() call
   * corresponds to one or more preview lines.
   *
   * @param previewLine - Preview line number (0-indexed)
   * @returns Code line number or -1 if not found
   */
  findCodeLineForPreviewLine(previewLine: number): number {
    let textCallCount = 0;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].includes('p.text(')) {
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
   * @param lineNumber - Line number to insert before
   * @param attribute - Attribute to set (e.g., 'bold', 'align')
   * @param value - Value to set
   */
  insertSetCall(
    lineNumber: number,
    attribute: string,
    value: string | boolean | number
  ): void {
    // Format the value for Python
    let formattedValue: string;
    if (typeof value === 'boolean') {
      formattedValue = value ? 'True' : 'False';
    } else if (typeof value === 'string') {
      formattedValue = `'${value}'`;
    } else {
      formattedValue = value.toString();
    }

    const setCall = `p.set(${attribute}=${formattedValue})`;

    // Check if previous line has a set() call for this attribute
    if (lineNumber > 0) {
      const prevLine = this.lines[lineNumber - 1];
      if (prevLine.includes(`p.set(${attribute}=`)) {
        // Update existing set() call
        this.lines[lineNumber - 1] = setCall;
        return;
      }
    }

    // Insert new set() call
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
