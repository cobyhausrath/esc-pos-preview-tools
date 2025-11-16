import { useState, useEffect, useCallback } from 'react';
import { usePyodide } from '@/hooks/usePyodide';
import { usePrinterClient } from '@/hooks/usePrinterClient';
import { HexFormatter } from '@/utils/hexFormatter';
import { generateTemplate, TEMPLATES, EXAMPLE_CODES } from '@/utils/templates';
import { CommandParser, HTMLRenderer } from 'esc-pos-preview-tools';
import { CodeModifier } from '@/utils/codeModifier';
import CodeEditor from '@/components/CodeEditor';
import ReceiptPreview from '@/components/ReceiptPreview';
import HexView from '@/components/HexView';
import PrinterControls from '@/components/PrinterControls';
import TemplateButtons from '@/components/TemplateButtons';
import type { TemplateType, ReceiptData } from '@/types';

const DEFAULT_CODE = EXAMPLE_CODES.basic;

export default function Editor() {
  const { pyodide, isLoading: isPyodideLoading, error: pyodideError, runCode, convertBytesToCode, generateImageCode } = usePyodide();
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

  /**
   * Fix image line spacing to prevent gaps between strips
   *
   * The issue: Default line spacing (1/6" or 30 dots at 180dpi) is larger than
   * the 24-dot image strip height, causing gaps.
   *
   * Solution: Set line spacing to exactly match strip height using ESC 3 n
   * where n/180 inch = strip height. For 24-dot mode at 203.2 dpi:
   * 24 dots / 203.2 dpi = 0.118" → 0.118 * 180 = 21 (ESC 3 21)
   */
  const fixImageLineSpacing = (bytes: Uint8Array): Uint8Array => {
    const result: number[] = [];
    let i = 0;
    let inImageSequence = false;

    while (i < bytes.length) {
      const byte = bytes[i];

      // Check for ESC * (bit image) command
      if (byte === 0x1b && i + 1 < bytes.length && bytes[i + 1] === 0x2a) {
        if (i + 4 < bytes.length) {
          const mode = bytes[i + 2];
          const nL = bytes[i + 3];
          const nH = bytes[i + 4];
          const widthInPixels = nL + (nH * 256);

          // Determine bytes per column based on mode
          let dotsPerColumn = 8;
          if (mode === 0 || mode === 1) dotsPerColumn = 8;
          else if (mode === 32 || mode === 33) dotsPerColumn = 24;

          const bytesPerColumn = dotsPerColumn / 8;
          const totalDataBytes = widthInPixels * bytesPerColumn;
          const totalSize = 5 + totalDataBytes;

          // Insert line spacing command before first image in sequence
          if (!inImageSequence && dotsPerColumn === 24) {
            // ESC 3 16 - matches what python-escpos uses for 24-dot images
            result.push(0x1b, 0x33, 16);
            inImageSequence = true;
            if (import.meta.env.DEV) {
              console.log('[Print] Setting line spacing to 16/180" for 24-dot images (python-escpos default)');
            }
          }

          // Copy the entire ESC * command
          for (let j = 0; j < totalSize && i < bytes.length; j++) {
            result.push(bytes[i++]);
          }

          continue;
        }
      }

      // If we were in an image sequence and hit a non-image/non-LF byte, reset spacing
      if (inImageSequence && byte !== 0x0a && !(byte === 0x1b && i + 1 < bytes.length && bytes[i + 1] === 0x2a)) {
        result.push(0x1b, 0x32); // ESC 2 - reset to default spacing
        inImageSequence = false;
        if (import.meta.env.DEV) {
          console.log('[Print] Resetting line spacing to default');
        }
      }

      result.push(byte);
      i++;
    }

    // Reset at end if still in sequence
    if (inImageSequence) {
      result.push(0x1b, 0x32);
    }

    return new Uint8Array(result);
  };

  const handlePrint = async () => {
    if (!receiptData.escposBytes) return;

    try {
      // Send raw bytes from python-escpos - it already includes correct line spacing
      await printer.print(receiptData.escposBytes);
    } catch (err) {
      console.error('Print failed:', err);
    }
  };

  /**
   * Process image for thermal printing with Floyd-Steinberg dithering
   */
  const processImageForPrinting = async (img: HTMLImageElement, maxWidth = 384): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      try {
        // Create canvas for image processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.floor((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Convert to grayscale and apply Floyd-Steinberg dithering
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;

            // Convert to grayscale
            const gray = Math.floor(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);

            // Threshold and calculate error
            const newVal = gray < 128 ? 0 : 255;
            const error = gray - newVal;

            // Set pixel
            data[idx] = data[idx + 1] = data[idx + 2] = newVal;

            // Distribute error (Floyd-Steinberg)
            if (x + 1 < width) {
              const nextIdx = (y * width + x + 1) * 4;
              data[nextIdx] += (error * 7) / 16;
              data[nextIdx + 1] += (error * 7) / 16;
              data[nextIdx + 2] += (error * 7) / 16;
            }

            if (y + 1 < height) {
              if (x > 0) {
                const diagIdx = ((y + 1) * width + x - 1) * 4;
                data[diagIdx] += (error * 3) / 16;
                data[diagIdx + 1] += (error * 3) / 16;
                data[diagIdx + 2] += (error * 3) / 16;
              }

              const belowIdx = ((y + 1) * width + x) * 4;
              data[belowIdx] += (error * 5) / 16;
              data[belowIdx + 1] += (error * 5) / 16;
              data[belowIdx + 2] += (error * 5) / 16;

              if (x + 1 < width) {
                const diagIdx = ((y + 1) * width + x + 1) * 4;
                data[diagIdx] += (error * 1) / 16;
                data[diagIdx + 1] += (error * 1) / 16;
                data[diagIdx + 2] += (error * 1) / 16;
              }
            }
          }
        }

        resolve(imageData);
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsExecuting(true);
      setError(null);

      if (import.meta.env.DEV) {
        console.log('[Image] Processing file:', file.name, file.type, `${Math.round(file.size / 1024)}KB`);
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Create image from file
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      if (import.meta.env.DEV) {
        console.log(`[Image] Image loaded: ${img.width}x${img.height}`);
      }

      // Process image with dithering
      const processedData = await processImageForPrinting(img);

      if (import.meta.env.DEV) {
        console.log(`[Image] Image processed with dithering: ${processedData.width}x${processedData.height}`);
      }

      // Generate python-escpos code for the image
      const imageCode = await generateImageCode(processedData, processedData.width, processedData.height);
      setCode(imageCode);

      URL.revokeObjectURL(imageUrl);

      if (import.meta.env.DEV) {
        console.log('[Image] Code generation complete, updating editor');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process image';
      console.error('[Image] Upload failed:', err);
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Handle context menu actions
  const handleContextMenuAction = useCallback((lineNumber: number, setCommand: string) => {
    const modifier = new CodeModifier(code);
    const codeLineNumber = modifier.findCodeLineForPreviewLine(lineNumber);

    if (codeLineNumber === -1) {
      console.error('Could not find code line for preview line', lineNumber);
      return;
    }

    // Extract attribute and value from setCommand (e.g., "p.set(bold=True)")
    const match = setCommand.match(/p\.set\((\w+)=(.+)\)/);
    if (!match) {
      console.error('Invalid set command:', setCommand);
      return;
    }

    const [, attribute, valueStr] = match;
    let value: string | boolean | number;

    // Parse value
    if (valueStr === 'True') value = true;
    else if (valueStr === 'False') value = false;
    else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
      value = valueStr.slice(1, -1); // Remove quotes
    } else {
      value = parseInt(valueStr, 10);
    }

    modifier.insertSetCall(codeLineNumber, attribute, value);
    const newCode = modifier.getModifiedCode();
    setCode(newCode);
  }, [code]);

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
          <label className="file-input-label">
            Upload Image
            <input type="file" accept="image/*" onChange={handleImageUpload} />
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
          <ReceiptPreview
            escposBytes={receiptData.escposBytes}
            isLoading={isExecuting}
            onContextMenuAction={handleContextMenuAction}
          />

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
