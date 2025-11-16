import { useState, useEffect, useRef } from 'react';
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
    feedPaper: (lines?: number) => Promise<void>;
    cutPaper: (partial?: boolean) => Promise<void>;
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
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommandTimeRef = useRef<number>(0);
  const hasAutoConnectedRef = useRef(false);
  const commandCooldownMs = 3000; // Don't check status for 3 seconds after any command

  // Auto-connect on mount
  useEffect(() => {
    // Use ref to prevent double-connect in React Strict Mode (dev)
    if (!hasAutoConnectedRef.current && settings.autoConnect && settings.lastPrinterConfig && !printer.isConnected) {
      hasAutoConnectedRef.current = true;
      const config = settings.lastPrinterConfig;
      printer.connect(config).then(() => {
        if (settings.autoCheckStatus) {
          handleCheckStatus(config);
        }
      }).catch(err => {
        console.error('Auto-connect failed:', err);
      });
    }
  }, []); // Only run on mount

  // Periodic status checking
  useEffect(() => {
    if (printer.isConnected && settings.statusCheckInterval > 0) {
      // Start interval
      statusIntervalRef.current = setInterval(() => {
        // Skip status check if a command was sent recently (cooldown period)
        const timeSinceLastCommand = Date.now() - lastCommandTimeRef.current;
        if (timeSinceLastCommand < commandCooldownMs) {
          console.log(`[Status] Skipping check - cooldown active (${Math.round((commandCooldownMs - timeSinceLastCommand) / 1000)}s remaining)`);
          return;
        }
        handleCheckStatus();
      }, settings.statusCheckInterval * 1000);

      return () => {
        if (statusIntervalRef.current) {
          clearInterval(statusIntervalRef.current);
          statusIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval if disconnected or disabled
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printer.isConnected, settings.statusCheckInterval]); // handleCheckStatus intentionally omitted

  const handleConnect = async () => {
    const config =
      selectedPreset >= 0 && selectedPreset < PRINTER_PRESETS.length
        ? PRINTER_PRESETS[selectedPreset]!
        : { name: 'Custom', ip: customIp, port: customPort };

    try {
      await printer.connect(config);
      // Save last printer config for auto-connect
      onUpdateSettings({ lastPrinterConfig: config });
      // Automatically check status after connection if enabled
      // Pass the config directly since state might not be updated yet
      if (settings.autoCheckStatus) {
        await handleCheckStatus(config);
      }
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleCheckStatus = async (printerConfig?: PrinterConfig) => {
    // Use provided config or fall back to state
    const config = printerConfig || printer.selectedPrinter;

    // If config is explicitly provided, we assume we're connected (called right after connect)
    // Otherwise, check the connection state
    if (!config || (!printerConfig && !printer.isConnected)) return;

    try {
      setIsCheckingStatus(true);

      // Mark that we're doing a status check to prevent periodic check from firing
      lastCommandTimeRef.current = Date.now();

      const printerName = PRINTER_PRESETS.findIndex(p => p.name === config.name) >= 0
        ? config.name
        : 'custom';

      await printer.queryStatus(
        printerName,
        config.ip,
        config.port
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
    // Validate WebSocket URL format
    if (bridgeUrlInput && !bridgeUrlInput.startsWith('ws://') && !bridgeUrlInput.startsWith('wss://')) {
      console.warn('Bridge URL should start with ws:// (for HTTP sites) or wss:// (for HTTPS sites)');
      // Still allow the update - user might be correcting it
    }
    printer.updateBridgeUrl(bridgeUrlInput);
  };

  const handleFeedPaper = async () => {
    try {
      console.log('[Feed Button] Clicked');
      // Mark command time to pause status checks
      lastCommandTimeRef.current = Date.now();
      await printer.feedPaper(3); // Feed 3 lines
    } catch (err) {
      console.error('Feed paper failed:', err);
    }
  };

  const handleCutPaper = async () => {
    try {
      console.log('[Cut Button] Clicked');
      // Mark command time to pause status checks
      lastCommandTimeRef.current = Date.now();
      await printer.cutPaper(false); // Full cut
    } catch (err) {
      console.error('Cut paper failed:', err);
    }
  };

  const handlePrintWithAutoCut = async () => {
    // Mark command time to pause status checks
    lastCommandTimeRef.current = Date.now();
    console.log(`[Print] Auto-feed: ${settings.autoFeed}, Auto-cut: ${settings.autoCut}`);
    onPrint();

    // Wait for print to finish, then do auto-feed and/or auto-cut
    if (settings.autoFeed || settings.autoCut) {
      setTimeout(async () => {
        try {
          // Auto-feed first (if enabled)
          if (settings.autoFeed) {
            console.log('[Print] Executing auto-feed');
            await printer.feedPaper(3);
          }
          // Then auto-cut (if enabled)
          if (settings.autoCut) {
            console.log('[Print] Executing auto-cut');
            await printer.cutPaper(false);
          }
        } catch (err) {
          console.error('Auto-feed/cut failed:', err);
        }
      }, 500);
    }
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

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.autoConnect}
                    onChange={(e) => onUpdateSettings({ autoConnect: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Auto-connect to last printer</span>
                </label>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Automatically connect when page loads
                </small>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.autoCheckStatus}
                    onChange={(e) => onUpdateSettings({ autoCheckStatus: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Auto-check status on connect</span>
                </label>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Query printer status when connecting
                </small>
              </div>

              <div className="form-group">
                <label>Status check interval (seconds)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={settings.statusCheckInterval}
                  onChange={(e) => onUpdateSettings({ statusCheckInterval: parseInt(e.target.value) || 0 })}
                  placeholder="5"
                />
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  How often to check status while connected (0 = disabled)
                </small>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.autoFeed}
                    onChange={(e) => onUpdateSettings({ autoFeed: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Auto-feed after print</span>
                </label>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Automatically feed paper after printing
                </small>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.autoCut}
                    onChange={(e) => onUpdateSettings({ autoCut: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Auto-cut after print</span>
                </label>
                <small style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Automatically cut paper after printing
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
              onClick={() => handleCheckStatus()}
              disabled={isCheckingStatus}
              title="Check printer status"
            >
              {isCheckingStatus ? '⏳' : '🔍'} Status
            </button>
            <button
              className="feed-button secondary"
              onClick={handleFeedPaper}
              disabled={printer.isPrinting}
              title="Feed paper (3 lines)"
            >
              📄 Feed
            </button>
            <button
              className="cut-button secondary"
              onClick={handleCutPaper}
              disabled={printer.isPrinting}
              title="Cut paper"
            >
              ✂️ Cut
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="print-button"
                onClick={handlePrintWithAutoCut}
                disabled={disabled || printer.isPrinting || (printer.printerStatus?.error ?? false)}
                title={
                  printer.printerStatus?.error
                    ? `Cannot print: ${printer.printerStatus.errorMessage}`
                    : settings.autoFeed && settings.autoCut
                    ? 'Print, auto-feed, and auto-cut'
                    : settings.autoFeed
                    ? 'Print and auto-feed'
                    : settings.autoCut
                    ? 'Print and auto-cut'
                    : 'Print to thermal printer'
                }
              >
                {printer.isPrinting ? 'Printing...' : 'Print'}
              </button>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap'
                }}
                title="Automatically feed paper after printing"
              >
                <input
                  type="checkbox"
                  checked={settings.autoFeed}
                  onChange={(e) => onUpdateSettings({ autoFeed: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <span>Feed</span>
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap'
                }}
                title="Automatically cut paper after printing"
              >
                <input
                  type="checkbox"
                  checked={settings.autoCut}
                  onChange={(e) => onUpdateSettings({ autoCut: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <span>Cut</span>
              </label>
            </div>
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
