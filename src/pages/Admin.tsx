import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { adminApi } from '../lib/admin'
import type { Apartment, ResidentWithApartment } from '../lib/types'
import { Button, Card, ErrorText, Input, Label, ListGroup, ListRow, PageTitle, Pill, SectionFooter, Segmented, Select, Spinner, Switch } from '../components/ui'
import { ChevronLeft } from '../components/icons'
import { Sheet } from '../components/Sheet'
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
type Tab = 'residents' | 'apartments' | 'blocks' | 'bookfor'

export function Admin() {
  const { resident: me, refreshResident } = useAuth()
  const navigate = useNavigate()
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [residents, setResidents] = useState<ResidentWithApartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('residents')

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
      <button type="button" onClick={() => navigate('/mer')} className="pressable -ml-2 mb-1 flex items-center text-[17px] text-ios-tint">
        <ChevronLeft /> Mer
      </button>
      <PageTitle>Admin</PageTitle>

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'residents', label: 'Boende' },
            { value: 'apartments', label: 'Lgh' },
            { value: 'blocks', label: 'Spärrar' },
            { value: 'bookfor', label: 'Boka åt' },
          ]}
        />
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
      <Button variant="tinted" onClick={() => setEditing('new')}>
        + Lägg till boende
      </Button>

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

      {residents.length === 0 ? (
        <SectionFooter>Inga boende tillagda ännu.</SectionFooter>
      ) : (
        <ListGroup>
          {residents.map((r) => (
            <ListRow
              key={r.id}
              title={
                <span className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {r.is_admin && <Pill tone="tint">Admin</Pill>}
                </span>
              }
              subtitle={
                <>
                  {r.apartment ? `Lägenhet ${r.apartment.label}` : 'Ingen lägenhet'} · {r.email}
                  {r.phone ? ` · ${r.phone}` : ''}
                </>
              }
              chevron
              onClick={() => setEditing(r)}
            />
          ))}
        </ListGroup>
      )}
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
      if (resident) await adminApi.updateResident(resident.id, payload)
      else await adminApi.createResident(payload)
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
    <Card>
      <form onSubmit={save} className="space-y-3">
        <h2 className="text-[20px] font-bold">{resident ? 'Ändra boende' : 'Ny boende'}</h2>
        <div>
          <Label htmlFor="r-name">Namn</Label>
          <Input id="r-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
          <Input id="r-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="r-apartment">Lägenhet</Label>
          <Select id="r-apartment" value={form.apartment_id} onChange={(e) => setForm({ ...form, apartment_id: e.target.value })}>
            <option value="">Ingen lägenhet</option>
            {apartments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
          {apartments.length === 0 && <p className="mt-1 text-[13px] text-ios-label-2">Lägg till lägenheter under fliken Lgh.</p>}
        </div>
        <label className="flex min-h-12 items-center justify-between gap-3 text-[17px]">
          <span>Admin (styrelsen)</span>
          <span className={isMe ? 'opacity-50' : ''}>
            <Switch checked={form.is_admin} onChange={() => !isMe && setForm({ ...form, is_admin: !form.is_admin })} label="Admin" />
          </span>
        </label>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sparar…' : 'Spara'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Avbryt
        </Button>
        {resident && !isMe && (
          <Button type="button" variant="ghost" className="text-ios-red" onClick={() => setConfirmDelete(true)}>
            Radera boende
          </Button>
        )}
      </form>
      {resident && (
        <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)}>
          <h2 className="text-[22px] font-bold">Radera {resident.name}?</h2>
          <p className="mb-5 mt-1 text-[15px] text-ios-label-2">
            Kontot och alla bokningar, meddelanden och inställningar tas bort permanent.
          </p>
          <div className="space-y-2">
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? 'Raderar…' : 'Radera'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Avbryt
            </Button>
          </div>
        </Sheet>
      )}
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

  const editing = apartments.find((a) => a.id === editingId)
  const editingCount = editing ? residents.filter((r) => r.apartment_id === editing.id).length : 0

  return (
    <div className="space-y-3">
      <Card>
        <form onSubmit={add} className="space-y-2">
          <Label htmlFor="a-label">Ny lägenhet (beteckning)</Label>
          <Input id="a-label" required maxLength={30} placeholder="t.ex. 1101 eller Lgh 3" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button type="submit" variant="tinted" disabled={busy || !label.trim()}>
            Lägg till
          </Button>
        </form>
      </Card>
      <ErrorText>{error}</ErrorText>
      <SectionFooter>{apartments.length} lägenheter</SectionFooter>
      {apartments.length > 0 && (
        <ListGroup>
          {apartments.map((a) => {
            const count = residents.filter((r) => r.apartment_id === a.id).length
            return (
              <ListRow
                key={a.id}
                title={<span className="font-medium">{a.label}</span>}
                trailing={count === 0 ? 'Inga boende' : count === 1 ? '1 boende' : `${count} boende`}
                chevron
                onClick={() => {
                  setEditingId(a.id)
                  setEditLabel(a.label)
                }}
              />
            )
          })}
        </ListGroup>
      )}
      <Sheet open={!!editing} onClose={() => setEditingId(null)}>
        {editing && (
          <div className="space-y-2">
            <h2 className="mb-3 text-[22px] font-bold">Lägenhet {editing.label}</h2>
            <Label htmlFor="a-edit">Beteckning</Label>
            <Input id="a-edit" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} maxLength={30} />
            <div className="pt-2" />
            <Button onClick={() => rename(editing.id)} disabled={busy || !editLabel.trim()}>
              Spara
            </Button>
            {editingCount === 0 && (
              <Button variant="secondary" className="text-ios-red" onClick={() => remove(editing.id)} disabled={busy}>
                Ta bort lägenhet
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
              Avbryt
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
