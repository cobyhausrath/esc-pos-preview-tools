import { useEffect, useRef } from 'react';
import {
  AlignmentType,
  ContextMenuProps,
  FontType,
  ContextMenuAction,
} from '../types';

/**
 * ContextMenu - Interactive context menu for receipt preview
 *
 * Displays when user right-clicks on a preview line, allowing them to:
 * - Toggle bold, underline, invert, flip, smooth
 * - Change text alignment and font
 * - Adjust text size (width/height multipliers)
 * - Convert text to barcode/QR code
 * - Modify image display options
 * - View ESC-POS commands that affected the line
 *
 * Styled like Chrome DevTools for a familiar developer experience.
 */
export function ContextMenu({
  lineNumber,
  attributes,
  commands,
  position,
  onClose,
  onToggleBold,
  onToggleUnderline,
  onChangeAlignment,
  onAction,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add listener after a short delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Ensure menu stays on screen
  const getMenuStyle = (): React.CSSProperties => {
    const menuWidth = 280;
    const menuHeight = 600; // approximate max height with all options
    const padding = 10;

    let left = position.x;
    let top = position.y;

    // Adjust if menu would go off right edge
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    // Adjust if menu would go off bottom edge
    if (top + menuHeight > window.innerHeight - padding) {
      top = window.innerHeight - menuHeight - padding;
    }

    return { left: `${left}px`, top: `${top}px` };
  };

  const handleToggleBold = () => {
    onToggleBold(lineNumber, attributes.bold);
    onClose();
  };

  const handleToggleUnderline = () => {
    onToggleUnderline(lineNumber, attributes.underline);
    onClose();
  };

  const handleChangeAlignment = (newAlign: AlignmentType) => {
    onChangeAlignment(lineNumber, newAlign);
    onClose();
  };

  const handleToggleAttribute = (
    attribute: string,
    currentValue: boolean | undefined
  ) => {
    const newValue = !currentValue;
    const action: ContextMenuAction = {
      type: 'format',
      attribute,
      value: newValue,
      pythonCode: `p.set(${attribute}=${newValue ? 'True' : 'False'})`,
    };
    onAction(lineNumber, action);
    onClose();
  };

  const handleChangeFont = (newFont: FontType) => {
    const action: ContextMenuAction = {
      type: 'format',
      attribute: 'font',
      value: newFont,
      pythonCode: `p.set(font='${newFont}')`,
    };
    onAction(lineNumber, action);
    onClose();
  };

  const handleChangeSize = (dimension: 'width' | 'height', value: number) => {
    const action: ContextMenuAction = {
      type: 'format',
      attribute: dimension,
      value,
      pythonCode: `p.set(${dimension}=${value})`,
    };
    onAction(lineNumber, action);
    onClose();
  };

  const handleConvertToBarcode = () => {
    const text = attributes.textContent || '';
    const action: ContextMenuAction = {
      type: 'convert',
      pythonCode: `p.barcode('${text}', 'CODE39')`,
    };
    onAction(lineNumber, action);
    onClose();
  };

  const handleConvertToQR = () => {
    const text = attributes.textContent || '';
    const action: ContextMenuAction = {
      type: 'convert',
      pythonCode: `p.qr('${text}')`,
    };
    onAction(lineNumber, action);
    onClose();
  };

  const isText = attributes.contentType === 'text';
  const isImage = attributes.contentType === 'image';
  const isBarcode = attributes.contentType === 'barcode';
  const isQRCode = attributes.contentType === 'qrcode';

  return (
    <div ref={menuRef} className="context-menu" style={getMenuStyle()}>
      {/* Header */}
      <div className="menu-section">
        <strong>
          {isText && `Text Attributes (Line ${lineNumber})`}
          {isImage && `Image Options (Line ${lineNumber})`}
          {isBarcode && `Barcode Options (Line ${lineNumber})`}
          {isQRCode && `QR Code Options (Line ${lineNumber})`}
        </strong>
      </div>

      {/* Text formatting options */}
      {isText && (
        <>
          {/* Basic toggles */}
          <div className="menu-item toggle-item" onClick={handleToggleBold}>
            <span>{attributes.bold ? '✓' : '☐'} Bold</span>
            <span className="toggle-badge">
              {attributes.bold ? 'ON' : 'OFF'}
            </span>
          </div>

          <div
            className="menu-item toggle-item"
            onClick={handleToggleUnderline}
          >
            <span>{attributes.underline ? '✓' : '☐'} Underline</span>
            <span className="toggle-badge">
              {attributes.underline ? 'ON' : 'OFF'}
            </span>
          </div>

          <div
            className="menu-item toggle-item"
            onClick={() => handleToggleAttribute('invert', attributes.invert)}
          >
            <span>{attributes.invert ? '✓' : '☐'} Invert</span>
            <span className="toggle-badge">
              {attributes.invert ? 'ON' : 'OFF'}
            </span>
          </div>

          <div
            className="menu-item toggle-item"
            onClick={() => handleToggleAttribute('flip', attributes.flip)}
          >
            <span>{attributes.flip ? '✓' : '☐'} Flip (Upside Down)</span>
            <span className="toggle-badge">
              {attributes.flip ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* Divider */}
          <div className="menu-divider"></div>

          {/* Alignment section */}
          <div className="menu-section">
            <strong>Alignment:</strong>
          </div>

          {(['left', 'center', 'right'] as AlignmentType[]).map((align) => (
            <div
              key={align}
              className="menu-item"
              onClick={() => handleChangeAlignment(align)}
            >
              <span>
                {attributes.align === align ? '●' : '○'}{' '}
                {align.charAt(0).toUpperCase() + align.slice(1)}
              </span>
            </div>
          ))}

          {/* Divider */}
          <div className="menu-divider"></div>

          {/* Font section */}
          <div className="menu-section">
            <strong>Font:</strong>
          </div>

          {(['a', 'b', 'c'] as FontType[]).map((font) => (
            <div
              key={font}
              className="menu-item"
              onClick={() => handleChangeFont(font)}
            >
              <span>
                {attributes.font === font ? '●' : '○'} Font{' '}
                {font.toUpperCase()}
              </span>
            </div>
          ))}

          {/* Divider */}
          <div className="menu-divider"></div>

          {/* Size section */}
          <div className="menu-section">
            <strong>Size:</strong>
          </div>

          <div className="menu-item size-controls">
            <span>Width: {attributes.width || 1}x</span>
            <div className="size-buttons">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
                <button
                  key={w}
                  className={`size-btn ${attributes.width === w ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChangeSize('width', w);
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="menu-item size-controls">
            <span>Height: {attributes.height || 1}x</span>
            <div className="size-buttons">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                <button
                  key={h}
                  className={`size-btn ${attributes.height === h ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChangeSize('height', h);
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="menu-divider"></div>

          {/* Conversion options */}
          <div className="menu-section">
            <strong>Convert To:</strong>
          </div>

          <div className="menu-item" onClick={handleConvertToBarcode}>
            <span>📊 Barcode</span>
          </div>

          <div className="menu-item" onClick={handleConvertToQR}>
            <span>⬛ QR Code</span>
          </div>
        </>
      )}

      {/* Image options */}
      {isImage && (
        <>
          <div className="menu-section">
            <strong>Image Implementation:</strong>
          </div>

          <div
            className="menu-item"
            onClick={() => {
              const action: ContextMenuAction = {
                type: 'format',
                pythonCode: `p.image(img, impl='bitImageColumn')`,
              };
              onAction(lineNumber, action);
              onClose();
            }}
          >
            <span>Column Format (ESC *)</span>
          </div>

          <div
            className="menu-item"
            onClick={() => {
              const action: ContextMenuAction = {
                type: 'format',
                pythonCode: `p.image(img, impl='bitImageRaster')`,
              };
              onAction(lineNumber, action);
              onClose();
            }}
          >
            <span>Raster Format (GS v 0)</span>
          </div>

          <div className="menu-divider"></div>

          <div className="menu-section">
            <strong>Alignment:</strong>
          </div>

          {(['left', 'center', 'right'] as AlignmentType[]).map((align) => (
            <div
              key={align}
              className="menu-item"
              onClick={() => handleChangeAlignment(align)}
            >
              <span>
                {attributes.align === align ? '●' : '○'}{' '}
                {align.charAt(0).toUpperCase() + align.slice(1)}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Barcode/QR options */}
      {(isBarcode || isQRCode) && (
        <>
          <div className="menu-section">
            <strong>Barcode/QR Options:</strong>
          </div>

          <div className="menu-item">
            <span>Convert back to text (coming soon)</span>
          </div>

          <div className="menu-divider"></div>

          <div className="menu-section">
            <strong>Alignment:</strong>
          </div>

          {(['left', 'center', 'right'] as AlignmentType[]).map((align) => (
            <div
              key={align}
              className="menu-item"
              onClick={() => handleChangeAlignment(align)}
            >
              <span>
                {attributes.align === align ? '●' : '○'}{' '}
                {align.charAt(0).toUpperCase() + align.slice(1)}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Commands section (always shown) */}
      {commands.length > 0 && (
        <>
          <div className="menu-divider"></div>
          <div className="menu-section">
            <strong>Commands Applied:</strong>
          </div>
          {commands.map((cmd, index) => (
            <div key={index} className="command-item">
              {cmd.pythonCode}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
