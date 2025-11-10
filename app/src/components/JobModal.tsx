import { useEffect } from 'react';
import type { Job } from '@/types';

interface JobModalProps {
  isOpen: boolean;
  job: Job;
  onClose: () => void;
  onApprove: (jobId: string) => void;
  onReject: (jobId: string) => void;
}

export default function JobModal({ isOpen, job, onClose, onApprove, onReject }: JobModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Job Details</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="job-info">
            <div className="info-row">
              <strong>ID:</strong> <span>{job.id}</span>
            </div>
            <div className="info-row">
              <strong>Status:</strong> <span className={`status-badge status-${job.status}`}>{job.status}</span>
            </div>
            <div className="info-row">
              <strong>Printer:</strong> <span>{job.printer_name}</span>
            </div>
            <div className="info-row">
              <strong>Source IP:</strong> <span>{job.source_ip}</span>
            </div>
            <div className="info-row">
              <strong>Data Size:</strong> <span>{job.data_size} bytes</span>
            </div>
            <div className="info-row">
              <strong>Created:</strong> <span>{formatDate(job.created_at)}</span>
            </div>
            {job.approved_at && (
              <div className="info-row">
                <strong>Approved:</strong> <span>{formatDate(job.approved_at)}</span>
              </div>
            )}
            {job.rejected_at && (
              <div className="info-row">
                <strong>Rejected:</strong> <span>{formatDate(job.rejected_at)}</span>
              </div>
            )}
            {job.completed_at && (
              <div className="info-row">
                <strong>Completed:</strong> <span>{formatDate(job.completed_at)}</span>
              </div>
            )}
            {job.error_message && (
              <div className="info-row error">
                <strong>Error:</strong> <span>{job.error_message}</span>
              </div>
            )}
          </div>

          <div className="preview-section">
            <h3>Preview</h3>
            <pre className="preview-text">{job.preview_text}</pre>
          </div>
        </div>

        <div className="modal-footer">
          {job.status === 'pending' && (
            <>
              <button className="approve-button" onClick={() => onApprove(job.id)}>
                Approve
              </button>
              <button className="reject-button" onClick={() => onReject(job.id)}>
                Reject
              </button>
            </>
          )}
          <button className="cancel-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
