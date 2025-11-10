import { useState, useCallback, useRef } from 'react';
import type { PrinterConfig } from '@/types';

export function usePrinterClient() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterConfig | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((printer: PrinterConfig) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket('ws://127.0.0.1:8765');

        ws.onopen = () => {
          // Send printer configuration
          ws.send(
            JSON.stringify({
              type: 'configure',
              printer: {
                ip: printer.ip,
                port: printer.port,
              },
            })
          );
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
          wsRef.current = null;
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'error') {
              setError(message.message || 'Printer error');
            } else if (message.type === 'print_complete') {
              setIsPrinting(false);
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
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setSelectedPrinter(null);
  }, []);

  const print = useCallback(
    async (data: Uint8Array): Promise<void> => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('Not connected to printer bridge');
      }

      return new Promise((resolve, reject) => {
        try {
          setIsPrinting(true);
          setError(null);

          // Send binary data
          wsRef.current!.send(
            JSON.stringify({
              type: 'print',
              data: Array.from(data),
            })
          );

          // Wait for confirmation
          const handleMessage = (event: MessageEvent) => {
            try {
              const message = JSON.parse(event.data);
              if (message.type === 'print_complete') {
                setIsPrinting(false);
                wsRef.current?.removeEventListener('message', handleMessage);
                resolve();
              } else if (message.type === 'error') {
                setIsPrinting(false);
                setError(message.message || 'Print failed');
                wsRef.current?.removeEventListener('message', handleMessage);
                reject(new Error(message.message || 'Print failed'));
              }
            } catch (err) {
              setIsPrinting(false);
              wsRef.current?.removeEventListener('message', handleMessage);
              reject(err);
            }
          };

          wsRef.current!.addEventListener('message', handleMessage);

          // Timeout after 10 seconds
          setTimeout(() => {
            if (isPrinting) {
              setIsPrinting(false);
              setError('Print timeout');
              reject(new Error('Print timeout'));
            }
          }, 10000);
        } catch (err) {
          setIsPrinting(false);
          setError(err instanceof Error ? err.message : 'Print failed');
          reject(err);
        }
      });
    },
    [isPrinting]
  );

  return {
    isConnected,
    isPrinting,
    error,
    selectedPrinter,
    connect,
    disconnect,
    print,
  };
}
