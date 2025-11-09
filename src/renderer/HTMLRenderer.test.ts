import { describe, it, expect } from 'vitest';
import { HTMLRenderer } from './HTMLRenderer';
import { Command } from '../parser/types';

describe('HTMLRenderer', () => {
  const renderer = new HTMLRenderer({ width: 48 });

  it('should render plain text', () => {
    const commands: Command[] = [
      { type: 'text', value: 'Hello World' },
      { type: 'linefeed' },
    ];

    const html = renderer.render(commands);

    expect(html).toContain('Hello World');
    expect(html).toContain('<div class="receipt-line align-left">');
  });

  it('should render bold text', () => {
    const commands: Command[] = [
      { type: 'bold', value: true },
      { type: 'text', value: 'Bold' },
      { type: 'linefeed' },
    ];

    const html = renderer.render(commands);

    expect(html).toContain('<strong>Bold</strong>');
  });

  it('should render centered text', () => {
    const commands: Command[] = [
      { type: 'align', value: 'center' },
      { type: 'text', value: 'Centered' },
      { type: 'linefeed' },
    ];

    const html = renderer.render(commands);

    expect(html).toContain('align-center');
    expect(html).toContain('Centered');
  });

  it('should render underlined text', () => {
    const commands: Command[] = [
      { type: 'underline', value: true },
      { type: 'text', value: 'Underlined' },
      { type: 'linefeed' },
    ];

    const html = renderer.render(commands);

    expect(html).toContain('<u>Underlined</u>');
  });

  it('should handle multiple formatting combinations', () => {
    const commands: Command[] = [
      { type: 'bold', value: true },
      { type: 'underline', value: true },
      { type: 'align', value: 'center' },
      { type: 'text', value: 'Formatted' },
      { type: 'linefeed' },
    ];

    const html = renderer.render(commands);

    expect(html).toContain('<strong>');
    expect(html).toContain('<u>');
    expect(html).toContain('align-center');
    expect(html).toContain('Formatted');
  });

  it('should include proper HTML structure', () => {
    const commands: Command[] = [
      { type: 'text', value: 'Test' },
      { type: 'linefeed' },
    ];

    const html = renderer.render(commands);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('.receipt-container');
  });
});
