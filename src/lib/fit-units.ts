// Bike fit lengths are always STORED in millimetres (equipment.fit_data).
// The form can show inches; it converts on the way in and out, and remembers
// the unit chosen in fit_data.units so the next person sees the same unit.
// Kept identical in the rider repo (src/lib/fit-units.ts).

export type FitUnits = 'metric' | 'imperial';

export const MM_PER_INCH = 25.4;

/** Fields that switch between mm and inches. Stem, crank, bar extension and
 *  cleat positions are always measured in mm, even in the US. Angles are degrees. */
export const SWITCHABLE_LENGTH_FIELDS = [
  'saddleHeight',
  'saddleHeightOverBars',
  'saddleToHandlebarReach',
  'saddleForeAft',
  'handlebarWidth',
] as const;

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Unit the stored fit was last entered in. Older fits (no units saved) were mm. */
export function storedUnits(fit: Record<string, unknown> | null | undefined): FitUnits {
  return fit?.units === 'imperial' ? 'imperial' : 'metric';
}

/** Convert the switchable lengths in a set of form values from one unit to the other. */
export function convertLengths<T extends Record<string, unknown>>(values: T, from: FitUnits, to: FitUnits): T {
  if (from === to) return { ...values };
  const out: Record<string, unknown> = { ...values };
  for (const key of SWITCHABLE_LENGTH_FIELDS) {
    const v = out[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = to === 'imperial' ? round(v / MM_PER_INCH, 2) : round(v * MM_PER_INCH, 1);
    }
  }
  return out as T;
}

/** Stored fit (mm) -> values to show in the form, in the unit it was entered in. */
export function fitForForm<T extends Record<string, unknown>>(fit: T | null | undefined): { values: T; units: FitUnits } {
  const units = storedUnits(fit);
  const { units: _ignored, ...rest } = (fit ?? {}) as Record<string, unknown>;
  return { values: convertLengths(rest, 'metric', units) as T, units };
}

/** Form values in `units` -> what to store (mm, plus the unit chosen). */
export function fitForStorage<T extends Record<string, unknown>>(values: T, units: FitUnits): T & { units: FitUnits } {
  return { ...convertLengths(values, units, 'metric'), units };
}
