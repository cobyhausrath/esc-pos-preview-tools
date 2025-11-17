# Add Comprehensive python-escpos Formatting Support to Context Menu

## Summary

This PR adds extensive formatting capabilities to the right-click context menu for ESC-POS preview lines, enabling users to visually modify python-escpos code with all relevant formatting options including text attributes, size controls, content conversion (barcode/QR), and image formatting.

## Problem

Previously, the context menu only supported three basic operations:
- Toggle bold on/off
- Toggle underline on/off
- Change alignment (left/center/right)

This limited users' ability to quickly format receipts through the visual interface. Many python-escpos formatting capabilities were unavailable, requiring manual code editing.

## Solution

Extended the context menu system to support all major python-escpos formatting capabilities:

### **Text Formatting**
- **Font Selection**: Choose between Font A, B, or C (ESC M command)
- **Size Controls**: Adjust width and height multipliers (1-8x) with interactive button pickers (GS ! command)
- **Invert**: White/black reverse printing (GS B command)
- **Flip**: Upside down/rotate 180° (ESC { command)
- **Bold & Underline**: Existing toggles retained

### **Content Conversion**
- **Text → Barcode**: Convert any text line to CODE39 barcode (`p.barcode()`)
- **Text → QR Code**: Convert any text line to QR code (`p.qr()`)
- Framework ready for reverse conversion (barcode/QR → text)

### **Image Options**
- **Implementation Format**: Switch between ESC * (column) and GS v 0 (raster) formats
- **Alignment**: Control image positioning (left/center/right)

### **Dynamic Context Menu**
The menu adapts based on line content type:
- **Text lines**: Full formatting suite with conversion options
- **Image lines**: Format selection and alignment
- **Barcode/QR lines**: Alignment controls and conversion framework

## Technical Implementation

### 1. Type System (`app/src/types/index.ts`)
Extended type definitions for comprehensive attribute tracking:
```typescript
export type FontType = 'a' | 'b' | 'c';
export type LineContentType = 'text' | 'image' | 'barcode' | 'qrcode';

export interface LineAttributes {
  align: AlignmentType;
  bold: boolean;
  underline: boolean;
  font?: FontType;
  width?: number;      // 1-8x multiplier
  height?: number;     // 1-8x multiplier
  invert?: boolean;
  flip?: boolean;
  doubleWidth?: boolean;
  doubleHeight?: boolean;
  contentType?: LineContentType;
  textContent?: string; // For conversion operations
}

export interface ContextMenuAction {
  type: 'format' | 'convert';
  attribute?: string;
  value?: string | boolean | number;
  pythonCode: string;
}
```

### 2. ESC-POS Parser Enhancement (`app/src/components/ReceiptPreview.tsx`)
Added parsing for comprehensive ESC-POS commands:

| Command | Purpose | Implementation |
|---------|---------|----------------|
| ESC M (0x1B 0x4D) | Font selection | Tracks currentFont: 'a', 'b', or 'c' |
| ESC ! (0x1B 0x21) | Print mode | Extracts font, bold, double width/height, underline from bit flags |
| ESC { (0x1B 0x7B) | Upside down | Tracks flip state |
| GS ! (0x1D 0x21) | Character size | Extracts width/height multipliers from bit fields |
| GS B (0x1D 0x42) | Reverse printing | Tracks invert state |

**Helper Function**: `pushCurrentLine()` consolidates line creation with all attributes to ensure consistency.

### 3. Context Menu UI (`app/src/components/ContextMenu.tsx`)
Complete redesign with dynamic, content-aware interface:

**Text Lines UI:**
- Toggle switches with ON/OFF badges (bold, underline, invert, flip)
- Radio button groups (font A/B/C, alignment)
- Size picker buttons (8 buttons × 2 dimensions = 16 total controls)
- Conversion actions with icons (📊 Barcode, ⬛ QR Code)

**Styling** (app/src/styles/app.css):
```css
.context-menu .size-btn {
  background: #1e1e1e;
  border: 1px solid #3e3e3e;
  /* ... */
}

.context-menu .size-btn.active {
  background: #0e639c;  /* Blue highlight */
  border-color: #1177bb;
  color: #ffffff;
}
```

### 4. Code Modifier (`app/src/utils/codeModifier.ts`)
Extended with powerful new methods:

| Method | Purpose | Example |
|--------|---------|---------|
| `setGenericAttribute()` | Set any formatting attribute | `p.set(invert=True)` |
| `changeFont()` | Change font selection | `p.set(font='b')` |
| `changeSize()` | Modify width/height | `p.set(width=2)` |
| `convertTextToBarcode()` | Replace `p.text()` with `p.barcode()` | `p.barcode('123', 'CODE39')` |
| `convertTextToQR()` | Replace `p.text()` with `p.qr()` | `p.qr('https://...')` |
| `changeImageFormat()` | Modify image impl | `p.image(img, impl='bitImageRaster')` |
| **`applyCommand()`** | **Unified command parser** | Handles all command types |

**Key Innovation - `applyCommand()` Method:**
```typescript
applyCommand(lineNumber: number, pythonCode: string): void {
  const codeLineNumber = this.findCodeLineForPreviewLine(lineNumber);

  // Intelligently parse and apply any python-escpos command
  if (pythonCode.includes('p.set('))      { /* extract & apply */ }
  else if (pythonCode.includes('p.barcode(')) { /* convert */ }
  else if (pythonCode.includes('p.qr('))      { /* convert */ }
  else if (pythonCode.includes('p.image('))   { /* modify */ }
}
```

### 5. Editor Integration (`app/src/pages/Editor.tsx`)
Simplified to use unified API:
```typescript
const handleContextMenuAction = useCallback((lineNumber: number, pythonCode: string) => {
  const modifier = new CodeModifier(code);
  modifier.applyCommand(lineNumber, pythonCode);  // Single entry point
  setCode(modifier.getModifiedCode());
}, [code]);
```

## ESC-POS Coverage

| Category | Coverage | Commands |
|----------|----------|----------|
| Text Attributes | ✅ Complete | ESC E, ESC -, ESC !, ESC M, ESC { |
| Character Size | ✅ Complete | GS ! (width/height 1-8x) |
| Visual Effects | ✅ Complete | GS B (invert) |
| Alignment | ✅ Complete | ESC a (left/center/right) |
| Barcodes | ✅ Complete | Conversion to p.barcode() |
| QR Codes | ✅ Complete | Conversion to p.qr() |
| Images | ✅ Complete | Format switching (column/raster) |

## User Experience Flow

1. **Right-click** on any preview line
2. **Context menu appears** with options specific to that line type
3. **Select formatting option** (e.g., Font B, width 2x, invert ON)
4. **Code automatically updates** with appropriate python-escpos call
5. **Preview refreshes** automatically showing changes

## Files Changed

### Core Implementation
- **app/src/types/index.ts** (+54 lines)
  - Added FontType, LineContentType types
  - Extended LineAttributes with 9 new optional fields
  - Added ContextMenuAction interface
  - Updated ContextMenuProps with onAction callback

- **app/src/components/ReceiptPreview.tsx** (+280 lines, -60 lines)
  - Added parsing for ESC M, ESC !, ESC {, GS !, GS B
  - Added pushCurrentLine() helper function
  - Extended state tracking for all formatting attributes
  - Enhanced handleContextMenu to pass content type and text

- **app/src/components/ContextMenu.tsx** (+294 lines, -50 lines)
  - Complete UI redesign with dynamic content
  - Added size picker buttons with active states
  - Added font and conversion option sections
  - Implemented content-type-aware rendering

- **app/src/utils/codeModifier.ts** (+209 lines)
  - Added setGenericAttribute(), changeFont(), changeSize()
  - Added convertTextToBarcode(), convertTextToQR()
  - Added changeImageFormat() for image impl switching
  - Added unified applyCommand() parser method

- **app/src/pages/Editor.tsx** (-25 lines, +5 lines)
  - Simplified handleContextMenuAction to use applyCommand()
  - Removed manual parsing logic (now in CodeModifier)

### Styling
- **app/src/styles/app.css** (+45 lines)
  - Added .size-controls flex layout
  - Added .size-btn styles with hover/active states
  - Chrome DevTools-inspired color scheme

## Testing

### Manual Testing Steps

1. **Start React dev server:**
   ```bash
   cd app
   npm run dev  # or yarn dev
   ```

2. **Test text formatting:**
   - Create receipt with text: `p.text("Hello World\n")`
   - Right-click preview line
   - Try each formatting option:
     - ✓ Font selection (A/B/C)
     - ✓ Size controls (width 1-8, height 1-8)
     - ✓ Bold, underline, invert, flip toggles
     - ✓ Alignment changes
   - Verify code updates correctly with `p.set()` calls

3. **Test content conversion:**
   - Right-click text line
   - Click "📊 Barcode" → Verify code changes to `p.barcode('Hello World', 'CODE39')`
   - Undo and click "⬛ QR Code" → Verify code changes to `p.qr('Hello World')`

4. **Test image formatting:**
   - Upload an image
   - Right-click image in preview
   - Switch between "Column Format (ESC *)" and "Raster Format (GS v 0)"
   - Verify `impl` parameter changes in `p.image()` call

5. **Test edge cases:**
   - Multiple consecutive `p.set()` calls (should update existing, not duplicate)
   - Indented code (should preserve indentation)
   - Comments (should skip comment lines when finding p.text())

### Expected Behavior

**Size Picker Buttons:**
- Current value should be highlighted in blue
- Clicking a button should immediately update code
- Preview should refresh showing new size

**Toggle Switches:**
- Should show checkmark (✓) when ON, empty box (☐) when OFF
- Badge should show "ON" or "OFF" state
- Clicking should toggle state and update code

**Content Type Detection:**
- Text lines: Show full formatting suite
- Image lines: Show only impl format and alignment
- Future barcode/QR: Show alignment and conversion options

## Benefits

✅ **Visual editing**: No manual code editing needed for formatting
✅ **Discoverability**: Users can explore python-escpos features through UI
✅ **Speed**: Fast formatting changes with instant preview
✅ **Accuracy**: Generated code is syntactically correct
✅ **Flexibility**: Supports all major python-escpos formatting options
✅ **Extensibility**: Easy to add new formatting options (follow existing patterns)

## Future Enhancements

Potential improvements for future PRs:
- Additional barcode types (EAN13, UPC-A, QR options)
- Barcode/QR → text conversion (framework ready)
- Font size preview in context menu
- Batch formatting (apply to multiple lines)
- Keyboard shortcuts for common formatting
- Smooth/anti-aliasing toggle (when supported)
- Custom character spacing/line height

## Compatibility

- ✅ **Backward compatible**: Existing code continues to work
- ✅ **Graceful degradation**: Unknown commands shown in "Commands Applied" section
- ✅ **Type-safe**: Full TypeScript coverage with strict types
- ✅ **Standards-compliant**: Uses standard ESC-POS commands

## References

- ESC-POS Command Reference: [Epson Documentation](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/)
- python-escpos: [Documentation](https://python-escpos.readthedocs.io/)
- Project architecture: `CLAUDE.md` section "Architecture: Python vs TypeScript Boundaries"
