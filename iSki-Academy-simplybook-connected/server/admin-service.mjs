import { DateTime } from 'luxon'
import { inTransaction, withConnection } from './db.mjs'
import { ACTIVE_BOOKING_STATUSES, BUSINESS_TIMEZONE, getWeekday, isInstructorAvailable } from './availability-core.mjs'
import { getBusinessSettings } from './availability.mjs'
import { HttpError, cleanText, normalizeEmail } from './validation.mjs'
import { hashPassword } from './security.mjs'

const STATUSES = ['New', 'Contacted', 'Confirmed', 'Deposit Paid', 'Completed', 'Cancelled']
const ACTIVE_PLACEHOLDERS = ACTIVE_BOOKING_STATUSES.map(() => '?').join(', ')
const ZONE = BUSINESS_TIMEZONE
const TRANSITIONS = {
  New: ['Contacted', 'Confirmed', 'Cancelled'],
  Contacted: ['New', 'Confirmed', 'Cancelled'],
  Confirmed: ['Contacted', 'Deposit Paid', 'Completed', 'Cancelled'],
  'Deposit Paid': ['Confirmed', 'Completed', 'Cancelled'],
  Completed: [],
  Cancelled: ['New', 'Confirmed'],
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && DateTime.fromISO(value, { zone: ZONE }).isValid
    && DateTime.fromISO(value, { zone: ZONE }).toISODate() === value
}

