import { isAndroid, isIos, isStandalone } from '../lib/device'

function Steps({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <section>
      <h3 className="mb-2 text-[17px] font-semibold">{title}</h3>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-[15px] text-ios-label">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ios-tint-soft text-[13px] font-semibold text-ios-tint">
              {i + 1}
            </span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function InstallGuide() {
  const ios = isIos()
  const android = isAndroid()

  if (isStandalone()) {
    return <p className="rounded-ios-sm bg-ios-green-soft px-4 py-3 text-[15px] text-ios-green">Appen är installerad på hemskärmen.</p>
  }

  return (
    <div className="space-y-5">
      {(ios || !android) && (
        <Steps
          title="iPhone (Safari)"
          steps={[
            <>Öppna den här sidan i <strong>Safari</strong> (inte i t.ex. Gmail-appen eller Chrome).</>,
            <>Tryck på <strong>Dela</strong>-knappen längst ned (fyrkanten med en pil uppåt).</>,
            <>Bläddra nedåt och välj <strong>Lägg till på hemskärmen</strong>.</>,
            <>Tryck på <strong>Lägg till</strong> uppe till höger.</>,
            <>Öppna appen från hemskärmen. Notiser fungerar bara när appen öppnas därifrån.</>,
          ]}
        />
      )}
      {(android || !ios) && (
        <Steps
          title="Android (Chrome)"
          steps={[
            <>Öppna den här sidan i <strong>Chrome</strong>.</>,
            <>Tryck på menyn med tre prickar uppe till höger.</>,
            <>Välj <strong>Lägg till på startskärmen</strong> eller <strong>Installera app</strong>.</>,
            <>Bekräfta med <strong>Installera</strong>.</>,
          ]}
        />
      )}
    </div>
  )
}
