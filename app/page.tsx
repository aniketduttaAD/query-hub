'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { Database, FolderTree, History, GripVertical, HelpCircle } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel, ErrorBoundary } from './components/common';
import { ConnectionPanel } from './components/ConnectionPanel';
import { QueryEditor } from './components/QueryEditor';
import { ResultsPanel } from './components/ResultsPanel';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { CommandHistory } from './components/CommandHistory';
import { HelpModal } from './components/HelpModal';
import { useConnectionStore } from './stores';

export default function Page() {
  const { connectionStatus, errorMessage, activeConnection } = useConnectionStore();
  const [editorHeight, setEditorHeight] = useState(50);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleVerticalMouseDown = () => {
    isDraggingVertical.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleHorizontalMouseDown = () => {
    isDraggingHorizontal.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingVertical.current && containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const newHeight = ((e.clientY - rect.top) / rect.height) * 100;
        setEditorHeight(Math.min(Math.max(newHeight, 20), 80));
      }

      if (isDraggingHorizontal.current) {
        const newWidth = window.innerWidth - e.clientX;
        setSidebarWidth(Math.min(Math.max(newWidth, 280), 600));
      }
    };

    const handleMouseUp = () => {
      isDraggingVertical.current = false;
      isDraggingHorizontal.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-primary text-white shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-sm">
            <Image
              src="/icon.png"
              alt="QueryHub logo"
              width={100}
              height={100}
              className="rounded-md"
              priority
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-tight">QueryHub</h1>
            <span className="text-xs opacity-80">SQL & MongoDB playground</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm opacity-80">Learn SQL & MongoDB interactively</div>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-md hover:bg-white/10 transition-colors"
            title="Help & Guide"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="px-6 py-2 bg-error/10 border-b border-error/20 text-error text-sm">
          {errorMessage}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 flex flex-col p-4 min-w-0"
          style={{ width: `calc(100% - ${sidebarWidth}px)` }}
        >
          <div className="min-h-0" style={{ height: `${editorHeight}%` }}>
            <ErrorBoundary>
              <QueryEditor />
            </ErrorBoundary>
          </div>

          <div
            className="flex items-center justify-center h-3 cursor-row-resize group"
            onMouseDown={handleVerticalMouseDown}
          >
            <div className="w-16 h-1 rounded-full bg-border group-hover:bg-secondary transition-colors" />
          </div>

          <div className="min-h-0 flex-1" style={{ height: `${100 - editorHeight}%` }}>
            <ErrorBoundary>
              <ResultsPanel />
            </ErrorBoundary>
          </div>
        </div>

        <div
          className="w-2 cursor-col-resize flex items-center justify-center hover:bg-secondary/20 transition-colors"
          onMouseDown={handleHorizontalMouseDown}
        >
          <GripVertical className="w-4 h-4 text-border" />
        </div>

        <div
          className="flex flex-col bg-surface border-l border-border"
          style={{ width: `${sidebarWidth}px` }}
        >
          <Tabs defaultTab="connections">
            <TabList>
              <Tab value="connections" icon={<Database className="w-4 h-4" />}>
                Connections
              </Tab>
              {activeConnection?.isIsolated && (
                <Tab value="explorer" icon={<FolderTree className="w-4 h-4" />}>
                  Explorer
                </Tab>
              )}
              <Tab value="history" icon={<History className="w-4 h-4" />}>
                History
              </Tab>
            </TabList>

            <TabPanel value="connections" className="flex-1 overflow-hidden">
              <ErrorBoundary>
                <ConnectionPanel />
              </ErrorBoundary>
            </TabPanel>

            {activeConnection?.isIsolated && (
              <TabPanel value="explorer" className="flex-1 overflow-hidden">
                <ErrorBoundary>
                  <DatabaseExplorer />
                </ErrorBoundary>
              </TabPanel>
            )}

            <TabPanel value="history" className="flex-1 overflow-hidden">
              <ErrorBoundary>
                <CommandHistory />
              </ErrorBoundary>
            </TabPanel>
          </Tabs>
        </div>
      </div>

      <footer className="px-6 py-2 bg-surface border-t border-border text-xs text-text-muted flex items-center justify-between">
        <span>QueryHub - A learning environment for SQL and MongoDB</span>
        <span>
          Status:{' '}
          <span
            className={
              connectionStatus === 'connected'
                ? 'text-success'
                : connectionStatus === 'connecting'
                  ? 'text-warning'
                  : 'text-text-muted'
            }
          >
            {connectionStatus}
          </span>
        </span>
      </footer>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
