'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ChainStretchValue = { value: string; threshold: string };

export const CHAIN_LIMITS = [
  { value: '0.5', label: '11–12 speed (replace at 0.5%)' },
  { value: '0.75', label: '10 speed or less (replace at 0.75%)' },
  { value: '1', label: 'Single speed (replace at 1%)' },
];

/** Measured chain stretch (what a chain checker reads) and the chain's replace-at limit. */
export function ChainStretchFields({
  stretch,
  onChange,
  optional,
}: {
  stretch: ChainStretchValue;
  onChange: (next: ChainStretchValue) => void;
  optional?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="chain-stretch">Measured stretch (%){optional ? ' (optional)' : ''}</Label>
        <Input
          id="chain-stretch"
          type="number"
          inputMode="decimal"
          min="0"
          max="5"
          step="0.05"
          placeholder="e.g. 0.5"
          value={stretch.value}
          onChange={(e) => onChange({ ...stretch, value: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Checker tools read 0.25, 0.5, 0.75 or 1.0.</p>
      </div>
      <div className="space-y-1">
        <Label>Chain type</Label>
        <Select value={stretch.threshold} onValueChange={(threshold) => onChange({ ...stretch, threshold })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHAIN_LIMITS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Parsed measurement, or null when left blank. Throws on an invalid number. */
export function parseChainStretch(stretch: ChainStretchValue): { value: number; threshold: number } | null {
  if (stretch.value.trim() === '') return null;
  const value = Number(stretch.value);
  if (!Number.isFinite(value) || value < 0 || value > 5) throw new Error('Stretch must be a number between 0 and 5%.');
  return { value, threshold: Number(stretch.threshold) };
}

export function isChain(part: { wearBaselineKey?: string | null; wear_baseline_key?: string | null; name?: string | null; componentName?: string | null }) {
  const key = part.wearBaselineKey ?? part.wear_baseline_key;
  if (key) return key === 'chain';
  return /\bchain\b/i.test(part.componentName || part.name || '');
}
