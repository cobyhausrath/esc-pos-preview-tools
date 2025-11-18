import { useState, useEffect, useCallback } from 'react';
import { usePyodide } from '@/hooks/usePyodide';
import { usePrinterClient } from '@/hooks/usePrinterClient';
import { useSettings } from '@/hooks/useSettings';
import { HexFormatter } from '@/utils/hexFormatter';
import { generateTemplate, TEMPLATES, EXAMPLE_CODES } from '@/utils/templates';
import { CommandParser, HTMLRenderer } from 'esc-pos-preview-tools';
import { CodeModifier } from '@/utils/codeModifier';
import { processImageForPrinting } from '@/utils/dithering';
import { replaceBase64Image, detectBase64Images, type ImageMatch } from '@/utils/imageParser';
import { cacheOriginalImage, getCachedImage } from '@/utils/imageCache';
import CodeEditor from '@/components/CodeEditor';
import ReceiptPreview from '@/components/ReceiptPreview';
import HexView from '@/components/HexView';
import PrinterControls from '@/components/PrinterControls';
import TemplateButtons from '@/components/TemplateButtons';
import ImageOptionsModal from '@/components/ImageOptionsModal';
import type { TemplateType, ReceiptData } from '@/types';
import type { DitheringAlgorithm } from '@/components/ImageOptionsModal';

const DEFAULT_CODE = EXAMPLE_CODES.basic;
const CODE_EXECUTION_DEBOUNCE_MS = 500; // Debounce delay for auto-executing code on change

