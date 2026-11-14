'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Clock, X } from 'lucide-react';
import type { ShopBillingView } from '@/hooks/use-shop-billing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// First-run checklist on the shop dashboard. Steps tick themselves from real
// data (billing status, approval, work orders). It disappears once everything
// is done, or when the shop hides it (remembered on this device).

const HIDDEN_KEY = 'eqpmgrshop.gettingStarted.hidden';

type Step = { key: string; done: boolean; title: string; hint: string; href?: string; action?: string; waiting?: boolean };

/** Whether the shop hid the checklist on this device. Starts true so it never flashes in. */
export function useChecklistHidden() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(HIDDEN_KEY) === '1');
    } catch {
      setHidden(false);
    }
  }, []);
  const hide = () => {
    try {
      window.localStorage.setItem(HIDDEN_KEY, '1');
    } catch {
      // ignore: it shows again next time
    }
    setHidden(true);
  };
  return { hidden, hide };
}

export function shopSteps(billing: ShopBillingView, hasWorkOrder: boolean): Step[] {
  const cardOnFile = billing.status !== 'setup_needed';
  return [
    {
      key: 'profile',
      done: true,
      title: 'Set up your shop profile',
      hint: '',
    },
    {
      key: 'billing',
      done: cardOnFile,
      title: 'Accept the billing terms and add a card',
      hint: billing.promoCode
        ? `In Settings. $2 per Service Ticket, billed monthly. You have ${billing.freeTicketsRemaining} free tickets.`
        : 'In Settings. $2 per Service Ticket, billed monthly, no other fees. Use code FIRST10 for 10 free tickets.',
      href: '/dashboard/settings',
      action: 'Open Settings',
    },
    {
      key: 'approval',
      done: billing.approved,
      title: 'Get approved by EQPMGR',
      hint: 'We review every new shop and bike fitter before riders can find them. This ticks itself once you\'re approved.',
      waiting: true,
    },
    {
      key: 'first-order',
      done: hasWorkOrder,
      title: 'Receive your first work order',
      hint: cardOnFile && billing.approved
        ? 'You\'re live. Riders can now pick you from their bike\'s page. Tell your customers you\'re on EQPMGR.'
        : 'Once you\'re approved with a card on file, riders can send you work right from their bike\'s page.',
      waiting: true,
    },
  ];
}

export function GettingStartedCard({ steps, onHide }: { steps: Step[]; onHide: () => void }) {
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="font-headline text-primary">Get ready for riders</CardTitle>
          <CardDescription>{doneCount} of {steps.length} done.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onHide} aria-label="Hide the getting started list" title="Hide this list">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={(doneCount / steps.length) * 100} className="h-2" aria-label={`${doneCount} of ${steps.length} steps done`} />
        <ol className="space-y-3">
          {steps.map((step) => {
            const isNext = step.key === next?.key;
            const Icon = step.done ? CheckCircle2 : step.waiting && isNext ? Clock : Circle;
            return (
              <li key={step.key} className="flex gap-3">
                <Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${step.done ? 'text-green-500' : isNext ? 'text-primary' : 'text-muted-foreground'}`}
                  aria-label={step.done ? 'Done' : 'Not done yet'}
                />
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className={step.done ? 'font-medium text-muted-foreground line-through' : 'font-medium'}>{step.title}</p>
                    {!step.done && step.hint && <p className="text-sm text-muted-foreground">{step.hint}</p>}
                  </div>
                  {!step.done && step.href && step.action && (
                    <Button asChild size="sm" variant={isNext ? 'default' : 'outline'} className="shrink-0 self-start">
                      <Link href={step.href}>
                        {step.action}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
