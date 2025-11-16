import { useState } from 'react';
import type { PrinterConfig, PrinterStatus } from '@/types';
import { PRINTER_PRESETS } from '@/types';

interface PrinterControlsProps {
  printer: {
    isConnected: boolean;
    isPrinting: boolean;
    error: string | null;
    selectedPrinter: PrinterConfig | null;
    printerStatus: PrinterStatus | null;
    connect: (config: PrinterConfig) => Promise<void>;
    disconnect: () => void;
    queryStatus: (printerName: string, customHost?: string, customPort?: number) => Promise<PrinterStatus>;
  };
  onPrint: () => void;
  disabled: boolean;
}

export default function PrinterControls({ printer, onPrint, disabled }: PrinterControlsProps) {
  const [customIp, setCustomIp] = useState('192.168.1.100');
  const [customPort, setCustomPort] = useState(9100);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const handleConnect = async () => {
    const config =
      selectedPreset >= 0 && selectedPreset < PRINTER_PRESETS.length
        ? PRINTER_PRESETS[selectedPreset]!
        : { name: 'Custom', ip: customIp, port: customPort };

    try {
      await printer.connect(config);
      // Automatically check status after connection
      await handleCheckStatus();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleCheckStatus = async () => {
    if (!printer.isConnected || !printer.selectedPrinter) return;

    try {
      setIsCheckingStatus(true);
      const printerName = PRINTER_PRESETS.findIndex(p => p.name === printer.selectedPrinter?.name) >= 0
        ? printer.selectedPrinter.name
        : 'custom';

      await printer.queryStatus(
        printerName,
        printer.selectedPrinter.ip,
        printer.selectedPrinter.port
      );
    } catch (err) {
      console.error('Status check failed:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const getStatusIndicatorClass = () => {
    if (!printer.printerStatus) return 'status-indicator connected';

    if (printer.printerStatus.error) return 'status-indicator error';
    if (printer.printerStatus.paperStatus === 'low') return 'status-indicator warning';
    return 'status-indicator connected';
  };

  const getStatusText = () => {
    if (!printer.printerStatus) return 'Connected';

    if (printer.printerStatus.error) return printer.printerStatus.errorMessage || 'Error';
    if (printer.printerStatus.paperStatus === 'low') return 'Paper Low';
    if (!printer.printerStatus.supported) return 'Connected (status unavailable)';
    return 'Online';
  };

  return (
    <div className="printer-controls">
      <h3>Printer Controls</h3>

      {!printer.isConnected ? (
        <div className="connection-form">
          <div className="form-group">
            <label>Printer Preset</label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(Number(e.target.value))}
            >
              {PRINTER_PRESETS.map((preset, index) => (
                <option key={index} value={index}>
                  {preset.name} ({preset.ip}:{preset.port})
                </option>
              ))}
              <option value={-1}>Custom</option>
            </select>
          </div>

          {selectedPreset === -1 && (
            <>
              <div className="form-group">
                <label>IP Address</label>
                <input
                  type="text"
                  value={customIp}
                  onChange={(e) => setCustomIp(e.target.value)}
                  placeholder="192.168.1.100"
                />
              </div>

              <div className="form-group">
                <label>Port</label>
                <input
                  type="number"
                  value={customPort}
                  onChange={(e) => setCustomPort(Number(e.target.value))}
                  placeholder="9100"
                />
              </div>
            </>
          )}

          <button className="connect-button" onClick={handleConnect}>
            Connect to Printer
          </button>
        </div>
      ) : (
        <div className="connected-controls">
          <div className="connection-info">
            <span className={getStatusIndicatorClass()}></span>
            <div className="status-text">
              <div className="printer-name">
                {printer.selectedPrinter?.name} ({printer.selectedPrinter?.ip}:
                {printer.selectedPrinter?.port})
              </div>
              <div className="status-message">{getStatusText()}</div>
              {printer.printerStatus && printer.printerStatus.supported && (
                <div className="status-details">
                  <small>
                    Paper: {printer.printerStatus.paperStatus === 'ok' ? '✓' : printer.printerStatus.paperStatus === 'low' ? '⚠️' : '✗'}{' '}
                    {printer.printerStatus.paperStatus.toUpperCase()} •{' '}
                    Cover: {printer.printerStatus.coverOpen ? '⚠️ OPEN' : '✓ CLOSED'}
                  </small>
                </div>
              )}
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="status-button secondary"
              onClick={handleCheckStatus}
              disabled={isCheckingStatus}
              title="Check printer status"
            >
              {isCheckingStatus ? '⏳' : '🔍'} Status
            </button>
            <button
              className="print-button"
              onClick={onPrint}
              disabled={disabled || printer.isPrinting || (printer.printerStatus?.error ?? false)}
              title={
                printer.printerStatus?.error
                  ? `Cannot print: ${printer.printerStatus.errorMessage}`
                  : 'Print to thermal printer'
              }
            >
              {printer.isPrinting ? 'Printing...' : 'Print'}
            </button>
            <button className="disconnect-button" onClick={printer.disconnect}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      {printer.error && <div className="error-message">{printer.error}</div>}
    </div>
  );
}
