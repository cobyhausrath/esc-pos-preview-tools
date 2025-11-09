/**
 * Various text formatting examples
 */
export const formattedText = Buffer.from([
  0x1b, 0x40, // Initialize

  // Normal text
  ...Buffer.from('Normal Text'),
  0x0a,

  // Bold
  0x1b, 0x45, 0x01, // Bold on
  ...Buffer.from('Bold Text'),
  0x1b, 0x45, 0x00, // Bold off
  0x0a,

  // Underline
  0x1b, 0x2d, 0x01, // Underline on
  ...Buffer.from('Underlined Text'),
  0x1b, 0x2d, 0x00, // Underline off
  0x0a,

  // Double height
  0x1b, 0x21, 0x10, // Double height
  ...Buffer.from('Tall Text'),
  0x1b, 0x21, 0x00, // Normal
  0x0a,

  // Double width
  0x1b, 0x21, 0x20, // Double width
  ...Buffer.from('Wide Text'),
  0x1b, 0x21, 0x00, // Normal
  0x0a,

  // Double width + height
  0x1b, 0x21, 0x30, // Double both
  ...Buffer.from('BIG'),
  0x1b, 0x21, 0x00, // Normal
  0x0a,
]);
