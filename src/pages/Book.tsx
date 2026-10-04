import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { activeBookingFor, bookingApi, findBlock, useSchedule, type Block, type Booking } from '../lib/bookings'
import { SLOTS, addDays, addOneMonth, daysBetween, formatDayHeading, slotHasEnded, slotIsOngoing, slotLabel, todayISO } from '../lib/time'
import type { Apartment } from '../lib/types'
import { Button, Card, ErrorText, PageTitle, Spinner } from '../components/ui'
import { Sheet } from '../components/Sheet'

type Selection = { date: string; slot: number; booking?: Booking; block?: Block }

const DAYS_PER_PAGE = 7

/**
 * Bokningsschemat. Utan `adminFor` bokar man för sin egen lägenhet.
 * Med `adminFor` (bara från Admin-menyn) bokar och avbokar admin åt den lägenheten.
 */
export function Book({ adminFor }: { adminFor?: Pick<Apartment, 'id' | 'label'> } = {}) {
  const { resident } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const adminMode = !!adminFor
  const moveBookingId = adminMode ? undefined : (location.state as { moveBookingId?: string } | null)?.moveBookingId

  // Tick varje minut så att "passerat"/"pågår" uppdateras.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const today = todayISO(now)
  const lastDay = addOneMonth(today)
  const totalDays = daysBetween(today, lastDay) + 1
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE)

  const { bookings, blocks, loading, error, reload } = useSchedule(today)
  const apartmentId = adminFor?.id ?? resident?.apartment_id ?? null
  const activeBooking = activeBookingFor(bookings, apartmentId)
  const moveBooking = moveBookingId ? bookings.find((b) => b.id === moveBookingId) : undefined

  const [selection, setSelection] = useState<Selection | null>(null)

  const days = Array.from({ length: Math.min(visibleDays, totalDays) }, (_, i) => addDays(today, i))

  function exitMoveMode() {
    navigate('/', { replace: true, state: null })
  }

  return (
    <div className="mx-auto max-w-md">
      {adminMode ? (
        <h2 className="mb-3 text-xl font-bold">Boka åt lägenhet {adminFor.label}</h2>
      ) : (
        <PageTitle>Boka tvättid</PageTitle>
      )}

      {!adminMode && resident && !resident.apartment_id && (
        <Card className="mb-4 bg-amber-50">
          <p className="text-amber-900">
            Du är inte kopplad till någon lägenhet ännu, så du kan inte boka. Kontakta styrelsen.
          </p>
        </Card>
      )}

      {moveBookingId && (
        <Card className="mb-4 border-2 border-sky-300 bg-sky-50">
          <p className="font-semibold text-sky-900">Flytta bokning</p>
          <p className="mb-3 text-sky-900">
            {moveBooking
              ? `Välj ett nytt pass. Din nuvarande tid (${formatDayHeading(moveBooking.date, now).toLowerCase()} ${slotLabel(moveBooking.slot)}) behålls om flytten inte går igenom.`
              : 'Bokningen som skulle flyttas finns inte längre.'}
          </p>
          <Button variant="secondary" onClick={exitMoveMode}>
            Avbryt flytt
          </Button>
        </Card>
      )}

      {!moveBookingId && activeBooking && !adminMode && (
        <Link to="/min-bokning" className="block">
          <Card className="mb-4 bg-sky-50">
            <p className="text-sm font-medium text-sky-700">Din bokade tid</p>
            <p className="text-lg font-bold text-sky-900">
              {formatDayHeading(activeBooking.date, now)} {slotLabel(activeBooking.slot)}
            </p>
            <p className="text-sm text-sky-800">Tryck för att avboka eller flytta</p>
          </Card>
        </Link>
      )}

      {activeBooking && adminMode && (
        <Card className="mb-4 bg-sky-50">
          <p className="text-sm font-medium text-sky-700">Lägenhetens bokade tid</p>
          <p className="text-lg font-bold text-sky-900">
            {formatDayHeading(activeBooking.date, now)} {slotLabel(activeBooking.slot)}
          </p>
          <p className="text-sm text-sky-800">
            Bokad av {activeBooking.resident?.name ?? 'okänd'}. Tryck på passet i listan för att avboka.
          </p>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          {days.map((date) => (
            <section key={date}>
              <h2 className="mb-2 text-lg font-bold">{formatDayHeading(date, now)}</h2>
              <div className="space-y-2">
                {SLOTS.map((s) => {
                  const booking = bookings.find((b) => b.date === date && b.slot === s.slot)
                  const block = findBlock(blocks, date, s.slot)
                  return (
                    <SlotRow
                      key={s.slot}
                      label={s.label}
                      booking={booking}
                      block={block}
                      ended={slotHasEnded(date, s.slot, now)}
                      ongoing={slotIsOngoing(date, s.slot, now)}
                      isMine={!!booking && booking.apartment_id === apartmentId}
                      adminMode={adminMode}
                      onSelect={() => setSelection({ date, slot: s.slot, booking, block })}
                    />
                  )
                })}
              </div>
            </section>
          ))}
          {visibleDays < totalDays && (
            <Button variant="secondary" onClick={() => setVisibleDays((v) => v + DAYS_PER_PAGE)}>
              Visa fler dagar
            </Button>
          )}
          {visibleDays >= totalDays && (
            <p className="pb-2 text-center text-sm text-slate-500">
              Du kan boka till och med {formatDayHeading(lastDay, now).toLowerCase()}.
            </p>
          )}
        </div>
      )}

      <SlotSheet
        key={selection ? `${selection.date}-${selection.slot}` : 'none'}
        selection={selection}
        onClose={() => setSelection(null)}
        activeBooking={activeBooking}
        moveBooking={moveBooking}
        adminFor={adminFor}
        apartmentId={apartmentId}
        now={now}
        onDone={async (goToMyBooking) => {
          setSelection(null)
          await reload()
          if (moveBookingId) exitMoveMode()
          if (goToMyBooking && !adminMode) navigate('/min-bokning')
        }}
      />
    </div>
  )
}

