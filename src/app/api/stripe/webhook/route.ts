import { NextResponse } from 'next/server';
import { handleStripeEvent, stripe } from '@/lib/billing';

// POST /api/stripe/webhook: Stripe tells us about cards added and invoices paid
// or failed. Every event's signature is checked with STRIPE_WEBHOOK_SECRET
// (from the webhook endpoint in the Stripe dashboard).
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) return NextResponse.json({ error: 'Not configured.' }, { status: 400 });

  let event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error('[stripe/webhook]', event.type, error);
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 }); // Stripe retries
  }
  return NextResponse.json({ received: true });
}
