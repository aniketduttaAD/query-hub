import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Shield, Database, Keyboard, FileCode } from 'lucide-react';
import { Modal } from '../common';

interface AccordionItemProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = `accordion-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-surface-hover transition-colors min-h-[48px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        <span className="font-medium text-primary">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-text-muted shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="w-5 h-5 text-text-muted shrink-0" aria-hidden />
        )}
      </button>
      {isOpen && (
        <div
          id={contentId}
          className="px-4 pb-4 text-sm text-text-secondary space-y-3 leading-relaxed"
          role="region"
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Help & Guide" size="lg">
      <div className="space-y-6">
        <section>
          <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
            <Database className="w-5 h-5" />
            App Features
          </h3>
          <ul className="space-y-2 text-sm text-text-secondary list-disc list-inside">
            <li>Connect to PostgreSQL, MySQL, and MongoDB databases</li>
            <li>Execute queries with real-time syntax highlighting</li>
            <li>View results in table or JSON format</li>
            <li>Explore database schema (tables, collections, columns)</li>
            <li>Query history with 2-day retention</li>
            <li>Secure credential storage with AES-GCM encryption</li>
            <li>Transaction support for SQL databases (Begin, Commit, Rollback)</li>
            <li>Test connections before adding them</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-primary mb-3">Supported Databases</h3>
          <p className="text-sm text-text-secondary mb-2">
            Currently supports <strong>PostgreSQL</strong>, <strong>MySQL</strong>, and{' '}
            <strong>MongoDB</strong>.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </h3>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li>
              <kbd className="bg-surface-hover px-1.5 py-0.5 rounded text-xs font-mono">
                Ctrl+Enter
              </kbd>{' '}
              /{' '}
              <kbd className="bg-surface-hover px-1.5 py-0.5 rounded text-xs font-mono">
                Cmd+Enter
              </kbd>{' '}
              — Execute query
            </li>
            <li>
              <kbd className="bg-surface-hover px-1.5 py-0.5 rounded text-xs font-mono">
                Ctrl+Shift+E
              </kbd>{' '}
              /{' '}
              <kbd className="bg-surface-hover px-1.5 py-0.5 rounded text-xs font-mono">
                Cmd+Shift+E
              </kbd>{' '}
              — Explain / show query plan
            </li>
            <li>
              Click <strong>Cancel</strong> in the toolbar (or use the button while a query is
              running) to cancel a long-running query.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
            <FileCode className="w-5 h-5" />
            Query Templates
          </h3>
          <p className="text-sm text-text-secondary mb-3">
            Common snippets to get started. Replace{' '}
            <code className="bg-surface-hover px-1 rounded">table_name</code> and column names with
            your schema.
          </p>
          <div className="border border-border rounded-lg overflow-hidden space-y-0">
            <div className="bg-surface-hover px-3 py-2 border-b border-border">
              <span className="text-xs font-medium text-text-muted">SQL (PostgreSQL / MySQL)</span>
            </div>
            <div className="p-3 space-y-3 text-sm">
              <div>
                <p className="font-medium text-primary mb-1">Select with limit</p>
                <pre className="bg-surface p-2 rounded text-xs overflow-x-auto">
                  {`SELECT * FROM table_name LIMIT 10;`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-primary mb-1">Count rows</p>
                <pre className="bg-surface p-2 rounded text-xs overflow-x-auto">
                  {`SELECT COUNT(*) FROM table_name;`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-primary mb-1">List tables (PostgreSQL)</p>
                <pre className="bg-surface p-2 rounded text-xs overflow-x-auto">
                  {`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-primary mb-1">List tables (MySQL)</p>
                <pre className="bg-surface p-2 rounded text-xs overflow-x-auto">
                  {`SHOW TABLES;`}
                </pre>
              </div>
            </div>
            <div className="bg-surface-hover px-3 py-2 border-t border-border">
              <span className="text-xs font-medium text-text-muted">MongoDB</span>
            </div>
            <div className="p-3 space-y-3 text-sm">
              <div>
                <p className="font-medium text-primary mb-1">Find with limit</p>
                <pre className="bg-surface p-2 rounded text-xs overflow-x-auto">
                  {`db.collection_name.find({}).limit(10)`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-primary mb-1">Count documents</p>
                <pre className="bg-surface p-2 rounded text-xs overflow-x-auto">
                  {`db.collection_name.countDocuments({})`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-primary mb-1">List databases</p>
                <pre className="bg-surface p-2 rounded text-xs overflow-x-auto">
                  {`db.admin().listDatabases()`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security & Privacy
          </h3>
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-2 text-sm">
            <p className="text-success font-medium">✓ Nothing is stored on the server</p>
            <p className="text-text-secondary">
              All connection credentials and query history are stored locally in your browser using
              encrypted storage.
            </p>
            <p className="text-text-secondary">
              Connection URLs are encrypted with AES-GCM encryption before being saved to
              localStorage.
            </p>
            <p className="text-text-secondary">
              Your data never leaves your device - all database connections are made directly from
              your browser.
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-primary mb-3">Getting Started</h3>
          <div className="border border-border rounded-lg overflow-hidden">
            <AccordionItem title="Download & Install Locally" defaultOpen>
              <div className="space-y-3">
                <div>
                  <p className="font-medium mb-1">MongoDB:</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>
                      Download from:{' '}
                      <a
                        href="https://www.mongodb.com/try/download/community"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
                      >
                        mongodb.com/download
                      </a>
                    </li>
                    <li>Install and start MongoDB service</li>
                    <li>
                      Connection URL:{' '}
                      <code className="bg-surface-hover px-1 rounded">
                        mongodb://user:password@localhost:27017/database
                      </code>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1">PostgreSQL:</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>
                      Download from:{' '}
                      <a
                        href="https://www.postgresql.org/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
                      >
                        postgresql.org/download
                      </a>
                    </li>
                    <li>Install and start PostgreSQL service</li>
                    <li>
                      Connection URL:{' '}
                      <code className="bg-surface-hover px-1 rounded">
                        postgresql://user:password@localhost:5432/database
                      </code>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1">MySQL:</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>
                      Download from:{' '}
                      <a
                        href="https://dev.mysql.com/downloads/mysql/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
                      >
                        dev.mysql.com/downloads/mysql
                      </a>
                    </li>
                    <li>Install and start MySQL service</li>
                    <li>
                      Connection URL:{' '}
                      <code className="bg-surface-hover px-1 rounded">
                        mysql://user:password@localhost:3306/database
                      </code>
                    </li>
                  </ul>
                </div>
              </div>
            </AccordionItem>

            <AccordionItem title="Use MongoDB Online (Free)">
              <div className="space-y-3">
                <p className="text-text-secondary">Get a free MongoDB database in the cloud:</p>
                <div className="bg-surface-hover rounded p-3 space-y-2">
                  <p className="font-medium">MongoDB Atlas (Free Tier)</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>
                      Visit:{' '}
                      <a
                        href="https://www.mongodb.com/cloud/atlas/register"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
                      >
                        mongodb.com/cloud/atlas
                      </a>
                    </li>
                    <li>Create a free account (512 MB storage)</li>
                    <li>Create a cluster and get your connection string</li>
                    <li>
                      Format: <code className="bg-surface px-1 rounded">mongodb+srv:</code>
                    </li>
                  </ul>
                </div>
              </div>
            </AccordionItem>

            <AccordionItem title="Use PostgreSQL Online (Free)">
              <div className="space-y-3">
                <p className="text-text-secondary">Get a free PostgreSQL database in the cloud:</p>
                <div className="bg-surface-hover rounded p-3 space-y-2">
                  <p className="font-medium">Neon (Free Tier)</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>
                      Visit:{' '}
                      <a
                        href="https://neon.tech"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
                      >
                        neon.tech
                      </a>
                    </li>
                    <li>Sign up for free (512 MB storage)</li>
                    <li>Create a project and get your connection string</li>
                    <li>
                      Format: <code className="bg-surface px-1 rounded">postgresql://...</code>
                    </li>
                  </ul>
                </div>
                <div className="bg-surface-hover rounded p-3 space-y-2 mt-3">
                  <p className="font-medium">Supabase (Free Tier)</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>
                      Visit:{' '}
                      <a
                        href="https://supabase.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
                      >
                        supabase.com
                      </a>
                    </li>
                    <li>Create a free project (500 MB storage)</li>
                    <li>Get connection string from project settings</li>
                  </ul>
                </div>
              </div>
            </AccordionItem>

            <AccordionItem title="Use MySQL Online (Free)">
              <div className="space-y-3">
                <p className="text-text-secondary">Get a free MySQL database in the cloud:</p>
                <div className="bg-surface-hover rounded p-3 space-y-2">
                  <p className="font-medium">PlanetScale (Free Tier)</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>
                      Visit:{' '}
                      <a
                        href="https://planetscale.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
                      >
                        planetscale.com
                      </a>
                    </li>
                    <li>Sign up for free (5 GB storage)</li>
                    <li>Create a database and get your connection string</li>
                    <li>
                      Format: <code className="bg-surface px-1 rounded">mysql://...</code>
                    </li>
                  </ul>
                </div>
                <div className="bg-surface-hover rounded p-3 space-y-2 mt-3">
                  <p className="font-medium">Aiven (Free Trial)</p>
                  <ul className="list-disc list-inside space-y-1 text-text-muted">
                    <li>
                      Visit:{' '}
                      <a
                        href="https://aiven.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
                      >
                        aiven.io
                      </a>
                    </li>
                    <li>Free trial available</li>
                    <li>Create a MySQL service and get connection string</li>
                  </ul>
                </div>
              </div>
            </AccordionItem>

            <AccordionItem title="Connection URL Format">
              <div className="space-y-3">
                <div>
                  <p className="font-medium mb-2">MongoDB:</p>
                  <code className="block bg-surface-hover p-2 rounded text-xs break-all">
                    mongodb://username:password@host:port/database
                  </code>
                  <p className="text-xs text-text-muted mt-1">
                    Example:{' '}
                    <code className="bg-surface-hover px-1 rounded">
                      mongodb://user:pass@localhost:27017/mydb
                    </code>
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-2">PostgreSQL:</p>
                  <code className="block bg-surface-hover p-2 rounded text-xs break-all">
                    postgresql://username:password@host:port/database
                  </code>
                  <p className="text-xs text-text-muted mt-1">
                    Example:{' '}
                    <code className="bg-surface-hover px-1 rounded">
                      postgresql://user:pass@localhost:5432/mydb
                    </code>
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-2">MySQL:</p>
                  <code className="block bg-surface-hover p-2 rounded text-xs break-all">
                    mysql://username:password@host:port/database
                  </code>
                  <p className="text-xs text-text-muted mt-1">
                    Example:{' '}
                    <code className="bg-surface-hover px-1 rounded">
                      mysql://user:pass@localhost:3306/mydb
                    </code>
                  </p>
                </div>
              </div>
            </AccordionItem>
          </div>
        </section>
      </div>
    </Modal>
  );
}
