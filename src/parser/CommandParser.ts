/**
 * ESC/POS Command Parser
 */

import { Command, ParseResult } from './types';

export class CommandParser {
  parse(buffer: Buffer | Uint8Array): ParseResult {
    const commands: Command[] = [];
    let pos = 0;

    while (pos < buffer.length) {
      const byte = buffer[pos];

      // ESC commands (0x1B)
      if (byte === 0x1b && pos + 1 < buffer.length) {
        const nextByte = buffer[pos + 1];

        switch (nextByte) {
          case 0x40: // ESC @ - Initialize
            commands.push({ type: 'initialize', raw: [byte, nextByte] });
            pos += 2;
            break;

          case 0x45: // ESC E - Bold
            if (pos + 2 < buffer.length) {
              const value = buffer[pos + 2];
              commands.push({
                type: 'bold',
                value: value !== 0,
                raw: [byte, nextByte, value],
              });
              pos += 3;
            } else {
              pos++;
            }
            break;

          case 0x2d: // ESC - - Underline
            if (pos + 2 < buffer.length) {
              const value = buffer[pos + 2];
              commands.push({
                type: 'underline',
                value: value !== 0,
                raw: [byte, nextByte, value],
              });
              pos += 3;
            } else {
              pos++;
            }
            break;

          case 0x61: // ESC a - Alignment
            if (pos + 2 < buffer.length) {
              const value = buffer[pos + 2];
              const alignments = ['left', 'center', 'right'];
              commands.push({
                type: 'align',
                value: alignments[value] || 'left',
                raw: [byte, nextByte, value],
              });
              pos += 3;
            } else {
              pos++;
            }
            break;

          case 0x21: // ESC ! - Print mode
            if (pos + 2 < buffer.length) {
              const value = buffer[pos + 2];
              commands.push({
                type: 'size',
                value: value,
                raw: [byte, nextByte, value],
              });
              pos += 3;
            } else {
              pos++;
            }
            break;

          case 0x2a: // ESC * - Bit Image (used for images)
            if (pos + 4 < buffer.length) {
              const mode = buffer[pos + 2];
              const nL = buffer[pos + 3];
              const nH = buffer[pos + 4];
              const dataBytes = nL + (nH * 256);
              const totalSize = 5 + dataBytes;

              if (pos + totalSize <= buffer.length) {
                commands.push({
                  type: 'image',
                  value: `mode ${mode}, ${dataBytes} bytes`,
                  raw: Array.from(buffer.subarray(pos, pos + totalSize)),
                });
                pos += totalSize;
              } else {
                // Not enough data, treat as unknown
                commands.push({
                  type: 'unknown',
                  raw: [byte, nextByte],
                });
                pos += 2;
              }
            } else {
              commands.push({
                type: 'unknown',
                raw: [byte, nextByte],
              });
              pos += 2;
            }
            break;

          default:
            commands.push({
              type: 'unknown',
              raw: [byte, nextByte],
            });
            pos += 2;
        }
      }
      // GS commands (0x1D)
      else if (byte === 0x1d && pos + 1 < buffer.length) {
        const nextByte = buffer[pos + 1];

        if (nextByte === 0x56) {
          // GS V - Cut paper
          const cutType = pos + 2 < buffer.length ? buffer[pos + 2] : 0;
          commands.push({
            type: 'cut',
            value: cutType,
            raw: [byte, nextByte, cutType],
          });
          pos += 3;
        } else if (nextByte === 0x76) {
          // GS v 0 - Print raster bit image
          // Format: GS v 0 m xL xH yL yH [data...]
          if (pos + 7 < buffer.length) {
            const subCmd = buffer[pos + 2]; // Should be 0 for raster format
            const m = buffer[pos + 3]; // mode (0 = normal, 1 = double width, 2 = double height, 3 = quadruple)
            const xL = buffer[pos + 4];
            const xH = buffer[pos + 5];
            const yL = buffer[pos + 6];
            const yH = buffer[pos + 7];
            const widthBytes = xL + (xH * 256); // width in bytes
            const heightDots = yL + (yH * 256); // height in dots
            const dataBytes = widthBytes * heightDots;
            const totalSize = 8 + dataBytes;

            if (pos + totalSize <= buffer.length) {
              commands.push({
                type: 'image',
                value: `raster ${widthBytes * 8}x${heightDots}px, mode ${m}`,
                raw: Array.from(buffer.subarray(pos, pos + totalSize)),
              });
              pos += totalSize;
            } else {
              // Not enough data
              commands.push({
                type: 'unknown',
                raw: [byte, nextByte],
              });
              pos += 2;
            }
          } else {
            commands.push({
              type: 'unknown',
              raw: [byte, nextByte],
            });
            pos += 2;
          }
        } else {
          commands.push({
            type: 'unknown',
            raw: [byte, nextByte],
          });
          pos += 2;
        }
      }
      // Line feed (0x0A)
      else if (byte === 0x0a) {
        commands.push({ type: 'linefeed', raw: [byte] });
        pos++;
      }
      // Regular text
      else if (byte >= 0x20 && byte <= 0x7e) {
        // Collect consecutive text bytes
        const textStart = pos;
        while (
          pos < buffer.length &&
          buffer[pos] >= 0x20 &&
          buffer[pos] <= 0x7e
        ) {
          pos++;
        }
        // Use String.fromCharCode for browser compatibility (Uint8Array doesn't have .toString('ascii'))
        const textBytes = buffer.subarray(textStart, pos);
        const text = String.fromCharCode(...Array.from(textBytes));
        commands.push({
          type: 'text',
          value: text,
          raw: Array.from(textBytes),
        });
      } else {
        // Unknown byte
        commands.push({
          type: 'unknown',
          raw: [byte],
        });
        pos++;
      }
    }

    return {
      commands,
      rawBytes: buffer,
      bytesProcessed: pos,
    };
  }
}
