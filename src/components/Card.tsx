import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-4'
  };

  return (
    <div className={`bg-white rounded-xl border border-neutral-200 shadow-sm ${paddingStyles[padding]} ${className}`}>
      {children}
    </div>
  );
}
