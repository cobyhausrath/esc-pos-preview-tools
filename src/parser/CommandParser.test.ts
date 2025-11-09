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