function SlotRow({
  label,
  booking,
  block,
  ended,
  ongoing,
  isMine,
  adminMode,
  onSelect,
}: {
  label: string
  booking?: Booking
  block?: Block
  ended: boolean
  ongoing: boolean
  isMine: boolean
  adminMode: boolean
  onSelect: () => void
}) {
  const base = 'flex min-h-16 w-full items-center justify-between rounded-xl px-4 text-left'

  if (ended) {
    return (
      <div className={`${base} bg-slate-100 text-slate-400`}>
        <span className="text-lg font-semibold">{label}</span>
        <span>Passerat</span>
      </div>
    )
  }
  if (block) {
    return (
      <div className={`${base} bg-red-50 text-red-800`}>
        <span className="text-lg font-semibold">{label}</span>
        <span className="text-right text-sm">
          <span className="font-semibold">Spärrat</span>
          <br />
          {block.reason}
        </span>
      </div>
    )
  }
  if (booking) {
    // I vanliga vyn kan man bara trycka på sin egen bokning. I admin-läget på alla.
    const clickable = isMine || adminMode
    const content = (
      <>
        <span className="text-lg font-semibold">{label}</span>
        <span className="text-right">
          {isMine ? (
            <span className="font-semibold">{adminMode ? 'Lägenhetens bokning' : 'Din bokning'}</span>
          ) : (
            <>
              <span className="font-semibold">Bokad</span>
              <br />
              <span className="text-sm">
                {booking.resident?.name ?? 'Okänd'}
                {booking.apartment ? `, lgh ${booking.apartment.label}` : ''}
              </span>
            </>
          )}
        </span>
      </>
    )
    const cls = isMine ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
    return clickable ? (
      <button type="button" onClick={onSelect} className={`${base} ${cls} active:opacity-80`}>
        {content}
      </button>
    ) : (
      <div className={`${base} ${cls}`}>{content}</div>
    )
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${base} border-2 border-green-600 bg-green-50 text-green-900 active:bg-green-100`}
    >
      <span className="text-lg font-semibold">{label}</span>
      <span className="font-semibold">{ongoing ? 'Ledig nu' : 'Ledig'}</span>
    </button>
  )
}

function SlotSheet({
  selection,
  onClose,
  activeBooking,
  moveBooking,
  adminFor,
  apartmentId,
  now,
  onDone,
}: {
  selection: Selection | null
  onClose: () => void
  activeBooking?: Booking
  moveBooking?: Booking
  adminFor?: Pick<Apartment, 'id' | 'label'>
  apartmentId: string | null
  now: Date
  onDone: (goToMyBooking: boolean) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!selection) return null
  const { date, slot, booking } = selection
  const title = `${formatDayHeading(date, now)} ${slotLabel(slot)}`
  const adminMode = !!adminFor
  const whose = adminMode ? `lägenhet ${adminFor.label}` : 'din lägenhet'

  async function run(fn: () => Promise<unknown>, goToMyBooking = false) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await onDone(goToMyBooking)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setBusy(false)
    }
  }

  // Befintlig bokning
  if (booking) {
    const mine = booking.apartment_id === apartmentId
    return (
      <Sheet open onClose={onClose}>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mb-4 text-slate-600">
          {mine && !adminMode
            ? 'Din lägenhets bokning'
            : `Bokad av ${booking.resident?.name ?? 'okänd'}${booking.apartment ? `, lgh ${booking.apartment.label}` : ''}`}
          {adminMode && ' (du avbokar som admin)'}
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="mt-3 space-y-2">
          <Button variant="danger" disabled={busy} onClick={() => run(() => bookingApi.cancel(booking.id))}>
            {busy ? 'Avbokar…' : 'Avboka'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Stäng
          </Button>
        </div>
      </Sheet>
    )
  }

  // Flyttläge (bara i vanliga vyn)
  if (moveBooking) {
    return (
      <Sheet open onClose={onClose}>
        <h2 className="text-xl font-bold">Flytta hit?</h2>
        <p className="mb-4 text-slate-600">
          Din bokning flyttas från {formatDayHeading(moveBooking.date, now).toLowerCase()} {slotLabel(moveBooking.slot)} till{' '}
          <strong>{title.toLowerCase()}</strong>.
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="mt-3 space-y-2">
          <Button disabled={busy} onClick={() => run(() => bookingApi.move(moveBooking.id, date, slot), true)}>
            {busy ? 'Flyttar…' : 'Flytta bokningen'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
        </div>
      </Sheet>
    )
  }

  // Lägenheten har redan en aktiv bokning: erbjud flytt
  if (activeBooking) {
    return (
      <Sheet open onClose={onClose}>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mb-4 text-slate-600">
          {capitalize(whose)} har redan en bokad tid: {formatDayHeading(activeBooking.date, now).toLowerCase()}{' '}
          {slotLabel(activeBooking.slot)}. Varje lägenhet kan bara ha en tid åt gången. Vill du flytta den hit istället?
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="mt-3 space-y-2">
          <Button disabled={busy} onClick={() => run(() => bookingApi.move(activeBooking.id, date, slot), true)}>
            {busy ? 'Flyttar…' : 'Flytta bokningen hit'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
        </div>
      </Sheet>
    )
  }

  // Ledigt pass
  return (
    <Sheet open onClose={onClose}>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mb-4 text-slate-600">
        {adminMode ? `Boka det här passet åt lägenhet ${adminFor.label}?` : 'Vill du boka det här passet?'}
      </p>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 space-y-2">
        <Button
          disabled={busy || !apartmentId}
          onClick={() => run(() => bookingApi.book(date, slot, adminMode ? adminFor.id : undefined), true)}
        >
          {busy ? 'Bokar…' : 'Boka'}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Avbryt
        </Button>
      </div>
    </Sheet>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
