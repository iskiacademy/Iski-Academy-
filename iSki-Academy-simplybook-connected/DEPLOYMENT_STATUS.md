# Deployment status — iSki Academy simplified refresh

## Implemented in source

- Premium responsive layout and gallery/pricing polish from the previous refresh.
- Public `/book` no longer embeds the in-site booking calendar or booking form. It hands off to `VITE_SIMPLYBOOK_URL` (or legacy fallback `VITE_EXTERNAL_BOOKING_URL`) when configured, otherwise it opens WhatsApp to request the partner link.
- Mobile menu has consistent open/close behavior, closes on route changes/Escape/tap outside, and has a readable light-header variant.
- New owner/admin content area at `/admin/content`: create/edit/publish/delete short posts and gallery photo entries.
- Public `/stories` lists published posts. Published photo entries are appended to `/gallery`.
- Added `db/migrations/002_site_content.sql` and secured admin API routes using the existing session and CSRF protections.

## Required before production use

1. Set `VITE_SIMPLYBOOK_URL` (or legacy fallback `VITE_EXTERNAL_BOOKING_URL`) to the exact public SimplyBook.me booking-page URL before building. If it is blank, the site deliberately falls back to WhatsApp.
2. Deploy on a Node-compatible host with the existing MySQL `DATABASE_URL` and admin setup/recovery secrets. A static-only host is not sufficient for `/api/admin/content`.
3. Apply migrations by starting the app in the configured Node environment. Back up the database first; migration 002 creates a new table and does not rewrite existing booking data.
4. Sign in with an existing owner/admin account at `/admin`. The account must be configured through the existing secure setup flow; no credentials are embedded in this source.
5. Add a published test post and photo, verify they appear on `/stories` and `/gallery`, then delete the test items.
6. Test on iPhone Safari and Android Chrome: every public page, dropdown, menu close paths, sticky mobile action bar, and external booking handoff.
7. Run `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build` in the actual deploy environment.

## Limitations

- Direct photo-file upload from the admin is not connected. Use a direct HTTPS image URL or an existing `/assets/` path. Add an image-storage provider if phone-to-site uploads are required.
- This source has not been built or published from this environment. Local full build/type-check and browser QA could not be completed because dependencies are absent.
- Legacy booking/admin backend modules remain in the source but are no longer part of the public booking journey or the simplified admin navigation.
