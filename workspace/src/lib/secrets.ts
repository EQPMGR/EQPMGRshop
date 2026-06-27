import 'server-only';

export async function getStripeSecretKey() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY is required. Set it in your environment.');
  }
  return stripeKey;
}

export async function getStripePriceId() {
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error('NEXT_PUBLIC_STRIPE_PRICE_ID is required. Set it in your environment.');
  }
  return priceId;
}
