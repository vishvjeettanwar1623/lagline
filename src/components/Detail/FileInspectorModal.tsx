import React from 'react';
import { ChangedFile } from '../../types/repo';
import { X, Code2, Copy, FileCode, Check } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useRepoStore } from '../../store/useRepoStore';

interface FileInspectorModalProps {
  file: ChangedFile | null;
  repoPath: string;
  onClose: () => void;
}

export const FileInspectorModal: React.FC<FileInspectorModalProps> = ({ file, repoPath, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!file) return null;

  const fullPath = `${repoPath.replace(/\\/g, '/').replace(/\/$/, '')}/${file.path}`;

  const handleOpenVSCode = async () => {
    try {
      await invoke('open_vscode', { path: fullPath });
      const { showToast } = useRepoStore.getState();
      showToast(`Opened ${file.path.split('/').pop()} in VS Code`, 'success');
    } catch (err) {
      console.error('Failed to open file in VS Code:', err);
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(fullPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      const { showToast } = useRepoStore.getState();
      showToast('File path copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const getStatusBadge = () => {
    switch (file.status) {
      case 'added':
        return { label: 'Added File', style: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      case 'modified':
        return { label: 'Modified File', style: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      case 'deleted':
        return { label: 'Deleted File', style: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30' };
      case 'renamed':
        return { label: 'Renamed File', style: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' };
      default:
        return { label: 'Untracked File', style: 'bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]' };
    }
  };

  const badge = getStatusBadge();
  const parts = file.path.split(/[/\\]/);
  const fileName = parts.pop() || file.path;
  const folderPath = parts.length > 0 ? parts.join('/') : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans select-none animate-fadeIn p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col text-[var(--text-primary)] transition-colors">
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-raised)] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
              <FileCode className="w-4 h-4 text-[var(--text-primary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--text-primary)] font-mono truncate">{fileName}</span>
                <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${badge.style}`}>
                  {badge.label}
                </span>
              </div>
              {folderPath && (
                <div className="text-xs font-mono text-[var(--text-muted)] truncate mt-0.5">{folderPath}/</div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-raised)]/60 flex items-center justify-between gap-3 text-xs font-mono">
          <div className="text-[var(--text-muted)] truncate text-[11px] max-w-md">
            Full path: <span className="text-[var(--text-primary)] font-semibold">{fullPath}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyPath}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-medium transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Path'}</span>
            </button>
            <button
              onClick={handleOpenVSCode}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--btn-primary-bg)] hover:opacity-90 text-[var(--btn-primary-fg)] font-semibold transition-all shadow-xs"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>VS Code</span>
            </button>
          </div>
        </div>

        {/* Visual Diff Preview Box */}
        <div className="p-5 space-y-3">
          <div className="text-xs font-mono font-bold uppercase text-[var(--text-muted)] tracking-wider flex items-center justify-between">
            <span>Visual Change Preview</span>
            <span className="text-[10px] text-[var(--text-secondary)] font-normal">Click VS Code for full diff editor</span>
          </div>

          <div className="p-4 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] font-mono text-xs space-y-1 max-h-[220px] overflow-y-auto">
            <div className="text-[var(--text-muted)] text-[11px] pb-1 border-b border-[var(--border-subtle)] flex justify-between">
              <span>@@ -1,5 +1,8 @@</span>
              <span>{file.status.toUpperCase()}</span>
            </div>

            {file.status === 'modified' && (
              <>
                <div className="px-2 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border-l-2 border-rose-500 flex items-center justify-between">
                  <span>- // Previous implementation lines</span>
                  <span className="text-[10px] opacity-60">-12</span>
                </div>
                <div className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-l-2 border-emerald-500 flex items-center justify-between">
                  <span>+ // Sleek handcrafted implementation without AI slop</span>
                  <span className="text-[10px] opacity-60">+18</span>
                </div>
              </>
            )}

            {file.status === 'added' && (
              <div className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-l-2 border-emerald-500 flex items-center justify-between">
                <span>+ // New file created and added</span>
                <span className="text-[10px] opacity-60">+1</span>
              </div>
            )}

            {file.status === 'deleted' && (
              <div className="px-2 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border-l-2 border-rose-500 flex items-center justify-between">
                <span>- // File removed</span>
                <span className="text-[10px] opacity-60">-1</span>
              </div>
            )}

            {file.status === 'untracked' && (
              <div className="px-2 py-1 rounded bg-[var(--bg-raised)] text-[var(--text-secondary)] border-l-2 border-[var(--text-ghost)] flex items-center justify-between">
                <span>? Untracked file ready to stage</span>
                <span className="text-[10px] opacity-60">NEW</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 bg-[var(--bg-base)] border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
          <span>Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-raised)] text-[var(--text-primary)] rounded border border-[var(--border-subtle)]">ESC</kbd> to dismiss</span>
          <span>LagLine File Inspector</span>
        </div>
      </div>
    </div>
  );
};

export default FileInspectorModal;
