import React from 'react';
import { ChangedFile } from '../../types/repo';
import { FileCode, Eye } from 'lucide-react';

interface FileChangeListProps {
  files: ChangedFile[];
  onSelectFile?: (file: ChangedFile) => void;
}

export const FileChangeList: React.FC<FileChangeListProps> = ({ files, onSelectFile }) => {
  const getStatusBadge = (status: ChangedFile['status']) => {
    switch (status) {
      case 'added':
        return {
          letter: 'A',
          style: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        };
      case 'modified':
        return {
          letter: 'M',
          style: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
        };
      case 'deleted':
        return {
          letter: 'D',
          style: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
        };
      case 'renamed':
        return {
          letter: 'R',
          style: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
        };
      case 'untracked':
      default:
        return {
          letter: '?',
          style: 'bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
        };
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] text-xs font-mono">
        <FileCode className="w-8 h-8 mb-2 opacity-40 text-[var(--text-muted)]" />
        No uncommitted local changes
      </div>
    );
  }

  return (
    <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
      {files.map((file, i) => {
        const badge = getStatusBadge(file.status);
        const parts = file.path.split(/[/\\]/);
        const fileName = parts.pop() || file.path;
        const dirPath = parts.length > 0 ? parts.join('/') + '/' : '';

        return (
          <div
            key={i}
            onClick={() => onSelectFile && onSelectFile(file)}
            className="group flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] border shrink-0 ${badge.style}`}>
                {badge.letter}
              </span>
              <div className="min-w-0 flex-1 truncate">
                <span className="text-[var(--text-primary)] font-medium transition-colors">{fileName}</span>
                {dirPath && <span className="text-[var(--text-muted)] text-[11px] ml-2 truncate">{dirPath}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] uppercase font-mono text-[var(--text-secondary)] px-2 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                {file.status}
              </span>
              <span className="p-1 rounded text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                <Eye className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FileChangeList;
