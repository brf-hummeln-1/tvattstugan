// Tester för notisflödet. Körs mot det länkade Supabase-projektet.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-notifications.mjs [mejladress-för-mejltest]
//
// Testar: due_reminders-logiken, chatt-triggern (kö per mottagare, inte avsändaren,
// respekterar inställningen), blockerings-notis i kön, att databasen anropar
// Edge Function via pg_net och att funktionen markerar raderna som skickade.
// Anges en mejladress skickas ett riktigt reservmejl dit (bokning avbokad av spärr).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const url = 'https://sbnafogvwkxaqrjzmzhe.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY saknas')
  process.exit(1)
}
const emailTarget = process.argv[2] ?? null
const anonKey = readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ' — ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const created = { users: [], apartments: [] }
async function makeUser(name, email, apartmentId, isAdmin = false) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  created.users.push(data.user.id)
  const { error: rErr } = await admin.from('residents').insert({ id: data.user.id, name, email, apartment_id: apartmentId, is_admin: isAdmin })
  if (rErr) throw rErr
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: vErr } = await client.auth.verifyOtp({ email, token: link.properties.email_otp, type: 'email' })
  if (vErr) throw vErr
  return { id: data.user.id, client }
}

async function waitForSent(ids, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data } = await admin.from('notification_queue').select('id, sent_at').in('id', ids)
    if (data && data.length === ids.length && data.every((r) => r.sent_at)) return true
    await sleep(1500)
  }
  return false
}

