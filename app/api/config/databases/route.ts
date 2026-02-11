import { loadDefaultDatabases } from '@/lib/config/databaseConfig';
import { jsonResponse } from '@/lib/response';

export const runtime = 'nodejs';

/**
 * Returns default database list for UI (type, name, id). Connection URLs are never
 * sent to the client; they stay server-side and are used only when connecting.
 */
export async function GET() {
  const configs = loadDefaultDatabases();
  const databases = configs.map((db) => ({
    id: `default_${db.type}`,
    type: db.type,
    name: db.name,
  }));
  return jsonResponse({ success: true, databases });
}
