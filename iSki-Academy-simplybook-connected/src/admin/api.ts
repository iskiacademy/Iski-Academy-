export type AdminRole = 'owner' | 'admin' | 'instructor'
export type AdminUser = { id: number; email: string; displayName: string; role: AdminRole; instructorId: number | null; mustChangePassword: boolean }
export type BookingStatus = 'New' | 'Contacted' | 'Confirmed' | 'Deposit Paid' | 'Completed' | 'Cancelled'
export type EmailNotification = { id: number; templateKey: string; recipient: string; status: 'pending' | 'failed' | 'not_configured' | 'sent'; attempts: number; lastErrorCode: string | null; sentAt: string | null }
export type Booking = {
  id: string
  fullName: string
  email: string
  whatsapp: string
  lessonType: string
  formatCode: string
  formatLabel: string
  preferredInstructorId: number | null
  assignedInstructorId: number
  instructorName: string | null
  localDate: string
  startTime: string
  endTime: string
  startsAtUtc: string
  endsAtUtc: string
  timezone: string
  participants: number
  skillLevel: string
  source: string
  message: string
  depositLink: string
  status: BookingStatus
  createdAt: string
  updatedAt: string
  notes?: { id: number; note: string; authorName: string; createdAt: string }[]
  history?: { previousStatus: string | null; newStatus: string; detail: string; actorName: string; createdAt: string }[]
  emailNotifications?: EmailNotification[]
}
export type Instructor = {
  id: number
  displayName: string
  email: string
  whatsapp: string
  active: boolean
  selectableByGuests: boolean
  account: { id: number; email: string; active: boolean } | null
  weeklyAvailability: { id?: number; weekday: number; startsAt: string; endsAt: string; effectiveFrom?: string | null; effectiveUntil?: string | null }[]
}
export type LessonFormat = { code: string; lessonType: string; label: string; durationMinutes: number; maxParticipants: number; capacityConfirmed: boolean; active: boolean; bookableOnline: boolean }
export type BusinessSettings = {
  timezone: string
  openingTime: string
  closingTime: string
  seasonStart: string | null
  seasonEnd: string | null
  turnaroundMinutes: number
  publicBookingEnabled: boolean
  readiness: { activeInstructors: number; scheduledInstructors: number }
  formats: LessonFormat[]
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export async function adminRequest<T>(path: string, options: { method?: string; csrf?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers({ Accept: 'application/json' })
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD'].includes(method) && options.csrf) headers.set('X-CSRF-Token', options.csrf)
  const response = await fetch(path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
  })
  const payload = await response.json().catch(() => ({}))
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('iski-admin-expired'))
  if (!response.ok) throw new ApiError(payload?.error?.message || 'The request could not be completed.', payload?.error?.code || 'request_failed', response.status)
  return payload as T
}

export async function downloadBookingsCsv(filters: Record<string, string>) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)))
  const response = await fetch(`/api/admin/export.csv?${query.toString()}`, { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new ApiError(payload?.error?.message || 'CSV export failed.', payload?.error?.code || 'export_failed', response.status)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'iski-bookings.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const BOOKING_STATUSES: BookingStatus[] = ['New', 'Contacted', 'Confirmed', 'Deposit Paid', 'Completed', 'Cancelled']
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
