import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorText, Input, Label } from '../components/ui'

export function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    if (error) {
      if (/signups not allowed|not found|user not found/i.test(error.message)) {
        setError('Mejladressen finns inte registrerad. Kontakta styrelsen för att bli tillagd.')
      } else if (/rate limit|security purposes/i.test(error.message)) {
        setError('För många försök. Vänta en stund och försök igen.')
      } else {
        setError(`Kunde inte skicka koden: ${error.message}`)
      }
      return
    }
    setEmail(cleanEmail)
    setStep('code')
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) {
      setError('Fel eller utgången kod. Kontrollera koden eller begär en ny.')
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <img src="icons/icon-192.png" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl" />
        <h1 className="text-3xl font-bold">Tvättstugan</h1>
        <p className="mt-1 text-slate-600">Logga in med din mejladress</p>
      </div>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <Label htmlFor="email">Mejladress</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@exempel.se"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy}>
            {busy ? 'Skickar…' : 'Skicka kod'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-slate-700">
            Vi har skickat en sexsiffrig kod till <strong>{email}</strong>. Skriv in den här.
          </p>
          <div>
            <Label htmlFor="code">Kod</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-3xl tracking-[0.5em]"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'Loggar in…' : 'Logga in'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep('email')
              setCode('')
              setError(null)
            }}
          >
            Ändra mejladress eller skicka ny kod
          </Button>
        </form>
      )}
    </div>
  )
}
