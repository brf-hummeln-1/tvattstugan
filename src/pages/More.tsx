import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Button, Card, PageTitle } from '../components/ui'
import { InstallGuide } from '../components/InstallGuide'
import { NotificationSettings } from '../components/NotificationSettings'

export function More() {
  const { resident, session, signOut } = useAuth()
  const [showGuide, setShowGuide] = useState(false)

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageTitle>Mer</PageTitle>

      <Card>
        <p className="text-lg font-semibold">{resident?.name ?? session?.user.email}</p>
        <p className="text-slate-600">
          {resident?.apartment ? `Lägenhet ${resident.apartment.label}` : 'Ingen lägenhet kopplad ännu'}
        </p>
        <p className="text-slate-600">{resident?.email ?? session?.user.email}</p>
      </Card>

      {resident?.is_admin && (
        <Link to="/admin" className="block">
          <Card className="flex items-center justify-between">
            <span className="text-lg font-semibold">Admin</span>
            <span className="text-slate-400">›</span>
          </Card>
        </Link>
      )}

      <Card>
        <h2 className="mb-2 text-lg font-semibold">Notiser</h2>
        <NotificationSettings />
      </Card>

      <Card>
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="flex w-full items-center justify-between py-1 text-left text-lg font-semibold"
        >
          Lägg appen på hemskärmen
          <span className="text-slate-400">{showGuide ? '▴' : '▾'}</span>
        </button>
        {showGuide && (
          <div className="mt-3">
            <InstallGuide />
          </div>
        )}
      </Card>

      <Button variant="secondary" onClick={signOut}>
        Logga ut
      </Button>
    </div>
  )
}
