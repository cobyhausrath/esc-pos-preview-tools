import { useState, useCallback, useEffect } from 'react';
import {
  LineState,
  CommandMetadata,
  AlignmentType,
  ContextMenuPosition,
  ContextMenuAction,
  FontType,
  LineContentType,
  LineAttributes,
} from '../types';
import { ContextMenu } from './ContextMenu';
import { decodeRasterImage } from '@/utils/rasterDecoder';

interface ReceiptPreviewProps {
  escposBytes: Uint8Array | null;
  isLoading: boolean;
  onContextMenuAction: (lineNumber: number, code: string) => void;
}

/**
 * Decode ESC/POS bit image data to a data URL for display
 *
 * ESC * format: ESC * m nL nH [data]
 * - Data is organized in vertical columns
 * - Each byte represents 8 vertical pixels (bit 0 = top, bit 7 = bottom)
 * - For 24-dot modes, 3 bytes per column (top 8, middle 8, bottom 8)
 */
function decodeEscPosImage(
  data: Uint8Array,
  width: number,
  height: number,
  bytesPerColumn: number
): string {
  if (import.meta.env.DEV) {
    console.log('[Image Decode]', {
      dataLength: data.length,
      width,
      height,
      bytesPerColumn,
      expectedBytes: width * bytesPerColumn,
    });
  }

  // Validate dimensions
  if (width <= 0 || height <= 0) {
    console.error('[Image Decode] Invalid dimensions:', { width, height });
    return '';
  }

  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[Image Decode] Failed to get canvas context');
    return '';
  }

  // Create image data
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  // Decode bitmap data (column-major order)
  let dataIdx = 0;
  for (let x = 0; x < width; x++) {
    for (let byteInCol = 0; byteInCol < bytesPerColumn; byteInCol++) {
      if (dataIdx >= data.length) break;

      const byte = data[dataIdx++];
      const yOffset = byteInCol * 8;

      // Extract 8 vertical pixels from this byte
      // Note: bit 7 (MSB) is top, bit 0 (LSB) is bottom in ESC * format
      for (let bit = 0; bit < 8; bit++) {
        const y = yOffset + (7 - bit); // Reverse bit order for correct vertical orientation
        if (y >= height) break;

        const pixelOn = (byte & (1 << bit)) !== 0;
        const pixelIdx = (y * width + x) * 4;

        // Set pixel color (black if on, white if off)
        pixels[pixelIdx] = pixelOn ? 0 : 255; // R
        pixels[pixelIdx + 1] = pixelOn ? 0 : 255; // G
        pixels[pixelIdx + 2] = pixelOn ? 0 : 255; // B
        pixels[pixelIdx + 3] = 255; // A
      }
    }
  }

  // Put pixels on canvas
  ctx.putImageData(imageData, 0, 0);

  // Convert to data URL
  const dataURL = canvas.toDataURL('image/png');

  if (import.meta.env.DEV) {
    console.log('[Image Decode] Generated data URL length:', dataURL.length);
  }

  return dataURL;
}


/**
 * ReceiptPreview - Display formatted ESC-POS receipt with context menu support
 *
 * This component:
 * - Parses ESC-POS bytes to HTML
 * - Tracks command metadata for each line
 * - Attaches data attributes for context menu
 * - Handles right-click to show context menu
 */
