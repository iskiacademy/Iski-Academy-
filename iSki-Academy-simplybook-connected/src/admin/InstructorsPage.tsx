import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarOff, Check, Plus, Save, UserPlus, UsersRound } from 'lucide-react'
import { adminRequest, ApiError, WEEKDAYS, type AdminUser, type Instructor } from './api'

type Exception = { id: number; instructorId: number | null; instructorName: string | null; localDate: string; startsAt: string | null; endsAt: string | null; kind: string; label: string; createdBy: string }
type StaffUser = { id: number; email: string; displayName: string; role: string; instructorId: number | null; active: boolean; mustChangePassword: boolean; createdAt: string }
type DayShift = { enabled: boolean; startsAt: string; endsAt: string }
const dayEntries = () => WEEKDAYS.map((_, index) => ({ weekday: index + 1, enabled: false, startsAt: '09:00', endsAt: '17:00' }))
const todaySerbia = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '01'
  return `${get('year')}-${get('month')}-${get('day')}`
}
const toIso = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
const exceptionRange = () => {
  const from = todaySerbia()
  const date = new Date(`${from}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 60)
  return { from, to: toIso(date) }
}

export default function AdminInstructorsPage({ user, csrf }: { user: AdminUser; csrf: string }) {
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [profile, setProfile] = useState({ displayName: '', email: '', whatsapp: '', active: true, selectableByGuests: false })
  const [shifts, setShifts] = useState<ReturnType<typeof dayEntries>>(dayEntries())
  const [exceptionForm, setExceptionForm] = useState({ instructorId: '', localDate: todaySerbia(), startsAt: '', endsAt: '', label: '' })
  const [staffForm, setStaffForm] = useState({ displayName: '', email: '', role: 'instructor', instructorId: '', initialPassword: '' })
  const [tab, setTab] = useState<'roster' | 'exceptions' | 'staff'>('roster')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadAll() {
    setLoading(true); setError('')
    try {
      const [{ instructors: roster }, { users }, { exceptions: closures }] = await Promise.all([
        adminRequest<{ instructors: Instructor[] }>('/api/admin/instructors'),
        adminRequest<{ users: StaffUser[] }>('/api/admin/users'),
        adminRequest<{ exceptions: Exception[] }>(`/api/admin/availability/exceptions?${new URLSearchParams(exceptionRange())}`),
      ])
      setInstructors(roster); setStaff(users); setExceptions(closures)
      if (selectedId && !roster.some((item) => item.id === selectedId)) setSelectedId(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Instructor operations could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadAll() }, [])

  const selected = useMemo(() => instructors.find((item) => item.id === selectedId) || null, [instructors, selectedId])
  function chooseInstructor(item: Instructor | null) {
    setSelectedId(item?.id ?? null)
    setProfile(item ? { displayName: item.displayName, email: item.email, whatsapp: item.whatsapp, active: item.active, selectableByGuests: item.selectableByGuests } : { displayName: '', email: '', whatsapp: '', active: true, selectableByGuests: false })
    setShifts(dayEntries().map((entry) => {
      const saved = item?.weeklyAvailability.find((row) => row.weekday === entry.weekday)
      return saved ? { ...entry, enabled: true, startsAt: saved.startsAt, endsAt: saved.endsAt } : entry
    }))
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const route = selectedId ? `/api/admin/instructors/${selectedId}` : '/api/admin/instructors'
      await adminRequest(route, { method: selectedId ? 'PATCH' : 'POST', csrf, body: profile })
      await loadAll()
      setNotice(selectedId ? 'Instructor profile updated.' : 'Instructor profile added. No identity has been invented; add the real staff member details here.')
      if (!selectedId) chooseInstructor(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Instructor profile could not be saved.') }
    finally { setBusy(false) }
  }

  async function saveShifts(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) return
    setBusy(true); setError(''); setNotice('')
    try {
      const weeklyAvailability = shifts.filter((entry) => entry.enabled).map(({ weekday, startsAt, endsAt }) => ({ weekday, startsAt, endsAt }))
      await adminRequest(`/api/admin/instructors/${selectedId}/weekly`, { method: 'PUT', csrf, body: { weeklyAvailability } })
      await loadAll(); setNotice('Weekly Serbia-time availability saved.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Weekly shifts could not be saved.') }
    finally { setBusy(false) }
  }

  async function saveException(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await adminRequest('/api/admin/availability/exceptions', { method: 'POST', csrf, body: { ...exceptionForm, instructorId: exceptionForm.instructorId || null, startsAt: exceptionForm.startsAt || null, endsAt: exceptionForm.endsAt || null } })
      setExceptionForm((current) => ({ ...current, startsAt: '', endsAt: '', label: '' }))
      await loadAll(); setNotice('Time off or closure saved. A date/time with an existing booking must be resolved first.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The time off could not be saved.') }
    finally { setBusy(false) }
  }

  async function deleteException(id: number) {
    if (!window.confirm('Remove this time-off/closure block?')) return
    setBusy(true); setError(''); setNotice('')
    try { await adminRequest(`/api/admin/availability/exceptions/${id}`, { method: 'DELETE', csrf }); await loadAll(); setNotice('Availability block removed.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The block could not be removed.') }
    finally { setBusy(false) }
  }

  async function createStaff(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await adminRequest('/api/admin/users', { method: 'POST', csrf, body: { ...staffForm, instructorId: staffForm.role === 'instructor' ? Number(staffForm.instructorId) : null } })
      setStaffForm({ displayName: '', email: '', role: 'instructor', instructorId: '', initialPassword: '' })
      await loadAll(); setNotice('Staff login created. Share the temporary password securely; never send it in an email or public note.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Staff login could not be created.') }
    finally { setBusy(false) }
  }

  async function toggleStaff(item: StaffUser) {
    setBusy(true); setError(''); setNotice('')
    try { await adminRequest(`/api/admin/users/${item.id}`, { method: 'PATCH', csrf, body: { active: !item.active } }); await loadAll(); setNotice(`${item.displayName} account ${item.active ? 'deactivated' : 'activated'}.`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Staff account could not be updated.') }
    finally { setBusy(false) }
  }

  if (user.role === 'instructor') return <div className="admin-alert admin-alert--info">Instructor schedule and roster changes are managed by an owner or admin. You can review your own bookings from the Bookings section.</div>

  return <section className="admin-page">
    <div className="admin-page-heading"><div><p className="admin-eyebrow">TEAM OF FIVE · REAL ROSTER REQUIRED</p><h2>Instructor operations</h2><p>Add actual coach details and set recurring shifts, exceptions and staff logins. iSki does not seed fictional instructors.</p></div><span className="admin-readiness-chip"><UsersRound size={16} />{instructors.filter((item) => item.active).length} active · {instructors.filter((item) => item.weeklyAvailability.length > 0).length} scheduled</span></div>
    {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}{notice && <div className="admin-alert admin-alert--success" role="status"><Check size={17} />{notice}</div>}
    <div className="admin-tabs" role="tablist" aria-label="Instructor operations"><button className={tab === 'roster' ? 'is-active' : ''} onClick={() => setTab('roster')}>Roster & weekly shifts</button><button className={tab === 'exceptions' ? 'is-active' : ''} onClick={() => setTab('exceptions')}>Time off & closures</button><button className={tab === 'staff' ? 'is-active' : ''} onClick={() => setTab('staff')}>Staff accounts</button></div>
    {loading && <p className="admin-empty">Loading roster…</p>}

    {!loading && tab === 'roster' && <div className="admin-ops-grid">
      <section className="admin-panel"><div className="admin-panel__heading"><div><h3>Team roster</h3><p>Use actual staff names, not placeholders.</p></div><button className="admin-icon-button" onClick={() => chooseInstructor(null)} aria-label="Add instructor"><Plus size={18} /></button></div>
        {!instructors.length && <p className="admin-empty-inline">No instructors have been added yet.</p>}
        <div className="instructor-list">{instructors.map((item) => <button className={`instructor-row ${selectedId === item.id ? 'is-selected' : ''} ${!item.active ? 'is-inactive' : ''}`} key={item.id} onClick={() => chooseInstructor(item)}><span className="instructor-avatar">{item.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{item.displayName}</strong><small>{item.weeklyAvailability.length ? `${item.weeklyAvailability.length} days scheduled` : 'No weekly hours set'} · {item.account ? `login ${item.account.active ? 'active' : 'off'}` : 'no login'}</small></span><i className={item.active ? 'availability-indicator is-on' : 'availability-indicator'} /></button>)}</div>
      </section>
      <div className="admin-stack">
        <section className="admin-panel"><div className="admin-panel__heading"><div><h3>{selectedId ? 'Edit instructor' : 'Add instructor'}</h3><p>{selected ? `Profile #${selected.id}` : 'Add one of the real iSki coaches.'}</p></div></div>
          <form className="admin-form-grid" onSubmit={saveProfile}>
            <label>Name<input required maxLength={120} value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} /></label>
            <label>Email<input type="email" maxLength={254} value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} /></label>
            <label>WhatsApp<input type="tel" maxLength={32} value={profile.whatsapp} onChange={(event) => setProfile((current) => ({ ...current, whatsapp: event.target.value }))} /></label>
            <label className="admin-checkbox-row"><input type="checkbox" checked={profile.selectableByGuests} onChange={(event) => setProfile((current) => ({ ...current, selectableByGuests: event.target.checked }))} />Guest can request this coach by name</label>
            <label className="admin-checkbox-row"><input type="checkbox" checked={profile.active} onChange={(event) => setProfile((current) => ({ ...current, active: event.target.checked }))} />Active for availability</label>
            <button className="admin-primary-button admin-primary-button--compact" type="submit" disabled={busy}><Save size={15} />{busy ? 'Saving…' : 'Save profile'}</button>
          </form>
        </section>
        <section className="admin-panel"><div className="admin-panel__heading"><div><h3>Weekly shifts</h3><p>Serbia time · only {selected?.displayName || 'an active coach'} with a saved shift appears in availability.</p></div></div>
          {!selected && <p className="admin-empty-inline">Select or add an instructor first.</p>}
          {selected && <form className="weekly-schedule" onSubmit={saveShifts}>{shifts.map((shift, index) => <div className="weekly-schedule__row" key={shift.weekday}><label><input type="checkbox" checked={shift.enabled} onChange={(event) => setShifts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, enabled: event.target.checked } : entry))} />{WEEKDAYS[index]}</label><input aria-label={`${WEEKDAYS[index]} shift start`} type="time" min="09:00" max="16:00" step="3600" value={shift.startsAt} disabled={!shift.enabled} onChange={(event) => setShifts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, startsAt: event.target.value } : entry))} /><span>to</span><input aria-label={`${WEEKDAYS[index]} shift end`} type="time" min="10:00" max="17:00" step="3600" value={shift.endsAt} disabled={!shift.enabled} onChange={(event) => setShifts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, endsAt: event.target.value } : entry))} /></div>)}<button className="admin-secondary-button" type="submit" disabled={busy}><Save size={15} />Save weekly shifts</button></form>}
        </section>
      </div>
    </div>}

    {!loading && tab === 'exceptions' && <div className="admin-ops-grid">
      <section className="admin-panel"><div className="admin-panel__heading"><div><h3>Add a block</h3><p>Time off applies to one coach; an academy closure blocks every coach.</p></div><CalendarOff size={18} /></div>
        <form className="admin-form-grid" onSubmit={saveException}>
          <label>Date<input required type="date" min={todaySerbia()} value={exceptionForm.localDate} onChange={(event) => setExceptionForm((current) => ({ ...current, localDate: event.target.value }))} /></label>
          <label>Applies to<select value={exceptionForm.instructorId} onChange={(event) => setExceptionForm((current) => ({ ...current, instructorId: event.target.value }))}><option value="">Whole academy closure</option>{instructors.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
          <label>From <span className="admin-field-hint">Leave both time fields empty for a full day</span><input type="time" min="09:00" max="16:00" value={exceptionForm.startsAt} onChange={(event) => setExceptionForm((current) => ({ ...current, startsAt: event.target.value }))} /></label>
          <label>Until<input type="time" min="10:00" max="17:00" value={exceptionForm.endsAt} onChange={(event) => setExceptionForm((current) => ({ ...current, endsAt: event.target.value }))} /></label>
          <label className="admin-detail-wide">Reason / label<input required maxLength={160} value={exceptionForm.label} onChange={(event) => setExceptionForm((current) => ({ ...current, label: event.target.value }))} placeholder="Coach unavailable, resort closure…" /></label>
          <button className="admin-primary-button admin-primary-button--compact" type="submit" disabled={busy}><Plus size={15} />Add block</button>
        </form>
      </section>
      <section className="admin-panel"><div className="admin-panel__heading"><div><h3>Next 60 days</h3><p>Saved time-off periods and closures.</p></div></div>
        {!exceptions.length && <p className="admin-empty-inline">No upcoming blocks found.</p>}
        <div className="exception-list">{exceptions.map((item) => <article key={item.id}><div><strong>{item.localDate} · {item.startsAt ? `${item.startsAt}–${item.endsAt}` : 'All day'}</strong><span>{item.instructorName || 'Whole academy'} · {item.label}</span></div><button className="admin-link-button admin-link-button--danger" disabled={busy} onClick={() => deleteException(item.id)}>Remove</button></article>)}</div>
      </section>
    </div>}

    {!loading && tab === 'staff' && <div className="admin-ops-grid">
      <section className="admin-panel"><div className="admin-panel__heading"><div><h3>Create a staff login</h3><p>One instructor account per coach. Owners can also create admins.</p></div><UserPlus size={18} /></div>
        <form className="admin-form-grid" onSubmit={createStaff}>
          <label>Name<input required maxLength={120} value={staffForm.displayName} onChange={(event) => setStaffForm((current) => ({ ...current, displayName: event.target.value }))} /></label>
          <label>Login email<input required type="email" maxLength={254} value={staffForm.email} onChange={(event) => setStaffForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label>Role<select value={staffForm.role} onChange={(event) => setStaffForm((current) => ({ ...current, role: event.target.value, instructorId: '' }))}><option value="instructor">Instructor</option>{user.role === 'owner' && <option value="admin">Admin</option>}</select></label>
          {staffForm.role === 'instructor' && <label>Instructor profile<select required value={staffForm.instructorId} onChange={(event) => setStaffForm((current) => ({ ...current, instructorId: event.target.value }))}><option value="">Choose coach</option>{instructors.filter((item) => item.active && !item.account).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>}
          <label className="admin-detail-wide">Temporary password<input required type="password" minLength={12} maxLength={256} autoComplete="new-password" value={staffForm.initialPassword} onChange={(event) => setStaffForm((current) => ({ ...current, initialPassword: event.target.value }))} /><span className="admin-field-hint">At least 12 characters. Share out of band; it is stored only as a password hash.</span></label>
          <button className="admin-primary-button admin-primary-button--compact" type="submit" disabled={busy || (staffForm.role === 'instructor' && !staffForm.instructorId)}><UserPlus size={15} />Create login</button>
        </form>
      </section>
      <section className="admin-panel"><div className="admin-panel__heading"><div><h3>Staff accounts</h3><p>Deactivated accounts lose access immediately.</p></div></div>
        <div className="staff-account-list">{staff.map((item) => <article key={item.id}><div className="staff-account-list__person"><span className="instructor-avatar">{item.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{item.displayName}</strong><small>{item.email} · {item.role}{item.instructorId ? ` · coach #${item.instructorId}` : ''}{item.mustChangePassword ? ' · temporary password change required' : ''}</small></span></div><button className={`admin-toggle-button ${item.active ? 'is-active' : ''}`} onClick={() => toggleStaff(item)} disabled={busy || item.id === user.id}>{item.active ? 'Active' : 'Disabled'}</button></article>)}</div>
      </section>
    </div>}
  </section>
}
