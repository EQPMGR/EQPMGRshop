
'use server';

import Stripe from 'stripe';
import { adminDb as getAdminDb } from '@/lib/firebase-admin';
import { getStripeSecretKey, getStripePriceId } from '@/lib/secrets';

export async function createPortalSession(userId: string): Promise<{ url: string | null }> {
    const origin = 'https://eqpmgrshop--eqpmgrshop-central.us-central1.hosted.app';
    let stripeSecretKey: string;
    let priceId: string;

    try {
        stripeSecretKey = await getStripeSecretKey();
        if (!stripeSecretKey) throw new Error("Stripe secret key is empty.");
    } catch (error) {
        console.error("Failed to retrieve Stripe secret key:", error);
        throw new Error("Could not retrieve Stripe configuration. Check server logs and secret permissions.");
    }

    const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-06-20',
    });
    
    const adminDb = await getAdminDb();

    if (!userId) {
        throw new Error("User must be authenticated to manage billing.");
    }

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

            try {
                priceId = await getStripePriceId();
                if (!priceId) throw new Error("Stripe Price ID is empty.");
            } catch (error) {
                 console.error("Failed to retrieve Stripe Price ID:", error);
                 throw new Error("Could not retrieve Stripe Price ID. Check server logs and secret permissions.");
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
        // Avoid leaking detailed Stripe-js errors to the client
        if (error.type?.startsWith('Stripe')) {
             throw new Error('An error occurred while communicating with Stripe. Please try again.');
        }
        throw new Error(error.message || "An unexpected error occurred with Stripe.");
    }
}