function normalizeBooking(row) {
  const start = DateTime.fromSQL(String(row.starts_at_utc), { zone: 'UTC' }).setZone(ZONE)
  const end = DateTime.fromSQL(String(row.ends_at_utc), { zone: 'UTC' }).setZone(ZONE)
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    whatsapp: row.whatsapp,
    lessonType: row.lesson_type,
    formatCode: row.format_code,
    formatLabel: row.format_label,
    preferredInstructorId: row.preferred_instructor_id == null ? null : Number(row.preferred_instructor_id),
    assignedInstructorId: Number(row.assigned_instructor_id),
    instructorName: row.instructor_name || null,
    localDate: String(row.local_date).slice(0, 10),
    startTime: start.isValid ? start.toFormat('HH:mm') : '',
    endTime: end.isValid ? end.toFormat('HH:mm') : '',
    startsAtUtc: String(row.starts_at_utc),
    endsAtUtc: String(row.ends_at_utc),
    timezone: row.timezone,
    participants: Number(row.participants),
    skillLevel: row.skill_level,
    source: row.source,
    message: row.message || '',
    depositLink: row.deposit_link || '',
    status: row.status,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

const bookingSelect = `SELECT b.*, f.label AS format_label, i.display_name AS instructor_name
  FROM bookings b
  JOIN lesson_formats f ON f.code = b.format_code
  JOIN instructors i ON i.id = b.assigned_instructor_id`

function buildFilters(filters, user) {
  const clauses = []
  const params = []
  if (filters.from) {
    if (!validDate(filters.from)) throw new HttpError(400, 'invalid_date', 'Choose a valid start date.')
    clauses.push('b.local_date >= ?'); params.push(filters.from)
  }
  if (filters.to) {
    if (!validDate(filters.to)) throw new HttpError(400, 'invalid_date', 'Choose a valid end date.')
    clauses.push('b.local_date <= ?'); params.push(filters.to)
  }
  if (filters.status) {
    if (!STATUSES.includes(filters.status)) throw new HttpError(400, 'invalid_status', 'Choose a valid booking status.')
    clauses.push('b.status = ?'); params.push(filters.status)
  }
  if (filters.lessonType) {
    const type = cleanText(filters.lessonType, 48, 'lesson type')
    clauses.push('b.lesson_type = ?'); params.push(type)
  }
  if (filters.instructorId && (user.role === 'owner' || user.role === 'admin')) {
    const instructorId = Number(filters.instructorId)
    if (!Number.isSafeInteger(instructorId) || instructorId < 1) throw new HttpError(400, 'invalid_instructor', 'Choose a valid instructor.')
    clauses.push('b.assigned_instructor_id = ?'); params.push(instructorId)
  }
  if (user.role === 'instructor') {
    if (!user.instructorId) clauses.push('1 = 0')
    else { clauses.push('b.assigned_instructor_id = ?'); params.push(user.instructorId) }
  }
  if (filters.search) {
    const search = cleanText(filters.search, 80, 'search')
    if (search) {
      clauses.push('(b.full_name LIKE ? OR b.email LIKE ? OR b.whatsapp LIKE ?)')
      const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`
      params.push(like, like, like)
    }
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

export async function listBookings(filters, user) {
  const { where, params } = buildFilters(filters, user)
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500)
  const offset = Math.min(Math.max(Number(filters.offset) || 0, 0), 5000)
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(`${bookingSelect} ${where} ORDER BY b.local_date, b.starts_at_utc LIMIT ? OFFSET ?`, [...params, limit, offset])
    return rows.map(normalizeBooking)
  })
}

export async function getBooking(id, user) {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(`${bookingSelect} WHERE b.id = ? LIMIT 1`, [id])
    if (!rows.length || (user.role === 'instructor' && Number(rows[0].assigned_instructor_id) !== user.instructorId)) throw new HttpError(404, 'booking_not_found', 'Booking not found.')
    const booking = normalizeBooking(rows[0])
    const [notes] = await connection.execute(
      `SELECT n.id, n.note, n.created_at, u.display_name AS author_name
       FROM booking_notes n JOIN admin_users u ON u.id = n.author_id
       WHERE n.booking_id = ? ORDER BY n.created_at DESC LIMIT 100`, [id],
    )
    const [history] = await connection.execute(
      `SELECT h.previous_status, h.new_status, h.detail, h.created_at, u.display_name AS actor_name
       FROM booking_status_history h LEFT JOIN admin_users u ON u.id = h.actor_id
       WHERE h.booking_id = ? ORDER BY h.created_at DESC LIMIT 100`, [id],
    )
    booking.notes = notes.map((row) => ({ id: Number(row.id), note: row.note, authorName: row.author_name, createdAt: String(row.created_at) }))
    booking.history = history.map((row) => ({ previousStatus: row.previous_status, newStatus: row.new_status, detail: row.detail, actorName: row.actor_name || 'Guest', createdAt: String(row.created_at) }))
    const [emails] = await connection.execute(
      `SELECT id, template_key, recipient, delivery_status, attempts, last_error_code, sent_at
       FROM email_outbox WHERE booking_id = ? ORDER BY id DESC LIMIT 20`, [id],
    )
    booking.emailNotifications = emails.map((row) => ({ id: Number(row.id), templateKey: row.template_key, recipient: row.recipient, status: row.delivery_status, attempts: Number(row.attempts), lastErrorCode: row.last_error_code || null, sentAt: row.sent_at ? String(row.sent_at) : null }))
    return booking
  })
}

function makeBookingSlot(booking, bufferMinutes) {
  const start = DateTime.fromSQL(String(booking.starts_at_utc), { zone: 'UTC' }).setZone(ZONE)
  const end = DateTime.fromSQL(String(booking.ends_at_utc), { zone: 'UTC' }).setZone(ZONE)
  if (!start.isValid || !end.isValid) return null
  const blockedEnd = end.plus({ minutes: bufferMinutes })
  return {
    localDate: start.toISODate(),
    startLocal: start.toFormat('HH:mm'),
    endLocal: end.toFormat('HH:mm'),
    startUtc: start.toUTC().toFormat("yyyy-LL-dd HH:mm:ss.SSS"),
    endUtc: end.toUTC().toFormat("yyyy-LL-dd HH:mm:ss.SSS"),
    blockedEndUtc: blockedEnd.toUTC().toFormat("yyyy-LL-dd HH:mm:ss.SSS"),
    startMillis: start.toUTC().toMillis(),
    endMillis: end.toUTC().toMillis(),
    blockedEndMillis: blockedEnd.toUTC().toMillis(),
  }
}

async function assertInstructorCanTake(connection, booking, instructorId, settings) {
  const [instructors] = await connection.execute('SELECT id FROM instructors WHERE id = ? AND active = 1 FOR UPDATE', [instructorId])
  if (!instructors.length) throw new HttpError(409, 'instructor_inactive', 'Choose an active instructor.')
  const slot = makeBookingSlot(booking, settings.turnaroundMinutes)
  if (!slot) throw new HttpError(409, 'invalid_booking_interval', 'This booking has an invalid time interval.')
  const weekday = getWeekday(slot.localDate)
  const [schedules] = await connection.execute(
    `SELECT instructor_id, weekday, starts_at, ends_at, effective_from, effective_until
     FROM weekly_availability WHERE instructor_id = ? AND weekday = ?
     AND (effective_from IS NULL OR effective_from <= ?) AND (effective_until IS NULL OR effective_until >= ?) FOR UPDATE`,
    [instructorId, weekday, slot.localDate, slot.localDate],
  )
  const [exceptions] = await connection.execute(
    'SELECT instructor_id, local_date, starts_at, ends_at, kind FROM availability_exceptions WHERE local_date = ? AND (instructor_id IS NULL OR instructor_id = ?) FOR UPDATE',
    [slot.localDate, instructorId],
  )
  const [occupied] = await connection.execute(
    `SELECT id, assigned_instructor_id, local_date, starts_at_utc, ends_at_utc, status FROM bookings
     WHERE local_date = ? AND assigned_instructor_id = ? AND status IN (${ACTIVE_PLACEHOLDERS}) AND id <> ? FOR UPDATE`,
    [slot.localDate, instructorId, ...ACTIVE_BOOKING_STATUSES, booking.id],
  )
  if (!isInstructorAvailable({ instructorId, weekday, localDate: slot.localDate, slot, schedules, exceptions, bookings: occupied, bufferMinutes: settings.turnaroundMinutes })) {
    throw new HttpError(409, 'instructor_conflict', 'That instructor is not available for the full lesson interval.')
  }
}

export async function updateBooking(id, body, user) {
  const allowedKeys = new Set(['status', 'assignedInstructorId', 'depositLink'])
  if (!body || typeof body !== 'object' || Object.keys(body).some((key) => !allowedKeys.has(key))) throw new HttpError(400, 'invalid_update', 'Check the booking update fields.')
  const requestedStatus = body.status
  const newInstructorId = body.assignedInstructorId == null || body.assignedInstructorId === '' ? null : Number(body.assignedInstructorId)
  const depositLink = body.depositLink == null ? undefined : String(body.depositLink).trim()
  if (requestedStatus && !STATUSES.includes(requestedStatus)) throw new HttpError(400, 'invalid_status', 'Choose a valid booking status.')
  if (newInstructorId !== null && (!Number.isSafeInteger(newInstructorId) || newInstructorId < 1)) throw new HttpError(400, 'invalid_instructor', 'Choose a valid instructor.')
  if (depositLink !== undefined && depositLink) {
    let url
    try { url = new URL(depositLink) } catch { throw new HttpError(400, 'invalid_deposit_link', 'Enter a secure https payment link.') }
    if (url.protocol !== 'https:' || url.username || url.password || depositLink.length > 500) throw new HttpError(400, 'invalid_deposit_link', 'Enter a secure https payment link.')
  }
  const manager = user.role === 'owner' || user.role === 'admin'
  if ((newInstructorId !== null || depositLink !== undefined) && !manager) throw new HttpError(403, 'forbidden', 'Only an owner or admin can reassign instructors or manage deposit links.')

  const updated = await inTransaction(async (connection) => {
    const [currentRows] = await connection.execute('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id])
    const current = currentRows[0]
    if (!current || (user.role === 'instructor' && Number(current.assigned_instructor_id) !== user.instructorId)) throw new HttpError(404, 'booking_not_found', 'Booking not found.')
    const targetInstructor = newInstructorId || Number(current.assigned_instructor_id)
    const reactivating = current.status === 'Cancelled' && requestedStatus && requestedStatus !== 'Cancelled'
    const changedInstructor = targetInstructor !== Number(current.assigned_instructor_id)
    if (reactivating || changedInstructor) {
      const ids = [...new Set([Number(current.assigned_instructor_id), targetInstructor])].sort((a, b) => a - b)
      const placeholders = ids.map(() => '?').join(',')
      await connection.execute(`SELECT id FROM instructors WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`, ids)
    }
    const [lockedRows] = await connection.execute('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [id])
    const locked = lockedRows[0]
    if (!locked) throw new HttpError(404, 'booking_not_found', 'Booking not found.')
    if (Number(locked.assigned_instructor_id) !== Number(current.assigned_instructor_id)) throw new HttpError(409, 'booking_changed', 'This booking changed. Refresh and try again.')

    const nextStatus = requestedStatus || locked.status
    if (nextStatus !== locked.status && !TRANSITIONS[locked.status]?.includes(nextStatus)) throw new HttpError(409, 'invalid_status_transition', `A booking cannot move from ${locked.status} to ${nextStatus}.`)
    const settings = await getBusinessSettings(connection)
    if (reactivating || changedInstructor) await assertInstructorCanTake(connection, locked, targetInstructor, settings)
    if (depositLink && !['Confirmed', 'Deposit Paid'].includes(nextStatus)) throw new HttpError(409, 'deposit_requires_confirmation', 'Add a deposit link only after confirming the booking.')

    const newStatus = nextStatus
    const detailParts = []
    if (newStatus !== locked.status) detailParts.push(`Status: ${locked.status} → ${newStatus}`)
    if (changedInstructor) detailParts.push(`Instructor reassigned to #${targetInstructor}`)
    const newDeposit = depositLink === undefined ? locked.deposit_link : (depositLink || null)
    await connection.execute(
      'UPDATE bookings SET status = ?, assigned_instructor_id = ?, deposit_link = ? WHERE id = ?',
      [newStatus, targetInstructor, newDeposit, id],
    )
    if (newStatus !== locked.status || changedInstructor) {
      await connection.execute(
        'INSERT INTO booking_status_history (booking_id, previous_status, new_status, actor_id, detail) VALUES (?, ?, ?, ?, ?)',
        [id, locked.status, newStatus, user.id, detailParts.join('; ') || 'Booking updated'],
      )
    }
    if (newStatus !== locked.status && ['Confirmed', 'Deposit Paid', 'Cancelled', 'Completed'].includes(newStatus)) {
      const templateKey = newStatus === 'Confirmed' ? 'guest_booking_confirmed'
        : newStatus === 'Deposit Paid' ? 'guest_booking_deposit_paid'
          : newStatus === 'Cancelled' ? 'guest_booking_cancelled' : 'guest_booking_completed'
      await connection.execute(
        `INSERT IGNORE INTO email_outbox (booking_id, recipient, template_key, idempotency_key, delivery_status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [id, locked.email, templateKey, `iski:booking:${id}:${newStatus}:${Date.now()}`],
      )
    }
    return { bookingId: id, statusChanged: newStatus !== locked.status, status: newStatus }
  })
  return updated
}

export async function addBookingNote(id, noteValue, user) {
  const note = cleanText(noteValue, 2000, 'note', { required: true })
  return withConnection(async (connection) => {
    const [rows] = await connection.execute('SELECT assigned_instructor_id FROM bookings WHERE id = ? LIMIT 1', [id])
    if (!rows.length || (user.role === 'instructor' && Number(rows[0].assigned_instructor_id) !== user.instructorId)) throw new HttpError(404, 'booking_not_found', 'Booking not found.')
    const [result] = await connection.execute('INSERT INTO booking_notes (booking_id, author_id, note) VALUES (?, ?, ?)', [id, user.id, note])
    return { id: Number(result.insertId), note }
  })
}

export async function listInstructors() {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT i.id, i.display_name, i.email, i.whatsapp, i.active, i.selectable_by_guests,
              u.id AS user_id, u.email AS account_email, u.active AS account_active
       FROM instructors i LEFT JOIN admin_users u ON u.instructor_id = i.id ORDER BY i.active DESC, i.display_name`,
    )
    const [schedules] = await connection.execute(
      `SELECT w.id, w.instructor_id, w.weekday, w.starts_at, w.ends_at, w.effective_from, w.effective_until
       FROM weekly_availability w ORDER BY w.instructor_id, w.weekday, w.starts_at`,
    )
    return rows.map((row) => ({
      id: Number(row.id), displayName: row.display_name, email: row.email || '', whatsapp: row.whatsapp || '', active: Boolean(row.active), selectableByGuests: Boolean(row.selectable_by_guests),
      account: row.user_id ? { id: Number(row.user_id), email: row.account_email, active: Boolean(row.account_active) } : null,
      weeklyAvailability: schedules.filter((schedule) => Number(schedule.instructor_id) === Number(row.id)).map((schedule) => ({ id: Number(schedule.id), weekday: Number(schedule.weekday), startsAt: String(schedule.starts_at).slice(0, 5), endsAt: String(schedule.ends_at).slice(0, 5), effectiveFrom: schedule.effective_from ? String(schedule.effective_from).slice(0, 10) : null, effectiveUntil: schedule.effective_until ? String(schedule.effective_until).slice(0, 10) : null })),
    }))
  })
}

export async function saveInstructor(input, id = null) {
  const displayName = cleanText(input.displayName, 120, 'instructor name', { required: true })
  const email = input.email ? normalizeEmail(input.email) : null
  const whatsapp = input.whatsapp ? cleanText(input.whatsapp, 32, 'WhatsApp', { required: false }) : null
  const active = input.active === undefined ? true : Boolean(input.active)
  const selectable = Boolean(input.selectableByGuests)
  if (id) return inTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT id FROM instructors WHERE id = ? FOR UPDATE', [id])
    if (!rows.length) throw new HttpError(404, 'instructor_not_found', 'Instructor not found.')
    if (!active) {
      const today = DateTime.now().setZone(ZONE).toISODate()
      const [bookings] = await connection.execute(
        `SELECT id FROM bookings WHERE assigned_instructor_id = ? AND local_date >= ?
         AND status IN (${ACTIVE_PLACEHOLDERS}) LIMIT 1 FOR UPDATE`,
        [id, today, ...ACTIVE_BOOKING_STATUSES],
      )
      if (bookings.length) throw new HttpError(409, 'instructor_has_bookings', 'Reassign or cancel this instructor’s future active bookings before deactivating the profile.')
    }
    await connection.execute('UPDATE instructors SET display_name = ?, email = ?, whatsapp = ?, active = ?, selectable_by_guests = ? WHERE id = ?', [displayName, email, whatsapp, active ? 1 : 0, selectable ? 1 : 0, id])
    if (!active) {
      await connection.execute('UPDATE admin_users SET active = 0 WHERE instructor_id = ?', [id])
      await connection.execute('DELETE s FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE u.instructor_id = ?', [id])
    }
    return { id: Number(id), displayName, email: email || '', whatsapp: whatsapp || '', active, selectableByGuests: selectable }
  })
  return withConnection(async (connection) => {
    const [result] = await connection.execute('INSERT INTO instructors (display_name, email, whatsapp, active, selectable_by_guests) VALUES (?, ?, ?, ?, ?)', [displayName, email, whatsapp, active ? 1 : 0, selectable ? 1 : 0])
    return { id: Number(result.insertId), displayName, email: email || '', whatsapp: whatsapp || '', active, selectableByGuests: selectable }
  })
}

