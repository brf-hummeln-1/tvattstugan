import { supabase } from './supabase'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'not-subscribed'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!vapidPublicKey
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'subscribed' : 'not-subscribed'
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Ber om tillstånd, prenumererar och sparar prenumerationen för den inloggade. */
export async function enablePush(residentId: string): Promise<void> {
  if (!pushSupported()) throw new Error('Notiser stöds inte i den här webbläsaren')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Du behöver tillåta notiser för att slå på dem')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }))
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Kunde inte läsa prenumerationen')
  const row = {
    resident_id: residentId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 200),
  }
  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) {
    // Prenumerationen kan tillhöra ett annat konto på samma enhet: förnya den.
    await sub.unsubscribe()
    const fresh = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })
    const j = fresh.toJSON()
    const { error: e2 } = await supabase.from('push_subscriptions').insert({
      ...row,
      endpoint: j.endpoint!,
      p256dh: j.keys!.p256dh,
      auth: j.keys!.auth,
    })
    if (e2) throw new Error(e2.message)
  }
}

/** Avslutar prenumerationen på den här enheten. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
