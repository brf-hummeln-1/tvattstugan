import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { adminApi } from '../lib/admin'
import type { Apartment, ResidentWithApartment } from '../lib/types'
import { Button, Card, ErrorText, Input, Label, PageTitle, Select, Spinner } from '../components/ui'
import { AdminBlocks } from './AdminBlocks'
import { AdminBookFor } from './AdminBookFor'

type ResidentForm = {
  name: string
  email: string
  phone: string
  apartment_id: string
  is_admin: boolean
}

const emptyForm: ResidentForm = { name: '', email: '', phone: '', apartment_id: '', is_admin: false }

export function Admin() {
  const { resident: me, refreshResident } = useAuth()
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [residents, setResidents] = useState<ResidentWithApartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'residents' | 'apartments' | 'blocks' | 'bookfor'>('residents')

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      supabase.from('apartments').select('*').order('label'),
      supabase.from('residents').select('*, apartment:apartments(id, label)').order('name'),
    ])
    if (a.error || r.error) {
      setError(a.error?.message ?? r.error?.message ?? 'Kunde inte hämta data')
    } else {
      setApartments(a.data as Apartment[])
      setResidents(r.data as ResidentWithApartment[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!me?.is_admin) {
    return (
      <div className="mx-auto max-w-md">
        <PageTitle>Admin</PageTitle>
        <ErrorText>Bara admin har tillgång till den här sidan.</ErrorText>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <Link to="/mer" className="mb-2 inline-block text-sky-700">
        ‹ Tillbaka
      </Link>
      <PageTitle>Admin</PageTitle>

      <div className="mb-4 flex rounded-xl bg-slate-200 p-1">
        {(
          [
            ['residents', 'Boende'],
            ['apartments', 'Lgh'],
            ['blocks', 'Spärrar'],
            ['bookfor', 'Boka åt'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-12 flex-1 rounded-lg text-sm font-semibold ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <Spinner />
      ) : tab === 'residents' ? (
        <ResidentsAdmin
          apartments={apartments}
          residents={residents}
          meId={me.id}
          onChanged={async () => {
            await load()
            await refreshResident()
          }}
        />
      ) : tab === 'apartments' ? (
        <ApartmentsAdmin apartments={apartments} residents={residents} onChanged={load} />
      ) : tab === 'blocks' ? (
        <AdminBlocks />
      ) : (
        <AdminBookFor apartments={apartments} />
      )}
    </div>
  )
}

function ResidentsAdmin({
  apartments,
  residents,
  meId,
  onChanged,
}: {
  apartments: Apartment[]
  residents: ResidentWithApartment[]
  meId: string
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState<ResidentWithApartment | 'new' | null>(null)

  return (
    <div className="space-y-3">
      <Button onClick={() => setEditing('new')}>+ Lägg till boende</Button>

      {editing && (
        <ResidentEditor
          apartments={apartments}
          resident={editing === 'new' ? null : editing}
          isMe={editing !== 'new' && editing.id === meId}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await onChanged()
          }}
        />
      )}

      {residents.length === 0 && <p className="text-slate-600">Inga boende tillagda ännu.</p>}
      {residents.map((r) => (
        <Card key={r.id}>
          <button type="button" className="w-full text-left" onClick={() => setEditing(r)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">
                  {r.name}
                  {r.is_admin && (
                    <span className="ml-2 rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                      Admin
                    </span>
                  )}
                </p>
                <p className="text-slate-600">
                  {r.apartment ? `Lägenhet ${r.apartment.label}` : 'Ingen lägenhet'}
                </p>
                <p className="text-sm text-slate-500">{r.email}</p>
                {r.phone && <p className="text-sm text-slate-500">{r.phone}</p>}
              </div>
              <span className="text-slate-400">›</span>
            </div>
          </button>
        </Card>
      ))}
    </div>
  )
}

function ResidentEditor({
  apartments,
  resident,
  isMe,
  onClose,
  onSaved,
}: {
  apartments: Apartment[]
  resident: ResidentWithApartment | null
  isMe: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [form, setForm] = useState<ResidentForm>(
    resident
      ? {
          name: resident.name,
          email: resident.email,
          phone: resident.phone ?? '',
          apartment_id: resident.apartment_id ?? '',
          is_admin: resident.is_admin,
        }
      : emptyForm,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        apartment_id: form.apartment_id || null,
        is_admin: form.is_admin,
      }
      if (resident) {
        await adminApi.updateResident(resident.id, payload)
      } else {
        await adminApi.createResident(payload)
      }
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!resident) return
    setBusy(true)
    setError(null)
    try {
      await adminApi.deleteResident(resident.id)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
      setBusy(false)
    }
  }

  return (
    <Card className="border-2 border-sky-200">
      <form onSubmit={save} className="space-y-3">
        <h2 className="text-xl font-bold">{resident ? 'Ändra boende' : 'Ny boende'}</h2>
        <div>
          <Label htmlFor="r-name">Namn</Label>
          <Input
            id="r-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="r-email">Mejladress</Label>
          <Input
            id="r-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="r-phone">Telefon (valfritt)</Label>
          <Input
            id="r-phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="r-apartment">Lägenhet</Label>
          <Select
            id="r-apartment"
            value={form.apartment_id}
            onChange={(e) => setForm({ ...form, apartment_id: e.target.value })}
          >
            <option value="">Ingen lägenhet</option>
            {apartments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
          {apartments.length === 0 && (
            <p className="mt-1 text-sm text-slate-500">Lägg till lägenheter under fliken Lägenheter.</p>
          )}
        </div>
        <label className="flex min-h-12 items-center gap-3 text-lg">
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={form.is_admin}
            disabled={isMe}
            onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
          />
          Admin (styrelsen)
        </label>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sparar…' : 'Spara'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Avbryt
        </Button>
        {resident && !isMe && !confirmDelete && (
          <Button type="button" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}>
            Radera boende
          </Button>
        )}
        {resident && confirmDelete && (
          <div className="rounded-xl bg-red-50 p-3">
            <p className="mb-3 text-red-800">
              Radera <strong>{resident.name}</strong>? Kontot och alla bokningar, meddelanden och
              inställningar tas bort permanent.
            </p>
            <Button type="button" variant="danger" onClick={remove} disabled={busy}>
              {busy ? 'Raderar…' : 'Ja, radera'}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

function ApartmentsAdmin({
  apartments,
  residents,
  onChanged,
}: {
  apartments: Apartment[]
  residents: ResidentWithApartment[]
  onChanged: () => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function friendly(message: string) {
    if (/duplicate|unique/i.test(message)) return 'Det finns redan en lägenhet med den beteckningen.'
    if (/foreign key|violates/i.test(message)) return 'Lägenheten har boende kopplade och kan inte tas bort.'
    return message
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('apartments').insert({ label: label.trim() })
    setBusy(false)
    if (error) return setError(friendly(error.message))
    setLabel('')
    await onChanged()
  }

  async function rename(id: string) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('apartments').update({ label: editLabel.trim() }).eq('id', id)
    setBusy(false)
    if (error) return setError(friendly(error.message))
    setEditingId(null)
    await onChanged()
  }

  async function remove(id: string) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('apartments').delete().eq('id', id)
    setBusy(false)
    if (error) return setError(friendly(error.message))
    setEditingId(null)
    await onChanged()
  }

  return (
    <div className="space-y-3">
      <Card>
        <form onSubmit={add} className="space-y-2">
          <Label htmlFor="a-label">Ny lägenhet (beteckning)</Label>
          <Input
            id="a-label"
            required
            maxLength={30}
            placeholder="t.ex. 1101 eller Lgh 3"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" disabled={busy || !label.trim()}>
            Lägg till
          </Button>
        </form>
      </Card>
      <ErrorText>{error}</ErrorText>
      <p className="text-sm text-slate-500">{apartments.length} lägenheter</p>
      {apartments.map((a) => {
        const count = residents.filter((r) => r.apartment_id === a.id).length
        const editing = editingId === a.id
        return (
          <Card key={a.id}>
            {editing ? (
              <div className="space-y-2">
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} maxLength={30} />
                <Button onClick={() => rename(a.id)} disabled={busy || !editLabel.trim()}>
                  Spara
                </Button>
                <Button variant="secondary" onClick={() => setEditingId(null)} disabled={busy}>
                  Avbryt
                </Button>
                {count === 0 && (
                  <Button variant="ghost" className="text-red-600" onClick={() => remove(a.id)} disabled={busy}>
                    Ta bort lägenhet
                  </Button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => {
                  setEditingId(a.id)
                  setEditLabel(a.label)
                }}
              >
                <div>
                  <p className="text-lg font-semibold">{a.label}</p>
                  <p className="text-sm text-slate-500">
                    {count === 0 ? 'Inga boende' : count === 1 ? '1 boende' : `${count} boende`}
                  </p>
                </div>
                <span className="text-slate-400">›</span>
              </button>
            )}
          </Card>
        )
      })}
    </div>
  )
}
