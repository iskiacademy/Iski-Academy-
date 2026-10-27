import { randomUUID, createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import { inTransaction, withConnection } from './db.mjs'
import { getBusinessSettings } from './availability.mjs'
import { ACTIVE_BOOKING_STATUSES, getWeekday, isInstructorAvailable, makeCandidates } from './availability-core.mjs'
import { HttpError } from './validation.mjs'
import { deliverBookingOutbox } from './mail.mjs'

const STATUS_PLACEHOLDERS = ACTIVE_BOOKING_STATUSES.map(() => '?').join(', ')
const ZONE = 'Europe/Belgrade'

function sqlIpKey(request) {
  const raw = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || 'unknown'
  return createHash('sha256').update(`public-booking:${raw.trim().slice(0, 64)}`).digest('hex')
}

async function enforcePublicRateLimit(connection, request) {
  const keyHash = sqlIpKey(request)
  const [rows] = await connection.execute('SELECT requests, window_started_at FROM public_rate_limits WHERE key_hash = ? FOR UPDATE', [keyHash])
  if (!rows.length) {
    await connection.execute('INSERT INTO public_rate_limits (key_hash, window_started_at, requests) VALUES (?, UTC_TIMESTAMP(3), 1)', [keyHash])
    return
  }
  const [windowRows] = await connection.execute(
    'SELECT window_started_at > UTC_TIMESTAMP(3) - INTERVAL 1 HOUR AS current_window FROM public_rate_limits WHERE key_hash = ? LIMIT 1', [keyHash],
  )
  if (Boolean(windowRows[0]?.current_window) && Number(rows[0].requests) >= 5) throw new HttpError(429, 'booking_rate_limited', 'Too many requests from this connection. Please wait or contact iSki on WhatsApp.')
  await connection.execute(
    `UPDATE public_rate_limits SET
       requests = IF(window_started_at > UTC_TIMESTAMP(3) - INTERVAL 1 HOUR, requests + 1, 1),
       window_started_at = IF(window_started_at > UTC_TIMESTAMP(3) - INTERVAL 1 HOUR, window_started_at, UTC_TIMESTAMP(3))
     WHERE key_hash = ?`, [keyHash],
  )
}

async function fetchScheduleState(connection, instructors, localDate) {
  if (!instructors.length) return { schedules: [], exceptions: [], bookings: [] }
  const ids = instructors.map((item) => Number(item.id))
  const placeholders = ids.map(() => '?').join(',')
  const [schedules] = await connection.execute(
    `SELECT instructor_id, weekday, starts_at, ends_at, effective_from, effective_until
     FROM weekly_availability WHERE instructor_id IN (${placeholders})
     AND (effective_from IS NULL OR effective_from <= ?) AND (effective_until IS NULL OR effective_until >= ?) FOR UPDATE`,
    [...ids, localDate, localDate],
  )
  const [exceptions] = await connection.execute(
    `SELECT instructor_id, local_date, starts_at, ends_at, kind FROM availability_exceptions
     WHERE local_date = ? AND (instructor_id IS NULL OR instructor_id IN (${placeholders})) FOR UPDATE`, [localDate, ...ids],
  )
  const [bookings] = await connection.execute(
    `SELECT id, assigned_instructor_id, local_date, starts_at_utc, ends_at_utc, status
     FROM bookings WHERE local_date = ? AND status IN (${STATUS_PLACEHOLDERS}) FOR UPDATE`,
    [localDate, ...ACTIVE_BOOKING_STATUSES],
  )
  return { schedules, exceptions, bookings }
}

export async function createPublicBooking(request, booking) {
  const bookingId = randomUUID()
  const result = await inTransaction(async (connection) => {
    await enforcePublicRateLimit(connection, request)
    const [settingRows] = await connection.execute('SELECT * FROM app_settings WHERE id = 1 FOR UPDATE')
    const settings = await getBusinessSettings(connection)
    if (!settingRows.length || !settings?.publicBookingEnabled || !settings.seasonStart || !settings.seasonEnd) {
      throw new HttpError(409, 'booking_closed', 'Online booking is not open yet. Please contact iSki on WhatsApp.')
    }
    if (booking.localDate < settings.seasonStart || booking.localDate > settings.seasonEnd) throw new HttpError(409, 'outside_season', 'That date is outside the published booking season.')

    const [formatRows] = await connection.execute(
      'SELECT code, lesson_type, label, duration_minutes, max_participants FROM lesson_formats WHERE code = ? AND active = 1 AND bookable_online = 1 FOR UPDATE',
      [booking.formatCode],
    )
    const format = formatRows[0]
    if (!format || format.lesson_type !== booking.lessonType) throw new HttpError(400, 'invalid_lesson_format', 'Choose a lesson format for the selected lesson type.')
    if (booking.participants > Number(format.max_participants)) throw new HttpError(400, 'participant_limit', `This lesson format allows up to ${format.max_participants} participant(s). Contact iSki on WhatsApp for a larger group.`)

    const selectedInstructor = booking.preferredInstructorId
    const instructorSql = selectedInstructor
      ? 'SELECT id, display_name FROM instructors WHERE active = 1 AND selectable_by_guests = 1 AND id = ? ORDER BY id FOR UPDATE'
      : 'SELECT id, display_name FROM instructors WHERE active = 1 ORDER BY id FOR UPDATE'
    const [instructors] = await connection.execute(instructorSql, selectedInstructor ? [selectedInstructor] : [])
    if (selectedInstructor && !instructors.length) throw new HttpError(400, 'invalid_instructor', 'That instructor is not available as an online preference.')
    if (!instructors.length) throw new HttpError(409, 'no_instructors', 'No instructor availability is configured. Please contact iSki on WhatsApp.')

    const startDateTime = DateTime.fromISO(`${booking.localDate}T${booking.startTime}`, { zone: ZONE })
    if (!startDateTime.isValid) throw new HttpError(400, 'invalid_start_time', 'Choose a valid Serbia local time.')
    const candidate = makeCandidates(booking.localDate, Number(format.duration_minutes), settings, DateTime.utc())
      .find((item) => item.startLocal === booking.startTime)
    if (!candidate) throw new HttpError(409, 'slot_unavailable', 'That start time is no longer available. Refresh the calendar and choose another time.')

    const { schedules, exceptions, bookings: occupied } = await fetchScheduleState(connection, instructors, booking.localDate)
    const weekday = getWeekday(booking.localDate)
    const available = instructors.filter((instructor) => isInstructorAvailable({
      instructorId: instructor.id,
      weekday,
      localDate: booking.localDate,
      slot: candidate,
      schedules,
      exceptions,
      bookings: occupied,
      bufferMinutes: settings.turnaroundMinutes,
    }))
    if (!available.length) throw new HttpError(409, 'slot_unavailable', 'That time was just taken. Refresh the calendar to see the latest availability.')

    const loadByInstructor = new Map(available.map((instructor) => [Number(instructor.id), 0]))
    for (const item of occupied) {
      if (!loadByInstructor.has(Number(item.assigned_instructor_id))) continue
      const start = DateTime.fromSQL(String(item.starts_at_utc), { zone: 'UTC' })
      const end = DateTime.fromSQL(String(item.ends_at_utc), { zone: 'UTC' })
      if (start.isValid && end.isValid) loadByInstructor.set(Number(item.assigned_instructor_id), loadByInstructor.get(Number(item.assigned_instructor_id)) + end.diff(start, 'minutes').minutes)
    }
    available.sort((a, b) => (loadByInstructor.get(Number(a.id)) - loadByInstructor.get(Number(b.id))) || (Number(a.id) - Number(b.id)))
    const assigned = available[0]

    await connection.execute(
      `INSERT INTO bookings
       (id, full_name, email, whatsapp, lesson_type, format_code, preferred_instructor_id, assigned_instructor_id,
        local_date, starts_at_utc, ends_at_utc, timezone, participants, skill_level, source, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New')`,
      [bookingId, booking.fullName, booking.email, booking.whatsapp, booking.lessonType, booking.formatCode,
        selectedInstructor, assigned.id, booking.localDate, candidate.startUtc, candidate.endUtc, ZONE,
        booking.participants, booking.skillLevel, booking.source, booking.message || null],
    )
    await connection.execute(
      "INSERT INTO booking_status_history (booking_id, previous_status, new_status, actor_id, detail) VALUES (?, NULL, 'New', NULL, 'Guest booking request')",
      [bookingId],
    )
    const [ownerRows] = await connection.execute(
      "SELECT email FROM admin_users WHERE active = 1 AND role IN ('owner', 'admin') ORDER BY FIELD(role, 'owner', 'admin'), id LIMIT 1",
    )
    await connection.execute(
      `INSERT INTO email_outbox (booking_id, recipient, template_key, idempotency_key, delivery_status)
       VALUES (?, ?, 'guest_booking_received', ?, 'pending')`,
      [bookingId, booking.email, `iski:booking:${bookingId}:guest`],
    )
    if (ownerRows[0]?.email) {
      await connection.execute(
        `INSERT INTO email_outbox (booking_id, recipient, template_key, idempotency_key, delivery_status)
         VALUES (?, ?, 'admin_booking_alert', ?, 'pending')`,
        [bookingId, ownerRows[0].email, `iski:booking:${bookingId}:admin`],
      )
    }
    return { bookingId, assignedInstructorId: Number(assigned.id), formatLabel: format.label, durationMinutes: Number(format.duration_minutes), endTime: candidate.endLocal }
  })

  let emailResults = []
  try { emailResults = await deliverBookingOutbox(result.bookingId) } catch (error) {
    console.error(`Booking email delivery deferred: ${error?.code || error?.name || 'unknown_error'}`)
  }
  const emailStatus = emailResults.length && emailResults.every((item) => item.status === 'sent')
    ? 'sent'
    : emailResults.some((item) => item.status === 'failed') ? 'failed' : 'not_configured'
  return {
    bookingId: result.bookingId,
    status: 'New',
    lesson: result.formatLabel,
    durationMinutes: result.durationMinutes,
    localDate: booking.localDate,
    startTime: booking.startTime,
    endTime: result.endTime,
    timezone: ZONE,
    emailStatus,
    message: 'Your request is saved and awaiting staff confirmation. The lesson is not confirmed until the iSki team replies.',
  }
}
