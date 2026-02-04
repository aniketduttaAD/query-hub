import { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

export function Panel({ children, className = '', padding = 'md' }: PanelProps) {
  return (
    <div
      className={`
        bg-surface rounded-lg border border-border
        shadow-sm
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function PanelHeader({ children, className = '', actions }: PanelHeaderProps) {
  return (
    <div
      className={`
        flex items-center justify-between
        pb-3 mb-3 border-b border-border
        ${className}
      `}
    >
      <h3 className="text-sm font-semibold text-primary">{children}</h3>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
