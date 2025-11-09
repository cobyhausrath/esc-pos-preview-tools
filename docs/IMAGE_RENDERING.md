# Image Rendering Implementation Plan

**Priority**: 🔴 **CRITICAL** - Required for real-world ESC-POS compatibility

**Status**: 📋 Planning Phase

---

## Why Images Are Critical

### Real-World Usage

**Every thermal receipt printer** supports graphics, and most receipts include:

1. **Store logos** (90%+ of receipts)
2. **Product images** (high-end retail)
3. **QR codes** (payment systems, loyalty programs)
4. **Barcodes** (product codes, return labels, coupons)

**Without image support**, this library can only handle basic text receipts, limiting real-world applicability.

### Business Impact

| Feature | Text Only | With Images |
|---------|-----------|-------------|
| Basic receipts | ✅ | ✅ |
| Store branding | ❌ | ✅ |
| Payment QR codes | ❌ | ✅ |
| Product barcodes | ❌ | ✅ |
| Return labels | ❌ | ✅ |
| Coupons | ❌ | ✅ |
| **Real-world coverage** | **~40%** | **~95%** |

---

## ESC-POS Graphics Commands

### 1. ESC * - Bit Image

**Format**: `ESC * m nL nH [data...]`

```
1B 2A m nL nH [data...]
     │  │  └─ width high byte
     │  └──── width low byte
     └─────── mode
```

**Modes**:
- `m=0`: Normal (8-dot single-density)
- `m=1`: Double-width (8-dot)
- `m=20`: Normal (24-dot single-density)
- `m=21`: Double-width (24-dot)
- `m=32`: Normal (8-dot double-density)
- `m=33`: Double-width (8-dot double-density)

**Data format**:
- Column-oriented bitmap
- 1 bit per pixel (1=black, 0=white)
- Bytes represent vertical columns
- 8 dots per byte (or 24 for 24-dot modes)

**Example** (Simple 8x8 logo):
```
ESC * 0 8 0 [8 bytes of bitmap data]
1B 2A 00 08 00 FF 81 81 81 81 81 81 FF
```

### 2. GS v 0 - Raster Bit Image

**Format**: `GS v 0 m xL xH yL yH [data...]`

```
1D 76 30 m xL xH yL yH [data...]
        │  │  │  │  └─ height high byte
        │  │  │  └──── height low byte
        │  │  └─────── width high byte
        │  └────────── width low byte
        └───────────── mode
```

**Modes**:
- `m=0`: Normal
- `m=1`: Double-width
- `m=2`: Double-height
- `m=3`: Quadruple (double-width + double-height)

**Data format**:
- Row-oriented bitmap
- 1 bit per pixel (1=black, 0=white)
- Width in bytes (x = (width_pixels + 7) / 8)
- Height in dots (y = height_pixels)
- Total bytes: x * y

**Example** (16x16 QR code):
```
GS v 0 0 2 0 16 0 [32 bytes of bitmap data]
1D 76 30 00 02 00 10 00 [data...]
```

### 3. GS ( L - Graphics Data (Advanced)

Used for more complex graphics operations. **Lower priority** - implement basic commands first.

---

## Implementation Roadmap

### Phase 1: TypeScript Parser (4-6 hours)

**Goal**: Parse image commands and extract bitmap data

#### Tasks

1. **Add ESC * parser** (2 hours)
   - File: `src/parser/CommandParser.ts`
   - Parse mode, width, data
   - Extract bitmap bytes
   - Validate data length

2. **Add GS v 0 parser** (2 hours)
   - File: `src/parser/CommandParser.ts`
   - Parse mode, width, height, data
   - Extract bitmap bytes
   - Validate dimensions

3. **Add types** (1 hour)
   - File: `src/parser/types.ts`
   - `BitImageCommand` interface
   - `RasterImageCommand` interface
   - Bitmap data types

4. **Add tests** (1 hour)
   - File: `src/parser/CommandParser.test.ts`
   - Test ESC * parsing
   - Test GS v 0 parsing
   - Test edge cases (empty, truncated, oversized)

#### Type Definitions

