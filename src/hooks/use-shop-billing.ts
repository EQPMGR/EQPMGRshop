'use client';

import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/supabase';

export type ShopBillingView = {
  status: 'setup_needed' | 'active' | 'past_due' | 'paused';
  hasCustomer: boolean;
  freeTicketsRemaining: number;
  promoCode: string | null;
  graceUntil: string | null;
  openInvoiceUrl: string | null;
  approved: boolean;
  termsVersion: string | null;
  ticketsThisMonth: number;
  freeThisMonth: number;
};

/** The signed-in shop's billing status (shop_billing / billing_tickets are read-only to shops). */
export function useShopBilling(shopId: string | undefined) {
  const [billing, setBilling] = useState<ShopBillingView | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [{ data: row }, { data: tickets }] = await Promise.all([
      db.from('shop_billing').select('*').eq('shop_id', shopId).maybeSingle(),
      db.from('billing_tickets').select('free').eq('shop_id', shopId).is('voided_at', null).gte('created_at', monthStart.toISOString()),
    ]);
    setBilling({
      status: row?.status ?? 'setup_needed',
      hasCustomer: !!row?.stripe_customer_id,
      freeTicketsRemaining: row?.free_tickets_remaining ?? 0,
      promoCode: row?.promo_code ?? null,
      graceUntil: row?.grace_until ?? null,
      openInvoiceUrl: row?.open_invoice_url ?? null,
      approved: !!row?.approved_at,
      termsVersion: row?.terms_version ?? null,
      ticketsThisMonth: tickets?.length ?? 0,
      freeThisMonth: tickets?.filter((t) => t.free).length ?? 0,
    });
    setLoading(false);
  }, [shopId]);

  useEffect(() => { reload(); }, [reload]);
  return { billing, loading, reload };
}