function scheduleCoversBooking(entry, booking) {
  if (Number(entry.weekday) !== getWeekday(String(booking.local_date).slice(0, 10))) return false
  const date = String(booking.local_date).slice(0, 10)
  if (entry.effectiveFrom && date < entry.effectiveFrom) return false
  if (entry.effectiveUntil && date > entry.effectiveUntil) return false
  const start = DateTime.fromSQL(String(booking.starts_at_utc), { zone: 'UTC' }).setZone(ZONE)
  const end = DateTime.fromSQL(String(booking.ends_at_utc), { zone: 'UTC' }).setZone(ZONE)
  if (!start.isValid || !end.isValid) return false
  const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  return toMinutes(start.toFormat('HH:mm')) >= toMinutes(entry.startsAt) && toMinutes(end.toFormat('HH:mm')) <= toMinutes(entry.endsAt)
}

export async function saveWeeklyAvailability(instructorId, entries) {
  if (!Array.isArray(entries) || entries.length > 7) throw new HttpError(400, 'invalid_schedule', 'Provide up to one weekly shift for each day.')
  const normalized = entries.map((entry) => {
    const weekday = Number(entry.weekday)
    const startsAt = String(entry.startsAt || '')
    const endsAt = String(entry.endsAt || '')
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !/^\d{2}:\d{2}$/.test(startsAt) || !/^\d{2}:\d{2}$/.test(endsAt) || startsAt < '09:00' || endsAt > '17:00' || startsAt >= endsAt) throw new HttpError(400, 'invalid_schedule', 'Shifts must be valid and remain within 09:00–17:00 Serbia time.')
    return { weekday, startsAt, endsAt }
  })
  if (new Set(normalized.map((entry) => entry.weekday)).size !== normalized.length) throw new HttpError(400, 'duplicate_weekday', 'Use only one shift per instructor per weekday.')
  return inTransaction(async (connection) => {
    const [instructors] = await connection.execute('SELECT id FROM instructors WHERE id = ? AND active = 1 FOR UPDATE', [instructorId])
    if (!instructors.length) throw new HttpError(404, 'instructor_not_found', 'Active instructor not found.')
    const today = DateTime.now().setZone(ZONE).toISODate()
    const [bookings] = await connection.execute(
      `SELECT id, local_date, starts_at_utc, ends_at_utc FROM bookings
       WHERE assigned_instructor_id = ? AND local_date >= ? AND status IN (${ACTIVE_PLACEHOLDERS}) FOR UPDATE`,
      [instructorId, today, ...ACTIVE_BOOKING_STATUSES],
    )
    if (bookings.some((booking) => !normalized.some((entry) => scheduleCoversBooking(entry, booking)))) throw new HttpError(409, 'schedule_conflict', 'This schedule would leave an existing booking outside the instructor’s working hours. Resolve those bookings first.')
    await connection.execute('DELETE FROM weekly_availability WHERE instructor_id = ?', [instructorId])
    for (const entry of normalized) {
      await connection.execute('INSERT INTO weekly_availability (instructor_id, weekday, starts_at, ends_at) VALUES (?, ?, ?, ?)', [instructorId, entry.weekday, `${entry.startsAt}:00`, `${entry.endsAt}:00`])
    }
    return { instructorId, weeklyAvailability: normalized }
  })
}