```typescript
// src/parser/types.ts

export interface BitImageCommand {
  type: 'bit-image';
  mode: number;           // 0, 1, 20, 21, 32, 33
  width: number;          // Width in dots
  height: number;         // Height in dots (8 or 24)
  data: Uint8Array;       // Bitmap data
  description: string;
}

export interface RasterImageCommand {
  type: 'raster-image';
  mode: number;           // 0-3
  widthBytes: number;     // Width in bytes
  heightDots: number;     // Height in dots
  data: Uint8Array;       // Bitmap data
  description: string;
}
```

#### Parser Implementation

```typescript
// src/parser/CommandParser.ts

private parseEscAsterisk(buffer: Buffer, pos: number): ParseResult {
  // ESC * m nL nH [data...]
  if (buffer.length < pos + 4) {
    return { command: null, bytesConsumed: 0 };
  }

  const mode = buffer[pos + 2];
  const widthLow = buffer[pos + 3];
  const widthHigh = buffer[pos + 4];
  const width = widthLow + (widthHigh << 8);

  // Calculate height and data length based on mode
  let height: number;
  let dataLength: number;

  if (mode === 0 || mode === 1 || mode === 32 || mode === 33) {
    height = 8;
    dataLength = width;
  } else if (mode === 20 || mode === 21) {
    height = 24;
    dataLength = width * 3;
  } else {
    // Unknown mode
    return { command: null, bytesConsumed: 0 };
  }

  if (buffer.length < pos + 5 + dataLength) {
    return { command: null, bytesConsumed: 0 };
  }

  const data = buffer.slice(pos + 5, pos + 5 + dataLength);

  const command: BitImageCommand = {
    type: 'bit-image',
    mode,
    width,
    height,
    data: new Uint8Array(data),
    description: `Bit image ${width}x${height} mode ${mode}`
  };

  return {
    command,
    bytesConsumed: 5 + dataLength
  };
}

private parseGsVRaster(buffer: Buffer, pos: number): ParseResult {
  // GS v 0 m xL xH yL yH [data...]
  if (buffer.length < pos + 7) {
    return { command: null, bytesConsumed: 0 };
  }

  const mode = buffer[pos + 3];
  const widthBytes = buffer[pos + 4] + (buffer[pos + 5] << 8);
  const heightDots = buffer[pos + 6] + (buffer[pos + 7] << 8);
  const dataLength = widthBytes * heightDots;

  if (buffer.length < pos + 8 + dataLength) {
    return { command: null, bytesConsumed: 0 };
  }

  const data = buffer.slice(pos + 8, pos + 8 + dataLength);

  const command: RasterImageCommand = {
    type: 'raster-image',
    mode,
    widthBytes,
    heightDots,
    data: new Uint8Array(data),
    description: `Raster image ${widthBytes * 8}x${heightDots} mode ${mode}`
  };

  return {
    command,
    bytesConsumed: 8 + dataLength
  };
}
```

---

### Phase 2: TypeScript Renderer (4-6 hours)

**Goal**: Render bitmap data as HTML images

#### Tasks

1. **Add bitmap decoder** (2 hours)
   - File: `src/renderer/BitmapDecoder.ts` (new)
   - Decode ESC * column format
   - Decode GS v 0 row format
   - Convert to 2D pixel array

2. **Add image renderer** (2 hours)
   - File: `src/renderer/HTMLRenderer.ts`
   - Convert bitmap to canvas
   - Generate data URL
   - Render as `<img>` tag
   - Support scaling modes

3. **Add tests** (1 hour)
   - File: `src/renderer/HTMLRenderer.test.ts`
   - Test bitmap decoding
   - Test image rendering
   - Test scaling modes

4. **Add sample images** (1 hour)
   - Create sample logos
   - Generate ESC-POS binaries
   - Add to `samples/` directory

#### Bitmap Decoder

