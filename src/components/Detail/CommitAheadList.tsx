import React, { useState } from 'react';
import { AheadCommit } from '../../types/repo';
import { GitCommit, Copy, Check } from 'lucide-react';
import { useRepoStore } from '../../store/useRepoStore';

interface CommitAheadListProps {
  commits: AheadCommit[];
}

export const CommitAheadList: React.FC<CommitAheadListProps> = ({ commits }) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

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

  const handleCopyHash = async (e: React.MouseEvent, hash: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
      const { showToast } = useRepoStore.getState();
      showToast(`Commit hash ${hash} copied`, 'success');
    } catch (err) {
      console.error('Failed to copy hash:', err);
    }
  };

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] text-xs font-mono">
        <GitCommit className="w-8 h-8 mb-2 opacity-40 text-[var(--text-muted)]" />
        No commits pending push
      </div>
    );
  }

  return (
    <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
      {commits.map((commit, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] transition-all gap-3 group shadow-xs"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={(e) => handleCopyHash(e, commit.hash)}
              title="Copy Commit Hash"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-mono text-[11px] font-medium shrink-0 hover:border-[var(--border-strong)] transition-all"
            >
              <span>{commit.hash.slice(0, 7)}</span>
              {copiedHash === commit.hash ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
              )}
            </button>
            <div className="min-w-0 flex-1 truncate">
              <span className="text-[var(--text-primary)] font-sans text-xs truncate font-medium" title={commit.message}>
                {commit.message}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
            {getRelativeTime(commit.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default CommitAheadList;
