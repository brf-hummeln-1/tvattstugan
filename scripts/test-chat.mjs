// Tester för chattreglerna (regel 9). Körs mot det länkade Supabase-projektet.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-chat.mjs
//
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const url = 'https://sbnafogvwkxaqrjzmzhe.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY saknas')
  process.exit(1)
}
const anonKey = readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) passed++
  else failed++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${!ok && detail ? ' — ' + detail : ''}`)
}

const users = []
async function makeUser(name, email, isAdmin = false) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  const { error: rErr } = await admin.from('residents').insert({ id: data.user.id, name, email, is_admin: isAdmin })
  if (rErr) throw rErr
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: vErr } = await client.auth.verifyOtp({ email, token: link.properties.email_otp, type: 'email' })
  if (vErr) throw vErr
  return { id: data.user.id, client }
}

try {
  const { data: old } = await admin.from('residents').select('id').like('email', 'tvattstugan-chattest-%@example.com')
  for (const r of old ?? []) await admin.auth.admin.deleteUser(r.id)

  const a = await makeUser('Chat A', 'tvattstugan-chattest-a@example.com')
  const b = await makeUser('Chat B', 'tvattstugan-chattest-b@example.com')
  const adm = await makeUser('Chat Admin', 'tvattstugan-chattest-admin@example.com', true)

  console.log('Regel 9: chatt')
  const ins = await a.client.from('messages').insert({ resident_id: a.id, body: 'Hej från A' }).select().single()
  check('A kan skriva i eget namn', !ins.error, ins.error?.message)
  const fake = await b.client.from('messages').insert({ resident_id: a.id, body: 'Jag låtsas vara A' })
  check('B kan inte skriva i A:s namn', !!fake.error, 'insert gick igenom')
  const empty = await b.client.from('messages').insert({ resident_id: b.id, body: '   ' })
  check('tomt meddelande nekas', !!empty.error, 'insert gick igenom')
  const read = await b.client.from('messages').select('*, resident:residents(name)').eq('id', ins.data.id).maybeSingle()
  check('B kan läsa A:s meddelande med avsändarnamn', read.data?.resident?.name === 'Chat A', JSON.stringify(read))
  const edit = await a.client.from('messages').update({ body: 'ändrat' }).eq('id', ins.data.id).select()
  check('A kan inte redigera sitt meddelande', !!edit.error || (edit.data ?? []).length === 0)
  const delB = await b.client.from('messages').delete().eq('id', ins.data.id).select()
  check('B (inte admin) kan inte ta bort A:s meddelande', !delB.error && (delB.data ?? []).length === 0, delB.error?.message)
  const delA = await a.client.from('messages').delete().eq('id', ins.data.id).select()
  check('A kan inte ta bort sitt eget meddelande (bara admin)', !delA.error && (delA.data ?? []).length === 0, delA.error?.message)
  const delAdm = await adm.client.from('messages').delete().eq('id', ins.data.id).select()
  check('admin kan ta bort meddelandet', !delAdm.error && delAdm.data?.length === 1, delAdm.error?.message)

  console.log('\nRegel 11: radering av boende tar bort meddelanden')
  const m2 = await b.client.from('messages').insert({ resident_id: b.id, body: 'Från B' }).select().single()
  await admin.auth.admin.deleteUser(b.id)
  users.splice(users.indexOf(b.id), 1)
  const gone = await admin.from('messages').select('id').eq('id', m2.data?.id ?? '')
  check('B:s meddelande försvann när kontot raderades', (gone.data ?? []).length === 0)

  console.log('\nRealtime')
  const got = new Promise((resolve) => {
    const ch = a.client
      .channel('test-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => resolve(p.new.body))
      .subscribe()
    setTimeout(() => resolve(null), 8000)
    void ch
  })
  await new Promise((r) => setTimeout(r, 1500))
  await adm.client.from('messages').insert({ resident_id: adm.id, body: 'Realtime-test' })
  const body = await got
  check('A får nytt meddelande via realtime', body === 'Realtime-test', `fick: ${body}`)
  await a.client.removeAllChannels()
} catch (e) {
  failed++
  console.error('Oväntat fel:', e)
} finally {
  await admin.from('messages').delete().in('resident_id', users)
  for (const id of users) await admin.auth.admin.deleteUser(id)
}

console.log(`\n${passed} godkända, ${failed} underkända`)
process.exit(failed ? 1 : 0)
