# TODO: pending changes and security gaps

Kept on `dev` only. Not synced to `main`.

## Rollout of Instant permissions (code is merged, Instant is not updated)

Run in this order. Pushing perms before the backfill locks admins out of the admin UI.

1. [ ] `npx instant-cli push schema` (adds the `users` ↔ `$users` link)
2. [ ] Deploy the app so `POST /api/auth/link-user` is live
3. [ ] `npm run link:auth-users -- --dry-run`, then `npm run link:auth-users`
4. [ ] Test the rules in the Instant dashboard sandbox:
   - confirm `true in auth.ref('$user.appUser.isAdmin')` evaluates as expected
   - check the kiosk flow, an admin login and a non-admin login
5. [ ] `npx instant-cli push perms`

## Open security gaps

| # | Gap | Fix |
|---|-----|-----|
| 1 | Anonymous kiosk reads `users` (emails, barcodes) and `punches`, and creates `punches`, directly through the Instant client | Add a server-side kiosk check-in/lookup route, then lock `users`/`punches` view and create to admin |
| 2 | `visitorPrecheckRequests` is publicly readable, so its PII can be enumerated | Move the pre-check page reads and writes to server routes, then restrict the rules |
| 3 | A user can edit their own `barcode` | Add `newData.barcode == data.barcode` to the `users` update rule, or move barcode changes server-side |
| 4 | Rate limiters (`createRateLimiter`) are per process, so they are weaker on serverless | Use a shared store (Redis / Upstash / Instant) |
| 5 | No restriction on creating new Instant attrs | Add an `attrs` create rule |
| 6 | No CSP header (only nosniff, X-Frame-Options, Referrer-Policy) | Add a CSP in report-only mode first, then enforce |
| 7 | Rate limits missing on the kiosk-register, `complete` and vendor routes | Add limiters like the ones on `precheck/invite` |
| 8 | `users/import/template` GET is unauthenticated | Low risk (static CSV); guard it if it ever includes data |

## Housekeeping

- [ ] `npm run lint` fails locally with a module-resolution error (CI is fine)
- [ ] `scripts/seed-punches.ts` fails typecheck locally: `@faker-js/faker` not found in node_modules
- [ ] Review the npm install-scripts warning for esbuild, fsevents and unrs-resolver (`npm install-scripts ls`)
- [ ] The security changes have only been checked with tsc, tests and CI, not in a browser. Click through the admin pages, the kiosk and the pre-check flow after deploy.
