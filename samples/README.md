# ESC-POS Sample Files

This directory contains sample ESC-POS command files for testing and development purposes.

## Files

### receipt.bin
**Description:** Comprehensive receipt sample with various formatting features

**Features tested:**
- Text alignment (left, center, right)
- Bold text
- Underlined text
- Multiple text sizes (double width, double height, tall, wide)
- Special characters and numbers
- Line formatting and spacing

**Generated with:** python-escpos for Netum 80-V-UL thermal printer

### minimal.bin
**Description:** Minimal test case with basic text output

**Features tested:**
- Basic text printing
- Line feeds
- Paper cut command

**Generated with:** python-escpos

### formatting.bin
**Description:** Text formatting test focusing on all combinations

**Features tested:**
- All alignment modes (left, center, right)
- Bold text variations
- Underline modes
- Text size combinations (normal, wide, tall, double)

**Generated with:** python-escpos

## Target Printer

These samples are generated specifically for the **Netum 80-V-UL thermal printer**, which is an 80mm thermal receipt printer with:
- Resolution: 203 DPI
- Width: 576 dots (80mm)
- Character width: 48 characters per line (default)

## Regenerating Samples

To regenerate these sample files:

```bash
python3 scripts/generate-escpos-samples.py
```

This will create new sample files in this directory using the python-escpos library.

## Testing Samples

To test the parser and renderer with these samples:

```bash
yarn preview
```

This will generate HTML previews in the `test-output/` directory with the thermal printer visual filter applied.

## Hex Dump Examples

### receipt.bin (first 64 bytes)
```
1b40 1b45 011b 6101 1b74 0054 4845 524d
414c 2050 5249 4e54 4552 2054 4553 540a
4e65 7475 6d20 3830 2d56 2d55 4c0a 1b45
001b 6101 3d3d 3d3d 3d3d 3d3d 3d3d 3d3d
```

**Decoded:**
- `1b40` - ESC @ (Initialize printer)
- `1b4501` - ESC E 1 (Enable bold)
- `1b6101` - ESC a 1 (Center alignment)
- `1b7400` - ESC t 0 (Character code table)
- Followed by ASCII text

### minimal.bin
```
1b40 1b74 0048 656c 6c6f 2c20 576f 726c
6421 0a54 6869 7320 6973 2061 2074 6573
742e 0a1b 6406 1d56 00
```

**Decoded:**
- `1b40` - ESC @ (Initialize)
- `1b7400` - ESC t 0 (Character code table)
- ASCII text: "Hello, World!\nThis is a test.\n"
- `1b6406` - ESC d 6 (Feed 6 lines)
- `1d5600` - GS V 0 (Cut paper)

## ESC-POS Command Reference

Common commands used in these samples:

| Command | Hex | Description |
|---------|-----|-------------|
| ESC @ | 1B 40 | Initialize printer |
| ESC E | 1B 45 n | Bold on/off (n=0/1) |
| ESC a | 1B 61 n | Alignment (0=left, 1=center, 2=right) |
| ESC - | 1B 2D n | Underline mode (0-2) |
| GS ! | 1D 21 n | Character size (combines width/height) |
| GS V | 1D 56 n | Cut paper |
| LF | 0A | Line feed |

## Visual Preview

All samples can be viewed with the thermal printer simulation filter, which includes:
- 203 DPI resolution simulation
- Thermal paper texture and color
- Dot matrix dithering effect
- Realistic thermal printer appearance

Open `test-output/index.html` after running `yarn preview` to see the gallery of all samples with the thermal printer filter applied.
