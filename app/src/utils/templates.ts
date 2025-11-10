import type { TemplateType } from '@/types';

export function generateTemplate(type: TemplateType, data?: string): string {
  const now = new Date();

  switch (type) {
    case 'timestamp':
      return `# Timestamp
p.set(align='center', double_height=True, double_width=True)
p.text('${now.toLocaleTimeString()}\\n')
p.set()
p.text('${now.toLocaleDateString()}\\n')
p.cut()
`;

    case 'expiry': {
      const oneWeek = new Date(now);
      oneWeek.setDate(oneWeek.getDate() + 7);
      return `# Expiry Date (+1 week)
p.set(align='center', bold=True)
p.text('EXPIRES\\n')
p.set(align='center', double_height=True, double_width=True)
p.text('${oneWeek.toLocaleDateString()}\\n')
p.set()
p.cut()
`;
    }

    case 'todo': {
      if (data) {
        // Parse todo items from shared text
        const items = data
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            // Handle Google Keep checkboxes
            const checkbox = /^[\u2610\u2611\u2612\u2713\u2717\u2718\u2714]/.test(line);
            if (checkbox) {
              return line.substring(1).trim();
            }
            return line.trim();
          });

        const todoList = items.map((item, i) => `p.text('${i + 1}. ${item}\\n')`).join('\n');

        return `# To-Do List
p.set(align='center', bold=True, double_width=True)
p.text('TO-DO\\n')
p.set(align='left')
p.text('\\n')
${todoList}
p.text('\\n')
p.cut()
`;
      }
      return `# To-Do List Template
p.set(align='center', bold=True, double_width=True)
p.text('TO-DO\\n')
p.set(align='left')
p.text('\\n')
p.text('1. First task\\n')
p.text('2. Second task\\n')
p.text('3. Third task\\n')
p.text('\\n')
p.cut()
`;
    }

    case 'note': {
      const text = data || 'Your note here';
      return `# Note
p.set(align='center', bold=True)
p.text('NOTE\\n')
p.text('${now.toLocaleDateString()}\\n')
p.set()
p.text('\\n')
p.text('${text}\\n')
p.text('\\n')
p.cut()
`;
    }

    case 'image':
      return `# Image Printing
# Replace 'image.png' with your image path
p.image('image.png')
p.cut()
`;

    default:
      return `# Basic Receipt
p.text('Hello, World!\\n')
p.cut()
`;
  }
}

export const TEMPLATES: Array<{ id: TemplateType; name: string; description: string }> = [
  { id: 'timestamp', name: 'Timestamp', description: 'Current date and time' },
  { id: 'expiry', name: 'Expiry', description: 'Expiration date (+1 week)' },
  { id: 'todo', name: 'To-Do', description: 'Task list' },
  { id: 'note', name: 'Note', description: 'Simple note' },
  { id: 'image', name: 'Image', description: 'Print an image' },
];

export const EXAMPLE_CODES = {
  basic: `# Basic receipt example
p.text('Welcome!\\n')
p.text('Thank you for your purchase\\n')
p.cut()
`,
  formatted: `# Formatted text example
p.set(align='center', bold=True)
p.text('RECEIPT\\n')
p.set()
p.text('Item 1..................$10.00\\n')
p.text('Item 2..................$20.00\\n')
p.text('----------------------------\\n')
p.set(bold=True, double_width=True)
p.text('TOTAL: $30.00\\n')
p.set()
p.cut()
`,
  alignment: `# Alignment example
p.set(align='left')
p.text('Left aligned\\n')
p.set(align='center')
p.text('Center aligned\\n')
p.set(align='right')
p.text('Right aligned\\n')
p.set()
p.cut()
`,
};
