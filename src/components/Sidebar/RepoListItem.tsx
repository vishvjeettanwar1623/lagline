import React from 'react';
import { RepoInfo } from '../../types/repo';
import StatusDot from '../shared/StatusDot';
import { useRepoStore } from '../../store/useRepoStore';
import { Star, Code2, Terminal, Copy } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface RepoListItemProps {
  repo: RepoInfo;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const RepoListItem: React.FC<RepoListItemProps> = ({ repo, isSelected, onClick, onContextMenu }) => {
  const { config, setConfig } = useRepoStore();
  const rootPath = config?.rootPath || '';
  const isPinned = config?.pinnedPaths?.includes(repo.localPath) || false;

  const getRelativePath = () => {
    if (!rootPath) return '';
    const normalizedRoot = rootPath.replace(/\\/g, '/').toLowerCase();
    const normalizedLocal = repo.localPath.replace(/\\/g, '/');
    if (normalizedLocal.toLowerCase().startsWith(normalizedRoot)) {
      let rel = normalizedLocal.slice(normalizedRoot.length);
      if (rel.startsWith('/')) rel = rel.slice(1);
      const parts = rel.split('/');
      if (parts.length > 1) {
        return parts.slice(0, -1).join('/') + '/';
      }
    }
    return '';
  };

  const getStatusLabel = () => {
    switch (repo.status) {
      case 'ahead':
        return `+${repo.aheadCount} ahead`;
      case 'behind':
        return `-${repo.behindCount} behind`;
      case 'diverged':
        return `+${repo.aheadCount}/-${repo.behindCount}`;
      case 'dirty':
        return `${repo.changedFiles.length} modified`;
      case 'unlinked':
        return 'no remote';
      case 'non-git':
        return 'non-git';
      case 'clean':
      default:
        return 'clean';
    }
  };

  const getProjectTypeBadge = (type: string | null | undefined) => {
    let label = 'Other';

    if (type === 'rust') {
      label = 'Rust';
    } else if (type === 'javascript') {
      label = 'JS/TS';
    } else if (type === 'python') {
      label = 'Python';
    } else if (type === 'go') {
      label = 'Go';
    } else if (type === 'java') {
      label = 'Java';
    }

    return (
      <span className="px-1.5 py-0.2 text-[9px] font-mono rounded border bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)] shrink-0">
        {label}
      </span>
    );
  };

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!config) return;
    const currentPinned = config.pinnedPaths || [];
    const newPinned = isPinned
      ? currentPinned.filter((p) => p !== repo.localPath)
      : [...currentPinned, repo.localPath];

    const newConfig = { ...config, pinnedPaths: newPinned };
    setConfig(newConfig);

    const { showToast } = useRepoStore.getState();
    showToast(isPinned ? 'Project unstarred' : 'Project starred to top', 'success');

    try {
      await invoke('save_config', { config: newConfig });
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  const handleOpenVSCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { showToast } = useRepoStore.getState();
    try {
      await invoke('open_in_vscode', { path: repo.localPath });
      showToast(`Opened ${repo.name} in VS Code`, 'success');
    } catch (err) {
      console.error('Failed to open VS Code:', err);
    }
  };

  const handleOpenTerminal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { showToast } = useRepoStore.getState();
    try {
      await invoke('open_terminal', { path: repo.localPath });
      showToast(`Terminal opened for ${repo.name}`, 'success');
    } catch (err) {
      console.error('Failed to open terminal:', err);
    }
  };

  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { showToast } = useRepoStore.getState();
    try {
      await navigator.clipboard.writeText(repo.localPath);
      showToast('Path copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-all duration-150 border outline-none select-none ${
        isSelected
          ? 'bg-[var(--bg-active)] border-[var(--border-strong)] text-[var(--text-primary)] shadow-xs font-medium border-l-2 border-l-[var(--text-primary)]'
          : 'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      }`}
    >
      <StatusDot status={repo.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate flex-1 flex items-center gap-1.5 text-xs text-[var(--text-primary)] font-medium">
            {repo.name}
            {isPinned && <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />}
          </span>
          {getProjectTypeBadge(repo.projectType)}
        </div>
        <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5 flex items-center justify-between">
          <span className="truncate">{getRelativePath() ? getRelativePath() : getStatusLabel()}</span>
          {getRelativePath() && <span className="shrink-0">{getStatusLabel()}</span>}
        </div>
      </div>

      {/* Hover Quick Action Icons */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 px-1 py-0.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border-subtle)] shadow-md z-20">
        <button
          onClick={handleTogglePin}
          title={isPinned ? 'Unstar' : 'Star to top'}
          className="p-1 rounded text-amber-500 hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
        </button>
        <button
          onClick={handleOpenVSCode}
          title="Open in VS Code"
          className="p-1 rounded text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleOpenTerminal}
          title="Open Terminal"
          className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCopyPath}
          title="Copy Path"
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default RepoListItem;
