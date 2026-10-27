import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, Check, Clock3, MessageCircle } from 'lucide-react'
import { trackConversion } from './analytics'
import AvailabilityCalendar from './AvailabilityCalendar'

type BookingSource = 'Families' | 'Kids' | 'Adults' | 'Performance' | 'Partner' | 'Instagram' | 'Google'
type LessonType = 'Kids' | 'Family' | 'Adult Private' | 'Performance Coaching'
type LessonFormat = { code: string; lessonType: LessonType; label: string; durationMinutes: number; maxParticipants: number }
type Bootstrap = {
  timezone: string
  openingTime: string
  closingTime: string
  bookingOpen: boolean
  seasonStart: string | null
  seasonEnd: string | null
  formats: LessonFormat[]
  instructors: { id: number; displayName: string }[]
}
type SavedBooking = {
  bookingId: string
  status: string
  lesson: string
  durationMinutes: number
  localDate: string
  startTime: string
  endTime: string
  timezone: string
  emailStatus: string
  message: string
}
type BookingFormValues = {
  fullName: string
  email: string
  whatsapp: string
  lessonType: LessonType
  formatCode: string
  localDate: string
  startTime: string
  participants: string
  skillLevel: string
  preferredInstructorId: string
  message: string
  source: BookingSource
  website: string
}

const BOOKING_SOURCES: BookingSource[] = ['Families', 'Kids', 'Adults', 'Performance', 'Partner', 'Instagram', 'Google']
const LESSON_TYPES: LessonType[] = ['Kids', 'Family', 'Adult Private', 'Performance Coaching']
const SKILL_LEVELS = ['First timer', 'Beginner', 'Intermediate', 'Advanced']
const SOURCE_LESSON: Record<BookingSource, LessonType> = {
  Families: 'Family', Kids: 'Kids', Adults: 'Adult Private', Performance: 'Performance Coaching',
  Partner: 'Adult Private', Instagram: 'Adult Private', Google: 'Adult Private',
}

function initialSource(value: string): BookingSource {
  return BOOKING_SOURCES.includes(value as BookingSource) ? value as BookingSource : 'Google'
}

function whatsappUrl(message: string) {
  return `https://wa.me/381631016260?text=${encodeURIComponent(message)}`
}

function localDateLabel(date: string, start: string, end: string) {
  if (!date) return ''
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  const month = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
  return `${weekday}, ${month} · ${start}–${end} (Europe/Belgrade)`
}

function enquiryMessage(form: BookingFormValues, result: SavedBooking, instructorName?: string) {
  return [
    'Hi iSki Academy, I have submitted a lesson request and would like to confirm it.',
    `Reference: ${result.bookingId}`,
    `Name: ${form.fullName.trim()}`,
    `Email: ${form.email.trim()}`,
    `WhatsApp: ${form.whatsapp.trim()}`,
    `Lesson: ${result.lesson}`,
    `Date/time: ${localDateLabel(result.localDate, result.startTime, result.endTime)}`,
    `Participants: ${form.participants}`,
    `Skill level: ${form.skillLevel}`,
    `Preferred instructor: ${instructorName || (form.preferredInstructorId ? 'Selected instructor' : 'No preference')}`, 
    `Source: ${form.source}`,
    form.message.trim() ? `Message: ${form.message.trim()}` : '',
  ].filter(Boolean).join('\n')
}

