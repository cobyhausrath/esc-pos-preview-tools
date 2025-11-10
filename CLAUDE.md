# Claude AI Assistant - Project Notes

This document contains important notes and tips for Claude when working on this project.

## Project Overview

**esc-pos-preview-tools** is a TypeScript/JavaScript library and toolkit for working with ESC-POS thermal printer commands. It includes:

1. **Core Library** (TypeScript): ESC-POS parser and renderer for web browsers
2. **Python Verification System**: Bidirectional ESC-POS ↔ python-escpos converter
3. **Web Editor**: In-browser receipt editor powered by Pyodide
4. **Demo Pages**: Interactive demonstrations

## Code Style & Conventions

### TypeScript/JavaScript
- Use modern ES6+ syntax
- Prefer `const` over `let`, avoid `var`
- Follow existing ESLint configuration (`.eslintrc.json`)
- Use Prettier for formatting (`.prettierrc.json`)
- Type safety is important - maintain TypeScript types

### Python
- Follow PEP 8 style guidelines
- Use type hints for all function signatures
- Use docstrings for all public functions and classes
- Prefer descriptive variable names over abbreviations
- Use constants instead of magic numbers

### Testing
- TypeScript tests use Vitest (see `vitest.config.ts`)
- Python tests use pytest (see `python/test_escpos_verifier.py`)
- Always run tests before committing: `npm test` or `pytest`

## Important File Locations

### Core Library
- `src/` - TypeScript source code
- `test/` - TypeScript tests
- `demo/` - Demo HTML pages
- `samples/` - Sample ESC-POS files for testing

### Python System
- `python/escpos_verifier.py` - Main verification tool
- `python/escpos_constants.py` - ESC-POS command constants
- `python/escpos_cli.py` - Command-line interface
- `python/test_escpos_verifier.py` - Test suite

### Web Editor
- `web/editor.html` - In-browser Pyodide-powered editor
- `web/test-editor.html` - Test page for editor

### Documentation
- `docs/` - Technical documentation
- `README.md` - Main project README
- `README.dev.md` - Developer documentation
- `CONTRIBUTING.md` - Contribution guidelines
- `PLANNING.md` - Project planning and roadmap

## Security Considerations

### Python Code Execution
The Python verification system uses `exec()` to execute user-provided python-escpos code. This is a potential security risk:

1. **Always use validation**: The `validate_python_code()` method provides basic AST-based security checks
2. **Default to safe**: The `validate` parameter in `execute_python_code()` defaults to `True`
3. **Document warnings**: Always document security warnings in public-facing APIs
4. **Limit imports**: Only allow `escpos` module imports in validated code

### Web Editor
The browser editor executes Python code in a Pyodide sandbox:

1. **Use JSON.stringify**: Always use `JSON.stringify()` for escaping code, never manual string replacement
2. **Trust the sandbox**: Pyodide runs in a WASM sandbox, providing isolation
3. **Validate inputs**: Check file sizes and types before processing

## Common Tasks

### Running Tests
```bash
# TypeScript tests
npm test

# Python tests (install pytest first)
cd python
pytest test_escpos_verifier.py -v
```

### Building
```bash
# Install dependencies
npm install

# Build library
npm run build

# Development mode with watch
npm run dev
```

### Adding New ESC-POS Commands

When adding support for new ESC-POS commands:

1. **Add constant** to `python/escpos_constants.py`
2. **Add parser logic** to `python/escpos_verifier.py` in `_parse_esc_sequence()` or `_parse_gs_sequence()`
3. **Add test case** to `python/test_escpos_verifier.py`
4. **Update TypeScript parser** in `src/` if needed
5. **Add demo** showing the new command in `demo/`

### Debugging Tips

1. **Python logging**: Use the logger parameter when creating `EscPosVerifier` instances
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   verifier = EscPosVerifier()
   ```

2. **Check warnings**: Always check `verifier.warnings` after parsing to catch unknown bytes

3. **Hex dumps**: Use hex dumps to debug binary ESC-POS data
   ```python
   print(' '.join(f'{b:02X}' for b in escpos_bytes))
   ```

4. **Browser console**: Check browser console for JavaScript errors in web editor

## Git Workflow

### Branch Naming
- Feature branches: `claude/feature-name-<session-id>`
- Bug fixes: `claude/fix-issue-name-<session-id>`
- Always include the session ID at the end

### Commit Messages
- Use conventional commits format: `type: description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Be descriptive but concise
- Examples:
  - `feat: add support for GS k barcode command`
  - `fix: correct underline parsing in ESC - command`
  - `docs: update README with CLI usage examples`

### Before Committing
1. Run tests: `npm test` and `pytest`
2. Check for linting errors: `npm run lint` (if available)
3. Review changes: `git diff`
4. Stage related changes together
5. Write clear commit messages

## Common Pitfalls

### 1. Import Paths in Python
- Python files in the `python/` directory import from each other directly
- Don't use relative imports like `from .escpos_verifier import ...`
- Use: `from escpos_verifier import EscPosVerifier`

### 2. Constants vs Magic Numbers
- **Always use constants** from `escpos_constants.py` instead of raw hex values
- Bad: `if byte == 0x1B:`
- Good: `if byte == ESC:`

### 3. Web Editor Code Escaping
- **Never** use string replacement for escaping Python code in JavaScript
- Bad: `code.replace(/\\/g, '\\\\').replace(/"/g, '\\"')`
- Good: `JSON.stringify(code)`

### 4. Test Coverage
- Always add tests for new features
- Test both success and error cases
- Include edge cases (empty input, truncated sequences, etc.)

