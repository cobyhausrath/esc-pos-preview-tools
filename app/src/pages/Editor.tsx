import { useState, useEffect, useCallback } from 'react';
import { usePyodide } from '@/hooks/usePyodide';
import { usePrinterClient } from '@/hooks/usePrinterClient';
import { HexFormatter } from '@/utils/hexFormatter';
import { generateTemplate, TEMPLATES, EXAMPLE_CODES } from '@/utils/templates';
import { CommandParser, HTMLRenderer } from 'esc-pos-preview-tools';
import CodeEditor from '@/components/CodeEditor';
import ReceiptPreview from '@/components/ReceiptPreview';
import HexView from '@/components/HexView';
import PrinterControls from '@/components/PrinterControls';
import TemplateButtons from '@/components/TemplateButtons';
import type { TemplateType, ReceiptData } from '@/types';

const DEFAULT_CODE = EXAMPLE_CODES.basic;

export default function Editor() {
  const { pyodide, isLoading: isPyodideLoading, error: pyodideError, runCode, convertBytesToCode } = usePyodide();
  const printer = usePrinterClient();

  const [code, setCode] = useState(DEFAULT_CODE);
  const [receiptData, setReceiptData] = useState<ReceiptData>({
    code: DEFAULT_CODE,
    escposBytes: null,
    preview: '',
    hexView: '',
    hexStats: { totalBytes: 0, escCommands: 0, gsCommands: 0 },
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHex, setShowHex] = useState(false);

  // Handle shared content from PWA
  useEffect(() => {
    const handleShare = async () => {
      const url = new URL(window.location.href);
      const sharedText = url.searchParams.get('text');

      if (sharedText) {
        // Detect if it's a to-do list or note
        const isTodo = /^[\u2610\u2611\u2612\u2713\u2717\u2718]/.test(sharedText);
        const template = generateTemplate(isTodo ? 'todo' : 'note', sharedText);
        setCode(template);
      }
    };

    handleShare();
  }, []);

  // Load code from URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        const decoded = atob(hash);
        setCode(decoded);
      } catch (err) {
        console.error('Failed to decode URL hash:', err);
      }
    }
  }, []);

  const executeCode = useCallback(async () => {
    if (!pyodide || isPyodideLoading) return;

    try {
      setIsExecuting(true);
      setError(null);

      const bytes = await runCode(code);
      const { hex, stats } = HexFormatter.formatWithStats(bytes);

      // Parse ESC-POS bytes to generate preview HTML
      const parser = new CommandParser();
      const renderer = new HTMLRenderer();
      const parseResult = parser.parse(bytes);
      const preview = renderer.render(parseResult.commands);

      setReceiptData({
        code,
        escposBytes: bytes,
        preview,
        hexView: hex,
        hexStats: stats,
      });

      // Update URL hash for sharing
      window.location.hash = btoa(code);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute code';
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [code, pyodide, isPyodideLoading, runCode]);

  // Execute code when it changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      executeCode();
    }, 500);

    return () => clearTimeout(timeout);
  }, [executeCode]);

  const handleTemplateClick = (type: TemplateType) => {
    const template = generateTemplate(type);
    setCode(template);
  };

  const handleExampleClick = (example: keyof typeof EXAMPLE_CODES) => {
    setCode(EXAMPLE_CODES[example]);
  };

  const handleExport = () => {
    if (!receiptData.escposBytes) return;

    // Create a new Uint8Array to ensure proper type compatibility
    const bytes = new Uint8Array(receiptData.escposBytes);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipt.bin';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsExecuting(true);
      setError(null);

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      if (import.meta.env.DEV) {
        console.log(`Importing ${bytes.length} bytes from ${file.name}`);
      }

      // Try to convert bytes to python-escpos code
      try {
        const pythonCode = await convertBytesToCode(bytes);
        if (import.meta.env.DEV) {
          console.log(`Generated ${pythonCode.length} characters of Python code`);
        }

        // Update editor with generated code
        setCode(pythonCode);

        // The code will be executed automatically via the useEffect
      } catch (conversionError) {
        console.error('Conversion failed:', conversionError);

        // Fallback: Show preview of raw bytes
        const { hex, stats } = HexFormatter.formatWithStats(bytes);

        // Parse and render the ESC-POS bytes for preview
        const parser = new CommandParser();
        const renderer = new HTMLRenderer();
        const parseResult = parser.parse(bytes);
        const preview = renderer.render(parseResult.commands);

        setReceiptData({
          code: code, // Keep existing code
          escposBytes: bytes,
          preview,
          hexView: hex,
          hexStats: stats,
        });

        setError('Could not convert to code. Showing preview only.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import file';
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handlePrint = async () => {
    if (!receiptData.escposBytes) return;

    try {
      await printer.print(receiptData.escposBytes);
    } catch (err) {
      console.error('Print failed:', err);
    }
  };

  return (
    <div className="editor">
      <header className="editor-header">
        <h1>Thermal Print Preview</h1>
        <div className="header-actions">
          <button onClick={handleExport} disabled={!receiptData.escposBytes}>
            Export .bin
          </button>
          <label className="file-input-label">
            Import .bin
            <input type="file" accept=".bin" onChange={handleImport} />
          </label>
        </div>
      </header>

      {(isPyodideLoading || pyodideError) && (
        <div className="loading-overlay">
          {isPyodideLoading && <p>Loading Python environment...</p>}
          {pyodideError && <p className="error">{pyodideError}</p>}
        </div>
      )}

      <TemplateButtons templates={TEMPLATES} onTemplateClick={handleTemplateClick} />

      <div className="editor-main">
        <div className="editor-panel">
          <CodeEditor
            code={code}
            onChange={setCode}
            isExecuting={isExecuting}
            error={error}
          />

          <div className="example-buttons">
            {Object.keys(EXAMPLE_CODES).map((key) => (
              <button
                key={key}
                onClick={() => handleExampleClick(key as keyof typeof EXAMPLE_CODES)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="preview-panel">
          <ReceiptPreview preview={receiptData.preview} isLoading={isExecuting} />

          <PrinterControls
            printer={printer}
            onPrint={handlePrint}
            disabled={!receiptData.escposBytes}
          />

          <button onClick={() => setShowHex(!showHex)} className="hex-toggle">
            {showHex ? 'Hide' : 'Show'} HEX View
          </button>

          {showHex && (
            <HexView hexView={receiptData.hexView} stats={receiptData.hexStats} />
          )}
        </div>
      </div>
    </div>
  );
}
