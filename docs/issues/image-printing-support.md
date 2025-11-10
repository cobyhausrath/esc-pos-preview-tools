# Complete Image Printing Support

## Problem
Image support is **80% implemented but not functional**:
- ✅ Image processing (Floyd-Steinberg dithering) - web/editor.html:1418
- ✅ Shared image handling from mobile - web/editor.html:1339
- ✅ Canvas-based image resizing
- ❌ **ESC-POS image command generation** ← MISSING!

Currently, `generateImageCode()` returns a placeholder:
```python
p.text('IMAGE (${width}x${height})\\n')
p.text('Image printing coming soon!\\n')
```

Users cannot:
- Print images/logos on receipts
- Share photos from mobile to print
- Create QR codes or barcodes visually
- Test image dithering results

## Current Implementation

### What Works (web/editor.html:1418-1493)

**Floyd-Steinberg dithering:**
```javascript
async processImageForPrinting(img, maxWidth = 384) {
  // ✓ Resize to printer width (384px = 48mm @ 8 dots/mm)
  // ✓ Convert to grayscale
  // ✓ Apply Floyd-Steinberg dithering
  // ✓ Returns processed ImageData
}
```

**Share target integration:**
```javascript
async handleSharedImage(arrayBuffer, mimeType) {
  // ✓ Receives images from mobile share menu
  // ✓ Processes with dithering
  // ✗ Generates placeholder code only
}
```

### What's Missing

**ESC-POS command generation:**
```javascript
generateImageCode(imageData) {
  // TODO: Convert ImageData to ESC-POS raster commands
  // TODO: Use python-escpos p.image() API
  // TODO: Handle different image formats
}
```

## Proposed Solution

### Approach 1: Use python-escpos p.image() (Recommended)

**Advantages:**
- Uses python-escpos built-in image handling
- Automatic conversion to ESC-POS format
- Handles different printers automatically

**Challenge:**
- Requires passing image data to Pyodide
- May need base64 encoding for transfer

**Implementation:**
```javascript
generateImageCode(imageData) {
  const { width, height, data } = imageData;

  // Convert ImageData to PNG/BMP bytes
  const imageBlob = this.imageDataToBlob(imageData);

  // Convert to base64 for Python
  const base64 = await this.blobToBase64(imageBlob);

  return `from escpos.printer import Dummy
from PIL import Image
import io
import base64

# Create printer
p = Dummy()

# Decode image
img_data = base64.b64decode('${base64}')
img = Image.open(io.BytesIO(img_data))

# Print image
p.image(img, impl='bitImageColumn')  # or 'bitImageRaster'

# Cut after image
p.text('\\n')
`;
}

imageDataToBlob(imageData) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob(resolve, 'image/png');
  });
}

async blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### Approach 2: Direct ESC-POS Raster Commands

**Advantages:**
- Full control over output
- No PIL/Pillow dependency
- Potentially smaller code

**Challenge:**
- More complex implementation
- Need to understand ESC-POS image commands

**ESC-POS Image Commands:**
- `GS v 0` - Print raster bit image
- `GS ( L` - Print graphics data
- `ESC *` - Select bit image mode (older)

**Implementation:**
```javascript
generateImageCode(imageData) {
  const { width, height, data } = imageData;

  // Convert ImageData to 1-bit bitmap array
  const bitmap = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Pixel is black if R < 128
      row.push(data.data[idx] < 128 ? 1 : 0);
    }
    bitmap.push(row);
  }

  // Convert bitmap to bytes (8 pixels per byte)
  const bytes = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        if (x + bit < width && bitmap[y][x + bit]) {
          byte |= (1 << (7 - bit));
        }
      }
      bytes.push(byte);
    }
  }

  // Generate ESC-POS command
  const bytesPerLine = Math.ceil(width / 8);
  const bytesHex = bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ');

  return `from escpos.printer import Dummy

# Create printer
p = Dummy()

# Print raster image using GS v 0
# GS v 0 mode xL xH yL yH [data]
width_bytes = ${bytesPerLine}
height = ${height}

# Build image data
image_data = bytes([
    ${bytesHex}
])

# Send raster command
p._raw(b'\\x1D\\x76\\x30\\x00')  # GS v 0 (normal mode)
p._raw(bytes([width_bytes & 0xFF, (width_bytes >> 8) & 0xFF]))  # xL xH
p._raw(bytes([height & 0xFF, (height >> 8) & 0xFF]))  # yL yH
p._raw(image_data)

p.text('\\n')
`;
}
```

## Implementation Plan

### Phase 1: Basic Image Printing (Approach 1)
- [ ] Implement `imageDataToBlob()` conversion
- [ ] Implement `blobToBase64()` encoding
- [ ] Generate python-escpos code using `p.image()`
- [ ] Test with PIL/Pillow in Pyodide
- [ ] Handle Pillow installation if needed

### Phase 2: Enhanced Image Support
- [ ] Add image preview in UI before printing
- [ ] Add dithering strength slider (0-100%)
- [ ] Add brightness/contrast controls
- [ ] Support different image modes (threshold, halftone, error diffusion)
- [ ] Add image resize controls

### Phase 3: Image Templates
- [ ] Add "📷 Image" template button
- [ ] Provide example images (logo, QR code)
- [ ] Add drag-and-drop image upload
- [ ] Add clipboard paste support
- [ ] Mobile camera integration

### Phase 4: Advanced Features
- [ ] QR code generation from text
- [ ] Barcode generation (Code128, EAN13, etc.)
- [ ] Logo library (common logos, icons)
- [ ] Image positioning (left/center/right)
- [ ] Multiple images per receipt

## Technical Details

### Image Format Considerations

**Thermal printer constraints:**
- 1-bit black/white only (no grayscale)
- Width: 384 dots (48mm @ 8 dots/mm) for 58mm paper
- Width: 576 dots (72mm @ 8 dots/mm) for 80mm paper
- Height: unlimited (thermal paper roll)

**Dithering algorithms:**
- ✅ Floyd-Steinberg (already implemented) - best quality
- ⚪ Ordered dithering - faster, patterns
- ⚪ Threshold - simplest, harsh

### python-escpos Image Implementation Options

**Method 1: `p.image(img)`**
```python
from PIL import Image
p.image(Image.open('logo.png'))
```
Pros: Simple, automatic optimization
Cons: Requires PIL/Pillow

**Method 2: `p.image(img, impl='bitImageRaster')`**
```python
p.image(img, impl='bitImageRaster')  # Uses GS v 0
```
Pros: Specific control over command
Cons: Still needs PIL

**Method 3: Direct raster `p._raw()`**
```python
p._raw(b'\x1D\x76\x30\x00...')  # Raw GS v 0 command
```
Pros: No PIL dependency, full control
Cons: Manual byte construction

### Pyodide PIL/Pillow Support

Check if PIL is available:
```python
import micropip
await micropip.install('Pillow')  # or 'pillow'
```

If not available, use Approach 2 (direct raster).

## Example Outputs

### Example 1: Simple Logo
```python
from escpos.printer import Dummy
from PIL import Image
import io
import base64

