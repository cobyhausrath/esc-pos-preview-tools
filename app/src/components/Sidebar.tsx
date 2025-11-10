import type { JobStats, DashboardFilter } from '@/types';

interface SidebarProps {
  stats: JobStats;
  filter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
}

export default function Sidebar({ stats, filter, onFilterChange }: SidebarProps) {
  const filters: Array<{ id: DashboardFilter; label: string; count: number }> = [
    { id: 'all', label: 'All Jobs', count: stats.total },
    { id: 'pending', label: 'Pending', count: stats.pending },
    { id: 'approved', label: 'Approved', count: stats.approved },
    { id: 'rejected', label: 'Rejected', count: stats.rejected },
    { id: 'printing', label: 'Printing', count: stats.printing },
    { id: 'completed', label: 'Completed', count: stats.completed },
    { id: 'failed', label: 'Failed', count: stats.failed },
  ];

  return (
    <aside className="sidebar">
      <h2>Filters</h2>
      <nav className="filter-nav">
        {filters.map((f) => (
          <button
            key={f.id}
            className={`filter-button ${filter === f.id ? 'active' : ''}`}
            onClick={() => onFilterChange(f.id)}
          >
            <span className="filter-label">{f.label}</span>
            <span className="filter-count">{f.count}</span>
          </button>
        ))}
      </nav>

      <div className="stats-summary">
        <h3>Statistics</h3>
        <div className="stat-item">
          <span>Total Jobs</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="stat-item">
          <span>Pending Review</span>
          <strong>{stats.pending}</strong>
        </div>
        <div className="stat-item">
          <span>Active</span>
          <strong>{stats.printing}</strong>
        </div>
      </div>
    </aside>
  );
}
