'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import {
  Database,
  FolderTree,
  History,
  GripVertical,
  HelpCircle,
  PanelRightOpen,
  X,
} from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel, ErrorBoundary } from './components/common';
import { ConnectionPanel } from './components/ConnectionPanel';
import { QueryEditor } from './components/QueryEditor';
import { ResultsPanel } from './components/ResultsPanel';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { CommandHistory } from './components/CommandHistory';
import { HelpModal } from './components/HelpModal';
import { useConnectionStore } from './stores';

const SIDEBAR_MIN = 280;
const SIDEBAR_MAX = 600;
const LG_BREAKPOINT = 1024;

export default function Page() {
  const {
    connectionStatus,
    errorMessage,
    activeConnection,
    defaultUnlocked,
    unlockDefaultSession,
  } = useConnectionStore();
  const [editorHeight, setEditorHeight] = useState(50);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLg, setIsLg] = useState(true);
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const statusClickCount = useRef(0);
  const statusClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () =>
      setIsLg(typeof window !== 'undefined' && window.innerWidth >= LG_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
        setSidebarWidth(Math.min(Math.max(newWidth, SIDEBAR_MIN), SIDEBAR_MAX));
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

  const sidebarContent = (
    <Tabs defaultTab="connections">
      <TabList>
        <Tab value="connections" icon={<Database className="w-4 h-4 shrink-0" />}>
          Connections
        </Tab>
        {(activeConnection && !activeConnection.isDefault) ||
        (activeConnection?.isDefault && defaultUnlocked) ? (
          <Tab value="explorer" icon={<FolderTree className="w-4 h-4 shrink-0" />}>
            Explorer
          </Tab>
        ) : null}
        <Tab value="history" icon={<History className="w-4 h-4 shrink-0" />}>
          History
        </Tab>
      </TabList>

      <TabPanel value="connections" className="flex-1 overflow-hidden min-h-0">
        <ErrorBoundary>
          <ConnectionPanel />
        </ErrorBoundary>
      </TabPanel>

      {(activeConnection && !activeConnection.isDefault) ||
      (activeConnection?.isDefault && defaultUnlocked) ? (
        <TabPanel value="explorer" className="flex-1 overflow-hidden min-h-0">
          <ErrorBoundary>
            <DatabaseExplorer />
          </ErrorBoundary>
        </TabPanel>
      ) : null}

      <TabPanel value="history" className="flex-1 overflow-hidden min-h-0">
        <ErrorBoundary>
          <CommandHistory />
        </ErrorBoundary>
      </TabPanel>
    </Tabs>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden min-h-0">
      <header
        className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3 bg-primary text-white shadow-md z-10 shrink-0"
        role="banner"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl shadow-sm shrink-0">
            <Image
              src="/icon.png"
              alt="QueryHub logo"
              width={100}
              height={100}
              className="rounded-md w-full h-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate">QueryHub</h1>
            <span className="text-xs opacity-80 hidden sm:inline">
              Learn SQL & MongoDB interactively
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {!isLg && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 min-h-[44px] min-w-[44px] rounded-md hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              title="Open Connections & History"
              aria-label="Open Connections and History panel"
            >
              <PanelRightOpen className="w-5 h-5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="p-2 min-h-[44px] min-w-[44px] rounded-md hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            title="Help & Guide"
            aria-label="Open Help and Guide"
          >
            <HelpCircle className="w-5 h-5" aria-hidden />
          </button>
        </div>
      </header>

      {errorMessage && (
        <div
          className="px-3 sm:px-6 py-2 bg-error/10 border-b border-error/20 text-error text-sm shrink-0"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage}
        </div>
      )}

      <div id="main-content" role="main" className="flex-1 flex overflow-hidden min-h-0">
        <div
          ref={containerRef}
          className="flex-1 flex flex-col p-2 sm:p-4 min-w-0 overflow-hidden"
          style={isLg ? { width: `calc(100% - ${sidebarWidth}px)` } : undefined}
        >
          <div className="min-h-0 flex-shrink-0" style={{ height: `${editorHeight}%` }}>
            <ErrorBoundary>
              <QueryEditor />
            </ErrorBoundary>
          </div>

          <div
            className="flex items-center justify-center h-4 sm:h-5 cursor-row-resize group shrink-0 touch-none"
            onMouseDown={handleVerticalMouseDown}
            role="separator"
            aria-orientation="horizontal"
            aria-valuenow={editorHeight}
            aria-valuemin={20}
            aria-valuemax={80}
            aria-label="Resize editor and results"
            title="Drag to resize editor and results"
          >
            <div className="w-12 sm:w-16 h-1 rounded-full bg-border group-hover:bg-secondary transition-colors" />
          </div>

          <div
            className="min-h-0 flex-1 overflow-hidden"
            style={{ height: `${100 - editorHeight}%` }}
          >
            <ErrorBoundary>
              <ResultsPanel />
            </ErrorBoundary>
          </div>
        </div>

        {isLg && (
          <>
            <div
              className="w-4 cursor-col-resize flex items-center justify-center hover:bg-secondary/20 transition-colors shrink-0 touch-none min-h-[44px]"
              onMouseDown={handleHorizontalMouseDown}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              title="Drag to resize sidebar"
            >
              <GripVertical className="w-4 h-4 text-border" aria-hidden />
            </div>

            <div
              className="flex flex-col bg-surface border-l border-border shrink-0 overflow-hidden"
              style={{
                width: `${sidebarWidth}px`,
                minWidth: `${SIDEBAR_MIN}px`,
                maxWidth: `${SIDEBAR_MAX}px`,
              }}
            >
              {sidebarContent}
            </div>
          </>
        )}
      </div>

      {/* Sidebar overlay on small screens */}
      {!isLg && (
        <>
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
          )}
          <div
            className={`
              fixed top-0 right-0 bottom-0 z-30 flex flex-col bg-surface border-l border-border shadow-xl
              w-[min(90vw,400px)] max-w-full
              transform transition-transform duration-200 ease-out
              lg:hidden
              ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            `}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-primary">Connections & History</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 min-h-[44px] min-w-[44px] rounded-md hover:bg-surface-hover text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                title="Close panel"
                aria-label="Close Connections and History panel"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{sidebarContent}</div>
          </div>
        </>
      )}

      <footer
        className="px-3 sm:px-6 py-2 bg-surface border-t border-border text-xs sm:text-sm text-text-muted flex flex-wrap items-center justify-between gap-2 shrink-0"
        role="contentinfo"
      >
        <span className="truncate">QueryHub - A learning environment for SQL and MongoDB</span>
        <span className="flex items-center gap-1 shrink-0">
          Status:{' '}
          <span
            onClick={() => {
              if (connectionStatus !== 'connected' || !activeConnection?.isDefault) return;
              statusClickCount.current += 1;
              if (statusClickTimer.current) clearTimeout(statusClickTimer.current);
              statusClickTimer.current = setTimeout(() => {
                statusClickCount.current = 0;
                statusClickTimer.current = null;
              }, 500);
              if (statusClickCount.current >= 3) {
                statusClickCount.current = 0;
                if (statusClickTimer.current) {
                  clearTimeout(statusClickTimer.current);
                  statusClickTimer.current = null;
                }
                const code = typeof window !== 'undefined' ? window.prompt('') : null;
                if (code != null && code !== '') void unlockDefaultSession(code);
              }
            }}
            className={
              connectionStatus === 'connected'
                ? activeConnection?.isDefault && defaultUnlocked
                  ? 'text-orange-600 cursor-default select-none'
                  : 'text-success cursor-default select-none'
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
