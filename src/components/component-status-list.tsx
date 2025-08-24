
'use client';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Component } from '@/lib/types';
import { formatDate } from '@/lib/date-utils';

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
    <TooltipProvider>
      <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Key Component Wear</h3>
          <div className="space-y-3">
              {components.map((component, index) => (
                  <Tooltip key={component.id || index}>
                      <TooltipTrigger className="w-full text-left">
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium">{component.componentName}</span>
                              <span className="text-xs text-muted-foreground">{(component.wearPercentage || 0).toFixed(0)}% worn</span>
                          </div>
                          <Progress value={component.wearPercentage || 0} className="h-2" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-semibold">{component.brand} {component.model}</p>
                        <p>{(component.wearPercentage || 0).toFixed(1)}% wear</p>
                        <p>{(component.totalDistance || 0).toFixed(0)} km / {(component.totalHours || 0).toFixed(1)} hrs</p>
                        <p>Purchased: {formatDate(component.purchaseDate)}</p>
                        {component.lastServiceDate && <p>Last Service: {formatDate(component.lastServiceDate)}</p>}
                      </TooltipContent>
                  </Tooltip>
              ))}
          </div>
      </div>
    </TooltipProvider>
  );
}
