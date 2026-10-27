import assert from 'node:assert/strict'
import test from 'node:test'
import { DateTime } from 'luxon'
import {
  ACTIVE_BOOKING_STATUSES,
  BUSINESS_TIMEZONE,
  getWeekday,
  isInstructorAvailable,
  isIsoLocalDate,
  makeCandidates,
  timeToMinutes,
} from '../server/availability-core.mjs'
import { hashPassword, newOpaqueToken, sessionCookie, verifyPassword } from '../server/security.mjs'

const future = DateTime.utc(2026, 1, 1)
const businessHours = { timezone: BUSINESS_TIMEZONE, openingTime: '09:00', closingTime: '17:00', turnaroundMinutes: 0 }

test('calendar candidates use one-hour starts and never end after the 17:00 close', () => {
  const oneHour = makeCandidates('2026-12-10', 60, businessHours, future)
  assert.deepEqual(oneHour.map((slot) => slot.startLocal), ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'])
  assert.equal(oneHour.at(-1).endLocal, '17:00')

  const ninetyMinutes = makeCandidates('2026-12-10', 90, businessHours, future)
  assert.deepEqual(ninetyMinutes.map((slot) => slot.startLocal), ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'])
  assert.equal(ninetyMinutes.at(-1).endLocal, '16:30')

  const fourHours = makeCandidates('2026-12-10', 240, businessHours, future)
  assert.deepEqual(fourHours.map((slot) => slot.startLocal), ['09:00', '10:00', '11:00', '12:00', '13:00'])
  assert.equal(fourHours.at(-1).endLocal, '17:00')
})

test('Serbia calendar slots keep local 09:00 while UTC instants follow seasonal offsets', () => {
  const winter = makeCandidates('2027-01-15', 60, businessHours, future)[0]
  const summer = makeCandidates('2027-07-15', 60, businessHours, future)[0]
  assert.equal(winter.startLocal, '09:00')
  assert.equal(winter.startUtc, '2027-01-15 08:00:00.000')
  assert.equal(summer.startLocal, '09:00')
  assert.equal(summer.startUtc, '2027-07-15 07:00:00.000')
})

test('instructor shifts must cover the full requested duration; overlapping bookings block the coach', () => {
  const localDate = '2026-12-10'
  const slot = makeCandidates(localDate, 90, businessHours, future).find((candidate) => candidate.startLocal === '10:00')
  const schedules = [{ instructor_id: 7, weekday: getWeekday(localDate), starts_at: '09:00:00', ends_at: '17:00:00', effective_from: null, effective_until: null }]
  const base = { instructorId: 7, weekday: getWeekday(localDate), localDate, slot, schedules, exceptions: [], bookings: [] }
  assert.equal(isInstructorAvailable(base), true)

  const adjacent = { assigned_instructor_id: 7, status: 'Confirmed', starts_at_utc: '2026-12-10 08:00:00.000', ends_at_utc: '2026-12-10 09:00:00.000' }
  assert.equal(isInstructorAvailable({ ...base, bookings: [adjacent] }), true, 'a booking ending exactly at this start is not an overlap')

  const overlapping = { assigned_instructor_id: 7, status: 'New', starts_at_utc: '2026-12-10 09:30:00.000', ends_at_utc: '2026-12-10 10:30:00.000' }
  assert.equal(isInstructorAvailable({ ...base, bookings: [overlapping] }), false)
  const cancelled = { ...overlapping, status: 'Cancelled' }
  assert.equal(isInstructorAvailable({ ...base, bookings: [cancelled] }), true)
  assert.ok(ACTIVE_BOOKING_STATUSES.includes('New'))
  assert.ok(!ACTIVE_BOOKING_STATUSES.includes('Cancelled'))
})

test('local date and time validators reject impossible dates and out-of-range clock times', () => {
  assert.equal(isIsoLocalDate('2027-02-29'), false)
  assert.equal(isIsoLocalDate('2028-02-29'), true)
  assert.equal(timeToMinutes('17:00'), 1020)
  assert.ok(Number.isNaN(timeToMinutes('24:00')))
})

test('scrypt password hashes verify correctly and opaque tokens are URL-safe', async () => {
  const password = 'a-private-test-password-2026'
  const encoded = await hashPassword(password)
  assert.match(encoded, /^scrypt\$32768\$8\$1\$/)
  assert.equal(await verifyPassword(password, encoded), true)
  assert.equal(await verifyPassword(`${password}!`, encoded), false)
  assert.match(newOpaqueToken(), /^[A-Za-z0-9_-]{43}$/)
})

test('HTTPS Preview cookies stay Secure and SameSite=None; plain localhost is separately opted in', () => {
  const previous = process.env.ISKI_ALLOW_LOCAL_HTTP_AUTH
  try {
    process.env.ISKI_ALLOW_LOCAL_HTTP_AUTH = 'false'
    const previewCookie = sessionCookie(new Request('https://iski-preview.example/admin'), 'opaque')
    assert.match(previewCookie, /HttpOnly/)
    assert.match(previewCookie, /Secure/)
    assert.match(previewCookie, /SameSite=None/)

    process.env.ISKI_ALLOW_LOCAL_HTTP_AUTH = 'true'
    const localCookie = sessionCookie(new Request('http://127.0.0.1:3000/admin'), 'opaque')
    assert.match(localCookie, /SameSite=Lax/)
    assert.doesNotMatch(localCookie, /Secure/)
  } finally {
    if (previous === undefined) delete process.env.ISKI_ALLOW_LOCAL_HTTP_AUTH
    else process.env.ISKI_ALLOW_LOCAL_HTTP_AUTH = previous
  }
})
