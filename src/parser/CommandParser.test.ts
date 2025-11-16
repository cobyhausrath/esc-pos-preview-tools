import { describe, it, expect } from 'vitest';
import { CommandParser } from './CommandParser';

describe('CommandParser', () => {
  const parser = new CommandParser();

  describe('basic commands', () => {
    it('should parse initialize command', () => {
      const buffer = Buffer.from([0x1b, 0x40]);
      const result = parser.parse(buffer);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]).toEqual({
        type: 'initialize',
        raw: [0x1b, 0x40],
      });
    });

    it('should parse text', () => {
      const buffer = Buffer.from('Hello');
      const result = parser.parse(buffer);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('text');
      expect(result.commands[0].value).toBe('Hello');
    });

    it('should parse line feed', () => {
      const buffer = Buffer.from([0x0a]);
      const result = parser.parse(buffer);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('linefeed');
    });
  });

  describe('text formatting', () => {
    it('should parse bold on', () => {
      const buffer = Buffer.from([0x1b, 0x45, 0x01]);
      const result = parser.parse(buffer);

      expect(result.commands[0]).toEqual({
        type: 'bold',
        value: true,
        raw: [0x1b, 0x45, 0x01],
      });
    });

    it('should parse bold off', () => {
      const buffer = Buffer.from([0x1b, 0x45, 0x00]);
      const result = parser.parse(buffer);

      expect(result.commands[0]).toEqual({
        type: 'bold',
        value: false,
        raw: [0x1b, 0x45, 0x00],
      });
    });

    it('should parse underline', () => {
      const buffer = Buffer.from([0x1b, 0x2d, 0x01]);
      const result = parser.parse(buffer);

      expect(result.commands[0].type).toBe('underline');
      expect(result.commands[0].value).toBe(true);
    });

    it('should parse alignment', () => {
      const centerAlign = Buffer.from([0x1b, 0x61, 0x01]);
      const result = parser.parse(centerAlign);

      expect(result.commands[0]).toEqual({
        type: 'align',
        value: 'center',
        raw: [0x1b, 0x61, 0x01],
      });
    });
  });

  describe('complex sequences', () => {
    it('should parse mixed text and formatting', () => {
      const buffer = Buffer.from([
        0x1b, 0x45, 0x01, // Bold on
        ...Buffer.from('Bold'),
        0x1b, 0x45, 0x00, // Bold off
        0x0a, // Line feed
      ]);

      const result = parser.parse(buffer);

      expect(result.commands).toHaveLength(4);
      expect(result.commands[0].type).toBe('bold');
      expect(result.commands[0].value).toBe(true);
      expect(result.commands[1].type).toBe('text');
      expect(result.commands[1].value).toBe('Bold');
      expect(result.commands[2].type).toBe('bold');
      expect(result.commands[2].value).toBe(false);
      expect(result.commands[3].type).toBe('linefeed');
    });
  });

  describe('GS v 0 - raster image', () => {
    it('should parse GS v 0 raster image command', () => {
      // GS v 0 m xL xH yL yH [data]
      // 16x2 image (2 bytes wide, 2 dots high) = 4 bytes of data
      const buffer = Buffer.from([
        0x1d, // GS
        0x76, // v
        0x30, // '0' (ASCII 0x30, raster format)
        0x00, // m (normal mode)
        0x02, 0x00, // xL, xH (width = 2 bytes)
        0x02, 0x00, // yL, yH (height = 2 dots)
        0xff, 0xff, 0xff, 0xff, // image data (4 bytes)
      ]);

      const result = parser.parse(buffer);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('image');
      expect(result.commands[0].value).toBe('raster 16x2px, mode 0');
      expect(result.commands[0].raw).toHaveLength(12); // 8 header + 4 data
    });

    it('should parse larger raster image', () => {
      // 16x8 image (2 bytes wide, 8 dots high) = 16 bytes of data
      const imageData = new Array(16).fill(0xaa); // Alternating pattern
      const buffer = Buffer.from([
        0x1d, // GS
        0x76, // v
        0x30, // '0' (ASCII 0x30)
        0x00, // m
        0x02, 0x00, // xL, xH (width = 2 bytes)
        0x08, 0x00, // yL, yH (height = 8 dots)
        ...imageData,
      ]);

      const result = parser.parse(buffer);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('image');
      expect(result.commands[0].value).toBe('raster 16x8px, mode 0');
      expect(result.commands[0].raw).toHaveLength(24); // 8 header + 16 data
    });

    it('should handle incomplete GS v 0 command gracefully', () => {
      // Command header without enough data
      const buffer = Buffer.from([
        0x1d, // GS
        0x76, // v
        0x30, // '0'
        0x00, // m
        0x02, 0x00, // xL, xH (width = 2 bytes)
        0x08, 0x00, // yL, yH (height = 8 dots)
        // Missing 16 bytes of image data
      ]);

      const result = parser.parse(buffer);

      // Parser treats incomplete command as unknown
      expect(result.commands[0].type).toBe('unknown');
    });

    it('should parse GS v even with binary 0 subcommand', () => {
      // GS v with binary 0 subcommand (parser doesn't validate subcommand)
      // Validation happens in renderer, not parser
      const buffer = Buffer.from([
        0x1d, // GS
        0x76, // v
        0x00, // Binary 0 subcommand
        0x00, // m
        0x01, 0x00, // xL, xH (1 byte wide)
        0x01, 0x00, // yL, yH (1 dot high)
        0xff, // data (1 byte)
      ]);

      const result = parser.parse(buffer);

      // Parser accepts it, renderer will validate later
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('image');
      expect(result.commands[0].value).toBe('raster 8x1px, mode 0');
    });

    it('should handle multi-byte dimensions', () => {
      // Large image: 384px wide (48 bytes) x 256 dots high
      const widthBytes = 48;
      const heightDots = 256;
      const imageData = new Array(widthBytes * heightDots).fill(0x00);

      const buffer = Buffer.from([
        0x1d, // GS
        0x76, // v
        0x30, // '0'
        0x00, // m
        widthBytes & 0xff, (widthBytes >> 8) & 0xff, // xL, xH
        heightDots & 0xff, (heightDots >> 8) & 0xff, // yL, yH
        ...imageData,
      ]);

      const result = parser.parse(buffer);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('image');
      expect(result.commands[0].value).toBe('raster 384x256px, mode 0');
      expect(result.commands[0].raw).toHaveLength(8 + widthBytes * heightDots);
    });
  });

  describe('edge cases', () => {
    it('should handle empty buffer', () => {
      const buffer = Buffer.from([]);
      const result = parser.parse(buffer);

      expect(result.commands).toHaveLength(0);
      expect(result.bytesProcessed).toBe(0);
    });

    it('should handle unknown commands', () => {
      const buffer = Buffer.from([0x1b, 0xff]); // Unknown ESC command
      const result = parser.parse(buffer);

      expect(result.commands[0].type).toBe('unknown');
    });
  });
});
