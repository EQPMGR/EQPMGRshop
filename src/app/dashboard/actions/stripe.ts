'use server';

import { headers } from 'next/headers';
import Stripe from 'stripe';
import { adminDb as getAdminDb } from '@/lib/firebase-admin';
import { getStripeSecretKey, getStripePriceId } from '@/lib/secrets';

export async function createPortalSession(userId: string): Promise<{ url: string | null }> {
    const headersList = headers();
    const origin = headersList.get('origin') || 'http://localhost:3000';
    const adminDb = await getAdminDb();

    if (!userId) {
        throw new Error("User must be authenticated to manage billing.");
    }

    const stripeSecretKey = await getStripeSecretKey();
    const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-06-20',
    });

    const serviceProviderRef = adminDb.doc(`serviceProviders/${userId}`);
    
    try {
        const serviceProviderSnap = await serviceProviderRef.get();

        if (!serviceProviderSnap.exists) {
            throw new Error("Service provider data not found.");
        }

        let customerId = serviceProviderSnap.data()?.stripeCustomerId;

        if (!customerId) {
            // Customer doesn't exist, create a new one in Stripe
            const userSnap = await adminDb.doc(`users/${userId}`).get();
            const userData = userSnap.data();

            const customer = await stripe.customers.create({
                email: userData?.email,
                name: userData?.shopName,
                metadata: {
                    firebaseUID: userId,
                },
            });
            
            customerId = customer.id;

            // Save the new customer ID to the service provider document
            await serviceProviderRef.update({ stripeCustomerId: customerId });

            // Also, let's create a subscription for the metered billing plan
            const priceId = await getStripePriceId();
            if (!priceId) {
                throw new Error("Stripe Price ID is not configured.");
            }
            
            await stripe.subscriptions.create({
                customer: customerId,
                items: [{
                    price: priceId,
                }],
            });
        }
        
        // Create a billing portal session
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${origin}/dashboard/settings`,
        });

        return { url: portalSession.url };

    } catch (error: any) {
        console.error("Error creating Stripe portal session:", error);
        throw new Error(error.message || "An unexpected error occurred with Stripe.");
    }
}
