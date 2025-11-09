# Development Guide

## Testing & Feedback Loop

This project has a comprehensive testing and feedback system to enable rapid iteration.

### Quick Start

```bash
# Install dependencies
yarn install

# Run the full feedback loop (build + test + preview)
yarn feedback
```

This will:
1. Build the TypeScript code
2. Run all tests
3. Generate HTML previews from test fixtures
4. Output results to `test-output/`

### Individual Commands

```bash
# Build the project
yarn build

# Run tests (watch mode)
yarn test

# Run tests once
yarn test:run

# Run tests with coverage
yarn test:coverage

# Generate HTML previews only
yarn preview

# Type checking
yarn typecheck

# Lint code
yarn lint
yarn lint:fix

# Format code
yarn format
```

### Visual Feedback

After running `yarn feedback` or `yarn preview`, open `test-output/index.html` in your browser to see:

- All generated receipt previews
- Visual representation of ESC/POS commands
- Side-by-side comparison of different formats

This is the primary feedback mechanism for development - you can:
1. Modify the parser or renderer
2. Run `yarn feedback`
3. Check the HTML output to see the results

### Adding Test Fixtures

Add new ESC/POS test data in `test/fixtures/`:

```typescript
// test/fixtures/my-receipt.ts
export const myReceipt = Buffer.from([
  0x1B, 0x40,  // Initialize
  ...Buffer.from('Hello'),
  0x0A,  // Line feed
]);
```

Then add it to `test/fixtures/index.ts` and `scripts/generate-previews.ts`.

### Test Structure

```
test/
├── fixtures/           # ESC/POS command sequences for testing
│   ├── simple-receipt.ts
│   ├── formatted-text.ts
│   └── index.ts
└── ...

src/
├── parser/
│   ├── CommandParser.ts
│   ├── CommandParser.test.ts  # Unit tests
│   └── types.ts
├── renderer/
│   ├── HTMLRenderer.ts
│   ├── HTMLRenderer.test.ts   # Unit tests
│   └── ...
└── index.ts

scripts/
├── generate-previews.ts  # Visual feedback generator
└── dev-feedback.sh       # Complete feedback loop
```

### Testing Philosophy

1. **Unit Tests**: Test each component in isolation
   - Parser tests verify command parsing
   - Renderer tests verify HTML output structure

2. **Visual Tests**: Generate actual HTML to verify appearance
   - Run `yarn preview` to generate
   - Open in browser to visually inspect
   - Add snapshots for regression testing

3. **Integration Tests**: Coming soon - full proxy workflow tests

### Development Workflow

Recommended workflow for implementing features:

1. **Write a test fixture** in `test/fixtures/` with the ESC/POS commands you want to support
2. **Run `yarn feedback`** to see current output (it will likely be wrong)
3. **Update the parser/renderer** to handle the new commands
4. **Run `yarn feedback` again** to verify the fix
5. **Check the visual output** in `test-output/index.html`
6. **Commit** when everything looks good

### Debugging Tips

- Check `test-output/*.html` files directly to see rendered output
- Use `yarn test --reporter=verbose` for detailed test output
- Add `console.log()` in parser/renderer and run `yarn preview` to see debug output
- Use `yarn typecheck` to catch TypeScript errors before running tests
