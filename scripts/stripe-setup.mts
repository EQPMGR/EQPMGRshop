// One-time Stripe setup for shop billing. Safe to re-run (it skips what exists).
//   npx tsx scripts/stripe-setup.mts           (test key only)
//   npx tsx scripts/stripe-setup.mts --live    (when going live with a live key)
// Creates:
//   - "Service Ticket" product + C$2.00 price (lookup key service_ticket_cad)
//   - "Rental Ticket" product + C$2.00 price (lookup key rental_ticket_cad), for later
//   - the Customer Portal settings (update card, invoice history, billing address/tax ID)
// Uses STRIPE_SECRET_KEY from .env.local and never prints it.
import { readFileSync } from 'fs';
import Stripe from 'stripe';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error('STRIPE_SECRET_KEY is not in .env.local');
const live = /^(sk|rk)_live_/.test(key);
if (live && !process.argv.includes('--live')) throw new Error('That is a LIVE key. Re-run with --live if you mean it.');
console.log(`Stripe mode: ${live ? 'LIVE' : 'test'}`);

const stripe = new Stripe(key);
// SaaS, business use: Stripe Tax picks GST/HST/PST (or US state tax) from it.
const TAX_CODE = 'txcd_10103001';

async function ensureTicket(productId: string, name: string, description: string, lookupKey: string) {
  let product: Stripe.Product;
  try {
    product = await stripe.products.retrieve(productId);
    console.log(`✓ product ${name} exists`);
  } catch {
    product = await stripe.products.create({ id: productId, name, description, tax_code: TAX_CODE });
    console.log(`+ product ${name}`);
  }
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true });
  if (existing.data.length) {
    console.log(`✓ price ${lookupKey} exists (${existing.data[0].unit_amount! / 100} ${existing.data[0].currency.toUpperCase()})`);
    return;
  }
  await stripe.prices.create({
    product: product.id, currency: 'cad', unit_amount: 200, tax_behavior: 'exclusive',
    lookup_key: lookupKey, nickname: `${name} C$2`,
  });
  console.log(`+ price ${lookupKey} C$2.00`);
}

await ensureTicket('eqpmgr_service_ticket', 'Service Ticket',
  'One work order sent to your shop through EQPMGR (repair or bike fit).', 'service_ticket_cad');
await ensureTicket('eqpmgr_rental_ticket', 'Rental Ticket',
  'One rental ticket issued through EQPMGR.', 'rental_ticket_cad');

const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
if (configs.data.some((c) => c.metadata?.app === 'eqpmgr-shop')) {
  console.log('✓ customer portal settings exist');
} else {
  await stripe.billingPortal.configurations.create({
    metadata: { app: 'eqpmgr-shop' },
    business_profile: { headline: 'EQPMGR Shop billing' },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['name', 'email', 'address', 'tax_id'] },
    },
  });
  console.log('+ customer portal settings');
}
console.log('Done.');
