import { useState, useRef, useEffect } from 'react';
import { detectBase64Images, type ImageMatch } from '@/utils/imageParser';
import ImageBadge from './ImageBadge';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  isExecuting: boolean;
  error: string | null;
  onImageClick?: (image: ImageMatch) => void;
}

export default function CodeEditor({ code, onChange, isExecuting, error, onImageClick }: CodeEditorProps) {
  const [images, setImages] = useState<ImageMatch[]>([]);
  const [showBadges, setShowBadges] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect images in code whenever it changes
  useEffect(() => {
    const detectedImages = detectBase64Images(code);
    setImages(detectedImages);
  }, [code]);

  const handleImageBadgeClick = (image: ImageMatch) => {
    if (onImageClick) {
      onImageClick(image);
    }
  };

  // Render code with image badges
  const renderCodeWithBadges = () => {
    if (!showBadges || images.length === 0) {
      return null;
    }

    const lines = code.split('\n');
    const elements: React.ReactNode[] = [];
    let lastEndIndex = 0;

    // Sort images by position
    const sortedImages = [...images].sort((a, b) => a.startIndex - b.startIndex);

    sortedImages.forEach((image, idx) => {
      // Add text before the image
      const textBefore = code.substring(lastEndIndex, image.startIndex);
      if (textBefore) {
        elements.push(
          <span key={`text-${idx}-before`} className="code-text">
            {textBefore}
          </span>
        );
      }

      // Add image badge
      elements.push(
        <ImageBadge
          key={`badge-${image.id}`}
          image={image}
          onClick={handleImageBadgeClick}
        />
      );

      lastEndIndex = image.endIndex;
    });

    // Add remaining text after last image
    const textAfter = code.substring(lastEndIndex);
    if (textAfter) {
      elements.push(
        <span key="text-after" className="code-text">
          {textAfter}
        </span>
      );
    }

    return elements;
  };

  return (
    <div className="code-editor">
      <div className="editor-header">
        <h2>Python Code (python-escpos)</h2>
        <div className="editor-header-actions">
          {images.length > 0 && (
            <button
              className="toggle-badges-btn"
              onClick={() => setShowBadges(!showBadges)}
              title={showBadges ? 'Show raw code' : 'Show image badges'}
            >
              {showBadges ? '📝 Show Raw' : '🖼️ Show Badges'}
            </button>
          )}
          {isExecuting && <span className="executing-badge">Executing...</span>}
        </div>
      </div>

      {/* Badge overlay (shown when badges are enabled and images exist) */}
      {showBadges && images.length > 0 && (
        <div className="code-badge-overlay">
          <pre className="code-with-badges">
            {renderCodeWithBadges()}
          </pre>
        </div>
      )}

      {/* Actual textarea (always present for editing) */}
      <textarea
        ref={textareaRef}
        className={`code-textarea ${showBadges && images.length > 0 ? 'with-badges' : ''}`}
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
          {images.length > 0 && (
            <li>
              <code>base64.b64decode('''...''')</code> - Embedded images ({images.length} found)
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
