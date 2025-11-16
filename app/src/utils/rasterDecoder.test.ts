import { describe, it, expect, beforeEach, vi } from 'vitest';
import { decodeRasterImage } from './rasterDecoder';

describe('rasterDecoder', () => {
  describe('decodeRasterImage', () => {
    // Note: Canvas rendering is not fully supported in happy-dom test environment.
    // These tests verify the function runs without crashing and handles edge cases.
    // Full rendering tests should be done in a browser environment or with jsdom + node-canvas.

    it('should return empty string for invalid dimensions (zero width)', () => {
      const data = new Uint8Array([0xff]);
      const result = decodeRasterImage(data, 0, 1);

      expect(result).toBe('');
    });

    it('should return empty string for invalid dimensions (zero height)', () => {
      const data = new Uint8Array([0xff]);
      const result = decodeRasterImage(data, 1, 0);

      expect(result).toBe('');
    });

    it('should return empty string for invalid dimensions (negative width)', () => {
      const data = new Uint8Array([0xff]);
      const result = decodeRasterImage(data, -1, 1);

      expect(result).toBe('');
    });

    it('should return empty string for invalid dimensions (negative height)', () => {
      const data = new Uint8Array([0xff]);
      const result = decodeRasterImage(data, 1, -1);

      expect(result).toBe('');
    });

    it('should handle valid dimensions without crashing', () => {
      // Due to happy-dom limitations with canvas, we can't test full rendering
      // This test just ensures the function handles valid inputs without throwing
      const data = new Uint8Array([0xff]);

      // Function should not throw, even if it returns empty string due to canvas limitations
      expect(() => decodeRasterImage(data, 1, 1)).not.toThrow();
    });

    it('should handle multi-byte images without crashing', () => {
      const data = new Uint8Array([0xff, 0x00, 0xaa, 0x55]);

      expect(() => decodeRasterImage(data, 2, 2)).not.toThrow();
    });

    it('should handle incomplete data without crashing', () => {
      // Request 2x2 image but only provide 2 bytes (should be 4)
      const data = new Uint8Array([0xff, 0xff]);

      expect(() => decodeRasterImage(data, 2, 2)).not.toThrow();
    });
  });
});
