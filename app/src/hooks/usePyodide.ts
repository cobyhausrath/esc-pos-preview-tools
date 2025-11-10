import { useState, useEffect, useCallback, useRef } from 'react';
import type { PyodideInterface } from '@/types';

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

export function usePyodide() {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(false);

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
        allowed_import_prefixes = ['escpos']
        allowed_stdlib_imports = ['io', 'sys', 'typing', 'dataclasses', 'logging', 'ast']

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
          throw new Error('Code validation failed: Dangerous operations detected');
        }

        // Execute the code with timeout
        await Promise.race([
          pyodide.runPythonAsync(`
from escpos.printer import Dummy

# Create a dummy printer
p = Dummy()

# Execute user code
${code}

# Get the output
output = p.output
          `),
          timeoutPromise,
        ]);

        // Get the output bytes
        const output = pyodide.globals.get('output') as Uint8Array;
        return output;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to execute code';
        throw new Error(errorMessage);
      }
    },
    [pyodide]
  );

  return {
    pyodide,
    isLoading,
    error,
    runCode,
  };
}
