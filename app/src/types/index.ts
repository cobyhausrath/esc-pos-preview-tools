// Job status types
export type JobStatus = 'pending' | 'approved' | 'rejected' | 'printing' | 'completed' | 'failed';

// Job interface
export interface Job {
  id: string;
  status: JobStatus;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  data_size: number;
  preview_text: string;
  printer_name: string;
  source_ip: string;
  error_message: string | null;
}

// Job statistics
export interface JobStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  printing: number;
  completed: number;
  failed: number;
}

// WebSocket message types
export type WSMessageType = 'job_update' | 'new_job' | 'stats_update' | 'connection';

export interface WSMessage {
  type: WSMessageType;
  job?: Job;
  jobs?: Job[];
  stats?: JobStats;
  message?: string;
}

// Printer configuration
export interface PrinterConfig {
  name: string;
  ip: string;
  port: number;
}

// Printer presets
export const PRINTER_PRESETS: PrinterConfig[] = [
  { name: 'Netum 80-V-UL', ip: '192.168.1.100', port: 9100 },
];

// Printer status types
export type PaperStatus = 'ok' | 'low' | 'out' | 'unknown';

export interface PrinterStatus {
  online: boolean;
  paperStatus: PaperStatus;
  coverOpen: boolean;
  error: boolean;
  errorMessage: string | null;
  supported: boolean;
  details: Record<string, boolean | number | string>;
}

// Pyodide types
export interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (packages: string | string[]) => Promise<void>;
  globals: {
    get: (name: string) => unknown;
    set: (name: string, value: unknown) => void;
  };
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string, options?: { encoding?: string }) => Uint8Array | string;
    unlink: (path: string) => void;
  };
}

// Template types
export type TemplateType = 'timestamp' | 'expiry' | 'todo' | 'note' | 'image';

export interface Template {
  id: TemplateType;
  name: string;
  description: string;
}

// HEX formatter statistics
export interface HexStats {
  totalBytes: number;
  escCommands: number;
  gsCommands: number;
}

// Receipt data
export interface ReceiptData {
  code: string;
  escposBytes: Uint8Array | null;
  preview: string;
  hexView: string;
  hexStats: HexStats;
}

// Editor state
export interface EditorState {
  code: string;
  isLoading: boolean;
  isPyodideReady: boolean;
  error: string | null;
  receiptData: ReceiptData;
}

// Printer client state
export interface PrinterClientState {
  isConnected: boolean;
  isPrinting: boolean;
  error: string | null;
  selectedPrinter: PrinterConfig | null;
}

// Dashboard filter type
export type DashboardFilter = 'all' | JobStatus;

// Context Menu types
export type AlignmentType = 'left' | 'center' | 'right';

export interface CommandMetadata {
  type: 'initialize' | 'alignment' | 'bold' | 'underline' | 'size' | 'cut';
  value?: AlignmentType | boolean | number;
  pythonCode: string;
}

export interface LineAttributes {
  align: AlignmentType;
  bold: boolean;
  underline: boolean;
}

export interface LineState extends LineAttributes {
  commands: CommandMetadata[];
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuProps {
  lineNumber: number;
  attributes: LineAttributes;
  commands: CommandMetadata[];
  position: ContextMenuPosition;
  onClose: () => void;
  onToggleBold: (lineNumber: number, currentValue: boolean) => void;
  onToggleUnderline: (lineNumber: number, currentValue: boolean) => void;
  onChangeAlignment: (lineNumber: number, newAlign: AlignmentType) => void;
}
