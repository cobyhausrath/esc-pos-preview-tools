import type { HexStats } from '@/types';

interface HexViewProps {
  hexView: string;
  stats: HexStats;
}

export default function HexView({ hexView, stats }: HexViewProps) {
  return (
    <div className="hex-view">
      <div className="hex-header">
        <h3>HEX View</h3>
        <div className="hex-stats">
          <span>Bytes: {stats.totalBytes}</span>
          <span>ESC: {stats.escCommands}</span>
          <span>GS: {stats.gsCommands}</span>
        </div>
      </div>
      <pre className="hex-content">{hexView}</pre>
    </div>
  );
}
