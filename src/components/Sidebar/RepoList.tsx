import React, { useState } from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import RepoListItem from './RepoListItem';
import { Search, Star, FolderGit2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface RepoListProps {
  width?: number;
  activeView?: 'dashboard' | 'all' | 'attention';
}

export const RepoList: React.FC<RepoListProps> = ({ width = 280, activeView = 'all' }) => {
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

  const [sourceFilter, setSourceFilter] = useState<'all' | 'github' | 'local' | 'starred'>('all');
  const [techFilter, setTechFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; repoPath: string } | null>(null);

  const filteredRepos = repos.filter((r) => {
    if (config?.ignoredPaths?.includes(r.localPath)) return false;

    if (activeView === 'attention') {
      const isDirty = r.status === 'dirty' || (r.changedFiles && r.changedFiles.length > 0);
      const isAhead = r.status === 'ahead' || r.aheadCount > 0;
      if (!isDirty && !isAhead) return false;
    }

    if (sourceFilter === 'starred') {
      if (!config?.pinnedPaths?.includes(r.localPath)) return false;
    } else if (sourceFilter === 'github') {
      if (r.remoteType !== 'github') return false;
    } else if (sourceFilter === 'local') {
      if (r.remoteType === 'github') return false;
    }

    if (techFilter !== 'all') {
      if (techFilter === 'other') {
        if (r.projectType) return false;
      } else if (r.projectType !== techFilter) {
        return false;
      }
    }

    return true;
  });

  const sortedRepos = [...filteredRepos].sort((a, b) => {
    const isPinnedA = config?.pinnedPaths?.includes(a.localPath) || false;
    const isPinnedB = config?.pinnedPaths?.includes(b.localPath) || false;

    if (isPinnedA && !isPinnedB) return -1;
    if (!isPinnedA && isPinnedB) return 1;

    const hasChangesA = a.changedFiles && a.changedFiles.length > 0;
    const hasChangesB = b.changedFiles && b.changedFiles.length > 0;

    if (hasChangesA && !hasChangesB) return -1;
    if (!hasChangesA && hasChangesB) return 1;

    const timeA = a.lastCommitTime ? new Date(a.lastCommitTime).getTime() : 0;
    const timeB = b.lastCommitTime ? new Date(b.lastCommitTime).getTime() : 0;
    return timeB - timeA;
  });

  const searchedRepos = sortedRepos.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.localPath.toLowerCase().includes(q);
  });

  const handleContextMenu = (e: React.MouseEvent, repoPath: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, repoPath });
  };

  const handleHideRepo = async (repoPath: string) => {
    if (!config) return;
    const currentIgnored = config.ignoredPaths || [];
    if (currentIgnored.includes(repoPath)) return;

    const newConfig = { ...config, ignoredPaths: [...currentIgnored, repoPath] };
    setConfig(newConfig);

    if (selectedRepoId === repoPath) {
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

  const handleCopyPath = async (repoPath: string) => {
    const { showToast } = useRepoStore.getState();
    try {
      await navigator.clipboard.writeText(repoPath);
      showToast('Path copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const handleOpenTerminal = async (repoPath: string) => {
    const { showToast } = useRepoStore.getState();
    try {
      await invoke('open_terminal', { path: repoPath });
      showToast('Terminal opened', 'success');
    } catch (err) {
      console.error('Failed to open terminal:', err);
    }
  };

  return (
    <aside
      style={{ width }}
      className="h-full bg-[var(--bg-surface)] flex flex-col border-r border-[var(--border-subtle)] shrink-0 font-sans select-none z-10 transition-colors"
    >
      {/* Sidebar Header */}
      <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] uppercase text-[10px] tracking-wider">
          <FolderGit2 className="w-3.5 h-3.5 text-[var(--text-primary)]" />
          <span>Projects ({searchedRepos.length})</span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">
          {totalFolders} scanned
        </div>
      </div>

      {/* Scan Progress Bar */}
      {scanProgress && (
        <div className="px-3 py-2 bg-[var(--bg-raised)] border-b border-[var(--border-subtle)] animate-fadeIn">
          <div className="flex justify-between text-[10px] font-mono text-[var(--text-primary)] mb-1">
            <span className="truncate max-w-[150px]">{scanProgress.folderName}</span>
            <span>{scanProgress.current}/{scanProgress.total}</span>
          </div>
          <div className="w-full h-1 bg-[var(--bg-base)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--text-primary)] transition-all duration-200 ease-out"
              style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="p-2 border-b border-[var(--border-subtle)]">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter projects..."
            className="w-full bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] text-xs px-2.5 py-1 pl-7 pr-6 rounded-md border border-[var(--border-subtle)] focus:outline-none focus:border-[var(--border-strong)] transition-colors font-sans"
          />
          <Search className="w-3.5 h-3.5 text-[var(--text-ghost)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-ghost)] hover:text-[var(--text-primary)] text-xs"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Filter Segment Chips */}
      <div className="px-2 py-1.5 border-b border-[var(--border-subtle)] flex items-center gap-1 text-[10px] font-mono">
        <button
          onClick={() => setSourceFilter('all')}
          className={`px-2 py-0.5 rounded transition-colors ${
            sourceFilter === 'all'
              ? 'bg-[var(--bg-active)] text-[var(--text-primary)] font-medium border border-[var(--border-strong)]'
              : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
          }`}
        >
          All
        </button>

        <button
          onClick={() => setSourceFilter('starred')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
            sourceFilter === 'starred'
              ? 'bg-[var(--bg-active)] text-amber-500 font-medium border border-amber-500/30'
              : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Star className="w-2.5 h-2.5 fill-current text-amber-400" />
          Starred
        </button>

        <button
          onClick={() => setSourceFilter('github')}
          className={`px-2 py-0.5 rounded transition-colors ${
            sourceFilter === 'github'
              ? 'bg-[var(--bg-active)] text-[var(--text-primary)] font-medium border border-[var(--border-strong)]'
              : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
          }`}
        >
          GitHub
        </button>

        <select
          value={techFilter}
          onChange={(e) => setTechFilter(e.target.value)}
          className="ml-auto bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 text-[10px] focus:outline-none cursor-pointer"
        >
          <option value="all">Tech</option>
          <option value="rust">Rust</option>
          <option value="javascript">JS/TS</option>
          <option value="python">Python</option>
          <option value="go">Go</option>
          <option value="java">Java</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Repo List Container */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isScanning && repos.length === 0 ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse space-y-1.5 p-2 rounded-md bg-[#141418]">
                <div className="h-3 bg-white/10 rounded w-2/3" />
                <div className="h-2 bg-white/10 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : searchedRepos.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#52525b] text-xs font-mono">
            No matching projects.
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

      {/* Context Menu Overlay */}
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
            className="fixed z-50 bg-[#141418] border border-[#27272a] rounded-lg shadow-2xl py-1 font-sans text-xs select-none min-w-[160px] animate-fadeIn text-[#f4f4f5]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                handleTogglePin(contextMenu.repoPath);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#1c1c21] text-[#a1a1aa] hover:text-white flex items-center gap-2"
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
              {config?.pinnedPaths?.includes(contextMenu.repoPath) ? 'Unstar Project' : 'Star to Top'}
            </button>
            <button
              onClick={() => {
                handleCopyPath(contextMenu.repoPath);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#1c1c21] text-[#a1a1aa] hover:text-white"
            >
              Copy Full Path
            </button>
            <button
              onClick={() => {
                handleOpenTerminal(contextMenu.repoPath);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[#1c1c21] text-[#a1a1aa] hover:text-white"
            >
              Open Terminal
            </button>
            <div className="h-[1px] bg-[#27272a] my-1" />
            <button
              onClick={() => {
                handleHideRepo(contextMenu.repoPath);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-400"
            >
              Hide from List
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

export default RepoList;
