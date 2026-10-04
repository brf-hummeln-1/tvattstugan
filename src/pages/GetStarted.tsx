import { useNavigate } from 'react-router-dom'
import { Button, Card, PageTitle, SectionFooter } from '../components/ui'
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
    <div className="mx-auto max-w-md px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <PageTitle>Kom igång</PageTitle>
      <p className="mb-4 text-[17px] text-ios-label-2">
        Lägg appen på hemskärmen så är den alltid nära till hands. Det behövs också för att kunna få notiser om dina
        tvättider.
      </p>
      <Card className="mb-4">
        <InstallGuide />
      </Card>
      <Card className="mb-2">
        <h2 className="mb-1 text-[17px] font-semibold">Notiser</h2>
        <p className="mb-3 text-[15px] text-ios-label-2">
          Få en påminnelse en timme innan din tvättid och besked om nya meddelanden i chatten.
        </p>
        <NotificationSettings compact />
      </Card>
      <SectionFooter>Du hittar guiden och notisinställningarna igen under Mer.</SectionFooter>
      <div className="mt-6">
        <Button onClick={done}>Fortsätt</Button>
      </div>
    </div>
  )
}
