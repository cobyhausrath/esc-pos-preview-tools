import { useState, useRef } from 'react';
import type { ImageMatch } from '@/utils/imageParser';
import { base64ToDataUrl } from '@/utils/imageParser';
import { hasCachedImage } from '@/utils/imageCache';

export type DitheringAlgorithm = 'floyd-steinberg' | 'atkinson' | 'threshold';

interface ImageOptionsModalProps {
  image: ImageMatch;
  onClose: () => void;
  onUpdateImage: (
    image: ImageMatch,
    file: File,
    dithering: DitheringAlgorithm
  ) => void;
  onRedither: (
    image: ImageMatch,
    dithering: DitheringAlgorithm
  ) => void;
}

export default function ImageOptionsModal({
  image,
  onClose,
  onUpdateImage,
  onRedither,
}: ImageOptionsModalProps) {
  const [dithering, setDithering] = useState<DitheringAlgorithm>('floyd-steinberg');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasCached = hasCachedImage(image.id);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpdateImage(image, file, dithering);
      onClose();
    }
  };

  const handleDitheringChange = (newDithering: DitheringAlgorithm) => {
    setDithering(newDithering);

    // If we have a cached original image, regenerate immediately
    if (hasCached) {
      onRedither(image, newDithering);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const dataUrl = base64ToDataUrl(image.base64Data);

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="image-options-modal">
        <div className="modal-header">
          <h2>Image Options</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {/* Current Image Preview */}
          <div className="image-preview-section">
            <h3>Current Image</h3>
            <div className="image-preview-container">
              <img
                src={dataUrl}
                alt="Current image"
                className="current-image-preview"
              />
              {image.width && image.height && (
                <p className="image-dimensions">
                  {image.width} × {image.height} pixels
                </p>
              )}
            </div>
          </div>

          {/* Dithering Algorithm Selector */}
          <div className="option-section">
            <h3>Dithering Algorithm</h3>
            {hasCached ? (
              <p className="option-note">
                Changes apply immediately (original image cached)
              </p>
            ) : (
              <p className="option-note">
                Upload a new image to change dithering
              </p>
            )}
            <div className="option-group">
              <label>
                <input
                  type="radio"
                  value="floyd-steinberg"
                  checked={dithering === 'floyd-steinberg'}
                  onChange={(e) => handleDitheringChange(e.target.value as DitheringAlgorithm)}
                />
                <span>Floyd-Steinberg</span>
                <span className="option-description">
                  Best quality, smooth gradients
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  value="atkinson"
                  checked={dithering === 'atkinson'}
                  onChange={(e) => handleDitheringChange(e.target.value as DitheringAlgorithm)}
                />
                <span>Atkinson</span>
                <span className="option-description">
                  Artistic, lighter appearance
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  value="threshold"
                  checked={dithering === 'threshold'}
                  onChange={(e) => handleDitheringChange(e.target.value as DitheringAlgorithm)}
                />
                <span>Threshold</span>
                <span className="option-description">
                  Simple, high contrast
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={handleUploadClick}>
            Upload New Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
