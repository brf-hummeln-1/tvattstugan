import { isAndroid, isIos, isStandalone } from '../lib/device'

export function InstallGuide() {
  const ios = isIos()
  const android = isAndroid()
  const standalone = isStandalone()

  if (standalone) {
    return (
      <div className="rounded-xl bg-green-50 p-4 text-green-800">
        Appen är installerad på hemskärmen. Bra!
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {(ios || !android) && (
        <section>
          <h3 className="mb-2 text-lg font-semibold">iPhone (Safari)</h3>
          <ol className="list-decimal space-y-2 pl-5 text-slate-700">
            <li>Öppna den här sidan i <strong>Safari</strong> (inte i t.ex. Gmail-appen eller Chrome).</li>
            <li>Tryck på <strong>Dela</strong>-knappen längst ned (fyrkanten med en pil uppåt).</li>
            <li>Bläddra nedåt och välj <strong>Lägg till på hemskärmen</strong>.</li>
            <li>Tryck på <strong>Lägg till</strong> uppe till höger.</li>
            <li>Öppna appen från hemskärmen. Notiser fungerar bara när appen öppnas därifrån.</li>
          </ol>
        </section>
      )}
      {(android || !ios) && (
        <section>
          <h3 className="mb-2 text-lg font-semibold">Android (Chrome)</h3>
          <ol className="list-decimal space-y-2 pl-5 text-slate-700">
            <li>Öppna den här sidan i <strong>Chrome</strong>.</li>
            <li>Tryck på menyn med tre prickar uppe till höger.</li>
            <li>Välj <strong>Lägg till på startskärmen</strong> eller <strong>Installera app</strong>.</li>
            <li>Bekräfta med <strong>Installera</strong>.</li>
          </ol>
        </section>
      )}
    </div>
  )
}
