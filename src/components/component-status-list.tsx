
'use client';
import type { Component } from '@/lib/types';
import { Progress } from '@/components/ui/progress';

interface ComponentStatusListProps {
  components: Component[];
}

export function ComponentStatusList({ components }: ComponentStatusListProps) {
    if (!components || components.length === 0) {
        return (
             <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
                No component data available.
            </div>
        )
    }

  return (
    <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Key Component Wear</h3>
        <div className="space-y-3">
            {components.map((component, index) => (
                <div key={component.userComponentId || index}>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{component.componentName}</span>
                        <span className="text-xs text-muted-foreground">{component.wearPercentage.toFixed(0)}% worn</span>
                    </div>
                    <Progress value={component.wearPercentage} className="h-2" />
                </div>
            ))}
        </div>
    </div>
  );
}
