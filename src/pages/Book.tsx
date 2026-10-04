import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { activeBookingFor, bookingApi, findBlock, useSchedule, type Block, type Booking } from '../lib/bookings'
import { SLOTS, addDays, addOneMonth, daysBetween, formatDayHeading, slotHasEnded, slotIsOngoing, slotLabel, todayISO } from '../lib/time'
import type { Apartment } from '../lib/types'
import { Button, Card, ErrorText, Label, PageTitle, Select, Spinner } from '../components/ui'
import { Sheet } from '../components/Sheet'

type Selection = { date: string; slot: number; booking?: Booking; block?: Block }

const DAYS_PER_PAGE = 7

export function Book() {
  const { resident } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const moveBookingId = (location.state as { moveBookingId?: string } | null)?.moveBookingId

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
  const myApartmentId = resident?.apartment_id ?? null
  const activeBooking = activeBookingFor(bookings, myApartmentId)
  const moveBooking = moveBookingId ? bookings.find((b) => b.id === moveBookingId) : undefined

  const [selection, setSelection] = useState<Selection | null>(null)

  const days = Array.from({ length: Math.min(visibleDays, totalDays) }, (_, i) => addDays(today, i))

  function exitMoveMode() {
    navigate('/', { replace: true, state: null })
  }

  return (
    <div className="mx-auto max-w-md">
      <PageTitle>Boka tvättid</PageTitle>

      {resident && !resident.apartment_id && !resident.is_admin && (
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

      {!moveBookingId && activeBooking && (
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
                  const ended = slotHasEnded(date, s.slot, now)
                  const ongoing = slotIsOngoing(date, s.slot, now)
                  return (
                    <SlotRow
                      key={s.slot}
                      label={s.label}
                      booking={booking}
                      block={block}
                      ended={ended}
                      ongoing={ongoing}
                      isMine={!!booking && booking.apartment_id === myApartmentId}
                      isAdmin={!!resident?.is_admin}
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
        isAdmin={!!resident?.is_admin}
        myApartmentId={myApartmentId}
        now={now}
        onDone={async (goToMyBooking) => {
          setSelection(null)
          await reload()
          if (moveBookingId) exitMoveMode()
          if (goToMyBooking) navigate('/min-bokning')
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
  isAdmin,
  onSelect,
}: {
  label: string
  booking?: Booking
  block?: Block
  ended: boolean
  ongoing: boolean
  isMine: boolean
  isAdmin: boolean
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
    const clickable = isMine || isAdmin
    const content = (
      <>
        <span className="text-lg font-semibold">{label}</span>
        <span className="text-right">
          {isMine ? (
            <span className="font-semibold">Din bokning</span>
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
  isAdmin,
  myApartmentId,
  now,
  onDone,
}: {
  selection: Selection | null
  onClose: () => void
  activeBooking?: Booking
  moveBooking?: Booking
  isAdmin: boolean
  myApartmentId: string | null
  now: Date
  onDone: (goToMyBooking: boolean) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [forApartment, setForApartment] = useState<string>(myApartmentId ?? '')

  // Panelen får ny key per valt pass, så state nollställs automatiskt.
  useEffect(() => {
    if (selection && isAdmin && !selection.booking) {
      supabase
        .from('apartments')
        .select('*')
        .order('label')
        .then(({ data }) => setApartments((data as Apartment[]) ?? []))
    }
  }, [selection, isAdmin])

  if (!selection) return null
  const { date, slot, booking } = selection
  const title = `${formatDayHeading(date, now)} ${slotLabel(slot)}`
  const bookingForOther = isAdmin && forApartment !== myApartmentId

  async function run(fn: () => Promise<void>, goToMyBooking = false) {
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

  // Befintlig bokning (egen eller admin)
  if (booking) {
    const mine = booking.apartment_id === myApartmentId
    return (
      <Sheet open onClose={onClose}>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mb-4 text-slate-600">
          {mine ? 'Din lägenhets bokning' : `Bokad av ${booking.resident?.name ?? 'okänd'}${booking.apartment ? `, lgh ${booking.apartment.label}` : ''}`}
          {!mine && isAdmin && ' (du är admin)'}
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

  // Flyttläge
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
          <Button disabled={busy} onClick={() => run(() => bookingApi.move(moveBooking.id, date, slot).then(() => {}), true)}>
            {busy ? 'Flyttar…' : 'Flytta bokningen'}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Avbryt
          </Button>
        </div>
      </Sheet>
    )
  }

  // Lägenheten har redan en aktiv bokning: erbjud flytt (om det är den egna lägenheten som bokar)
  if (activeBooking && !bookingForOther) {
    return (
      <Sheet open onClose={onClose}>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mb-4 text-slate-600">
          Din lägenhet har redan en bokad tid: {formatDayHeading(activeBooking.date, now).toLowerCase()}{' '}
          {slotLabel(activeBooking.slot)}. Varje lägenhet kan bara ha en tid åt gången. Vill du flytta den hit istället?
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="mt-3 space-y-2">
          <Button disabled={busy} onClick={() => run(() => bookingApi.move(activeBooking.id, date, slot).then(() => {}), true)}>
            {busy ? 'Flyttar…' : 'Flytta min bokning hit'}
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
      <p className="mb-4 text-slate-600">Vill du boka det här passet?</p>
      {isAdmin && (
        <div className="mb-4">
          <Label htmlFor="for-apartment">Boka för lägenhet</Label>
          <Select id="for-apartment" value={forApartment} onChange={(e) => setForApartment(e.target.value)}>
            {!myApartmentId && <option value="">Välj lägenhet</option>}
            {apartments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id === myApartmentId ? `${a.label} (min)` : a.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 space-y-2">
        <Button
          disabled={busy || (isAdmin && !forApartment)}
          onClick={() =>
            run(() => bookingApi.book(date, slot, isAdmin ? forApartment : undefined).then(() => {}), !bookingForOther)
          }
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