```typescript
// src/renderer/BitmapDecoder.ts

export class BitmapDecoder {
  /**
   * Decode ESC * column-oriented bitmap
   */
  static decodeColumnBitmap(
    data: Uint8Array,
    width: number,
    height: number
  ): boolean[][] {
    const pixels: boolean[][] = Array(height).fill(0).map(() =>
      Array(width).fill(false)
    );

    let byteIndex = 0;
    for (let x = 0; x < width; x++) {
      if (height === 8) {
        const byte = data[byteIndex++];
        for (let y = 0; y < 8; y++) {
          pixels[y][x] = !!(byte & (1 << (7 - y)));
        }
      } else if (height === 24) {
        for (let slice = 0; slice < 3; slice++) {
          const byte = data[byteIndex++];
          for (let bit = 0; bit < 8; bit++) {
            const y = slice * 8 + bit;
            pixels[y][x] = !!(byte & (1 << (7 - bit)));
          }
        }
      }
    }

    return pixels;
  }

  /**
   * Decode GS v 0 row-oriented bitmap
   */
  static decodeRowBitmap(
    data: Uint8Array,
    widthBytes: number,
    heightDots: number
  ): boolean[][] {
    const widthPixels = widthBytes * 8;
    const pixels: boolean[][] = Array(heightDots).fill(0).map(() =>
      Array(widthPixels).fill(false)
    );

    let byteIndex = 0;
    for (let y = 0; y < heightDots; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        const byte = data[byteIndex++];
        for (let bit = 0; bit < 8; bit++) {
          const x = xByte * 8 + bit;
          if (x < widthPixels) {
            pixels[y][x] = !!(byte & (1 << (7 - bit)));
          }
        }
      }
    }

    return pixels;
  }

  /**
   * Convert pixel array to canvas data URL
   */
  static toDataURL(pixels: boolean[][], scale: number = 1): string {
    const height = pixels.length;
    const width = pixels[0]?.length || 0;

    // Create canvas (Node.js needs 'canvas' package, browser has native)
    const canvas = this.createCanvas(width * scale, height * scale);
    const ctx = canvas.getContext('2d')!;

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width * scale, height * scale);

    // Draw black pixels
    ctx.fillStyle = '#000000';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[y][x]) {
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    return canvas.toDataURL('image/png');
  }

  private static createCanvas(width: number, height: number): HTMLCanvasElement {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    } else {
      // Node.js environment - requires 'canvas' package
      const { createCanvas } = require('canvas');
      return createCanvas(width, height);
    }
  }
}
```

#### Renderer Update

```typescript
// src/renderer/HTMLRenderer.ts

private renderBitImage(command: BitImageCommand): string {
  const pixels = BitmapDecoder.decodeColumnBitmap(
    command.data,
    command.width,
    command.height
  );

  const scale = command.mode === 1 || command.mode === 21 || command.mode === 33 ? 2 : 1;
  const dataURL = BitmapDecoder.toDataURL(pixels, scale);

  return `<img src="${dataURL}" alt="${command.description}" style="display: block; image-rendering: pixelated;" />`;
}

private renderRasterImage(command: RasterImageCommand): string {
  const pixels = BitmapDecoder.decodeRowBitmap(
    command.data,
    command.widthBytes,
    command.heightDots
  );

  const scaleX = command.mode === 1 || command.mode === 3 ? 2 : 1;
  const scaleY = command.mode === 2 || command.mode === 3 ? 2 : 1;
  const scale = Math.max(scaleX, scaleY);

  const dataURL = BitmapDecoder.toDataURL(pixels, scale);

  return `<img src="${dataURL}" alt="${command.description}" style="display: block; image-rendering: pixelated;" />`;
}
```

---

### Phase 3: Python Support (3-4 hours)

**Goal**: Parse and generate python-escpos image code

#### Tasks

1. **Add image parsing** (1.5 hours)
   - File: `python/escpos_verifier.py`
   - Parse ESC * command
   - Parse GS v 0 command
   - Extract bitmap data

2. **Add code generation** (1.5 hours)
   - Generate `p.image()` calls
   - Handle bitmap to PIL Image conversion
   - Support inline data or file references

3. **Add tests** (1 hour)
   - File: `python/test_escpos_verifier.py`
   - Test image parsing
   - Test code generation
   - Test round-trip verification

#### Python Implementation

