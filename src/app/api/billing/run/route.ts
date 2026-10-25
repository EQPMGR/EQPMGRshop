import { NextResponse } from 'next/server';
import { isBillingRunAuthorized, runBilling } from '@/lib/billing';

// POST /api/billing/run: called daily by netlify/functions/billing-daily.mts.
// Requires the secret derived from STRIPE_SECRET_KEY; everyone else gets 401.
export async function POST(request: Request) {
  if (!isBillingRunAuthorized(request.headers.get('x-billing-secret'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const summary = await runBilling();
    console.log('[billing/run]', JSON.stringify(summary));
    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('[billing/run]', error);
    return NextResponse.json({ error: 'Billing run failed.' }, { status: 500 });
  }
}
