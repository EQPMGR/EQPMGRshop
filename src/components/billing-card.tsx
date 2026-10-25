'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useShopBilling } from '@/hooks/use-shop-billing';
import { getAccessToken } from '@/lib/client-auth';

const STATUS_LABEL = {
  setup_needed: 'Payment method needed',
  active: 'Active',
  past_due: 'Payment failed',
  paused: 'Paused: new work orders blocked',
} as const;

async function post(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export function BillingCard({ shopId }: { shopId: string }) {
  const { toast } = useToast();
  const { billing, loading, reload } = useShopBilling(shopId);
  const [busy, setBusy] = useState<'setup' | 'portal' | 'promo' | null>(null);
  const [code, setCode] = useState('');

  // Back from Stripe after adding a card: the webhook may take a moment.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('billing') !== 'card-added') return;
    toast({ title: 'Card added', description: 'Thanks! Your billing is set up.' });
    const timer = setTimeout(reload, 3000);
    return () => clearTimeout(timer);
  }, [reload, toast]);

  async function go(kind: 'setup' | 'portal') {
    setBusy(kind);
    try {
      const { url } = await post(`/api/billing/${kind}`);
      window.location.href = url;
    } catch (error: any) {
      toast({ title: 'Billing', description: error.message, variant: 'destructive' });
      setBusy(null);
    }
  }

  async function redeem() {
    setBusy('promo');
    try {
      const { freeTickets } = await post('/api/billing/promo', { code });
      toast({ title: 'Code applied', description: `You now have ${freeTickets} free Service Tickets.` });
      setCode('');
      await reload();
    } catch (error: any) {
      toast({ title: 'Promo code', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-primary">Billing</CardTitle>
        <CardDescription>
          Each work order a rider sends you is a <b>C$2 Service Ticket</b> (repairs and bike fits alike), plus applicable tax.
          No monthly fee, minimum or setup fee. On the 1st of each month, your card is charged once for the previous month&apos;s tickets.
          If a payment fails, you have 5 days to fix it before new work orders pause.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !billing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className={`font-semibold ${billing.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>{STATUS_LABEL[billing.status]}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Service Tickets this month</p>
                <p className="font-semibold">
                  {billing.ticketsThisMonth}
                  {billing.freeThisMonth > 0 && <span className="text-sm font-normal text-muted-foreground"> ({billing.freeThisMonth} free)</span>}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Free tickets left</p>
                <p className="font-semibold">{billing.freeTicketsRemaining}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {billing.status === 'setup_needed' || !billing.hasCustomer ? (
                <Button onClick={() => go('setup')} disabled={!!busy}>
                  {busy === 'setup' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add payment method
                </Button>
              ) : (
                <>
                  <Button onClick={() => go('portal')} disabled={!!busy}>
                    {busy === 'portal' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Manage billing &amp; invoices
                  </Button>
                  {(billing.status === 'past_due' || billing.status === 'paused') && (
                    <Button variant="outline" onClick={() => go('setup')} disabled={!!busy}>Use a different card</Button>
                  )}
                  {billing.openInvoiceUrl && (
                    <Button variant="outline" asChild><a href={billing.openInvoiceUrl} target="_blank" rel="noreferrer">Pay unpaid invoice</a></Button>
                  )}
                </>
              )}
            </div>

            {!billing.promoCode ? (
              <div className="flex max-w-sm gap-2">
                <Input placeholder="Promo code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} />
                <Button variant="outline" onClick={redeem} disabled={!code.trim() || !!busy}>
                  {busy === 'promo' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Promo code <b>{billing.promoCode}</b> applied.</p>
            )}

            <p className="text-xs text-muted-foreground">Card details are handled by Stripe; EQPMGR never sees or stores them.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
