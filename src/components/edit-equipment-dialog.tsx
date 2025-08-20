
'use client';
import type { Equipment } from '@/lib/types';
interface EditEquipmentDialogProps {
  equipment: Equipment;
  allBikes: Equipment[];
  onUpdateEquipment: (data: Partial<Equipment>) => void;
}
export function EditEquipmentDialog({ equipment, allBikes, onUpdateEquipment }: EditEquipmentDialogProps) {
  return (
    <div className="text-sm text-muted-foreground p-4 border rounded-md">
      EditEquipmentDialog placeholder for {equipment.name}.
    </div>
  );
}
