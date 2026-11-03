// The billing terms a shop accepts before adding a card (shown on the Billing
// card; the acceptance and this version are recorded in shop_billing).
// Bump BILLING_TERMS_VERSION whenever the wording changes: shops accept again
// the next time they add or change a card. To be reviewed by a lawyer before
// public launch (ROADMAP).
export const BILLING_TERMS_VERSION = '2026-10-25';

export const BILLING_TERMS = [
  'Each work order a rider sends to your shop through EQPMGR is a Service Ticket that costs C$2.00, plus applicable taxes. This applies to repairs and bike fits alike, and whether or not you accept the job.',
  'There is no monthly fee, minimum or setup fee. Promo codes give free Service Tickets.',
  'On the 1st of each month, the card on file is charged once for the previous month’s Service Tickets. Invoices are available in the billing portal.',
  'If a payment fails, you have 5 days to pay the invoice or update your card. After that, your shop stops receiving new work orders until the balance is paid.',
  'Your shop must be approved by EQPMGR and have a working card on file to appear to riders. EQPMGR may change these terms with notice.',
];
