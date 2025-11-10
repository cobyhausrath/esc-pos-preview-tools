import { useEffect, useRef } from 'react';

interface ReceiptPreviewProps {
  preview: string;
  isLoading: boolean;
}

export default function ReceiptPreview({ preview, isLoading }: ReceiptPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    console.log('[ReceiptPreview] useEffect triggered');
    console.log('[ReceiptPreview] preview type:', typeof preview);
    console.log('[ReceiptPreview] preview length:', preview?.length);
    console.log('[ReceiptPreview] preview substring:', preview?.substring?.(0, 100));
    console.log('[ReceiptPreview] iframeRef.current:', iframeRef.current);

    if (iframeRef.current && preview) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      console.log('[ReceiptPreview] doc:', doc);

      if (doc) {
        console.log('[ReceiptPreview] Writing to iframe...');
        doc.open();
        doc.write(preview);
        doc.close();
        console.log('[ReceiptPreview] Write complete');
      } else {
        console.error('[ReceiptPreview] No document available!');
      }
    } else {
      console.log('[ReceiptPreview] Skipping write - iframe or preview not ready');
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
