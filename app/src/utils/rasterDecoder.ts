/**
 * Decode GS v 0 raster image data to a data URL for display
 *
 * GS v 0 format: GS v 0 m xL xH yL yH [data]
 * - Data is organized in row-major order (left to right, top to bottom)
 * - Each byte represents 8 horizontal pixels (bit 7 = left, bit 0 = right)
 * - Width is in bytes, height is in dots
 */
export function decodeRasterImage(
  data: Uint8Array,
  widthBytes: number,
  heightDots: number
): string {
  if (import.meta.env.DEV) {
    console.log('[Raster Decode]', {
      dataLength: data.length,
      widthBytes,
      heightDots,
      expectedBytes: widthBytes * heightDots,
    });
  }

  const widthPixels = widthBytes * 8;

  // Validate dimensions
  if (widthBytes <= 0 || heightDots <= 0) {
    console.error('[Raster Decode] Invalid dimensions:', { widthBytes, heightDots });
    return '';
  }

  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = widthPixels;
  canvas.height = heightDots;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[Raster Decode] Failed to get canvas context');
    return '';
  }

  // Create image data
  const imageData = ctx.createImageData(widthPixels, heightDots);
  const pixels = imageData.data;

  // Decode bitmap data (row-major order)
  let dataIdx = 0;
  for (let y = 0; y < heightDots; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      if (dataIdx >= data.length) break;

      const byte = data[dataIdx++];

      // Extract 8 horizontal pixels from this byte
      // GS v 0 format: bit 7 (MSB) = leftmost pixel, bit 0 (LSB) = rightmost
      // We iterate bit from 0→7, testing each bit position with (1 << bit)
      // But map to x position as (7 - bit) to reverse the order:
      //   bit 0 → x offset 7 (rightmost in this byte)
      //   bit 7 → x offset 0 (leftmost in this byte)
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + (7 - bit);
        if (x >= widthPixels) break;

        const pixelOn = (byte & (1 << bit)) !== 0;
        const pixelIdx = (y * widthPixels + x) * 4;

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
    console.log('[Raster Decode] Generated data URL length:', dataURL.length);
  }

  return dataURL;
}
