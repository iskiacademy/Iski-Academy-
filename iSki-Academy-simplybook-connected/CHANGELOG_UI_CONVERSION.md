# iSki Academy — Premium design and booking conversion pass (2026-10-26)

## Design changes
- Refined the visual system toward a premium international ski academy: midnight navy, warm stone/ivory surfaces and restrained champagne-gold accents.
- Improved homepage hero contrast, trust-bar accents, package cards, section spacing and CTA consistency while preserving the existing brand assets and copy.
- Reworked the Gallery introduction, added accessible category filters (All, Coaching, Mountain, Atmosphere), stronger captions and a clear booking CTA.
- Replaced the dense horizontal price list with responsive service cards that surface audience, lesson duration, guide price and a direct booking action.
- Added clearer pricing notes about separate lift passes/equipment and the fact that a request is not a confirmed booking.
- Added mobile-specific layouts for the gallery, pricing cards and booking enquiry form.

## Booking-flow changes
- When live online booking is closed or the calendar endpoint is unavailable, the visitor can still select lesson type, preferred date/time, participant count, skill level, preferred instructor and contact details.
- The closed-calendar form opens WhatsApp with a prefilled, structured enquiry. It explicitly tells the visitor to tap Send in WhatsApp and clarifies that the lesson is not booked until iSki confirms availability.
- The live-booking confirmation message now names the selected instructor where available and directs the customer to WhatsApp for follow-up.
- Package and pricing CTAs continue to carry the appropriate lesson category into `/book`.

## Validation completed in this environment
- TypeScript/TSX syntax transpilation check passed for `src/App.tsx` and `src/BookingForm.tsx`.
- Local `/assets/...` references used by the changed UI checked: all 15 referenced paths exist.
- Full automated tests and production build could not run because project dependencies (including `luxon`, Vite and React) are not installed and the package registry was unreachable from this environment.
- No live end-to-end booking was created, no live database was mutated, and no production publish was performed.

## Required before production publish
1. In the project environment, run `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build`.
2. Test desktop and mobile routes `/`, `/prices`, `/gallery`, and `/book` in a real browser.
3. Test the closed-calendar WhatsApp draft end-to-end with a staff-owned test contact; verify that the prefilled message contains the chosen service, date, time preference, participant count and contact details.
4. Only after the owner has configured season dates, instructor roster, shifts, capacity, database secrets and mail provider, test a live booking with agreed test data. Do not enable public availability until the admin settings are ready.
5. Publish through the owner's Manus/Webdev dashboard after all checks pass, then verify the live domain and published version.

## Simplified website and content editor — October 2026

- Removed the public in-site booking calendar/form from the visitor journey. `/book` is now a short handoff page to `VITE_EXTERNAL_BOOKING_URL`, with WhatsApp as a fallback until the owner configures the third-party link.
- Added a database-backed content manager at `/admin/content` for owner/admin accounts. It supports creating, editing, publishing/unpublishing and deleting short posts and gallery photo entries.
- Added `site_content` schema migration and authenticated/CSRF-protected admin CRUD endpoints; public visitors only receive published content.
- Published photo entries with image URLs appear in the public Gallery; published posts appear on `/stories`.
- Direct binary image upload is not connected yet. The editor accepts a direct HTTPS image URL or a path to an existing `/assets/` file. Configure an image storage provider to enable file uploads from the phone.
- Improved mobile navigation consistency: fixed-position menu panel, page-change and Escape closing, tap-outside scrim, explicit expanded state, readable menu colors on the light About header, and body scroll lock while the menu is open.
- Build and full browser regression tests remain pending because dependencies are not installed in this environment. The database migration must run in the deployed Node environment before content management can be used.

## SimplyBook.me handoff update (2026-10-26)

- Added `VITE_SIMPLYBOOK_URL` as the preferred public booking-page environment variable; retained `VITE_EXTERNAL_BOOKING_URL` as a backwards-compatible fallback.
- Updated public booking and pricing CTA copy to identify SimplyBook.me as the booking provider.
- The site continues to avoid pretending a booking was made when the SimplyBook.me URL has not been configured; it falls back to WhatsApp contact.
- Integration method intentionally uses a simple external booking link for the first preview. An embedded SimplyBook.me widget can be added later if the owner provides its official generated widget snippet and prefers an inline booking experience.
