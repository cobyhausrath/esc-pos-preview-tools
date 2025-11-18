/**
 * ESC/POS Command Types
 */

export type CommandType =
  | 'initialize'
  | 'text'
  | 'linefeed'
  | 'bold'
  | 'underline'
  | 'align'
  | 'size'
  | 'flip'
  | 'invert'
  | 'cut'
  | 'image'
  | 'barcode'
  | 'qrcode'
  | 'unknown';

export interface Command {
  type: CommandType;
  value?: string | number | boolean;
  raw?: number[];
}

export interface ParseResult {
  commands: Command[];
  rawBytes: Buffer | Uint8Array;
  bytesProcessed: number;
}
