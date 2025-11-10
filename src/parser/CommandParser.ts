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
