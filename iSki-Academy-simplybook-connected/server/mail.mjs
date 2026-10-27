import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import { withConnection } from './db.mjs'

const ZONE = 'Europe/Belgrade'

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function localDateTime(date, time) {
  const value = DateTime.fromSQL(`${String(date).slice(0, 10)} ${String(time).slice(0, 8)}`, { zone: ZONE })
  return value.isValid ? value.toFormat('ccc, d LLL yyyy · HH:mm') : `${String(date).slice(0, 10)} ${String(time).slice(0, 5)} (${ZONE})`
}

async function sendProviderEmail({ to, subject, html, text, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return { status: 'not_configured', errorCode: 'email_not_configured' }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10000),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return { status: 'failed', errorCode: `resend_http_${response.status}` }
  return { status: 'sent', providerMessageId: typeof payload.id === 'string' ? payload.id : null }
}

function guestMessage(booking, templateKey) {
  const when = localDateTime(booking.local_date, booking.starts_at_local)
  const name = escapeHtml(booking.full_name)
  const label = escapeHtml(booking.format_label)
  const duration = Number(booking.duration_minutes)
  const durationLabel = duration ? ` · ${duration} minutes` : ''
  const commonHtml = `<p>Lesson: ${label}${durationLabel}<br>Participants: ${Number(booking.participants)}</p>`
  const commonText = `Lesson: ${booking.format_label}${durationLabel}\nParticipants: ${Number(booking.participants)}`
  let subject
  let statusHtml
  let statusText

  if (templateKey === 'guest_booking_confirmed') {
    subject = `Your iSki lesson is confirmed · ${when}`
    statusHtml = `<p>Your iSki lesson request is <strong>confirmed</strong> for ${when} (${ZONE}). The iSki team will contact you on WhatsApp if any final details are needed.</p>`
    statusText = `Your iSki lesson request is confirmed for ${when} (${ZONE}). The iSki team will contact you on WhatsApp if any final details are needed.`
  } else if (templateKey === 'guest_booking_deposit_paid') {
    subject = `Deposit update for your iSki lesson · ${when}`
    const depositUrl = String(booking.deposit_link || '')
    const safeDepositUrl = /^https:\/\//i.test(depositUrl) ? escapeHtml(depositUrl) : ''
    statusHtml = `<p>The iSki team has updated the deposit status for your lesson on ${when} (${ZONE}).${safeDepositUrl ? ` <a href="${safeDepositUrl}">View payment link</a>.` : ''}</p>`
    statusText = `The iSki team has updated the deposit status for your lesson on ${when} (${ZONE}).${safeDepositUrl ? ` Payment link: ${depositUrl}` : ''}`
  } else if (templateKey === 'guest_booking_cancelled') {
    subject = `Update about your iSki lesson request · ${when}`
    statusHtml = `<p>Your iSki lesson request for ${when} (${ZONE}) has been marked as cancelled. Please contact the team on WhatsApp if you believe this was a mistake.</p>`
    statusText = `Your iSki lesson request for ${when} (${ZONE}) has been marked as cancelled. Contact the team on WhatsApp if you believe this was a mistake.`
  } else if (templateKey === 'guest_booking_completed') {
    subject = `Thank you for skiing with iSki Academy`
    statusHtml = `<p>Thank you for choosing iSki Academy. We hope you enjoyed your lesson in Kopaonik.</p>`
    statusText = 'Thank you for choosing iSki Academy. We hope you enjoyed your lesson in Kopaonik.'
  } else {
    subject = 'We received your iSki lesson request'
    statusHtml = `<p>We have received your lesson request for <strong>${when} (${ZONE})</strong>. This is a request only; your lesson is not confirmed until the iSki team replies.</p>`
    statusText = `We have received your lesson request for ${when} (${ZONE}). This is a request only; your lesson is not confirmed until the iSki team replies.`
  }

  const html = `<p>Hi ${name},</p>${statusHtml}${commonHtml}<p>iSki Academy<br>Kopaonik, Serbia</p>`
  const text = `Hi ${booking.full_name},\n\n${statusText}\n${commonText}\n\niSki Academy · Kopaonik, Serbia`
  return { subject, html, text }
}

