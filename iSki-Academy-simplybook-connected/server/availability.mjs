import { DateTime } from 'luxon'
import { ACTIVE_BOOKING_STATUSES, getWeekday, isInstructorAvailable, makeCandidates } from './availability-core.mjs'
import { HttpError } from './validation.mjs'
import { withConnection } from './db.mjs'

const ZONE = 'Europe/Belgrade'
const SLOT_STATUS_SQL = ACTIVE_BOOKING_STATUSES.map(() => '?').join(', ')

function settingFromRow(row) {
  if (!row) return null
  return {
    timezone: row.timezone,
    openingTime: String(row.opening_time).slice(0, 5),
    closingTime: String(row.closing_time).slice(0, 5),
    seasonStart: row.season_start ? String(row.season_start).slice(0, 10) : null,
    seasonEnd: row.season_end ? String(row.season_end).slice(0, 10) : null,
    turnaroundMinutes: Number(row.turnaround_minutes || 0),
    publicBookingEnabled: Boolean(row.public_booking_enabled),
  }
}

export async function getBusinessSettings(connection = null) {
  const run = async (conn) => {
    const [rows] = await conn.execute('SELECT * FROM app_settings WHERE id = 1 LIMIT 1')
    return settingFromRow(rows[0])
  }
  return connection ? run(connection) : withConnection(run)
}

export async function getPublicBootstrap() {
  return withConnection(async (connection) => {
    const settings = await getBusinessSettings(connection)
    const [formats] = await connection.execute(
      'SELECT code, lesson_type AS lessonType, label, duration_minutes AS durationMinutes, CASE WHEN ? = 1 THEN max_participants ELSE 0 END AS maxParticipants FROM lesson_formats WHERE active = 1 AND bookable_online = 1 ORDER BY lesson_type, duration_minutes, code',
      [settings?.publicBookingEnabled ? 1 : 0],
    )
    const [instructors] = await connection.execute(
      'SELECT id, display_name AS displayName FROM instructors WHERE active = 1 AND selectable_by_guests = 1 ORDER BY display_name',
    )
    return {
      timezone: ZONE,
      openingTime: settings?.openingTime || '09:00',
      closingTime: settings?.closingTime || '17:00',
      bookingOpen: Boolean(settings?.publicBookingEnabled && settings.seasonStart && settings.seasonEnd),
      seasonStart: settings?.seasonStart || null,
      seasonEnd: settings?.seasonEnd || null,
      formats,
      instructors: instructors.map((item) => ({ id: Number(item.id), displayName: item.displayName })),
    }
  })
}

function dateRange(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) throw new HttpError(400, 'invalid_range', 'Choose a valid calendar month.')
  const start = DateTime.fromISO(from, { zone: ZONE })
  const end = DateTime.fromISO(to, { zone: ZONE })
  if (!start.isValid || !end.isValid || end < start || end.diff(start, 'days').days > 31) throw new HttpError(400, 'invalid_range', 'Choose no more than 32 calendar days at a time.')
  return { start, end }
}

export async function getPublicAvailability({ from, to, formatCode, preferredInstructorId = null }) {
  const { start, end } = dateRange(from, to)
  return withConnection(async (connection) => {
    const settings = await getBusinessSettings(connection)
    const [formats] = await connection.execute('SELECT * FROM lesson_formats WHERE code = ? AND active = 1 AND bookable_online = 1 LIMIT 1', [formatCode])
    if (!formats.length) throw new HttpError(400, 'invalid_lesson_format', 'Choose a currently bookable lesson format.')
    const format = formats[0]
    const [allInstructors] = await connection.execute('SELECT id FROM instructors WHERE active = 1 ORDER BY id')
    const selectedId = preferredInstructorId == null || preferredInstructorId === '' ? null : Number(preferredInstructorId)
    if (selectedId !== null && !allInstructors.some((row) => Number(row.id) === selectedId)) throw new HttpError(400, 'invalid_instructor', 'Choose a currently bookable instructor preference.')
    const [publicPreference] = await connection.execute('SELECT id FROM instructors WHERE id = ? AND active = 1 AND selectable_by_guests = 1 LIMIT 1', [selectedId || 0])
    if (selectedId && !publicPreference.length) throw new HttpError(400, 'invalid_instructor', 'That instructor is not selectable for online requests.')
    const instructors = selectedId ? allInstructors.filter((row) => Number(row.id) === selectedId) : allInstructors
    const settingsReady = Boolean(settings?.publicBookingEnabled && settings.seasonStart && settings.seasonEnd && instructors.length)
    const emptyDays = []
    if (!settingsReady) {
      for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) emptyDays.push({ date: cursor.toISODate(), slots: [] })
      return { enabled: false, reason: 'not_configured', timezone: ZONE, seasonStart: settings?.seasonStart, seasonEnd: settings?.seasonEnd, days: emptyDays }
    }

    const instructorIds = instructors.map((row) => Number(row.id))
    const placeholders = instructorIds.map(() => '?').join(',')
    const [schedules] = await connection.execute(
      `SELECT instructor_id, weekday, starts_at, ends_at, effective_from, effective_until
       FROM weekly_availability WHERE instructor_id IN (${placeholders})
       AND (effective_from IS NULL OR effective_from <= ?) AND (effective_until IS NULL OR effective_until >= ?)`,
      [...instructorIds, to, from],
    )
    const [exceptions] = await connection.execute(
      `SELECT instructor_id, local_date, starts_at, ends_at, kind
       FROM availability_exceptions WHERE local_date BETWEEN ? AND ?
       AND (instructor_id IS NULL OR instructor_id IN (${placeholders}))`, [from, to, ...instructorIds],
    )
    const [bookings] = await connection.execute(
      `SELECT assigned_instructor_id, local_date, starts_at_utc, ends_at_utc, status
       FROM bookings WHERE local_date BETWEEN ? AND ? AND status IN (${SLOT_STATUS_SQL})`,
      [from, to, ...ACTIVE_BOOKING_STATUSES],
    )

    const days = []
    const now = DateTime.utc()
    for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
      const localDate = cursor.toISODate()
      const withinSeason = localDate >= settings.seasonStart && localDate <= settings.seasonEnd
      if (!withinSeason) {
        days.push({ date: localDate, slots: [] })
        continue
      }
      const weekday = getWeekday(localDate)
      const candidates = makeCandidates(localDate, Number(format.duration_minutes), settings, now)
      const slots = candidates.map((slot) => {
        const availableInstructors = instructors.filter((instructor) => isInstructorAvailable({
          instructorId: instructor.id,
          weekday,
          localDate,
          slot,
          schedules,
          exceptions,
          bookings,
          bufferMinutes: settings.turnaroundMinutes,
        })).length
        return { startTime: slot.startLocal, endTime: slot.endLocal, availableInstructors }
      }).filter((slot) => slot.availableInstructors > 0)
      days.push({ date: localDate, slots })
    }
    return { enabled: true, timezone: ZONE, seasonStart: settings.seasonStart, seasonEnd: settings.seasonEnd, days }
  })
}

export { SLOT_STATUS_SQL }