export default function Editor() {
  const { settings, updateSettings } = useSettings();
  const { pyodide, isLoading: isPyodideLoading, error: pyodideError, runCode, convertBytesToCode, generateImageCode } = usePyodide(settings);
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
  const [selectedImage, setSelectedImage] = useState<ImageMatch | null>(null);

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

  // Keep selectedImage in sync when code changes (for redithering)
  useEffect(() => {
    if (selectedImage) {
      // Re-detect images in the updated code
      const detectedImages = detectBase64Images(code);

      // Find matching image by position (within a small range)
      // Base64 matching doesn't work after dithering since the data changes
      const matchingImage = detectedImages.find(
        img =>
          img.startIndex >= selectedImage.startIndex - 10 &&
          img.startIndex <= selectedImage.startIndex + 10
      );

      if (matchingImage && matchingImage.id !== selectedImage.id) {
        // Update to the new match with updated position/ID
        setSelectedImage(matchingImage);
      }
    }
  }, [code, selectedImage]);

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
    }, CODE_EXECUTION_DEBOUNCE_MS);

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
      // Send raw bytes from python-escpos - it already includes correct line spacing
      await printer.print(receiptData.escposBytes);
    } catch (err) {
      console.error('Print failed:', err);
    }
  };

  /**
   * Handle image badge click - open options modal
   */
  const handleImageClick = useCallback((image: ImageMatch) => {
    setSelectedImage(image);
  }, []);

  /**
   * Handle updating image with new file
   */
  const handleUpdateImage = useCallback(async (
    image: ImageMatch,
    file: File,
    dithering: DitheringAlgorithm
  ) => {
    try {
      setIsExecuting(true);
      setError(null);

      if (import.meta.env.DEV) {
        console.log('[Image] Processing replacement:', file.name, file.type, dithering);
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

      // Process image with selected dithering algorithm
      const processedData = await processImageForPrinting(img, 384, dithering);

      if (import.meta.env.DEV) {
        console.log(`[Image] Image processed: ${processedData.width}x${processedData.height}`);
      }

      // Cache the original image for future dithering changes
      // Convert ImageData to PNG base64
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                const base64 = reader.result.split(',')[1];
                cacheOriginalImage(image.id, base64, img.width, img.height);
                if (import.meta.env.DEV) {
                  console.log('[Image] Cached original image');
                }
              }
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/png');
      }

      // Generate new base64 code for the image
      const imageCode = await generateImageCode(processedData, processedData.width, processedData.height);

      // Extract just the base64 data from the generated code
      const base64Match = imageCode.match(/base64\.b64decode\('''([^']+)'''\)/);
      if (!base64Match) {
        throw new Error('Failed to extract base64 data from generated code');
      }

      const newBase64 = base64Match[1];

      // Replace the image in the existing code
      const newCode = replaceBase64Image(
        code,
        image,
        newBase64,
        processedData.width,
        processedData.height,
        image.implementation // Keep existing implementation
      );

      setCode(newCode);
      URL.revokeObjectURL(imageUrl);

      // Immediately update selectedImage with fresh position data
      // (base64 changed, so we can't match by prefix anymore)
      const detectedImages = detectBase64Images(newCode);
      const freshImage = detectedImages.find(img =>
        img.startIndex >= image.startIndex - 10 &&
        img.startIndex <= image.startIndex + 10
      );
      if (freshImage) {
        setSelectedImage(freshImage);
      }

      if (import.meta.env.DEV) {
        console.log('[Image] Image replacement complete');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process image';
      console.error('[Image] Replacement failed:', err);
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [code, generateImageCode]);

  /**
   * Handle redithering image from cached original
   */
  const handleRedither = useCallback(async (
    image: ImageMatch,
    dithering: DitheringAlgorithm
  ) => {
    try {
      setIsExecuting(true);
      setError(null);

      if (import.meta.env.DEV) {
        console.log('[Image] Redithering from cache:', dithering);
      }

      // Get cached original image
      const cached = getCachedImage(image.id);
      if (!cached) {
        console.warn('[Image] No cached image found for:', image.id);
        return;
      }

      // Convert cached base64 to image
      const img = new Image();
      const dataUrl = `data:image/png;base64,${cached.base64}`;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load cached image'));
        img.src = dataUrl;
      });

      // Process with new dithering algorithm
      const processedData = await processImageForPrinting(img, 384, dithering);

      if (import.meta.env.DEV) {
        console.log(`[Image] Redithered: ${processedData.width}x${processedData.height}`);
      }

      // Generate new base64 code
      const imageCode = await generateImageCode(processedData, processedData.width, processedData.height);

      // Extract base64 data
      const base64Match = imageCode.match(/base64\.b64decode\('''([^']+)'''\)/);
      if (!base64Match) {
        throw new Error('Failed to extract base64 data from generated code');
      }

      const newBase64 = base64Match[1];

      // Replace the image in the existing code
      const newCode = replaceBase64Image(
        code,
        image,
        newBase64,
        processedData.width,
        processedData.height,
        image.implementation // Keep existing implementation
      );

      setCode(newCode);

      // Immediately update selectedImage with fresh position data
      // (base64 changed after dithering, so positions and IDs are different)
      const detectedImages = detectBase64Images(newCode);
      const freshImage = detectedImages.find(img =>
        img.startIndex >= image.startIndex - 10 &&
        img.startIndex <= image.startIndex + 10
      );
      if (freshImage) {
        setSelectedImage(freshImage);
      }

      if (import.meta.env.DEV) {
        console.log('[Image] Redithering complete');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to redither image';
      console.error('[Image] Redithering failed:', err);
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [code, generateImageCode]);

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
            onImageClick={handleImageClick}
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
            settings={settings}
            onUpdateSettings={updateSettings}
          />

          <button onClick={() => setShowHex(!showHex)} className="hex-toggle">
            {showHex ? 'Hide' : 'Show'} HEX View
          </button>

          {showHex && (
            <HexView hexView={receiptData.hexView} stats={receiptData.hexStats} />
          )}
        </div>
      </div>

      {/* Image Options Modal */}
      {selectedImage && (
        <ImageOptionsModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onUpdateImage={handleUpdateImage}
          onRedither={handleRedither}
        />
      )}
    </div>
  );
}
