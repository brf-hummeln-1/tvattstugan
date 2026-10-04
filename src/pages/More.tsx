import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Button, Card, ListGroup, ListRow, PageTitle, SectionHeader } from '../components/ui'
import { InstallGuide } from '../components/InstallGuide'
import { NotificationSettings } from '../components/NotificationSettings'

export function More() {
  const { resident, session, signOut } = useAuth()
  const navigate = useNavigate()
  const [showGuide, setShowGuide] = useState(false)
  const name = resident?.name ?? session?.user.email ?? ''
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="mx-auto max-w-md">
      <PageTitle>Mer</PageTitle>

      <ListGroup>
        <ListRow
          leading={
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ios-tint text-[18px] font-semibold text-white">
              {initials || '?'}
            </span>
          }
          title={<span className="font-semibold">{name}</span>}
          subtitle={
            <>
              {resident?.apartment ? `Lägenhet ${resident.apartment.label}` : 'Ingen lägenhet kopplad ännu'}
              <br />
              {resident?.email ?? session?.user.email}
            </>
          }
        />
      </ListGroup>

      {resident?.is_admin && (
        <>
          <SectionHeader>Styrelsen</SectionHeader>
          <ListGroup>
            <ListRow title="Admin" subtitle="Boende, lägenheter, spärrar" chevron onClick={() => navigate('/admin')} />
          </ListGroup>
        </>
      )}

      <SectionHeader>Notiser</SectionHeader>
      <Card>
        <NotificationSettings />
      </Card>

      <SectionHeader>Appen</SectionHeader>
      <ListGroup>
        <ListRow
          title="Lägg appen på hemskärmen"
          chevron={!showGuide}
          trailing={showGuide ? 'Dölj' : undefined}
          onClick={() => setShowGuide((v) => !v)}
        />
        {showGuide && (
          <div className="px-4 pb-4 pt-3">
            <InstallGuide />
          </div>
        )}
      </ListGroup>

      <div className="mt-6">
        <Button variant="secondary" className="text-ios-red" onClick={signOut}>
          Logga ut
        </Button>
      </div>
    </div>
  )
}
