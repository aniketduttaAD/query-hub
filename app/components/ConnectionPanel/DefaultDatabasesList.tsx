import { useState, useEffect, useMemo } from 'react';
import { Database, Play, Square, Check, Trash2 } from 'lucide-react';
import { Button, StatusBadge, Input } from '../common';
import { useConnectionStore } from '../../stores';
import type { Connection } from '../../types';

interface DefaultDatabasesListProps {
  savedConnectionsByType?: Record<string, Connection>;
  defaultConnectionsToShow?: Connection[];
}

export function DefaultDatabasesList({
  savedConnectionsByType = {},
  defaultConnectionsToShow = [],
}: DefaultDatabasesListProps) {
  const {
    defaultDatabases,
    selectedDefaultDb,
    activeConnection,
    connectionStatus,
    connectingConnectionId,
    defaultUnlocked,
    connect,
    disconnect,
    setSelectedDefaultDb,
    removeConnection,
  } = useConnectionStore();

  const [useDefaultCredsMap, setUseDefaultCredsMap] = useState<Record<string, boolean>>({});
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [connectionNames, setConnectionNames] = useState<Record<string, string>>({});
  const [isTestingMap, setIsTestingMap] = useState<Record<string, boolean>>({});
  const [testResultMap, setTestResultMap] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  useEffect(() => {
    if (defaultDatabases.length > 0) {
      setUseDefaultCredsMap((prev) => {
        const updated = { ...prev };
        defaultDatabases.forEach((db) => {
          if (!(db.id in updated)) {
            updated[db.id] = true;
          }
        });
        return updated;
      });
    }
  }, [defaultDatabases]);

  const handleConnect = async (
    connection: Connection,
    useDefaultCredentials: boolean,
    customUrl?: string,
    isSavedConnection?: boolean,
  ) => {
    if (activeConnection?.connectionId === connection.id) {
      await disconnect();
      return;
    }
    if (!isSavedConnection) {
      setSelectedDefaultDb(connection.id);
    }
    await connect(connection.id, !useDefaultCredentials, customUrl);
  };

  const handleDefaultCredsToggle = (connectionId: string, checked: boolean) => {
    setUseDefaultCredsMap((prev) => ({ ...prev, [connectionId]: checked }));
    if (checked) {
      setCustomUrls((prev) => {
        const updated = { ...prev };
        delete updated[connectionId];
        return updated;
      });
    }
  };

  const handleCustomUrlChange = (connectionId: string, url: string) => {
    setCustomUrls((prev) => ({ ...prev, [connectionId]: url }));
    setTestResultMap((prev) => {
      const updated = { ...prev };
      delete updated[connectionId];
      return updated;
    });
  };

  const handleConnectionNameChange = (connectionId: string, name: string) => {
    setConnectionNames((prev) => ({ ...prev, [connectionId]: name }));
  };

  const handleTest = async (connection: Connection) => {
    const url = customUrls[connection.id] ?? '';
    if (!url.trim()) return;

    setIsTestingMap((prev) => ({ ...prev, [connection.id]: true }));
    setTestResultMap((prev) => {
      const updated = { ...prev };
      delete updated[connection.id];
      return updated;
    });

    try {
      const { testConnection } = useConnectionStore.getState();
      const success = await testConnection(connection.type, url);
      setTestResultMap((prev) => ({
        ...prev,
        [connection.id]: {
          success,
          message: success ? 'Connection successful!' : 'Connection failed',
        },
      }));
    } catch (error) {
      setTestResultMap((prev) => ({
        ...prev,
        [connection.id]: {
          success: false,
          message: error instanceof Error ? error.message : 'Connection failed',
        },
      }));
    } finally {
      setIsTestingMap((prev) => {
        const updated = { ...prev };
        delete updated[connection.id];
        return updated;
      });
    }
  };

  const handleSave = async (connection: Connection) => {
    const name = connectionNames[connection.id] ?? '';
    const url = customUrls[connection.id] ?? '';
    if (!name.trim() || !url.trim()) return;

    const { addConnection } = useConnectionStore.getState();
    await addConnection(name, connection.type, url);
    setConnectionNames((prev) => {
      const updated = { ...prev };
      delete updated[connection.id];
      return updated;
    });
    setCustomUrls((prev) => {
      const updated = { ...prev };
      delete updated[connection.id];
      return updated;
    });
    setTestResultMap((prev) => {
      const updated = { ...prev };
      delete updated[connection.id];
      return updated;
    });
    setUseDefaultCredsMap((prev) => ({ ...prev, [connection.id]: true }));
  };

  const placeholders: Record<string, string> = {
    mongodb: 'mongodb://user:password@localhost:27017/database',
    postgresql: 'postgresql://user:password@localhost:5432/database',
    mysql: 'mysql://user:password@localhost:3306/database',
  };

  const allConnections = useMemo(() => {
    const result: Array<{ connection: Connection; isSaved: boolean }> = [];

    Object.values(savedConnectionsByType).forEach((conn) => {
      result.push({ connection: conn, isSaved: true });
    });

    defaultConnectionsToShow.forEach((conn) => {
      result.push({ connection: conn, isSaved: false });
    });

    return result;
  }, [savedConnectionsByType, defaultConnectionsToShow]);

  useEffect(() => {
    allConnections.forEach(({ connection }) => {
      if (!(connection.id in useDefaultCredsMap)) {
        setUseDefaultCredsMap((prev) => ({ ...prev, [connection.id]: true }));
      }
    });
  }, [allConnections, useDefaultCredsMap]);

  if (allConnections.length === 0) {
    return null;
  }

  const handleDeleteSaved = async (connection: Connection) => {
    if (activeConnection?.connectionId === connection.id) {
      await disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await removeConnection(connection.id);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Default Databases & Connections
      </h4>
      <div className="space-y-2">
        {allConnections.map(({ connection, isSaved }) => {
          const isActive = activeConnection?.connectionId === connection.id;
          const isConnecting =
            connectionStatus === 'connecting' && connectingConnectionId === connection.id;
          const isSelected = selectedDefaultDb === connection.id;

          return (
            <div
              key={connection.id}
              className={`
                p-3 rounded-lg border transition-all
                ${isActive ? 'border-accent bg-accent/5' : 'border-border hover:border-secondary'}
                ${isSelected ? 'ring-2 ring-accent/50' : ''}
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
                    {isSelected && <Check className="w-3 h-3 text-accent" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-text-secondary capitalize">
                      {connection.type}
                    </span>
                    {isActive && (
                      <StatusBadge
                        status={connectionStatus}
                        isExtendedSession={Boolean(activeConnection?.isDefault && defaultUnlocked)}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant={isActive ? 'accent' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      if (isSaved) {
                        handleConnect(connection, false, undefined, true);
                      } else {
                        const useDefault = useDefaultCredsMap[connection.id] ?? true;
                        const customUrl = useDefault ? undefined : customUrls[connection.id];
                        handleConnect(connection, useDefault, customUrl, false);
                      }
                    }}
                    isLoading={isConnecting}
                    title={isActive ? 'Disconnect' : 'Connect'}
                    disabled={
                      !isSaved &&
                      !(useDefaultCredsMap[connection.id] ?? true) &&
                      !customUrls[connection.id]?.trim()
                    }
                  >
                    {isActive ? (
                      <Square className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  {isSaved && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSaved(connection)}
                      title="Delete saved connection"
                      disabled={isActive}
                      className="text-error hover:text-error"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {!isActive && !isSaved && (
                <div className="mt-2 pt-2 border-t border-border space-y-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useDefaultCredsMap[connection.id] ?? true}
                      onChange={(e) => handleDefaultCredsToggle(connection.id, e.target.checked)}
                      className="w-3 h-3"
                    />
                    <span className="text-text-secondary">Use default credentials</span>
                  </label>

                  {!(useDefaultCredsMap[connection.id] ?? true) && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Input
                            label="Connection Name"
                            value={connectionNames[connection.id] ?? ''}
                            onChange={(e) =>
                              handleConnectionNameChange(connection.id, e.target.value)
                            }
                            placeholder="My Database"
                            className="text-xs"
                          />
                        </div>

                        <Button
                          variant="secondary"
                          onClick={() => handleTest(connection)}
                          isLoading={isTestingMap[connection.id]}
                          disabled={!customUrls[connection.id]?.trim()}
                          size="sm"
                          className="mb-1"
                        >
                          Test Connection
                        </Button>
                      </div>
                      <Input
                        label="Connection URL"
                        value={customUrls[connection.id] ?? ''}
                        onChange={(e) => handleCustomUrlChange(connection.id, e.target.value)}
                        placeholder={placeholders[connection.type]}
                        className="text-xs"
                      />

                      {testResultMap[connection.id] && (
                        <div
                          className={`
                            p-2 rounded-md text-xs
                            ${
                              testResultMap[connection.id].success
                                ? 'bg-success/10 text-success'
                                : 'bg-error/10 text-error'
                            }
                          `}
                        >
                          {testResultMap[connection.id].message}
                          {testResultMap[connection.id].success && (
                            <Button
                              variant="accent"
                              onClick={() => handleSave(connection)}
                              disabled={!connectionNames[connection.id]?.trim()}
                              className="mt-2 w-full"
                              size="sm"
                            >
                              Save Connection
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
