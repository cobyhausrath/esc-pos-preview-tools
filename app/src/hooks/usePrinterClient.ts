import { useState, useCallback, useRef } from 'react';
import type { PrinterConfig, PrinterStatus } from '@/types';

// Timeout constants
const STATUS_QUERY_TIMEOUT_MS = 5000; // 5 seconds for status queries
const PRINT_TIMEOUT_MS = 10000; // 10 seconds for print operations

// Get bridge URL from localStorage or use default
const getDefaultBridgeUrl = (): string => {
  return localStorage.getItem('printerBridgeUrl') || 'ws://127.0.0.1:8765';
};

export function usePrinterClient() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterConfig | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState<string>(getDefaultBridgeUrl());
  const wsRef = useRef<WebSocket | null>(null);

  const updateBridgeUrl = useCallback((url: string) => {
    setBridgeUrl(url);
    localStorage.setItem('printerBridgeUrl', url);
  }, []);

  const connect = useCallback((printer: PrinterConfig) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(bridgeUrl);

        ws.onopen = () => {
          // Connection successful
          setIsConnected(true);
          setSelectedPrinter(printer);
          setError(null);
          wsRef.current = ws;
          resolve();
        };

        ws.onerror = () => {
          setError('Failed to connect to printer bridge');
          setIsConnected(false);
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = () => {
          setIsConnected(false);
          setPrinterStatus(null);
          wsRef.current = null;
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            // Log welcome messages and other general messages
            if (import.meta.env.DEV && message.message) {
              console.log('[Bridge]', message.message);
            }
          } catch (err) {
            console.error('Failed to parse message from printer bridge:', err);
          }
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create WebSocket');
        reject(err);
      }
    });
  }, [bridgeUrl]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setSelectedPrinter(null);
    setPrinterStatus(null);
  }, []);

  const queryStatus = useCallback(
    async (printerName: string, customHost?: string, customPort?: number): Promise<PrinterStatus> => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected to printer bridge');
      }

      return new Promise((resolve, reject) => {
        const request: {
          action: string;
          printer?: string;
          host?: string;
          port?: number;
        } = {
          action: 'status',
        };

        // Always send host and port for reliability
        // This ensures status queries work even if printer name doesn't match bridge config
        if (customHost && customPort) {
          request.host = customHost;
          request.port = customPort;
          // Also send printer name as fallback if it matches a known preset
          if (printerName !== 'custom') {
            request.printer = printerName;
          }
        } else {
          request.printer = printerName;
        }

        // Set up response handler
        const handleMessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.success && message.status) {
              const status: PrinterStatus = message.status;
              setPrinterStatus(status);
              wsRef.current?.removeEventListener('message', handleMessage);
              resolve(status);
            } else if (!message.success) {
              wsRef.current?.removeEventListener('message', handleMessage);
              reject(new Error(message.error || 'Status query failed'));
            }
          } catch (err) {
            wsRef.current?.removeEventListener('message', handleMessage);
            reject(err);
          }
        };

        wsRef.current.addEventListener('message', handleMessage);

        // Send request
        wsRef.current.send(JSON.stringify(request));

        // Timeout after configured duration
        setTimeout(() => {
          wsRef.current?.removeEventListener('message', handleMessage);
          reject(new Error('Status query timeout'));
        }, STATUS_QUERY_TIMEOUT_MS);
      });
    },
    []
  );

  const sendRawData = useCallback(
    async (data: Uint8Array): Promise<void> => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected to printer bridge');
      }

      if (!selectedPrinter) {
        throw new Error('No printer selected');
      }

      return new Promise((resolve, reject) => {
        // Define handleMessage in the outer scope so timeout can access it
        const handleMessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.success) {
              clearTimeout(timeoutId);
              setIsPrinting(false);
              wsRef.current?.removeEventListener('message', handleMessage);
              resolve();
            } else if (message.success === false) {
              clearTimeout(timeoutId);
              setIsPrinting(false);
              const errorMsg = message.error || 'Print failed';
              setError(errorMsg);
              wsRef.current?.removeEventListener('message', handleMessage);
              reject(new Error(errorMsg));
            }
          } catch (err) {
            clearTimeout(timeoutId);
            setIsPrinting(false);
            wsRef.current?.removeEventListener('message', handleMessage);
            reject(err);
          }
        };

        const timeoutId = setTimeout(() => {
          setIsPrinting(false);
          setError('Print timeout - printer not responding');
          wsRef.current?.removeEventListener('message', handleMessage);
          reject(new Error('Print timeout'));
        }, PRINT_TIMEOUT_MS);

        try {
          setIsPrinting(true);
          setError(null);

          wsRef.current!.addEventListener('message', handleMessage);

          // Send print request using bridge protocol
          wsRef.current!.send(
            JSON.stringify({
              action: 'send',
              host: selectedPrinter.ip,
              port: selectedPrinter.port,
              data: Array.from(data),
            })
          );
        } catch (err) {
          clearTimeout(timeoutId);
          setIsPrinting(false);
          setError(err instanceof Error ? err.message : 'Print failed');
          reject(err);
        }
      });
    },
    [selectedPrinter]
  );

  const print = useCallback(
    async (data: Uint8Array): Promise<void> => {
      return sendRawData(data);
    },
    [sendRawData]
  );

  const feedPaper = useCallback(
    async (lines: number = 3): Promise<void> => {
      // ESC d n - Print and feed n lines
      const command = new Uint8Array([0x1B, 0x64, lines]);
      return sendRawData(command);
    },
    [sendRawData]
  );

  const cutPaper = useCallback(
    async (partial: boolean = false): Promise<void> => {
      // GS V m - Cut paper (m=0: full cut, m=1: partial cut)
      const command = new Uint8Array([0x1D, 0x56, partial ? 1 : 0]);
      return sendRawData(command);
    },
    [sendRawData]
  );

  return {
    isConnected,
    isPrinting,
    error,
    selectedPrinter,
    printerStatus,
    bridgeUrl,
    connect,
    disconnect,
    queryStatus,
    print,
    feedPaper,
    cutPaper,
    updateBridgeUrl,
  };
}
