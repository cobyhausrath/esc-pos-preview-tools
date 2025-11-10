import { useState } from 'react';
import type { PrinterConfig } from '@/types';
import { PRINTER_PRESETS } from '@/types';

interface PrinterControlsProps {
  printer: {
    isConnected: boolean;
    isPrinting: boolean;
    error: string | null;
    selectedPrinter: PrinterConfig | null;
    connect: (config: PrinterConfig) => Promise<void>;
    disconnect: () => void;
  };
  onPrint: () => void;
  disabled: boolean;
}

export default function PrinterControls({ printer, onPrint, disabled }: PrinterControlsProps) {
  const [customIp, setCustomIp] = useState('192.168.1.100');
  const [customPort, setCustomPort] = useState(9100);
  const [selectedPreset, setSelectedPreset] = useState(0);

  const handleConnect = async () => {
    const config =
      selectedPreset >= 0 && selectedPreset < PRINTER_PRESETS.length
        ? PRINTER_PRESETS[selectedPreset]!
        : { name: 'Custom', ip: customIp, port: customPort };

    try {
      await printer.connect(config);
    } catch (err) {
      console.error('Connection failed:', err);
    }
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
            <span className="status-indicator connected"></span>
            <span>
              Connected to {printer.selectedPrinter?.name} ({printer.selectedPrinter?.ip}:
              {printer.selectedPrinter?.port})
            </span>
          </div>

          <div className="action-buttons">
            <button
              className="print-button"
              onClick={onPrint}
              disabled={disabled || printer.isPrinting}
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
