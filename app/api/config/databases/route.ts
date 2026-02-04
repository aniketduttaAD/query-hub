import { loadDefaultDatabases } from '@/lib/config/databaseConfig';
import { jsonResponse } from '@/lib/response';

export const runtime = 'nodejs';

export async function GET() {
  const databases = loadDefaultDatabases();
  return jsonResponse({ success: true, databases });
}
