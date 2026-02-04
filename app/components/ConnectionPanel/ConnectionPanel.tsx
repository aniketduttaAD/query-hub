import { useEffect, useMemo } from 'react';
import { ConnectionList } from './ConnectionList';
import { DefaultDatabasesList } from './DefaultDatabasesList';
import { DefaultDbNotice } from './DefaultDbNotice';
import { useConnectionStore } from '../../stores';

export function ConnectionPanel() {
  const { loadDefaultDatabases, defaultDatabases, connections, activeConnection } =
    useConnectionStore();

  useEffect(() => {
    loadDefaultDatabases();
  }, [loadDefaultDatabases]);

  const { savedConnectionsByType, defaultConnectionsToShow } = useMemo(() => {
    const savedByType: Record<string, (typeof connections)[0]> = {};
    connections.forEach((conn) => {
      if (!savedByType[conn.type]) {
        savedByType[conn.type] = conn;
      }
    });

    const defaultsToShow = defaultDatabases.filter((db) => !savedByType[db.type]);

    return {
      savedConnectionsByType: savedByType,
      defaultConnectionsToShow: defaultsToShow,
    };
  }, [connections, defaultDatabases]);

  const isDefaultDb =
    activeConnection?.isDefault === true &&
    (activeConnection?.type === 'mongodb' ||
      activeConnection?.type === 'postgresql' ||
      activeConnection?.type === 'mysql');

  return (
    <div className="h-full flex flex-col">
      {isDefaultDb && activeConnection && <DefaultDbNotice dbType={activeConnection.type} />}
      <div className="flex-1 overflow-auto p-4">
        {(defaultConnectionsToShow.length > 0 ||
          Object.keys(savedConnectionsByType).length > 0) && (
          <div className="mb-4">
            <DefaultDatabasesList
              savedConnectionsByType={savedConnectionsByType}
              defaultConnectionsToShow={defaultConnectionsToShow}
            />
          </div>
        )}
        <ConnectionList />
      </div>
    </div>
  );
}
