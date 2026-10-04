import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { activeBookingFor, bookingApi, useSchedule } from '../lib/bookings'
import { formatDateLong, formatDayHeading, slotIsOngoing, slotLabel, todayISO } from '../lib/time'
import { Button, Card, ErrorText, PageTitle, Spinner } from '../components/ui'

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
      <PageTitle>Min bokning</PageTitle>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <Spinner />
      ) : !resident?.apartment_id ? (
        <Card>
          <p className="text-slate-600">Du är inte kopplad till någon lägenhet ännu. Kontakta styrelsen.</p>
        </Card>
      ) : !booking ? (
        <Card>
          <p className="mb-4 text-lg text-slate-700">Din lägenhet har ingen bokad tid just nu.</p>
          <Button onClick={() => navigate('/')}>Boka en tid</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="bg-sky-50">
            <p className="text-sm font-medium text-sky-700">
              {slotIsOngoing(booking.date, booking.slot) ? 'Pågår nu' : formatDayHeading(booking.date)}
            </p>
            <p className="text-3xl font-bold text-sky-900">{slotLabel(booking.slot)}</p>
            <p className="mt-1 text-sky-900">{capitalize(formatDateLong(booking.date))}</p>
            <p className="mt-2 text-sm text-sky-800">
              Bokad av {booking.resident?.name ?? 'okänd'}
              {booking.apartment ? `, lägenhet ${booking.apartment.label}` : ''}
            </p>
          </Card>

          <ErrorText>{actionError}</ErrorText>

          {!confirmCancel ? (
            <>
              <Button variant="secondary" onClick={() => navigate('/', { state: { moveBookingId: booking.id } })}>
                Flytta till annan tid
              </Button>
              <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                Avboka
              </Button>
            </>
          ) : (
            <Card className="border-2 border-red-200">
              <p className="mb-3 text-lg">Vill du avboka din tid?</p>
              <div className="space-y-2">
                <Button variant="danger" onClick={cancel} disabled={busy}>
                  {busy ? 'Avbokar…' : 'Ja, avboka'}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmCancel(false)} disabled={busy}>
                  Nej, behåll
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
