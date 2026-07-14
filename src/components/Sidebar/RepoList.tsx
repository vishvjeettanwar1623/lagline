import React, { useState } from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import RepoListItem from './RepoListItem';
import { Search } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';


interface RepoListProps {
  width?: number;
}

export const RepoList: React.FC<RepoListProps> = ({ width = 270 }) => {
  const {
    repos,
    selectedRepoId,
    selectRepo,
    config,
    isScanning,
    setConfig,
    totalFolders,
    scanProgress,
  } = useRepoStore();

  const [filter, setFilter] = useState<'all' | 'github' | 'local'>('all');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; repoPath: string } | null>(null);
  const [sortChanges, setSortChanges] = useState<'changes-first' | 'no-changes-first'>('changes-first');

  const filteredRepos = repos.filter((r) => {
    // Filter out ignored repositories
    const isIgnored = config?.ignoredPaths?.includes(r.localPath);
    if (isIgnored) return false;

    // 1. Source filter
    if (filter === 'github' && r.remoteType !== 'github') {
      return false;
    }
    if (filter === 'local' && r.remoteType === 'github') {
      return false;
    }

    return true;
  });

  const hasGitChanges = (r: typeof repos[0]) => {
    return r.status === 'dirty' || r.status === 'ahead' || r.status === 'behind' || r.status === 'diverged';
  };

  const sortedRepos = [...filteredRepos].sort((a, b) => {
    const isPinnedA = config?.pinnedPaths?.includes(a.localPath) || false;
    const isPinnedB = config?.pinnedPaths?.includes(b.localPath) || false;

    if (isPinnedA && !isPinnedB) return -1;
    if (!isPinnedA && isPinnedB) return 1;

    const changesA = hasGitChanges(a);
    const changesB = hasGitChanges(b);

    if (sortChanges === 'changes-first') {
      if (changesA && !changesB) return -1;
      if (!changesA && changesB) return 1;
    } else {
      if (!changesA && changesB) return -1;
      if (changesA && !changesB) return 1;
    }

    const timeA = a.lastCommitTime ? new Date(a.lastCommitTime).getTime() : 0;
    const timeB = b.lastCommitTime ? new Date(b.lastCommitTime).getTime() : 0;
    return timeB - timeA; // Newest first
  });

  const [searchQuery, setSearchQuery] = useState('');

  const searchedRepos = sortedRepos.filter((r) => {
    const query = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(query) ||
      r.localPath.toLowerCase().includes(query)
    );
  });

  const handleContextMenu = (e: React.MouseEvent, repoPath: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      repoPath,
    });
  };

  const handleHideRepo = async (repoPath: string) => {
    if (!config) return;
    const currentIgnored = config.ignoredPaths || [];
    if (currentIgnored.includes(repoPath)) return;

    const newConfig = {
      ...config,
      ignoredPaths: [...currentIgnored, repoPath],
    };

    setConfig(newConfig);

    if (selectedRepoId === repoPath) {
      // Find another repo to select
      const nextRepo = sortedRepos.find((r) => r.localPath !== repoPath);
      selectRepo(nextRepo ? nextRepo.id : null);
    }

    try {
      await invoke('save_config', { config: newConfig });
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  const handleTogglePin = async (repoPath: string) => {
    if (!config) return;
    const currentPinned = config.pinnedPaths || [];
    const isPinned = currentPinned.includes(repoPath);
    const newPinned = isPinned
      ? currentPinned.filter((p) => p !== repoPath)
      : [...currentPinned, repoPath];

    const newConfig = {
      ...config,
      pinnedPaths: newPinned,
    };
    setConfig(newConfig);

    const { showToast } = useRepoStore.getState();
    showToast(isPinned ? 'Project unstarred' : 'Project starred to top', 'success');

    try {
      await invoke('save_config', { config: newConfig });
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  const handleCopyPath = async (repoPath: string) => {
    const { showToast } = useRepoStore.getState();
    try {
      await navigator.clipboard.writeText(repoPath);
      showToast('Path copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy path:', err);
      showToast('Failed to copy path', 'error');
    }
  };

  const handleOpenTerminal = async (repoPath: string) => {
    const { showToast } = useRepoStore.getState();
    try {
      await invoke('open_terminal', { path: repoPath });
      showToast('Terminal opened', 'success');
    } catch (err) {
      console.error('Failed to open terminal:', err);
      showToast('Failed to open terminal', 'error');
    }
  };

  const getSubheaderText = () => {
    if (filter === 'all') {
      return `${totalFolders} folders scanned`;
    }
    if (filter === 'github') {
      const githubRepos = repos.filter(r => r.remoteType === 'github' && !config?.ignoredPaths?.includes(r.localPath));
      const githubUncommitted = githubRepos.filter(r => r.changedFiles.length > 0).length;
      return `${githubRepos.length} repos · ${githubUncommitted} uncommitted`;
    }
    if (filter === 'local') {
      const localRepos = repos.filter(r => r.remoteType !== 'github' && !config?.ignoredPaths?.includes(r.localPath));
      return `${localRepos.length} folders`;
    }
    return '';
  };

  return (
    <div
      style={{ width }}
      className="h-screen bg-bg-surface flex flex-col border-r border-border-subtle shrink-0 font-sans select-none"
    >
      {/* Header */}
      <div className="p-4 border-b border-border-subtle flex flex-col">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="LagLine Logo" className="w-5 h-5 object-contain" />
          <div className="text-lg font-mono text-text-secondary tracking-tight">LagLine</div>
        </div>
        <div className="text-xs text-text-ghost mt-1">
          {getSubheaderText()}
        </div>
        {scanProgress && (
          <div className="mt-2.5 space-y-1.5 animate-fadeIn">
            <div className="flex justify-between text-[9px] font-mono text-text-ghost">
              <span className="truncate max-w-[150px]">Scanning: {scanProgress.folderName}</span>
              <span>{scanProgress.current} / {scanProgress.total}</span>
            </div>
            <div className="w-full h-1 bg-bg-wash rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent-warm transition-all duration-300 ease-out" 
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Filters Dropdowns */}
      <div className="px-3 py-2 border-b border-border-subtle flex gap-2 text-[10px] font-mono select-none">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="flex-1 bg-bg-surface text-text-secondary border border-border-subtle rounded px-2 py-1 focus:outline-none focus:border-border-active cursor-pointer text-xs"
        >
          <option value="all">All Sources</option>
          <option value="github">GitHub</option>
          <option value="local">Local/Other</option>
        </select>

        <select
          value={sortChanges}
          onChange={(e) => setSortChanges(e.target.value as 'changes-first' | 'no-changes-first')}
          className="flex-1 bg-bg-surface text-text-secondary border border-border-subtle rounded px-2 py-1 focus:outline-none focus:border-border-active cursor-pointer text-xs"
        >
          <option value="changes-first">Changes First</option>
          <option value="no-changes-first">No Changes First</option>
        </select>
      </div>
      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-border-subtle">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search folders..."
            className="w-full bg-bg-wash text-text-primary placeholder:text-text-ghost text-xs font-mono px-3 py-1.5 pl-8 rounded border border-border-subtle focus:outline-none focus:border-border-active transition-colors duration-150"
          />
          <Search className="w-3.5 h-3.5 text-text-ghost absolute left-2.5 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-secondary text-xs"
            >
              &times;
            </button>
          )}
        </div>
      </div>



      {/* Repo List */}
      <div className="flex-1 overflow-y-auto min-h-0 py-2">
        {isScanning && repos.length === 0 ? (
          // Skeleton loading
          <div className="px-4 py-3 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-bg-wash rounded w-3/4"></div>
                <div className="h-3 bg-bg-wash rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : repos.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-ghost text-xs leading-relaxed">
            No repositories found.<br />Check settings.
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-ghost text-xs leading-relaxed">
            No matching repositories.
          </div>
        ) : searchedRepos.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-ghost text-xs leading-relaxed">
            No repositories match search.
          </div>
        ) : (
          searchedRepos.map((repo) => (
            <RepoListItem
              key={repo.id}
              repo={repo}
              isSelected={repo.id === selectedRepoId}
              onClick={() => selectRepo(repo.id)}
              onContextMenu={(e) => handleContextMenu(e, repo.localPath)}
            />
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            className="fixed z-50 bg-bg-surface border border-border-subtle rounded shadow-md py-1 font-mono text-[11px] select-none min-w-[150px] outline-none animate-fadeIn"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                handleTogglePin(contextMenu.repoPath);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-bg-wash text-text-secondary hover:text-text-primary transition-colors duration-150 border-b border-border-subtle"
            >
              {config?.pinnedPaths?.includes(contextMenu.repoPath) ? '★ Unstar from top' : '☆ Star to top'}
            </button>
            <button
              onClick={() => {
                handleCopyPath(contextMenu.repoPath);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-bg-wash text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              📋 Copy path
            </button>
            <button
              onClick={() => {
                handleOpenTerminal(contextMenu.repoPath);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-bg-wash text-text-secondary hover:text-text-primary transition-colors duration-150 border-b border-border-subtle"
            >
              💻 Open Terminal
            </button>
            <button
              onClick={() => {
                handleHideRepo(contextMenu.repoPath);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-bg-wash text-status-ahead hover:text-[#ff5c5c] transition-colors duration-150"
            >
              Hide from list
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RepoList;