### 5. Logging vs Warnings
- Use `logger.debug()` for verbose information
- Use `logger.warning()` for issues that don't stop execution
- Use `logger.error()` for failures
- Always append to `self.warnings` list for user-facing warnings

### 6. Network Printing Architecture
- **Browser → Bridge → Printer** flow for web printing
- CLI tools (bin/) are Node.js, not TypeScript (for simplicity)
- WebSocket bridge binds to 127.0.0.1 only (security)
- Never expose bridge server to internet/untrusted networks
- Printer configurations in both JS (bin/) and TS (src/devices/printers.ts)

### 7. HEX View Display
- Always use HexFormatter class for binary data display
- Format: offset (8 hex) + 16 bytes + ASCII representation
- Statistics show ESC/GS command counts for debugging
- HEX view is collapsible to save screen space

## Architecture: Python vs TypeScript Boundaries

**IMPORTANT**: Clear separation of responsibilities (added 2025-11-10)

### Python (Pyodide in Browser)
**Responsibility**: Execute python-escpos code ONLY
- ✅ Running python-escpos library to generate ESC-POS bytes
- ✅ AST-based validation of user code
- ❌ **NOT** ESC-POS parsing (use TypeScript parser)
- ❌ **NOT** UI rendering (use TypeScript/HTML)
- ❌ **NOT** I/O operations (use TypeScript/Node.js)

**Rationale**: Pyodide has overhead. Use only when python-escpos library is required.

### TypeScript/JavaScript
**Responsibility**: Everything else
- ✅ ESC-POS command parsing (src/parser/CommandParser.ts)
- ✅ HTML receipt rendering (src/renderer/HTMLRenderer.ts)
- ✅ HEX view formatting (web/editor.html HexFormatter class)
- ✅ Network I/O - socket communication (bin/escpos-send.js, bin/printer-bridge.js)
- ✅ UI interactions, state management, file operations
- ✅ Browser editor application logic

**Rationale**: TypeScript is faster, type-safe, better for UI/I/O. Use existing parser.

### CLI Tools (Node.js)
**Location**: `bin/` directory

**Tools**:
1. **escpos-send.js** - Send .bin files to TCP sockets (nc replacement)
2. **printer-bridge.js** - WebSocket to TCP bridge for browser printing

**Responsibilities**:
- ✅ Network communication (TCP sockets, WebSocket)
- ✅ CLI argument parsing and validation
- ✅ File I/O and stdin piping
- ✅ Printer configuration management

**Why Node.js and not TypeScript?**
- Simpler deployment (no build step for CLI tools)
- Direct access to Node.js networking APIs
- Self-contained executables via shebang
- Users can modify without recompiling

## PR Review Checklist

Before submitting a PR, verify:

- [ ] All tests pass (`npm test`, `pytest`)
- [ ] No linting errors
- [ ] New features have tests
- [ ] Documentation is updated
- [ ] Constants are used instead of magic numbers
- [ ] Type hints are complete
- [ ] Security considerations are addressed
- [ ] No console.log() or debug print() statements left in code
- [ ] Commit messages are clear and descriptive

## Dependencies

### TypeScript/JavaScript
- Core: TypeScript, tsup (bundler)
- Testing: Vitest
- Quality: ESLint, Prettier

### Python
- Core: python-escpos
- Testing: pytest
- Optional: mypy (for type checking)

### Web Editor
- Pyodide: Python runtime in browser
- Loaded from CDN: https://cdn.jsdelivr.net/pyodide/v0.24.1/

## Performance Notes

### Python Verification
- Parsing is O(n) where n is byte length
- Keep input size under 1MB (enforced by MAX_INPUT_SIZE constant)
- Semantic verification requires two parse passes

### Web Editor
- Initial load: 3-7 seconds (Pyodide + python-escpos download)
- Code execution: typically < 100ms for small receipts
- Debounce: 500ms prevents excessive re-rendering

## Future Improvements

Ideas for future work (see `docs/PROJECT_EVALUATION.md` for more):

1. Syntax highlighting in web editor (CodeMirror or Monaco)
2. Service worker caching for Pyodide
3. More comprehensive AST validation
4. Support for more ESC-POS commands
5. Barcode and QR code support
6. Image printing support
7. Direct USB printer support

## Resources

- ESC-POS Command Reference: Search for "ESC/POS Command Reference" online
- python-escpos docs: https://python-escpos.readthedocs.io/
- Pyodide docs: https://pyodide.org/
- Project GitHub: https://github.com/[owner]/esc-pos-preview-tools

## Notes for Claude

### When Working on This Project

1. **Read existing tests first** - They show expected behavior
2. **Check constants file** - Many values are already defined
3. **Follow existing patterns** - Be consistent with current code style
4. **Test thoroughly** - Add tests for all new features
5. **Document changes** - Update relevant docs
6. **Security first** - Always consider security implications of code execution
7. **Ask before breaking changes** - Confirm with user before major refactors

### This PR Review Context

The PR under review adds a Python verification system with these features:
- Bidirectional ESC-POS ↔ python-escpos conversion
- In-browser editor with Pyodide
- Comprehensive test coverage
- CLI tool for command-line usage

Main concerns addressed:
1. ✅ Security: Added AST validation for code execution
2. ✅ Code injection: Fixed web editor escaping
3. ✅ Error handling: Added warnings for unknown bytes
4. ✅ Code quality: Created constants file
5. ✅ Input validation: Added type checking and size limits
6. ✅ Logging: Added logging throughout
7. ✅ CLI: Created command-line tool
8. ✅ Documentation: Comprehensive docs included

---

*Last updated: 2025-11-09*
*Claude Session: address-pr-feedback-escpos-011CUy8jmeFvEggeaJSxNSxu*
