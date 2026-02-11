import type { DatabaseType } from '../types';
import { parseMongoQuery } from '../adapters/mongoParser';
import { MAX_QUERY_LENGTH, MAX_NESTED_DEPTH } from '../config/constants';
import { DANGEROUS_SQL_PATTERNS, DANGEROUS_MONGO_PATTERNS } from './dangerousPatterns';

export interface SecurityCheckResult {
  safe: boolean;
  reason?: string;
}

function checkQueryLength(query: string): SecurityCheckResult {
  if (query.length > MAX_QUERY_LENGTH) {
    return {
      safe: false,
      reason: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`,
    };
  }
  return { safe: true };
}

function checkNestedDepth(query: string): SecurityCheckResult {
  let depth = 0;
  let maxDepth = 0;

  for (const char of query) {
    if (char === '(') {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (char === ')') {
      depth--;
    }

    if (depth < 0) {
      return {
        safe: false,
        reason: 'Unmatched closing parenthesis',
      };
    }

    if (maxDepth > MAX_NESTED_DEPTH) {
      return {
        safe: false,
        reason: `Query exceeds maximum nested depth of ${MAX_NESTED_DEPTH}`,
      };
    }
  }

  if (depth !== 0) {
    return {
      safe: false,
      reason: 'Unmatched opening parenthesis',
    };
  }

  return { safe: true };
}

export function sanitizeSqlQuery(
  query: string,
  dialect: 'postgresql' | 'mysql',
  isDefaultConnection: boolean = true,
): SecurityCheckResult {
  const lengthCheck = checkQueryLength(query);
  if (!lengthCheck.safe) return lengthCheck;

  const depthCheck = checkNestedDepth(query);
  if (!depthCheck.safe) return depthCheck;

  if (isDefaultConnection) {
    for (const pattern of DANGEROUS_SQL_PATTERNS) {
      if (pattern.test(query)) {
        return {
          safe: false,
          reason: 'Query contains potentially dangerous operations',
        };
      }
    }

    if (dialect === 'mysql') {
      if (/\bLOAD\s+(DATA|FILE)\b/i.test(query)) {
        return {
          safe: false,
          reason: 'LOAD DATA/FILE operations are not allowed',
        };
      }
      if (/\bINTO\s+OUTFILE\b/i.test(query)) {
        return {
          safe: false,
          reason: 'INTO OUTFILE operations are not allowed',
        };
      }
    }

    if (dialect === 'postgresql') {
      if (/\bCOPY\s+.*\s+FROM\s+PROGRAM/i.test(query)) {
        return {
          safe: false,
          reason: 'COPY FROM PROGRAM operations are not allowed',
        };
      }
      if (/\bpg_read_file\(/i.test(query)) {
        return {
          safe: false,
          reason: 'File system access functions are not allowed',
        };
      }
    }
  }

  return { safe: true };
}

export function sanitizeMongoQuery(
  query: string,
  isDefaultConnection: boolean = false,
): SecurityCheckResult {
  const lengthCheck = checkQueryLength(query);
  if (!lengthCheck.safe) return lengthCheck;

  const depthCheck = checkNestedDepth(query);
  if (!depthCheck.safe) return depthCheck;

  if (isDefaultConnection) {
    for (const pattern of DANGEROUS_MONGO_PATTERNS) {
      if (pattern.test(query)) {
        return {
          safe: false,
          reason: 'Query contains potentially dangerous operations',
        };
      }
    }
  }

  if (isDefaultConnection) {
    try {
      const parsed = parseMongoQuery(query);
      if (parsed.args && Array.isArray(parsed.args)) {
        const argsStr = JSON.stringify(parsed.args);
        if (argsStr.includes('$where')) {
          return {
            safe: false,
            reason: '$where operator is not allowed for security reasons',
          };
        }
        if (argsStr.includes('$eval')) {
          return {
            safe: false,
            reason: '$eval operator is not allowed for security reasons',
          };
        }
      }
    } catch {
      return { safe: true };
    }
  }

  return { safe: true };
}

export function sanitizeQuery(
  type: DatabaseType,
  query: string,
  isDefaultConnection: boolean = false,
): SecurityCheckResult {
  if (type === 'mongodb') {
    return sanitizeMongoQuery(query, isDefaultConnection);
  } else if (type === 'postgresql') {
    return sanitizeSqlQuery(query, 'postgresql', isDefaultConnection);
  } else if (type === 'mysql') {
    return sanitizeSqlQuery(query, 'mysql', isDefaultConnection);
  }

  return { safe: true };
}
