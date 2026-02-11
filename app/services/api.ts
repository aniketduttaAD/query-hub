import type {
  DatabaseType,
  TestConnectionResponse,
  ConnectResponse,
  ExecuteQueryResponse,
  ColumnSchema,
} from '../types';
import { signPayload } from './signing';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new ApiError((data.error as string) || 'An error occurred', response.status);
  }

  return data as T;
}

const stripUndefined = <T extends Record<string, unknown>>(payload: T): T => {
  const cleaned: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned as T;
};

export const api = {
  async testConnection(type: DatabaseType, connectionUrl: string): Promise<TestConnectionResponse> {
    const response = await fetch(`${API_BASE}/connections/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, connectionUrl }),
    });
    return handleResponse<TestConnectionResponse>(response);
  },

  async connect(
    type: DatabaseType,
    connectionUrl: string | undefined,
    userId?: string,
    isIsolated?: boolean,
    useDefaultDatabase?: boolean,
  ): Promise<ConnectResponse & { userDatabase?: string; isIsolated?: boolean }> {
    const body: Record<string, unknown> = { type, userId, isIsolated };
    if (useDefaultDatabase) {
      body.useDefaultDatabase = true;
    } else if (connectionUrl) {
      body.connectionUrl = connectionUrl;
    }
    const response = await fetch(`${API_BASE}/connections/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handleResponse<ConnectResponse & { userDatabase?: string; isIsolated?: boolean }>(
      response,
    );
  },

  async disconnect(sessionId: string, signingKey?: string): Promise<{ success: boolean }> {
    const body = { sessionId };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, body, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    const response = await fetch(`${API_BASE}/connections/disconnect`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async sessionExtend(
    sessionId: string,
    signingKey: string,
    code: string,
  ): Promise<{ success: boolean }> {
    const body = { sessionId };
    const timestamp = Date.now().toString();
    const signature = await signPayload(signingKey, body, timestamp);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-timestamp': timestamp,
      'x-signature': signature,
      'x-request-code': code,
    };
    const response = await fetch(`${API_BASE}/connections/session-extend`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async sessionKeepalive(sessionId: string, signingKey: string): Promise<{ success: boolean }> {
    const body = { sessionId, timestamp: Date.now() };
    const timestamp = Date.now().toString();
    const signature = await signPayload(signingKey, body, timestamp);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-timestamp': timestamp,
      'x-signature': signature,
    };
    const response = await fetch(`${API_BASE}/connections/keepalive`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async executeQuery(
    sessionId: string,
    query: string,
    database?: string,
    options?: { limit?: number; offset?: number; explain?: boolean },
    signingKey?: string,
    signal?: AbortSignal,
  ): Promise<ExecuteQueryResponse> {
    const body = stripUndefined({ sessionId, query, database, ...options });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, body, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    const response = await fetch(`${API_BASE}/query/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    return handleResponse<ExecuteQueryResponse>(response);
  },

  async getDatabases(sessionId: string, signingKey?: string): Promise<{ databases: string[] }> {
    const params = { sessionId };
    const query = new URLSearchParams(params).toString();
    const headers: Record<string, string> = {};
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, params, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    const response = await fetch(`${API_BASE}/schema/databases?${query}`, { headers });
    return handleResponse<{ databases: string[] }>(response);
  },

  async getTables(
    sessionId: string,
    database: string,
    signingKey?: string,
  ): Promise<{ tables: { name: string; type: string }[] }> {
    const params = { sessionId, database };
    const query = new URLSearchParams(params).toString();
    const headers: Record<string, string> = {};
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, params, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    const response = await fetch(`${API_BASE}/schema/tables?${query}`, { headers });
    return handleResponse<{ tables: { name: string; type: string }[] }>(response);
  },

  async getColumns(
    sessionId: string,
    database: string,
    table: string,
    signingKey?: string,
  ): Promise<{ columns: ColumnSchema[] }> {
    const params = { sessionId, database, table };
    const query = new URLSearchParams(params).toString();
    const headers: Record<string, string> = {};
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, params, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    const response = await fetch(`${API_BASE}/schema/columns?${query}`, { headers });
    return handleResponse<{ columns: ColumnSchema[] }>(response);
  },

  async beginTransaction(sessionId: string, signingKey?: string): Promise<{ success: boolean }> {
    const body = { sessionId, action: 'begin' };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, body, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    const response = await fetch(`${API_BASE}/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async commitTransaction(sessionId: string, signingKey?: string): Promise<{ success: boolean }> {
    const body = { sessionId, action: 'commit' };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, body, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    const response = await fetch(`${API_BASE}/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async rollbackTransaction(sessionId: string, signingKey?: string): Promise<{ success: boolean }> {
    const body = { sessionId, action: 'rollback' };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, body, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    const response = await fetch(`${API_BASE}/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async getDefaultDatabases(): Promise<{
    databases: Array<{ id: string; type: DatabaseType; name: string }>;
  }> {
    const response = await fetch(`${API_BASE}/config/databases`);
    return handleResponse<{ databases: Array<{ id: string; type: DatabaseType; name: string }> }>(
      response,
    );
  },

  async exportQuery(
    sessionId: string,
    query: string,
    database: string | undefined,
    format: 'csv' | 'json',
    signingKey?: string,
  ): Promise<Response> {
    const body = stripUndefined({ sessionId, query, database, format });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signingKey) {
      const timestamp = Date.now().toString();
      const signature = await signPayload(signingKey, body, timestamp);
      headers['x-timestamp'] = timestamp;
      headers['x-signature'] = signature;
    }
    return fetch(`${API_BASE}/query/export`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  },
};
