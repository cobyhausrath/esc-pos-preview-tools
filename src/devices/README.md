# Printer Device Database

This directory contains the device database for thermal receipt printers. The database includes specifications for various printer models to ensure accurate rendering and preview.

## Overview

The printer database (`printers.ts`) contains detailed specifications for thermal receipt printers, including:

- **Resolution (DPI)**: Dots per inch for accurate rendering
- **Paper dimensions**: Paper width and printable area
- **Font specifications**: Character sizes and characters per line
- **Command set compatibility**: Supported protocols (ESC/POS, etc.)
- **Device-specific quirks**: Special behaviors or limitations

## Preferred Printer

The **Netum 80-V-UL** is currently set as the preferred printer device. This is an 80mm thermal receipt printer with the following specifications:

### Netum 80-V-UL Specifications

- **Manufacturer**: Netum
- **Model**: 80-V-UL
- **Resolution**: 203 DPI
- **Paper Width**: 80mm
- **Printable Width**: 72mm (576 dots)
- **Font A**: 12×24 dots, 48 characters per line
- **Font B**: 9×17 dots, 64 characters per line
- **Command Set**: ESC/POS
- **Aliases**: Netum 80mm, 80-V-UL, NT-8360, NT-8330

### Quirks & Notes

1. Default tab positions at 8-character intervals
2. Supports multiple DPI modes: 203.2, 101.6, and 67.7 DPI
3. Standard ESC/POS command set with full compatibility

## Usage

### Using the Preferred Printer

By default, the `HTMLRenderer` uses the preferred printer (Netum 80-V-UL):

```typescript
import { HTMLRenderer } from 'esc-pos-preview-tools';

const renderer = new HTMLRenderer();
// Uses Netum 80-V-UL by default
```

### Specifying a Printer by ID

```typescript
import { HTMLRenderer } from 'esc-pos-preview-tools';

const renderer = new HTMLRenderer({
  printer: 'netum-80mm' // Use Netum 80mm printer
});
```

### Using a Generic Printer

```typescript
import { HTMLRenderer } from 'esc-pos-preview-tools';

const renderer = new HTMLRenderer({
  printer: 'generic-58mm' // Use generic 58mm printer
});
```

### Getting Printer Information

```typescript
import {
  getPreferredPrinter,
  getPrinterById,
  getPrinterByModel,
  getAllPrinters
} from 'esc-pos-preview-tools';

// Get the preferred printer
const preferred = getPreferredPrinter();
console.log(preferred.manufacturer, preferred.model);

// Get a specific printer by ID
const netum = getPrinterById('netum-80mm');

// Get a printer by model name or alias
const printer = getPrinterByModel('NT-8360');

// List all available printers
const allPrinters = getAllPrinters();
```

## Adding New Printers

To add a new printer to the database:

1. Open `src/devices/printers.ts`
2. Add a new entry to the `PRINTER_DEVICES` object
3. Set `preferred: true` if you want it to be the default
4. Include all required specifications:
   - `manufacturer` and `model`
   - `dpi`, `paperWidthMm`, `printableWidthMm`, `printableWidthDots`
   - `fonts.fontA` and `fonts.fontB` with character dimensions
   - `commandSets` array
   - Optional: `aliases`, `quirks`, `preferred`

### Example

```typescript
'my-printer-id': {
  manufacturer: 'MyBrand',
  model: 'MP-100',
  aliases: ['MP100', 'MyPrinter 100'],
  dpi: 203,
  paperWidthMm: 80,
  printableWidthMm: 72,
  printableWidthDots: 576,
  fonts: {
    fontA: {
      name: 'Font A',
      widthDots: 12,
      heightDots: 24,
      charactersPerLine: 48,
    },
    fontB: {
      name: 'Font B',
      widthDots: 9,
      heightDots: 17,
      charactersPerLine: 64,
    },
  },
  commandSets: ['ESC/POS'],
  quirks: [
    'Any special behaviors or limitations'
  ],
  preferred: false,
}
```

## Available Printers

| ID | Manufacturer | Model | Paper Width | DPI | Preferred |
|----|--------------|-------|-------------|-----|-----------|
| `netum-80mm` | Netum | 80-V-UL | 80mm | 203 | ✅ |
| `generic-80mm` | Generic | 80mm Thermal | 80mm | 203 | |
| `generic-58mm` | Generic | 58mm Thermal | 58mm | 203 | |

## Technical Details

### Resolution Calculation

The printable width in dots is calculated as:
```
printableWidthDots = (printableWidthMm / 25.4) * dpi
```

For example, a 72mm printable width at 203 DPI:
```
(72mm / 25.4) * 203 DPI ≈ 576 dots
```

### Characters Per Line

Characters per line is calculated based on font width:
```
charactersPerLine = printableWidthDots / fontWidthDots
```

For Font A (12 dots wide) with 576 dots printable width:
```
576 / 12 = 48 characters
```

## References

- [ESC/POS Command Reference](https://reference.epson-biz.com/modules/ref_escpos/index.php)
- [Netum 80mm Thermal Printer Manual](https://www.netum.net/)
- [Thermal Printer Standards](https://www.epson.com/Support/wa00821)
