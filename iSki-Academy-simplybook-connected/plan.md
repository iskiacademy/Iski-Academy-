# iSki Academy — Website build plan

## Phạm vi MVP
Xây dựng bản website tiếng Anh cho iSki Academy tại Kopaonik, Serbia, tập trung vào booking enquiry và WhatsApp. Các route chính gồm Home, Families, Kids, Adults, Performance, About Igor, Prices, FAQ, Contact và Book Now.

## Design
- **Design Movement:** premium indoor-resort / Ski Dubai-inspired — hero tối, header floating dạng pill, card bo tròn, khoảng trắng thoáng, CTA capsule và snowfall nhẹ để tạo cảm giác trải nghiệm tuyết thân thiện với gia đình.
- **Core Principles:** clarity over complexity; proof before promise; one dominant CTA per viewport; mobile-first.
- **Color Philosophy:** navy tạo nền tảng tin cậy và chiều sâu núi; electric blue tạo cảm giác tốc độ và hành động; snow-white giữ giao diện thoáng; yellow chỉ là tín hiệu accent nhỏ.
- **Layout Paradigm:** hero lệch trục với text bên trái và visual lớn bên phải; các section dùng card bo tròn, media panel có shadow mềm, dải trust và CTA nổi giống một resort experience page.
- **Signature Elements:** header pill nổi, section-label dạng capsule, card radius lớn, snowfall particles và badge/metric bar nền navy.
- **Interaction Philosophy:** CTA xuất hiện đúng thời điểm, WhatsApp luôn dễ chạm, hover chuyển từ electric blue sang navy, form ngắn và phản hồi tức thì.
- **Animation:** reveal nhẹ khi scroll, hover lift tối đa 4px, underline slide-in, không dùng animation gây mất tập trung.
- **Typography System:** Manrope cho body/UI; Barlow Condensed Bold Italic cho display để giữ tinh thần thể thao nhưng thoáng hơn; tiêu đề in hoa, italic, tight leading; body tối thiểu 16px.
- **Brand Essence:** English-first ski coaching cho families, adults và performance skiers tại Kopaonik; khác biệt ở nền tảng athlete × sport master × ski instructor. Tính cách: precise, energetic, human.
- **Brand Voice:** rõ ràng, khích lệ, chuyên môn nhưng không khoa trương. Ví dụ: “Master the movement. Enjoy the mountain.” và “Your next confident turn starts here.”
- **Wordmark & Logo:** dùng logo SK Academy chính thức lấy từ Google Drive, xử lý thành biến thể nền trong suốt và biến thể trắng cho dark header/footer.
- **Signature Brand Color:** `#1284E7` electric blue.

## Implementation
- React + TypeScript + Vite, không phụ thuộc backend trong MVP.
- Route manifest tĩnh tại `/manus-routes.json`.
- Booking form hiển thị xác nhận tại chỗ và mở WhatsApp với tin nhắn điền sẵn; các tích hợp GA4/Meta/Search Console giữ ở dạng cấu hình chờ ID xác nhận.
- Ảnh banner Families/Kids/Adults/Performance và ảnh ski thật của Igor do người dùng cung cấp từ Google Drive được dùng theo đúng route; không tạo likeness Founder.
- CSS responsive, accessible contrast, sticky mobile CTA bar và semantic headings.

## Project structure
- `src/App.tsx`: route switch, layout, content, booking interaction.
- `src/styles.css`: design tokens, responsive layout và motion.
- `public/manus-routes.json`: route manifest.
- `app.config.ts`: platform logo metadata.
- `TODO.md`: acceptance outcomes và trạng thái.


## Asset and content expansion
Drive-supplied Igor and mountain images are now used in the About page, a curated Home gallery teaser and a dedicated Gallery route. The new Plan Your Visit route uses the same rounded resort visual language and provides English-first content for Kopaonik travel, hotel planning, transfer/car planning and ski clothing tips. Both routes use responsive 2-column mobile cards and the same sticky mobile conversion bar.


## Product roadmap (source brief: `PRODUCT_REQUIREMENTS.md`)

### Phase 1 — Public website and forms
Build the conversion-focused, English-first public site for the 2026–2027 season: audience/program pages, booking enquiry form, WhatsApp CTAs, SEO, analytics foundations, and mobile-first responsive design. Keep customer requests lightweight and do not require accounts or online payment in v1.

