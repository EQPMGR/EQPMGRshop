import 'server-only';

// Emails EQPMGR's own inbox (never a shop or a rider). Used to say a new shop
// is waiting for approval. Settings (Netlify env):
//   SHOP_ALERT_EMAIL   where the alert goes (an EQPMGR inbox); unset = no email
//   EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS   the same SMTP login as the rider app
import * as nodemailer from 'nodemailer';

/** Escape anything a shop typed before it goes into the email's HTML. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function row(label: string, value: unknown): string {
  const shown = value === undefined || value === null || value === '' ? 'N/A' : value;
  return `<p><strong>${esc(label)}:</strong> ${esc(shown)}</p>`;
}

export function adminAlertConfigured(): boolean {
  return !!(process.env.SHOP_ALERT_EMAIL && process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

/** Sends one alert email. Throws if it can't be sent. */
export async function sendAdminAlert({ subject, html, replyTo }: { subject: string; html: string; replyTo?: string }) {
  const to = process.env.SHOP_ALERT_EMAIL;
  const user = process.env.EMAIL_USER;
  if (!to || !process.env.EMAIL_HOST || !user || !process.env.EMAIL_PASS) {
    throw new Error('Admin alert email is not configured.');
  }
  const port = Number(process.env.EMAIL_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: { user, pass: process.env.EMAIL_PASS },
    connectionTimeout: 15_000,
  });
  await transporter.sendMail({
    from: `"EQPMGR Shop" <${user}>`,
    to,
    replyTo: replyTo && /^[^\s@<>]+@[^\s@<>]+$/.test(replyTo) ? replyTo : undefined,
    subject,
    html,
  });
}
