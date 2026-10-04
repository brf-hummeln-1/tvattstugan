import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { activeBookingFor, bookingApi, findBlock, useSchedule, type Block, type Booking } from '../lib/bookings'
import { SLOTS, addDays, addOneMonth, daysBetween, formatDayHeading, slotHasEnded, slotIsOngoing, slotLabel, todayISO } from '../lib/time'
import type { Apartment } from '../lib/types'
import { Button, ErrorText, ListGroup, PageTitle, Pill, SectionFooter, SectionHeader, Spinner } from '../components/ui'
import { ChevronRight } from '../components/icons'
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
        <h2 className="mb-3 text-[22px] font-bold tracking-[-0.01em]">Boka åt lägenhet {adminFor.label}</h2>
      ) : (
        <PageTitle>Boka</PageTitle>
      )}

      {!adminMode && resident && !resident.apartment_id && (
        <div className="mb-4 rounded-ios bg-ios-orange-soft px-4 py-3 text-[15px]">
          Du är inte kopplad till någon lägenhet ännu, så du kan inte boka. Kontakta styrelsen.
        </div>
      )}

      {moveBookingId && (
        <div className="mb-4 rounded-ios bg-ios-tint-soft p-4">
          <p className="text-[17px] font-semibold text-ios-tint">Flytta bokning</p>
          <p className="mb-3 text-[15px] text-ios-label">
            {moveBooking
              ? `Välj ett nytt pass. Din nuvarande tid (${formatDayHeading(moveBooking.date, now).toLowerCase()} ${slotLabel(moveBooking.slot)}) behålls om flytten inte går igenom.`
              : 'Bokningen som skulle flyttas finns inte längre.'}
          </p>
          <Button variant="secondary" onClick={exitMoveMode}>
            Avbryt flytt
          </Button>
        </div>
      )}

      {!moveBookingId && activeBooking && (
        <button
          type="button"
          onClick={() => !adminMode && navigate('/min-bokning')}
          className={`pressable mb-2 flex w-full items-center rounded-ios bg-ios-tint px-4 py-3 text-left text-white ${adminMode ? 'cursor-default' : ''}`}
        >
          <span className="flex-1">
            <span className="block text-[13px] font-medium text-white/80">{adminMode ? 'Lägenhetens bokade tid' : 'Din bokade tid'}</span>
            <span className="block text-[20px] font-bold">
              {formatDayHeading(activeBooking.date, now)} {slotLabel(activeBooking.slot)}
            </span>
            {adminMode && (
              <span className="block text-[13px] text-white/80">Bokad av {activeBooking.resident?.name ?? 'okänd'}</span>
            )}
          </span>
          {!adminMode && <ChevronRight className="text-white/70" />}
        </button>
      )}

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <Spinner />
      ) : (
        <div>
          {days.map((date) => (
            <section key={date}>
              <SectionHeader>{formatDayHeading(date, now)}</SectionHeader>
              <ListGroup>
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
              </ListGroup>
            </section>
          ))}
          <div className="mt-6">
            {visibleDays < totalDays ? (
              <Button variant="secondary" onClick={() => setVisibleDays((v) => v + DAYS_PER_PAGE)}>
                Visa fler dagar
              </Button>
            ) : (
              <SectionFooter>Du kan boka till och med {formatDayHeading(lastDay, now).toLowerCase()}.</SectionFooter>
            )}
          </div>
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
  const base = 'flex min-h-[56px] w-full items-center gap-3 px-4 text-left'
  const time = (muted = false) => (
    <span className={`w-16 flex-none text-[17px] font-semibold tabular-nums ${muted ? 'text-ios-label-3' : ''}`}>{label}</span>
  )

  if (ended) {
    return (
      <div className={base}>
        {time(true)}
        <span className="flex-1 text-[15px] text-ios-label-3">Passerat</span>
      </div>
    )
  }
  if (block) {
    return (
      <div className={base}>
        {time()}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ios-red">Spärrat</span>
          <span className="block truncate text-[13px] text-ios-label-2">{block.reason}</span>
        </span>
      </div>
    )
  }
  if (booking) {
    const clickable = isMine || adminMode
    const content = (
      <>
        {time()}
        <span className="min-w-0 flex-1">
          {isMine ? (
            <span className="block text-[15px] font-medium text-ios-tint">{adminMode ? 'Lägenhetens bokning' : 'Din bokning'}</span>
          ) : (
            <>
              <span className="block text-[15px] text-ios-label-2">Bokad</span>
              <span className="block truncate text-[13px] text-ios-label-2">
                {booking.resident?.name ?? 'Okänd'}
                {booking.apartment ? ` · lgh ${booking.apartment.label}` : ''}
              </span>
            </>
          )}
        </span>
        {isMine && <Pill tone="tint">Din</Pill>}
        {clickable && <ChevronRight className="text-ios-label-3" />}
      </>
    )
    return clickable ? (
      <button type="button" onClick={onSelect} className={`pressable-row ${base} ${isMine ? 'bg-ios-tint-soft' : ''}`}>
        {content}
      </button>
    ) : (
      <div className={base}>{content}</div>
    )
  }
  return (
    <button type="button" onClick={onSelect} className={`pressable-row ${base}`}>
      {time()}
      <span className="flex-1 text-[15px] text-ios-label-2">{ongoing ? 'Ledig nu' : 'Ledig'}</span>
      <Pill tone="green">Boka</Pill>
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

  if (booking) {
    const mine = booking.apartment_id === apartmentId
    return (
      <Sheet open onClose={onClose}>
        <Title>{title}</Title>
        <Text>
          {mine && !adminMode
            ? 'Din lägenhets bokning.'
            : `Bokad av ${booking.resident?.name ?? 'okänd'}${booking.apartment ? `, lgh ${booking.apartment.label}` : ''}.`}
          {adminMode && ' Du avbokar som admin.'}
        </Text>
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

  if (moveBooking) {
    return (
      <Sheet open onClose={onClose}>
        <Title>Flytta hit?</Title>
        <Text>
          Din bokning flyttas från {formatDayHeading(moveBooking.date, now).toLowerCase()} {slotLabel(moveBooking.slot)} till{' '}
          <strong className="text-ios-label">{title.toLowerCase()}</strong>.
        </Text>
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

  if (activeBooking) {
    return (
      <Sheet open onClose={onClose}>
        <Title>{title}</Title>
        <Text>
          {capitalize(whose)} har redan en bokad tid: {formatDayHeading(activeBooking.date, now).toLowerCase()}{' '}
          {slotLabel(activeBooking.slot)}. Varje lägenhet kan bara ha en tid åt gången. Vill du flytta den hit istället?
        </Text>
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

  return (
    <Sheet open onClose={onClose}>
      <Title>{title}</Title>
      <Text>{adminMode ? `Boka det här passet åt lägenhet ${adminFor.label}?` : 'Vill du boka det här passet?'}</Text>
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

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[22px] font-bold tracking-[-0.01em]">{children}</h2>
}

function Text({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 mt-1 text-[15px] text-ios-label-2">{children}</p>
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
