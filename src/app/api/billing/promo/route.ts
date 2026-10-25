import { NextResponse } from 'next/server';
import { getBearerToken, verifyShopToken } from '@/lib/server-auth';
import { db } from '@/lib/supabase';

// POST /api/billing/promo { code }: redeem a promo code (one per shop) for free tickets.
export async function POST(request: Request) {
  let shop;
  try {
    shop = await verifyShopToken(getBearerToken(request));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized.' }, { status: 401 });
  }
  const { code } = await request.json().catch(() => ({}));
  if (typeof code !== 'string' || !code.trim() || code.length > 40) {
    return NextResponse.json({ error: 'Enter a promo code.' }, { status: 400 });
  }

  const { data, error } = await db.rpc('redeem_promo_code', { p_shop_id: shop.uid, p_code: code });
  if (error) {
    if (error.message.includes('PROMO_ALREADY_USED')) return NextResponse.json({ error: 'Your shop has already used a promo code.' }, { status: 400 });
    if (error.message.includes('PROMO_INVALID')) return NextResponse.json({ error: "That code isn't valid." }, { status: 400 });
    console.error('[billing/promo]', error);
    return NextResponse.json({ error: 'Could not apply the code. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ freeTickets: data });
}
