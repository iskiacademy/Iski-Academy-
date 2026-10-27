# iSki Academy — outcomes

## Phase 1 — public website and forms — complete

### 1. Public website shell, routes and shared navigation — complete
- Build/retain an English-first public website for iSki Academy, a premium, personal ski school in Kopaonik, Serbia, for winter 2026–2027, serving international families, children, adults and advanced skiers.
- Use one domain with subdirectories; keep a shared brand identity, header, footer, navigation, enquiry flow, analytics foundation and SEO setup.
- Provide the public routes `/`, `/families`, `/kids`, `/adults`, `/performance`, `/book`, `/partners`, `/contact`, `/about/igor-andric`, `/gallery`, `/plan-your-visit`, `/prices` and `/faq`.
- Main conversion channels are the website enquiry form and WhatsApp. Do not require customer accounts.

### 2. Homepage and audience landing pages — complete
- Homepage clearly positions English-language premium ski coaching in Kopaonik; introduces the founder, five instructors, audiences served, trust signals and prominent booking actions.
- Families, Kids, Adults and Performance pages each include a clear audience promise; primary “Check Availability” and secondary “Chat on WhatsApp” CTAs; relevant customer problem and solution; three booking steps (choose lesson type, send request, confirm on WhatsApp); 2–3 clear lesson packages with duration, group size, ideal guest and starting price where verified; social proof; relevant FAQ; and final enquiry/WhatsApp CTA.
- Use clear, simple, premium English and outcome-based copy such as “confident first turns”, “safe and fun kids’ lessons”, “faster progression” and “private coaching for strong skiers”. Avoid generic claims such as “best ski school”.

### 3. Supporting public pages and real brand assets — complete
- Keep the existing About, Gallery, Plan Your Visit, Prices, FAQ, Partners and Contact content aligned with their page purpose and shared design system.
- Reuse the official iSKI logo, existing project imagery and owner-provided authentic imagery where accessible. Do not generate a lookalike of founder Igor or present placeholder imagery as authentic.
- Use descriptive image alternative text and lazy loading where appropriate.

### 4. Mobile-friendly booking/enquiry form — complete
- Keep the customer flow short, mobile-friendly and under 60 seconds; validate required fields clearly and do not require an account.
- Required fields: Full name; Email; WhatsApp number; Lesson type (Kids / Family / Adult Private / Performance Coaching); Preferred dates; Number of participants; Skill level (First timer / Beginner / Intermediate / Advanced).
- Optional fields: Preferred instructor and Message.
- Include Source options: Families / Kids / Adults / Performance / Partner / Instagram / Google.
- Do not claim to save enquiry data persistently in Phase 1 when no backend is configured.

### 5. Submission confirmation and WhatsApp continuation — complete
- After a valid submission, show a clear success/thank-you state and a WhatsApp CTA.
- Create a click-to-chat URL with a pre-filled message containing the booking details so the guest can continue the conversation with iSki staff.
- Provide a persistent WhatsApp button on every public page and use consistent, tappable booking CTAs.
- Keep phone links where available. Track form submission and WhatsApp/phone interactions when analytics IDs are configured.

### 6. Premium alpine visual design, accessibility and performance — complete
- Preserve the existing iSKI brand palette: navy `#0A1432`, secondary navy `#142B73`, electric blue `#1284E7`, yellow `#FAD903`, white and snow background `#F3F9FE`.
- Maintain a premium, clean, modern alpine aesthetic with generous white space, readable typography, high-quality ski photography, mobile-first layouts, accessible contrast and fast loading.
- Avoid clutter and unnecessary animation; preserve natural, light, irregular snowfall where already used.

### 7. SEO foundation — complete
- Use SEO-friendly URLs and a unique title tag and meta description for each public page.
- Add Open Graph metadata and appropriate LocalBusiness, SkiSchool, FAQPage and Review schema markup where supported by accurate content.
- Provide `sitemap.xml` and `robots.txt`; optimize image alt text and lazy loading.

### 8. Analytics foundation — complete
- Prepare Google Analytics 4, Google Tag Manager and Meta Pixel integration points; leave them inactive/configurable until valid IDs are supplied and never invent credentials.
- Support conversion events: booking form submitted, WhatsApp click, phone click, package view and booking confirmation page view.

