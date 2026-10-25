import 'server-only';

// Shop billing with Stripe (pricing decided 2026-10-25, see the rider repo's ROADMAP.md):
// C$2 per Service Ticket (one per work order, charged when it's created), billed
// once a month for the previous calendar month. FIRST10-style promo credits make
// tickets free. Failed payment: 5-day grace, then new work orders pause.
//
// Our database is the source of truth: the work_orders trigger writes one
// billing_tickets row per work order (migration 020), and runBilling() turns
// unbilled tickets into one Stripe invoice per shop. Stripe never counts usage.
import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/supabase';

export const SERVICE_TICKET_LOOKUP_KEY = 'service_ticket_cad';
export const RENTAL_TICKET_LOOKUP_KEY = 'rental_ticket_cad';
export const GRACE_DAYS = 5;

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Billing is not configured yet.');
  client ??= new Stripe(key, { maxNetworkRetries: 2 });
  return client;
}

/** Shared secret for the scheduled billing run, derived so no extra env var is needed. */
export function billingRunSecret(): string {
  return createHmac('sha256', process.env.STRIPE_SECRET_KEY || '').update('eqpmgr-billing-run').digest('hex');
}
export function isBillingRunAuthorized(header: string | null): boolean {
  if (!process.env.STRIPE_SECRET_KEY || !header) return false;
  const a = Buffer.from(header), b = Buffer.from(billingRunSecret());
  return a.length === b.length && timingSafeEqual(a, b);
}

export type ShopBilling = {
  shop_id: string;
  status: 'setup_needed' | 'active' | 'past_due' | 'paused';
  stripe_customer_id: string | null;
  free_tickets_remaining: number;
  promo_code: string | null;
  grace_until: string | null;
  open_invoice_url: string | null;
};

export async function getShopBilling(shopId: string): Promise<ShopBilling> {
  await db.from('shop_billing').upsert({ shop_id: shopId }, { onConflict: 'shop_id', ignoreDuplicates: true });
  const { data, error } = await db.from('shop_billing').select('*').eq('shop_id', shopId).single();
  if (error) throw error;
  return data as ShopBilling;
}

async function updateShopBilling(shopId: string, values: Partial<ShopBilling>) {
  const { error } = await db.from('shop_billing').update({ ...values, updated_at: new Date().toISOString() }).eq('shop_id', shopId);
  if (error) throw error;
}

const PROVINCES: Record<string, string> = {
  'british columbia': 'BC', alberta: 'AB', saskatchewan: 'SK', manitoba: 'MB', ontario: 'ON', quebec: 'QC', québec: 'QC',
  'new brunswick': 'NB', 'nova scotia': 'NS', 'prince edward island': 'PE', 'newfoundland and labrador': 'NL',
  yukon: 'YT', 'northwest territories': 'NT', nunavut: 'NU',
};
function countryCode(country: string | null): string | undefined {
  const c = (country || '').trim().toLowerCase();
  if (['ca', 'can', 'canada'].includes(c)) return 'CA';
  if (['us', 'usa', 'united states', 'united states of america'].includes(c)) return 'US';
  return c.length === 2 ? c.toUpperCase() : undefined;
}

/**
 * The shop's Stripe customer, created on first use. The address comes from the
 * shop profile: Stripe Tax uses it to pick GST/HST/PST (or US state tax).
 */
export async function ensureCustomer(shopId: string, email?: string): Promise<string> {
  const billing = await getShopBilling(shopId);
  const { data: shop } = await db.from('service_providers')
    .select('shop_name, street_address, address, city, state, postal_code, country').eq('id', shopId).single();

  const country = countryCode(shop?.country ?? null) ?? 'CA';
  const state = shop?.state ? (PROVINCES[shop.state.trim().toLowerCase()] ?? shop.state.trim()) : undefined;
  const address: Stripe.AddressParam = {
    line1: shop?.street_address || shop?.address || undefined,
    city: shop?.city || undefined,
    state,
    postal_code: shop?.postal_code || undefined,
    country,
  };

  if (billing.stripe_customer_id) {
    await stripe().customers.update(billing.stripe_customer_id, { name: shop?.shop_name || undefined, address });
    return billing.stripe_customer_id;
  }

  const customer = await stripe().customers.create({
    name: shop?.shop_name || undefined,
    email,
    address,
    metadata: { shop_id: shopId },
  }, { idempotencyKey: `customer-${shopId}` });
  await updateShopBilling(shopId, { stripe_customer_id: customer.id });
  return customer.id;
}

