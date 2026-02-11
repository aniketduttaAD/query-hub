import type { ReactNode } from 'react';
import type { ConnectionStatus, MessageType } from '../../types';

interface StatusBadgeProps {
  status: ConnectionStatus | MessageType;
  children?: ReactNode;
  pulse?: boolean;
  isExtendedSession?: boolean;
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

export function StatusBadge({
  status,
  children,
  pulse = false,
  isExtendedSession = false,
}: StatusBadgeProps) {
  const shouldPulse = pulse || status === 'connecting';
  const useExtendedColors = status === 'connected' && isExtendedSession;
  const dotColor = useExtendedColors ? 'bg-orange-500' : statusColors[status];
  const textColor = useExtendedColors ? 'text-orange-600' : statusTextColors[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${textColor}`}>
      <span className="relative flex h-2 w-2">
        {shouldPulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      {children || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