### 8a. Optional public-site audio — complete
- Use the owner-provided `snowing-in-dresden-background sound.mp3` as subtle looping ambience on public customer pages, and provide a visible way to start and stop it. Do not autoplay music before the visitor explicitly enables it.
- Use the owner-provided `Snowball sound.mp3` for public interactive-control clicks. Preload and decode the effect, warm the low-latency audio context on pointer/keyboard interaction, and start it synchronously in the click event without an artificial timer or waiting for the site action. Keep it enabled by default to match the requested click feedback, but provide a separate accessible control to turn click sounds off. Do not play website sounds in the staff admin area or when the visitor has disabled click sounds.
- Keep the existing snowfall visuals, use the MP3 assets in the project source, and handle browser playback failure without breaking navigation or booking.

## Phase 2 — admin dashboard and booking workflow — in progress
Implementation is present in the source; first owner bootstrap, actual roster/season/capacity configuration, Resend setup and final end-to-end booking validation remain pending.

### 9. Public availability calendar and instructor capacity — in progress
- Show guests bookable dates and available lesson start times before submission; display times in Serbia's `Europe/Belgrade` timezone, with working hours 09:00–17:00 and start choices on one-hour boundaries (09:00 through 16:00).
- Offer a start time only when the chosen lesson duration ends by 17:00 and at least one configured instructor is available for the whole interval. Preserve the current lesson formats (60, 90 and 120 minutes, plus 4–5-hour family-day formats); keep duration visible in the form.
- Availability is based on instructor capacity, not cinema-style individual seats: one booking group consumes one instructor for a lesson block, and the public calendar shows how many instructors remain available without exposing instructor names.
- Availability must account for instructor weekly working patterns, time off, date-specific closures, season opening/closing dates and active booking intervals. Do not advertise dates outside configured season or slots before an instructor schedule has been set.
- Resolve local dates/times with IANA timezone rules and store absolute booking times consistently in UTC; Serbia daylight-saving changes must not create shifted or duplicate business-hour slots.
- Provide useful empty/loading/error states, including when the academy has not configured its dates or instructor schedules; retain a WhatsApp contact option.
- The optional preferred-instructor choice is a hard constraint when selected: show only that instructor's available starts and do not silently assign another coach. Keep public slot labels aggregated; reveal coach names only when staff explicitly makes them selectable as a guest preference.
- Enforce a maximum participant count per lesson format in both UI and server validation. Initial safe defaults are 1 for private/performance, 2 for adult semi-private, 4 for the existing Kids small-group offer, and a provisional editable maximum of 4 for Family formats. Staff must review/adjust these limits before enabling public requests; groups beyond a limit are directed to WhatsApp for manual advice.
- Admin settings control the turnaround buffer (initial default 0 minutes) and season boundaries; the season start and end dates are both included. Public availability stays closed until an admin explicitly enables it after configuring the actual roster, capacities, season and shifts.

### 10. Persistent public booking request and double-booking protection — in progress
- Keep the guest flow account-free and under 60 seconds. Preserve the existing required fields: full name, email, WhatsApp number, lesson type (Kids / Family / Adult Private / Performance Coaching), lesson date/time, participants, skill level (First timer / Beginner / Intermediate / Advanced) and source (Families / Kids / Adults / Performance / Partner / Instagram / Google). Keep preferred instructor and message optional.
- Validate all booking data on the server as well as in the browser. Recheck availability when the guest submits; create the booking and reserve the instructor interval atomically so concurrent requests cannot book the same instructor twice. If it became unavailable, return the guest to current availability without creating a duplicate.
- Store submitted enquiries in MySQL as status `New`; confirmation copy and customer email must say that the request was received and is awaiting staff confirmation, not that the lesson is confirmed.
- Statuses `New`, `Contacted`, `Confirmed`, `Deposit Paid` and `Completed` keep their lesson interval occupied; `Cancelled` releases it. Keep a change history for status and assignment updates.
- A public request represents one scheduled lesson block. Multi-session packages can be handled by staff through linked/admin-managed lesson sessions and WhatsApp follow-up; do not falsely indicate that one selected time reserves a whole multi-day package.
- After successful submission, show a thank-you state and prefilled WhatsApp link with the guest's booking details, while confirming the request is durably recorded.

