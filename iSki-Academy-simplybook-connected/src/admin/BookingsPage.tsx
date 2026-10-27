import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Download, ExternalLink, MessageCircle, RefreshCw, Save, StickyNote } from 'lucide-react'
import { adminRequest, ApiError, BOOKING_STATUSES, downloadBookingsCsv, type AdminUser, type Booking, type BookingStatus, type Instructor } from './api'

const nextStatuses: Record<BookingStatus, BookingStatus[]> = {
  New: ['Contacted', 'Confirmed', 'Cancelled'],
  Contacted: ['New', 'Confirmed', 'Cancelled'],
  Confirmed: ['Contacted', 'Deposit Paid', 'Completed', 'Cancelled'],
  'Deposit Paid': ['Confirmed', 'Completed', 'Cancelled'],
  Completed: [],
  Cancelled: ['New', 'Confirmed'],
}
const dateLabel = (date: string) => new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
const waHref = (booking: Booking) => `https://wa.me/${booking.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${booking.fullName}, this is iSki Academy regarding your ${booking.formatLabel} request for ${booking.localDate} at ${booking.startTime} Serbia time. How can we help?`)}`

type Filters = { from: string; to: string; status: string; lessonType: string; instructorId: string; search: string }
const defaultFilters: Filters = { from: '', to: '', status: '', lessonType: '', instructorId: '', search: '' }

export default function AdminBookingsPage({ user, csrf }: { user: AdminUser; csrf: string }) {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [applied, setApplied] = useState<Filters>(defaultFilters)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [detail, setDetail] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState<BookingStatus>('New')
  const [assignedInstructorId, setAssignedInstructorId] = useState('')
  const [depositLink, setDepositLink] = useState('')
  const [note, setNote] = useState('')
  const [exporting, setExporting] = useState(false)
  const [retryingEmailId, setRetryingEmailId] = useState<number | null>(null)

  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const bookingId = pathname.match(/^\/admin\/bookings\/([0-9a-f-]{36})$/i)?.[1] || ''

  useEffect(() => {
    if (!bookingId) {
      setDetail(null)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    adminRequest<{ booking: Booking }>(`/api/admin/bookings/${bookingId}`).then(({ booking }) => {
      if (!active) return
      setDetail(booking)
      setStatus(booking.status)
      setAssignedInstructorId(String(booking.assignedInstructorId))
      setDepositLink(booking.depositLink || '')
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Booking could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [bookingId])

  useEffect(() => {
    let active = true
    setLoading(true)
    const query = new URLSearchParams({ ...applied, limit: '200' })
    adminRequest<{ bookings: Booking[] }>(`/api/admin/bookings?${query.toString()}`).then(({ bookings: rows }) => { if (active) setBookings(rows) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Bookings could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [applied])

  useEffect(() => {
    if (user.role === 'instructor') return
    adminRequest<{ instructors: Instructor[] }>('/api/admin/instructors').then(({ instructors: rows }) => setInstructors(rows)).catch(() => undefined)
  }, [user.role])

  const availableStatuses = useMemo(() => detail ? [detail.status, ...nextStatuses[detail.status]] : BOOKING_STATUSES, [detail])
  function applyFilters(event: FormEvent) { event.preventDefault(); setError(''); setApplied({ ...filters }) }
  function resetFilters() { setFilters(defaultFilters); setApplied(defaultFilters) }
  function openBooking(id: string) { window.history.pushState({}, '', `/admin/bookings/${id}`); setPathname(window.location.pathname); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function showList() { window.history.pushState({}, '', '/admin/bookings'); setPathname('/admin/bookings'); setNotice(''); setError('') }

  async function saveBooking(event: FormEvent) {
    event.preventDefault()
    if (!detail) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await adminRequest<{ status: string; emails: { status: string }[] }>(`/api/admin/bookings/${detail.id}`, {
        method: 'PATCH', csrf,
        body: { status, assignedInstructorId: user.role === 'instructor' ? null : Number(assignedInstructorId), depositLink },
      })
      const refreshed = await adminRequest<{ booking: Booking }>(`/api/admin/bookings/${detail.id}`)
      setDetail(refreshed.booking)
      const mailText = result.emails?.some((item) => item.status === 'sent') ? ' Guest notification sent.' : result.emails?.length ? ' Email is not configured or could not be delivered; the booking update is saved.' : ''
      setNotice(`Booking updated.${mailText}`)
      setApplied((current) => ({ ...current }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Booking update failed.') }
    finally { setBusy(false) }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault()
    if (!detail || !note.trim()) return
    setBusy(true); setError(''); setNotice('')
    try {
      await adminRequest(`/api/admin/bookings/${detail.id}/notes`, { method: 'POST', csrf, body: { note } })
      const refreshed = await adminRequest<{ booking: Booking }>(`/api/admin/bookings/${detail.id}`)
      setDetail(refreshed.booking); setNote(''); setNotice('Internal note added.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Note could not be saved.') }
    finally { setBusy(false) }
  }

  async function exportCsv() {
    setExporting(true); setError('')
    try { await downloadBookingsCsv(applied) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed.') }
    finally { setExporting(false) }
  }

  async function retryEmail(id: number) {
    setRetryingEmailId(id); setError(''); setNotice('')
    try {
      await adminRequest(`/api/admin/email-outbox/${id}/retry`, { method: 'POST', csrf })
      const refreshed = await adminRequest<{ booking: Booking }>(`/api/admin/bookings/${detail?.id}`)
      setDetail(refreshed.booking)
      setNotice('Notification delivery status refreshed.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Notification retry failed.') }
    finally { setRetryingEmailId(null) }
  }

  if (bookingId) return <section className="admin-page">
    <button className="admin-link-button admin-back-button" onClick={showList}><ArrowLeft size={16} /> Back to bookings</button>
    {loading && !detail && <div className="admin-empty">Loading booking details…</div>}
    {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
    {notice && <div className="admin-alert admin-alert--success" role="status">{notice}</div>}
    {detail && <>
      <div className="admin-page-heading"><div><p className="admin-eyebrow">{detail.id}</p><h2>{detail.fullName}</h2><p>{dateLabel(detail.localDate)} · {detail.startTime}–{detail.endTime} · Europe/Belgrade</p></div><a className="admin-primary-button admin-primary-button--compact" href={waHref(detail)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Open WhatsApp</a></div>
      <div className="admin-detail-grid">
        <section className="admin-panel">
          <div className="admin-panel__heading"><div><h3>Booking details</h3><p>Submitted {new Date(`${detail.createdAt.replace(' ', 'T')}Z`).toLocaleString('en', { timeZone: 'Europe/Belgrade' })} Serbia time.</p></div><span className={`status-pill status-pill--${detail.status.toLowerCase().replaceAll(' ', '-')}`}>{detail.status}</span></div>
          <dl className="admin-detail-list"><div><dt>Lesson</dt><dd>{detail.formatLabel} · {detail.lessonType}</dd></div><div><dt>Participants</dt><dd>{detail.participants}</dd></div><div><dt>Skill level</dt><dd>{detail.skillLevel}</dd></div><div><dt>Guest email</dt><dd><a href={`mailto:${detail.email}`}>{detail.email}</a></dd></div><div><dt>WhatsApp</dt><dd><a href={`tel:${detail.whatsapp}`}>{detail.whatsapp}</a></dd></div><div><dt>Source</dt><dd>{detail.source}</dd></div><div><dt>Guest message</dt><dd>{detail.message || '—'}</dd></div><div><dt>Preferred coach</dt><dd>{detail.preferredInstructorId ? 'Requested preference' : 'No preference'}</dd></div></dl>
          <form className="admin-edit-booking" onSubmit={saveBooking}>
            <label>Booking status<select value={status} onChange={(event) => setStatus(event.target.value as BookingStatus)}>{availableStatuses.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
            {user.role !== 'instructor' && <label>Assigned instructor<select value={assignedInstructorId} onChange={(event) => setAssignedInstructorId(event.target.value)}>{instructors.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label>}
            {['Confirmed', 'Deposit Paid'].includes(status) && user.role !== 'instructor' && <label className="admin-detail-wide">Manual deposit/payment link <span className="admin-field-hint">Optional · must be an HTTPS link</span><input type="url" placeholder="https://…" value={depositLink} onChange={(event) => setDepositLink(event.target.value)} /></label>}
            <button className="admin-primary-button admin-primary-button--compact" disabled={busy} type="submit"><Save size={16} />{busy ? 'Saving…' : 'Save changes'}</button>
          </form>
        </section>
        <aside className="admin-panel admin-notes-panel">
          <div className="admin-panel__heading"><div><h3><StickyNote size={17} /> Internal notes</h3><p>Visible only to authorized iSki staff.</p></div></div>
          <form onSubmit={addNote} className="admin-note-form"><textarea maxLength={2000} required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a private follow-up note…" /><button className="admin-secondary-button" disabled={busy || !note.trim()} type="submit">Add note <ArrowRight size={15} /></button></form>
          <div className="admin-note-list">{detail.notes?.map((item) => <article key={item.id}><p>{item.note}</p><small>{item.authorName} · {new Date(`${item.createdAt.replace(' ', 'T')}Z`).toLocaleString('en', { timeZone: 'Europe/Belgrade' })}</small></article>)}{!detail.notes?.length && <p className="admin-empty-inline">No internal notes yet.</p>}</div>
          <div className="admin-history admin-email-history"><h4>Customer email delivery</h4>{detail.emailNotifications?.map((item) => <div key={item.id}><span>{item.templateKey.replace(/_/g, ' ')}</span><small>{item.recipient} · {item.status} · {item.attempts} attempt(s){item.lastErrorCode ? ` · ${item.lastErrorCode}` : ''}</small>{user.role !== 'instructor' && item.status !== 'sent' && <button className="admin-link-button" disabled={retryingEmailId === item.id} onClick={() => retryEmail(item.id)}><RefreshCw size={14} />{retryingEmailId === item.id ? 'Retrying…' : 'Retry delivery'}</button>}</div>)}{!detail.emailNotifications?.length && <p className="admin-empty-inline">No notification records.</p>}</div>
          <div className="admin-history"><h4>Status history</h4>{detail.history?.map((item, index) => <div key={`${item.newStatus}-${index}`}><span>{item.newStatus}</span><small>{item.actorName} · {item.detail}</small></div>)}</div>
        </aside>
      </div>
    </>}
  </section>

  return <section className="admin-page">
    <div className="admin-page-heading"><div><p className="admin-eyebrow">GUEST REQUESTS</p><h2>Bookings</h2><p>Filter by date, lesson, coach or workflow status. All dates and times use Serbia's business timezone.</p></div><button className="admin-secondary-button" disabled={exporting} onClick={exportCsv}><Download size={16} />{exporting ? 'Preparing…' : 'Export CSV'}</button></div>
    {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}
    <form className="admin-filter-panel" onSubmit={applyFilters}>
      <label>From<input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
      <label>To<input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
      <label>Status<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{BOOKING_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Lesson type<select value={filters.lessonType} onChange={(event) => setFilters((current) => ({ ...current, lessonType: event.target.value }))}><option value="">All lesson types</option>{['Kids', 'Family', 'Adult Private', 'Performance Coaching'].map((value) => <option key={value}>{value}</option>)}</select></label>
      {user.role !== 'instructor' && <label>Instructor<select value={filters.instructorId} onChange={(event) => setFilters((current) => ({ ...current, instructorId: event.target.value }))}><option value="">All instructors</option>{instructors.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>}
      <label className="admin-filter-search">Search<input type="search" maxLength={80} placeholder="Name, email or WhatsApp" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></label>
      <div className="admin-filter-actions"><button className="admin-primary-button admin-primary-button--compact" type="submit">Apply filters <ArrowRight size={15} /></button><button type="button" className="admin-link-button" onClick={resetFilters}>Reset</button></div>
    </form>
    <section className="admin-panel">
      <div className="admin-panel__heading"><div><h3>{bookings.length} request{bookings.length === 1 ? '' : 's'}</h3><p>Pending and active bookings occupy their assigned coach interval.</p></div><button className="admin-icon-button" onClick={() => setApplied((current) => ({ ...current }))} aria-label="Refresh bookings"><RefreshCw size={16} /></button></div>
      {loading && <p className="admin-empty">Loading bookings…</p>}
      {!loading && !bookings.length && <div className="admin-empty"><CalendarDaysIcon /><strong>No bookings match these filters</strong><span>Try a wider date range or remove a status filter.</span></div>}
      {!!bookings.length && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Guest</th><th>Date / time</th><th>Lesson</th><th>Instructor</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td><strong>{booking.fullName}</strong><small>{booking.email}</small></td><td>{dateLabel(booking.localDate)}<small>{booking.startTime}–{booking.endTime} · Serbia</small></td><td>{booking.formatLabel}<small>{booking.participants} participant(s) · {booking.skillLevel}</small></td><td>{booking.instructorName || 'Unassigned'}</td><td><span className={`status-pill status-pill--${booking.status.toLowerCase().replaceAll(' ', '-')}`}>{booking.status}</span></td><td><button className="admin-icon-button" aria-label={`Open ${booking.fullName}'s booking`} onClick={() => openBooking(booking.id)}><ExternalLink size={16} /></button></td></tr>)}</tbody></table></div>}
      <p className="admin-table-footnote">Showing up to 200 matching bookings on this page. Export CSV for an authorized data extract.</p>
    </section>
  </section>
}

function CalendarDaysIcon() { return <span className="admin-empty__calendar"><CalendarDays /></span> }
