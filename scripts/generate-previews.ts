#!/usr/bin/env tsx
/**
 * Generate HTML previews from test fixtures
 * This script is the main feedback loop for development
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { CommandParser } from '../src/parser/CommandParser';
import { HTMLRenderer } from '../src/renderer/HTMLRenderer';
import { simpleReceipt, formattedText } from '../test/fixtures';

const OUTPUT_DIR = join(process.cwd(), 'test-output');

// Ensure output directory exists
try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

const parser = new CommandParser();
const renderer = new HTMLRenderer({ width: 48 });

interface Fixture {
  name: string;
  description: string;
  buffer: Buffer;
}

const fixtures: Fixture[] = [
  {
    name: 'simple-receipt',
    description: 'Simple receipt with basic formatting',
    buffer: simpleReceipt,
  },
  {
    name: 'formatted-text',
    description: 'Various text formatting examples',
    buffer: formattedText,
  },
];

console.log('🎨 Generating HTML previews...\n');

// Generate individual previews
for (const fixture of fixtures) {
  console.log(`📄 Processing: ${fixture.name}`);
  console.log(`   ${fixture.description}`);

  const parseResult = parser.parse(fixture.buffer);
  const html = renderer.render(parseResult.commands);

  const outputPath = join(OUTPUT_DIR, `${fixture.name}.html`);
  writeFileSync(outputPath, html);

  console.log(`   ✓ Generated: ${outputPath}`);
  console.log(`   Commands parsed: ${parseResult.commands.length}`);
  console.log(`   Bytes processed: ${parseResult.bytesProcessed}\n`);
}

// Generate index page with all previews
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESC/POS Preview Gallery</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .preview-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .preview-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .preview-card h2 {
      margin-top: 0;
      color: #333;
      font-size: 18px;
    }
    .preview-card p {
      color: #666;
      font-size: 14px;
    }
    .preview-card a {
      display: inline-block;
      margin-top: 10px;
      padding: 8px 16px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
    }
    .preview-card a:hover {
      background: #0056b3;
    }
    .timestamp {
      color: #999;
      font-size: 12px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <h1>🎨 ESC/POS Preview Gallery</h1>
  <p class="subtitle">Visual feedback for development and testing</p>

  <div class="gallery">
${fixtures
  .map(
    (f) => `
    <div class="preview-card">
      <h2>${f.name}</h2>
      <p>${f.description}</p>
      <a href="${f.name}.html" target="_blank">View Preview →</a>
    </div>
`
  )
  .join('')}
  </div>

  <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
</body>
</html>`;

const indexPath = join(OUTPUT_DIR, 'index.html');
writeFileSync(indexPath, indexHtml);

console.log('✅ Preview generation complete!');
console.log(`\n📂 Output directory: ${OUTPUT_DIR}`);
console.log(`🌐 Open in browser: file://${indexPath}\n`);
