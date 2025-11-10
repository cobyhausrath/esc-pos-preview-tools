# Add Visual Context Menu for Interactive Preview Editing

## Problem
Users can only edit receipts by writing python-escpos code. There's no visual way to:
- Inspect what commands created a specific line/word/character
- Modify text attributes (bold, size, alignment) visually
- Add/remove formatting without touching code
- Learn which commands affect which output

This makes the tool harder for non-programmers and slows down iteration.

## Proposed Solution

Add a **Chrome DevTools-style context menu** for the receipt preview that shows:
1. Which commands affected the clicked element
2. Current attribute values
3. Interactive controls to modify them

### Visual Mockup

**User right-clicks on "TOTAL: $12.50" in preview:**

```
┌────────────────────────────────┐
│ TOTAL: $12.50                  │ ← Right-clicked here
└────────────────────────────────┘

Context Menu:
┌─────────────────────────────────────┐
│ Text Attributes                     │
├─────────────────────────────────────┤
│ ✓ Bold            [Toggle]          │
│ ☐ Underline       [Toggle]          │
│ ☐ Inverse         [Toggle]          │
├─────────────────────────────────────┤
│ Alignment:  [ Left ▼ ]             │
│             • Left                  │
│             ○ Center                │
│             ○ Right                 │
├─────────────────────────────────────┤
│ Size:  Width [1] [-] [+]           │
│        Height [1] [-] [+]           │
├─────────────────────────────────────┤
│ Add Attribute:                      │
│   + Double Height                   │
│   + Double Width                    │
│   + Invert Colors                   │
├─────────────────────────────────────┤
│ Commands Applied (line 42):         │
│   • ESC a 0 (left align)           │
│   • ESC E 1 (bold on)              │
│   • p.text('TOTAL: $12.50\n')      │
├─────────────────────────────────────┤
│ [Edit Code] [Copy Line] [Delete]   │
└─────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Command Tracking During Render

Enhance `renderPreview()` to track which commands affect each element:

```javascript
renderPreview(escposBytes) {
  const commandMap = new Map(); // lineNumber → [commands]
  let lineNumber = 0;
  let currentState = {
    align: 'left',
    bold: false,
    underline: false,
    width: 1,
    height: 1,
    commands: []
  };

  while (i < escposBytes.length) {
    const byte = escposBytes[i];

    // ESC a - Alignment
    if (byte === 0x1B && escposBytes[i+1] === 0x61) {
      const align = escposBytes[i+2];
      currentState.commands.push({
        type: 'ESC a',
        value: align,
        pythonCode: `p.set(align='${alignName}')`
      });
      currentState.align = alignName;
    }

    // On line feed, save state
    if (byte === 0x0A) {
      commandMap.set(lineNumber, {...currentState});
      currentState.commands = [];
      lineNumber++;
    }
  }

  // Store for context menu
  this.commandMap = commandMap;
}
```

### Phase 2: Add Data Attributes to DOM

Attach metadata to each preview line:

```javascript
formatLine(text, align, bold, underline, lineNumber) {
  return `<div class="receipt-line ${align}"
              data-line="${lineNumber}"
              data-align="${align}"
              data-bold="${bold}"
              data-underline="${underline}"
              onclick="editor.handleLineClick(event)">
           ${text}
         </div>`;
}
```

### Phase 3: Context Menu Component

```javascript
class ContextMenu {
  constructor(editor) {
    this.editor = editor;
    this.currentLine = null;
    this.menu = null;
  }

  show(event, lineNumber, attributes, commands) {
    event.preventDefault();

    // Create menu DOM
    this.menu = this.buildMenu(lineNumber, attributes, commands);

    // Position at cursor
    this.menu.style.left = event.pageX + 'px';
    this.menu.style.top = event.pageY + 'px';

    document.body.appendChild(this.menu);

    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', () => this.hide(), {once: true});
    }, 0);
  }

  buildMenu(lineNumber, attributes, commands) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    // Bold toggle
    menu.innerHTML += this.buildToggle('Bold', attributes.bold, () => {
      this.toggleBold(lineNumber);
    });

    // Alignment selector
    menu.innerHTML += this.buildAlignmentSelector(attributes.align, (newAlign) => {
      this.changeAlignment(lineNumber, newAlign);
    });

    // ... more controls

    // Commands section
    menu.innerHTML += `<div class="menu-section">
      <strong>Commands Applied:</strong>
      ${commands.map(cmd => `<div class="command-item">${cmd.pythonCode}</div>`).join('')}
    </div>`;

    return menu;
  }

  toggleBold(lineNumber) {
    // Modify the python code
    const commands = this.editor.commandMap.get(lineNumber);

    // Find the text() call for this line
    const codeLines = this.editor.getEditorCode().split('\n');
    const lineToModify = this.findCodeLineForPreviewLine(lineNumber);

    // Add or remove bold
    if (commands.bold) {
      // Insert "p.set(bold=False)" before text line
      codeLines.splice(lineToModify, 0, "p.set(bold=False)");
    } else {
      // Insert "p.set(bold=True)" before text line
      codeLines.splice(lineToModify, 0, "p.set(bold=True)");
    }

    // Update editor
    this.editor.setCode(codeLines.join('\n'));
    this.editor.runCode();

    this.hide();
  }

  // ... similar methods for other attributes
}
```

### Phase 4: Code Modification Engine

The hardest part: intelligently modifying python-escpos code.

**Challenges:**
1. Map preview line number → source code line number
2. Insert/modify `.set()` calls without breaking code
3. Handle cases where multiple `.text()` calls affect one line
4. Preserve code structure and comments

**Solution: AST-based modification**

```javascript
class CodeModifier {
  constructor(pythonCode) {
    this.code = pythonCode;
    this.lines = pythonCode.split('\n');
  }

