export function splitSqlStatements(query: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let dollarTag: string | null = null;

  for (let i = 0; i < query.length; i += 1) {
    const char = query[i];
    const prev = i > 0 ? query[i - 1] : '';

    if (dollarTag) {
      if (query.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
        continue;
      }
      current += char;
      continue;
    }

    if (inSingle) {
      current += char;
      if (char === "'" && prev !== '\\\\') {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      current += char;
      if (char === '"' && prev !== '\\\\') {
        inDouble = false;
      }
      continue;
    }

    if (char === "'") {
      inSingle = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      current += char;
      continue;
    }

    if (char === '$') {
      const nextDollar = query.indexOf('$', i + 1);
      if (nextDollar !== -1) {
        const tag = query.slice(i, nextDollar + 1);
        if (/^\\$[A-Za-z_][A-Za-z0-9_]*\\$$/.test(tag) || tag === '$$') {
          dollarTag = tag;
          current += tag;
          i = nextDollar;
          continue;
        }
      }
    }

    if (char === ';') {
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}
