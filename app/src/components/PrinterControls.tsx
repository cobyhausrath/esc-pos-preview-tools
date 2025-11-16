import { useState } from 'react';
import type { PrinterConfig, PrinterStatus } from '@/types';
import type { PrinterSettings } from '@/hooks/useSettings';
import { PRINTER_PRESETS } from '@/types';

interface PrinterControlsProps {
  printer: {
    isConnected: boolean;
    isPrinting: boolean;
    error: string | null;
    selectedPrinter: PrinterConfig | null;
    printerStatus: PrinterStatus | null;
    bridgeUrl: string;
    connect: (config: PrinterConfig) => Promise<void>;
    disconnect: () => void;
    queryStatus: (printerName: string, customHost?: string, customPort?: number) => Promise<PrinterStatus>;
    updateBridgeUrl: (url: string) => void;
  };
  onPrint: () => void;
  disabled: boolean;
  settings: PrinterSettings;
  onUpdateSettings: (updates: Partial<PrinterSettings>) => void;
}

export default function PrinterControls({ printer, onPrint, disabled, settings, onUpdateSettings }: PrinterControlsProps) {
  const [customIp, setCustomIp] = useState('192.168.1.100');
  const [customPort, setCustomPort] = useState(9100);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bridgeUrlInput, setBridgeUrlInput] = useState(printer.bridgeUrl);

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

  const handleBridgeUrlUpdate = () => {
    printer.updateBridgeUrl(bridgeUrlInput);
  };

  return (
    <div className="printer-controls">
      <h3>Printer Controls</h3>

      {!printer.isConnected ? (
        <div className="connection-form">
          {/* Advanced Settings - Bridge URL */}
          <div className="form-group">
            <button
              type="button"
              className="template-button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            >
              {showAdvanced ? '▼' : '▶'} Advanced Settings
            </button>
          </div>

          {showAdvanced && (
            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Printer Bridge URL</label>
                <input
                  type="text"
                  value={bridgeUrlInput}
                  onChange={(e) => setBridgeUrlInput(e.target.value)}
                  onBlur={handleBridgeUrlUpdate}
                  placeholder="ws://127.0.0.1:8765"
                />
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  WebSocket URL for printer bridge server.
                  Use ws:// for HTTP sites, wss:// for HTTPS sites.
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Printer Profile</label>
                <select
                  value={settings.printerProfile}
                  onChange={(e) => onUpdateSettings({ printerProfile: e.target.value })}
                >
                  <option value="NT-80-V-UL">Netum 80-V-UL (203 DPI)</option>
                  <option value="TM-T88V">Epson TM-T88V (180 DPI)</option>
                  <option value="default">Generic (180 DPI)</option>
                </select>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Controls DPI and printer-specific ESC/POS commands
                </small>
              </div>

              <div className="form-group">
                <label>Image Format</label>
                <select
                  value={settings.imageImplementation}
                  onChange={(e) => onUpdateSettings({ imageImplementation: e.target.value as PrinterSettings['imageImplementation'] })}
                >
                  <option value="bitImageRaster">Raster (GS v 0) - Best for Netum</option>
                  <option value="bitImageColumn">Column (ESC *) - Legacy</option>
                  <option value="graphics">Graphics (GS ( L) - Modern</option>
                </select>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Raster format eliminates gaps on Netum 80-V-UL
                </small>
              </div>
            </div>
          )}

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
