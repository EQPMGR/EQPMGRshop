
'use client';
import type { Equipment } from '@/lib/types';
interface MaintenanceScheduleProps {
  equipment: Equipment;
}
export function MaintenanceSchedule({ equipment }: MaintenanceScheduleProps) {
  return (
    <div className="text-sm text-muted-foreground p-4 border rounded-md">
      MaintenanceSchedule placeholder for {equipment.name}.
    </div>
  );
}
