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