### Phase 2 — Admin dashboard and booking workflow
Add a lightweight internal booking/enquiry system for the founder and five instructors: persist enquiries, admin login, booking list/detail, status updates, filters, internal notes, CSV export, basic instructor availability, guest/admin email notifications, and a staff follow-up flow that closes bookings through WhatsApp. This phase requires a backend and database; the current frontend-only MVP does not yet persist submissions or provide an admin dashboard. Do not treat these Phase 2 capabilities as implemented until verified in code.

#### Approved implementation decisions — 2026-10-26
- Enable Webdev Server and managed MySQL. These capabilities are one-way; development and published runtime share one database, so use additive, versioned migrations and never populate production-shared tables with fake booking records.
- Public availability uses the IANA zone `Europe/Belgrade`, with local business hours 09:00–17:00 and hourly start-time choices from 09:00 through 16:00. A choice is offered only when the selected lesson duration fits before closing. Convert local selections with IANA timezone rules and store instants in UTC so Serbia's seasonal clock changes are handled correctly.
- A booking request occupies one instructor for one lesson block; participant count describes the customer's group, not seat inventory. Public slot labels show only the aggregate number of instructors still available. Names appear in the optional preference selector only when an admin explicitly enables guest requests for that instructor; selecting a preferred instructor is a hard constraint, so the calendar counts only that instructor's availability. Admins configure each instructor's weekly shifts, time off, closures and inclusive season window; do not advertise a slot unless a configured instructor can teach the entire requested duration.
- Availability is advisory until the server rechecks and creates the booking in a database transaction. The transaction locks/rechecks instructor availability to prevent overlapping requests from booking the same instructor. `New`, `Contacted`, `Confirmed`, `Deposit Paid` and `Completed` records remain unavailable; `Cancelled` releases the slot. The success message says the request is received and awaits staff confirmation, not that the lesson is confirmed.
- Use half-open `[start,end)` intervals and lock eligible instructor rows in ascending ID order before checking overlaps and inserting a booking. Schedule, exception, closure, reassignment and booking-status changes use the same instructor-locking discipline. The turnaround buffer defaults to 0 minutes until the owner chooses otherwise. Enforce per-format participant maxima in the browser and server: private/performance defaults are 1, adult semi-private is 2, the public Kids small-group cap is 4, and Family starts with a provisional admin-editable cap of 4. Keep public booking disabled until the owner reviews the format capacities, real team roster, season window and working schedules.
- Keep the existing public fields and add lesson format/duration plus a selected date and hourly start time. Reuse durations shown in the existing packages (60, 90 and 120 minutes; family-day formats of 4–5 hours). The live calendar books one lesson block per request; additional dates in multi-session packages are arranged with staff through WhatsApp or recorded as linked sessions by an administrator.
- Use email/password only for the protected staff dashboard because the owner explicitly selected it. Do not allow public registration. Store password hashes (Node `scrypt`), create an opaque server-side session, protect state-changing requests with CSRF/origin checks, rate-limit authentication and authorize every admin API. Use an HttpOnly, Secure session cookie with `SameSite=None` for the embedded HTTPS Preview. Create the first owner through a one-time protected bootstrap token; never ship a default password.
- Send a booking-received email to the guest and a new-booking alert to the configured iSki admin address; emails must say that staff confirmation is still pending. Use a transactional-mail adapter, defaulting to Resend unless the owner selects a connected alternative. Read API credentials and the verified sender identity only from protected runtime values; keep mail pending/disabled until the owner supplies them securely. Keep WhatsApp follow-up and manual deposit/payment-link handling; do not add a payment gateway.
- Reuse the iSKI public visual language. The admin area is a compact, responsive operations interface: snow-white work surfaces, navy navigation, electric-blue status/action emphasis, clear status labels, dense but readable booking rows, and no decorative dashboard artwork.
- Keep public React/Vite pages as static, prerendered output for speed and SEO; route `/api/*` to a small Node HTTP API container and other page routes to static output. Serve an unauthenticated `/api/health` endpoint, retain SPA/deep links, exclude admin pages from indexing, and never cache personalized API responses.

