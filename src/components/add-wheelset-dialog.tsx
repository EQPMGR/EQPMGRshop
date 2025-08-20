
'use client';
import type { Equipment } from '@/lib/types';
interface AddWheelsetDialogProps {
  children: React.ReactNode;
  equipment: Equipment;
  onSuccess: () => void;
}
export function AddWheelsetDialog({ children, equipment, onSuccess }: AddWheelsetDialogProps) {
  return (
    <div className="text-sm text-muted-foreground p-4 border rounded-md">
      {children}
      AddWheelsetDialog placeholder for {equipment.name}.
    </div>
  );
}