```python
# python/escpos_verifier.py

def _parse_esc_asterisk(self, data: bytes, pos: int) -> Optional[Dict[str, Any]]:
    """Parse ESC * (bit image) command"""
    # ESC * m nL nH [data...]
    if len(data) < pos + 5:
        return None

    mode = data[pos + 2]
    width = data[pos + 3] + (data[pos + 4] << 8)

    # Calculate data length based on mode
    if mode in [0, 1, 32, 33]:
        height = 8
        data_len = width
    elif mode in [20, 21]:
        height = 24
        data_len = width * 3
    else:
        self.warnings.append(f"Unknown ESC * mode: {mode}")
        return None

    if len(data) < pos + 5 + data_len:
        return None

    bitmap_data = data[pos + 5:pos + 5 + data_len]

    return {
        'type': 'bit_image',
        'mode': mode,
        'width': width,
        'height': height,
        'data': bitmap_data,
        'bytes_consumed': 5 + data_len
    }

def _generate_image_code(self, cmd: Dict[str, Any]) -> str:
    """Generate python-escpos code for image"""
    # For now, generate a comment with base64-encoded data
    # TODO: Convert to PIL Image and use p.image()

    import base64
    data_b64 = base64.b64encode(cmd['data']).decode('ascii')

    return f"""# Image {cmd['width']}x{cmd['height']}
# TODO: Implement image rendering
# Data: {data_b64[:50]}...
"""

    # Future implementation:
    # from PIL import Image
    # img = self._bitmap_to_pil(cmd['data'], cmd['width'], cmd['height'])
    # p.image(img)
```

---

### Phase 4: Browser Editor (6-8 hours)

**Goal**: Allow image upload and preview in browser

#### Tasks

1. **Add image upload UI** (2 hours)
   - File: `web/editor.html`
   - File input for images
   - Preview uploaded image
   - Convert to ESC-POS format

2. **Add image conversion** (3 hours)
   - Canvas-based image processing
   - Resize to printer width
   - Dithering for monochrome
   - Generate ESC-POS bitmap commands

3. **Add code generation** (1 hour)
   - Generate python-escpos `p.image()` code
   - Embed image data or reference file

4. **Add preview** (2 hours)
   - Render images in receipt preview
   - Use TypeScript renderer
   - Test with real logos

#### Browser Implementation

```javascript
// web/editor.html

class ImageUploader {
  async uploadAndConvert(file) {
    // Load image
    const img = await this.loadImage(file);

    // Resize to printer width (e.g., 384 pixels for 48-char width)
    const canvas = this.resizeImage(img, 384);

    // Convert to monochrome with dithering
    const bitmap = this.ditherImage(canvas);

    // Generate ESC-POS raster command (GS v 0)
    const escposBytes = this.generateRasterCommand(bitmap);

    // Generate python-escpos code
    const pythonCode = this.generatePythonCode(bitmap);

    return { escposBytes, pythonCode };
  }

  ditherImage(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Floyd-Steinberg dithering
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const oldPixel = data[i]; // Red channel (grayscale)
        const newPixel = oldPixel < 128 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = newPixel;

        const error = oldPixel - newPixel;

        // Distribute error to neighbors
        if (x + 1 < canvas.width) {
          data[i + 4] += error * 7 / 16;
        }
        if (y + 1 < canvas.height) {
          if (x > 0) {
            data[i + canvas.width * 4 - 4] += error * 3 / 16;
          }
          data[i + canvas.width * 4] += error * 5 / 16;
          if (x + 1 < canvas.width) {
            data[i + canvas.width * 4 + 4] += error * 1 / 16;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return this.canvasToBitmap(canvas);
  }

  generatePythonCode(bitmap) {
    return `
from PIL import Image

# Create image from bitmap data
img = Image.new('1', (${bitmap.width}, ${bitmap.height}))
# ... set pixel data ...

p.image(img)
`;
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// Test ESC * parsing
test('parses ESC * 8-dot bitmap', () => {
  const data = Buffer.from([
    0x1B, 0x2A, 0x00, 0x08, 0x00, // ESC * 0 8 0
    0xFF, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0xFF // 8x8 box
  ]);

  const result = parser.parse(data);
  expect(result.commands).toHaveLength(1);
  expect(result.commands[0].type).toBe('bit-image');
  expect(result.commands[0].width).toBe(8);
  expect(result.commands[0].height).toBe(8);
});

// Test bitmap rendering
test('renders bitmap as data URL', () => {
  const pixels = [
    [true, false, true],
    [false, true, false],
    [true, false, true]
  ];

  const dataURL = BitmapDecoder.toDataURL(pixels);
  expect(dataURL).toMatch(/^data:image\/png;base64,/);
});
```

### Integration Tests

```typescript
// Test full workflow: parse → render → display
test('renders complete receipt with logo', async () => {
  const receiptData = await fs.readFile('samples/receipt-with-logo.bin');
  const parser = new CommandParser();
  const renderer = new HTMLRenderer();

  const { commands } = parser.parse(receiptData);
  const html = renderer.render(commands);

  expect(html).toContain('<img');
  expect(html).toContain('data:image/png');
});
```

