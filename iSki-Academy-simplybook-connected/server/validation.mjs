import { isIsoLocalDate } from './availability-core.mjs'

export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function readJson(request, maxBytes = 24_000) {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) throw new HttpError(415, 'json_required', 'Send this request as JSON.')
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new HttpError(413, 'request_too_large', 'The request is too large.')
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.')
  }
}

export function cleanText(value, maxLength, field, { required = false } = {}) {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_field', `Check the ${field} field.`)
  const cleaned = value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  if (required && !cleaned) throw new HttpError(400, 'required_field', `Enter ${field}.`)
  if (cleaned.length > maxLength) throw new HttpError(400, 'field_too_long', `The ${field} field is too long.`)
  return cleaned
}

export function normalizeEmail(value) {
  const email = cleanText(value, 160, 'email', { required: true }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'invalid_email', 'Enter a valid email address.')
  return email
}

const LESSON_TYPES = ['Kids', 'Family', 'Adult Private', 'Performance Coaching']
const SKILL_LEVELS = ['First timer', 'Beginner', 'Intermediate', 'Advanced']
const SOURCES = ['Families', 'Kids', 'Adults', 'Performance', 'Partner', 'Instagram', 'Google']

export function validateBookingInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'invalid_request', 'Check the booking details and try again.')
  const fullName = cleanText(body.fullName, 100, 'full name', { required: true })
  const email = normalizeEmail(body.email)
  const whatsapp = cleanText(body.whatsapp, 32, 'WhatsApp number', { required: true })
  if (!/^\+?[0-9 ()\-\.]{7,32}$/.test(whatsapp)) throw new HttpError(400, 'invalid_whatsapp', 'Enter a valid WhatsApp number, including the country code.')
  const lessonType = cleanText(body.lessonType, 48, 'lesson type', { required: true })
  if (!LESSON_TYPES.includes(lessonType)) throw new HttpError(400, 'invalid_lesson_type', 'Choose one of the listed lesson types.')
  const formatCode = cleanText(body.formatCode, 64, 'lesson format', { required: true })
  const localDate = cleanText(body.localDate, 10, 'date', { required: true })
  if (!isIsoLocalDate(localDate)) throw new HttpError(400, 'invalid_date', 'Choose a valid lesson date.')
  const startTime = cleanText(body.startTime, 5, 'start time', { required: true })
  if (!/^\d{2}:00$/.test(startTime)) throw new HttpError(400, 'invalid_start_time', 'Choose one of the available hourly start times.')
  const participants = Number(body.participants)
  if (!Number.isInteger(participants) || participants < 1 || participants > 30) throw new HttpError(400, 'invalid_participants', 'Enter a valid number of participants.')
  const skillLevel = cleanText(body.skillLevel, 32, 'skill level', { required: true })
  if (!SKILL_LEVELS.includes(skillLevel)) throw new HttpError(400, 'invalid_skill_level', 'Choose a listed skill level.')
  const source = cleanText(body.source, 32, 'source', { required: true })
  if (!SOURCES.includes(source)) throw new HttpError(400, 'invalid_source', 'Choose a listed source.')
  const preferredInstructorId = body.preferredInstructorId == null || body.preferredInstructorId === '' ? null : Number(body.preferredInstructorId)
  if (preferredInstructorId !== null && (!Number.isSafeInteger(preferredInstructorId) || preferredInstructorId < 1)) throw new HttpError(400, 'invalid_instructor', 'Choose a listed instructor or leave the preference empty.')
  const message = body.message ? cleanText(body.message, 1000, 'message') : ''
  const honeypot = typeof body.website === 'string' ? body.website.trim() : ''
  if (honeypot) throw new HttpError(400, 'invalid_request', 'The request could not be processed.')
  return { fullName, email, whatsapp, lessonType, formatCode, localDate, startTime, participants, skillLevel, source, preferredInstructorId, message }
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 256 || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new HttpError(400, 'weak_password', 'Use a password between 12 and 256 characters.')
  }
  return value
}
