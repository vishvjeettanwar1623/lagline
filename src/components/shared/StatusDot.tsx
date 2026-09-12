import React from 'react';
import { RepoStatus } from '../../types/repo';

interface StatusDotProps {
  status: RepoStatus;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status }) => {
  const getStyleClass = () => {
    switch (status) {
      case 'ahead':
        return 'bg-rose-400 aura-rose';
      case 'behind':
        return 'bg-purple-400 aura-purple';
      case 'dirty':
        return 'bg-amber-400 aura-amber';
      case 'clean':
        return 'bg-emerald-400 aura-emerald';
      case 'diverged':
        return 'bg-gradient-to-r from-rose-400 to-purple-400 aura-rose';
      case 'unlinked':
      case 'non-git':
      default:
        return 'bg-zinc-500/60';
    }
  };

  return (
    <div
      className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${getStyleClass()}`}
      title={`Status: ${status}`}
    />
  );
};

export default StatusDot;
