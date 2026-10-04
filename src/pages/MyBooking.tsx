import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { activeBookingFor, bookingApi, useSchedule } from '../lib/bookings'
import { formatDateLong, formatDayHeading, slotIsOngoing, slotLabel, todayISO } from '../lib/time'
import { Button, Card, ErrorText, PageTitle, Pill, Spinner } from '../components/ui'
import { Sheet } from '../components/Sheet'

export function MyBooking() {
  const { resident } = useAuth()
  const navigate = useNavigate()
  const today = todayISO()
  const { bookings, loading, error, reload } = useSchedule(today)
  const booking = activeBookingFor(bookings, resident?.apartment_id)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function cancel() {
    if (!booking) return
    setBusy(true)
    setActionError(null)
    try {
      await bookingApi.cancel(booking.id)
      setConfirmCancel(false)
      await reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageTitle>Min tid</PageTitle>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <Spinner />
      ) : !resident?.apartment_id ? (
        <Card>
          <p className="text-ios-label-2">Du är inte kopplad till någon lägenhet ännu. Kontakta styrelsen.</p>
        </Card>
      ) : !booking ? (
        <Card className="text-center">
          <p className="mb-1 text-[20px] font-semibold">Ingen bokad tid</p>
          <p className="mb-5 text-[15px] text-ios-label-2">Din lägenhet har ingen tid i tvättstugan just nu.</p>
          <Button onClick={() => navigate('/')}>Boka en tid</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card className="bg-ios-tint text-white">
            <div className="mb-2">
              {slotIsOngoing(booking.date, booking.slot) ? (
                <Pill tone="green">Pågår nu</Pill>
              ) : (
                <span className="text-[15px] font-medium text-white/80">{formatDayHeading(booking.date)}</span>
              )}
            </div>
            <p className="text-[44px] font-bold leading-none tracking-[-0.02em]">{slotLabel(booking.slot)}</p>
            <p className="mt-2 text-[17px] text-white/90">{capitalize(formatDateLong(booking.date))}</p>
            <p className="mt-3 text-[13px] text-white/70">
              Bokad av {booking.resident?.name ?? 'okänd'}
              {booking.apartment ? `, lägenhet ${booking.apartment.label}` : ''}
            </p>
          </Card>

          <ErrorText>{actionError}</ErrorText>
          <Button variant="tinted" onClick={() => navigate('/', { state: { moveBookingId: booking.id } })}>
            Flytta till annan tid
          </Button>
          <Button variant="secondary" className="text-ios-red" onClick={() => setConfirmCancel(true)}>
            Avboka
          </Button>

          <Sheet open={confirmCancel} onClose={() => setConfirmCancel(false)}>
            <h2 className="text-[22px] font-bold">Avboka din tid?</h2>
            <p className="mb-5 mt-1 text-[15px] text-ios-label-2">
              {formatDayHeading(booking.date)} {slotLabel(booking.slot)} blir ledig för andra.
            </p>
            <div className="space-y-2">
              <Button variant="danger" onClick={cancel} disabled={busy}>
                {busy ? 'Avbokar…' : 'Avboka'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmCancel(false)} disabled={busy}>
                Behåll tiden
              </Button>
            </div>
          </Sheet>
        </div>
      )}
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