function adminMessage(booking) {
  const when = localDateTime(booking.local_date, booking.starts_at_local)
  const message = booking.message ? `<p>Guest note: ${escapeHtml(booking.message)}</p>` : ''
  const html = `<p>A new iSki booking request was saved.</p><p><strong>${escapeHtml(booking.full_name)}</strong><br>${escapeHtml(booking.email)}<br>${escapeHtml(booking.whatsapp)}</p><p>${escapeHtml(booking.format_label)} · ${Number(booking.participants)} participant(s)<br>${when} (${ZONE})<br>Status: New</p>${message}<p>Open the admin dashboard to follow up.</p>`
  const text = `A new iSki booking request was saved.\n\n${booking.full_name}\n${booking.email}\n${booking.whatsapp}\n${booking.format_label} · ${Number(booking.participants)} participant(s)\n${when} (${ZONE})\nStatus: New${booking.message ? `\nGuest note: ${booking.message}` : ''}\n\nOpen the admin dashboard to follow up.`
  return { subject: `New iSki request: ${booking.full_name} · ${when}`, html, text }
}

export async function sendPasswordResetEmail({ to, displayName, token, origin }) {
  const resetUrl = new URL('/admin', origin)
  resetUrl.hash = new URLSearchParams({ reset: token }).toString()
  const safeName = escapeHtml(displayName)
  const safeUrl = escapeHtml(resetUrl.toString())
  const subject = 'Reset your iSki staff password'
  const html = `<p>Hi ${safeName},</p><p>A password reset was requested for your iSki Academy staff account.</p><p><a href="${safeUrl}">Choose a new password</a></p><p>This one-time link expires in 30 minutes. If you did not request it, you can ignore this message.</p>`
  const text = `Hi ${displayName},\n\nA password reset was requested for your iSki Academy staff account.\n\nChoose a new password: ${resetUrl.toString()}\n\nThis one-time link expires in 30 minutes. If you did not request it, ignore this message.`
  const key = createHash('sha256').update(token).digest('hex')
  return sendProviderEmail({ to, subject, html, text, idempotencyKey: `iski:admin-password-reset:${key}` })
}

export async function deliverBookingOutbox(bookingId) {
  const rows = await withConnection(async (connection) => {
    const [outbox] = await connection.execute(
      `SELECT e.id, e.recipient, e.template_key, e.idempotency_key, e.delivery_status,
              b.full_name, b.email, b.whatsapp, b.format_code, b.local_date, b.starts_at_utc,
              b.ends_at_utc, b.participants, b.message, b.deposit_link, f.label AS format_label,
              f.duration_minutes
       FROM email_outbox e
       JOIN bookings b ON b.id = e.booking_id
       JOIN lesson_formats f ON f.code = b.format_code
       WHERE e.booking_id = ? AND e.delivery_status IN ('pending', 'failed', 'not_configured')
       ORDER BY e.id`, [bookingId],
    )
    return outbox.map((row) => ({ ...row, starts_at_local: DateTime.fromSQL(String(row.starts_at_utc), { zone: 'UTC' }).setZone(ZONE).toFormat('HH:mm') }))
  })
  const results = []
  for (const item of rows) {
    const template = item.template_key === 'admin_booking_alert' ? adminMessage(item) : guestMessage(item, item.template_key)
    const sent = await sendProviderEmail({ to: item.recipient, ...template, idempotencyKey: item.idempotency_key }).catch((error) => ({ status: 'failed', errorCode: error?.name === 'TimeoutError' ? 'provider_timeout' : 'provider_unavailable' }))
    await withConnection((connection) => connection.execute(
      `UPDATE email_outbox SET delivery_status = ?, provider_message_id = ?,
       attempts = attempts + 1, last_error_code = ?, sent_at = IF(? = 'sent', UTC_TIMESTAMP(3), sent_at)
       WHERE id = ?`,
      [sent.status, sent.providerMessageId || null, sent.errorCode || null, sent.status, item.id],
    ))
    results.push({ status: sent.status, errorCode: sent.errorCode || null })
  }
  return results
}

export async function retryEmailOutbox(id) {
  const bookingId = await withConnection(async (connection) => {
    const [rows] = await connection.execute('SELECT booking_id FROM email_outbox WHERE id = ? LIMIT 1', [id])
    return rows[0]?.booking_id || null
  })
  if (!bookingId) return null
  return deliverBookingOutbox(bookingId)
}
