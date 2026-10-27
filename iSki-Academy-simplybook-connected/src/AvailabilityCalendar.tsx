import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Clock3 } from 'lucide-react'

type CalendarBootstrap = {
  timezone: string
  openingTime: string
  closingTime: string
  bookingOpen: boolean
  seasonStart: string | null
  seasonEnd: string | null
}

type Slot = { startTime: string; endTime: string; availableInstructors: number }
type AvailabilityDay = { date: string; slots: Slot[] }
type AvailabilityResponse = { enabled: boolean; reason?: string; timezone: string; seasonStart?: string | null; seasonEnd?: string | null; days: AvailabilityDay[] }

type Props = {
  bootstrap: CalendarBootstrap
  formatCode: string
  preferredInstructorId: string
  selectedDate: string
  selectedTime: string
  refreshKey: number
  onSelect: (date: string, time: string) => void
}

const pad = (value: number) => String(value).padStart(2, '0')
const toIso = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
const monthStart = (month: string) => `${month}-01`
const monthEnd = (month: string) => {
  const [year, number] = month.split('-').map(Number)
  return `${year}-${pad(new Date(Date.UTC(year, number, 0)).getUTCDate())}`
}
const monthLabel = (month: string) => new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
const todayInBelgrade = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export default function AvailabilityCalendar({ bootstrap, formatCode, preferredInstructorId, selectedDate, selectedTime, refreshKey, onSelect }: Props) {
  const today = todayInBelgrade()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [days, setDays] = useState<AvailabilityDay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [enabled, setEnabled] = useState(bootstrap.bookingOpen)

  useEffect(() => {
    if (!formatCode) {
      setDays([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ from: monthStart(month), to: monthEnd(month), format: formatCode })
    if (preferredInstructorId) query.set('preferredInstructorId', preferredInstructorId)
    fetch(`/api/public/availability?${query.toString()}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error?.message || 'Availability could not be loaded.')
        return payload as AvailabilityResponse
      })
      .then((payload) => {
        setEnabled(Boolean(payload.enabled))
        setDays(payload.days || [])
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') {
          setError(reason?.message || 'Availability could not be loaded. Please contact iSki on WhatsApp.')
          setDays([])
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [formatCode, month, preferredInstructorId, refreshKey])

  const slotsByDate = useMemo(() => new Map(days.map((day) => [day.date, day.slots])), [days])
  const calendarCells = useMemo(() => {
    const [year, number] = month.split('-').map(Number)
    const first = new Date(Date.UTC(year, number - 1, 1))
    const offset = (first.getUTCDay() + 6) % 7
    const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
    return Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - offset + 1
      if (dayNumber < 1 || dayNumber > count) return null
      return toIso(new Date(Date.UTC(year, number - 1, dayNumber)))
    })
  }, [month])

  const [monthYear, monthNumber] = month.split('-').map(Number)
  const previousMonth = monthNumber === 1 ? `${monthYear - 1}-12` : `${monthYear}-${pad(monthNumber - 1)}`
  const nextMonth = monthNumber === 12 ? `${monthYear + 1}-01` : `${monthYear}-${pad(monthNumber + 1)}`
  const previousDisabled = previousMonth < today.slice(0, 7) || Boolean(bootstrap.seasonStart && previousMonth < bootstrap.seasonStart.slice(0, 7))
  const nextDisabled = Boolean(bootstrap.seasonEnd && nextMonth > bootstrap.seasonEnd.slice(0, 7))
  const selectedSlots = selectedDate ? slotsByDate.get(selectedDate) || [] : []
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function moveMonth(next: string) {
    setMonth(next)
    onSelect('', '')
  }

  return (
    <section className="availability-card" aria-labelledby="availability-title">
      <div className="availability-card__heading">
        <div className="availability-card__icon"><CalendarDays size={20} /></div>
        <div>
          <h3 id="availability-title">Choose a date and start time</h3>
          <p>All times are in Serbia · {bootstrap.openingTime}–{bootstrap.closingTime} · 60-minute start intervals</p>
        </div>
      </div>

      {error && <p className="availability-alert" role="alert"><AlertCircle size={17} />{error}</p>}
      {!error && !enabled && <p className="availability-alert" role="status"><Clock3 size={17} />Online calendar is not open yet. Message iSki on WhatsApp and the team can check dates for you.</p>}

      <div className={`availability-layout ${!enabled ? 'availability-layout--disabled' : ''}`}>
        <div className="availability-month">
          <div className="availability-month__bar">
            <button type="button" className="availability-arrow" disabled={previousDisabled || loading} onClick={() => moveMonth(previousMonth)} aria-label="Previous month"><ArrowLeft size={18} /></button>
            <strong>{monthLabel(month)}</strong>
            <button type="button" className="availability-arrow" disabled={nextDisabled || loading} onClick={() => moveMonth(nextMonth)} aria-label="Next month"><ArrowRight size={18} /></button>
          </div>
          <div className="availability-grid" role="grid" aria-label={`${monthLabel(month)} availability`}>
            {weekdayLabels.map((day) => <span className="availability-grid__weekday" key={day}>{day}</span>)}
            {calendarCells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} className="availability-grid__empty" aria-hidden="true" />
              const slots = slotsByDate.get(date) || []
              const available = enabled && slots.length > 0 && date >= today
              const picked = selectedDate === date
              const inSeason = (!bootstrap.seasonStart || date >= bootstrap.seasonStart) && (!bootstrap.seasonEnd || date <= bootstrap.seasonEnd)
              return <button
                key={date}
                type="button"
                className={`availability-day ${available ? 'is-available' : ''} ${picked ? 'is-selected' : ''}`}
                disabled={!available || loading || !inSeason}
                aria-pressed={picked}
                aria-label={`${date}${available ? `, ${slots.length} available start times` : ', unavailable'}`}
                onClick={() => onSelect(date, '')}
              >
                <span>{Number(date.slice(-2))}</span>
                {available && <small>{slots.length} {slots.length === 1 ? 'slot' : 'slots'}</small>}
              </button>
            })}
          </div>
          {loading && <p className="availability-footnote" aria-live="polite">Checking instructor calendars…</p>}
          {!loading && enabled && !days.some((day) => day.slots.length) && <p className="availability-footnote">No open starts in this month for this lesson length. Try another month or contact the team.</p>}
        </div>

        <div className="availability-times" aria-live="polite">
          <h4>{selectedDate ? new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${selectedDate}T00:00:00Z`)) : 'Available start times'}</h4>
          {!selectedDate && <p>Select a highlighted day to see its open starts.</p>}
          {selectedDate && !selectedSlots.length && <p>No open starts on this date. Choose another highlighted day.</p>}
          <div className="availability-time-list">
            {selectedSlots.map((slot) => {
              const picked = selectedTime === slot.startTime
              return <button
                type="button"
                key={slot.startTime}
                className={`availability-time ${picked ? 'is-selected' : ''}`}
                aria-pressed={picked}
                onClick={() => onSelect(selectedDate, slot.startTime)}
              >
                <strong>{slot.startTime}</strong><span>– {slot.endTime}</span>
                <small>{slot.availableInstructors} {slot.availableInstructors === 1 ? 'instructor' : 'instructors'} available</small>
              </button>
            })}
          </div>
        </div>
      </div>
      <p className="availability-disclaimer">A request reserves this instructor interval while iSki follows up. Your lesson is confirmed only when the team contacts you.</p>
    </section>
  )
}
