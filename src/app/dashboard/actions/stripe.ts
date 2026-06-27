
'use server';

import Stripe from 'stripe';
import { db } from '@/lib/firebase';

export async function createPortalSession(userId: string): Promise<{ url: string | null }> {
    const origin = 'https://shop.eqpmgr.com';
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID;

    if (!stripeSecretKey) {
        throw new Error('Stripe secret key is not configured.');
    }
    if (!priceId) {
        throw new Error('Stripe price ID is not configured.');
    }

    const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-06-20',
    });

    if (!userId) {
        throw new Error('User must be authenticated to manage billing.');
    }

    const { data: serviceProvider, error: spError } = await db
        .from('service_providers')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

    if (spError) {
        console.error('Supabase service_providers query failed:', spError);
        throw new Error('Failed to load service provider record.');
    }

    let customerId = serviceProvider?.stripe_customer_id;

    if (!customerId) {
        const { data: userData, error: userError } = await db
            .from('app_users')
            .select('email, shop_name')
            .eq('id', userId)
            .single();

        if (userError) {
            console.error('Supabase app_users query failed:', userError);
            throw new Error('Failed to load user record.');
        }

        const customer = await stripe.customers.create({
            email: userData?.email,
            name: userData?.shop_name,
            metadata: {
                userId,
            },
        });
        customerId = customer.id;

        const { error: updateError } = await db
            .from('service_providers')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId);

        if (updateError) {
            console.error('Failed to update service provider stripe_customer_id:', updateError);
        }

        await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
        });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/dashboard/settings`,
    });

    return { url: portalSession.url };
}
