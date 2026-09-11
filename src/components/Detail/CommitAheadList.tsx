import React, { useState } from 'react';
import { AheadCommit } from '../../types/repo';
import { GitCommit, Copy, Check } from 'lucide-react';
import { useRepoStore } from '../../store/useRepoStore';

interface CommitAheadListProps {
  commits: AheadCommit[];
}

export const CommitAheadList: React.FC<CommitAheadListProps> = ({ commits }) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const getRelativeTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleCopyHash = async (e: React.MouseEvent, hash: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
      const { showToast } = useRepoStore.getState();
      showToast(`Commit hash ${hash} copied`, 'success');
    } catch (err) {
      console.error('Failed to copy hash:', err);
    }
  };

  if (commits.length === 0) {
    return (
