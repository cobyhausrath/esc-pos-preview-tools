import type { Job } from '@/types';

interface JobCardProps {
  job: Job;
  onClick: () => void;
}

export default function JobCard({ job, onClick }: JobCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusClass = (status: Job['status']) => {
    return `status-badge status-${status}`;
  };

  return (
    <div className="job-card" onClick={onClick}>
      <div className="job-header">
        <span className="job-id">#{job.id.slice(0, 8)}</span>
        <span className={getStatusClass(job.status)}>{job.status}</span>
      </div>

      <div className="job-details">
        <div className="job-detail">
          <strong>Printer:</strong> {job.printer_name}
        </div>
        <div className="job-detail">
          <strong>Source:</strong> {job.source_ip}
        </div>
        <div className="job-detail">
          <strong>Size:</strong> {job.data_size} bytes
        </div>
        <div className="job-detail">
          <strong>Created:</strong> {formatDate(job.created_at)}
        </div>
      </div>

      <div className="job-preview">
        <pre>{job.preview_text.slice(0, 100)}...</pre>
      </div>

      {job.error_message && (
        <div className="job-error">
          <strong>Error:</strong> {job.error_message}
        </div>
      )}
    </div>
  );
}
