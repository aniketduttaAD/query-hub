import type { Document } from 'mongodb';
import { ObjectId, Long } from 'mongodb';

export interface ParsedMongoChain {
  name: string;
  args: unknown[];
}

export interface ParsedMongoQuery {
  database?: string;
  collection?: string;
  operation: string;
  args: unknown[];
  chain: ParsedMongoChain[];
  target: 'collection' | 'db' | 'admin';
}

const stripTrailingSemicolon = (query: string): string => query.replace(/;\s*$/, '');

const splitByTopLevelDots = (input: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const prev = i > 0 ? input[i - 1] : '';

    if (inString) {
      current += char;
      if (char === stringChar && prev !== '\\') {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth = Math.max(0, depth - 1);
    }

    if (char === '.' && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const reviveMongoTypes = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((v) => reviveMongoTypes(v));
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    if (Object.keys(obj).length === 1 && typeof obj.__$oid === 'string') {
      try {
        return new ObjectId(obj.__$oid);
      } catch {
        return value;
      }
    }

    if (Object.keys(obj).length === 1 && typeof obj.__$date === 'string') {
      const time = Date.parse(obj.__$date);
      if (Number.isNaN(time)) return value;
      return new Date(time);
    }

    if (Object.keys(obj).length === 1 && typeof obj.__$numberLong === 'string') {
      try {
        return Long.fromString(obj.__$numberLong);
      } catch {
        return value;
      }
    }

    if (typeof obj.__$regex === 'string') {
      const pattern = obj.__$regex;
      const flags = typeof obj.__$options === 'string' ? obj.__$options : '';
      try {
        return new RegExp(pattern, flags);
      } catch {
        return value;
      }
    }

    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      out[key] = reviveMongoTypes(v);
    }
    return out;
  }

  return value;
};

