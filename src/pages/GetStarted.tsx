import { useNavigate } from 'react-router-dom'
import { Button, Card, PageTitle } from '../components/ui'
import { InstallGuide } from '../components/InstallGuide'
import { NotificationSettings } from '../components/NotificationSettings'
import { markOnboardingSeen } from '../lib/device'

export function GetStarted() {
  const navigate = useNavigate()
  function done() {
    markOnboardingSeen()
    navigate('/', { replace: true })
  }
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <PageTitle>Kom igång</PageTitle>
      <p className="mb-4 text-slate-700">
        Lägg appen på hemskärmen så är den alltid nära till hands. Det behövs också för att
        kunna få notiser om dina tvättider.
      </p>
      <Card className="mb-4">
        <InstallGuide />
      </Card>
      <Card className="mb-4">
        <h2 className="mb-1 text-lg font-semibold">Notiser</h2>
        <p className="mb-3 text-slate-700">
          Få en påminnelse en timme innan din tvättid och besked om nya meddelanden i chatten.
        </p>
        <NotificationSettings compact />
      </Card>
      <p className="mb-4 text-sm text-slate-500">
        Du hittar guiden och notisinställningarna igen under <strong>Mer</strong>.
      </p>
      <Button onClick={done}>Fortsätt</Button>
    </div>
  )
}