# Create printer
p = Dummy()

# Center alignment
p.set(align='center')

# Decode and print logo
img_data = base64.b64decode('iVBORw0KGgoAAAANS...')
img = Image.open(io.BytesIO(img_data))
p.image(img)

# Text below logo
p.text('My Store Name\n')
p.text('\n')
```

### Example 2: QR Code
```python
from escpos.printer import Dummy
from escpos import qr

# Create printer
p = Dummy()

# Print QR code
p.set(align='center')
p.qr('https://example.com', size=6)
p.text('\n')
```

## UI Enhancements

### Template Button
Add to toolbar:
```html
<button id="template-image" class="template" title="Add image">
  📷 Image
</button>
```

### Image Upload Modal
```html
<div id="image-modal" class="modal">
  <h3>Add Image</h3>

  <!-- Upload options -->
  <button onclick="uploadFile()">📁 From File</button>
  <button onclick="pasteClipboard()">📋 From Clipboard</button>
  <button onclick="openCamera()">📸 Take Photo</button>

  <!-- Processing options -->
  <label>Dithering: <input type="range" min="0" max="100" value="100"></label>
  <label>Brightness: <input type="range" min="-100" max="100" value="0"></label>
  <label>Contrast: <input type="range" min="-100" max="100" value="0"></label>

  <!-- Preview -->
  <div id="image-preview"></div>

  <button onclick="addImage()">Add to Receipt</button>
</div>
```

## Testing Checklist

- [ ] PNG images work
- [ ] JPEG images work
- [ ] GIF images work (first frame)
- [ ] WebP images work
- [ ] SVG images work (rasterized)
- [ ] Large images resized correctly
- [ ] Small images not upscaled
- [ ] Dithering produces good quality
- [ ] Images print on actual printer
- [ ] Mobile camera integration works
- [ ] Clipboard paste works
- [ ] Drag-and-drop works

## Acceptance Criteria

- [ ] User can add images via template button
- [ ] Images processed with dithering
- [ ] Generated code uses python-escpos image API
- [ ] Preview shows dithered image
- [ ] Images print correctly on physical printer
- [ ] Mobile share target works for images
- [ ] Camera capture works on mobile
- [ ] Performance acceptable (<3s for typical images)
- [ ] Handles errors gracefully (invalid format, too large, etc.)

## Priority
**Medium-High** - Image support is a killer feature for thermal printer applications (logos, QR codes, product photos).

## Complexity
**Medium** - Image processing is done, main work is:
1. ESC-POS command generation (straightforward with python-escpos)
2. Data encoding/transfer to Pyodide (base64)
3. UI enhancements (optional)

Estimated effort: 1-2 days for basic implementation, 3-4 days with full UI.

## References
- python-escpos image docs: https://python-escpos.readthedocs.io/en/latest/user/images.html
- ESC-POS GS v command: https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_lparenk.html
- Floyd-Steinberg dithering: https://en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering
