import { DateTime } from 'luxon'

export const BUSINESS_TIMEZONE = 'Europe/Belgrade'
export const ACTIVE_BOOKING_STATUSES = ['New', 'Contacted', 'Confirmed', 'Deposit Paid', 'Completed']

export function isIsoLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = DateTime.fromISO(value, { zone: BUSINESS_TIMEZONE })
  return date.isValid && date.toISODate() === value
}

export function timeToMinutes(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return NaN
  const [hours, minutes] = value.split(':').map(Number)
  if (hours > 23 || minutes > 59) return NaN
  return hours * 60 + minutes
}

function sqlUtc(value) {
  return value.toUTC().toFormat("yyyy-LL-dd HH:mm:ss.SSS")
}

function localTime(date, minutes, zone) {
  return DateTime.fromObject({
    year: date.year,
    month: date.month,
    day: date.day,
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
    second: 0,
    millisecond: 0,
  }, { zone })
}

export function makeCandidates(localDate, durationMinutes, settings = {}, now = DateTime.utc()) {
  const zone = settings.timezone || BUSINESS_TIMEZONE
  const date = DateTime.fromISO(localDate, { zone })
  if (!date.isValid || date.toISODate() !== localDate) return []
  const openMinute = timeToMinutes(settings.openingTime || '09:00')
  const closeMinute = timeToMinutes(settings.closingTime || '17:00')
  const buffer = Number(settings.turnaroundMinutes || 0)
  if (!Number.isFinite(openMinute) || !Number.isFinite(closeMinute) || durationMinutes <= 0 || buffer < 0) return []

  const slots = []
  for (let minute = openMinute; minute < closeMinute; minute += 60) {
    const start = localTime(date, minute, zone)
    if (!start.isValid) continue
    const end = start.plus({ minutes: durationMinutes })
    const blockedEnd = end.plus({ minutes: buffer })
    if (!end.isValid || !blockedEnd.isValid || end.toISODate() !== localDate || blockedEnd.toISODate() !== localDate) continue
    const blockedEndMinutes = blockedEnd.hour * 60 + blockedEnd.minute + (blockedEnd.second ? 1 : 0)
    if (blockedEndMinutes > closeMinute || start.toUTC().toMillis() <= now.toUTC().toMillis()) continue
    slots.push({
      localDate,
      startLocal: start.toFormat('HH:mm'),
      endLocal: end.toFormat('HH:mm'),
      startUtc: sqlUtc(start),
      endUtc: sqlUtc(end),
      blockedEndUtc: sqlUtc(blockedEnd),
      startMillis: start.toUTC().toMillis(),
      endMillis: end.toUTC().toMillis(),
      blockedEndMillis: blockedEnd.toUTC().toMillis(),
    })
  }
  return slots
}

function dateInInclusiveRange(date, start, end) {
  return (!start || date >= String(start).slice(0, 10)) && (!end || date <= String(end).slice(0, 10))
}

function shiftCovers(shift, date, slot, bufferMinutes) {
  if (!dateInInclusiveRange(date, shift.effective_from, shift.effective_until)) return false
  const start = timeToMinutes(String(shift.starts_at).slice(0, 5))
  const end = timeToMinutes(String(shift.ends_at).slice(0, 5))
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  const slotStart = Number(slot.startLocal.slice(0, 2)) * 60 + Number(slot.startLocal.slice(3, 5))
  const slotEnd = Number(slot.endLocal.slice(0, 2)) * 60 + Number(slot.endLocal.slice(3, 5)) + bufferMinutes
  return slotStart >= start && slotEnd <= end
}

function exceptionBlocks(exception, localDate, slot) {
  if (String(exception.local_date).slice(0, 10) !== localDate) return false
  if (!exception.starts_at || !exception.ends_at) return true
  const start = timeToMinutes(String(exception.starts_at).slice(0, 5))
  const end = timeToMinutes(String(exception.ends_at).slice(0, 5))
  const slotStart = Number(slot.startLocal.slice(0, 2)) * 60 + Number(slot.startLocal.slice(3, 5))
  const slotEnd = Number(slot.endLocal.slice(0, 2)) * 60 + Number(slot.endLocal.slice(3, 5))
  return start < slotEnd && end > slotStart
}

function bookingOverlaps(booking, slot, bufferMinutes) {
  const start = DateTime.fromSQL(String(booking.starts_at_utc), { zone: 'UTC' }).toMillis()
  const end = DateTime.fromSQL(String(booking.ends_at_utc), { zone: 'UTC' }).plus({ minutes: bufferMinutes }).toMillis()
  return Number.isFinite(start) && Number.isFinite(end) && start < slot.blockedEndMillis && end > slot.startMillis
}

export function isInstructorAvailable({ instructorId, weekday, localDate, slot, schedules, exceptions, bookings, bufferMinutes = 0 }) {
  const shifts = schedules.filter((row) => Number(row.instructor_id) === Number(instructorId) && Number(row.weekday) === Number(weekday))
  if (!shifts.some((shift) => shiftCovers(shift, localDate, slot, bufferMinutes))) return false

  if (exceptions.some((exception) => {
    const appliesToInstructor = exception.instructor_id == null || Number(exception.instructor_id) === Number(instructorId)
    return appliesToInstructor && exceptionBlocks(exception, localDate, slot)
  })) return false

  return !bookings.some((booking) => Number(booking.assigned_instructor_id) === Number(instructorId)
    && ACTIVE_BOOKING_STATUSES.includes(booking.status)
    && bookingOverlaps(booking, slot, bufferMinutes))
}

export function getWeekday(localDate) {
  return DateTime.fromISO(localDate, { zone: BUSINESS_TIMEZONE }).weekday
}
