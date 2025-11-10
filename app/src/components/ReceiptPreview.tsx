interface ReceiptPreviewProps {
  preview: string;
  isLoading: boolean;
}

export default function ReceiptPreview({ preview, isLoading }: ReceiptPreviewProps) {
  return (
    <div className="receipt-preview">
      <h3>Receipt Preview</h3>
      <div className="receipt-paper">
        {isLoading ? (
          <div className="loading-indicator">Generating preview...</div>
        ) : (
          <pre className="receipt-content">{preview}</pre>
        )}
      </div>
    </div>
  );
}
