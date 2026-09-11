import React from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import {
  RefreshCw,
  Settings as SettingsIcon,
  GitBranch,
  Search,
  LayoutDashboard,
  GitPullRequest,
  AlertCircle,
  PanelLeft,
} from 'lucide-react';

interface NavbarProps {
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  activeView: 'dashboard' | 'all' | 'attention';
  setActiveView: (view: 'dashboard' | 'all' | 'attention') => void;
  handleRescan: () => void;
  handleCompare: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSettings,
  onOpenCommandPalette,
  activeView,
  setActiveView,
  handleRescan,
  handleCompare,
  isSidebarOpen = true,
  onToggleSidebar,
}) => {
  const { config, repos, isScanning, isSyncing, selectRepo } = useRepoStore();

  const dirtyCount = repos.filter(
    (r) => r.status === 'dirty' || (r.changedFiles && r.changedFiles.length > 0)
  ).length;

  const aheadCount = repos.filter(
    (r) => r.status === 'ahead' || r.aheadCount > 0
  ).length;

  const attentionTotal = dirtyCount + aheadCount;

  return (
    <header className="h-11 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-2.5 sm:px-3.5 flex items-center justify-between shrink-0 select-none text-xs font-sans z-30 transition-colors gap-2 overflow-x-auto">
      {/* Left Brand & Segmented Navigation */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Mobile/Compact Sidebar Toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            className="p-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Brand */}
        <div
          onClick={() => {
            setActiveView('dashboard');
            selectRepo(null);
          }}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-5 h-5 rounded bg-[var(--brand-bg)] text-[var(--brand-fg)] flex items-center justify-center font-bold text-[11px] font-mono shadow-xs transition-colors shrink-0">
            L
          </div>
          <span className="font-mono font-bold text-xs tracking-tight text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors hidden xs:inline">
            LagLine
          </span>
        </div>

        {/* Minimalist Segmented Navigation Tab Bar */}
        <nav className="flex items-center bg-[var(--bg-raised)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
          <button
            onClick={() => {
              setActiveView('dashboard');
              selectRepo(null);
            }}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs transition-all ${
              activeView === 'dashboard'
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)] font-medium shadow-xs border border-[var(--border-strong)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveView('all')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs transition-all ${
              activeView === 'all'
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)] font-medium shadow-xs border border-[var(--border-strong)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Projects</span>
            <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-mono rounded bg-[var(--border-subtle)] text-[var(--text-primary)] font-medium">
              {repos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('attention')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs transition-all ${
              activeView === 'attention'
                ? 'bg-[var(--bg-active)] text-amber-600 font-medium shadow-xs border border-amber-500/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Attention</span>
            {attentionTotal > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-mono rounded bg-amber-500/20 text-amber-600 font-bold">
                {attentionTotal}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Middle Spotlight Command Trigger */}
      <button
        onClick={onOpenCommandPalette}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all min-w-[140px] sm:min-w-[220px] lg:min-w-[280px] max-w-[360px] text-xs"
      >
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
        <span className="flex-1 text-left font-sans text-xs truncate">Search or type command...</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-base)] text-[var(--text-muted)] rounded border border-[var(--border-subtle)] hidden md:inline-block shrink-0">
          Ctrl K
        </kbd>
      </button>

      {/* Right Action Toolbar */}
      <div className="flex items-center gap-1.5 shrink-0">
        {config?.githubToken && (
          <button
            onClick={handleCompare}
            disabled={isSyncing || isScanning}
            title="Compare remotes with GitHub"
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
              isSyncing
                ? 'bg-[var(--bg-raised)] border-blue-500/40 text-blue-500 animate-pulse'
                : 'bg-[var(--bg-raised)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden md:inline">{isSyncing ? 'Syncing…' : 'Sync Remotes'}</span>
          </button>
        )}

        <button
          onClick={handleRescan}
          disabled={isScanning || isSyncing || !config?.rootPath}
          title="Rescan workspace folders"
          className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
            isScanning
              ? 'bg-[var(--bg-raised)] border-blue-500/40 text-blue-500 animate-pulse'
              : 'bg-[var(--bg-raised)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-blue-500' : ''}`} />
          <span className="hidden md:inline">{isScanning ? 'Scanning…' : 'Rescan'}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-[var(--border-subtle)] my-auto mx-0.5 hidden sm:block" />

        {/* Settings Drawer Button */}
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="p-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};

export default Navbar;
