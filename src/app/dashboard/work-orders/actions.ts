'use server';

import { db } from '@/lib/supabase';
import { verifyShopToken } from '@/lib/server-auth';

// Internal shop notes (rider repo migration 023). Riders never see these.
// Server code uses the service-role key, so these checks are what protect them.

export type WorkOrderNote = { id: string; body: string; createdAt: string };

const MAX_NOTE_LENGTH = 2000;

async function assertShopOwnsWorkOrder(shopUid: string, workOrderId: string) {
  const { data, error } = await db
    .from('work_orders')
    .select('id')
    .eq('id', workOrderId)
    .or(`service_provider_id.eq.${shopUid},service_provider_auth_uid.eq.${shopUid}`)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Work order not found.');
}

export async function getWorkOrderNotesAction({
  accessToken,
  workOrderId,
}: {
  accessToken: string;
  workOrderId: string;
}): Promise<{ success: boolean; notes: WorkOrderNote[]; message?: string }> {
  try {
    const shop = await verifyShopToken(accessToken);
    await assertShopOwnsWorkOrder(shop.uid, workOrderId);

    const { data, error } = await db
      .from('work_order_notes')
      .select('id, body, created_at')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return {
      success: true,
      notes: (data || []).map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at })),
    };
  } catch (error) {
    console.error('[SERVER ACTION ERROR] in getWorkOrderNotesAction:', error);
    return { success: false, notes: [], message: 'Could not load the notes.' };
  }
}

export async function addWorkOrderNoteAction({
  accessToken,
  workOrderId,
  body,
}: {
  accessToken: string;
  workOrderId: string;
  body: string;
}): Promise<{ success: boolean; note?: WorkOrderNote; message?: string }> {
  try {
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) return { success: false, message: 'Write a note first.' };
    if (text.length > MAX_NOTE_LENGTH) {
      return { success: false, message: `Notes can be up to ${MAX_NOTE_LENGTH} characters.` };
    }

    const shop = await verifyShopToken(accessToken);
    await assertShopOwnsWorkOrder(shop.uid, workOrderId);

    const { data, error } = await db
      .from('work_order_notes')
      .insert({ work_order_id: workOrderId, author_id: shop.uid, body: text })
      .select('id, body, created_at')
      .single();
    if (error) throw error;

    return { success: true, note: { id: data.id, body: data.body, createdAt: data.created_at } };
  } catch (error) {
    console.error('[SERVER ACTION ERROR] in addWorkOrderNoteAction:', error);
    return { success: false, message: 'Could not save the note.' };
  }
}
