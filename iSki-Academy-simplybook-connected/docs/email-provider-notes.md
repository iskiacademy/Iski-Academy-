# Transactional email integration notes

These notes capture the provider contract consulted for Phase 2 booking email. They do not contain credentials. The application must not send email until the owner configures the provider key and a sender address on a verified domain through protected project values.

Resend sends one transactional email with `POST https://api.resend.com/emails`, authenticated by a server-side bearer API key. The request includes `from`, `to`, `subject` and either `html` or `text`. Use an `Idempotency-Key` header derived from the specific outbox event so a retry cannot send the same message twice. Resend documents keys up to 256 characters and a 24-hour idempotency window. The application still records its own durable outbox state and must treat provider errors as delivery failures, not as a failed booking.

Resend requires an owned, verified sender domain. Its setup guide recommends a purpose-specific subdomain and requires the generated DNS records to be copied to the DNS provider before sending. Keep the sender identity configurable; do not guess that `iskiacademy.com` or a Gmail address is already verified. Guest mail must say the enquiry was received and is awaiting staff confirmation.

## Official references

[1]: https://resend.com/docs/api-reference/emails/send-email "Resend Send Email API"
[2]: https://resend.com/docs/add-a-domain "Resend Add and Verify a Domain"
[3]: https://resend.com/docs/dashboard/emails/idempotency-keys "Resend Idempotency Keys"