export async function listExceptions(from, to, user) {
  if (!validDate(from) || !validDate(to) || to < from) throw new HttpError(400, 'invalid_range', 'Choose a valid date range.')
  return withConnection(async (connection) => {
    let where = 'e.local_date BETWEEN ? AND ?'
    const params = [from, to]
    if (user.role === 'instructor') {
      where += ' AND (e.instructor_id IS NULL OR e.instructor_id = ?)'
      params.push(user.instructorId || 0)
    }
    const [rows] = await connection.execute(
      `SELECT e.id, e.instructor_id, e.local_date, e.starts_at, e.ends_at, e.kind, e.label,
              i.display_name, u.display_name AS created_by_name
       FROM availability_exceptions e LEFT JOIN instructors i ON i.id = e.instructor_id
       JOIN admin_users u ON u.id = e.created_by WHERE ${where} ORDER BY e.local_date, e.starts_at`, params,
    )
    return rows.map((row) => ({ id: Number(row.id), instructorId: row.instructor_id == null ? null : Number(row.instructor_id), instructorName: row.display_name || null, localDate: String(row.local_date).slice(0, 10), startsAt: row.starts_at ? String(row.starts_at).slice(0, 5) : null, endsAt: row.ends_at ? String(row.ends_at).slice(0, 5) : null, kind: row.kind, label: row.label, createdBy: row.created_by_name }))
  })
}

