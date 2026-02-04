import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

function getParenBalanceMarkers(
  monaco: Monaco,
  text: string,
  _model: editor.ITextModel,
): editor.IMarkerData[] {
  const markers: editor.IMarkerData[] = [];
  let balance = 0;
  let lastOpenLine = 1;
  let lastOpenCol = 1;
  let i = 0;
  const len = text.length;
  let line = 1;
  let col = 1;

  while (i < len) {
    const ch = text[i];
    const next = text[i + 1];
    const prev = i > 0 ? text[i - 1] : ' ';

    if (ch === "'" && prev !== '\\') {
      i++;
      col++;
      while (i < len) {
        const c = text[i];
        if (c === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
        if (c === "'" && text[i - 2] !== '\\') break;
      }
      continue;
    }
    if (ch === '"' && prev !== '\\') {
      i++;
      col++;
      while (i < len) {
        const c = text[i];
        if (c === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
        if (c === '"' && text[i - 2] !== '\\') break;
      }
      continue;
    }
    if (ch === '-' && next === '-') {
      i += 2;
      col += 2;
      while (i < len && text[i] !== '\n') {
        i++;
        col++;
      }
      if (i < len) {
        i++;
        line++;
        col = 1;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      col += 2;
      while (i < len - 1 && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
      }
      if (i < len - 1) {
        i += 2;
        col += 2;
      }
      continue;
    }

    if (ch === '(') {
      balance++;
      lastOpenLine = line;
      lastOpenCol = col;
    } else if (ch === ')') {
      balance--;
      if (balance < 0) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'Unexpected closing parenthesis',
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: col + 1,
        });
        balance = 0;
      }
    }

    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    i++;
  }

  if (balance > 0) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Unclosed parenthesis',
      startLineNumber: lastOpenLine,
      startColumn: lastOpenCol,
      endLineNumber: lastOpenLine,
      endColumn: lastOpenCol + 1,
    });
  }

  return markers;
}

/**
 * Document-level quote balance. Only reports unclosed strings at end of document.
 */
function getQuoteMarkers(
  monaco: Monaco,
  text: string,
  _model: editor.ITextModel,
): editor.IMarkerData[] {
  const markers: editor.IMarkerData[] = [];
  let inSingle = false;
  let inDouble = false;
  let singleStartLine = 1;
  let singleStartCol = 1;
  let doubleStartLine = 1;
  let doubleStartCol = 1;
  let i = 0;
  let line = 1;
  let col = 1;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : ' ';
    const next = text[i + 1];

    if (!inDouble && ch === "'" && prev !== '\\') {
      if (!inSingle) {
        inSingle = true;
        singleStartLine = line;
        singleStartCol = col;
      } else {
        inSingle = false;
      }
      i++;
      col++;
      continue;
    }
    if (!inSingle && ch === '"' && prev !== '\\') {
      if (!inDouble) {
        inDouble = true;
        doubleStartLine = line;
        doubleStartCol = col;
      } else {
        inDouble = false;
      }
      i++;
      col++;
      continue;
    }
    if (ch === '-' && next === '-') {
      while (i < len && text[i] !== '\n') {
        i++;
        col++;
      }
      if (i < len) {
        i++;
        line++;
        col = 1;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      col += 2;
      while (i < len - 1 && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
      }
      if (i < len - 1) {
        i += 2;
        col += 2;
      }
      continue;
    }

    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    i++;
  }

  if (inSingle) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Unclosed string literal (single quote)',
      startLineNumber: singleStartLine,
      startColumn: singleStartCol,
      endLineNumber: line,
      endColumn: col,
    });
  }
  if (inDouble) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Unclosed string literal (double quote)',
      startLineNumber: doubleStartLine,
      startColumn: doubleStartCol,
      endLineNumber: line,
      endColumn: col,
    });
  }
  return markers;
}

export function validateSQL(monaco: Monaco, model: editor.ITextModel): editor.IMarkerData[] {
  const markers: editor.IMarkerData[] = [];
  const text = model.getValue();
  const lines = text.split('\n');

  markers.push(...getParenBalanceMarkers(monaco, text, model));
  markers.push(...getQuoteMarkers(monaco, text, model));

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.match(/SELECT\s+FROM/i)) {
      const match = line.match(/SELECT\s+FROM/i);
      if (match) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: 'SELECT requires column names or * before FROM',
          startLineNumber: lineIndex + 1,
          startColumn: (match.index || 0) + 1,
          endLineNumber: lineIndex + 1,
          endColumn: (match.index || 0) + match[0].length + 1,
        });
      }
    }

    if (
      trimmed.match(/^\s*WHERE/i) &&
      !text.substring(0, model.getOffsetAt({ lineNumber: lineIndex + 1, column: 1 })).match(/FROM/i)
    ) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'WHERE clause requires a FROM clause',
        startLineNumber: lineIndex + 1,
        startColumn: 1,
        endLineNumber: lineIndex + 1,
        endColumn: trimmed.length + 1,
      });
    }
  });

  const upperText = text.toUpperCase();
  if (
    upperText.includes('SELECT') &&
    !upperText.includes('FROM') &&
    !upperText.match(/SELECT\s+\d+/)
  ) {
    const selectMatch = text.match(/SELECT/i);
    if (selectMatch && selectMatch.index !== undefined) {
      const position = model.getPositionAt(selectMatch.index);
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: 'SELECT statement may be incomplete (missing FROM clause)',
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column + 6,
      });
    }
  }

  return markers;
}

export function setupSQLValidation(monaco: Monaco, model: editor.ITextModel): () => void {
  const validate = () => {
    const markers = validateSQL(monaco, model);
    monaco.editor.setModelMarkers(model, 'sql-validator', markers);
  };

  validate();

  let timeout: ReturnType<typeof setTimeout>;
  const disposable = model.onDidChangeContent(() => {
    clearTimeout(timeout);
    timeout = setTimeout(validate, 500);
  });

  return () => {
    clearTimeout(timeout);
    disposable.dispose();
    monaco.editor.setModelMarkers(model, 'sql-validator', []);
  };
}
