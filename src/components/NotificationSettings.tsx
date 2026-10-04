import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { isIos, isStandalone } from '../lib/device'
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push'
import { Button, ErrorText, Switch } from './ui'
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

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {needsHomeScreen ? (
        <div className="rounded-ios-sm bg-ios-orange-soft px-4 py-3 text-[15px] text-ios-label">
          <p className="mb-1">På iPhone fungerar notiser bara när appen är tillagd på hemskärmen och öppnas därifrån.</p>
          <button type="button" className="font-semibold text-ios-tint" onClick={() => setShowGuide((v) => !v)}>
            {showGuide ? 'Dölj guiden' : 'Visa hur man gör'}
          </button>
          {showGuide && (
            <div className="mt-3">
              <InstallGuide />
            </div>
          )}
        </div>
      ) : pushState === 'loading' ? null : pushState === 'unsupported' ? (
        <p className="text-[15px] text-ios-label-2">
          Den här webbläsaren stöder inte notiser. Du får påminnelser via mejl istället.
        </p>
      ) : pushState === 'denied' ? (
        <p className="rounded-ios-sm bg-ios-orange-soft px-4 py-3 text-[15px] text-ios-label">
          Notiser är blockerade för Tvättstugan i telefonens inställningar. Tillåt dem där och försök igen. Tills dess
          får du påminnelser via mejl.
        </p>
      ) : pushState === 'subscribed' ? (
        <>
          <p className="rounded-ios-sm bg-ios-green-soft px-4 py-3 text-[15px] font-medium text-ios-green">
            Notiser är på för den här enheten
          </p>
          {!compact && (
            <Button variant="secondary" onClick={() => run(disablePush)} disabled={busy}>
              Stäng av på den här enheten
            </Button>
          )}
        </>
      ) : (
        <Button onClick={() => run(() => enablePush(resident!.id))} disabled={busy || !resident}>
          {busy ? 'Slår på…' : 'Slå på notiser'}
        </Button>
      )}

      {!compact && settings && (
        <div className="hairline -mx-4 mt-1">
          <label className="flex min-h-[52px] items-center justify-between gap-3 px-4 text-[17px]">
            <span>Påminnelse en timme innan</span>
            <Switch checked={settings.reminders} onChange={() => toggle('reminders')} label="Påminnelse" />
          </label>
          <label className="flex min-h-[52px] items-center justify-between gap-3 px-4 text-[17px]">
            <span>Nya meddelanden i chatten</span>
            <Switch checked={settings.chat} onChange={() => toggle('chat')} label="Chatt" />
          </label>
          <p className="px-4 pt-3 text-[13px] text-ios-label-2">
            Om en bokad tid avbokas på grund av en spärr får du alltid besked. Saknar du notiser skickas påminnelser och
            avbokningar som mejl.
          </p>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
