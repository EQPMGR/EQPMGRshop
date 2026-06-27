import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

async function stripeRequest(path: string, stripeSecretKey: string, params: Record<string, string>) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Stripe request failed: ${path}`);
  }
  return data;
}

export async function POST(request: Request) {
  const { userId } = await request.json().catch(() => ({}));
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const origin = 'https://shop.eqpmgr.com';
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID;

  if (!stripeSecretKey) {
    console.error('Missing Stripe secret key in environment.');
    return NextResponse.json({ error: 'Stripe secret key is not configured.' }, { status: 500 });
  }

  if (!priceId) {
    console.error('Missing Stripe price ID in environment.');
    return NextResponse.json({ error: 'Stripe price ID is not configured.' }, { status: 500 });
  }

  const { data: serviceProvider, error: spError } = await db
    .from('service_providers')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (spError) {
    console.error('Supabase service_providers query failed:', spError);
    return NextResponse.json({ error: 'Failed to load service provider record.' }, { status: 500 });
  }

  if (!serviceProvider) {
    return NextResponse.json({ error: 'Service provider data not found.' }, { status: 404 });
  }

  let customerId = serviceProvider.stripe_customer_id;

  if (!customerId) {
    const { data: userData, error: userError } = await db
      .from('app_users')
      .select('email, shop_name')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Supabase app_users query failed:', userError);
      return NextResponse.json({ error: 'Failed to load user record.' }, { status: 500 });
    }

    const customer = await stripeRequest('customers', stripeSecretKey, {
      email: userData?.email ?? '',
      name: userData?.shop_name ?? '',
      'metadata[firebaseUID]': userId,
    });

    customerId = customer.id;

    const { error: updateError } = await db
      .from('service_providers')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update service provider stripe_customer_id:', updateError);
    }

    await stripeRequest('subscriptions', stripeSecretKey, {
      customer: customerId,
      'items[0][price]': priceId,
    });
  }

  const portalSession = await stripeRequest('billing_portal/sessions', stripeSecretKey, {
    customer: customerId,
    return_url: `${origin}/dashboard/settings`,
  });

  return NextResponse.json({ url: portalSession.url });
}