export function parseMongoArgs(argsStr: string): unknown[] {
  if (!argsStr.trim()) return [];

  try {
    let normalized = argsStr.trim();

    normalized = normalized.replace(
      /\/((?:[^/\\]|\\.)+)\/([gimsu]*)(?=\s*[,}\]]|$)/g,
      (_match, pattern, flags) => {
        const escapedPattern = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const escapedFlags = String(flags ?? '');
        return `{"__$regex":"${escapedPattern}","__$options":"${escapedFlags}"}`;
      },
    );

    normalized = normalized.replace(
      /ObjectId\s*\(\s*["']([^"']+)["']\s*\)/gi,
      (_match, id) => `{"__$oid":"${id}"}`,
    );

    normalized = normalized.replace(
      /ISODate\s*\(\s*["']([^"']+)["']\s*\)/gi,
      (_match, date) => `{"__$date":"${date}"}`,
    );

    normalized = normalized.replace(
      /new\s+Date\s*\(\s*["']([^"']+)["']\s*\)/gi,
      (_match, date) => `{"__$date":"${date}"}`,
    );

    normalized = normalized.replace(
      /NumberLong\s*\(\s*["']?(\d+)["']?\s*\)/gi,
      (_match, num) => `{"__$numberLong":"${num}"}`,
    );

    normalized = normalized.replace(/NumberInt\s*\(\s*(\d+)\s*\)/gi, '$1');

    normalized = normalized.replace(/NumberDecimal\s*\(\s*["']?([0-9.]+)["']?\s*\)/gi, '"$1"');

    normalized = normalized.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_match, content) => {
      return `"${content.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    });

    normalized = normalized.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

    try {
      const parsed = reviveMongoTypes(JSON.parse(normalized));
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      try {
        const arrayStr = normalized.startsWith('[') ? normalized : `[${normalized}]`;
        const parsed = reviveMongoTypes(JSON.parse(arrayStr));
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        const args: unknown[] = [];
        let depth = 0;
        let currentArg = '';
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < normalized.length; i += 1) {
          const char = normalized[i];
          const prevChar = i > 0 ? normalized[i - 1] : '';

          if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
              stringChar = '';
            }
          }

          if (!inString) {
            if (char === '{' || char === '[') depth += 1;
            if (char === '}' || char === ']') depth -= 1;

            if (char === ',' && depth === 0) {
              if (currentArg.trim()) {
                args.push(reviveMongoTypes(JSON.parse(currentArg.trim())));
              }
              currentArg = '';
              continue;
            }
          }

          currentArg += char;
        }

        if (currentArg.trim()) {
          args.push(reviveMongoTypes(JSON.parse(currentArg.trim())));
        }

        return args.length > 0 ? args : [reviveMongoTypes(JSON.parse(normalized))];
      }
    }
  } catch (e) {
    if (argsStr.trim() === '{}') return [{}];
    if (argsStr.trim() === '[]') return [[]];
    throw new Error(
      `Failed to parse query arguments: ${argsStr.substring(0, 100)}${argsStr.length > 100 ? '...' : ''}. Error: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

const parseCallSegment = (segment: string): ParsedMongoChain => {
  const trimmed = segment.trim();
  const openIndex = trimmed.indexOf('(');
  const closeIndex = trimmed.lastIndexOf(')');

  if (openIndex === -1 || closeIndex === -1 || closeIndex < openIndex) {
    const bareSegment = segment.trim();

    if (bareSegment === 'length') {
      throw new Error(
        'Invalid MongoDB call segment: length. Property access like `.length` is not supported in this environment. To count documents, use db.collection.countDocuments(filter) instead.',
      );
    }

    throw new Error(`Invalid MongoDB call segment: ${segment}`);
  }

  const name = trimmed.slice(0, openIndex).trim();
  const argsStr = trimmed.slice(openIndex + 1, closeIndex);
  const args = parseMongoArgs(argsStr);

  return { name, args };
};

const isCallSegment = (segment: string): boolean => segment.includes('(');

export function parseMongoQuery(query: string): ParsedMongoQuery {
  let cleanQuery = stripTrailingSemicolon(query.trim());
  if (!cleanQuery) {
    throw new Error('MongoDB query is empty');
  }

  cleanQuery = cleanQuery.replace(/^['"]|['"]$/g, '');
  const shellCommandMatch = cleanQuery.match(/^\s*(show|use)\s+([\w-]+)\s*;?\s*$/i);
  if (shellCommandMatch) {
    const [, command, arg] = shellCommandMatch;
    if (command.toLowerCase() === 'show') {
      if (arg.toLowerCase() === 'dbs' || arg.toLowerCase() === 'databases') {
        cleanQuery = 'db.admin().listDatabases()';
      } else if (arg.toLowerCase() === 'collections') {
        cleanQuery = 'db.listCollections()';
      } else {
        throw new Error(`Unknown show command: ${arg}. Supported: dbs, databases, collections`);
      }
    } else if (command.toLowerCase() === 'use') {
      return {
        database: arg,
        operation: 'use',
        args: [arg],
        chain: [],
        target: 'db',
      };
    }
  }

  const segments = splitByTopLevelDots(cleanQuery);
  if (segments.length < 2 || segments[0] !== 'db') {
    throw new Error('Invalid MongoDB query format. Expected: db.collection.operation({...})');
  }

  let index = 1;
  let database: string | undefined;

  if (segments[index]?.startsWith('getSiblingDB')) {
    const sibling = parseCallSegment(segments[index]);
    if (sibling.name !== 'getSiblingDB') {
      throw new Error('Invalid MongoDB query: expected getSiblingDB()');
    }
    database = sibling.args[0] ? String(sibling.args[0]) : undefined;
    index += 1;
  }

  if (index >= segments.length) {
    throw new Error('Invalid MongoDB query format. Missing collection or operation.');
  }

  const next = segments[index];
  if (isCallSegment(next)) {
    const call = parseCallSegment(next);
    if (call.name === 'admin') {
      const opSegment = segments[index + 1];
      if (!opSegment || !isCallSegment(opSegment)) {
        throw new Error('Invalid MongoDB admin query format');
      }
      const op = parseCallSegment(opSegment);
      const chain = segments.slice(index + 2).map(parseCallSegment);
      return {
        database,
        operation: op.name,
        args: op.args,
        chain,
        target: 'admin',
      };
    }

    const chain = segments.slice(index + 1).map(parseCallSegment);
    return {
      database,
      operation: call.name,
      args: call.args,
      chain,
      target: 'db',
    };
  }

  const collection = next;
  const opSegment = segments[index + 1];
  if (!opSegment || !isCallSegment(opSegment)) {
    throw new Error('Invalid MongoDB query format. Expected collection operation call.');
  }
  const op = parseCallSegment(opSegment);
  const chain = segments.slice(index + 2).map(parseCallSegment);

  return {
    database,
    collection,
    operation: op.name,
    args: op.args,
    chain,
    target: 'collection',
  };
}

export const normalizeMongoDoc = (value: unknown): Document => (value ?? {}) as Document;
