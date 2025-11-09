/**
 * Thermal Printer Device Database
 *
 * Contains specifications for various thermal receipt printers
 * to ensure accurate rendering and preview.
 */

export interface PrinterFont {
  /** Font name/identifier */
  name: string;
  /** Character width in dots */
  widthDots: number;
  /** Character height in dots */
  heightDots: number;
  /** Characters per line at default width */
  charactersPerLine: number;
}

export interface PrinterDevice {
  /** Device manufacturer */
  manufacturer: string;
  /** Model name/number */
  model: string;
  /** Model aliases or variants */
  aliases?: string[];
  /** Printer resolution in DPI */
  dpi: number;
  /** Paper width in millimeters */
  paperWidthMm: number;
  /** Printable/printing area width in millimeters */
  printableWidthMm: number;
  /** Printable width in dots/pixels */
  printableWidthDots: number;
  /** Available fonts */
  fonts: {
    /** Font A - typically larger, standard font */
    fontA: PrinterFont;
    /** Font B - typically smaller, condensed font */
    fontB: PrinterFont;
  };
  /** Supported command sets */
  commandSets: string[];
  /** Device-specific quirks or notes */
  quirks?: string[];
  /** Whether this is a preferred/recommended device */
  preferred?: boolean;
}

/**
 * Device database containing specifications for supported thermal printers
 */
export const PRINTER_DEVICES: Record<string, PrinterDevice> = {
  'netum-80mm': {
    manufacturer: 'Netum',
    model: '80-V-UL',
    aliases: ['Netum 80mm', '80-V-UL', 'NT-8360', 'NT-8330'],
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
      'Default tab positions at 8-character intervals',
      'Supports multiple DPI modes: 203.2, 101.6, and 67.7 DPI',
      'Standard ESC/POS command set with full compatibility',
    ],
    preferred: true,
  },

  // Generic 80mm thermal printer (fallback)
  'generic-80mm': {
    manufacturer: 'Generic',
    model: '80mm Thermal',
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
    preferred: false,
  },

  // Generic 58mm thermal printer
  'generic-58mm': {
    manufacturer: 'Generic',
    model: '58mm Thermal',
    dpi: 203,
    paperWidthMm: 58,
    printableWidthMm: 48,
    printableWidthDots: 384,
    fonts: {
      fontA: {
        name: 'Font A',
        widthDots: 12,
        heightDots: 24,
        charactersPerLine: 32,
      },
      fontB: {
        name: 'Font B',
        widthDots: 9,
        heightDots: 17,
        charactersPerLine: 42,
      },
    },
    commandSets: ['ESC/POS'],
    preferred: false,
  },
};

/**
 * Get the preferred printer device configuration
 */
export function getPreferredPrinter(): PrinterDevice {
  const preferred = Object.values(PRINTER_DEVICES).find(
    (device) => device.preferred
  );
  return preferred || PRINTER_DEVICES['generic-80mm'];
}

/**
 * Get a printer device by ID
 */
export function getPrinterById(id: string): PrinterDevice | undefined {
  return PRINTER_DEVICES[id];
}

/**
 * Get a printer device by model name or alias
 */
export function getPrinterByModel(model: string): PrinterDevice | undefined {
  return Object.values(PRINTER_DEVICES).find(
    (device) =>
      device.model.toLowerCase() === model.toLowerCase() ||
      device.aliases?.some((alias) => alias.toLowerCase() === model.toLowerCase())
  );
}

/**
 * List all available printer devices
 */
export function getAllPrinters(): PrinterDevice[] {
  return Object.values(PRINTER_DEVICES);
}
