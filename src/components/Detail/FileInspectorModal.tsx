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
