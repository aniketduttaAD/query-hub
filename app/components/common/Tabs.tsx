import { ReactNode, createContext, useContext, useState } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultTab: string;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultTab, children, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={`flex flex-col h-full min-h-0 ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className = '' }: TabListProps) {
  return (
    <div
      role="tablist"
      className={`
        flex border-b border-border
        bg-surface overflow-x-auto shrink-0
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
}

export function Tab({ value, children, icon }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  const tabId = `tab-${value.replace(/\s+/g, '-')}`;
  const panelId = `tabpanel-${value.replace(/\s+/g, '-')}`;

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActiveTab(value)}
      className={`
        flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 shrink-0 min-h-[44px]
        text-sm font-medium
        border-b-2 -mb-px
        transition-colors duration-200
        whitespace-nowrap
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset
        ${
          isActive
            ? 'text-accent border-accent'
            : 'text-text-secondary border-transparent hover:text-primary hover:border-secondary'
        }
      `}
    >
      {icon}
      {children}
    </button>
  );
}

interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className = '' }: TabPanelProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  const { activeTab } = context;

  const tabId = `tab-${value.replace(/\s+/g, '-')}`;
  const panelId = `tabpanel-${value.replace(/\s+/g, '-')}`;

  if (activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      className={`flex-1 overflow-auto min-h-0 ${className}`}
    >
      {children}
    </div>
  );
}
