import { useEffect, useRef } from 'react';

interface ReceiptPreviewProps {
  preview: string;
  isLoading: boolean;
}

export default function ReceiptPreview({ preview, isLoading }: ReceiptPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && preview) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (doc) {
        doc.open();
        doc.write(preview);
        doc.close();
      }
    }
  }, [preview]);

  return (
    <div className="receipt-preview">
      <h3>Receipt Preview</h3>
      <div className="receipt-paper">
        {isLoading ? (
          <div className="loading-indicator">Generating preview...</div>
        ) : (
          <iframe
            ref={iframeRef}
            className="receipt-iframe"
            title="Receipt Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}
