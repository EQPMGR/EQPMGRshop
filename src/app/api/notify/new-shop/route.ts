// POST /api/notify/new-shop: called once the signed-in shop finishes onboarding.
// Emails EQPMGR's inbox so an admin knows to approve the shop. One email per
// shop, ever (shop_billing.signup_alert_sent_at, migration 025): the shop can't
// use this to send repeated mail.
import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { verifyShopToken } from '@/lib/server-auth';
import { adminAlertConfigured, esc, row, sendAdminAlert } from '@/lib/admin-alert';

export const runtime = 'nodejs';

const ADMIN_URL = 'https://eqpmgr.netlify.app/admin';

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  let shop;
  try {
    shop = await verifyShopToken(header.startsWith('Bearer ') ? header.slice(7) : null);
  } catch (error: any) {
    console.error('[notify/new-shop] auth', error?.message);
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  if (!adminAlertConfigured()) return NextResponse.json({ sent: false, reason: 'not_configured' });

  // Claim the one alert for this shop before sending, so two requests can't both send.
  await db.from('shop_billing').upsert({ shop_id: shop.uid }, { onConflict: 'shop_id', ignoreDuplicates: true });
  const { data: claimed, error: claimError } = await db
    .from('shop_billing')
    .update({ signup_alert_sent_at: new Date().toISOString() })
    .eq('shop_id', shop.uid)
    .is('signup_alert_sent_at', null)
    .select('status, approved_at');
  if (claimError) {
    console.error('[notify/new-shop] claim', claimError.message);
    return NextResponse.json({ sent: false }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) return NextResponse.json({ sent: false, reason: 'already_sent' });

  const { data: p } = await db
    .from('service_providers')
    .select('shop_name, street_address, city, state, country, postal_code, phone, website, services')
    .eq('id', shop.uid)
    .maybeSingle();

  const name = p?.shop_name || shop.shopName || 'New shop';
  const place = [p?.city, p?.state, p?.country].filter(Boolean).join(', ');
  const services = Array.isArray(p?.services) ? p.services.join(', ') : '';
  const html = `
    <h2>New shop waiting for approval</h2>
    ${row('Shop', name)}
    ${row('Address', [p?.street_address, place, p?.postal_code].filter(Boolean).join(', '))}
    ${row('Phone', p?.phone)}
    ${row('Website', p?.website)}
    ${row('Services', services)}
    ${row('Login email', shop.email)}
    ${row('Card on file', claimed[0].status === 'setup_needed' ? 'Not yet' : 'Yes')}
    <p>Riders can find the shop once it's approved and has a card on file.</p>
    <p><a href="${esc(ADMIN_URL)}">Review it in Admin → Shop approvals</a></p>`;

  try {
    await sendAdminAlert({ subject: `New shop waiting for approval: ${name}${place ? ` (${place})` : ''}`, html, replyTo: shop.email });
    return NextResponse.json({ sent: true });
  } catch (error: any) {
    // Give the claim back so the next attempt can try again.
    await db.from('shop_billing').update({ signup_alert_sent_at: null }).eq('shop_id', shop.uid);
    console.error('[notify/new-shop] send failed', error?.code, error?.responseCode);
    return NextResponse.json({ sent: false }, { status: 502 });
  }
}
