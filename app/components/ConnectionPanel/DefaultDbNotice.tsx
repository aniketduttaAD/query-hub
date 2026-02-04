import { AlertCircle, Clock } from 'lucide-react';
import type { DatabaseType } from '../../../lib/types';

interface DefaultDbNoticeProps {
  dbType: DatabaseType;
}

export function DefaultDbNotice({ dbType }: DefaultDbNoticeProps) {
  const dbTypeUrl =
    dbType === 'mongodb' ? 'MongoDB' : dbType === 'postgresql' ? 'PostgreSQL' : 'MySQL';

  return (
    <div className="mx-4 mb-4 p-3 rounded-lg border border-warning/30 bg-warning/5">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-warning mb-1">Default Database</div>
          <div className="text-xs text-text-secondary space-y-1">
            <p>
              Destructive operations (delete, drop, truncate) are simulated. Your queries are valid
              but won&apos;t modify the database.
            </p>
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
              <Clock className="w-3 h-3 text-text-muted" />
              <span className="text-text-muted">Auto-reset daily at 2:00 AM UTC</span>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Use your own {dbTypeUrl} URL for full database access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