export default function ReceiptPreview({
  escposBytes,
  isLoading,
  onContextMenuAction,
}: ReceiptPreviewProps) {
  const [contextMenu, setContextMenu] = useState<{
    lineNumber: number;
    attributes: LineAttributes;
    commands: CommandMetadata[];
    position: ContextMenuPosition;
  } | null>(null);

  const [commandMap] = useState<Map<number, LineState>>(new Map());
  const [previewLines, setPreviewLines] = useState<
    Array<{
      text: string;
      align: AlignmentType;
      bold: boolean;
      underline: boolean;
      font?: FontType;
      width?: number;
      height?: number;
      invert?: boolean;
      flip?: boolean;
      smooth?: boolean;
      doubleWidth?: boolean;
      doubleHeight?: boolean;
      contentType?: LineContentType;
      textContent?: string;
      lineNumber: number;
    }>
  >([]);

  // Parse ESC-POS bytes and track commands
  const parseEscPos = useCallback(
    (bytes: Uint8Array) => {
      const lines: Array<{
        text: string;
        align: AlignmentType;
        bold: boolean;
        underline: boolean;
        font?: FontType;
        width?: number;
        height?: number;
        invert?: boolean;
        flip?: boolean;
        smooth?: boolean;
        doubleWidth?: boolean;
        doubleHeight?: boolean;
        contentType?: LineContentType;
        textContent?: string;
        lineNumber: number;
      }> = [];
      const newCommandMap = new Map<number, LineState>();
      let lineCommands: CommandMetadata[] = [];

      let currentAlign: AlignmentType = 'left';
      let currentBold = false;
      let currentUnderline = false;
      let currentFont: FontType = 'a';
      let currentWidth = 1;
      let currentHeight = 1;
      let currentInvert = false;
      let currentFlip = false;
      let currentSmooth = false;
      let currentDoubleWidth = false;
      let currentDoubleHeight = false;
      let currentLine = '';
      let lineCount = 0;
      let i = 0;

      // Helper function to push current line with all attributes
      const pushCurrentLine = () => {
        lines.push({
          text: currentLine,
          align: currentAlign,
          bold: currentBold,
          underline: currentUnderline,
          font: currentFont,
          width: currentWidth,
          height: currentHeight,
          invert: currentInvert,
          flip: currentFlip,
          smooth: currentSmooth,
          doubleWidth: currentDoubleWidth,
          doubleHeight: currentDoubleHeight,
          contentType: 'text',
          textContent: currentLine,
          lineNumber: lineCount,
        });
        newCommandMap.set(lineCount, {
          align: currentAlign,
          bold: currentBold,
          underline: currentUnderline,
          font: currentFont,
          width: currentWidth,
          height: currentHeight,
          invert: currentInvert,
          flip: currentFlip,
          smooth: currentSmooth,
          doubleWidth: currentDoubleWidth,
          doubleHeight: currentDoubleHeight,
          commands: [...lineCommands],
        });
        lineCount++;
        lineCommands = [];
        currentLine = '';
      };

      while (i < bytes.length) {
        const byte = bytes[i];

        // ESC sequences
        if (byte === 0x1b && i + 1 < bytes.length) {
          const cmd = bytes[i + 1];

          // ESC @ - Initialize
          if (cmd === 0x40) {
            lineCommands.push({
              type: 'initialize',
              pythonCode: "p.set(align='left', bold=False, underline=0)",
            });
            i += 2;
            continue;
          }

          // ESC a - Alignment
          if (cmd === 0x61 && i + 2 < bytes.length) {
            if (currentLine) {
              pushCurrentLine();
            }
            const align = bytes[i + 2];
            currentAlign =
              align === 1 ? 'center' : align === 2 ? 'right' : 'left';
            lineCommands.push({
              type: 'alignment',
              value: currentAlign,
              pythonCode: `p.set(align='${currentAlign}')`,
            });
            i += 3;
            continue;
          }

          // ESC E - Bold
          if (cmd === 0x45 && i + 2 < bytes.length) {
            currentBold = bytes[i + 2] !== 0;
            lineCommands.push({
              type: 'bold',
              value: currentBold,
              pythonCode: `p.set(bold=${currentBold ? 'True' : 'False'})`,
            });
            i += 3;
            continue;
          }

          // ESC - - Underline
          if (cmd === 0x2d && i + 2 < bytes.length) {
            currentUnderline = bytes[i + 2] !== 0;
            lineCommands.push({
              type: 'underline',
              value: currentUnderline,
              pythonCode: `p.set(underline=${currentUnderline ? '1' : '0'})`,
            });
            i += 3;
            continue;
          }

          // ESC ! - Print mode (font, emphasis, double height, double width, underline)
          if (cmd === 0x21 && i + 2 < bytes.length) {
            const mode = bytes[i + 2];
            // Bit 0: Font B (0=Font A, 1=Font B)
            const fontB = (mode & 0x01) !== 0;
            currentFont = fontB ? 'b' : 'a';
            // Bit 3: Emphasis (bold)
            currentBold = (mode & 0x08) !== 0;
            // Bit 4: Double height
            currentDoubleHeight = (mode & 0x10) !== 0;
            // Bit 5: Double width
            currentDoubleWidth = (mode & 0x20) !== 0;
            // Bit 7: Underline
            currentUnderline = (mode & 0x80) !== 0;

            lineCommands.push({
              type: 'size',
              value: mode,
              pythonCode: `p.set(font='${currentFont}', bold=${currentBold}, double_height=${currentDoubleHeight}, double_width=${currentDoubleWidth}, underline=${currentUnderline ? '1' : '0'})`,
            });
            i += 3;
            continue;
          }

          // ESC M - Font selection
          if (cmd === 0x4d && i + 2 < bytes.length) {
            const fontMode = bytes[i + 2];
            currentFont = fontMode === 0 ? 'a' : fontMode === 1 ? 'b' : 'c';
            lineCommands.push({
              type: 'font',
              value: currentFont,
              pythonCode: `p.set(font='${currentFont}')`,
            });
            i += 3;
            continue;
          }

          // ESC { - Upside down mode
          if (cmd === 0x7b && i + 2 < bytes.length) {
            currentFlip = bytes[i + 2] !== 0;
            lineCommands.push({
              type: 'flip',
              value: currentFlip,
              pythonCode: `p.set(flip=${currentFlip ? 'True' : 'False'})`,
            });
            i += 3;
            continue;
          }

          // ESC * - Bit Image
          if (cmd === 0x2a && i + 4 < bytes.length) {
            const mode = bytes[i + 2];
            const nL = bytes[i + 3];
            const nH = bytes[i + 4];
            const widthInPixels = nL + (nH * 256);

            // Determine dots per column based on mode
            let dotsPerColumn = 8;
            if (mode === 0 || mode === 1) dotsPerColumn = 8;
            else if (mode === 32 || mode === 33) dotsPerColumn = 24;

            const bytesPerColumn = dotsPerColumn / 8;
            const totalDataBytes = widthInPixels * bytesPerColumn;
            const totalSize = 5 + totalDataBytes;

            if (import.meta.env.DEV) {
              console.log('[ESC *] Parsing image:', {
                mode,
                widthInPixels,
                dotsPerColumn,
                bytesPerColumn,
                totalDataBytes,
                totalSize,
                availableBytes: bytes.length - i,
              });
            }

            if (i + totalSize <= bytes.length) {
              // Extract and decode image data
              const imageData = bytes.slice(i + 5, i + totalSize);
              const width = widthInPixels;
              const height = dotsPerColumn;

              // Decode bitmap and create data URL
              const imageDataURL = decodeEscPosImage(imageData, width, height, bytesPerColumn);

              if (import.meta.env.DEV) {
                console.log('[ESC *] Generated data URL:', {
                  length: imageDataURL.length,
                  preview: imageDataURL.substring(0, 50),
                  isEmpty: imageDataURL === '',
                });
              }

              // Skip if data URL generation failed
              if (!imageDataURL) {
                if (import.meta.env.DEV) {
                  console.error('[ESC *] Failed to generate data URL, skipping image');
                }
                i += totalSize;
                continue;
              }

              // Flush current line if exists
              if (currentLine) {
                pushCurrentLine();
              }

              // Add image as a special line with data URL
              lines.push({
                text: `__IMAGE__${imageDataURL}`,
                align: currentAlign, // Use current alignment instead of hardcoding
                bold: false,
                underline: false,
                contentType: 'image',
                lineNumber: lineCount,
              });
              lineCount++;

              lineCommands.push({
                type: 'image',
                value: mode,
                pythonCode: `p.image(img, impl='bitImageColumn')`,
              });

              i += totalSize;

              // Skip line feed if immediately after image (avoid blank lines between strips)
              if (i < bytes.length && bytes[i] === 0x0a) {
                if (import.meta.env.DEV) {
                  console.log('[ESC *] Skipping LF after image to avoid gap');
                }
                i++;
              }

              continue;
            }
          }

          i += 2;
          continue;
        }

        // GS sequences
        if (byte === 0x1d && i + 1 < bytes.length) {
          const cmd = bytes[i + 1];

          // GS ! - Character size
          if (cmd === 0x21 && i + 2 < bytes.length) {
            const size = bytes[i + 2];
            // Lower 3 bits: width multiplier (1-8)
            currentWidth = (size & 0x07) + 1;
            // Upper 3 bits: height multiplier (1-8)
            currentHeight = ((size >> 4) & 0x07) + 1;
            lineCommands.push({
              type: 'size',
              value: size,
              pythonCode: `p.set(width=${currentWidth}, height=${currentHeight})`,
            });
            i += 3;
            continue;
          }

          // GS B - White/black reverse printing
          if (cmd === 0x42 && i + 2 < bytes.length) {
            currentInvert = bytes[i + 2] !== 0;
            lineCommands.push({
              type: 'invert',
              value: currentInvert,
              pythonCode: `p.set(invert=${currentInvert ? 'True' : 'False'})`,
            });
            i += 3;
            continue;
          }

          // GS V - Cut
          if (cmd === 0x56 && i + 2 < bytes.length) {
            if (currentLine) {
              pushCurrentLine();
            }
            lines.push({
              text: '--- ✂ ---',
              align: 'center',
              bold: false,
              underline: false,
              contentType: 'text',
              lineNumber: lineCount,
            });
            lineCount++;
            i += 3;
            continue;
          }

          // GS v 0 - Raster Image
          if (cmd === 0x76) {
            // Check if we have at least the header (8 bytes)
            if (i + 7 < bytes.length) {
              const subCmd = bytes[i + 2];
              const m = bytes[i + 3]; // mode
              const xL = bytes[i + 4];
              const xH = bytes[i + 5];
              const yL = bytes[i + 6];
              const yH = bytes[i + 7];
              const widthBytes = xL + (xH * 256);
              const heightDots = yL + (yH * 256);
              const totalDataBytes = widthBytes * heightDots;
              const totalSize = 8 + totalDataBytes;

              if (import.meta.env.DEV) {
                console.log('[GS v 0] Parsing raster image:', {
                  subCmd,
                  mode: m,
                  widthBytes,
                  heightDots,
                  totalDataBytes,
                  totalSize,
                  availableBytes: bytes.length - i,
                });
              }

              // Validate subcommand for raster format
              // ESC/POS spec: GS v '0' uses ASCII character '0' (0x30), not binary 0x00
              if (subCmd !== 0x30) {
                if (import.meta.env.DEV) {
                  console.warn('[GS v] Unsupported subcommand, skipping header only:', subCmd, `(0x${subCmd.toString(16)})`);
                }
                i += 8; // Skip 8-byte header only
                continue;
              }

              // Check if we have full command data
              if (i + totalSize <= bytes.length) {
                // Extract and decode raster image data
                const imageData = bytes.slice(i + 8, i + totalSize);

                // Decode bitmap and create data URL
                const imageDataURL = decodeRasterImage(imageData, widthBytes, heightDots);

                if (import.meta.env.DEV) {
                  console.log('[GS v 0] Generated data URL:', {
                    length: imageDataURL.length,
                    preview: imageDataURL.substring(0, 50),
                    isEmpty: imageDataURL === '',
                  });
                }

                // Skip if data URL generation failed
                if (!imageDataURL) {
                  if (import.meta.env.DEV) {
                    console.error('[GS v 0] Failed to generate data URL, skipping entire command');
                  }
                  i += totalSize;
                  continue;
                }

                // Flush current line if exists
                if (currentLine) {
                  pushCurrentLine();
                }

                // Add image as a special line with data URL
                lines.push({
                  text: `__IMAGE__${imageDataURL}`,
                  align: currentAlign,
                  bold: false,
                  underline: false,
                  contentType: 'image',
                  lineNumber: lineCount,
                });
                lineCount++;

                lineCommands.push({
                  type: 'image',
                  value: m,
                  pythonCode: `p.image(img, impl='bitImageRaster')`,
                });

                i += totalSize;

                // Skip line feed if immediately after image (avoid blank lines between strips)
                if (i < bytes.length && bytes[i] === 0x0a) {
                  if (import.meta.env.DEV) {
                    console.log('[GS v 0] Skipping LF after image to avoid gap');
                  }
                  i++;
                }

                continue;
              } else {
                // Not enough data - this is likely truncated/incomplete
                // Only skip the 8-byte header to avoid over-skipping
                if (import.meta.env.DEV) {
                  console.warn('[GS v 0] Incomplete data - need', totalSize, 'bytes but only have', bytes.length - i, 'remaining. Skipping header only.');
                }
                i += 8;
                continue;
              }
            }
            // Not enough bytes for header, treat as unknown GS command
            i += 2;
            continue;
          }

          i += 2;
          continue;
        }

        // Line feed
        if (byte === 0x0a) {
          pushCurrentLine();
          i++;
          continue;
        }

        // Printable ASCII
        if (byte >= 0x20 && byte <= 0x7e) {
          currentLine += String.fromCharCode(byte);
          i++;
          continue;
        }

        // Skip other bytes
        i++;
      }

      // Flush remaining line
      if (currentLine) {
        pushCurrentLine();
      }

      // Update state
      commandMap.clear();
      newCommandMap.forEach((value, key) => commandMap.set(key, value));
      setPreviewLines(lines);
    },
    [commandMap]
  );

  // Re-parse when bytes change
  useEffect(() => {
    if (escposBytes) {
      parseEscPos(escposBytes);
    }
  }, [escposBytes, parseEscPos]);

  // Handle right-click on line
  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();

      const target = event.currentTarget;
      const lineNumber = parseInt(target.dataset.line || '0');

      if (isNaN(lineNumber)) return;

      const lineState = commandMap.get(lineNumber);
      if (!lineState) return;

      // Get the preview line to access content type and text
      const previewLine = previewLines.find(l => l.lineNumber === lineNumber);

      setContextMenu({
        lineNumber,
        attributes: {
          align: lineState.align,
          bold: lineState.bold,
          underline: lineState.underline,
          font: lineState.font,
          width: lineState.width,
          height: lineState.height,
          invert: lineState.invert,
          flip: lineState.flip,
          smooth: lineState.smooth,
          doubleWidth: lineState.doubleWidth,
          doubleHeight: lineState.doubleHeight,
          contentType: previewLine?.contentType || 'text',
          textContent: previewLine?.textContent,
        },
        commands: lineState.commands,
        position: { x: event.pageX, y: event.pageY },
      });
    },
    [commandMap, previewLines]
  );

  // Handle context menu actions
  const handleToggleBold = useCallback(
    (lineNumber: number, currentValue: boolean) => {
      // Pass code modification request back to Editor
      const newValue = !currentValue;
      onContextMenuAction(
        lineNumber,
        `p.set(bold=${newValue ? 'True' : 'False'})`
      );
    },
    [onContextMenuAction]
  );

  const handleToggleUnderline = useCallback(
    (lineNumber: number, currentValue: boolean) => {
      const newValue = !currentValue;
      onContextMenuAction(lineNumber, `p.set(underline=${newValue ? '1' : '0'})`);
    },
    [onContextMenuAction]
  );

  const handleChangeAlignment = useCallback(
    (lineNumber: number, newAlign: AlignmentType) => {
      onContextMenuAction(lineNumber, `p.set(align='${newAlign}')`);
    },
    [onContextMenuAction]
  );

  const handleAction = useCallback(
    (lineNumber: number, action: ContextMenuAction) => {
      onContextMenuAction(lineNumber, action.pythonCode);
    },
    [onContextMenuAction]
  );

  return (
    <div className="receipt-preview">
      <h3>Receipt Preview</h3>
      <div className="receipt-paper">
        {isLoading ? (
          <div className="loading-indicator">Generating preview...</div>
        ) : escposBytes ? (
          <div className="receipt-content">
            {previewLines.map((line, index) => {
              // Check if this is an image line
              if (line.text && line.text.startsWith('__IMAGE__')) {
                const imageDataURL = line.text.substring('__IMAGE__'.length);
                return (
                  <div
                    key={index}
                    className={`receipt-line ${line.align}`}
                    data-line={line.lineNumber}
                    data-align={line.align}
                    onContextMenu={handleContextMenu}
                    style={{ padding: 0, minHeight: 0, lineHeight: 0 }}
                  >
                    <img
                      src={imageDataURL}
                      alt={`Image ${index}`}
                      className="receipt-image"
                      style={{
                        display: 'inline-block',
                        maxWidth: '100%',
                        height: 'auto',
                        margin: 0,
                        verticalAlign: 'top'
                      }}
                      onError={(e) => {
                        if (import.meta.env.DEV) {
                          console.error('[Image] Failed to load image:', {
                            src: imageDataURL.substring(0, 100),
                            index,
                          });
                        }
                      }}
                    />
                  </div>
                );
              }

              // Regular text line
              const LineTag = line.bold ? 'strong' : 'span';
              const content = line.underline ? (
                <u>
                  <LineTag>{line.text || '\u00A0'}</LineTag>
                </u>
              ) : (
                <LineTag>{line.text || '\u00A0'}</LineTag>
              );

              return (
                <div
                  key={index}
                  className={`receipt-line ${line.align}`}
                  data-line={line.lineNumber}
                  data-align={line.align}
                  data-bold={line.bold}
                  data-underline={line.underline}
                  onContextMenu={handleContextMenu}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="receipt-content">No preview available</div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          lineNumber={contextMenu.lineNumber}
          attributes={contextMenu.attributes}
          commands={contextMenu.commands}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onToggleBold={handleToggleBold}
          onToggleUnderline={handleToggleUnderline}
          onChangeAlignment={handleChangeAlignment}
          onAction={handleAction}
        />
      )}
    </div>
  );
}