export async function createException(input, user) {
  const instructorId = input.instructorId == null || input.instructorId === '' ? null : Number(input.instructorId)
  const localDate = String(input.localDate || '')
  const label = cleanText(input.label, 160, 'label', { required: true })
  if (!validDate(localDate)) throw new HttpError(400, 'invalid_date', 'Choose a valid exception date.')
  if (instructorId !== null && (!Number.isSafeInteger(instructorId) || instructorId < 1)) throw new HttpError(400, 'invalid_instructor', 'Choose a valid instructor or academy closure.')
  const startsAt = input.startsAt ? String(input.startsAt) : null
  const endsAt = input.endsAt ? String(input.endsAt) : null
  if ((startsAt === null) !== (endsAt === null) || (startsAt && (!/^\d{2}:\d{2}$/.test(startsAt) || !/^\d{2}:\d{2}$/.test(endsAt) || startsAt < '09:00' || endsAt > '17:00' || startsAt >= endsAt))) throw new HttpError(400, 'invalid_exception_time', 'Choose a valid time range within 09:00–17:00, or leave both times empty for a full day.')
  const kind = instructorId === null ? 'closure' : 'time_off'
  return inTransaction(async (connection) => {
    if (instructorId !== null) {
      const [instructors] = await connection.execute('SELECT id FROM instructors WHERE id = ? FOR UPDATE', [instructorId])
      if (!instructors.length) throw new HttpError(404, 'instructor_not_found', 'Instructor not found.')
    } else {
      await connection.execute('SELECT id FROM instructors WHERE active = 1 ORDER BY id FOR UPDATE')
    }
    const [bookings] = instructorId === null
      ? await connection.execute(`SELECT id FROM bookings WHERE local_date = ? AND status IN (${ACTIVE_PLACEHOLDERS}) FOR UPDATE`, [localDate, ...ACTIVE_BOOKING_STATUSES])
      : await connection.execute(`SELECT id FROM bookings WHERE local_date = ? AND assigned_instructor_id = ? AND status IN (${ACTIVE_PLACEHOLDERS}) FOR UPDATE`, [localDate, instructorId, ...ACTIVE_BOOKING_STATUSES])
    if (bookings.length && !startsAt) throw new HttpError(409, 'exception_conflict', 'Existing bookings use this date. Move or cancel them before blocking the full day.')
    if (bookings.length && startsAt) throw new HttpError(409, 'exception_conflict', 'This date has existing lesson bookings. Resolve them before adding a time-off interval.')
    const [result] = await connection.execute(
      'INSERT INTO availability_exceptions (instructor_id, local_date, starts_at, ends_at, kind, label, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [instructorId, localDate, startsAt ? `${startsAt}:00` : null, endsAt ? `${endsAt}:00` : null, kind, label, user.id],
    )
    return { id: Number(result.insertId), instructorId, localDate, startsAt, endsAt, kind, label }
  })
}

