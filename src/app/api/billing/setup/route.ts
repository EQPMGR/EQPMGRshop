import { NextResponse } from 'next/server';
import { getBearerToken, verifyShopToken } from '@/lib/server-auth';
import { BILLING_TERMS_VERSION, ensureCustomer, getShopBilling, recordTermsAccepted, stripe } from '@/lib/billing';

// POST /api/billing/setup: Stripe-hosted page where the shop adds a card.
// Card details go straight to Stripe; this app never sees them.
export async function POST(request: Request) {
  let shop;
  try {
    shop = await verifyShopToken(getBearerToken(request));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized.' }, { status: 401 });
  }
  const { acceptTerms } = await request.json().catch(() => ({}));
  try {
    const billing = await getShopBilling(shop.uid);
    if (billing.terms_version !== BILLING_TERMS_VERSION) {
      if (acceptTerms !== true) {
        return NextResponse.json({ error: 'Please accept the billing terms first.' }, { status: 400 });
      }
      await recordTermsAccepted(shop.uid);
    }
    const customer = await ensureCustomer(shop.uid, shop.email);
    const origin = new URL(request.url).origin;
    const session = await stripe().checkout.sessions.create({
      mode: 'setup',
      currency: 'cad',
      customer,
      payment_method_types: ['card'],
      metadata: { shop_id: shop.uid },
      success_url: `${origin}/dashboard/settings?billing=card-added`,
      cancel_url: `${origin}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('[billing/setup]', error);
    return NextResponse.json({ error: 'Could not start card setup. Please try again.' }, { status: 500 });
  }
}