### 11. Secure staff login, account lifecycle and role-based access — in progress
- Provide email/password login for iSki staff, as explicitly selected by the owner. Do not permit public self-registration or ship a default password.
- Create the first owner account through a one-time, protected setup token; allow the owner/admin to create, edit, deactivate and assign roles to instructor/staff accounts.
- Store only strong password hashes; use opaque server-side sessions, expiring/revocable sessions, secure HttpOnly cookies, CSRF/origin validation and rate limiting for login/reset/bootstrap operations.
- Apply role authorization on every protected server endpoint; unauthenticated public visitors must never read dashboard records, guest contact information, internal notes, staff schedules or export data.
- Provide password reset/account recovery through a configured transactional email provider; never expose passwords, session tokens, API keys or reset tokens in browser output, logs or CSV metadata.

### 12. Admin booking dashboard, details and follow-up — in progress
- Provide staff with a booking list and booking detail page. Support filters by booking date, lesson type, instructor and status.
- Support the exact workflow statuses `New`, `Contacted`, `Confirmed`, `Deposit Paid`, `Completed` and `Cancelled`; allow authorized staff to update status and instructor assignment, and record actor/time/history.
- Let staff add private internal notes to a booking; keep internal notes out of guest-facing pages, WhatsApp text and emails.
- Provide CSV export of authorized booking data, with local dates/times clearly labeled as Serbia time and without leaking internal secrets or session data.
- Support WhatsApp follow-up from a booking detail using the guest's saved details and a prefilled message; keep the public WhatsApp button available across public routes.
- Support a manual deposit/payment link after the staff confirms a booking, and allow staff to mark `Deposit Paid`. Do not add a full payment gateway or marketplace.

### 13. Instructor management, availability calendar and business settings — in progress
- Provide a basic instructor roster for the founder/team of five instructors, with editable names, contact details, active state and assignment visibility controlled by role.
- Let authorized staff configure each instructor's weekly availability within 09:00–17:00, exceptions/time off, closures and the season booking window. Keep availability editable without a developer.
- Provide an admin calendar showing scheduled bookings, blocked time and instructor assignments in `Europe/Belgrade` time; expose only aggregate instructor availability to public visitors.
- Keep initial availability unadvertised until the owner/admin has configured the actual season and coach schedules; do not create fictional staff identities or customer bookings.

### 14. Booking and admin email notifications — in progress
- Send an automatic booking-received email to the guest and a new-booking notification to the configured iSki admin email after a booking is durably stored.
- State clearly in customer email that this is a request awaiting staff confirmation; do not send a confirmed-lesson or deposit-paid email until that state actually changes.
- Use a transactional email adapter (Resend by default unless the owner selects another provider), with the API key and verified sender supplied through protected secret input. Until configured, surface email delivery as not configured/pending and never pretend a notification was sent.
- Record delivery result/outbox state so an email-provider failure does not lose the booking or make the form report that the request failed after it was saved; provide a safe admin retry path.

### 15. Backend deployment, data protection, SEO and operational handoff — in progress
- Enable the approved Webdev Server and managed MySQL capabilities. The managed database is shared by development and published runtime; use deterministic, additive, versioned migrations, avoid destructive SQL and do not insert fake booking records for testing.
- Keep the existing static, pre-rendered public site for SEO/performance and route `/api/*` to the server container; keep API responses private/non-cacheable, expose an unauthenticated health endpoint, and protect admin routes from indexing.
- Keep all secrets server-side and loaded only from protected runtime environment values. Do not log guest PII/passwords/session tokens. Add a concise booking-data/privacy notice for owner review before production release.
- Preserve existing public content, brand palette, analytics hooks, route manifest, sitemap and robots file; document how the owner updates packages/prices, staff, weekly availability, closures and booking status.
- Preserve the existing Phase 1 source and reference files. Run the production build, type checks and focused booking/auth/data-flow checks; mark this Phase 2 item complete only after successful implementation and verification.
