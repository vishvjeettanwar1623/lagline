import React, { useState, useEffect, useRef } from 'react';
import { useRepoStore } from '../../store/useRepoStore';
import { RepoInfo } from '../../types/repo';
import { Search, GitBranch, RefreshCw, Settings as SettingsIcon, Folder, AlertTriangle, Star } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onRescan: () => void;
  onCompare: () => void;
  setActiveView: (view: 'dashboard' | 'all' | 'attention') => void;
}

interface PaletteActionItem {
  id: string;
  type: 'action';
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  perform: () => void;
}

interface PaletteRepoItem {
  id: string;
  type: 'repo';
  label: string;
  sublabel: string;
  repo: RepoInfo;
  isPinned: boolean;
  hasChanges: boolean;
  hasAhead: boolean;
  perform: () => void;
}

type PaletteItem = PaletteActionItem | PaletteRepoItem;

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onRescan,
  onCompare,
  setActiveView,
}) => {
  const { repos, selectRepo, config } = useRepoStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const actionItems: PaletteActionItem[] = [
    {
      id: 'action-rescan',
      type: 'action',
      label: 'Rescan Workspace Folders',
      icon: <RefreshCw className="w-4 h-4 text-white" />,
      perform: () => {
        onRescan();
        onClose();
      },
    },
    {
      id: 'action-compare',
      type: 'action',
      label: 'Compare Remotes with GitHub',
      icon: <GitBranch className="w-4 h-4 text-blue-400" />,
      perform: () => {
        onCompare();
        onClose();
      },
    },
    {
      id: 'action-attention',
      type: 'action',
      label: 'Filter Projects Needing Attention',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      perform: () => {
        setActiveView('attention');
        onClose();
      },
    },
    {
      id: 'action-settings',
      type: 'action',
      label: 'Open Settings',
      icon: <SettingsIcon className="w-4 h-4 text-[#a1a1aa]" />,
      perform: () => {
        onOpenSettings();
        onClose();
      },
    },
  ];

  const matchingRepos: PaletteRepoItem[] = repos
    .filter((r) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.localPath.toLowerCase().includes(q);
    })
    .map((r) => ({
      id: r.id,
      type: 'repo',
      label: r.name,
      sublabel: r.localPath,
      repo: r,
      isPinned: config?.pinnedPaths?.includes(r.localPath) || false,
      hasChanges: (r.changedFiles && r.changedFiles.length > 0) || false,
      hasAhead: r.aheadCount > 0,
      perform: () => {
        selectRepo(r.id);
        setActiveView('all');
        onClose();
      },
    }));

  const combinedList: PaletteItem[] = query.trim()
    ? matchingRepos
    : [...actionItems, ...matchingRepos.slice(0, 8)];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, combinedList.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 < 0 ? combinedList.length - 1 : prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (combinedList[selectedIndex]) {
          combinedList[selectedIndex].perform();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, combinedList, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 font-sans select-none animate-fadeIn p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Spotlight Command Palette Container */}
      <div className="relative w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col text-[var(--text-primary)] transition-colors">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-raised)]">
          <Search className="w-4 h-4 text-[var(--text-primary)] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search project names..."
            className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] focus:outline-none font-sans"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-base)] text-[var(--text-muted)] rounded border border-[var(--border-subtle)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[340px] overflow-y-auto p-1.5 space-y-0.5">
          {combinedList.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)] font-mono">
              No matching commands or projects.
            </div>
          ) : (
            combinedList.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.perform}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-all ${
                    isSelected ? 'bg-[var(--bg-active)] text-[var(--text-primary)] font-medium border border-[var(--border-strong)]' : 'hover:bg-[var(--bg-hover)] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {item.type === 'action' ? (
                        item.icon
                      ) : (
                        <Folder className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate flex items-center gap-2">
                        <span>{item.label}</span>
                        {item.type === 'repo' && item.isPinned && (
                          <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />
                        )}
                      </div>
                      {item.sublabel && (
                        <div className="text-[10px] font-mono text-[var(--text-muted)] truncate mt-0.5">
                          {item.sublabel}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status pills */}
                  {item.type === 'repo' && (
                    <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                      {item.hasChanges && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 font-semibold">
                          {item.repo.changedFiles.length} dirty
                        </span>
                      )}
                      {item.hasAhead && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 font-semibold">
                          +{item.repo.aheadCount} ahead
                        </span>
                      )}
                      {!item.hasChanges && !item.hasAhead && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 font-semibold">
                          clean
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[var(--bg-base)] border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 bg-[var(--bg-raised)] text-[var(--text-secondary)] rounded border border-[var(--border-subtle)]">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 bg-[var(--bg-raised)] text-[var(--text-secondary)] rounded border border-[var(--border-subtle)]">↵</kbd> Select</span>
          </div>
          <div>Spotlight Search</div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
