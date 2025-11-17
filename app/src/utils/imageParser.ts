/**
 * Utility for detecting and parsing base64 image strings in python-escpos code
 */

export interface ImageMatch {
  /** Full matched text including base64 data */
  fullMatch: string;
  /** The base64 data string */
  base64Data: string;
  /** Start position in the code */
  startIndex: number;
  /** End position in the code */
  endIndex: number;
  /** Line number where the image starts (0-indexed) */
  lineNumber: number;
  /** Unique ID for this image */
  id: string;
  /** Image dimensions if found in comment */
  width?: number;
  height?: number;
  /** Implementation type if found in code */
  implementation?: 'bitImageColumn' | 'bitImageRaster' | 'graphics';
}

/**
 * Detects base64 image data in python-escpos code
 * Looks for patterns like: img_data = base64.b64decode('''...''')
 */
export function detectBase64Images(code: string): ImageMatch[] {
  const matches: ImageMatch[] = [];

  // Pattern to match the full img_data assignment including preceding comment
  // Captures: optional whitespace + img_data = base64.b64decode('''...''')
  const pattern = /([ \t]*)img_data\s*=\s*base64\.b64decode\('''([A-Za-z0-9+/=\s]+)'''\)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const indent = match[1];
    const fullMatch = match[0];
    const base64Data = match[2].replace(/\s+/g, ''); // Remove whitespace
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;

    // Calculate line number
    const precedingText = code.substring(0, startIndex);
    const lineNumber = (precedingText.match(/\n/g) || []).length;

    // Generate unique ID based on position and base64 hash
    const id = `img_${startIndex}_${base64Data.substring(0, 8)}`;

    // Try to extract dimensions from preceding comment on the same or previous line
    // Look for comment like: # Decode embedded image (384x256 dithered)
    const contextStart = Math.max(0, startIndex - 200);
    const context = code.substring(contextStart, endIndex);

    let width: number | undefined;
    let height: number | undefined;
    const dimensionMatch = context.match(/#[^\n]*\((\d+)x(\d+)/);
    if (dimensionMatch) {
      width = parseInt(dimensionMatch[1], 10);
      height = parseInt(dimensionMatch[2], 10);
    }

    // Try to extract implementation type from p.image() call after this
    // Look for: p.image(img, impl='bitImageRaster')
    const contextEnd = Math.min(code.length, endIndex + 500);
    const afterContext = code.substring(endIndex, contextEnd);
    let implementation: ImageMatch['implementation'];
    const implMatch = afterContext.match(/impl='(bitImageColumn|bitImageRaster|graphics)'/);
    if (implMatch) {
      implementation = implMatch[1] as ImageMatch['implementation'];
    }

    matches.push({
      fullMatch,
      base64Data,
      startIndex,
      endIndex,
      lineNumber,
      id,
      width,
      height,
      implementation,
    });
  }

  return matches;
}

/**
 * Replace a specific base64 image in code with new base64 data
 */
export function replaceBase64Image(
  code: string,
  imageMatch: ImageMatch,
  newBase64: string,
  newWidth?: number,
  newHeight?: number,
  newImplementation?: string
): string {
  const { startIndex, endIndex, width, height, implementation, fullMatch } = imageMatch;

  // Extract the indentation from the original match
  const indentMatch = fullMatch.match(/^([ \t]*)/);
  const indent = indentMatch ? indentMatch[1] : '';

  // Build the new img_data line with new base64, preserving indentation
  const newImgDataLine = `${indent}img_data = base64.b64decode('''${newBase64}''')`;

  // Replace the img_data line
  let newCode = code.substring(0, startIndex) + newImgDataLine + code.substring(endIndex);

  // Update dimensions in comment if they changed
  if (newWidth !== undefined && newHeight !== undefined && (newWidth !== width || newHeight !== height)) {
    // Find and update the comment with dimensions
    const commentPattern = /# Decode embedded image \(\d+x\d+/;
    const commentMatch = newCode.match(commentPattern);
    if (commentMatch) {
      const oldComment = commentMatch[0];
      const newComment = `# Decode embedded image (${newWidth}x${newHeight}`;
      newCode = newCode.replace(oldComment, newComment);
    }
  }

  // Update implementation if it changed
  if (newImplementation && newImplementation !== implementation) {
    const implPattern = /impl='(bitImageColumn|bitImageRaster|graphics)'/;
    const implMatch = newCode.match(implPattern);
    if (implMatch) {
      newCode = newCode.replace(implMatch[0], `impl='${newImplementation}'`);
    }
  }

  return newCode;
}

/**
 * Convert base64 string to a data URL for display
 */
export function base64ToDataUrl(base64: string): string {
  return `data:image/png;base64,${base64}`;
}

/**
 * Truncate base64 string for display in badge
 */
export function truncateBase64(base64: string, maxLength = 16): string {
  if (base64.length <= maxLength) {
    return base64;
  }
  return `${base64.substring(0, maxLength)}...`;
}