#### Phase 2 project structure
- `src/AvailabilityCalendar.tsx`: date selection, hourly slots, instructor counts and Serbia-time labels.
- `src/BookingForm.tsx`: validated public booking form, availability selection, server submission and WhatsApp follow-up.
- `src/admin/`: login/setup, booking list/detail, status/history/notes, instructor schedule, time-off, season settings and CSV export UI.
- `src/admin/api.ts`: typed same-origin client for session, availability and staff operations.
- `server/api/`: HTTP routes for auth, availability, bookings, admin filters/status/notes, instructor schedules, CSV and mail outbox.
- `server/auth/`: password hashing, bootstrap, sessions, CSRF, rate limiting and role checks.
- `server/db/` and `db/migrations/`: MySQL pool, parameterized queries and additive migrations for staff, sessions, availability, bookings, notes, audit history and email outbox.
- `server/mail/`: transactional email adapter and durable delivery records; provider credentials remain server-only.
- `server.mjs` and `vite.config.ts`: shared API handler for the production container and same-origin Preview/dev middleware.
- `scripts/`: deterministic migration and operational scripts; `Dockerfile`: API-only container, separate from the static frontend build.

### Delivery principle
Preserve the existing iSki branding, routes and public content where possible. Prioritise a simple boutique booking workflow over a marketplace or full SaaS product. Follow the detailed requirements and acceptance context in `PRODUCT_REQUIREMENTS.md`.


## Phase 1 implementation approach (confirmed)

Continue from the supplied React + TypeScript + Vite source and its existing premium iSKI alpine design. Keep Phase 1 frontend-only: no admin login, database, persistent booking storage, customer email automation or payment gateway. The public enquiry form validates the specified fields, confirms submission and hands the complete enquiry to WhatsApp; be explicit that this does not confirm a lesson or persist the enquiry online.

Separate the booking interaction into `src/BookingForm.tsx`; keep the existing shared page and route composition in `src/App.tsx`. Add `src/analytics.ts` for optional GA4/GTM/Meta integrations activated only by supplied IDs, and `src/seo.ts` for route-specific metadata and structured data. Pre-render the known public routes during the build from the React page components into route-specific static HTML so search/social crawlers receive meaningful initial content; retain client hydration for the existing interactive navigation. Generate `sitemap.xml` and `robots.txt`, and have the production static server serve the correct pre-rendered route or a genuine 404.

The route manifest and page set include `/partners` in addition to all existing routes. Reuse the authentic logos, banners and ski/founder photos already present in `public/assets`; the new Drive link currently requires account access, so do not replace those working assets with generated or guessed imagery. Preserve the existing `app.config.ts`, Docker health endpoint and the future Phase 2 scope in `PRODUCT_REQUIREMENTS.md`.

Project additions: `src/BookingForm.tsx` (form and WhatsApp handoff), `src/analytics.ts` (tracking hooks), `src/seo.ts` (metadata/schema), `src/render.tsx` and `scripts/prerender.mjs` (static route rendering), `public/sitemap.xml` and `public/robots.txt` (search discovery). The Phase 2 dashboard/database remain future work.

## Public-site audio controls (2026-10-26)

Use `public/assets/snowing-in-dresden-background sound.mp3` (108.3 seconds) as a quiet looping ambience and `public/assets/Snowball sound.mp3` (2.04 seconds) as the interaction click effect. Keep the separate 15-second `Snow fall.mp3` unused until the owner specifies a role for it. Add a shared `src/SiteAudioControls.tsx` component and dedicated audio-control styles; mount it only on public customer routes, never in `/admin`. Background sound is off until the visitor explicitly enables it because browsers restrict autoplay with sound. Click feedback follows the owner's request by default on first visit, with a separate keyboard-accessible off switch and stored opt-out preference. Mark the sound-control region so its own toggles do not trigger click effects; catch playback errors and preserve normal navigation/forms.


Audio asset provenance: both supplied links (`https://drive.google.com/drive/u/1/folders/1Fn3VQnEdZfacHjYlnh4cC40jCctJM5-c` and `https://drive.google.com/drive/u/3/folders/1Fn3VQnEdZfacHjYlnh4cC40jCctJM5-c`) resolve to the same Drive folder. The ambience source is `snowing-in-dresden-background sound.mp3` (Drive file ID `1BklP5fW_xlnl76LDXj1fkJ43NQA1QgPY`, 108.312 seconds); the click-effect source is `Snowball sound.mp3` (Drive file ID `1zOPBOt-UQJ2UJszaFZVnoyzPuUZAihIl`, 2.038 seconds). The remaining `Snow fall.mp3` (Drive file ID `1LylABh-cH7nzvk3Ltz1J74kd2qGnPXus`, 15.048 seconds) is not assigned to a website role.
