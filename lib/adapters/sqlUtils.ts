import type { QueryOptions } from '../types';
import { DEFAULT_QUERY_LIMIT } from '../queryConfig';

const LIMIT_REGEX = /\blimit\b/i;
const OFFSET_REGEX = /\boffset\b/i;
const FETCH_REGEX = /\bfetch\b\s+first\b/i;

/** Matches statements that support EXPLAIN (query plans) in SQL adapters. */
export const SELECT_LIKE_REGEX = /^\s*(select|with|show|describe|explain)\b/i;

const stripTrailingSemicolon = (query: string): { query: string; hadSemicolon: boolean } => {
  const hadSemicolon = /;\s*$/.test(query);
  if (!hadSemicolon) {
    return { query, hadSemicolon: false };
  }
  return { query: query.replace(/;\s*$/, ''), hadSemicolon: true };
};

const hasMultipleStatements = (query: string): boolean => {
  const trimmed = query.trim();
  if (!trimmed.includes(';')) return false;
  const { query: withoutTrailing } = stripTrailingSemicolon(trimmed);
  return withoutTrailing.includes(';');
};

export function applySqlPagination(query: string, options?: QueryOptions): string {
  if (!query.trim()) return query;
  if (!SELECT_LIKE_REGEX.test(query)) return query;
  if (hasMultipleStatements(query)) return query;
  if (LIMIT_REGEX.test(query) || FETCH_REGEX.test(query)) return query;

  const { query: base, hadSemicolon } = stripTrailingSemicolon(query.trim());
  const limit = options?.limit ?? DEFAULT_QUERY_LIMIT;
  const offset = options?.offset;

  let paginated = `${base} LIMIT ${limit}`;
  if (typeof offset === 'number' && offset > 0 && !OFFSET_REGEX.test(query)) {
    paginated += ` OFFSET ${offset}`;
  }

  return hadSemicolon ? `${paginated};` : paginated;
}
