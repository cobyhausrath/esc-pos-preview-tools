import { useState, useRef } from 'react';
import type { ImageMatch } from '@/utils/imageParser';
import { base64ToDataUrl } from '@/utils/imageParser';

export type DitheringAlgorithm = 'floyd-steinberg' | 'atkinson' | 'threshold';
export type ImageImplementation = 'bitImageColumn' | 'bitImageRaster' | 'graphics';

interface ImageOptionsModalProps {
  image: ImageMatch;
  onClose: () => void;
  onUpdateImage: (
    image: ImageMatch,
    file: File,
    dithering: DitheringAlgorithm,
    implementation: ImageImplementation
  ) => void;
  onUpdateSettings: (
    image: ImageMatch,
    implementation: ImageImplementation
  ) => void;
}

export default function ImageOptionsModal({
  image,
  onClose,
  onUpdateImage,
  onUpdateSettings,
}: ImageOptionsModalProps) {
  const [dithering, setDithering] = useState<DitheringAlgorithm>('floyd-steinberg');
  const [implementation, setImplementation] = useState<ImageImplementation>(
    image.implementation || 'bitImageRaster'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpdateImage(image, file, dithering, implementation);
      onClose();
    }
  };

  const handleApplySettings = () => {
    onUpdateSettings(image, implementation);
    onClose();
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

          {/* Implementation Selector */}
          <div className="option-section">
            <h3>Print Implementation</h3>
            <div className="option-group">
              <label>
                <input
                  type="radio"
                  value="bitImageRaster"
                  checked={implementation === 'bitImageRaster'}
                  onChange={(e) => setImplementation(e.target.value as ImageImplementation)}
                />
                <span>Bit Image Raster (GS v 0)</span>
                <span className="option-description">
                  Default, best compatibility
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  value="bitImageColumn"
                  checked={implementation === 'bitImageColumn'}
                  onChange={(e) => setImplementation(e.target.value as ImageImplementation)}
                />
                <span>Bit Image Column (ESC *)</span>
                <span className="option-description">
                  Older format, legacy printers
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  value="graphics"
                  checked={implementation === 'graphics'}
                  onChange={(e) => setImplementation(e.target.value as ImageImplementation)}
                />
                <span>Graphics (GS ( L)</span>
                <span className="option-description">
                  Modern format, high-resolution
                </span>
              </label>
            </div>
          </div>

          {/* Dithering Algorithm Selector (for upload) */}
          <div className="option-section">
            <h3>Dithering Algorithm</h3>
            <p className="option-note">
              Used when uploading a new image
            </p>
            <div className="option-group">
              <label>
                <input
                  type="radio"
                  value="floyd-steinberg"
                  checked={dithering === 'floyd-steinberg'}
                  onChange={(e) => setDithering(e.target.value as DitheringAlgorithm)}
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
                  onChange={(e) => setDithering(e.target.value as DitheringAlgorithm)}
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
                  onChange={(e) => setDithering(e.target.value as DitheringAlgorithm)}
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
          <button className="btn-secondary" onClick={handleApplySettings}>
            Apply Settings
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
