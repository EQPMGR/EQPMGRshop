'use server';

import { db } from '@/lib/supabase';
import { verifyShopToken, requireOpenWorkOrder } from '@/lib/server-auth';

// Shops change a customer's bike only through these actions, and only while
// they have an open work order for it. Server code uses the service-role key,
// so the checks below are what protect the customer's data.

export async function replaceUserComponentAction({
  accessToken,
  equipmentId,
  userComponentIdToReplace,
  replacementReason,
  newMasterComponentId,
  manualNewComponentData,
  finalStretch,
}: {
  accessToken: string;
  equipmentId: string;
  userComponentIdToReplace: string;
  replacementReason: 'failure' | 'modification' | 'upgrade';
  newMasterComponentId?: string | null;
  manualNewComponentData?: {
    name: string;
    brand: string;
    series?: string;
    model?: string;
    size?: string;
  } | null;
  /** Chains: stretch measured at replacement (percent) and the replace-at limit. */
  finalStretch?: { value: number; threshold: number } | null;
}) {
  if (!accessToken || !equipmentId || !userComponentIdToReplace) {
    throw new Error('Missing required parameters for component replacement.');
  }
  if (!newMasterComponentId && !manualNewComponentData) {
    throw new Error('Either a selected component or manual component data must be provided.');
  }

  try {
    const shop = await verifyShopToken(accessToken);
    const workOrder = await requireOpenWorkOrder(shop.uid, equipmentId);

    if (finalStretch) {
      await insertChainStretch({
        componentId: userComponentIdToReplace, equipmentId, shop, workOrderId: workOrder.id,
        value: finalStretch.value, threshold: finalStretch.threshold, notes: 'Measured at replacement',
      });
    }

    // Same routine the rider app uses (rider repo migration 015): swaps the part,
    // archives the old one, logs it, and records the replacement data.
    const { error } = await db.rpc('replace_component', {
      p_equipment_id: equipmentId,
      p_component_id: userComponentIdToReplace,
      p_reason: replacementReason,
      p_actor_id: shop.uid,
      p_new_master_component_id: newMasterComponentId || null,
      p_manual: manualNewComponentData ? {
        brand: manualNewComponentData.brand,
        series: manualNewComponentData.series || null,
        model: manualNewComponentData.model || null,
        size: manualNewComponentData.size || null,
      } : null,
      p_shop_id: shop.uid,
      p_shop_name: shop.shopName || 'Service provider',
      p_work_order_id: workOrder.id,
    });
    if (error) throw error;

    return { success: true, message: 'Component replaced successfully.' };
  } catch (error) {
    console.error('[SERVER ACTION ERROR] in replaceUserComponentAction:', error);
    throw new Error((error as Error).message || 'An unexpected error occurred during component replacement.');
  }
}

export async function addMaintenanceLogAction({
  accessToken,
  equipmentId,
  entry,
}: {
  accessToken: string;
  equipmentId: string;
  entry: {
    date: string;
    componentName: string;
    serviceType: 'serviced' | 'replaced' | 'inspected';
    notes?: string;
    cost?: number;
  };
}) {
  const shop = await verifyShopToken(accessToken);
  const workOrder = await requireOpenWorkOrder(shop.uid, equipmentId);

  const { data: equipment, error: readError } = await db
    .from('equipment')
    .select('maintenance_log')
    .eq('id', equipmentId)
    .single();
  if (readError) throw readError;

  // Rider-app log format, so both apps can read it.
  const logEntry = {
    id: crypto.randomUUID(),
    date: entry.date,
    log_type: 'service',
    description: entry.componentName,
    component_name: entry.componentName,
    cost: entry.cost ?? 0,
    service_type: 'shop',
    shop_id: shop.uid,
    shop_name: shop.shopName,
    work_order_id: workOrder.id,
    component_replaced: entry.serviceType === 'replaced',
    notes: entry.notes ?? '',
  };

  const { error } = await db
    .from('equipment')
    .update({ maintenance_log: [...(equipment.maintenance_log ?? []), logEntry] })
    .eq('id', equipmentId);
  if (error) throw error;

  return { success: true };
}

async function insertChainStretch(m: {
  componentId: string;
  equipmentId: string;
  shop: { uid: string; shopName: string | null };
  workOrderId: string;
  value: number;
  threshold: number;
  notes?: string;
}) {
  if (!(m.value >= 0 && m.value <= 5)) throw new Error('Stretch must be between 0% and 5%.');
  if (![0.5, 0.75, 1].includes(m.threshold)) throw new Error('Unknown chain wear limit.');

  const { data: part, error: partError } = await db
    .from('components')
    .select('id, wear_baseline_key')
    .eq('id', m.componentId)
    .eq('equipment_id', m.equipmentId)
    .maybeSingle();
  if (partError) throw partError;
  if (!part) throw new Error('Part not found on this bike.');
  if (part.wear_baseline_key !== 'chain') throw new Error('Stretch can only be recorded for a chain.');

  // Shop measurements are the most reliable field data (rider repo migration 017).
  const { error } = await db.from('component_measurements').insert({
    component_id: m.componentId,
    equipment_id: m.equipmentId,
    kind: 'chain_stretch',
    value: m.value,
    threshold: m.threshold,
    measured_by: m.shop.uid,
    measured_by_role: 'shop',
    shop_name: m.shop.shopName,
    work_order_id: m.workOrderId,
    notes: m.notes ?? null,
  });
  if (error) throw error;
}

export async function recordChainStretchAction({
  accessToken,
  equipmentId,
  componentId,
  value,
  threshold,
}: {
  accessToken: string;
  equipmentId: string;
  componentId: string;
  value: number;
  threshold: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const shop = await verifyShopToken(accessToken);
    const workOrder = await requireOpenWorkOrder(shop.uid, equipmentId);
    await insertChainStretch({ componentId, equipmentId, shop, workOrderId: workOrder.id, value, threshold });
    const pct = Math.round((value / threshold) * 100);
    return { success: true, message: `Recorded ${value}% stretch: about ${pct}% of the way to replacement.` };
  } catch (error) {
    return { success: false, message: (error as Error).message || 'Could not record the measurement.' };
  }
}
