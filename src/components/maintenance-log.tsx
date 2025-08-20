
'use client';
import type { MaintenanceLog as MaintenanceLogType } from '@/lib/types';
interface MaintenanceLogProps {
  log: MaintenanceLogType[];
  onAddLog: (log: Omit<MaintenanceLogType, 'id'>) => void;
}
export function MaintenanceLog({ log, onAddLog }: MaintenanceLogProps) {
  return (
    <div className="text-sm text-muted-foreground p-4 border rounded-md">
      MaintenanceLog placeholder. {log.length} log entries.
      <button onClick={() => onAddLog({ componentName: 'test', date: new Date(), serviceType: 'serviced', notes: ''})}>Add Log</button>
    </div>
  );
}
