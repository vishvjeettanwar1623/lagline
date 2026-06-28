import React, { useEffect, useState, useCallback } from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import { invoke } from '@tauri-apps/api/core';
import { RepoInfo } from '../../types/repo';
import FileChangeList from './FileChangeList';
import CommitAheadList from './CommitAheadList';
import { Folder, Terminal, AlertTriangle, Code2, GitCommit, CheckCircle2 } from 'lucide-react';
import Tag from '../shared/Tag';

export const RepoDetail: React.FC = () => {
  const {
    selectedRepoId,
    updateRepo,
    repos,
    config,
  } = useRepoStore();
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const storeRepo = repos.find((r) => r.id === selectedRepoId) || null;

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
  }, [selectedRepoId, updateRepo]);

  const { selectRepo } = useRepoStore();

  // Escape key handler to deselect the current folder
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      selectRepo(null);
    }
  }, [selectRepo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const activeRepo = repo || storeRepo;

  if (!selectedRepoId) {
    const totalCount = repos.length;
    const dirtyCount = repos.filter(r => r.status === 'dirty' || (r.changedFiles && r.changedFiles.length > 0)).length;
    const aheadCount = repos.filter(r => r.status === 'ahead' || r.aheadCount > 0).length;
    const cleanCount = repos.filter(r => r.status === 'clean').length;
    const githubCount = repos.filter(r => r.remoteType === 'github').length;
    const localCount = repos.filter(r => r.remoteType !== 'github').length;

    return (
      <div className="flex-1 bg-bg-base flex flex-col justify-center items-center p-8 select-none overflow-y-auto">
        <div className="max-w-xl w-full space-y-8 animate-fadeIn">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-bg-surface border border-border-subtle flex items-center justify-center shadow-lg">
              <img src="/logo.svg" alt="LagLine Logo" className="w-9 h-9 object-contain" />
            </div>
            <h2 className="text-2xl font-mono font-bold tracking-tight text-text-primary">LagLine Dashboard</h2>
            <p className="text-xs font-mono text-text-ghost">Workspace status overview and statistics</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Total Folders */}
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-bg-wash flex items-center justify-center text-text-secondary shrink-0">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-text-primary">{totalCount}</div>
                <div className="text-[10px] uppercase font-semibold text-text-ghost tracking-wider">Total Scanned</div>
              </div>
            </div>

            {/* Dirty Folders */}
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center text-accent-warm shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-accent-warm">{dirtyCount}</div>
                <div className="text-[10px] uppercase font-semibold text-text-ghost tracking-wider">Dirty Repos</div>
              </div>
            </div>

            {/* Ahead commits */}
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-red-950/20 border border-status-ahead/30 flex items-center justify-center text-status-ahead shrink-0">
                <GitCommit className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-status-ahead">{aheadCount}</div>
                <div className="text-[10px] uppercase font-semibold text-text-ghost tracking-wider">Ahead Upstream</div>
              </div>
            </div>

            {/* Clean Repos */}
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/20 border border-status-clean/30 flex items-center justify-center text-status-clean shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-status-clean">{cleanCount}</div>
                <div className="text-[10px] uppercase font-semibold text-text-ghost tracking-wider">Clean Repos</div>
              </div>
            </div>
          </div>

          {/* Quick Breakdown Info */}
          <div className="bg-bg-surface/50 border border-border-subtle/50 rounded-xl p-4 flex items-center justify-between text-xs font-mono text-text-secondary shadow-sm">
            <div>
              <span className="text-text-ghost">GitHub Remote:</span> <strong className="text-text-primary">{githubCount}</strong>
            </div>
            <div className="text-text-ghost">•</div>
            <div>
              <span className="text-text-ghost">Local/Other:</span> <strong className="text-text-primary">{localCount}</strong>
            </div>
            <div className="text-text-ghost">•</div>
            <div>
              <span className="text-text-ghost">Root:</span> <code className="text-[#d2a374]">{config?.rootPath ? config.rootPath.split(/[\\/]/).pop() : 'Not Set'}</code>
            </div>
          </div>

          {/* Footer Guide */}
          <div className="text-center space-y-1">
            <p className="text-xs font-sans text-text-secondary">Click on any project in the sidebar list to inspect details</p>
            <p className="text-[10px] font-mono text-text-ghost opacity-60">Press <kbd className="bg-bg-wash px-1.5 rounded border border-border-subtle text-text-secondary">Esc</kbd> anywhere to return to this dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !activeRepo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-base text-text-secondary font-mono text-xs select-none">
        Reading repository info...
      </div>
    );
  }

  if (error && !activeRepo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-base text-status-ahead p-6 text-center select-none">
        <AlertTriangle className="w-8 h-8 mb-3 opacity-60" />
        <div className="text-sm font-mono font-semibold">Unable to read repository</div>
        <div className="text-xs text-text-ghost mt-1.5 max-w-md">{error}</div>
      </div>
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

  const isNonGit = activeRepo.status === 'non-git';
  const isClean = activeRepo.status === 'clean';
  const isUnlinked = activeRepo.status === 'unlinked';
  const isDiverged = activeRepo.status === 'diverged';
  const isOtherRemote = activeRepo.remoteType === 'other';

  const hasAhead = activeRepo.aheadCommits && activeRepo.aheadCommits.length > 0;
  const hasBehind = activeRepo.behindCommits && activeRepo.behindCommits.length > 0;
  const hasChanges = activeRepo.changedFiles && activeRepo.changedFiles.length > 0;

  return (
    <div className="flex-1 bg-bg-base flex flex-col font-sans overflow-hidden">
      {/* Repo header */}
      <div className="px-6 py-4 border-b border-border-subtle select-none">
        <h2 className="text-2xl font-mono text-text-primary tracking-tight font-bold truncate">
          {activeRepo.name}
        </h2>
        <div className="flex items-center gap-3 mt-2 text-xs font-mono text-text-secondary">
          {!isNonGit && activeRepo.branch && <Tag>{activeRepo.branch}</Tag>}
          {isNonGit && <span className="text-text-ghost font-semibold">(non-Git folder)</span>}
          {!isNonGit && activeRepo.lastCommitTime && (
            <span>last commit {new Date(activeRepo.lastCommitTime).toLocaleDateString()}</span>
          )}
          {!isNonGit && !activeRepo.lastCommitTime && !isUnlinked && (
            <span className="text-text-ghost">(empty repository)</span>
          )}
          {isUnlinked && !isNonGit && <span className="text-text-ghost font-semibold">(no remote)</span>}
          {isOtherRemote && !isNonGit && <Tag variant="warm">Non-GitHub remote</Tag>}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isDiverged && (
          <div className="flex items-center gap-3 p-3 bg-amber-950/20 border border-accent-warm/30 text-accent-warm text-xs font-mono rounded">
            <AlertTriangle className="w-4 h-4 shrink-0 text-accent-warm" />
            This branch has diverged from remote. You have both local and remote commits.
          </div>
        )}

        {isNonGit ? (
          <div className="h-[250px] flex flex-col items-center justify-center text-text-ghost text-xs font-mono select-none space-y-2">
            <div>This folder is not a Git repository.</div>
            <div className="text-[10px] text-text-secondary">Initialize it as a Git repository to track changes.</div>
          </div>
        ) : isClean ? (
          <div className="h-[250px] flex items-center justify-center text-text-ghost text-xs font-mono select-none">
            This repo is clean.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            {/* Unpushed commits */}
            {hasAhead && (
              <div className="bg-bg-surface border border-border-subtle rounded-md p-4 flex flex-col min-w-0">
                <h3 className="text-xs text-text-secondary uppercase tracking-wider font-semibold font-mono mb-3 select-none">
                  Unpushed Commits ({activeRepo.aheadCommits.length})
                </h3>
                <div className="flex-1">
                  <CommitAheadList commits={activeRepo.aheadCommits} />
                </div>
              </div>
            )}

            {/* Behind commits */}
            {hasBehind && (
              <div className="bg-bg-surface border border-border-subtle rounded-md p-4 flex flex-col min-w-0">
                <h3 className="text-xs text-text-secondary uppercase tracking-wider font-semibold font-mono mb-3 select-none">
                  On GitHub, not here ({activeRepo.behindCommits?.length})
                </h3>
                <div className="flex-1">
                  <CommitAheadList commits={activeRepo.behindCommits || []} />
                </div>
              </div>
            )}

            {/* Local changes */}
            {hasChanges && (
              <div className="bg-bg-surface border border-border-subtle rounded-md p-4 flex flex-col min-w-0">
                <h3 className="text-xs text-text-secondary uppercase tracking-wider font-semibold font-mono mb-3 select-none">
                  Local Changes ({activeRepo.changedFiles.length} files)
                </h3>
                <div className="flex-1">
                  <FileChangeList files={activeRepo.changedFiles} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border-subtle bg-bg-surface/30 flex gap-3 select-none">
        <button
          onClick={handleOpenExplorer}
          className="flex items-center gap-2 px-4 py-2 bg-bg-wash hover:bg-bg-raised text-text-primary text-xs font-mono rounded border border-border-subtle transition-colors duration-150"
        >
          <Folder className="w-3.5 h-3.5" />
          Open in Explorer
        </button>
        <button
          onClick={handleOpenVSCode}
          className="flex items-center gap-2 px-4 py-2 bg-bg-wash hover:bg-bg-raised text-text-primary text-xs font-mono rounded border border-border-subtle transition-colors duration-150"
        >
          <Code2 className="w-3.5 h-3.5" />
          Open in VSCode
        </button>
        <button
          onClick={handleOpenTerminal}
          className="flex items-center gap-2 px-4 py-2 bg-bg-wash hover:bg-bg-raised text-text-primary text-xs font-mono rounded border border-border-subtle transition-colors duration-150"
        >
          <Terminal className="w-3.5 h-3.5" />
          Open Terminal
        </button>
      </div>
    </div>
  );
};

export default RepoDetail;
