import { useState, useEffect, useMemo } from 'react';
import { useDashboardWebSocket } from '@/hooks/useWebSocket';
import type { Job, DashboardFilter } from '@/types';
import JobCard from '@/components/JobCard';
import JobModal from '@/components/JobModal';
import Sidebar from '@/components/Sidebar';
import ConnectionStatus from '@/components/ConnectionStatus';

export default function Dashboard() {
  const { isConnected, jobs, stats, setJobs } = useDashboardWebSocket();
  const [filter, setFilter] = useState<DashboardFilter>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load jobs from API on mount
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch('http://127.0.0.1:3000/api/jobs');
        if (response.ok) {
          const data = await response.json();
          setJobs(data.jobs || []);
        }
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      }
    };

    fetchJobs();
  }, [setJobs]);

  // Filter jobs based on selected filter
  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    return jobs.filter((job) => job.status === filter);
  }, [jobs, filter]);

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleApprove = async (jobId: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:3000/api/jobs/${jobId}/approve`, {
        method: 'POST',
      });
      if (response.ok) {
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to approve job:', error);
    }
  };

  const handleReject = async (jobId: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:3000/api/jobs/${jobId}/reject`, {
        method: 'POST',
      });
      if (response.ok) {
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to reject job:', error);
    }
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>ESC-POS Spool Dashboard</h1>
        <ConnectionStatus isConnected={isConnected} />
      </header>

      <div className="main-container">
        <Sidebar stats={stats} filter={filter} onFilterChange={setFilter} />

        <main className="content">
          <div className="jobs-grid">
            {filteredJobs.length === 0 ? (
              <div className="empty-state">
                <p>No jobs found</p>
                {filter !== 'all' && <p>Try changing the filter</p>}
              </div>
            ) : (
              filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onClick={() => handleJobClick(job)} />
              ))
            )}
          </div>
        </main>
      </div>

      {selectedJob && (
        <JobModal
          isOpen={isModalOpen}
          job={selectedJob}
          onClose={() => setIsModalOpen(false)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
