# EQPMGR Shop

The service-provider side of EQPMGR. Shops receive work orders from riders, view the rider's bike and its components, log service, and replace parts. Every replacement feeds EQPMGR's component lifespan data.

- **Stack:** Next.js, TypeScript, Supabase (shared with the rider app), Stripe, hosted on Netlify
- **Live:** https://eqpmgrshop.netlify.app
- **Rider app and database migrations:** `EQPMGR/EQPMGR` (see its `ROADMAP.md` and `supabase/migrations/`)

## Local development

```bash
npm install
npm run dev
```

The app runs on http://127.0.0.1:3010. `.env.local` needs the same Supabase project values as the rider app, plus the Stripe keys.
