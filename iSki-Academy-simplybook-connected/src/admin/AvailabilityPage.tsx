import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { adminRequest, type AdminUser, type Booking, type Instructor } from './api'

type Exception = { id: number; instructorId: number | null; instructorName: string | null; localDate: string; startsAt: string | null; endsAt: string | null; kind: string; label: string }
const isoDate = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
function todaySerbia() {
  const values = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (key: string) => values.find((item) => item.type === key)?.value || '01'
  return `${part('year')}-${part('month')}-${part('day')}`
}
function startOfWeek(localDate: string) {
  const date = new Date(`${localDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date
}
function shiftDays(date: Date, amount: number) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + amount); return next }
function minutes(value: string | null) { if (!value) return 540; const [hour, minute] = value.slice(0, 5).split(':').map(Number); return hour * 60 + minute }
const niceDate = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

export default function AdminAvailabilityPage({ user, onNavigate }: { user: AdminUser; csrf: string; onNavigate: (href: string) => void }) {
  const [week, setWeek] = useState(() => startOfWeek(todaySerbia()))
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [instructorId, setInstructorId] = useState(user.instructorId ? String(user.instructorId) : '')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => isoDate(shiftDays(week, index))), [week])

  useEffect(() => {
    if (user.role === 'instructor') return
    adminRequest<{ instructors: Instructor[] }>('/api/admin/instructors').then(({ instructors: rows }) => setInstructors(rows)).catch(() => undefined)
  }, [user.role])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const params: Record<string, string> = { from: days[0], to: days[6], limit: '200' }
    if (instructorId) params.instructorId = instructorId
    const query = new URLSearchParams(params)
    Promise.all([
      adminRequest<{ bookings: Booking[] }>(`/api/admin/bookings?${query.toString()}`),
      adminRequest<{ exceptions: Exception[] }>(`/api/admin/availability/exceptions?${new URLSearchParams({ from: days[0], to: days[6] })}`),
    ]).then(([bookingPayload, exceptionPayload]) => {
      if (!active) return
      setBookings(bookingPayload.bookings); setExceptions(exceptionPayload.exceptions)
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Schedule could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days, instructorId])

  const weekTitle = `${niceDate(days[0], { day: 'numeric', month: 'short' })} – ${niceDate(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
  const hours = Array.from({ length: 8 }, (_, index) => 9 + index)
  function moveWeek(amount: number) { setWeek((current) => shiftDays(current, amount * 7)) }
  function goToday() { setWeek(startOfWeek(todaySerbia())) }

  return <section className="admin-page">
    <div className="admin-page-heading"><div><p className="admin-eyebrow">COACH CAPACITY</p><h2>Availability calendar</h2><p>Assigned lessons and blocked time in Europe/Belgrade · daily hours 09:00–17:00.</p></div><button className="admin-secondary-button" onClick={() => onNavigate('/admin/instructors')}><CalendarDays size={16} />Manage shifts & time off</button></div>
    {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
    <section className="admin-panel admin-calendar-panel">
      <div className="admin-calendar-toolbar"><div className="admin-calendar-nav"><button className="admin-icon-button" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft size={18} /></button><button className="admin-secondary-button admin-secondary-button--small" onClick={goToday}>Today</button><button className="admin-icon-button" onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight size={18} /></button><strong>{weekTitle}</strong></div>{user.role !== 'instructor' && <label className="admin-calendar-coach">Coach<select value={instructorId} onChange={(event) => setInstructorId(event.target.value)}><option value="">All instructors</option>{instructors.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>}</div>
      <div className="admin-calendar-legend"><span><i className="calendar-key calendar-key--booking" />Lesson booking</span><span><i className="calendar-key calendar-key--timeoff" />Coach time off</span><span><i className="calendar-key calendar-key--closure" />Academy closure</span><span className="admin-calendar-zone">All times: Europe/Belgrade</span></div>
      <div className="admin-calendar-scroll"><div className="admin-week-grid">
        <div className="admin-week-grid__corner" />
        {days.map((date) => <div className="admin-week-day" key={date}><span>{niceDate(date, { weekday: 'short' })}</span><strong>{niceDate(date, { day: 'numeric', month: 'short' })}</strong></div>)}
        <div className="admin-time-axis">{hours.map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div>
        {days.map((date) => {
          const dayBookings = bookings.filter((booking) => booking.localDate === date)
          const dayExceptions = exceptions.filter((item) => item.localDate === date && (!instructorId || item.instructorId === null || item.instructorId === Number(instructorId)))
          return <div className="admin-week-day-column" key={date}>
            {hours.map((hour) => <div className="admin-calendar-hour" key={hour} />)}
            {dayExceptions.map((item) => {
              const start = item.startsAt ? minutes(item.startsAt) : 540
              const end = item.endsAt ? minutes(item.endsAt) : 1020
              return <article key={`exception-${item.id}`} className={`admin-calendar-event admin-calendar-event--${item.kind === 'closure' ? 'closure' : 'timeoff'}`} style={{ top: `${((start - 540) / 480) * 100}%`, height: `${Math.max(5, ((end - start) / 480) * 100)}%` }} title={`${item.label} · ${item.instructorName || 'Whole academy'}`}><strong>{item.instructorName || 'Academy closure'}</strong><span>{item.startsAt ? `${item.startsAt}–${item.endsAt}` : 'All day'} · {item.label}</span></article>
            })}
            {dayBookings.map((booking) => {
              const start = minutes(booking.startTime)
              const end = minutes(booking.endTime)
              return <button type="button" key={booking.id} className={`admin-calendar-event admin-calendar-event--booking status-event--${booking.status.toLowerCase().replace(/ /g, '-')}`} style={{ top: `${((start - 540) / 480) * 100}%`, height: `${Math.max(7, ((end - start) / 480) * 100)}%` }} title={`${booking.fullName} · ${booking.formatLabel} · ${booking.status}`} onClick={() => onNavigate(`/admin/bookings/${booking.id}`)}><strong>{booking.startTime} · {booking.fullName}</strong><span>{booking.formatLabel}{instructorId ? '' : ` · ${booking.instructorName || 'Unassigned'}`}</span></button>
            })}
          </div>
        })}
      </div></div>
      {loading && <p className="admin-empty">Loading coach calendar…</p>}
      {!loading && !bookings.length && !exceptions.length && <p className="admin-empty-inline">No assigned bookings or blocked periods during this week.</p>}
    </section>
    <div className="admin-calendar-note"><ArrowLeft size={15} /><span>Availability is calculated from each coach's weekly shift, exceptions, session length and existing active requests. The public calendar shows aggregate available-coach counts, not these private details.</span></div>
  </section>
}
