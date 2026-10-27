import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, Mail, Save, Settings2 } from 'lucide-react'
import { adminRequest, type BusinessSettings, type LessonFormat } from './api'

type EmailStatus = { configured: boolean; senderConfigured: boolean; pending: number; failed: number; notConfigured: number }

export default function AdminSettingsPage({ csrf }: { csrf: string }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [formats, setFormats] = useState<LessonFormat[]>([])
  const [email, setEmail] = useState<EmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [business, mail] = await Promise.all([
        adminRequest<BusinessSettings>('/api/admin/settings'),
        adminRequest<EmailStatus>('/api/admin/email-status').catch(() => null),
      ])
      setSettings(business); setFormats(business.formats); setEmail(mail)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Business settings could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function saveBusiness(event: FormEvent) {
    event.preventDefault()
    if (!settings) return
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await adminRequest<BusinessSettings>('/api/admin/settings', { method: 'PUT', csrf, body: { seasonStart: settings.seasonStart, seasonEnd: settings.seasonEnd, turnaroundMinutes: settings.turnaroundMinutes, publicBookingEnabled: settings.publicBookingEnabled } })
      setSettings((current) => current ? { ...current, ...updated } : updated)
      setNotice(updated.publicBookingEnabled ? 'Public booking is open. The calendar now reflects saved coach schedules.' : 'Business settings saved. Public booking is closed.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Settings could not be saved.') }
    finally { setBusy(false) }
  }

  function updateFormat(code: string, values: Partial<LessonFormat>) {
    const capacityChanged = ['maxParticipants', 'active', 'bookableOnline'].some((key) => key in values)
    setFormats((current) => current.map((item) => item.code === code ? { ...item, ...values, ...(capacityChanged ? { capacityConfirmed: false } : {}) } : item))
  }
  async function saveFormat(format: LessonFormat) {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await adminRequest<{ publicBookingEnabled: boolean }>(`/api/admin/formats/${format.code}`, { method: 'PATCH', csrf, body: { maxParticipants: format.maxParticipants, active: format.active, bookableOnline: format.bookableOnline, capacityConfirmed: format.capacityConfirmed } })
      setNotice(result.publicBookingEnabled ? `${format.label} settings saved.` : `Saved ${format.label}. Public booking is closed until all online participant limits are verified and reopened.`)
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Lesson format could not be saved.') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="admin-empty">Loading business settings…</div>
  if (!settings) return <div className="admin-alert admin-alert--error">{error || 'Settings unavailable.'}</div>
  const onlineFormats = formats.filter((item) => item.active && item.bookableOnline && item.maxParticipants > 0)
  const readyToOpen = settings.readiness.activeInstructors > 0 && settings.readiness.scheduledInstructors > 0 && !!settings.seasonStart && !!settings.seasonEnd && onlineFormats.length > 0 && onlineFormats.every((item) => item.capacityConfirmed)

  return <section className="admin-page">
    <div className="admin-page-heading"><div><p className="admin-eyebrow">OPERATING RULES</p><h2>Business settings</h2><p>Times use the IANA timezone <strong>Europe/Belgrade</strong>, so Serbia daylight-saving changes are handled automatically.</p></div><span className={`admin-readiness-chip ${readyToOpen ? 'is-ready' : 'is-pending'}`}>{readyToOpen ? <Check size={16} /> : <AlertTriangle size={16} />}{readyToOpen ? 'Schedule ready to review' : 'Setup incomplete'}</span></div>
    {error && <div className="admin-alert admin-alert--error" role="alert">{error}</div>}{notice && <div className="admin-alert admin-alert--success" role="status"><Check size={17} />{notice}</div>}
    <div className="admin-settings-grid">
      <section className="admin-panel"><div className="admin-panel__heading"><div><h3><Settings2 size={18} /> Season & opening hours</h3><p>Booking window and the business's daily operating rules.</p></div></div>
        <form className="admin-form-grid" onSubmit={saveBusiness}>
          <label>Season opens<input type="date" value={settings.seasonStart || ''} onChange={(event) => setSettings((current) => current ? { ...current, seasonStart: event.target.value || null } : current)} /></label>
          <label>Season closes<input type="date" value={settings.seasonEnd || ''} onChange={(event) => setSettings((current) => current ? { ...current, seasonEnd: event.target.value || null } : current)} /></label>
          <div className="admin-hours-summary"><span>Daily hours</span><strong>{settings.openingTime}–{settings.closingTime}</strong><small>One-hour start-time increments · Europe/Belgrade</small></div>
          <label>Turnaround buffer<select value={settings.turnaroundMinutes} onChange={(event) => setSettings((current) => current ? { ...current, turnaroundMinutes: Number(event.target.value) } : current)}><option value="0">0 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select><span className="admin-field-hint">Optional instructor gap between sessions. Default is zero.</span></label>
          <label className="admin-checkbox-row admin-detail-wide"><input type="checkbox" checked={settings.publicBookingEnabled} onChange={(event) => setSettings((current) => current ? { ...current, publicBookingEnabled: event.target.checked } : current)} />Accept public booking requests and show live availability</label>
          <div className="admin-readiness-notes admin-detail-wide"><span>{settings.readiness.activeInstructors} active instructors</span><span>{settings.readiness.scheduledInstructors} with weekly hours</span><span>{formats.filter((item) => item.active && item.bookableOnline).length} online lesson formats</span></div>
          {!readyToOpen && <p className="admin-warning admin-detail-wide"><AlertTriangle size={16} />Add real instructors and working hours, set the season, and mark every online format’s participant limit as verified before opening the public calendar.</p>}
          <button className="admin-primary-button admin-primary-button--compact" type="submit" disabled={busy}><Save size={15} />{busy ? 'Saving…' : 'Save business settings'}</button>
        </form>
      </section>
      <section className="admin-panel admin-email-panel"><div className="admin-panel__heading"><div><h3><Mail size={18} /> Customer emails</h3><p>Transactional notifications are handled server-side.</p></div></div>
        {!email?.configured ? <div className="admin-alert admin-alert--info"><span>Email is not configured. Add a valid <code>RESEND_API_KEY</code> and verified <code>RESEND_FROM_EMAIL</code> using Webdev's protected project secrets. Booking requests still save; email delivery remains pending.</span></div> : <div className="admin-alert admin-alert--success"><Check size={17} />Transactional email is configured. Ensure the sender domain remains verified with the provider.</div>}
        <dl className="admin-mail-stats"><div><dt>Pending</dt><dd>{email?.pending ?? '—'}</dd></div><div><dt>Not configured</dt><dd>{email?.notConfigured ?? '—'}</dd></div><div><dt>Failed</dt><dd>{email?.failed ?? '—'}</dd></div></dl>
        <p className="admin-muted-note">Guest confirmation messages clarify that a submitted request is not final confirmation. Provider API keys are never sent to the browser.</p>
      </section>
    </div>
    <section className="admin-panel admin-format-panel"><div className="admin-panel__heading"><div><h3>Lesson formats & participant limits</h3><p>Limits are enforced by the server. Confirm every maximum against the real teaching format before enabling online requests.</p></div></div>
      <div className="admin-format-list">{formats.map((format) => <FormatEditor key={format.code} format={format} busy={busy} onChange={updateFormat} onSave={saveFormat} />)}</div>
    </section>
  </section>
}

function FormatEditor({ format, busy, onChange, onSave }: { format: LessonFormat; busy: boolean; onChange: (code: string, values: Partial<LessonFormat>) => void; onSave: (format: LessonFormat) => void }) {
  return <article className="admin-format-row"><div className="admin-format-info"><strong>{format.label}</strong><span>{format.lessonType} · {format.durationMinutes} minutes</span><code>{format.code}</code></div><label>Maximum people<input type="number" min={1} max={30} value={format.maxParticipants} onChange={(event) => onChange(format.code, { maxParticipants: Number(event.target.value) })} /></label><label className="admin-checkbox-row"><input type="checkbox" checked={format.capacityConfirmed} onChange={(event) => onChange(format.code, { capacityConfirmed: event.target.checked })} />I verified this limit</label><label className="admin-checkbox-row"><input type="checkbox" checked={format.active} onChange={(event) => onChange(format.code, { active: event.target.checked })} />Active</label><label className="admin-checkbox-row"><input type="checkbox" checked={format.bookableOnline} onChange={(event) => onChange(format.code, { bookableOnline: event.target.checked })} />Online booking</label><button className="admin-secondary-button" disabled={busy || format.maxParticipants < 1 || format.maxParticipants > 30} onClick={() => onSave(format)}><Save size={15} />Save</button></article>
}
