# Server modules

- `db.mjs` owns the managed MySQL pool, UTC sessions and additive migrations.
- `availability-core.mjs` owns deterministic Europe/Belgrade slot generation and interval logic.
- `availability.mjs` combines settings, schedules, exceptions and active bookings for availability reads.
- `security.mjs` owns opaque staff sessions, CSRF, password hashing and rate limits.
- `mail.mjs` sends only through the server-side Resend API adapter and records outcomes in `email_outbox`.
- `routes/` owns public booking and staff/admin HTTP handlers; `app.mjs` dispatches same-origin API requests.

The managed database is shared by development and published runtime. Run only checked-in migrations, never create fake customer bookings for validation, and keep all guest PII, passwords, session tokens and email API keys out of logs and browser output. Customer booking stores a single session block; remaining dates in a multi-session offer are arranged with the iSki team.
