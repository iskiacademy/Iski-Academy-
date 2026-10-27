import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Clock3, UsersRound } from 'lucide-react'
import { adminRequest, BOOKING_STATUSES, type AdminUser, type Booking } from './api'

type Summary = { today: string; counts: Record<string, number>; upcoming: Booking[] }
const formatDate = (date: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

export default function AdminDashboardPage({ user, csrf: _csrf, onNavigate }: { user: AdminUser; csrf: string; onNavigate: (href: string) => void }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    adminRequest<Summary>('/api/admin/dashboard').then((payload) => { if (active) setSummary(payload) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load bookings.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const openCount = summary ? (summary.counts.New || 0) + (summary.counts.Contacted || 0) : 0
  const activeCount = summary ? (summary.counts.Confirmed || 0) + (summary.counts['Deposit Paid'] || 0) : 0
  const cards = [
    { label: 'New & to contact', value: openCount, icon: Clock3, tone: 'blue' },
    { label: 'Confirmed / deposit', value: activeCount, icon: CalendarDays, tone: 'yellow' },
    { label: user.role === 'instructor' ? 'My bookings' : 'Active lesson requests', value: summary ? Object.entries(summary.counts).filter(([status]) => status !== 'Cancelled').reduce((total, [, count]) => total + count, 0) : 0, icon: UsersRound, tone: 'navy' },
  ]

  return <section className="admin-page">
    <div className="admin-page-heading"><div><p className="admin-eyebrow">{summary ? formatDate(summary.today) : 'Europe/Belgrade'}</p><h2>{user.role === 'instructor' ? `Hello, ${user.displayName.split(' ')[0]}` : 'Booking overview'}</h2><p>Guest requests, coach assignments and follow-up status in one place.</p></div><button className="admin-primary-button admin-primary-button--compact" onClick={() => onNavigate('/admin/bookings')}>Open bookings <ArrowRight size={16} /></button></div>
    {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
    <div className="admin-stat-grid">{cards.map(({ label, value, icon: Icon, tone }) => <article className={`admin-stat-card admin-stat-card--${tone}`} key={label}><span className="admin-stat-card__icon"><Icon size={19} /></span><div><span>{label}</span><strong>{loading ? '—' : value}</strong></div></article>)}</div>
    <section className="admin-panel">
      <div className="admin-panel__heading"><div><h3>Upcoming bookings</h3><p>Dates and times are shown in Europe/Belgrade.</p></div><button className="admin-link-button" onClick={() => onNavigate('/admin/bookings')}>View all <ArrowRight size={15} /></button></div>
      {loading && <p className="admin-empty">Loading booking records…</p>}
      {!loading && !error && !summary?.upcoming.length && <div className="admin-empty"><CalendarDays size={24} /><strong>No upcoming requests yet</strong><span>New public requests will appear here after they are submitted.</span></div>}
      {!!summary?.upcoming.length && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Guest</th><th>Date / time</th><th>Lesson</th><th>Instructor</th><th>Status</th></tr></thead><tbody>{summary.upcoming.map((booking) => <tr key={booking.id} className="admin-table__clickable" onClick={() => onNavigate(`/admin/bookings/${booking.id}`)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onNavigate(`/admin/bookings/${booking.id}`) }}><td><strong>{booking.fullName}</strong><small>{booking.email}</small></td><td>{formatDate(booking.localDate)}<small>{booking.startTime}–{booking.endTime} · Serbia</small></td><td>{booking.formatLabel}<small>{booking.participants} participant(s)</small></td><td>{booking.instructorName || 'Unassigned'}</td><td><span className={`status-pill status-pill--${booking.status.toLowerCase().replaceAll(' ', '-')}`}>{booking.status}</span></td></tr>)}</tbody></table></div>}
      <div className="admin-status-legend">{BOOKING_STATUSES.map((status) => <span key={status}><i className={`status-dot status-dot--${status.toLowerCase().replaceAll(' ', '-')}`} />{status} <b>{summary?.counts[status] ?? 0}</b></span>)}</div>
    </section>
  </section>
}
