import { useState } from 'react';
import type { ImageMatch } from '@/utils/imageParser';
import { base64ToDataUrl, truncateBase64 } from '@/utils/imageParser';

interface ImageBadgeProps {
  image: ImageMatch;
  onClick: (image: ImageMatch) => void;
}

export default function ImageBadge({ image, onClick }: ImageBadgeProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPreviewPosition({
      x: rect.left,
      y: rect.bottom + 8, // 8px gap below badge
    });
    setShowPreview(true);
  };

  const handleMouseLeave = () => {
    setShowPreview(false);
  };

  const handleClick = () => {
    onClick(image);
  };

  const dataUrl = base64ToDataUrl(image.base64Data);
  const displayText = image.width && image.height
    ? `${image.width}x${image.height}`
    : `Image`;

  // Extract indentation from the fullMatch
  const indentMatch = image.fullMatch.match(/^([ \t]*)/);
  const indent = indentMatch ? indentMatch[1] : '';

  return (
    <>
      <span
        className="image-badge-wrapper"
      >
        {/* Render indentation as-is (spaces/tabs preserved) */}
        {indent && <span className="image-badge-indent">{indent}</span>}
        <span className="image-badge-prefix">img_data = </span>
        <span
          className="image-badge"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          title="Click to edit image settings"
        >
          🖼️ {displayText}
        </span>
      </span>

      {showPreview && (
        <div
          className="image-preview-tooltip"
          style={{
            left: `${previewPosition.x}px`,
            top: `${previewPosition.y}px`,
          }}
        >
          <div className="image-preview-header">
            <span>Image Preview</span>
            {image.width && image.height && (
              <span className="image-preview-dimensions">
                {image.width}x{image.height}
              </span>
            )}
          </div>
          <img
            src={dataUrl}
            alt="Image preview"
            className="image-preview-img"
          />
          <div className="image-preview-footer">
            <span className="image-preview-data">
              {truncateBase64(image.base64Data, 32)}
            </span>
            {image.implementation && (
              <span className="image-preview-impl">
                {image.implementation}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
