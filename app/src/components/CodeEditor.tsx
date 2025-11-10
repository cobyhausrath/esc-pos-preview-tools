interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  isExecuting: boolean;
  error: string | null;
}

export default function CodeEditor({ code, onChange, isExecuting, error }: CodeEditorProps) {
  return (
    <div className="code-editor">
      <div className="editor-header">
        <h2>Python Code (python-escpos)</h2>
        {isExecuting && <span className="executing-badge">Executing...</span>}
      </div>

      <textarea
        className="code-textarea"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        placeholder="# Write your python-escpos code here
p.text('Hello, World!\n')
p.cut()"
        spellCheck={false}
      />

      {error && <div className="error-message">{error}</div>}

      <div className="editor-hint">
        <p>
          Use the <code>p</code> variable to access the printer. Examples:
        </p>
        <ul>
          <li>
            <code>p.text('Hello')</code> - Print text
          </li>
          <li>
            <code>p.set(bold=True)</code> - Set formatting
          </li>
          <li>
            <code>p.cut()</code> - Cut paper
          </li>
        </ul>
      </div>
    </div>
  );
}
