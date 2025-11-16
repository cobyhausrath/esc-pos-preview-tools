import { useState, useCallback } from 'react';

export interface PrinterSettings {
  printerProfile: string;
  imageImplementation: 'bitImageColumn' | 'bitImageRaster' | 'graphics';
}

const DEFAULT_SETTINGS: PrinterSettings = {
  printerProfile: 'NT-80-V-UL',
  imageImplementation: 'bitImageRaster',
};

const STORAGE_KEY = 'escpos-printer-settings';

function loadSettings(): PrinterSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load settings:', err);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: PrinterSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save settings:', err);
  }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<PrinterSettings>(loadSettings);

  const updateSettings = useCallback((updates: Partial<PrinterSettings>) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
