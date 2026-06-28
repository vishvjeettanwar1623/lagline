import React from 'react';
import { ChangedFile } from '../../types/repo';

interface FileChangeListProps {
  files: ChangedFile[];
}

export const FileChangeList: React.FC<FileChangeListProps> = ({ files }) => {
  const getStatusLetter = (status: ChangedFile['status']) => {
    switch (status) {
      case 'added':
        return 'A';
      case 'modified':
        return 'M';
      case 'deleted':
        return 'D';
      case 'renamed':
        return 'R';
      case 'untracked':
        return '?';
      default:
        return ' ';
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-text-ghost text-xs font-mono">
        No local changes
      </div>
    );
  }

  return (
    <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1.5">
      {files.map((file, i) => (
        <div key={i} className="flex items-center gap-3 text-xs font-mono py-1 border-b border-border-subtle/5">
          <span className="inline-flex items-center justify-center w-5 h-5 bg-bg-wash text-text-ghost rounded font-bold text-[10px]">
            {getStatusLetter(file.status)}
          </span>
          <span className="text-text-primary truncate" title={file.path}>
            {file.path}
          </span>
        </div>
      ))}
    </div>
  );
};

export default FileChangeList;