export async function deleteException(id) {
  return withConnection(async (connection) => {
    const [result] = await connection.execute('DELETE FROM availability_exceptions WHERE id = ?', [id])
    if (!result.affectedRows) throw new HttpError(404, 'exception_not_found', 'Availability exception not found.')
    return { ok: true }
  })
}

export async function getAdminSettings() {
  return withConnection(async (connection) => {
    const settings = await getBusinessSettings(connection)
    const [formatRows] = await connection.execute('SELECT code, lesson_type AS lessonType, label, duration_minutes AS durationMinutes, max_participants AS maxParticipants, capacity_confirmed AS capacityConfirmed, active, bookable_online AS bookableOnline FROM lesson_formats ORDER BY lesson_type, duration_minutes, code')
    const [counts] = await connection.execute('SELECT (SELECT COUNT(*) FROM instructors WHERE active = 1) AS instructors, (SELECT COUNT(DISTINCT w.instructor_id) FROM weekly_availability w JOIN instructors i ON i.id = w.instructor_id WHERE i.active = 1) AS scheduledInstructors')
    const formats = formatRows.map((row) => ({ ...row, active: Boolean(row.active), bookableOnline: Boolean(row.bookableOnline), capacityConfirmed: Boolean(row.capacityConfirmed) }))
    return { ...settings, readiness: { activeInstructors: Number(counts[0].instructors), scheduledInstructors: Number(counts[0].scheduledInstructors) }, formats }
  })
}

export async function getEmailStatus() {
  const counts = await withConnection(async (connection) => {
    const [rows] = await connection.execute('SELECT delivery_status, COUNT(*) AS total FROM email_outbox GROUP BY delivery_status')
    return Object.fromEntries(rows.map((row) => [row.delivery_status, Number(row.total)]))
  })
  const senderConfigured = Boolean(process.env.RESEND_FROM_EMAIL)
  return {
    configured: Boolean(process.env.RESEND_API_KEY && senderConfigured),
    senderConfigured,
    pending: counts.pending || 0,
    failed: counts.failed || 0,
    notConfigured: counts.not_configured || 0,
    sent: counts.sent || 0,
  }
}

