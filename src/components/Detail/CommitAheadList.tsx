import React from 'react';
import { AheadCommit } from '../../types/repo';

interface CommitAheadListProps {
  commits: AheadCommit[];
}

export const CommitAheadList: React.FC<CommitAheadListProps> = ({ commits }) => {
  const getRelativeTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-text-ghost text-xs font-mono">
        No unpushed commits
      </div>
    );
  }

  return (
    <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2">
      {commits.map((commit, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-1 border-b border-border-subtle/5 text-xs font-mono">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-accent-warm font-semibold shrink-0">
              {commit.hash}
            </span>
            <span className="text-text-primary truncate" title={commit.message}>
              {commit.message}
            </span>
          </div>
          <span className="text-text-ghost shrink-0">
            {getRelativeTime(commit.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default CommitAheadList;
