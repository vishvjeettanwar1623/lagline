import React from 'react';

interface TagProps {
  children: React.ReactNode;
  variant?: 'default' | 'warm';
}

export const Tag: React.FC<TagProps> = ({ children, variant = 'default' }) => {
  const variantStyles = variant === 'warm' 
    ? 'text-accent-warm font-semibold' 
    : 'text-text-secondary';

  return (
    <span className={`bg-bg-wash px-2 py-0.5 rounded border border-border-subtle font-mono text-xs ${variantStyles}`}>
      {children}
    </span>
  );
};

export default Tag;
