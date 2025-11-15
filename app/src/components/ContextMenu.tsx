import { useEffect, useRef } from 'react';
import { AlignmentType, ContextMenuProps } from '../types';

/**
 * ContextMenu - Interactive context menu for receipt preview
 *
 * Displays when user right-clicks on a preview line, allowing them to:
 * - Toggle bold and underline
 * - Change text alignment
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
    const menuWidth = 250;
    const menuHeight = 400; // approximate max height
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

  return (
    <div ref={menuRef} className="context-menu" style={getMenuStyle()}>
      {/* Header */}
      <div className="menu-section">
        <strong>Text Attributes (Line {lineNumber})</strong>
      </div>

      {/* Bold toggle */}
      <div className="menu-item toggle-item" onClick={handleToggleBold}>
        <span>{attributes.bold ? '✓' : '☐'} Bold</span>
        <span className="toggle-badge">{attributes.bold ? 'ON' : 'OFF'}</span>
      </div>

      {/* Underline toggle */}
      <div className="menu-item toggle-item" onClick={handleToggleUnderline}>
        <span>{attributes.underline ? '✓' : '☐'} Underline</span>
        <span className="toggle-badge">
          {attributes.underline ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Divider */}
      <div className="menu-divider"></div>

      {/* Alignment section */}
      <div className="menu-section">
        <strong>Alignment:</strong>
      </div>

      {/* Alignment options */}
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

      {/* Commands section */}
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