async function shopIdForCustomer(customerId: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
  const id = typeof customerId === 'string' ? customerId : customerId?.id;
  if (!id) return null;
  const { data } = await db.from('shop_billing').select('shop_id').eq('stripe_customer_id', id).maybeSingle();
  return data?.shop_id ?? null;
}

let portalConfigId: string | null = null;
/** The Customer Portal settings this app uses (created by scripts/stripe-setup.mts). */
export async function portalConfiguration(): Promise<string | undefined> {
  if (portalConfigId) return portalConfigId;
  const configs = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  portalConfigId = configs.data.find((c) => c.metadata?.app === 'eqpmgr-shop')?.id ?? null;
  return portalConfigId ?? undefined;
}

/** Stripe webhook events that change a shop's billing status. */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'setup' || !session.setup_intent) return;
      const shopId = session.metadata?.shop_id || await shopIdForCustomer(session.customer);
      if (!shopId) return;
      const setupIntent = await stripe().setupIntents.retrieve(
        typeof session.setup_intent === 'string' ? session.setup_intent : session.setup_intent.id
      );
      const paymentMethod = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      if (!paymentMethod || !customerId) return;
      await stripe().customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethod } });

      const billing = await getShopBilling(shopId);
      if (billing.status === 'setup_needed') await updateShopBilling(shopId, { status: 'active' });
      // A new card after a failed payment: try the unpaid invoices again.
      if (billing.status === 'past_due' || billing.status === 'paused') await retryOpenInvoices(customerId);
      return;
    }
    case 'invoice.paid': {
      const shopId = await shopIdForCustomer(event.data.object.customer);
      if (!shopId) return;
      const open = await stripe().invoices.list({ customer: event.data.object.customer as string, status: 'open', limit: 1 });
      if (open.data.length === 0) await updateShopBilling(shopId, { status: 'active', grace_until: null, open_invoice_url: null });
      return;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const shopId = await shopIdForCustomer(invoice.customer);
      if (!shopId) return;
      const billing = await getShopBilling(shopId);
      await updateShopBilling(shopId, {
        status: billing.status === 'paused' ? 'paused' : 'past_due',
        grace_until: billing.grace_until ?? new Date(Date.now() + GRACE_DAYS * 86400_000).toISOString(),
        open_invoice_url: invoice.hosted_invoice_url ?? null,
      });
      return;
    }
  }
}

async function retryOpenInvoices(customerId: string) {
  const open = await stripe().invoices.list({ customer: customerId, status: 'open', limit: 10 });
  for (const invoice of open.data) {
    try {
      await stripe().invoices.pay(invoice.id);
    } catch (error: any) {
      console.warn('[billing] retry failed', invoice.id, error?.message);
    }
  }
}

type Ticket = { id: string; shop_id: string; kind: 'service' | 'rental'; free: boolean };

/**
 * Daily job (netlify/functions/billing-daily.mts):
 *   1. pauses shops whose grace period ran out,
 *   2. invoices every shop's unbilled tickets from past months, one invoice each.
 * Safe to run any number of times: tickets are marked once billed, and Stripe
 * calls use idempotency keys per shop and period.
 */
