import { useState, type FormEvent } from 'react'
import { bookingApi, useSchedule } from '../lib/bookings'
import { SLOTS, formatDateLong, slotLabel, todayISO } from '../lib/time'
import { Button, Card, ErrorText, Input, Label, Select, Spinner } from '../components/ui'

export function AdminBlocks() {
  const today = todayISO()
  const { blocks, bookings, loading, error, reload } = useSchedule(today)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [slot, setSlot] = useState<string>('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const affected = bookings.filter(
    (b) => b.date >= startDate && b.date <= endDate && (slot === '' || b.slot === Number(slot)),
  ).length

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await bookingApi.createBlock(startDate, endDate, slot === '' ? null : Number(slot), reason)
      setReason('')
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    setFormError(null)
    try {
      await bookingApi.deleteBlock(id)
      setConfirmDeleteId(null)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <form onSubmit={create} className="space-y-3">
          <h2 className="text-xl font-bold">Spärra pass</h2>
          <div>
            <Label htmlFor="b-start">Från datum</Label>
            <Input
              id="b-start"
              type="date"
              required
              min={today}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value > endDate) setEndDate(e.target.value)
              }}
            />
          </div>
          <div>
            <Label htmlFor="b-end">Till och med datum</Label>
            <Input id="b-end" type="date" required min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="b-slot">Pass</Label>
            <Select id="b-slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="">Hela dagen (alla pass)</option>
              {SLOTS.map((s) => (
                <option key={s.slot} value={s.slot}>
                  Pass {s.slot} ({s.label})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="b-reason">Anledning (visas för de boende)</Label>
            <Input
              id="b-reason"
              required
              maxLength={200}
              placeholder="t.ex. Service av maskinerna"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {affected > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
              {affected === 1 ? '1 befintlig bokning' : `${affected} befintliga bokningar`} tas bort och de boende får
              en notis med anledningen.
            </p>
          )}
          <ErrorText>{formError}</ErrorText>
          <Button type="submit" disabled={busy || !reason.trim()}>
            {busy ? 'Sparar…' : 'Spärra'}
          </Button>
        </form>
      </Card>

      <ErrorText>{error}</ErrorText>
      <h2 className="pt-2 text-lg font-bold">Aktuella spärrar</h2>
      {loading ? (
        <Spinner />
      ) : blocks.length === 0 ? (
        <p className="text-slate-600">Inga spärrar framåt.</p>
      ) : (
        blocks.map((b) => (
          <Card key={b.id}>
            <p className="text-lg font-semibold">
              {b.start_date === b.end_date
                ? capitalize(formatDateLong(b.start_date))
                : `${capitalize(formatDateLong(b.start_date))} – ${formatDateLong(b.end_date)}`}
            </p>
            <p className="text-slate-700">{b.slot ? `Pass ${b.slot} (${slotLabel(b.slot)})` : 'Hela dagen'}</p>
            <p className="text-slate-600">{b.reason}</p>
            {confirmDeleteId === b.id ? (
              <div className="mt-3 space-y-2">
                <Button variant="danger" onClick={() => remove(b.id)} disabled={busy}>
                  {busy ? 'Tar bort…' : 'Ja, ta bort spärren'}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDeleteId(null)} disabled={busy}>
                  Avbryt
                </Button>
              </div>
            ) : (
              <Button variant="ghost" className="mt-2 text-red-600" onClick={() => setConfirmDeleteId(b.id)}>
                Ta bort spärr
              </Button>
            )}
          </Card>
        ))
      )}
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
