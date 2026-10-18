import { db } from '@/lib/supabase';
import { toDate, toNullableDate } from '@/lib/date-utils';
import type { Component, Equipment, MaintenanceLog } from '@/lib/types';

// Customer bikes are read straight from Supabase with the shop's own login.
// RLS (rider repo migration 015) lets a shop see a bike once it has had a work
// order for it. Rows come back snake_case; the shop UI uses camelCase.

function snakeToCamel(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function toCamel<T = any>(row: Record<string, any>): T {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [snakeToCamel(k), v])) as T;
}

/**
 * The rider app and the shared replace_component() write log entries in the
 * rider format (description, service_type 'diy'|'shop', ...); older shop
 * entries used componentName/serviceType. Read either.
 */
export function normalizeLogEntry(raw: any): MaintenanceLog {
  const e = toCamel<any>(raw ?? {});
  const serviceType = e.componentReplaced
    ? 'replaced'
    : ['serviced', 'replaced', 'inspected'].includes(e.serviceType) ? e.serviceType : 'serviced';
  return {
    id: e.id ?? crypto.randomUUID(),
    date: toDate(e.date),
    componentName: e.componentName ?? e.description ?? 'Service',
    notes: [e.replacementPart && `New part: ${e.replacementPart}.`, e.notes].filter(Boolean).join(' '),
    serviceType,
    cost: e.cost,
    shopId: e.shopId,
    shopName: e.shopName,
  };
}

export async function loadCustomerBike(equipmentId: string): Promise<{ equipment: Equipment | null; ownerBikes: Equipment[] }> {
  const { data: row, error } = await db.from('equipment').select('*').eq('id', equipmentId).maybeSingle();
  if (error) throw error;
  if (!row) return { equipment: null, ownerBikes: [] };

  const [{ data: componentRows, error: componentsError }, { data: bikeRows }] = await Promise.all([
    db.from('components').select('*').eq('equipment_id', equipmentId),
    db.from('equipment').select('*').eq('user_id', row.user_id),
  ]);
  if (componentsError) throw componentsError;

  const masterIds = [...new Set((componentRows ?? []).map((c: any) => c.master_component_id).filter(Boolean))];
  const masters = new Map<string, any>();
  if (masterIds.length > 0) {
    const { data: masterRows, error: mastersError } = await db.from('master_components').select('*').in('id', masterIds);
    if (mastersError) throw mastersError;
    (masterRows ?? []).forEach((m: any) => masters.set(m.id, m));
  }

  const components: Component[] = (componentRows ?? []).flatMap((c: any) => {
    const m = masters.get(c.master_component_id);
    if (!m) return [];
    return [{
      ...toCamel<any>(c),
      id: c.id,
      componentName: m.name,
      brand: m.brand,
      model: m.model,
      series: m.series,
      componentGroup: m.system,
      purchaseDate: toDate(c.purchase_date),
      lastServiceDate: toNullableDate(c.last_service_date),
    } as Component];
  });

  const equipment = {
    ...toCamel<any>(row),
    purchaseDate: toDate(row.purchase_date),
    components,
    maintenanceLog: (row.maintenance_log ?? []).map(normalizeLogEntry),
  } as Equipment;

  return { equipment, ownerBikes: (bikeRows ?? []).map((b: any) => toCamel<Equipment>(b)) };
}
