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
  | 'cut'
  | 'unknown';

export interface Command {
  type: CommandType;
  value?: string | number | boolean;
  raw?: number[];
}

export interface ParseResult {
  commands: Command[];
  rawBytes: Buffer;
  bytesProcessed: number;
}
