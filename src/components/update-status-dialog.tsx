'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder, WorkOrderStatus } from '@/lib/types';
import { allStatuses } from '@/lib/types';

interface UpdateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
  onUpdated: (workOrderId: string, status: WorkOrderStatus) => void;
}

export function UpdateStatusDialog({ open, onOpenChange, workOrder, onUpdated }: UpdateStatusDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<WorkOrderStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && workOrder) setStatus(workOrder.status);
  }, [open, workOrder]);

  const handleSave = async () => {
    if (!workOrder || !status) return;
    setSaving(true);
    try {
      const { data, error } = await db
        .from('work_orders')
        .update({ status })
        .eq('id', workOrder.id)
        .select('id');

      if (error) throw error;
      // RLS turns a blocked update into "0 rows" with no error.
      if (!data?.length) throw new Error("This work order couldn't be updated.");

      // Callers show the new status right away (realtime updates aren't guaranteed).
      onUpdated(workOrder.id, status);
      toast({ title: 'Success', description: 'Work order status updated.' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update status.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Status</DialogTitle>
          <DialogDescription>
            Select the new status for work order #{workOrder?.id.substring(0, 7)}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="status-select">Status</Label>
          <Select value={status ?? undefined} onValueChange={(value: WorkOrderStatus) => setStatus(value)}>
            <SelectTrigger id="status-select">
              <SelectValue placeholder="Select a status" />
            </SelectTrigger>
            <SelectContent>
              {allStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent/90">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