  // Map preview line to code line
  findCodeLineForPreviewLine(previewLine) {
    // Count p.text() calls (each is a preview line)
    let textCallCount = 0;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].includes('p.text(')) {
        if (textCallCount === previewLine) {
          return i;
        }
        textCallCount++;
      }
    }
    return -1;
  }

  // Insert or update .set() call before a line
  insertSetCall(lineNumber, attribute, value) {
    const setCall = `p.set(${attribute}=${value})`;

    // Check if previous line already has this .set()
    const prevLine = this.lines[lineNumber - 1];
    if (prevLine.includes(`p.set(${attribute}=`)) {
      // Update existing
      this.lines[lineNumber - 1] = setCall;
    } else {
      // Insert new
      this.lines.splice(lineNumber, 0, setCall);
    }
  }

  getModifiedCode() {
    return this.lines.join('\n');
  }
}
```

## Features

### Core Features (MVP)
- ✅ Right-click on preview line
- ✅ Show current attributes (bold, align, underline)
- ✅ Toggle bold
- ✅ Change alignment (left/center/right)
- ✅ Show applied commands
- ✅ Modify code and re-render

### Enhanced Features (V2)
- ✅ Character-level selection (not just line)
- ✅ +/- buttons for width/height
- ✅ Color picker (if printer supports)
- ✅ "Add attribute" menu
- ✅ Multi-line selection
- ✅ Undo/redo integration
- ✅ Live preview of changes

### Advanced Features (V3)
- ✅ Drag-and-drop reordering
- ✅ Copy/paste formatted text
- ✅ Style inspector (like Chrome DevTools)
- ✅ "Explain this command" tooltips
- ✅ Suggest optimizations (e.g., combine adjacent .set() calls)

## Technical Architecture

```
┌──────────────────────────────────────────────┐
│ Preview (HTML DOM)                           │
│  └─ data-line, data-attributes               │
└──────────────────────────────────────────────┘
              ↓ (right-click)
┌──────────────────────────────────────────────┐
│ ContextMenu                                  │
│  ├─ Read attributes from data-*              │
│  ├─ Read commands from commandMap            │
│  └─ Show menu at cursor position             │
└──────────────────────────────────────────────┘
              ↓ (user changes attribute)
┌──────────────────────────────────────────────┐
│ CodeModifier                                 │
│  ├─ Find code line for preview line          │
│  ├─ Insert/update .set() calls               │
│  └─ Return modified code                     │
└──────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────┐
│ Editor                                       │
│  ├─ Update code in textarea                 │
│  ├─ Re-run code                              │
│  └─ Re-render preview                        │
└──────────────────────────────────────────────┘
```

## Styling

```css
.context-menu {
  position: fixed;
  background: #2d2d30;
  border: 1px solid #3e3e3e;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  padding: 8px 0;
  min-width: 250px;
  z-index: 9999;
  font-size: 13px;
  color: #d4d4d4;
}

.context-menu .menu-section {
  padding: 8px 12px;
  border-bottom: 1px solid #3e3e3e;
}

.context-menu .menu-item {
  padding: 6px 12px;
  cursor: pointer;
}

.context-menu .menu-item:hover {
  background: #3e3e3e;
}

.context-menu .toggle-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.context-menu .command-item {
  font-family: monospace;
  font-size: 11px;
  color: #858585;
  padding: 2px 0;
}
```

## User Experience

**Learning Tool**: Users can:
- Click on any receipt element
- See exactly which python-escpos commands created it
- Modify attributes visually
- See the code update in real-time
- Learn the API through experimentation

**Debugging Tool**: Users can:
- Understand why text looks wrong
- Identify conflicting commands
- Fix alignment issues visually
- Verify bold/underline is applied

## Acceptance Criteria
- [ ] Right-click on preview line shows context menu
- [ ] Menu displays current attributes correctly
- [ ] Toggle bold updates code and re-renders
- [ ] Change alignment updates code and re-renders
- [ ] Commands section shows all applied commands
- [ ] Menu closes on outside click
- [ ] Menu positioned correctly (stays on screen)
- [ ] Works on mobile (long-press)
- [ ] Undo/redo works with menu edits
- [ ] Performance acceptable (menu opens <100ms)

## Priority
**Medium-High** - This dramatically improves UX for non-programmers and speeds up visual editing workflows.

## Complexity
**High** - Requires:
- Command tracking during render
- Bidirectional mapping (preview ↔ code)
- Intelligent code modification
- Complex UI component
- Edge case handling

Estimated effort: 3-5 days of focused development.
