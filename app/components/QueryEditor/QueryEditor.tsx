'use client';

import { useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount, Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { EditorToolbar } from './EditorToolbar';
import { logger } from '../../../lib/logger';
import {
  registerSqlLanguage,
  defineSqlTheme,
  registerMongoLanguage,
  defineMongoTheme,
  setupSQLValidation,
  setupMongoValidation,
} from './languageProviders';
import {
  useQueryStore,
  useConnectionStore,
  useResultsStore,
  useHistoryStore,
  useSchemaStore,
  useTransactionStore,
} from '../../stores';
import { api } from '../../services/api';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export function QueryEditor() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const validationCleanupRef = useRef<null | (() => void)>(null);
  const executeQueryRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { currentQuery, setQuery, language, isExecuting, setIsExecuting, clearQuery } =
    useQueryStore();
  const { activeConnection, connectionStatus } = useConnectionStore();
  const { setResults, setIsLoading } = useResultsStore();
  const { addEntry } = useHistoryStore();
  const { selectedDatabase } = useSchemaStore();
  const {
    active,
    setActive,
    addQuery: addTransactionQuery,
    clear: clearTransaction,
  } = useTransactionStore();

  const connections = useConnectionStore((state) => state.connections);

  useEffect(() => {
    if (activeConnection) {
      const { setLanguage } = useQueryStore.getState();
      setLanguage(activeConnection.type);
    }
  }, [activeConnection]);

  useEffect(() => {
    if (!activeConnection) {
      clearTransaction();
    }
  }, [activeConnection, clearTransaction]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    registerSqlLanguage(monaco);
    registerMongoLanguage(monaco);

    defineSqlTheme(monaco);
    defineMongoTheme(monaco);

    monaco.editor.setTheme(language === 'mongodb' ? 'db-playground-mongo' : 'db-playground-sql');

    const model = editor.getModel();
    if (model) {
      validationCleanupRef.current?.();
      if (language === 'mongodb') {
        validationCleanupRef.current = setupMongoValidation(monaco, model);
      } else {
        validationCleanupRef.current = setupSQLValidation(monaco, model);
      }
    }

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeQueryRef.current?.();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE, () => {
      handleExplain();
    });
    editor.focus();
  };

  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      const monaco = monacoRef.current;
      const editor = editorRef.current;
      const model = editor.getModel();

      const editorLanguage = language === 'mongodb' ? 'mongodb' : 'sql';

      // Update model language
      if (model) {
        monaco.editor.setModelLanguage(model, editorLanguage);
      }

      monaco.editor.setTheme(language === 'mongodb' ? 'db-playground-mongo' : 'db-playground-sql');

      if (model) {
        validationCleanupRef.current?.();
        if (language === 'mongodb') {
          validationCleanupRef.current = setupMongoValidation(monaco, model);
        } else {
          validationCleanupRef.current = setupSQLValidation(monaco, model);
        }
      }
    }
  }, [language]);

  useEffect(
    () => () => {
      validationCleanupRef.current?.();
    },
    [],
  );

  const executeQuery = useCallback(async () => {
    if (!activeConnection || connectionStatus !== 'connected') return;
    if (!currentQuery.trim()) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsExecuting(true);
    setIsLoading(true);

    const startTime = Date.now();

    try {
      const result = await api.executeQuery(
        activeConnection.sessionId,
        currentQuery,
        selectedDatabase ?? undefined,
        undefined,
        activeConnection.signingKey,
        controller.signal,
      );

      const connectionName =
        connections.find((c) => c.id === activeConnection.connectionId)?.name || 'Unknown';

      if (active) {
        addTransactionQuery(currentQuery);
      }

      const statementCount = result.statementCount ?? 1;
      const messagePrefix =
        statementCount > 1 ? `Executed ${statementCount} statements. Showing last result. ` : '';

      setResults({
        success: result.success,
        data: result.data,
        columns: result.columns,
        rowCount: result.rowCount,
        executionTime: result.executionTime,
        statementCount,
        query: currentQuery,
        database: selectedDatabase ?? undefined,
        context: result.context,
        message: result.success
          ? `${messagePrefix}${result.rowCount} row(s) returned in ${result.executionTime}ms.`
          : result.error,
        messageType: result.success ? 'success' : 'error',
      });

      addEntry({
        query: currentQuery,
        language: activeConnection.type,
        connectionId: activeConnection.connectionId,
        connectionName,
        executionTime: result.executionTime,
        success: result.success,
        rowCount: result.rowCount,
        error: result.error,
        database: result.context?.database ?? selectedDatabase ?? undefined,
        collection: result.context?.collection,
        tables: result.context?.tables,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setResults({
          success: false,
          data: [],
          rowCount: 0,
          executionTime: Date.now() - startTime,
          message: 'Query cancelled',
          messageType: 'info',
          query: currentQuery,
          database: selectedDatabase ?? undefined,
        });
      } else {
        const message = error instanceof Error ? error.message : 'Query execution failed';
        const connectionName =
          connections.find((c) => c.id === activeConnection.connectionId)?.name || 'Unknown';

        setResults({
          success: false,
          data: [],
          rowCount: 0,
          executionTime: Date.now() - startTime,
          message,
          messageType: 'error',
          query: currentQuery,
          database: selectedDatabase ?? undefined,
        });

        addEntry({
          query: currentQuery,
          language: activeConnection.type,
          connectionId: activeConnection.connectionId,
          connectionName,
          executionTime: Date.now() - startTime,
          success: false,
          error: message,
          database: selectedDatabase ?? undefined,
        });
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsExecuting(false);
      setIsLoading(false);
    }
  }, [
    activeConnection,
    connectionStatus,
    currentQuery,
    connections,
    setIsExecuting,
    setIsLoading,
    setResults,
    addEntry,
    selectedDatabase,
    active,
    addTransactionQuery,
  ]);

  useEffect(() => {
    executeQueryRef.current = executeQuery;
  }, [executeQuery]);

  const handleExplain = useCallback(async () => {
    if (!activeConnection || connectionStatus !== 'connected') return;
    if (!currentQuery.trim()) return;

    setIsExecuting(true);
    setIsLoading(true);

    const startTime = Date.now();

    try {
      const result = await api.executeQuery(
        activeConnection.sessionId,
        currentQuery,
        selectedDatabase ?? undefined,
        { explain: true },
        activeConnection.signingKey,
      );

      setResults({
        success: result.success,
        data: result.data,
        columns: result.columns,
        rowCount: result.rowCount,
        executionTime: result.executionTime,
        query: currentQuery,
        database: selectedDatabase ?? undefined,
        context: result.context,
        message: result.success
          ? `Query plan generated in ${result.executionTime}ms.`
          : result.error,
        messageType: result.success ? 'info' : 'error',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Explain query failed';

      setResults({
        success: false,
        data: [],
        rowCount: 0,
        executionTime: Date.now() - startTime,
        message,
        messageType: 'error',
        query: currentQuery,
        database: selectedDatabase ?? undefined,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [
    activeConnection,
    connectionStatus,
    currentQuery,
    setIsExecuting,
    setIsLoading,
    setResults,
    selectedDatabase,
  ]);

  const handleFormat = useCallback(async () => {
    if (!currentQuery.trim()) return;
    try {
      if (language === 'mongodb') {
        try {
          const normalized = currentQuery
            .replace(/\s+/g, ' ')
            .replace(/\s*\{\s*/g, '{')
            .replace(/\s*\}\s*/g, '}')
            .replace(/\s*\[\s*/g, '[')
            .replace(/\s*\]\s*/g, ']')
            .replace(/\s*\(\s*/g, '(')
            .replace(/\s*\)\s*/g, ')')
            .replace(/\s*,\s*/g, ',')
            .replace(/\s*:\s*/g, ':')
            .trim();

          const trimmed = normalized.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              const formatted = JSON.stringify(parsed, null, 2);
              setQuery(formatted);
              return;
            } catch {
              logger.debug('Failed to parse JSON, using original format', {
                query: trimmed.substring(0, 100),
              });
              setQuery(trimmed);
              return;
            }
          }

          const prettier = await import('prettier/standalone');
          const babelPlugin = await import('prettier/plugins/babel');
          const formatted = await prettier.format(normalized, {
            parser: 'babel',
            plugins: [babelPlugin],
            semi: true,
            singleQuote: true,
            tabWidth: 2,
            printWidth: 80,
          });
          setQuery(formatted?.trim() ?? '');
        } catch (error) {
          logger.debug('Failed to format MongoDB query with Prettier, using fallback', {
            error: error instanceof Error ? error.message : String(error),
          });
          try {
            let normalized = currentQuery.replace(/\s+/g, ' ').trim();

            const mongoPattern = /db\.(\w+)\.(\w+)\((.*)\)/s;
            const match = normalized.match(mongoPattern);

            if (match) {
              const [, collection, method, args] = match;
              let formattedArgs = args.trim();

              if (formattedArgs.startsWith('{') && formattedArgs.endsWith('}')) {
                try {
                  const objStr = formattedArgs
                    .replace(/(\w+):/g, '"$1":')
                    .replace(/:(\d+)/g, ':$1');

                  const parsed = JSON.parse(objStr);
                  formattedArgs = JSON.stringify(parsed, null, 2);
                } catch {
                  formattedArgs = formattedArgs
                    .slice(1, -1)
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item) => `  ${item}`)
                    .join(',\n');
                  formattedArgs = `{\n${formattedArgs}\n}`;
                }
              }

              const formatted = `db.${collection}.${method}(${formattedArgs})`;
              setQuery(formatted);
            } else {
              setQuery(normalized);
            }
          } catch {
            logger.debug('Failed to format MongoDB query, using normalized version', {
              error: error instanceof Error ? error.message : String(error),
            });
            const normalized = currentQuery.replace(/\s+/g, ' ').trim();
            setQuery(normalized);
          }
        }
        return;
      }

      const formatter = await import('sql-formatter');
      const formatted = formatter.format(currentQuery, {
        language: language === 'mysql' ? 'mysql' : 'postgresql',
      });
      setQuery(formatted.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Formatting failed';
      setResults({
        success: false,
        data: [],
        rowCount: 0,
        executionTime: 0,
        message,
        messageType: 'error',
        query: currentQuery,
        database: selectedDatabase ?? undefined,
      });
    }
  }, [currentQuery, language, setQuery, setResults, selectedDatabase]);

  const handleBeginTransaction = useCallback(async () => {
    if (!activeConnection?.sessionId) return;
    try {
      await api.beginTransaction(activeConnection.sessionId, activeConnection.signingKey);
      setActive(true);
    } catch (error) {
      setActive(false);
      const message = error instanceof Error ? error.message : 'Failed to begin transaction';
      setResults({
        success: false,
        data: [],
        rowCount: 0,
        executionTime: 0,
        message: `Transaction error: ${message}. Check that the database supports transactions and your connection is active.`,
        messageType: 'error',
      });
    }
  }, [activeConnection, setActive, setResults]);

  const handleCommitTransaction = useCallback(async () => {
    if (!activeConnection?.sessionId) return;
    try {
      await api.commitTransaction(activeConnection.sessionId, activeConnection.signingKey);
      clearTransaction();
    } catch (error) {
      clearTransaction();
      const message = error instanceof Error ? error.message : 'Failed to commit transaction';
      setResults({
        success: false,
        data: [],
        rowCount: 0,
        executionTime: 0,
        message: `Transaction error: ${message}. Changes may not have been committed.`,
        messageType: 'error',
      });
    }
  }, [activeConnection, clearTransaction, setResults]);

  const handleRollbackTransaction = useCallback(async () => {
    if (!activeConnection?.sessionId) return;
    try {
      await api.rollbackTransaction(activeConnection.sessionId, activeConnection.signingKey);
      clearTransaction();
    } catch (error) {
      clearTransaction();
      const message = error instanceof Error ? error.message : 'Failed to rollback transaction';
      setResults({
        success: false,
        data: [],
        rowCount: 0,
        executionTime: 0,
        message: `Transaction error: ${message}. Session may need to be reconnected.`,
        messageType: 'error',
      });
    }
  }, [activeConnection, clearTransaction, setResults]);

  const handleClear = () => {
    clearQuery();
    editorRef.current?.focus();
  };

  const handleCancelQuery = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const editorLanguage = language === 'mongodb' ? 'mongodb' : 'sql';

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface rounded-lg border border-border overflow-hidden">
      <EditorToolbar
        onExecute={executeQuery}
        onCancel={handleCancelQuery}
        onClear={handleClear}
        onFormat={handleFormat}
        onExplain={handleExplain}
        onBeginTransaction={handleBeginTransaction}
        onCommitTransaction={handleCommitTransaction}
        onRollbackTransaction={handleRollbackTransaction}
        isExecuting={isExecuting}
        isTransactionActive={active}
      />

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={editorLanguage}
          value={currentQuery}
          onChange={(value) => setQuery(value || '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            suggest: {
              insertMode: 'replace',
              showKeywords: true,
              showSnippets: true,
              showFunctions: true,
              showMethods: true,
              showOperators: true,
              showClasses: true,
              showVariables: true,
              showFields: true,
              showProperties: true,
              showEvents: true,
              showEnums: true,
              showModules: true,
              showStructs: true,
              showInterfaces: true,
              filterGraceful: true,
            },
            formatOnPaste: true,
            formatOnType: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
          loading={
            <div className="flex items-center justify-center h-full text-text-secondary">
              Loading editor...
            </div>
          }
        />
      </div>
    </div>
  );
}