---

## Sample Files Needed

### 1. Simple Logo (8x8)
```
samples/logo-8x8.bin
- ESC * 0 command
- 8x8 pixel box or simple shape
```

### 2. Store Logo (48x48)
```
samples/logo-48x48.bin
- GS v 0 command
- Realistic store logo
- Dithered monochrome
```

### 3. QR Code (100x100)
```
samples/qrcode-100x100.bin
- GS v 0 command
- Sample QR code
- https://example.com
```

### 4. Complete Receipt
```
samples/receipt-with-logo.bin
- Store logo at top
- Text receipt content
- QR code at bottom
```

---

## Dependencies

### TypeScript
- **canvas** (for Node.js): `yarn add canvas`
- Already have: TypeScript, Vitest

### Python
- **Pillow**: `pip install Pillow`
- Already have: python-escpos

### Browser
- Native Canvas API (no dependencies)
- FileReader API for image upload

---

## Performance Considerations

### Image Size Limits

Thermal printers typically support:
- Width: 384 pixels (48 chars × 8 pixels)
- Height: Unlimited (but practical limit ~1000 pixels)

**Recommendations**:
- Max width: 576 pixels (72 chars)
- Max height: 2000 pixels
- Max file size: 1MB

### Memory Usage

Bitmap storage:
- 384×1000 pixels = 384,000 bits = 48KB
- With scale factor 2x: 192KB
- Canvas RGBA: 384,000 × 4 = 1.5MB

**Optimization**: Use 1-bit bitmap format until rendering.

### Rendering Speed

Expected performance:
- Parse 100×100 image: <10ms
- Decode bitmap: <5ms
- Generate data URL: <20ms
- Total: <50ms (acceptable for real-time)

---

## Success Criteria

### Phase 1 Complete
- ✅ ESC * command parsed
- ✅ GS v 0 command parsed
- ✅ All tests passing
- ✅ Sample files parse correctly

### Phase 2 Complete
- ✅ Bitmaps render as images
- ✅ Scaling modes work
- ✅ Preview looks correct
- ✅ No performance issues

### Phase 3 Complete
- ✅ Python parses image commands
- ✅ Generates python-escpos code
- ✅ Round-trip verification works

### Phase 4 Complete
- ✅ Can upload images in browser
- ✅ Images convert to ESC-POS
- ✅ Preview shows images correctly
- ✅ Can export with images

---

## Future Enhancements

After basic image support:

1. **Barcode rendering** (GS k)
   - Similar to images
   - Generate barcode from data
   - Use jsbarcode or similar

2. **QR code rendering** (GS ( k)
   - Parse QR command
   - Generate QR from data
   - Use qrcode library

3. **Image optimization**
   - Better dithering algorithms
   - Automatic contrast adjustment
   - Logo templates

4. **Advanced graphics** (GS ( L)
   - Multi-tone printing
   - Smooth shading
   - Advanced layouts

---

## Resources

- **ESC-POS Command Reference**: [Epson Documentation](https://reference.epson-biz.com/modules/ref_escpos/index.php?content_id=88)
- **Bitmap Formats**: [Wikipedia - Bitmap](https://en.wikipedia.org/wiki/BMP_file_format)
- **Floyd-Steinberg Dithering**: [Wikipedia](https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering)
- **Canvas API**: [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- **python-escpos image()**: [Documentation](https://python-escpos.readthedocs.io/en/latest/user/methods.html#image-image)

---

## Questions & Decisions

### 1. Image data in python-escpos code?

**Options**:
- A) Embed base64-encoded data in Python code
- B) Save image to file, reference in code
- C) Generate PIL Image object code

**Recommendation**: Start with B (file reference), add A (embed) as option later.

### 2. Node.js canvas dependency?

**Issue**: Canvas API not available in Node.js by default

**Options**:
- A) Require 'canvas' package (native dependencies)
- B) Browser-only rendering
- C) Pure JavaScript bitmap manipulation

**Recommendation**: Start with C (pure JS), add A as optional enhancement.

### 3. Dithering algorithm?

**Options**:
- Floyd-Steinberg (good quality, standard)
- Atkinson (Mac-style, softer)
- Ordered/Bayer (faster, patterns)

**Recommendation**: Floyd-Steinberg (best quality for receipts).

---

**Next Steps**: Review this plan with team, then start Phase 1.
