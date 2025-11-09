# Contributing to ESC/POS Preview Tools

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- **Node.js 16+** and **Yarn** (this project uses Yarn, not npm)
- **Python 3.7+** (for Python tools)
- **Git**
- Basic understanding of TypeScript
- Familiarity with ESC/POS commands (helpful but not required)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/esc-pos-preview-tools.git
   cd esc-pos-preview-tools
   ```
3. Install dependencies:
   ```bash
   # JavaScript/TypeScript
   yarn install

   # Python
   pip install python-escpos pytest pyright
   ```
4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running Tests

**TypeScript/JavaScript:**
```bash
yarn test              # Run tests in watch mode
yarn test:run          # Run tests once
yarn test:coverage     # Generate coverage report
```

**Python:**
```bash
cd python
python test_escpos_verifier.py
# or with pytest
pytest test_escpos_verifier.py -v
```

### Building

```bash
yarn build             # Build for production
yarn dev               # Build in watch mode
```

### Type Checking

**TypeScript:**
```bash
yarn typecheck         # Check TypeScript types
```

**Python:**
```bash
cd python
pyright                # Check Python types
```

### Linting and Formatting

```bash
yarn lint              # Check for linting errors
yarn lint:fix          # Fix linting errors automatically
yarn format            # Format code with Prettier
yarn format:check      # Check if code is formatted
```

## Code Guidelines

### TypeScript

- Use TypeScript strict mode
- Define explicit types for function parameters and return values
- Use interfaces for object shapes
- Avoid `any` type unless absolutely necessary
- Document complex types with JSDoc comments

### Code Style

- Follow the ESLint configuration
- Use meaningful variable and function names
- Keep functions small and focused
- Write self-documenting code
- Add comments for complex logic

### Example

```typescript
/**
 * Parses an ESC/POS command from a byte stream
 * @param bytes - The byte array to parse
 * @param offset - Starting position in the array
 * @returns Parsed command object or null if invalid
 */
function parseCommand(bytes: Uint8Array, offset: number): Command | null {
  // Implementation
}
```

## Testing

### Unit Tests

- Write unit tests for all new functions
- Test edge cases and error conditions
- Mock external dependencies
- Aim for >80% code coverage

### Integration Tests

- Test complete workflows
- Verify parser + renderer + exporter integration
- Use real ESC/POS command sequences

### Test Structure

```typescript
describe('CommandParser', () => {
  describe('parseTextCommand', () => {
    it('should parse basic text correctly', () => {
      // Arrange
      const bytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]);

      // Act
      const result = parser.parse(bytes);

      // Assert
      expect(result).toEqual({ type: 'text', content: 'Hello' });
    });

    it('should handle empty input', () => {
      const bytes = new Uint8Array([]);
      expect(parser.parse(bytes)).toEqual([]);
    });
  });
});
```

## Commit Guidelines

### Commit Messages

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(parser): add support for QR code commands

Implement parsing for GS ( k command to support QR code generation.
Includes validation of QR code parameters and error correction levels.

Closes #42
```

```
fix(renderer): correct bold text rendering

Bold text was rendering with incorrect weight. Updated font
weight calculation to match ESC/POS specification.
```

### Commit Best Practices

- Make atomic commits (one logical change per commit)
- Write clear, descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused and small

## Pull Request Process

### Before Submitting

1. Ensure all tests pass
2. Update documentation if needed
3. Add tests for new features
4. Run linting and formatting
5. Update CHANGELOG.md if applicable

### PR Description

Include:
- **What**: Brief description of changes
- **Why**: Reason for the changes
- **How**: Implementation approach
- **Testing**: How you tested the changes
- **Screenshots**: For visual changes

### Example PR Template

```markdown
## Description
Adds support for barcode rendering using Code128 format.

## Motivation
Many thermal printers use Code128 for product barcodes. This addition
makes the preview tool more useful for retail applications.

## Changes
- Implemented Code128 barcode parser
- Added barcode renderer to GraphicsRenderer
- Created barcode generation utility
- Added tests for various barcode formats

## Testing
- Added unit tests for barcode parsing
- Added integration tests for rendering
- Tested with real Code128 sequences from POS systems

## Checklist
- [x] Tests pass
- [x] Documentation updated
- [x] Code follows style guidelines
- [x] Self-review completed
```

### Review Process

1. Submit your PR
2. Wait for automated checks (CI/CD)
3. Address reviewer feedback
4. Make requested changes
5. Get approval from maintainer
6. PR will be merged

## Areas for Contribution

### High Priority

- Core ESC/POS command implementations
- Additional barcode formats
- Character encoding support
- Performance optimizations
- Bug fixes

### Medium Priority

- Additional export formats
- CLI enhancements
- Documentation improvements
- Example receipts
- Unit test coverage

### Good First Issues

Look for issues tagged with `good-first-issue`:
- Documentation fixes
- Simple command implementations
- Test additions
- Example code

## Documentation

### Code Documentation

- Use JSDoc comments for public APIs
- Document complex algorithms
- Explain non-obvious code
- Include usage examples

### README and Guides

- Keep README.md up to date
- Update API documentation
- Add examples for new features
- Improve existing documentation

## Community

### Communication

- Be respectful and professional
- Ask questions if unclear
- Help other contributors
- Share knowledge and insights

### Getting Help

- Check existing issues and discussions
- Read the documentation
- Ask in GitHub Discussions
- Tag maintainers if urgent

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- README.md contributors section
- GitHub contributors page
- Release notes for significant contributions

## Questions?

If you have questions about contributing:
1. Check the [FAQ](docs/FAQ.md)
2. Search existing issues
3. Open a new discussion
4. Contact maintainers

Thank you for contributing to ESC/POS Preview Tools!
