import React from 'react';
import { RepoStatus } from '../../types/repo';

interface StatusDotProps {
  status: RepoStatus;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'ahead':
        return { backgroundColor: 'var(--status-ahead)' };
      case 'behind':
        return { backgroundColor: 'var(--status-behind)' };
      case 'dirty':
        return { backgroundColor: 'var(--status-dirty)' };
      case 'clean':
        return { backgroundColor: 'var(--status-clean)' };
      case 'diverged':
        return {
          background: 'linear-gradient(90deg, var(--status-ahead) 50%, var(--status-behind) 50%)',
        };
      case 'unlinked':
        return {
          border: '1.5px solid var(--status-unlinked)',
          backgroundColor: 'transparent',
        };
      default:
        return { backgroundColor: 'var(--text-ghost)' };
    }
  };

  return (
    <div
      className="w-1.5 h-1.5 rounded-full shrink-0"
      style={getStyle()}
      title={`Status: ${status}`}
    />
  );
};

export default StatusDot;
