import { Database, Trash2, Play, Square, Clock } from 'lucide-react';
import { Button, StatusBadge } from '../common';
import { useConnectionStore } from '../../stores';
import type { Connection } from '../../types';

export function ConnectionList() {
  const {
    connections,
    activeConnection,
    connectionStatus,
    connectingConnectionId,
    connect,
    disconnect,
    removeConnection,
  } = useConnectionStore();

  const handleConnect = async (connection: Connection) => {
    if (activeConnection?.connectionId === connection.id) {
      await disconnect();
    } else {
      await connect(connection.id);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (connections.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary">
        <Database className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No saved connections</p>
        <p className="text-xs mt-1">Add a connection above to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Saved Connections
      </h4>
      {connections.map((connection) => {
        const isActive = activeConnection?.connectionId === connection.id;
        const isConnecting =
          connectionStatus === 'connecting' && connectingConnectionId === connection.id;

        return (
          <div
            key={connection.id}
            className={`
              p-3 rounded-lg border transition-all
              ${isActive ? 'border-accent bg-accent/5' : 'border-border hover:border-secondary'}
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Database
                    className={`w-4 h-4 flex-shrink-0 ${
                      connection.type === 'mongodb' ? 'text-success' : 'text-info'
                    }`}
                  />
                  <span className="font-medium text-sm truncate">{connection.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-text-secondary capitalize">{connection.type}</span>
                  {isActive && <StatusBadge status={connectionStatus} />}
                </div>
                {connection.lastUsed && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-text-muted">
                    <Clock className="w-3 h-3" />
                    Last used: {formatDate(connection.lastUsed)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant={isActive ? 'accent' : 'ghost'}
                  size="sm"
                  onClick={() => handleConnect(connection)}
                  isLoading={isConnecting}
                  title={isActive ? 'Disconnect' : 'Connect'}
                >
                  {isActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeConnection(connection.id)}
                  title="Delete"
                  disabled={isActive}
                  className="text-error hover:text-error"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