export async function updateAdminSettings(input) {
  const seasonStart = input.seasonStart ? String(input.seasonStart) : null
  const seasonEnd = input.seasonEnd ? String(input.seasonEnd) : null
  const turnaroundMinutes = Number(input.turnaroundMinutes)
  const publicBookingEnabled = Boolean(input.publicBookingEnabled)
  if (seasonStart && !validDate(seasonStart) || seasonEnd && !validDate(seasonEnd) || Boolean(seasonStart) !== Boolean(seasonEnd) || (seasonStart && seasonEnd < seasonStart)) throw new HttpError(400, 'invalid_season', 'Choose a valid season start and end date.')
  if (!Number.isInteger(turnaroundMinutes) || turnaroundMinutes < 0 || turnaroundMinutes > 60) throw new HttpError(400, 'invalid_buffer', 'Turnaround buffer must be between 0 and 60 minutes.')
  return inTransaction(async (connection) => {
    const [currentRows] = await connection.execute('SELECT * FROM app_settings WHERE id = 1 FOR UPDATE')
    const current = currentRows[0]
    if (!current) throw new HttpError(503, 'settings_unavailable', 'Business settings are not ready.')
    if (publicBookingEnabled) {
      if (!seasonStart || !seasonEnd) throw new HttpError(409, 'season_required', 'Set both season dates before opening public booking.')
      const [readyRows] = await connection.execute(
        `SELECT COUNT(DISTINCT i.id) AS ready_instructors FROM instructors i
         JOIN weekly_availability w ON w.instructor_id = i.id
         WHERE i.active = 1 AND w.starts_at >= '09:00:00' AND w.ends_at <= '17:00:00'
         AND (w.effective_from IS NULL OR w.effective_from <= ?)
         AND (w.effective_until IS NULL OR w.effective_until >= ?)`, [seasonEnd, seasonStart],
      )
      const [formatRows] = await connection.execute('SELECT COUNT(*) AS total, SUM(capacity_confirmed = 1) AS confirmed FROM lesson_formats WHERE active = 1 AND bookable_online = 1 AND max_participants > 0')
      if (Number(readyRows[0].ready_instructors) < 1 || Number(formatRows[0].total) < 1) throw new HttpError(409, 'schedule_required', 'Add at least one real instructor schedule and one active online lesson format before opening public booking.')
      if (Number(formatRows[0].confirmed) !== Number(formatRows[0].total)) throw new HttpError(409, 'capacity_confirmation_required', 'Confirm the real participant maximum for every active online format before opening public booking.')
    }
    if (seasonStart && seasonEnd) {
      const [outside] = await connection.execute(
        `SELECT COUNT(*) AS total FROM bookings WHERE status IN (${ACTIVE_PLACEHOLDERS})
         AND (local_date < ? OR local_date > ?)`, [...ACTIVE_BOOKING_STATUSES, seasonStart, seasonEnd],
      )
      if (Number(outside[0].total) > 0) throw new HttpError(409, 'season_conflict', 'The new season dates exclude existing active bookings. Resolve those bookings first.')
    }
    await connection.execute('UPDATE app_settings SET season_start = ?, season_end = ?, turnaround_minutes = ?, public_booking_enabled = ? WHERE id = 1', [seasonStart, seasonEnd, turnaroundMinutes, publicBookingEnabled ? 1 : 0])
    return { timezone: ZONE, openingTime: '09:00', closingTime: '17:00', seasonStart, seasonEnd, turnaroundMinutes, publicBookingEnabled }
  })
}

export async function updateLessonFormat(code, input) {
  const maxParticipants = Number(input.maxParticipants)
  const active = Boolean(input.active)
  const bookableOnline = Boolean(input.bookableOnline)
  const capacityConfirmed = Boolean(input.capacityConfirmed)
  if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 30) throw new HttpError(400, 'invalid_capacity', 'Maximum participants must be between 1 and 30.')
  return inTransaction(async (connection) => {
    const [settingRows] = await connection.execute('SELECT public_booking_enabled FROM app_settings WHERE id = 1 FOR UPDATE')
    const wasOpen = Boolean(settingRows[0]?.public_booking_enabled)
    const [result] = await connection.execute('UPDATE lesson_formats SET max_participants = ?, active = ?, bookable_online = ?, capacity_confirmed = ? WHERE code = ?', [maxParticipants, active ? 1 : 0, bookableOnline ? 1 : 0, capacityConfirmed ? 1 : 0, code])
    if (!result.affectedRows) throw new HttpError(404, 'lesson_format_not_found', 'Lesson format not found.')
    const closedPublicBooking = wasOpen && active && bookableOnline && !capacityConfirmed
    if (closedPublicBooking) await connection.execute('UPDATE app_settings SET public_booking_enabled = 0 WHERE id = 1')
    return { code, maxParticipants, active, bookableOnline, capacityConfirmed, publicBookingEnabled: wasOpen && !closedPublicBooking }
  })
}

