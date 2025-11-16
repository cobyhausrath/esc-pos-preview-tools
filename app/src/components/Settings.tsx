import { useState } from 'react';
import type { PrinterSettings } from '@/hooks/useSettings';

interface SettingsProps {
  settings: PrinterSettings;
  onUpdate: (updates: Partial<PrinterSettings>) => void;
}

export default function Settings({ settings, onUpdate }: SettingsProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="settings-container">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="settings-toggle"
        style={{
          width: '100%',
          padding: '0.75rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: showSettings ? '0.5rem' : '0',
        }}
      >
        <span>⚙️ Printer Settings</span>
        <span>{showSettings ? '▲' : '▼'}</span>
      </button>

      {showSettings && (
        <div
          className="settings-panel"
          style={{
            background: 'var(--bg-tertiary)',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            border: '1px solid var(--border)',
          }}
        >
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="printer-profile"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
              }}
            >
              Printer Profile
            </label>
            <select
              id="printer-profile"
              value={settings.printerProfile}
              onChange={(e) => onUpdate({ printerProfile: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'inherit',
              }}
            >
              <option value="NT-80-V-UL">Netum 80-V-UL (203 DPI)</option>
              <option value="TM-T88V">Epson TM-T88V (180 DPI)</option>
              <option value="default">Generic (180 DPI)</option>
            </select>
            <small
              style={{
                display: 'block',
                marginTop: '0.25rem',
                opacity: 0.7,
                fontSize: '0.875rem',
              }}
            >
              Controls DPI and printer-specific commands
            </small>
          </div>

          <div className="form-group">
            <label
              htmlFor="image-impl"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
              }}
            >
              Image Implementation
            </label>
            <select
              id="image-impl"
              value={settings.imageImplementation}
              onChange={(e) =>
                onUpdate({
                  imageImplementation: e.target.value as PrinterSettings['imageImplementation'],
                })
              }
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'inherit',
              }}
            >
              <option value="bitImageRaster">Raster (GS v 0) - Best for Netum</option>
              <option value="bitImageColumn">Column (ESC *) - Legacy</option>
              <option value="graphics">Graphics (GS ( L) - Modern</option>
            </select>
            <small
              style={{
                display: 'block',
                marginTop: '0.25rem',
                opacity: 0.7,
                fontSize: '0.875rem',
              }}
            >
              Raster format eliminates gaps on Netum 80-V-UL
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
