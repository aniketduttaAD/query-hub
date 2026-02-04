import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import type { Connection, ConnectionStatus, DatabaseType, ActiveConnection } from '../types';
import { encryptionService } from '../services/encryption';
import { api } from '../services/api';
import { createIndexedDbStorage } from '../services/indexedDbStorage';
import { getOrCreateSessionId } from '../services/sessionStorage';
import { logger } from '../../lib/logger';

interface ConnectionState {
  connections: Connection[];
  defaultDatabases: Connection[];
  selectedDefaultDb: string | null;

  activeConnection: ActiveConnection | null;
  connectionStatus: ConnectionStatus;
  connectingConnectionId: string | null;
  errorMessage: string | null;

  loadDefaultDatabases: () => Promise<void>;
  setSelectedDefaultDb: (id: string | null) => void;
  addConnection: (
    name: string,
    type: DatabaseType,
    url: string,
    isDefault?: boolean,
  ) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  updateConnection: (id: string, name: string, type: DatabaseType, url: string) => Promise<void>;
  testConnection: (type: DatabaseType, url: string) => Promise<boolean>;
  connect: (
    connectionId: string,
    useCustomCredentials?: boolean,
    customUrl?: string,
  ) => Promise<void>;
  disconnect: () => Promise<void>;
  setError: (message: string | null) => void;
  getDecryptedUrl: (connectionId: string) => Promise<string | null>;
}
type ConnectionPersist = (
  config: StateCreator<ConnectionState>,
  options: PersistOptions<ConnectionState, { connections: Connection[] }>,
) => StateCreator<ConnectionState>;

export const useConnectionStore = create<ConnectionState>()(
  (persist as ConnectionPersist)(
    (set, get) => ({
      connections: [],
      defaultDatabases: [],
      selectedDefaultDb: null,
      activeConnection: null,
      connectionStatus: 'disconnected',
      connectingConnectionId: null,
      errorMessage: null,

      loadDefaultDatabases: async () => {
        try {
          const result = await api.getDefaultDatabases();
          const defaultDbs: Connection[] = await Promise.all(
            result.databases.map(async (db) => ({
              id: `default_${db.type}`,
              name: db.name,
              type: db.type,
              encryptedUrl: await encryptionService.encrypt(db.url),
              createdAt: Date.now(),
              isDefault: true,
              useCustomCredentials: false,
            })),
          );

          set({ defaultDatabases: defaultDbs });

          const { selectedDefaultDb } = get();
          if (!selectedDefaultDb && defaultDbs.length > 0) {
            set({ selectedDefaultDb: defaultDbs[0].id });
          }
        } catch (error) {
          logger.error('Failed to load default databases', error);
        }
      },

      setSelectedDefaultDb: (id) => {
        set({ selectedDefaultDb: id });
      },

      addConnection: async (name, type, url, isDefault = false) => {
        const encryptedUrl = await encryptionService.encrypt(url);
        const newConnection: Connection = {
          id: crypto.randomUUID(),
          name,
          type,
          encryptedUrl,
          createdAt: Date.now(),
          isDefault,
        };
        set((state) => ({
          connections: [...state.connections, newConnection],
        }));
      },

      removeConnection: async (id) => {
        const { activeConnection } = get();
        if (activeConnection?.connectionId === id) {
          await get().disconnect();
        }
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
        }));
      },

      updateConnection: async (id, name, type, url) => {
        const encryptedUrl = await encryptionService.encrypt(url);
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, name, type, encryptedUrl } : c,
          ),
        }));
      },

      testConnection: async (type, url) => {
        set({ errorMessage: null });
        try {
          const result = await api.testConnection(type, url);
          return result.success;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Connection test failed';
          set({ errorMessage: message });
          return false;
        }
      },

      connect: async (connectionId, _useCustomCredentials = false, customUrl?: string) => {
        let connection = get().connections.find((c) => c.id === connectionId);
        if (!connection) {
          connection = get().defaultDatabases.find((c) => c.id === connectionId);
        }

        if (!connection) {
          set({ errorMessage: 'Connection not found' });
          return;
        }

        const { activeConnection } = get();
        if (activeConnection) {
          await get().disconnect();
        }

        set({
          connectionStatus: 'connecting',
          connectingConnectionId: connectionId,
          errorMessage: null,
        });

        try {
          const url = customUrl || (await encryptionService.decrypt(connection.encryptedUrl));
          const userId = connection.type === 'mongodb' ? undefined : getOrCreateSessionId();

          const result = await api.connect(connection.type, url, userId, true);

          if (result.success) {
            set((state) => ({
              activeConnection: {
                connectionId,
                sessionId: result.sessionId,
                type: connection.type,
                serverVersion: result.serverVersion,
                signingKey: result.signingKey,
                isDefault: connection.isDefault ?? false,
                isIsolated: result.isIsolated ?? false,
              },
              connectionStatus: 'connected',
              connectingConnectionId: null,
              connections: state.connections.map((c) =>
                c.id === connectionId ? { ...c, lastUsed: Date.now() } : c,
              ),
              defaultDatabases: state.defaultDatabases.map((c) =>
                c.id === connectionId ? { ...c, lastUsed: Date.now() } : c,
              ),
            }));
          } else {
            set({
              connectionStatus: 'error',
              connectingConnectionId: null,
              errorMessage: 'Failed to connect',
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Connection failed';
          set({
            connectionStatus: 'error',
            connectingConnectionId: null,
            errorMessage: message,
          });
        }
      },

      disconnect: async () => {
        const { activeConnection } = get();
        if (activeConnection?.sessionId) {
          try {
            await api.disconnect(activeConnection.sessionId, activeConnection.signingKey);
          } catch (error) {
            logger.error('Failed to disconnect session', error);
          }
        }
        set({
          activeConnection: null,
          connectionStatus: 'disconnected',
          connectingConnectionId: null,
          errorMessage: null,
        });
      },

      setError: (message) => {
        set({ errorMessage: message });
      },

      getDecryptedUrl: async (connectionId) => {
        const connection = get().connections.find((c) => c.id === connectionId);
        if (!connection) return null;
        return encryptionService.decrypt(connection.encryptedUrl);
      },
    }),
    {
      name: 'db-playground-connections',
      partialize: (state) => ({
        connections: state.connections,
        selectedDefaultDb: state.selectedDefaultDb,
      }),
      storage: createJSONStorage(() => createIndexedDbStorage('queryhub')),
    },
  ),
);