export async function createStaffUser(input, actor) {
  const email = normalizeEmail(input.email)
  const displayName = cleanText(input.displayName, 120, 'name', { required: true })
  const role = String(input.role || '')
  if (!['admin', 'instructor'].includes(role)) throw new HttpError(400, 'invalid_role', 'Choose admin or instructor role.')
  if (role === 'admin' && actor.role !== 'owner') throw new HttpError(403, 'owner_required', 'Only the owner can create another admin account.')
  const instructorId = role === 'instructor' ? Number(input.instructorId) : null
  if (role === 'instructor' && (!Number.isSafeInteger(instructorId) || instructorId < 1)) throw new HttpError(400, 'instructor_required', 'Link this account to an instructor profile.')
  const password = String(input.initialPassword || '')
  if (password.length < 12 || password.length > 256) throw new HttpError(400, 'weak_password', 'Set a temporary password of at least 12 characters and share it securely.')
  const passwordHash = await hashPassword(password)
  return withConnection(async (connection) => {
    if (instructorId) {
      const [rows] = await connection.execute('SELECT id FROM instructors WHERE id = ? AND active = 1 LIMIT 1', [instructorId])
      if (!rows.length) throw new HttpError(400, 'instructor_required', 'Choose an active instructor profile.')
    }
    const [result] = await connection.execute('INSERT INTO admin_users (email, display_name, password_hash, role, instructor_id, active, must_change_password) VALUES (?, ?, ?, ?, ?, 1, 1)', [email, displayName, passwordHash, role, instructorId])
    return { id: Number(result.insertId), email, displayName, role, instructorId }
  })
}

export async function listUsers(user) {
  return withConnection(async (connection) => {
    let where = ''
    let params = []
    if (user.role === 'instructor') {
      where = 'WHERE id = ?'; params = [user.id]
    }
    const [rows] = await connection.execute(`SELECT id, email, display_name, role, instructor_id, active, must_change_password, created_at FROM admin_users ${where} ORDER BY role, display_name`, params)
    return rows.map((row) => ({ id: Number(row.id), email: row.email, displayName: row.display_name, role: row.role, instructorId: row.instructor_id == null ? null : Number(row.instructor_id), active: Boolean(row.active), mustChangePassword: Boolean(row.must_change_password), createdAt: String(row.created_at) }))
  })
}

export async function updateStaffUser(id, input, actor) {
  if (id === actor.id) throw new HttpError(409, 'self_deactivation_blocked', 'Use the account page to change your own password; another owner must manage your account.')
  const active = Boolean(input.active)
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT id, role FROM admin_users WHERE id = ? FOR UPDATE', [id])
    if (!rows.length) throw new HttpError(404, 'user_not_found', 'Staff account not found.')
    if (rows[0].role === 'owner' && actor.role !== 'owner') throw new HttpError(403, 'owner_required', 'Only the owner can manage the owner account.')
    await connection.execute('UPDATE admin_users SET active = ? WHERE id = ?', [active ? 1 : 0, id])
    if (!active) await connection.execute('DELETE FROM admin_sessions WHERE user_id = ?', [id])
    return { id, active }
  })
}

export async function getDashboardSummary(user) {
  const bookings = await listBookings({ from: DateTime.now().setZone(ZONE).toISODate(), limit: 200 }, user)
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]))
  for (const booking of bookings) counts[booking.status] = (counts[booking.status] || 0) + 1
  return { today: DateTime.now().setZone(ZONE).toISODate(), counts, upcoming: bookings.slice(0, 12) }
}

function csvCell(value) {
  let text = String(value ?? '').replace(/[\r\n]+/g, ' ')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export async function exportBookingsCsv(filters, user) {
  const rows = await listBookings({ ...filters, limit: 500 }, user)
  const header = ['Booking ID', 'Guest name', 'Email', 'WhatsApp', 'Date (Europe/Belgrade)', 'Start (Europe/Belgrade)', 'End (Europe/Belgrade)', 'Lesson type', 'Lesson format', 'Participants', 'Skill level', 'Preferred source', 'Assigned instructor', 'Status', 'Created at UTC']
  const values = rows.map((row) => [row.id, row.fullName, row.email, row.whatsapp, row.localDate, row.startTime, row.endTime, row.lessonType, row.formatLabel, row.participants, row.skillLevel, row.source, row.instructorName, row.status, row.createdAt])
  return [header, ...values].map((record) => record.map(csvCell).join(',')).join('\r\n')
}
