import { useState, useEffect, useCallback, useRef } from 'react';
import type { PyodideInterface } from '@/types';

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

export interface PyodideSettings {
  printerProfile?: string;
  imageImplementation?: 'bitImageColumn' | 'bitImageRaster' | 'graphics';
}

export function usePyodide(settings?: PyodideSettings) {
  const printerProfile = settings?.printerProfile || 'NT-80-V-UL';
  const imageImplementation = settings?.imageImplementation || 'bitImageRaster';
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(false);
  const pillowInstalledRef = useRef(false);

  useEffect(() => {
    const initPyodide = async () => {
      if (initializingRef.current) return;
      initializingRef.current = true;

      try {
        setIsLoading(true);
        setError(null);

        // Load Pyodide script if not already loaded
        if (!window.loadPyodide) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
          script.async = true;

          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Pyodide script'));
            document.head.appendChild(script);
          });
        }

        // Initialize Pyodide
        const pyodideInstance = await window.loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
        });

        // Load micropip
        await pyodideInstance.loadPackage('micropip');

        // Install python-escpos
        await pyodideInstance.runPythonAsync(`
          import micropip
          await micropip.install('python-escpos')
        `);

        // Load ESC-POS verifier for bin-to-code conversion
        try {
          const constantsResponse = await fetch('/python/escpos_constants.py');
          if (constantsResponse.ok) {
            const constantsCode = await constantsResponse.text();
            await pyodideInstance.runPythonAsync(constantsCode);

            const verifierResponse = await fetch('/python/escpos_verifier.py');
            if (verifierResponse.ok) {
              const verifierCode = await verifierResponse.text();
              await pyodideInstance.runPythonAsync(verifierCode);

              // Test that verifier is available
              await pyodideInstance.runPythonAsync(`
from escpos_verifier import EscPosVerifier
_test = EscPosVerifier()
del _test
              `);

              if (import.meta.env.DEV) {
                console.log('ESC-POS verifier loaded successfully');
              }
            }
          }
        } catch (err) {
          console.warn('Verifier not available:', err);
          // Continue without verifier - import will show preview only
        }

        setPyodide(pyodideInstance);
        setIsLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Pyodide';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initPyodide();
  }, []);

  const runCode = useCallback(
    async (code: string): Promise<Uint8Array> => {
      if (!pyodide) {
        throw new Error('Pyodide is not initialized');
      }

      // Create timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Code execution timeout (10s limit)')), 10000);
      });

      try {
        // Validate code (basic AST check) with timeout
        const validationResult = await Promise.race([
          pyodide.runPythonAsync(`
import ast

def validate_code(code_str):
    try:
        tree = ast.parse(code_str)

        # Allowed imports
        allowed_import_prefixes = ['escpos', 'PIL']
        allowed_stdlib_imports = ['io', 'sys', 'typing', 'dataclasses', 'logging', 'ast', 'base64']

        # Check for dangerous operations
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    is_allowed = (
                        alias.name in allowed_stdlib_imports or
                        any(alias.name.startswith(prefix) for prefix in allowed_import_prefixes)
                    )
                    if not is_allowed:
                        return False
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    is_allowed = (
                        node.module in allowed_stdlib_imports or
                        any(node.module.startswith(prefix) for prefix in allowed_import_prefixes)
                    )
                    if not is_allowed:
                        return False
            # Block dangerous function calls
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in ['open', 'exec', 'eval', 'compile', '__import__']:
                        return False
        return True
    except Exception:
        return False

validate_code(${JSON.stringify(code)})
          `),
          timeoutPromise,
        ]);

        if (!validationResult) {
          // Log the code that failed validation for debugging
          if (import.meta.env.DEV) {
            console.error('Code validation failed for:', code);
          }
          throw new Error('Code validation failed: Dangerous operations detected. Check that only allowed imports (escpos, PIL, io, base64) are used.');
        }

        // Execute the code with timeout
        await Promise.race([
          pyodide.runPythonAsync(`
from escpos.printer import Dummy

# Create a dummy printer configured for ${printerProfile}
p = Dummy(profile='${printerProfile}')

# Execute user code
${code}

# Get the output
output = p.output
          `),
          timeoutPromise,
        ]);

        // Get the output bytes and convert from Python bytes to Uint8Array
        const outputPy = pyodide.globals.get('output') as any;

        // Convert Python bytes object to JavaScript Uint8Array
        const outputList = outputPy.toJs() as number[];
        const output = new Uint8Array(outputList);

        return output;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to execute code';
        throw new Error(errorMessage);
      }
    },
    [pyodide]
  );

  const convertBytesToCode = useCallback(
    async (bytes: Uint8Array): Promise<string> => {
      if (!pyodide) {
        throw new Error('Pyodide is not initialized');
      }

      try {
        const bytesArray = Array.from(bytes);

        const pythonCode = await pyodide.runPythonAsync(`
from escpos_verifier import EscPosVerifier
import logging

# Disable logging to keep console clean
logging.getLogger('escpos_verifier').setLevel(logging.ERROR)

# Create verifier instance
verifier = EscPosVerifier()

# Convert bytes to python-escpos code
escpos_bytes = bytes([${bytesArray.join(', ')}])
python_code = verifier.bytes_to_python_escpos(escpos_bytes)

# Clean up the generated code for editor display
# Remove the escpos_output line at the end (not needed for user editing)
lines = python_code.split('\\n')

# Find where to cut off (before "# Get the generated ESC-POS bytes")
cutoff = len(lines)
for i, line in enumerate(lines):
    if '# Get the generated ESC-POS bytes' in line or line.strip() == '':
        cutoff = i
        break

# Join relevant lines and clean up
python_code = '\\n'.join(lines[:cutoff]).strip()

# Return the cleaned code
python_code
        `);

        return pythonCode as string;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to convert bytes to code';
        throw new Error(errorMessage);
      }
    },
    [pyodide]
  );

  const generateImageCode = useCallback(
    async (imageData: ImageData, width: number, height: number): Promise<string> => {
      if (!pyodide) {
        throw new Error('Pyodide is not initialized');
      }

      // Validate reasonable size (security/performance)
      const pixelCount = width * height;
      const MAX_PIXELS = 384 * 1000; // ~1000 pixels tall for 384px wide

      if (pixelCount > MAX_PIXELS) {
        console.warn(`[Image] Image too large: ${width}x${height} (${pixelCount} pixels)`);
        return `from escpos.printer import Dummy

# Create printer configured for ${printerProfile}
p = Dummy(profile='${printerProfile}')

# Image too large
p.set(align='center')
p.text('IMAGE TOO LARGE\\n')
p.text('${width}x${height} pixels\\n')
p.text('Maximum: ${MAX_PIXELS} pixels\\n')
p.text('\\n')
p.set(align='left')
`;
      }

      try {
        // Ensure Pillow is installed (lazy loading for performance)
        if (!pillowInstalledRef.current) {
          if (import.meta.env.DEV) {
            console.log('[Image] Installing Pillow for image support...');
          }
          await pyodide.runPythonAsync(`
import micropip
await micropip.install('Pillow')
          `);
          pillowInstalledRef.current = true;
          if (import.meta.env.DEV) {
            console.log('[Image] Pillow installed successfully');
          }
        }

        // Convert ImageData to PNG blob
        const blob = await imageDataToBlob(imageData, width, height);

        // Check blob size (base64 is ~1.33x, limit to 1MB base64 = ~750KB image)
        const MAX_BLOB_SIZE = 750000; // 750KB
        if (blob.size > MAX_BLOB_SIZE) {
          const sizeKB = Math.round(blob.size / 1024);
          console.warn(`[Image] Image file too large: ${sizeKB}KB`);
          return `from escpos.printer import Dummy

# Create printer configured for ${printerProfile}
p = Dummy(profile='${printerProfile}')

# Image file too large
p.set(align='center')
p.text('IMAGE FILE TOO LARGE\\n')
p.text('${sizeKB}KB (max ${Math.round(MAX_BLOB_SIZE / 1024)}KB)\\n')
p.text('\\n')
p.set(align='left')
`;
        }

        // Convert blob to base64
        const base64 = await blobToBase64(blob);

        if (import.meta.env.DEV) {
          console.log(`[Image] Generated ${base64.length} bytes of base64 data for ${width}x${height} image`);
        }

        // Generate python-escpos code with embedded image
        const code = `from escpos.printer import Dummy
from PIL import Image
import io
import base64

# Create printer configured for ${printerProfile}
p = Dummy(profile='${printerProfile}')

try:
    # Decode embedded image (${width}x${height} dithered)
    img_data = base64.b64decode('''${base64}''')
    img = Image.open(io.BytesIO(img_data))

    # Center alignment for image
    p.set(align='center')

    # Print image using ${imageImplementation} implementation
    p.image(img, impl='${imageImplementation}')

except Exception as e:
    # Image processing error
    p.text(f'Image error: {e}\\n')

finally:
    # Add spacing and reset alignment
    p.text('\\n')
    p.set(align='left')
`;

        return code;
      } catch (err) {
        console.error('[Image] Failed to generate code:', err);

        // Fallback to placeholder if conversion fails
        return `from escpos.printer import Dummy

# Create printer configured for ${printerProfile}
p = Dummy(profile='${printerProfile}')

# Image encoding failed
p.set(align='center')
p.text('IMAGE (${width}x${height})\\n')
p.text('Failed to encode image\\n')
p.text('\\n')
p.set(align='left')
`;
      }
    },
    [pyodide, printerProfile, imageImplementation]
  );

  return {
    pyodide,
    isLoading,
    error,
    runCode,
    convertBytesToCode,
    generateImageCode,
  };
}

/**
 * Convert ImageData to PNG blob for embedding in Python code
 */
function imageDataToBlob(imageData: ImageData, width: number, height: number): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        throw new Error('Failed to create blob from canvas');
      }
    }, 'image/png');
  });
}

/**
 * Encode PNG blob to base64 string for embedding in Python code
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Extract base64 data (remove "data:image/png;base64," prefix)
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to read blob as data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}
