
'use client';
import type { Equipment } from '@/lib/types';
interface WearSimulationProps {
  equipment: Equipment;
  onSuccess: () => void;
}
export function WearSimulation({ equipment, onSuccess }: WearSimulationProps) {
  return (
    <div className="text-sm text-muted-foreground p-4 border rounded-md">
      WearSimulation placeholder for {equipment.name}.
      <button onClick={onSuccess}>Trigger Success</button>
    </div>
  );
}
