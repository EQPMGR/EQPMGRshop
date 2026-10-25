// Runs the shop billing job once a day (10:00 Vancouver, standard time).
// Netlify runs scheduled functions on the published production site only.
// The job itself lives in the app (POST /api/billing/run, src/lib/billing.ts).
import { createHmac } from 'crypto';

export default async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return new Response('Billing not configured', { status: 200 });
  const secret = createHmac('sha256', key).update('eqpmgr-billing-run').digest('hex');
  const response = await fetch(`${process.env.URL}/api/billing/run`, { method: 'POST', headers: { 'x-billing-secret': secret } });
  console.log('billing run', response.status, await response.text());
  return new Response('ok');
};

export const config = { schedule: '0 18 * * *' };
