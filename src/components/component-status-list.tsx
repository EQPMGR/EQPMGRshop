
'use client';
import type { Component } from '@/lib/types';
interface ComponentStatusListProps {
  components: Component[];
}
export function ComponentStatusList({ components }: ComponentStatusListProps) {
  return (
    <div className="text-sm text-muted-foreground p-4 border rounded-md">
      ComponentStatusList placeholder. {components.length} components.
    </div>
  );
}