try {
  const { data: oldRes } = await admin.from('residents').select('id').like('email', 'tvattstugan-notistest-%')
  for (const r of oldRes ?? []) await admin.auth.admin.deleteUser(r.id)
  await admin.from('apartments').delete().in('label', ['NOTIS-A', 'NOTIS-B'])
  await admin.from('blocks').delete().like('reason', 'NOTISTEST:%')

  const aptA = (await admin.from('apartments').insert({ label: 'NOTIS-A' }).select().single()).data
  const aptB = (await admin.from('apartments').insert({ label: 'NOTIS-B' }).select().single()).data
  created.apartments.push(aptA.id, aptB.id)
  const a = await makeUser('Notis A', emailTarget ?? 'tvattstugan-notistest-a@example.com', aptA.id)
  const b = await makeUser('Notis B', 'tvattstugan-notistest-b@example.com', aptB.id)
  const c = await makeUser('Notis C', 'tvattstugan-notistest-c@example.com', aptB.id)
  const adm = await makeUser('Notis Admin', 'tvattstugan-notistest-admin@example.com', null, true)
  // C vill inte ha chattnotiser.
  await admin.from('notification_settings').update({ chat: false }).eq('resident_id', c.id)

  console.log('Påminnelser (due_reminders)')
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const { data: bk, error: bkErr } = await a.client.rpc('book_slot', { p_date: tomorrow, p_slot: 2 })
  check('A bokar imorgon pass 2', !bkErr, bkErr?.message)
  const { data: start } = await admin.rpc('slot_start', { p_date: tomorrow, p_slot: 2 })
  const startMs = new Date(start).getTime()
  const at = (minBefore) => new Date(startMs - minBefore * 60000).toISOString()
  const due30 = await admin.rpc('due_reminders', { p_now: at(30) })
  check('30 min innan: bokningen ska påminnas', due30.data?.some((r) => r.booking_id === bk?.id), JSON.stringify(due30))
  const due59 = await admin.rpc('due_reminders', { p_now: at(59) })
  check('59 min innan: bokningen ska påminnas', due59.data?.some((r) => r.booking_id === bk?.id))
  const due61 = await admin.rpc('due_reminders', { p_now: at(61) })
  check('61 min innan: inte ännu', !due61.data?.some((r) => r.booking_id === bk?.id))
  const dueAfter = await admin.rpc('due_reminders', { p_now: at(-1) })
  check('efter start: inte längre', !dueAfter.data?.some((r) => r.booking_id === bk?.id))
  await admin.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', bk.id)
  const dueSent = await admin.rpc('due_reminders', { p_now: at(30) })
  check('redan påmind: skickas inte igen', !dueSent.data?.some((r) => r.booking_id === bk?.id))
  await admin.from('bookings').update({ reminder_sent_at: null }).eq('id', bk.id)
  const denied = await a.client.rpc('due_reminders', { p_now: at(30) })
  check('inloggad användare får inte köra due_reminders', !!denied.error)
  const deniedCfg = await a.client.rpc('internal_config', { p_key: 'cron_secret' })
  check('inloggad användare får inte läsa internal_config', !!deniedCfg.error)

  console.log('\nChattnotiser (trigger -> kö -> funktion)')
  const { data: msg, error: msgErr } = await a.client.from('messages').insert({ resident_id: a.id, body: 'Notistest' }).select().single()
  check('A skriver i chatten', !msgErr, msgErr?.message)
  await sleep(500)
  const { data: q } = await admin.from('notification_queue').select('id, resident_id, payload, sent_at').eq('type', 'chat_message').contains('payload', { message_id: msg.id })
  const recipients = new Set((q ?? []).map((r) => r.resident_id))
  check('B och Admin får en kö-rad', recipients.has(b.id) && recipients.has(adm.id), JSON.stringify([...recipients]))
  check('A (avsändaren) får ingen', !recipients.has(a.id))
  check('C (chatt avstängd) får ingen', !recipients.has(c.id))
  check('kö-raden innehåller avsändarnamn och text', q?.[0]?.payload?.sender_name === 'Notis A' && q?.[0]?.payload?.body === 'Notistest')
  const chatSent = await waitForSent((q ?? []).map((r) => r.id))
  check('funktionen anropades via pg_net och markerade raderna som skickade', chatSent)

  console.log('\nBlockering -> notis med reservmejl')
  const { data: blk, error: blkErr } = await adm.client.rpc('create_block', { p_start_date: tomorrow, p_end_date: tomorrow, p_slot: 2, p_reason: 'NOTISTEST: Reparation' })
  check('admin spärrar passet A bokat', !blkErr, blkErr?.message)
  await sleep(500)
  const { data: bq } = await admin.from('notification_queue').select('id, resident_id, payload, sent_at').eq('type', 'booking_cancelled_by_block').eq('resident_id', a.id)
  check('A får en kö-rad med anledningen', bq?.length === 1 && bq[0].payload.reason === 'NOTISTEST: Reparation', JSON.stringify(bq))
  const blockSent = await waitForSent((bq ?? []).map((r) => r.id))
  check('raden markerades som skickad', blockSent)
  await sleep(3000)
  const { data: resp } = await admin.rpc('internal_config', { p_key: 'functions_url' })
  check('functions_url finns i private.config', typeof resp === 'string' && resp.includes('/functions/v1'))
  if (emailTarget) {
    console.log(`  (ett mejl "Din tvättid har avbokats" ska ha skickats till ${emailTarget})`)
  } else {
    console.log('  (ingen mejladress angiven, reservmejlet gick till en example.com-adress)')
  }
  if (blk) await admin.from('blocks').delete().eq('id', blk.id)
} catch (e) {
  failed++
  console.error('Oväntat fel:', e)
} finally {
  await admin.from('notification_queue').delete().in('resident_id', created.users)
  await admin.from('messages').delete().in('resident_id', created.users)
  await admin.from('bookings').delete().in('apartment_id', created.apartments)
  await admin.from('blocks').delete().like('reason', 'NOTISTEST:%')
  for (const id of created.users) await admin.auth.admin.deleteUser(id)
  if (created.apartments.length) await admin.from('apartments').delete().in('id', created.apartments)
}

console.log(`\n${passed} godkända, ${failed} underkända`)
process.exit(failed ? 1 : 0)
