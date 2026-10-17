import 'server-only';

import { db } from '@/lib/supabase';

export type AuthenticatedShop = { uid: string; email?: string; shopName: string | null };

/**
 * Verifies a Supabase access token from the client and returns the shop it
 * belongs to. Throws if the token is missing/invalid or the user has no shop.
 *
 * Server code here uses the service-role key, which bypasses RLS, so every
 * server action and route must call this instead of trusting an id sent by
 * the browser.
 */
export async function verifyShopToken(accessToken: string | null | undefined): Promise<AuthenticatedShop> {
  if (!accessToken) throw new Error('You must be signed in to do that.');

  const { data, error } = await db.auth.getUser(accessToken);
  if (error || !data?.user) throw new Error('Your session has expired. Please sign in again.');

  const { data: shop } = await db
    .from('service_providers')
    .select('id, shop_name')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!shop) throw new Error('No shop is set up for this account.');

  return { uid: data.user.id, email: data.user.email, shopName: shop.shop_name ?? null };
}

/** Work order statuses after which the shop may no longer change the bike. */
const CLOSED_STATUSES = ['Completed', 'Cancelled', 'cancelled'];

/**
 * Shops may change a customer's parts only while they have an open work order
 * for that bike. Returns the work order (including the customer's user_id),
 * or throws.
 */
export async function requireOpenWorkOrder(shopUid: string, equipmentId: string) {
  const { data, error } = await db
    .from('work_orders')
    .select('id, user_id, status')
    .eq('equipment_id', equipmentId)
    .or(`service_provider_id.eq.${shopUid},service_provider_auth_uid.eq.${shopUid}`)
    .not('status', 'in', `(${CLOSED_STATUSES.map((s) => `"${s}"`).join(',')})`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('You need an open work order for this bike to change its parts.');
  return data as { id: string; user_id: string; status: string };
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
