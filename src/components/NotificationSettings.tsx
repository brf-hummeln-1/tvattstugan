import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { isIos, isStandalone } from '../lib/device'
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push'
import { Button, ErrorText } from './ui'
import { InstallGuide } from './InstallGuide'

type Settings = { reminders: boolean; chat: boolean }

export function NotificationSettings({ compact = false }: { compact?: boolean }) {
  const { resident } = useAuth()
  const [pushState, setPushState] = useState<PushState | 'loading'>('loading')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const needsHomeScreen = isIos() && !isStandalone()

  const refresh = useCallback(async () => {
    setPushState(await getPushState())
  }, [])

  useEffect(() => {
    refresh()
    if (!resident) return
    supabase
      .from('notification_settings')
      .select('reminders, chat')
      .eq('resident_id', resident.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) return setSettings(data as Settings)
        // Rad saknas (äldre konto): skapa standardinställningar.
        const { data: created } = await supabase
          .from('notification_settings')
          .insert({ resident_id: resident.id })
          .select('reminders, chat')
          .single()
        setSettings((created as Settings) ?? { reminders: true, chat: true })
      })
  }, [resident, refresh])

  async function toggle(key: keyof Settings) {
    if (!resident || !settings) return
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    const { error } = await supabase.from('notification_settings').update({ [key]: next[key] }).eq('resident_id', resident.id)
    if (error) {
      setError(error.message)
      setSettings(settings)
    }
  }

  async function turnOn() {
    if (!resident) return
    setBusy(true)
    setError(null)
    try {
      await enablePush(resident.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte slå på notiser')
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    setError(null)
    try {
      await disablePush()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte stänga av notiser')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {needsHomeScreen ? (
        <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
          <p className="mb-2">
            På iPhone fungerar notiser bara när appen är tillagd på hemskärmen och öppnas därifrån.
          </p>
          <button type="button" className="font-semibold underline" onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? 'Dölj guiden' : 'Visa hur man gör'}
          </button>
          {showGuide && (
            <div className="mt-3">
              <InstallGuide />
            </div>
          )}
        </div>
      ) : pushState === 'loading' ? null : pushState === 'unsupported' ? (
        <p className="text-slate-600">Den här webbläsaren stöder inte notiser. Du får påminnelser via mejl istället.</p>
      ) : pushState === 'denied' ? (
        <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
          Notiser är blockerade för Tvättstugan i telefonens inställningar. Tillåt dem där och försök igen. Tills dess
          får du påminnelser via mejl.
        </p>
      ) : pushState === 'subscribed' ? (
        <>
          <p className="rounded-xl bg-green-50 p-3 text-green-800">Notiser är på för den här enheten.</p>
          {!compact && (
            <Button variant="secondary" onClick={turnOff} disabled={busy}>
              Stäng av notiser på den här enheten
            </Button>
          )}
        </>
      ) : (
        <Button onClick={turnOn} disabled={busy}>
          {busy ? 'Slår på…' : 'Slå på notiser'}
        </Button>
      )}

      {!compact && settings && (
        <div className="space-y-2 pt-1">
          <Toggle label="Påminnelse en timme innan bokad tid" checked={settings.reminders} onChange={() => toggle('reminders')} />
          <Toggle label="Nya meddelanden i chatten" checked={settings.chat} onChange={() => toggle('chat')} />
          <p className="text-sm text-slate-500">
            Om en bokad tid avbokas på grund av en spärr får du alltid besked. Saknar du notiser skickas påminnelser
            och avbokningar som mejl.
          </p>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 text-lg">
      <span>{label}</span>
      <input type="checkbox" className="h-7 w-7" checked={checked} onChange={onChange} />
    </label>
  )
}
