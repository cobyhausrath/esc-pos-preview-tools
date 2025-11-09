/**
 * Test fixtures for ESC/POS commands
 */

export { simpleReceipt, simpleReceiptExpected } from './simple-receipt';
export { formattedText } from './formatted-text';

export const allFixtures = {
  simpleReceipt: {
    name: 'Simple Receipt',
    description: 'Basic receipt with header, items, and footer',
  },
  formattedText: {
    name: 'Formatted Text',
    description: 'Various text formatting commands',
  },
};
