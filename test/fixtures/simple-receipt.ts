/**
 * Simple receipt with basic text formatting
 */
export const simpleReceipt = Buffer.from([
  0x1b, 0x40, // ESC @ - Initialize printer

  // Store name (centered, bold)
  0x1b, 0x61, 0x01, // ESC a 1 - Center alignment
  0x1b, 0x45, 0x01, // ESC E 1 - Bold on
  ...Buffer.from('ACME STORE'),
  0x1b, 0x45, 0x00, // ESC E 0 - Bold off
  0x0a, // LF

  // Address (centered)
  ...Buffer.from('123 Main Street'),
  0x0a,
  ...Buffer.from('Springfield, USA'),
  0x0a, 0x0a,

  // Left align for items
  0x1b, 0x61, 0x00, // ESC a 0 - Left alignment

  // Receipt header
  ...Buffer.from('Receipt #12345'),
  0x0a,
  ...Buffer.from('Date: 2025-01-15'),
  0x0a, 0x0a,

  // Items
  ...Buffer.from('Item            Qty   Price'),
  0x0a,
  ...Buffer.from('----------------------------'),
  0x0a,
  ...Buffer.from('Apple Pie       2     $5.00'),
  0x0a,
  ...Buffer.from('Coffee          1     $2.50'),
  0x0a,
  ...Buffer.from('Sandwich        1     $7.50'),
  0x0a,
  ...Buffer.from('----------------------------'),
  0x0a,

  // Total (bold)
  0x1b, 0x45, 0x01, // Bold on
  ...Buffer.from('TOTAL:               $15.00'),
  0x1b, 0x45, 0x00, // Bold off
  0x0a, 0x0a,

  // Footer (centered)
  0x1b, 0x61, 0x01, // Center alignment
  ...Buffer.from('Thank you for your visit!'),
  0x0a,
  ...Buffer.from('Please come again'),
  0x0a, 0x0a, 0x0a,

  // Cut paper
  0x1d, 0x56, 0x00, // GS V 0 - Full cut
]);

export const simpleReceiptExpected = {
  name: 'Simple Receipt',
  description: 'Basic receipt with text formatting',
  commands: [
    { type: 'initialize' },
    { type: 'align', value: 'center' },
    { type: 'bold', value: true },
    { type: 'text', value: 'ACME STORE' },
    // ... more commands
  ],
};
