import type { DatabaseType } from './types';

export function validateConnectionUrl(type: DatabaseType, url: string): boolean {
  if (type === 'postgresql') {
    return url.startsWith('postgresql://') || url.startsWith('postgres://');
  }
  if (type === 'mongodb') {
    return url.startsWith('mongodb://') || url.startsWith('mongodb+srv://');
  }
  if (type === 'mysql') {
    return url.startsWith('mysql://');
  }
  return false;
}
