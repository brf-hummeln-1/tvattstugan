// Edge Function: skickar notiser.
//  - Påminnelser en timme innan bokad tid (push, mejl som reserv).
//  - Köade notiser i notification_queue: chattmeddelanden (push) och
//    bokningar avbokade av spärr (push, mejl som reserv).
// Anropas av pg_cron och av databastriggers via pg_net med headern x-cron-secret.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const SLOT_LABELS: Record<number, string> = { 1: '10–13', 2: '13–16', 3: '16–19', 4: '19–22' }
const APP_URL = 'https://brf-hummeln-1.github.io/tvattstugan/'

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string }
type Resident = { id: string; name: string; email: string }
type Payload = { title: string; body: string; url: string; tag?: string }

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const smtpUser = Deno.env.get('SMTP_USER') ?? ''
const smtpPass = Deno.env.get('SMTP_PASS') ?? ''

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(`mailto:${smtpUser || 'noreply@example.com'}`, vapidPublic, vapidPrivate)
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

async function sendPush(db: SupabaseClient, subs: Subscription[], payload: Payload) {
  let delivered = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 },
      )
      delivered++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      console.warn(`push misslyckades (${status ?? 'okänt'}) för ${sub.endpoint.slice(0, 40)}…`)
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  return delivered
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!smtpUser || !smtpPass) {
    console.warn('SMTP_USER/SMTP_PASS saknas, hoppar över mejl')
    return false
  }
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: smtpUser, password: smtpPass },
    },
  })
  try {
    await client.send({
      from: `Tvättstugan <${smtpUser}>`,
      to,
      subject,
      content: text,
      html: `<p style="font-family:sans-serif;white-space:pre-line">${escapeHtml(text)}</p><p style="font-family:sans-serif"><a href="${APP_URL}">Öppna Tvättstugan</a></p>`,
    })
    return true
  } catch (e) {
    console.error('mejl misslyckades:', e instanceof Error ? e.message : e)
    return false
  } finally {
    try {
      await client.close()
    } catch {
      // ignorera
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

async function subscriptionsFor(db: SupabaseClient, residentIds: string[]) {
  if (residentIds.length === 0) return new Map<string, Subscription[]>()
  const { data } = await db.from('push_subscriptions').select('id, resident_id, endpoint, p256dh, auth').in('resident_id', residentIds)
  const map = new Map<string, Subscription[]>()
  for (const s of data ?? []) {
    const list = map.get(s.resident_id) ?? []
    list.push(s)
    map.set(s.resident_id, list)
  }
  return map
}

/** Push till mottagarna, mejl till dem som saknar push-prenumeration. */
async function notify(db: SupabaseClient, recipients: Resident[], payload: Payload, emailFallback: boolean) {
  const subsByResident = await subscriptionsFor(db, recipients.map((r) => r.id))
  const result = { push: 0, email: 0 }
  for (const r of recipients) {
    const subs = subsByResident.get(r.id) ?? []
    const delivered = subs.length ? await sendPush(db, subs, payload) : 0
    result.push += delivered
    if (delivered === 0 && emailFallback) {
      if (await sendEmail(r.email, payload.title, payload.body)) result.email++
    }
  }
  return result
}

async function processReminders(db: SupabaseClient) {
  const { data: due, error } = await db.rpc('due_reminders')
  if (error) throw new Error(`due_reminders: ${error.message}`)
  let sent = 0
  for (const b of due ?? []) {
    // Markera först så att inget skickas dubbelt om två anrop överlappar.
    const { data: claimed } = await db
      .from('bookings')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', b.booking_id)
      .is('reminder_sent_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) continue

    const { data: residents } = await db
      .from('residents')
      .select('id, name, email, notification_settings(reminders)')
      .eq('apartment_id', b.apartment_id)
    const recipients = (residents ?? []).filter((r) => {
      const s = r.notification_settings as { reminders: boolean } | { reminders: boolean }[] | null
      const settings = Array.isArray(s) ? s[0] : s
      return settings?.reminders !== false
    })
    const { data: apt } = await db.from('apartments').select('label').eq('id', b.apartment_id).maybeSingle()
    const payload: Payload = {
      title: 'Tvättid om en timme',
      body: `Din tid i tvättstugan börjar snart: ${formatDate(b.date)} ${SLOT_LABELS[b.slot]} (lägenhet ${apt?.label ?? ''}).`,
      url: '#/min-bokning',
      tag: `reminder-${b.booking_id}`,
    }
    const r = await notify(db, recipients, payload, true)
    sent += r.push + r.email
  }
  return { due: due?.length ?? 0, sent }
}

async function processQueue(db: SupabaseClient) {
  const { data: items, error } = await db
    .from('notification_queue')
    .select('id, resident_id, type, payload, resident:residents(id, name, email)')
    .is('sent_at', null)
    .order('created_at')
    .limit(200)
  if (error) throw new Error(`notification_queue: ${error.message}`)
  let push = 0
  let email = 0
  for (const item of items ?? []) {
    const { data: claimed } = await db
      .from('notification_queue')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', item.id)
      .is('sent_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) continue
    const resident = (Array.isArray(item.resident) ? item.resident[0] : item.resident) as Resident | null
    if (!resident) continue
    const p = item.payload as Record<string, string | number>

    let payload: Payload
    let emailFallback = false
    if (item.type === 'chat_message') {
      payload = {
        title: `${p.sender_name} i chatten`,
        body: String(p.body),
        url: '#/chatt',
        tag: 'chat',
      }
    } else if (item.type === 'booking_cancelled_by_block') {
      payload = {
        title: 'Din tvättid har avbokats',
        body: `Passet ${formatDate(String(p.date))} ${SLOT_LABELS[Number(p.slot)]} har spärrats av styrelsen. Anledning: ${p.reason}. Boka gärna en ny tid i appen.`,
        url: '#/',
        tag: `block-${item.id}`,
      }
      emailFallback = true
    } else {
      console.warn('okänd notistyp', item.type)
      continue
    }
    const r = await notify(db, [resident], payload, emailFallback)
    push += r.push
    email += r.email
  }
  return { items: items?.length ?? 0, push, email }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: secret } = await db.rpc('internal_config', { p_key: 'cron_secret' })
  const given = req.headers.get('x-cron-secret') ?? ''
  if (!secret || given !== secret) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })

  try {
    const reminders = await processReminders(db)
    const queue = await processQueue(db)
    const result = { reminders, queue }
    console.log(JSON.stringify(result))
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'fel' }), { status: 500 })
  }
})