function formatDuration(minutes: number) {
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function BookingForm({ initialSource: sourceValue = 'Google' }: { initialSource?: string }) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null)
  const [bootstrapLoading, setBootstrapLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState('')
  const [source, setSource] = useState<BookingSource>(() => initialSource(sourceValue))
  const [form, setForm] = useState<BookingFormValues>(() => ({
    fullName: '', email: '', whatsapp: '', lessonType: SOURCE_LESSON[initialSource(sourceValue)],
    formatCode: '', localDate: '', startTime: '', participants: '1', skillLevel: 'First timer',
    preferredInstructorId: '', message: '', source: initialSource(sourceValue), website: '',
  }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<SavedBooking | null>(null)
  const [whatsAppMessage, setWhatsAppMessage] = useState('')
  const [closedWhatsAppOpened, setClosedWhatsAppOpened] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const normalized = initialSource(sourceValue)
    setSource(normalized)
    setForm((current) => ({ ...current, source: normalized, lessonType: SOURCE_LESSON[normalized], formatCode: '', localDate: '', startTime: '' }))
  }, [sourceValue])

  useEffect(() => {
    const controller = new AbortController()
    setBootstrapLoading(true)
    fetch('/api/public/bootstrap', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error?.message || 'The booking calendar is temporarily unavailable.')
        return payload as Bootstrap
      })
      .then((payload) => {
        setBootstrap(payload)
        setForm((current) => {
          const preferredFormat = payload.formats.find((format) => format.lessonType === current.lessonType)
            || payload.formats[0]
          return { ...current, formatCode: preferredFormat?.code || '', lessonType: preferredFormat?.lessonType || current.lessonType }
        })
      })
      .catch((reason) => { if (reason?.name !== 'AbortError') setBootstrapError(reason?.message || 'The booking calendar is temporarily unavailable.') })
      .finally(() => { if (!controller.signal.aborted) setBootstrapLoading(false) })
    return () => controller.abort()
  }, [])

  const formats = useMemo(() => bootstrap?.formats.filter((format) => format.lessonType === form.lessonType) || [], [bootstrap, form.lessonType])
  const selectedFormat = bootstrap?.formats.find((format) => format.code === form.formatCode) || null

  useEffect(() => {
    if (!bootstrap) return
    if (!formats.some((format) => format.code === form.formatCode)) {
      setForm((current) => ({ ...current, formatCode: formats[0]?.code || '', lessonType: formats[0]?.lessonType || current.lessonType, localDate: '', startTime: '', participants: '1' }))
    }
  }, [bootstrap, form.formatCode, formats])

  function update<Key extends keyof BookingFormValues>(key: Key, value: BookingFormValues[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function changeLessonType(value: LessonType) {
    const format = bootstrap?.formats.find((item) => item.lessonType === value)
    setForm((current) => ({ ...current, lessonType: value, formatCode: format?.code || '', localDate: '', startTime: '', participants: '1' }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!bootstrap?.bookingOpen) {
      setError('Online booking is not open yet. Please contact iSki on WhatsApp to check your dates.')
      return
    }
    if (!selectedFormat) {
      setError('No online lesson format is available for this selection. Contact iSki on WhatsApp.')
      return
    }
    if (!form.localDate || !form.startTime) {
      setError('Choose an available date and start time before sending your request.')
      return
    }
    if (Number(form.participants) > selectedFormat.maxParticipants) {
      setError(`This format currently allows up to ${selectedFormat.maxParticipants} participant(s). Contact iSki if you need a larger group.`)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          whatsapp: form.whatsapp,
          lessonType: form.lessonType,
          formatCode: form.formatCode,
          localDate: form.localDate,
          startTime: form.startTime,
          participants: Number(form.participants),
          skillLevel: form.skillLevel,
          preferredInstructorId: form.preferredInstructorId || null,
          message: form.message,
          source: form.source,
          website: form.website,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409) {
          setForm((current) => ({ ...current, localDate: '', startTime: '' }))
          setRefreshKey((current) => current + 1)
        }
        throw new Error(payload?.error?.message || 'Your request could not be saved. Please try again.')
      }
      const result = payload.booking as SavedBooking
      const instructorName = bootstrap?.instructors.find((item) => String(item.id) === form.preferredInstructorId)?.displayName
      const message = enquiryMessage(form, result, instructorName)
      setWhatsAppMessage(message)
      setSubmitted(result)
      trackConversion('booking_form_submitted', { lesson_type: form.lessonType, source: form.source, format_code: form.formatCode })
      trackConversion('booking_confirmation_page_view', { lesson_type: form.lessonType, source: form.source })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your request could not be saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function continueInWhatsApp() {
    trackConversion('whatsapp_click', { source: 'booking_confirmation' })
    window.open(whatsappUrl(whatsAppMessage), '_blank', 'noopener,noreferrer')
  }

  function continueClosedEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!form.localDate) {
      setError('Please choose your preferred date so the team can check the right availability.')
      return
    }
    const lessonLabel = form.lessonType === 'Family' ? 'Family ski lessons' : form.lessonType === 'Kids' ? 'Kids ski lessons' : form.lessonType === 'Performance Coaching' ? 'Performance coaching with Igor' : 'Adult private ski lesson'
    const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${form.localDate}T00:00:00Z`))
    const instructor = bootstrap?.instructors.find((item) => String(item.id) === form.preferredInstructorId)?.displayName || (form.preferredInstructorId ? 'Preferred instructor requested' : 'No preference')
    const message = [
      'Hello iSki Academy, I would like to request ski lesson availability in Kopaonik.',
      '',
      `Lesson: ${lessonLabel}`,
      `Preferred date: ${dateLabel}`,
      `Preferred time: ${form.startTime || 'Flexible'}`,
      `Participants: ${form.participants}`,
      `Skill level: ${form.skillLevel}`,
      `Preferred instructor: ${instructor}`,
      `Name: ${form.fullName.trim()}`,
      `Email: ${form.email.trim()}`,
      `My WhatsApp: ${form.whatsapp.trim()}`,
      `Found iSki via: ${form.source}`,
      form.message.trim() ? `Additional details: ${form.message.trim()}` : '',
      '',
      'Please confirm whether an instructor is available and advise on the next steps. I understand this is a request, not a confirmed booking.'
    ].filter(Boolean).join('\n')
    trackConversion('booking_enquiry_whatsapp_opened', { lesson_type: form.lessonType, source: form.source })
    const popup = window.open(whatsappUrl(message), '_blank', 'noopener,noreferrer')
    if (!popup) {
      window.location.href = whatsappUrl(message)
      return
    }
    setClosedWhatsAppOpened(true)
  }

  if (submitted) {
    const timeLabel = localDateLabel(submitted.localDate, submitted.startTime, submitted.endTime)
    return (
      <section className="form-success" aria-live="polite" aria-labelledby="booking-success-title">
        <div className="form-success__icon"><Check size={32} /></div>
        <div className="section-label"><span />Request saved · {submitted.bookingId.slice(0, 8).toUpperCase()}</div>
        <h2 id="booking-success-title">Your next turn<br /><em>is in motion.</em></h2>
        <p><strong>{submitted.lesson}</strong> · {formatDuration(submitted.durationMinutes)}<br />{timeLabel}</p>
        <p>Your request is saved as <strong>New</strong> and the time is held against one instructor while iSki follows up. Your lesson is not confirmed until the team contacts you.</p>
        {submitted.emailStatus !== 'sent' && <p className="booking-form__notice">Email receipt is not available right now. Your request is stored; please continue in WhatsApp for a quick staff follow-up.</p>}
        <button className="btn btn--yellow" type="button" onClick={continueInWhatsApp}>Continue in WhatsApp <MessageCircle size={17} /></button>
      </section>
    )
  }

  if (((bootstrap && !bootstrap.bookingOpen) || bootstrapError) && !closedWhatsAppOpened) {
    return (
      <form className="booking-form booking-form--closed" onSubmit={continueClosedEnquiry} aria-labelledby="booking-closed-title">
        <div className="form-intro">
          <div className="section-label"><span />Personal booking support · Kopaonik</div>
          <h2 id="booking-closed-title">Let’s plan your<br /><em>time on the snow.</em></h2>
          <p>{bootstrapError ? 'The live calendar is temporarily unavailable. Share your preferred date and lesson details and WhatsApp will open with a ready-to-send request.' : 'The live calendar is not open for this season yet. You can still share your preferred date, lesson and group details; WhatsApp will open with your request ready to send.'}</p>
        </div>
        <div className="booking-closed__steps">
          <div><span>01</span><strong>Choose your lesson</strong><p>Select a format and tell us who is skiing.</p></div>
          <div><span>02</span><strong>Share your date</strong><p>Tell us when you would like to ski.</p></div>
          <div><span>03</span><strong>Confirm on WhatsApp</strong><p>The team checks availability and replies.</p></div>
        </div>
        <div className="form-grid booking-closed__form-grid">
          <label>Lesson type
            <select name="lessonType" required value={form.lessonType} onChange={(event) => changeLessonType(event.target.value as LessonType)}>
              {LESSON_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>Preferred date
            <input name="preferredDate" type="date" required value={form.localDate} onChange={(event) => update('localDate', event.target.value)} />
          </label>
          <label>Preferred time
            <select name="preferredTime" value={form.startTime} onChange={(event) => update('startTime', event.target.value)}>
              <option value="">Flexible</option><option value="Morning (09:00–12:00)">Morning</option><option value="Midday (12:00–14:00)">Midday</option><option value="Afternoon (14:00–17:00)">Afternoon</option>
            </select>
          </label>
          <label>Number of participants
            <input name="participants" type="number" required min="1" max="30" step="1" inputMode="numeric" value={form.participants} onChange={(event) => update('participants', event.target.value)} />
          </label>
          <label>Skill level
            <select name="skillLevel" required value={form.skillLevel} onChange={(event) => update('skillLevel', event.target.value)}>{SKILL_LEVELS.map((level) => <option key={level}>{level}</option>)}</select>
          </label>
          <label>Preferred instructor <span className="field-optional">Optional</span>
            <select name="preferredInstructorId" value={form.preferredInstructorId} onChange={(event) => update('preferredInstructorId', event.target.value)}><option value="">No preference</option>{bootstrap?.instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.displayName}</option>)}</select>
          </label>
          <label>Full name
            <input autoComplete="name" name="fullName" required maxLength={100} value={form.fullName} onChange={(event) => update('fullName', event.target.value)} placeholder="Your name" />
          </label>
          <label>Email
            <input autoComplete="email" name="email" required type="email" maxLength={160} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" />
          </label>
          <label>WhatsApp number
            <input autoComplete="tel" inputMode="tel" name="whatsapp" required type="tel" maxLength={32} pattern="\+?[0-9 ()\-.]{7,32}" value={form.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} placeholder="+381 …" />
          </label>
          <label>How did you find iSki?
            <select name="source" required value={source} onChange={(event) => { const value = event.target.value as BookingSource; setSource(value); update('source', value) }}>{BOOKING_SOURCES.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className="form-grid__wide">Anything else we should know? <span className="field-optional">Optional</span>
            <textarea name="message" maxLength={1000} value={form.message} onChange={(event) => update('message', event.target.value)} placeholder="Children’s ages, goals, dates you can be flexible with…" />
          </label>
        </div>
        {error && <p className="booking-form__error" role="alert"><AlertCircle size={16} />{error}</p>}
        <div className="form-bottom"><span className="booking-form__notice">This opens WhatsApp with your details. You must tap Send in WhatsApp; the lesson is only confirmed after the iSki team replies.</span><button className="btn btn--yellow" type="submit">Continue in WhatsApp <MessageCircle size={17} /></button></div>
      </form>
    )
  }

  if (closedWhatsAppOpened) {
    return <section className="form-success" aria-live="polite" aria-labelledby="booking-closed-success-title"><div className="form-success__icon"><MessageCircle size={30} /></div><div className="section-label"><span />WhatsApp request prepared</div><h2 id="booking-closed-success-title">One step<br /><em>left to send.</em></h2><p>WhatsApp opened with your lesson details filled in. Please review the message and tap <strong>Send</strong> to submit your enquiry to iSki Academy.</p><p className="booking-form__notice">Your lesson is not booked yet. The iSki team will check instructor availability and confirm the details with you.</p><button className="btn btn--yellow" type="button" onClick={() => setClosedWhatsAppOpened(false)}>Back to request details <ArrowRight size={17} /></button></section>
  }

  return (
    <form className="booking-form booking-form--live" onSubmit={submit}>
      <div className="form-intro">
        <div className="section-label"><span />Live availability · Europe/Belgrade</div>
        <h2>Choose a time.<br /><em>We’ll take it from there.</em></h2>
        <p>No account needed. See the dates and hourly starts that can fit the lesson you choose. Requests are saved before the iSki team confirms them.</p>
      </div>

      {bootstrap && !bootstrap.bookingOpen && <p className="booking-form__notice" role="status">The online calendar is not open yet. Message iSki on WhatsApp to check your dates while the team sets up the season schedule.</p>}
      {bootstrapError && <p className="booking-form__error" role="alert"><AlertCircle size={16} />{bootstrapError} A WhatsApp enquiry is still available below.</p>}
      <div className="form-grid">
        <label>Lesson type
          <select name="lessonType" required value={form.lessonType} onChange={(event) => changeLessonType(event.target.value as LessonType)}>
            {LESSON_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>Lesson format
          <select name="formatCode" required value={form.formatCode} disabled={bootstrapLoading || !formats.length} onChange={(event) => update('formatCode', event.target.value)}>
            {!formats.length && <option value="">No online formats configured</option>}
            {formats.map((format) => <option key={format.code} value={format.code}>{format.label}{bootstrap?.bookingOpen && format.maxParticipants > 0 ? ` · up to ${format.maxParticipants}` : ''}</option>)}
          </select>
        </label>
        {selectedFormat && <p className="booking-form__format-note form-grid__wide">This format blocks {formatDuration(selectedFormat.durationMinutes)} for one instructor. Start times are offered in one-hour intervals; longer lessons finish before the 17:00 Serbia closing time.</p>}
        {bootstrap && form.formatCode && selectedFormat && <div className="form-grid__wide">
          <AvailabilityCalendar
            bootstrap={bootstrap}
            formatCode={form.formatCode}
            preferredInstructorId={form.preferredInstructorId}
            selectedDate={form.localDate}
            selectedTime={form.startTime}
            refreshKey={refreshKey}
            onSelect={(localDate, startTime) => setForm((current) => ({ ...current, localDate, startTime }))}
          />
        </div>}
        <label>Full name
          <input autoComplete="name" name="fullName" required maxLength={100} value={form.fullName} onChange={(event) => update('fullName', event.target.value)} placeholder="Your name" />
        </label>
        <label>Email
          <input autoComplete="email" name="email" required type="email" maxLength={160} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" />
        </label>
        <label>WhatsApp number
          <input autoComplete="tel" inputMode="tel" name="whatsapp" required type="tel" maxLength={32} pattern="\+?[0-9 ()\-.]{7,32}" value={form.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} placeholder="+381 …" />
        </label>
        <label>Number of participants
          <input name="participants" required type="number" min="1" max={selectedFormat?.maxParticipants || 30} step="1" inputMode="numeric" value={form.participants} onChange={(event) => update('participants', event.target.value)} />
          {bootstrap?.bookingOpen && selectedFormat && selectedFormat.maxParticipants > 0 && <span className="booking-field-hint">Up to {selectedFormat.maxParticipants} for this format.</span>}
        </label>
        <label>Skill level
          <select name="skillLevel" required value={form.skillLevel} onChange={(event) => update('skillLevel', event.target.value)}>
            {SKILL_LEVELS.map((level) => <option key={level}>{level}</option>)}
          </select>
        </label>
        <label>Preferred instructor <span className="field-optional">Optional</span>
          <select name="preferredInstructorId" value={form.preferredInstructorId} onChange={(event) => { update('preferredInstructorId', event.target.value); update('localDate', ''); update('startTime', '') }}>
            <option value="">No preference</option>
            {bootstrap?.instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.displayName}</option>)}
          </select>
          {!bootstrap?.instructors.length && <span className="booking-field-hint">Ask on WhatsApp if you have a coach preference.</span>}
        </label>
        <label>How did you find iSki?
          <select name="source" required value={source} onChange={(event) => { const value = event.target.value as BookingSource; setSource(value); update('source', value) }}>
            {BOOKING_SOURCES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="form-grid__wide">Message <span className="field-optional">Optional</span>
          <textarea name="message" maxLength={1000} value={form.message} onChange={(event) => update('message', event.target.value)} placeholder="Anything the instructor should know about your group or goals?" />
        </label>
        <label className="booking-honeypot" aria-hidden="true">Website
          <input tabIndex={-1} autoComplete="off" name="website" value={form.website} onChange={(event) => update('website', event.target.value)} />
        </label>
      </div>

      {form.localDate && form.startTime && <p className="booking-form__selection"><Clock3 size={17} />Selected: {localDateLabel(form.localDate, form.startTime, '')} · {selectedFormat ? formatDuration(selectedFormat.durationMinutes) : ''}</p>}
      {error && <p className="booking-form__error" role="alert"><AlertCircle size={16} />{error}</p>}
      <div className="form-bottom">
        <span className="booking-form__notice">A saved request is not a confirmed lesson. The iSki team will follow up on WhatsApp to confirm availability. Your contact details are used to manage this request.</span>
        <button className="btn btn--primary" type="submit" disabled={submitting || bootstrapLoading || !bootstrap?.bookingOpen || !selectedFormat}>
          {submitting ? 'Saving request…' : bootstrap?.bookingOpen ? 'Request this time' : 'Online booking is closed'} <ArrowRight size={17} />
        </button>
      </div>
      <a className="booking-form__whatsapp" href="https://wa.me/381631016260?text=Hi%20iSki%20Academy%2C%20please%20help%20me%20check%20ski%20lesson%20availability." target="_blank" rel="noreferrer" onClick={() => trackConversion('whatsapp_click', { source: 'booking_form_help' })}>Need help or a larger group? Message iSki on WhatsApp <MessageCircle size={16} /></a>
    </form>
  )
}
