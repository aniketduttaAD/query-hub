import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export function validateMongo(monaco: Monaco, model: editor.ITextModel): editor.IMarkerData[] {
  const markers: editor.IMarkerData[] = [];
  const text = model.getValue();
  const lines = text.split('\n');

  let openBraces = 0;
  let openBrackets = 0;
  let openParens = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let commentType: 'line' | 'block' | null = null;
  let inRegex = false;

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      if (trimmed.startsWith('//')) {
        return;
      }
    }

    if (trimmed.startsWith('db.') && !trimmed.match(/db\.\w+[.(]/)) {
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: 'Invalid MongoDB query: Expected db.collection.method() or db.method()',
        startLineNumber: lineIndex + 1,
        startColumn: 1,
        endLineNumber: lineIndex + 1,
        endColumn: trimmed.length + 1,
      });
    }

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';
      const nextChar = i < line.length - 1 ? line[i + 1] : '';

      if (!inString && !inComment && !inRegex) {
        if (char === '/' && prevChar === '/') {
          commentType = 'line';
          inComment = true;
          break;
        }
        if (char === '*' && prevChar === '/') {
          commentType = 'block';
          inComment = true;
          continue;
        }
        if (char === '/' && prevChar === '*' && commentType === 'block') {
          inComment = false;
          commentType = null;
          continue;
        }
        if (
          char === '/' &&
          (prevChar === ':' ||
            prevChar === ',' ||
            prevChar === '=' ||
            prevChar === '(' ||
            prevChar === '[' ||
            prevChar === '{' ||
            /\s/.test(prevChar))
        ) {
          inRegex = true;
          continue;
        }
      }

      if (inComment && commentType === 'line') {
        break;
      }
      if (inComment && commentType === 'block') {
        continue;
      }

      if (inRegex && char === '/' && prevChar !== '\\') {
        if (/[gimsu\s,}\]]/.test(nextChar) || nextChar === '' || i === line.length - 1) {
          inRegex = false;
          continue;
        }
      }

      if (inRegex) {
        continue;
      }

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') openBraces++;
      if (char === '}') {
        openBraces--;
        if (openBraces < 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: 'Unexpected closing brace',
            startLineNumber: lineIndex + 1,
            startColumn: i + 1,
            endLineNumber: lineIndex + 1,
            endColumn: i + 2,
          });
          openBraces = 0;
        }
      }
      if (char === '[') openBrackets++;
      if (char === ']') {
        openBrackets--;
        if (openBrackets < 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: 'Unexpected closing bracket',
            startLineNumber: lineIndex + 1,
            startColumn: i + 1,
            endLineNumber: lineIndex + 1,
            endColumn: i + 2,
          });
          openBrackets = 0;
        }
      }
      if (char === '(') openParens++;
      if (char === ')') {
        openParens--;
        if (openParens < 0) {
          markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: 'Unexpected closing parenthesis',
            startLineNumber: lineIndex + 1,
            startColumn: i + 1,
            endLineNumber: lineIndex + 1,
            endColumn: i + 2,
          });
          openParens = 0;
        }
      }
    }
  });

  if (openBraces > 0) {
    const lastLine = lines.length;
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Unclosed brace',
      startLineNumber: lastLine,
      startColumn: 1,
      endLineNumber: lastLine,
      endColumn: 1,
    });
  }
  if (openBrackets > 0) {
    const lastLine = lines.length;
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Unclosed bracket',
      startLineNumber: lastLine,
      startColumn: 1,
      endLineNumber: lastLine,
      endColumn: 1,
    });
  }
  if (openParens > 0) {
    const lastLine = lines.length;
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Unclosed parenthesis',
      startLineNumber: lastLine,
      startColumn: 1,
      endLineNumber: lastLine,
      endColumn: 1,
    });
  }

  lines.forEach((line, lineIndex) => {
    const jsonMatch = line.match(/\{[^}]*\}/);
    if (jsonMatch) {
      try {
        let jsonStr = jsonMatch[0]
          .replace(/(\w+):/g, '"$1":')
          .replace(/:\s*'([^']*)'/g, ': "$1"')
          .replace(/ObjectId\s*\(\s*"([^"]+)"\s*\)/g, '"$1"')
          .replace(/\/((?:[^/\\]|\\.)+)\/([gimsu]*)/g, '"$1"');

        JSON.parse(jsonStr);
      } catch {
        if (!line.trim().includes('function') && !line.trim().includes('=>')) {
          markers.push({
            severity: monaco.MarkerSeverity.Warning,
            message: 'Potentially invalid JSON structure',
            startLineNumber: lineIndex + 1,
            startColumn: (jsonMatch.index || 0) + 1,
            endLineNumber: lineIndex + 1,
            endColumn: (jsonMatch.index || 0) + jsonMatch[0].length + 1,
          });
        }
      }
    }
  });

  const trimmedText = text.trim();

  if (
    trimmedText &&
    !trimmedText.startsWith('db.') &&
    !trimmedText.startsWith('//') &&
    !trimmedText.startsWith('/*') &&
    !/^\s*(show|use)\s+\w/i.test(trimmedText)
  ) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message:
        'MongoDB query must start with db. (or use shell commands: show dbs, show collections, use <db>)',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 4,
    });
  }

  return markers;
}

export function setupMongoValidation(monaco: Monaco, model: editor.ITextModel): () => void {
  const validate = () => {
    const markers = validateMongo(monaco, model);
    monaco.editor.setModelMarkers(model, 'mongo-validator', markers);
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
    monaco.editor.setModelMarkers(model, 'mongo-validator', []);
  };
}
