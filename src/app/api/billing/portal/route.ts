import { NextResponse } from 'next/server';
import { getBearerToken, verifyShopToken } from '@/lib/server-auth';
import { getShopBilling, portalConfiguration, stripe } from '@/lib/billing';

// POST /api/billing/portal: Stripe's billing portal (update card, see invoices).
export async function POST(request: Request) {
  let shop;
  try {
    shop = await verifyShopToken(getBearerToken(request));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unauthorized.' }, { status: 401 });
  }
  try {
    const billing = await getShopBilling(shop.uid);
    if (!billing.stripe_customer_id) {
      return NextResponse.json({ error: 'Add a payment method first.' }, { status: 400 });
    }
    const session = await stripe().billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      configuration: await portalConfiguration(),
      return_url: `${new URL(request.url).origin}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('[billing/portal]', error);
    return NextResponse.json({ error: 'Could not open billing. Please try again.' }, { status: 500 });
  }
}
