import React, { useEffect, useState, useCallback } from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import { invoke } from '@tauri-apps/api/core';
import { RepoInfo, ChangedFile, HeavyFolderInfo } from '../../types/repo';
import FileChangeList from './FileChangeList';
import CommitAheadList from './CommitAheadList';
import FileInspectorModal from './FileInspectorModal';
import {
  Folder,
  Terminal,
  AlertTriangle,
  Code2,
  GitCommit,
  CheckCircle2,
  Copy,
  GitBranch,
  LayoutGrid,
  ShieldCheck,
  ArrowRight,
  Upload,
  Archive,
  Trash2,
  HardDrive,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

interface RepoDetailProps {
  setActiveView?: (view: 'dashboard' | 'all' | 'attention') => void;
}

export const RepoDetail: React.FC<RepoDetailProps> = ({ setActiveView }) => {
  const {
    selectedRepoId,
    updateRepo,
    repos,
    config,
    selectRepo,
  } = useRepoStore();
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'changes' | 'commits' | 'cleaner'>('overview');
  const [inspectFile, setInspectFile] = useState<ChangedFile | null>(null);

  // Quick Git Action Loading States
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isStashing, setIsStashing] = useState<boolean>(false);
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState<boolean>(false);

  // Heavy Build Folders State
  const [heavyFolders, setHeavyFolders] = useState<HeavyFolderInfo[]>([]);
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false);
  const [cleaningFolder, setCleaningFolder] = useState<string | null>(null);

  const storeRepo = repos.find((r) => r.id === selectedRepoId) || null;

  const refreshRepo = useCallback(async () => {
    if (!selectedRepoId) return;
    try {
      const detail: any = await invoke('get_repo_detail', { repoPath: selectedRepoId });
      setRepo(detail);
      updateRepo(detail);
    } catch (err) {
      console.error('Error refreshing repo:', err);
    }
  }, [selectedRepoId, updateRepo]);

  useEffect(() => {
    if (!selectedRepoId) {
      setRepo(null);
      return;
    }

    const fetchDetail = async () => {
      if (storeRepo && storeRepo.status === 'non-git') {
        setRepo(storeRepo);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const detail: any = await invoke('get_repo_detail', { repoPath: selectedRepoId });
        setRepo(detail);
        updateRepo(detail);
      } catch (err: any) {
        console.error('Error fetching repo detail:', err);
        setError(err.toString());
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
    setActiveTab('overview');
    setShowDiscardConfirm(false);
  }, [selectedRepoId, updateRepo]);

  // Load heavy folders when cleaner tab is active
  useEffect(() => {
    if (activeTab === 'cleaner' && selectedRepoId) {
      const loadHeavy = async () => {
        setLoadingFolders(true);
        try {
          const folders: any = await invoke('get_heavy_folders', { repoPath: selectedRepoId });
          setHeavyFolders(folders);
        } catch (err) {
          console.error('Failed to get heavy folders:', err);
        } finally {
          setLoadingFolders(false);
        }
      };
      loadHeavy();
    }
  }, [activeTab, selectedRepoId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'Escape') {
        if (inspectFile) {
          setInspectFile(null);
        } else {
          selectRepo(null);
        }
      }
    },
    [selectRepo, inspectFile]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const activeRepo = repo || storeRepo;

  // Quick Git Handlers
  const handlePush = async () => {
    if (!activeRepo || isPushing) return;
    setIsPushing(true);
    const { showToast } = useRepoStore.getState();
    try {
      await invoke('git_push_repo', { repoPath: activeRepo.localPath });
      showToast('Successfully pushed commits to remote', 'success');
      await refreshRepo();
    } catch (err: any) {
      console.error('Git push error:', err);
      showToast(err?.message || err?.toString() || 'Git push failed', 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const handleStash = async () => {
    if (!activeRepo || isStashing) return;
    setIsStashing(true);
    const { showToast } = useRepoStore.getState();
    try {
      await invoke('git_stash_repo', { repoPath: activeRepo.localPath });
      showToast('Stashed local changes', 'success');
      await refreshRepo();
    } catch (err: any) {
      console.error('Git stash error:', err);
      showToast(err?.message || err?.toString() || 'Git stash failed', 'error');
    } finally {
      setIsStashing(false);
    }
  };

  const handleDiscard = async () => {
    if (!activeRepo || isDiscarding) return;
    setIsDiscarding(true);
    const { showToast } = useRepoStore.getState();
    try {
      await invoke('git_discard_repo', { repoPath: activeRepo.localPath });
      showToast('Discarded all uncommitted local changes', 'success');
      setShowDiscardConfirm(false);
      await refreshRepo();
    } catch (err: any) {
      console.error('Git discard error:', err);
      showToast(err?.message || err?.toString() || 'Git discard failed', 'error');
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleCleanFolder = async (fullPath: string, folderName: string) => {
    setCleaningFolder(fullPath);
    const { showToast } = useRepoStore.getState();
    try {
      await invoke('clean_heavy_folder', { fullPath });
      setHeavyFolders((prev) => prev.filter((f) => f.fullPath !== fullPath));
      showToast(`Cleaned artifact folder: ${folderName}`, 'success');
    } catch (err: any) {
      console.error('Failed to clean folder:', err);
      showToast(err?.message || err?.toString() || 'Folder cleanup failed', 'error');
    } finally {
      setCleaningFolder(null);
    }
  };

  // Empty Selection Dashboard View
  if (!selectedRepoId) {
    const totalCount = repos.length;
    const dirtyCount = repos.filter(
      (r) => r.status === 'dirty' || (r.changedFiles && r.changedFiles.length > 0)
    ).length;
    const aheadCount = repos.filter((r) => r.status === 'ahead' || r.aheadCount > 0).length;
    const cleanCount = repos.filter((r) => r.status === 'clean').length;
    const githubCount = repos.filter((r) => r.remoteType === 'github').length;
    const localCount = repos.filter((r) => r.remoteType !== 'github').length;

    const attentionRepos = repos.filter(
      (r) => r.status === 'dirty' || r.aheadCount > 0 || (r.changedFiles && r.changedFiles.length > 0)
    );

    return (
      <main className="flex-1 bg-[var(--bg-base)] flex flex-col p-6 lg:p-8 overflow-y-auto select-none font-sans z-10 transition-colors">
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn">
          {/* Dashboard Title Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border-subtle)] pb-5 gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2.5 font-mono">
                <LayoutGrid className="w-5 h-5 text-[var(--text-primary)]" />
                Workspace Overview
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-sans">
                Real-time repository health matrix and branch sync tracking
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>{cleanCount} of {totalCount} Clean</span>
            </div>
          </div>

          {/* Minimalist Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Scanned */}
            <div
              onClick={() => setActiveView && setActiveView('all')}
              className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all duration-200 space-y-2 cursor-pointer group shadow-xs"
            >
              <div className="text-[10px] uppercase font-bold font-mono text-[var(--text-muted)] tracking-wider">Total Scanned</div>
              <div className="text-3xl font-mono font-bold text-[var(--text-primary)]">{totalCount}</div>
              <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between pt-1">
                <span>Discovered in root</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-primary)]" />
              </div>
            </div>

            {/* Dirty Repos */}
            <div
              onClick={() => setActiveView && setActiveView('attention')}
              className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-amber-500/40 transition-all duration-200 space-y-2 cursor-pointer group shadow-xs"
            >
              <div className="text-[10px] uppercase font-bold font-mono text-amber-500 tracking-wider">Uncommitted</div>
              <div className="text-3xl font-mono font-bold text-amber-500">{dirtyCount}</div>
              <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between pt-1">
                <span>Filter dirty repos</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
              </div>
            </div>

            {/* Ahead Commits */}
            <div
              onClick={() => setActiveView && setActiveView('attention')}
              className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-rose-500/40 transition-all duration-200 space-y-2 cursor-pointer group shadow-xs"
            >
              <div className="text-[10px] uppercase font-bold font-mono text-rose-500 tracking-wider">Unpushed</div>
              <div className="text-3xl font-mono font-bold text-rose-500">{aheadCount}</div>
              <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between pt-1">
                <span>Filter ahead repos</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500" />
              </div>
            </div>

            {/* Clean Repos */}
            <div
              onClick={() => setActiveView && setActiveView('all')}
              className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-emerald-500/40 transition-all duration-200 space-y-2 cursor-pointer group shadow-xs"
            >
              <div className="text-[10px] uppercase font-bold font-mono text-emerald-500 tracking-wider">Clean</div>
              <div className="text-3xl font-mono font-bold text-emerald-500">{cleanCount}</div>
              <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between pt-1">
                <span>Fully synced repos</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
              </div>
            </div>
          </div>

          {/* Expanded Full-Width 2-Column Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Priority Attention Repos Panel (Left 2 columns on wide screens) */}
            <div className="lg:col-span-2 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-mono font-bold uppercase text-[var(--text-primary)]">
                    Requires Attention ({attentionRepos.length})
                  </h3>
                </div>
                <button
                  onClick={() => setActiveView && setActiveView('attention')}
                  className="text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {attentionRepos.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)] space-y-1">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto opacity-70 mb-2" />
                  <div className="text-[var(--text-primary)] font-semibold">Workspace fully synced!</div>
                  <div>No repos have uncommitted changes or unpushed commits.</div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 font-mono text-xs">
                  {attentionRepos.slice(0, 6).map((r) => {
                    const isDirty = r.status === 'dirty' || (r.changedFiles && r.changedFiles.length > 0);
                    const isAhead = r.aheadCount > 0;
                    return (
                      <div
                        key={r.id}
                        onClick={() => selectRepo(r.id)}
                        className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer group"
                      >
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text-primary)] text-xs group-hover:underline">
                              {r.name}
                            </span>
                            {r.branch && (
                              <span className="px-1.5 py-0.2 rounded bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border-subtle)] text-[10px]">
                                {r.branch}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate">
                            {r.localPath}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isDirty && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold text-[10px]">
                              {r.changedFiles ? r.changedFiles.length : 0} modified
                            </span>
                          )}
                          {isAhead && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 font-bold text-[10px]">
                              +{r.aheadCount} ahead
                            </span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--text-ghost)] group-hover:text-[var(--text-primary)] transition-colors ml-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Root Directory & Quick Shortcuts (1 column on wide screens) */}
            <div className="space-y-6">
              {/* Root Directory Info Card */}
              <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3 shadow-xs">
                <div className="text-[10px] uppercase font-mono font-bold text-[var(--text-muted)] tracking-wider">
                  Workspace Root
                </div>
                <div className="text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-raised)] p-2.5 rounded-lg border border-[var(--border-subtle)] break-all">
                  {config?.rootPath || 'Not Configured'}
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-1">
                  <span className="px-2.5 py-1 rounded-md bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    {githubCount} GitHub Remotes
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    {localCount} Local Only
                  </span>
                </div>
              </div>

              {/* Keyboard Shortcuts Card */}
              <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3 shadow-xs">
                <div className="text-[10px] uppercase font-mono font-bold text-[var(--text-muted)] tracking-wider">
                  Keyboard Shortcuts
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[var(--text-secondary)] p-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)]">
                    <span>Spotlight Search</span>
                    <kbd className="px-2 py-0.5 rounded bg-[var(--bg-active)] text-[var(--text-primary)] font-bold border border-[var(--border-strong)] text-[10px]">
                      Ctrl + K
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between text-[var(--text-secondary)] p-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)]">
                    <span>Trigger Rescan</span>
                    <kbd className="px-2 py-0.5 rounded bg-[var(--bg-active)] text-[var(--text-primary)] font-bold border border-[var(--border-strong)] text-[10px]">
                      R
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between text-[var(--text-secondary)] p-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)]">
                    <span>Clear Selection</span>
                    <kbd className="px-2 py-0.5 rounded bg-[var(--bg-active)] text-[var(--text-primary)] font-bold border border-[var(--border-strong)] text-[10px]">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (loading && !activeRepo) {
    return (
      <main className="flex-1 bg-[var(--bg-base)] flex flex-col items-center justify-center text-[var(--text-muted)] font-mono text-xs select-none z-10">
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mb-3" />
        Loading repository details...
      </main>
    );
  }

  if (error && !activeRepo) {
    return (
      <main className="flex-1 bg-[var(--bg-base)] flex flex-col items-center justify-center text-rose-500 p-6 text-center select-none z-10">
        <AlertTriangle className="w-10 h-10 mb-3 opacity-80 text-rose-500" />
        <div className="text-base font-semibold font-mono">Unable to read repository details</div>
        <div className="text-xs text-[var(--text-muted)] mt-2 max-w-md">{error}</div>
      </main>
    );
  }

  if (!activeRepo) return null;

  const handleOpenExplorer = async () => {
    try {
      await invoke('open_in_explorer', { path: activeRepo.localPath });
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  const handleOpenVSCode = async () => {
    try {
      await invoke('open_in_vscode', { path: activeRepo.localPath });
    } catch (err) {
      console.error('Failed to open VS Code:', err);
    }
  };

  const handleOpenTerminal = async () => {
    try {
      await invoke('open_terminal', { path: activeRepo.localPath });
    } catch (err) {
      console.error('Failed to open terminal:', err);
    }
  };

  const handleCopyPath = async () => {
    const { showToast } = useRepoStore.getState();
    try {
      await navigator.clipboard.writeText(activeRepo.localPath);
      showToast('Path copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const isClean = activeRepo.status === 'clean';
  const isDiverged = activeRepo.status === 'diverged';

  const hasAhead = activeRepo.aheadCommits && activeRepo.aheadCommits.length > 0;
  const hasChanges = activeRepo.changedFiles && activeRepo.changedFiles.length > 0;
  const changesCount = activeRepo.changedFiles ? activeRepo.changedFiles.length : 0;
  const aheadCount = activeRepo.aheadCommits ? activeRepo.aheadCommits.length : 0;

  return (
    <main className="flex-1 bg-[var(--bg-base)] flex flex-col font-sans overflow-hidden z-10 transition-colors">
      {/* Project Hero Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] select-none">
        <div className="w-full max-w-7xl mx-auto space-y-3.5">

          {/* Row 1: Title & Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Title & Branch Badge */}
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] font-mono truncate">
                {activeRepo.name}
              </h1>
              {activeRepo.branch && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono text-xs font-medium shrink-0">
                  <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                  {activeRepo.branch}
                </span>
              )}
            </div>

            {/* Quick Actions Toolbar */}
            <div className="relative shrink-0">
              {/* Inline Buttons for Medium and Large Screens (md+) */}
              <div className="hidden md:flex items-center gap-2">
                {aheadCount > 0 && (
                  <button
                    onClick={handlePush}
                    disabled={isPushing}
                    title="Push commits to remote"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 font-mono text-xs font-semibold transition-all shadow-xs"
                  >
                    <Upload className={`w-3.5 h-3.5 ${isPushing ? 'animate-bounce' : ''}`} />
                    <span>{isPushing ? 'Pushing…' : `Push (${aheadCount})`}</span>
                  </button>
                )}

                {changesCount > 0 && (
                  <button
                    onClick={handleStash}
                    disabled={isStashing}
                    title="Stash uncommitted changes"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 font-mono text-xs font-semibold transition-all shadow-xs"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>{isStashing ? 'Stashing…' : 'Stash Changes'}</span>
                  </button>
                )}

                <button
                  onClick={handleOpenVSCode}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--btn-primary-bg)] hover:opacity-90 text-[var(--btn-primary-fg)] font-mono text-xs font-semibold transition-all shadow-xs"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>VSCode</span>
                </button>

                <button
                  onClick={handleOpenTerminal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-mono text-xs font-medium transition-all"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Terminal</span>
                </button>

                <button
                  onClick={handleOpenExplorer}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-mono text-xs font-medium transition-all"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Explorer</span>
                </button>
              </div>

              {/* Compact Dropdown Menu for Small Screens (< md) */}
              <div className="md:hidden">
                <button
                  onClick={() => setIsActionsDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-raised)] border border-[var(--border-strong)] text-[var(--text-primary)] font-mono text-xs font-semibold transition-all shadow-xs"
                >
                  <Code2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Actions</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isActionsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isActionsDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsActionsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 py-1 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-xl shadow-lg z-30 font-mono text-xs animate-fadeIn">
                      {aheadCount > 0 && (
                        <button
                          onClick={() => {
                            setIsActionsDropdownOpen(false);
                            handlePush();
                          }}
                          disabled={isPushing}
                          className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-500/10 flex items-center gap-2 font-medium"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isPushing ? 'Pushing…' : `Push (${aheadCount})`}</span>
                        </button>
                      )}

                      {changesCount > 0 && (
                        <button
                          onClick={() => {
                            setIsActionsDropdownOpen(false);
                            handleStash();
                          }}
                          disabled={isStashing}
                          className="w-full text-left px-3 py-2 text-amber-600 hover:bg-amber-500/10 flex items-center gap-2 font-medium"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>{isStashing ? 'Stashing…' : 'Stash Changes'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsActionsDropdownOpen(false);
                          handleOpenVSCode();
                        }}
                        className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-raised)] flex items-center gap-2 font-medium"
                      >
                        <Code2 className="w-3.5 h-3.5 text-blue-500" />
                        <span>VS Code</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsActionsDropdownOpen(false);
                          handleOpenTerminal();
                        }}
                        className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-raised)] flex items-center gap-2 font-medium"
                      >
                        <Terminal className="w-3.5 h-3.5 text-slate-700" />
                        <span>Terminal</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsActionsDropdownOpen(false);
                          handleOpenExplorer();
                        }}
                        className="w-full text-left px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-raised)] flex items-center gap-2 font-medium"
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                        <span>Explorer</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Breadcrumbs Path */}
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)] min-w-0">
            <span className="truncate max-w-full text-[var(--text-primary)] px-2.5 py-1 rounded-md bg-[var(--bg-raised)] border border-[var(--border-subtle)] inline-block">
              {activeRepo.localPath}
            </span>
            <button
              onClick={handleCopyPath}
              title="Copy Path"
              className="p-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 3: Tab Navigation Segment */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-xs font-mono w-full sm:w-auto sm:inline-flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-strong)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('changes')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'changes'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-strong)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>Local Changes</span>
              {changesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
                  {changesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('commits')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'commits'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-strong)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>Unpushed</span>
              {aheadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 text-[10px] font-bold">
                  {aheadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('cleaner')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'cleaner'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-strong)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 text-current shrink-0" />
              <span>Artifact Cleaner</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Tab View */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="w-full max-w-7xl mx-auto space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {isDiverged && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-mono">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                  <span>This branch has diverged from upstream. Local and remote commits are both present.</span>
                </div>
              )}

              {/* Status Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 shadow-xs">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold">Repository Status</div>
                  <div className="text-sm font-semibold font-mono text-[var(--text-primary)] flex items-center gap-2 pt-1">
                    {isClean ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Clean Repository</span>
                      </>
                    ) : hasChanges ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>{changesCount} Files Modified</span>
                      </>
                    ) : (
                      <>
                        <GitCommit className="w-4 h-4 text-rose-500" />
                        <span>{aheadCount} Unpushed Commits</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 shadow-xs">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold">Active Branch</div>
                  <div className="text-sm font-semibold font-mono text-[var(--text-primary)] truncate pt-1">
                    {activeRepo.branch || 'None'}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 shadow-xs">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold">Last Commit Date</div>
                  <div className="text-sm font-semibold font-mono text-[var(--text-primary)] truncate pt-1">
                    {activeRepo.lastCommitTime
                      ? new Date(activeRepo.lastCommitTime).toLocaleDateString()
                      : 'No commits'}
                  </div>
                </div>
              </div>

              {/* Responsive Split Section for Local Changes and Commits */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Local Changes Section */}
                <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-mono font-bold text-[var(--text-muted)]">
                      Uncommitted Changes ({changesCount} files)
                    </h3>
                    {hasChanges && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowDiscardConfirm(true)}
                          className="text-xs font-mono text-rose-500 hover:underline"
                        >
                          Discard All
                        </button>
                        <button
                          onClick={() => setActiveTab('changes')}
                          className="text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
                        >
                          <span>View all</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {showDiscardConfirm && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs font-mono text-rose-600 dark:text-rose-300">
                      <span>Discard all {changesCount} uncommitted changes?</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDiscard}
                          disabled={isDiscarding}
                          className="px-2.5 py-1 rounded bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors"
                        >
                          {isDiscarding ? 'Discarding…' : 'Yes, Discard All'}
                        </button>
                        <button
                          onClick={() => setShowDiscardConfirm(false)}
                          className="px-2.5 py-1 rounded bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <FileChangeList files={activeRepo.changedFiles.slice(0, 5)} onSelectFile={(f) => setInspectFile(f)} />
                </div>

                {/* Unpushed Commits Section */}
                <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-mono font-bold text-[var(--text-muted)]">
                      Unpushed Commits ({aheadCount})
                    </h3>
                    {hasAhead && (
                      <button
                        onClick={() => setActiveTab('commits')}
                        className="text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
                      >
                        <span>View all</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <CommitAheadList commits={activeRepo.aheadCommits ? activeRepo.aheadCommits.slice(0, 5) : []} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'changes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs uppercase font-mono font-bold text-[var(--text-muted)]">
                  Modified Files ({changesCount}) &bull; <span className="text-[var(--text-secondary)] font-normal">Click file to inspect diff</span>
                </h2>
                {changesCount > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStash}
                      disabled={isStashing}
                      className="px-3 py-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 text-xs font-mono"
                    >
                      {isStashing ? 'Stashing…' : 'Stash All'}
                    </button>
                    <button
                      onClick={handleDiscard}
                      disabled={isDiscarding}
                      className="px-3 py-1 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-mono"
                    >
                      {isDiscarding ? 'Discarding…' : 'Discard All'}
                    </button>
                  </div>
                )}
              </div>
              <FileChangeList files={activeRepo.changedFiles} onSelectFile={(f) => setInspectFile(f)} />
            </div>
          )}

          {activeTab === 'commits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs uppercase font-mono font-bold text-[var(--text-muted)]">
                  Unpushed Commits ({aheadCount})
                </h2>
                {aheadCount > 0 && (
                  <button
                    onClick={handlePush}
                    disabled={isPushing}
                    className="px-3.5 py-1 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-mono font-bold flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isPushing ? 'Pushing…' : 'Push All Commits'}</span>
                  </button>
                )}
              </div>
              <CommitAheadList commits={activeRepo.aheadCommits || []} />
            </div>
          )}

          {/* Build Artifact Cleaner Tab */}
          {activeTab === 'cleaner' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <h2 className="text-sm uppercase font-mono font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[var(--text-primary)]" />
                    Disk Space & Build Artifact Cleaner
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-sans">
                    Detect and safely remove heavy build directories (`node_modules`, `target`, `.venv`, `dist`) to free up disk space.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setLoadingFolders(true);
                    const folders: any = await invoke('get_heavy_folders', { repoPath: activeRepo.localPath });
                    setHeavyFolders(folders);
                    setLoadingFolders(false);
                  }}
                  disabled={loadingFolders}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFolders ? 'animate-spin' : ''}`} />
                  <span>Rescan Artifacts</span>
                </button>
              </div>

              {loadingFolders ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] font-mono text-xs">
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mb-3" />
                  Scanning project directories for heavy build artifacts...
                </div>
              ) : heavyFolders.length === 0 ? (
                <div className="p-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center text-xs font-mono text-[var(--text-muted)] space-y-2">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                  <div className="text-[var(--text-primary)] font-semibold">No Heavy Build Artifacts Found</div>
                  <div>Project is clean! No large build folders (&gt;1MB) were detected in this repository.</div>
                </div>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1">
                    <span>Found {heavyFolders.length} build folders</span>
                    <span>Total space: {heavyFolders.reduce((acc, f) => acc + f.sizeBytes, 0) > 1000000000 ? (heavyFolders.reduce((acc, f) => acc + f.sizeBytes, 0) / 1073741824).toFixed(2) + ' GB' : (heavyFolders.reduce((acc, f) => acc + f.sizeBytes, 0) / 1048576).toFixed(1) + ' MB'}</span>
                  </div>

                  <div className="space-y-2">
                    {heavyFolders.map((folder) => (
                      <div
                        key={folder.fullPath}
                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all shadow-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text-primary)] text-xs">{folder.name}</span>
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">
                              {folder.relativePath}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate max-w-lg">
                            {folder.fullPath}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <span className="font-bold text-[var(--text-primary)] text-sm">
                            {folder.formattedSize}
                          </span>
                          <button
                            onClick={() => handleCleanFolder(folder.fullPath, folder.name)}
                            disabled={cleaningFolder === folder.fullPath}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{cleaningFolder === folder.fullPath ? 'Cleaning…' : 'Clean'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* File Inspector Modal */}
      <FileInspectorModal
        file={inspectFile}
        repoPath={activeRepo.localPath}
        onClose={() => setInspectFile(null)}
      />
    </main>
  );
};

export default RepoDetail;
