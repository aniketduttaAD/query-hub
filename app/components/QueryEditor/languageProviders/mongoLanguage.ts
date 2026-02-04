import type { Monaco } from '@monaco-editor/react';

const MONGO_METHODS = [
  'find',
  'findOne',
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'aggregate',
  'countDocuments',
  'estimatedDocumentCount',
  'distinct',
  'createIndex',
  'dropIndex',
  'listIndexes',
  'drop',
  'createCollection',
  'dropCollection',
];

const MONGO_OPERATORS = [
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$and',
  '$or',
  '$not',
  '$nor',
  '$exists',
  '$type',
  '$regex',
  '$text',
  '$where',
  '$all',
  '$elemMatch',
  '$size',
  '$mod',
  '$slice',
  '$push',
  '$pull',
  '$set',
  '$unset',
  '$inc',
  '$mul',
  '$min',
  '$max',
  '$currentDate',
  '$rename',
];

const MONGO_SNIPPETS = [
  {
    label: 'find',
    insertText: 'db.${1:collection}.find(${2:query}, ${3:projection})',
    documentation: 'Find documents in a collection',
  },
  {
    label: 'findOne',
    insertText: 'db.${1:collection}.findOne(${2:query}, ${3:projection})',
    documentation: 'Find a single document',
  },
  {
    label: 'insertOne',
    insertText: 'db.${1:collection}.insertOne(${2:{field: "value"}})',
    documentation: 'Insert a single document',
  },
  {
    label: 'insertMany',
    insertText: 'db.${1:collection}.insertMany([${2:{field: "value"}}])',
    documentation: 'Insert multiple documents',
  },
  {
    label: 'updateOne',
    insertText: 'db.${1:collection}.updateOne(${2:{filter}}, ${3:{$set: {field: "value"}}})',
    documentation: 'Update a single document',
  },
  {
    label: 'deleteOne',
    insertText: 'db.${1:collection}.deleteOne(${2:{filter}})',
    documentation: 'Delete a single document',
  },
  {
    label: 'aggregate',
    insertText: 'db.${1:collection}.aggregate([${2:{$match: {}}}, ${3:{$group: {_id: "$field"}}}])',
    documentation: 'Aggregate pipeline',
  },
];

export function registerMongoLanguage(monaco: Monaco): void {
  monaco.languages.register({ id: 'mongodb' });

  // Register completion provider
  monaco.languages.registerCompletionItemProvider('mongodb', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.slice(0, position.column - 1);
      const prefixMatch = textBeforeCursor.match(/[A-Za-z_$][A-Za-z0-9_$]*$/);

      const range = prefixMatch
        ? {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: prefixMatch.index! + 1,
            endColumn: position.column,
          }
        : {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

      const currentWord = prefixMatch ? prefixMatch[0] : word.word;

      const suggestions = [
        // Keywords
        {
          label: 'db',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'db',
          range,
          detail: 'MongoDB Database Object',
          documentation: 'The database object used to access collections',
        },
        // Methods
        ...MONGO_METHODS.filter((method) =>
          method.toLowerCase().startsWith(currentWord.toLowerCase()),
        ).map((method) => ({
          label: method,
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: method,
          range,
          detail: 'MongoDB Method',
          documentation: `MongoDB collection method: ${method}`,
        })),
        // Operators
        ...MONGO_OPERATORS.filter((op) =>
          op.toLowerCase().startsWith(currentWord.toLowerCase()),
        ).map((op) => ({
          label: op,
          kind: monaco.languages.CompletionItemKind.Operator,
          insertText: op,
          range,
          detail: 'MongoDB Operator',
          documentation: `MongoDB query/update operator: ${op}`,
        })),
        // Snippets
        ...MONGO_SNIPPETS.filter((snippet) =>
          snippet.label.toLowerCase().startsWith(currentWord.toLowerCase()),
        ).map((snippet) => ({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: 'MongoDB Snippet',
          documentation: snippet.documentation,
        })),
      ];

      return { suggestions };
    },
    triggerCharacters: ['.', '$', '('],
  });

  monaco.languages.setMonarchTokensProvider('mongodb', {
    defaultToken: '',
    tokenPostfix: '.mongodb',

    keywords: [
      'db',
      'true',
      'false',
      'null',
      'undefined',
      'ObjectId',
      'ISODate',
      'NumberLong',
      'NumberInt',
      'NumberDecimal',
    ],

    operators: ['.', '(', ')', '{', '}', '[', ']', ':', ',', '$'],

    symbols: /[=><!~?:&|+\-*/^%]+/,

    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],

        [/\bdb\b/, 'keyword'],

        [/\$\w+/, 'keyword.operator'],

        [/\b(find|findOne|insert|update|delete|aggregate|count)\w*\b/, 'predefined'],

        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier',
            },
          },
        ],

        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],

        [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],

        [/[{}()[\]]/, '@brackets'],
        [/[<>](?!@symbols)/, '@brackets'],
        [/@symbols/, 'operator'],
        [/[;,.]/, 'delimiter'],
      ],

      comment: [
        [/[^*]+/, 'comment'],
        [/\/\*/, 'comment'],
        [new RegExp('\\*/'), 'comment', '@pop'],
      ],

      string_double: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],

      string_single: [
        [/[^\\']+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/'/, 'string', '@pop'],
      ],
    },
  });
}

export function defineMongoTheme(monaco: Monaco): void {
  monaco.editor.defineTheme('db-playground-mongo', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '576A8F', fontStyle: 'bold' },
      { token: 'keyword.mongodb', foreground: '576A8F', fontStyle: 'bold' },
      { token: 'string', foreground: 'FF7444' },
      { token: 'string.mongodb', foreground: 'FF7444' },
      { token: 'number', foreground: '22C55E' },
      { token: 'number.mongodb', foreground: '22C55E' },
      { token: 'comment', foreground: 'A0AEC0', fontStyle: 'italic' },
      { token: 'comment.mongodb', foreground: 'A0AEC0', fontStyle: 'italic' },
      { token: 'operator', foreground: '576A8F' },
      { token: 'operator.mongodb', foreground: '576A8F' },
      { token: 'predefined', foreground: '3B82F6' },
      { token: 'predefined.mongodb', foreground: '3B82F6' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#2D3748',
      'editor.lineHighlightBackground': '#FFF8DE40',
      'editorCursor.foreground': '#FF7444',
      'editor.selectionBackground': '#B7BDF750',
      'editorLineNumber.foreground': '#A0AEC0',
      'editorLineNumber.activeForeground': '#576A8F',
      'editor.inactiveSelectionBackground': '#B7BDF730',
      'editorIndentGuide.background': '#E2E8F0',
      'editorIndentGuide.activeBackground': '#B7BDF7',
    },
  });
}
