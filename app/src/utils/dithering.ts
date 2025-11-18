/**
 * Image dithering algorithms for thermal printing
 */

export type DitheringAlgorithm = 'floyd-steinberg' | 'atkinson' | 'threshold';

/**
 * Convert RGB to grayscale using luminance formula
 */
function toGrayscale(r: number, g: number, b: number): number {
  return Math.floor(r * 0.299 + g * 0.587 + b * 0.114);
}

/**
 * Floyd-Steinberg dithering - best quality with smooth gradients
 */
export function floydSteinbergDithering(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  const pixels = result.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Convert to grayscale
      const gray = toGrayscale(pixels[idx], pixels[idx + 1], pixels[idx + 2]);

      // Threshold and calculate error
      const newVal = gray < 128 ? 0 : 255;
      const error = gray - newVal;

      // Set pixel
      pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = newVal;

      // Distribute error using Floyd-Steinberg weights
      // [ ] [X] 7/16
      // 3/16 5/16 1/16

      if (x + 1 < width) {
        const nextIdx = (y * width + x + 1) * 4;
        pixels[nextIdx] += (error * 7) / 16;
        pixels[nextIdx + 1] += (error * 7) / 16;
        pixels[nextIdx + 2] += (error * 7) / 16;
      }

      if (y + 1 < height) {
        if (x > 0) {
          const diagIdx = ((y + 1) * width + x - 1) * 4;
          pixels[diagIdx] += (error * 3) / 16;
          pixels[diagIdx + 1] += (error * 3) / 16;
          pixels[diagIdx + 2] += (error * 3) / 16;
        }

        const belowIdx = ((y + 1) * width + x) * 4;
        pixels[belowIdx] += (error * 5) / 16;
        pixels[belowIdx + 1] += (error * 5) / 16;
        pixels[belowIdx + 2] += (error * 5) / 16;

        if (x + 1 < width) {
          const diagIdx = ((y + 1) * width + x + 1) * 4;
          pixels[diagIdx] += (error * 1) / 16;
          pixels[diagIdx + 1] += (error * 1) / 16;
          pixels[diagIdx + 2] += (error * 1) / 16;
        }
      }
    }
  }

  return result;
}

/**
 * Atkinson dithering - lighter, more artistic appearance
 */
export function atkinsonDithering(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  const pixels = result.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Convert to grayscale
      const gray = toGrayscale(pixels[idx], pixels[idx + 1], pixels[idx + 2]);

      // Threshold and calculate error
      const newVal = gray < 128 ? 0 : 255;
      const error = gray - newVal;

      // Set pixel
      pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = newVal;

      // Distribute error using Atkinson weights (1/8 each)
      // [ ] [X] 1 1
      // 1 1 1
      // [ ] 1

      const distribute = (dx: number, dy: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const targetIdx = (ny * width + nx) * 4;
          pixels[targetIdx] += error / 8;
          pixels[targetIdx + 1] += error / 8;
          pixels[targetIdx + 2] += error / 8;
        }
      };

      // Row 0 (current row)
      distribute(1, 0);
      distribute(2, 0);

      // Row 1 (next row)
      distribute(-1, 1);
      distribute(0, 1);
      distribute(1, 1);

      // Row 2
      distribute(0, 2);
    }
  }

  return result;
}

/**
 * Simple threshold dithering - high contrast, no error diffusion
 */
export function thresholdDithering(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  const pixels = result.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Convert to grayscale
      const gray = toGrayscale(pixels[idx], pixels[idx + 1], pixels[idx + 2]);

      // Simple threshold
      const newVal = gray < 128 ? 0 : 255;
      pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = newVal;
    }
  }

  return result;
}

/**
 * Apply dithering algorithm to image data
 */
export function applyDithering(
  imageData: ImageData,
  algorithm: DitheringAlgorithm
): ImageData {
  switch (algorithm) {
    case 'floyd-steinberg':
      return floydSteinbergDithering(imageData);
    case 'atkinson':
      return atkinsonDithering(imageData);
    case 'threshold':
      return thresholdDithering(imageData);
    default:
      return floydSteinbergDithering(imageData);
  }
}

/**
 * Process image for thermal printing with specified dithering algorithm
 */
export async function processImageForPrinting(
  img: HTMLImageElement,
  maxWidth = 384,
  algorithm: DitheringAlgorithm = 'floyd-steinberg'
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    try {
      // Create canvas for image processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.floor((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, width, height);

      // Apply selected dithering algorithm
      const ditheredData = applyDithering(imageData, algorithm);

      resolve(ditheredData);
    } catch (err) {
      reject(err);
    }
  });
}
