import React from 'react';
import { RepoInfo } from '../../types/repo';
import StatusDot from '../shared/StatusDot';
import { useRepoStore } from '../../store/useRepoStore';

interface RepoListItemProps {
  repo: RepoInfo;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const RepoListItem: React.FC<RepoListItemProps> = ({ repo, isSelected, onClick, onContextMenu }) => {
  const { config } = useRepoStore();
  const rootPath = config?.rootPath || '';
  const isPinned = config?.pinnedPaths?.includes(repo.localPath) || false;

  const getRelativePath = () => {
    if (!rootPath) return '';
    const normalizedRoot = rootPath.replace(/\\/g, '/').toLowerCase();
    const normalizedLocal = repo.localPath.replace(/\\/g, '/');
    if (normalizedLocal.toLowerCase().startsWith(normalizedRoot)) {
      let rel = normalizedLocal.slice(normalizedRoot.length);
      if (rel.startsWith('/')) {
        rel = rel.slice(1);
      }
      const parts = rel.split('/');
      if (parts.length > 1) {
        return parts.slice(0, -1).join('/') + '/';
      }
    }
    return '';
  };

  const formatRelativeTime = (isoString: string | null): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  };

  const getStatusLabel = () => {
    let label = '';
    switch (repo.status) {
      case 'ahead':
        label = `${repo.aheadCount} ahead`;
        break;
      case 'behind':
        label = `${repo.behindCount} behind`;
        break;
      case 'diverged':
        label = `${repo.aheadCount} ahead · ${repo.behindCount} behind`;
        break;
      case 'dirty':
        label = `${repo.changedFiles.length} changes`;
        break;
      case 'unlinked':
        label = 'unlinked';
        break;
      case 'non-git':
        label = 'non-git';
        break;
      case 'clean':
      default:
        label = 'clean';
        break;
    }

    const relativeTime = formatRelativeTime(repo.lastCommitTime);
    if (relativeTime) {
      return `${label} · ${relativeTime}`;
    }
    return label;
  };

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 ease-out border-l-2 outline-none ${
        isSelected
          ? 'bg-bg-raised border-accent-ink text-text-primary'
          : 'bg-transparent border-transparent text-text-secondary hover:bg-bg-raised hover:text-text-primary'
      }`}
    >
      <StatusDot status={repo.status} />
      <div className="flex-1 min-w-0">
        {getRelativePath() && (
          <div className="text-[10px] font-mono text-text-ghost truncate mb-0.5">
            {getRelativePath()}
          </div>
        )}
        <div className="text-sm font-sans font-semibold truncate flex items-center justify-between gap-2">
          <span className="truncate flex-1 flex items-center gap-1.5">
            {repo.name}
            {isPinned && <span className="text-[#d2a374] text-xs">★</span>}
          </span>
        </div>
        <div className="text-xs font-mono text-text-secondary mt-0.5">
          {getStatusLabel()}
        </div>
      </div>
    </button>
  );
};

export default RepoListItem;
