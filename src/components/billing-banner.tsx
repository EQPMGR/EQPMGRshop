'use client';

import Link from 'next/link';
import { AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { ShopBillingView } from '@/hooks/use-shop-billing';

/** Dashboard notice when billing needs the shop's attention. */
export function BillingBanner({ billing }: { billing: ShopBillingView | null }) {
  if (!billing) return null;
  const pendingApproval = !billing.approved ? (
    <Alert>
      <Clock className="h-4 w-4" />
      <AlertTitle>Waiting for approval</AlertTitle>
      <AlertDescription>
        EQPMGR reviews every new shop before riders can find it. We&apos;ll approve your shop shortly
        {billing.status === 'setup_needed' ? '; meanwhile, add a payment method in Settings so you’re ready to go.' : '.'}
      </AlertDescription>
    </Alert>
  ) : null;
  if (billing.status === 'active') return pendingApproval;
  if (pendingApproval && billing.status === 'setup_needed') return pendingApproval;

  if (billing.status === 'setup_needed') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Add a payment method</AlertTitle>
        <AlertDescription>
          Riders can't find your shop until a card is on file. Each work order you receive is a C$2 Service Ticket, billed monthly. Add a card in{' '}
          <Link href="/dashboard/settings" className="font-semibold underline hover:text-white">Settings</Link>
          {billing.freeTicketsRemaining > 0 ? ` (you have ${billing.freeTicketsRemaining} free tickets).` : '.'}
        </AlertDescription>
      </Alert>
    );
  }

  const deadline = billing.graceUntil ? new Date(billing.graceUntil).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) : null;
  const payLink = billing.openInvoiceUrl
    ? <a href={billing.openInvoiceUrl} target="_blank" rel="noreferrer" className="font-semibold underline hover:text-white">Pay the invoice</a>
    : <Link href="/dashboard/settings" className="font-semibold underline hover:text-white">update your card</Link>;

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{billing.status === 'paused' ? 'Your shop is paused: new work orders are blocked' : 'Your last payment failed'}</AlertTitle>
      <AlertDescription>
        {billing.status === 'paused'
          ? <>Riders can&apos;t send you new work orders until the unpaid invoice is settled. {payLink} or update your card in <Link href="/dashboard/settings" className="font-semibold underline hover:text-white">Settings</Link>.</>
          : <>{payLink} or update your card in <Link href="/dashboard/settings" className="font-semibold underline hover:text-white">Settings</Link>{deadline ? ` by ${deadline}` : ''}, or new work orders will pause.</>}
      </AlertDescription>
    </Alert>
  );
}