export async function runBilling() {
  const summary = { paused: 0, invoiced: 0, freeOnly: 0, skippedNoCard: 0, errors: [] as string[] };

  const { data: expired } = await db.from('shop_billing').update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('status', 'past_due').lt('grace_until', new Date().toISOString()).select('shop_id');
  summary.paused = expired?.length ?? 0;

  const { data: cutoff, error: cutoffError } = await db.rpc('billing_cutoff');
  if (cutoffError) throw cutoffError;
  const { data: tickets, error } = await db.from('billing_tickets')
    .select('id, shop_id, kind, free')
    .is('stripe_invoice_id', null).is('voided_at', null).lt('created_at', cutoff as string)
    .limit(10000);
  if (error) throw error;

  const byShop = new Map<string, Ticket[]>();
  for (const t of (tickets ?? []) as Ticket[]) byShop.set(t.shop_id, [...(byShop.get(t.shop_id) ?? []), t]);
  if (byShop.size === 0) return summary;

  const prices = await stripe().prices.list({ lookup_keys: [SERVICE_TICKET_LOOKUP_KEY, RENTAL_TICKET_LOOKUP_KEY], active: true });
  const priceFor = (kind: Ticket['kind']) => prices.data.find((p) => p.lookup_key === (kind === 'rental' ? RENTAL_TICKET_LOOKUP_KEY : SERVICE_TICKET_LOOKUP_KEY));
  const period = new Date(new Date(cutoff as string).getTime() - 86400_000)
    .toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'America/Vancouver' });
  const periodKey = (cutoff as string).slice(0, 10);

  for (const [shopId, shopTickets] of byShop) {
    try {
      const paid = shopTickets.filter((t) => !t.free);
      if (paid.length === 0) {
        // Everything was covered by promo credits: nothing to charge.
        await markBilled(shopTickets, 'free');
        summary.freeOnly += 1;
        continue;
      }

      const billing = await getShopBilling(shopId);
      if (!billing.stripe_customer_id) { summary.skippedNoCard += 1; continue; }
      const customer = await stripe().customers.retrieve(billing.stripe_customer_id);
      if (customer.deleted || !customer.invoice_settings?.default_payment_method) { summary.skippedNoCard += 1; continue; }

      const invoice = await stripe().invoices.create({
        customer: billing.stripe_customer_id,
        currency: 'cad',
        collection_method: 'charge_automatically',
        auto_advance: true,
        pending_invoice_items_behavior: 'exclude',
        automatic_tax: { enabled: process.env.STRIPE_TAX_ENABLED === '1' },
        description: `EQPMGR tickets for ${period}`,
        metadata: { shop_id: shopId, period: periodKey },
      }, { idempotencyKey: `invoice-${shopId}-${periodKey}` });

      for (const kind of ['service', 'rental'] as const) {
        const price = priceFor(kind);
        const ofKind = shopTickets.filter((t) => t.kind === kind);
        const paidCount = ofKind.filter((t) => !t.free).length;
        const freeCount = ofKind.length - paidCount;
        if (ofKind.length && !price) throw new Error(`No Stripe price with lookup key for ${kind} tickets; run scripts/stripe-setup.mts`);
        if (paidCount) {
          await stripe().invoiceItems.create({ customer: billing.stripe_customer_id, invoice: invoice.id, price: price!.id, quantity: paidCount },
            { idempotencyKey: `item-${invoice.id}-${kind}-paid` });
        }
        if (freeCount) {
          await stripe().invoiceItems.create({
            customer: billing.stripe_customer_id, invoice: invoice.id, quantity: freeCount,
            price_data: { currency: 'cad', product: price!.product as string, unit_amount: 0, tax_behavior: 'exclusive' },
            description: `${kind === 'rental' ? 'Rental' : 'Service'} Ticket (promo credit${billing.promo_code ? `: ${billing.promo_code}` : ''})`,
          }, { idempotencyKey: `item-${invoice.id}-${kind}-free` });
        }
      }

      await markBilled(shopTickets, invoice.id);
      const finalized = invoice.status === 'draft' ? await stripe().invoices.finalizeInvoice(invoice.id) : invoice;
      if (finalized.status === 'open') {
        try {
          await stripe().invoices.pay(finalized.id);
        } catch (payError: any) {
          // invoice.payment_failed (webhook) starts the grace period.
          console.warn('[billing] payment failed', shopId, payError?.message);
        }
      }
      summary.invoiced += 1;
    } catch (shopError: any) {
      console.error('[billing] shop failed', shopId, shopError);
      summary.errors.push(`${shopId}: ${shopError?.message || shopError}`);
    }
  }
  return summary;
}

async function markBilled(tickets: Ticket[], invoiceId: string) {
  const { error } = await db.from('billing_tickets')
    .update({ stripe_invoice_id: invoiceId, billed_at: new Date().toISOString() })
    .in('id', tickets.map((t) => t.id)).is('stripe_invoice_id', null);
  if (error) throw error;
}
