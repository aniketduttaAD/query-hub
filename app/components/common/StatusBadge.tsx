import type { ReactNode } from 'react';
import type { ConnectionStatus, MessageType } from '../../types';

interface StatusBadgeProps {
  status: ConnectionStatus | MessageType;
  children?: ReactNode;
  pulse?: boolean;
}

const statusColors: Record<ConnectionStatus | MessageType, string> = {
  disconnected: 'bg-gray-400',
  connecting: 'bg-warning',
  connected: 'bg-success',
  error: 'bg-error',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
};

const statusTextColors: Record<ConnectionStatus | MessageType, string> = {
  disconnected: 'text-gray-600',
  connecting: 'text-warning',
  connected: 'text-success',
  error: 'text-error',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
};

export function StatusBadge({ status, children, pulse = false }: StatusBadgeProps) {
  const shouldPulse = pulse || status === 'connecting';

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusTextColors[status]}`}
    >
      <span className="relative flex h-2 w-2">
        {shouldPulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusColors[status]}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColors[status]}`} />
      </span>
      {children || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
