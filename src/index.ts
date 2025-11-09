/**
 * ESC/POS Preview Tools
 * Main entry point
 */

export { CommandParser } from './parser/CommandParser';
export { HTMLRenderer } from './renderer/HTMLRenderer';
export * from './parser/types';

// Export printer database
export {
  PRINTER_DEVICES,
  getPreferredPrinter,
  getPrinterById,
  getPrinterByModel,
  getAllPrinters,
} from './devices/printers';
export type { PrinterDevice, PrinterFont } from './devices/printers';
