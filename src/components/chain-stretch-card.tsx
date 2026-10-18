'use client';

import { useState } from 'react';
import { Loader2, Ruler } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { getAccessToken } from '@/lib/client-auth';
import { recordChainStretchAction } from '@/app/dashboard/equipment/admin-actions';
import { ChainStretchFields, parseChainStretch, type ChainStretchValue } from '@/components/chain-stretch-fields';

/** Shop records measured chain stretch during an open work order. */
export function ChainStretchCard({
  equipmentId,
  componentId,
  onRecorded,
}: {
  equipmentId: string;
  componentId: string;
  onRecorded: () => void;
}) {
  const { toast } = useToast();
  const [stretch, setStretch] = useState<ChainStretchValue>({ value: '', threshold: '0.5' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let parsed;
    try {
      parsed = parseChainStretch(stretch);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Check the measurement', description: e.message });
      return;
    }
    if (!parsed) {
      toast({ variant: 'destructive', title: 'Enter the measured stretch first' });
      return;
    }
    setSaving(true);
    const result = await recordChainStretchAction({ accessToken: await getAccessToken(), equipmentId, componentId, ...parsed });
    setSaving(false);
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Could not save', description: result.message });
      return;
    }
    toast({ title: 'Measurement saved', description: result.message });
    setStretch({ ...stretch, value: '' });
    onRecorded();
  };

  return (
    <div className="mt-6 border-t pt-6 space-y-3">
      <h4 className="font-semibold flex items-center gap-2"><Ruler className="h-4 w-4" /> Chain stretch</h4>
      <p className="text-sm text-muted-foreground">
        Record the chain checker reading. It updates the customer&apos;s chain wear and feeds EQPMGR&apos;s lifespan data.
        Needs an open work order for this bike.
      </p>
      <ChainStretchFields stretch={stretch} onChange={setStretch} />
      <Button type="button" size="sm" onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save measurement
      </Button>
    </div>
  );
}
