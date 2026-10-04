// Tester för bokningsreglerna. Körs mot det länkade Supabase-projektet.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-bookings.mjs
//
// Skapar tillfälliga testlägenheter och testkonton (TEST-A, TEST-B, mejl @example.com),
// kör alla regler som inloggade användare via RPC och städar bort allt efteråt.
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
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
  }
}
async function expectError(name, promise, pattern) {
  const { error } = await promise
  const ok = !!error && (!pattern || pattern.test(error.message))
  check(name, ok, error ? `fick: "${error.message}"` : 'inget fel uppstod')
}
async function expectOk(name, promise) {
  const { data, error } = await promise
  check(name, !error, error?.message)
  return data
}

// Datum i Stockholmstid
const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' })
const hourFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', hour12: false })
function isoDate(d) {
  return fmt.format(d)
}
function addDays(d, n) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}
function addMonths(dateStr, n) {
  // Samma datum n månader fram, klämt till månadens sista dag (som Postgres).
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + n, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}
const now = new Date()
const today = isoDate(now)
const yesterday = isoDate(addDays(now, -1))
const day = (n) => isoDate(addDays(now, n))
const lastAllowed = addMonths(today, 1)
const tooFar = isoDate(addDays(new Date(lastAllowed + 'T12:00:00Z'), 1))
const stockholmHour = Number(hourFmt.format(now))

const created = { apartments: [], users: [], blocks: [] }

async function makeApartment(label) {
  const { data, error } = await admin.from('apartments').insert({ label }).select().single()
  if (error) throw error
  created.apartments.push(data.id)
  return data
}

async function makeUser(name, email, apartmentId, isAdmin = false) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  created.users.push(data.user.id)
  const { error: rErr } = await admin.from('residents').insert({
    id: data.user.id,
    name,
    email,
    apartment_id: apartmentId,
    is_admin: isAdmin,
  })
  if (rErr) throw rErr
  // Logga in som användaren via admin-genererad engångskod.
  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (lErr) throw lErr
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: vErr } = await client.auth.verifyOtp({ email, token: link.properties.email_otp, type: 'email' })
  if (vErr) throw vErr
  return { id: data.user.id, client }
}

async function cleanup() {
  await admin.from('notification_queue').delete().in('resident_id', created.users)
  await admin.from('bookings').delete().in('apartment_id', created.apartments)
  if (created.blocks.length) await admin.from('blocks').delete().in('id', created.blocks)
  for (const id of created.users) await admin.auth.admin.deleteUser(id)
  if (created.apartments.length) await admin.from('apartments').delete().in('id', created.apartments)
}

// Rensa eventuella rester från avbrutna körningar.
async function cleanupLeftovers() {
  const { data: oldApts } = await admin.from('apartments').select('id').in('label', ['TEST-A', 'TEST-B'])
  const { data: oldRes } = await admin.from('residents').select('id').like('email', 'tvattstugan-test-%@example.com')
  for (const r of oldRes ?? []) await admin.auth.admin.deleteUser(r.id)
  if (oldApts?.length) await admin.from('apartments').delete().in('id', oldApts.map((a) => a.id))
  await admin.from('blocks').delete().like('reason', 'TEST:%')
}

try {
  await cleanupLeftovers()
  console.log(`Idag (Stockholm): ${today}, klockan ${stockholmHour}. Sista bokningsbara dag: ${lastAllowed}`)

  const aptA = await makeApartment('TEST-A')
  const aptB = await makeApartment('TEST-B')
  const a1 = await makeUser('Test A1', 'tvattstugan-test-a1@example.com', aptA.id)
  const a2 = await makeUser('Test A2', 'tvattstugan-test-a2@example.com', aptA.id)
  const b = await makeUser('Test B', 'tvattstugan-test-b@example.com', aptB.id)
  const adm = await makeUser('Test Admin', 'tvattstugan-test-admin@example.com', null, true)
  const noApt = await makeUser('Test Utan', 'tvattstugan-test-utan@example.com', null)

  const rpc = (u, fn, args) => u.client.rpc(fn, args)

  console.log('\nRLS: klienten får inte skriva direkt')
  await expectError('direkt insert i bookings nekas', b.client.from('bookings').insert({ apartment_id: aptB.id, resident_id: b.id, date: day(1), slot: 1 }))
  await expectError('direkt insert i blocks nekas', b.client.from('blocks').insert({ start_date: day(1), end_date: day(1), reason: 'TEST: x' }))
  const q = await b.client.from('notification_queue').select('*')
  check('notification_queue är dold för inloggade', (q.data ?? []).length === 0 && !q.error ? true : !!q.error)

  console.log('\nRegel 1: en aktiv bokning per lägenhet')
  const bk1 = await expectOk('A1 bokar imorgon pass 1', rpc(a1, 'book_slot', { p_date: day(1), p_slot: 1 }))
  await expectError('A2 (samma lägenhet) kan inte boka ett till pass', rpc(a2, 'book_slot', { p_date: day(1), p_slot: 2 }), /redan en aktiv bokning/)
  await expectError('A1 kan inte boka ett till pass', rpc(a1, 'book_slot', { p_date: day(2), p_slot: 1 }), /redan en aktiv bokning/)

  console.log('\nRegel 3: ett pass kan bara ha en bokning')
  await expectError('B kan inte boka samma pass som A', rpc(b, 'book_slot', { p_date: day(1), p_slot: 1 }), /redan bokat/)

  console.log('\nRegel 2: bokningsfönster')
  await expectError('igår nekas', rpc(b, 'book_slot', { p_date: yesterday, p_slot: 1 }), /passerat/)
  await expectError('mer än en månad fram nekas', rpc(b, 'book_slot', { p_date: tooFar, p_slot: 1 }), /till och med/)
  await expectError('ogiltigt pass nekas', rpc(b, 'book_slot', { p_date: day(1), p_slot: 5 }), /Ogiltigt pass/)
  const bkFar = await expectOk('exakt en månad fram går bra', rpc(b, 'book_slot', { p_date: lastAllowed, p_slot: 4 }))
  if (bkFar) await expectOk('B avbokar', rpc(b, 'cancel_booking', { p_booking_id: bkFar.id }))
  if (stockholmHour >= 13) {
    await expectError('dagens pass 1 (slut 13:00) nekas när klockan passerat 13', rpc(b, 'book_slot', { p_date: today, p_slot: 1 }), /redan slutat/)
  } else {
    console.log('  (hoppar över: test av passerat pass idag kräver att klockan är efter 13)')
  }
  if (stockholmHour >= 10 && stockholmHour < 22) {
    const ongoingSlot = Math.min(4, Math.floor((stockholmHour - 10) / 3) + 1)
    const ongoing = await expectOk(`pågående pass ${ongoingSlot} idag får bokas`, rpc(b, 'book_slot', { p_date: today, p_slot: ongoingSlot }))
    if (ongoing) await expectOk('B avbokar det pågående passet', rpc(b, 'cancel_booking', { p_booking_id: ongoing.id }))
  } else {
    console.log('  (hoppar över: test av pågående pass kräver att klockan är mellan 10 och 22)')
  }

  console.log('\nRegel 4 och 8: blockeringar')
  await expectError('B (inte admin) kan inte spärra', rpc(b, 'create_block', { p_start_date: day(3), p_end_date: day(3), p_slot: 2, p_reason: 'TEST: nej' }), /Bara admin/)
  const blk1 = await expectOk('admin spärrar dag+3 pass 2', rpc(adm, 'create_block', { p_start_date: day(3), p_end_date: day(3), p_slot: 2, p_reason: 'TEST: Service' }))
  if (blk1) created.blocks.push(blk1.id)
  await expectError('B kan inte boka spärrat pass', rpc(b, 'book_slot', { p_date: day(3), p_slot: 2 }), /spärrat/)
  const bk4 = await expectOk('B bokar dag+4 pass 1', rpc(b, 'book_slot', { p_date: day(4), p_slot: 1 }))
  const blk2 = await expectOk('admin spärrar hela dag+4 till dag+5', rpc(adm, 'create_block', { p_start_date: day(4), p_end_date: day(5), p_slot: null, p_reason: 'TEST: Reparation' }))
  if (blk2) created.blocks.push(blk2.id)
  const gone = await admin.from('bookings').select('id').eq('id', bk4?.id ?? '00000000-0000-0000-0000-000000000000')
  check('B:s bokning togs bort av blockeringen', (gone.data ?? []).length === 0)
  const notis = await admin.from('notification_queue').select('*').eq('resident_id', b.id).eq('type', 'booking_cancelled_by_block')
  check('B fick en notis i kön med anledningen', notis.data?.length === 1 && notis.data[0].payload.reason === 'TEST: Reparation', JSON.stringify(notis.data))
  await expectError('B kan inte ta bort blockering (RLS)', (async () => {
    const r = await b.client.from('blocks').delete().eq('id', blk2.id).select()
    return r.error ? r : { error: (r.data ?? []).length === 0 ? { message: 'inga rader raderade' } : null }
  })(), /inga rader/)
  const del = await adm.client.from('blocks').delete().eq('id', blk2.id).select()
  check('admin kan ta bort blockering', !del.error && del.data?.length === 1, del.error?.message)
  if (!del.error && del.data?.length === 1) created.blocks = created.blocks.filter((id) => id !== blk2.id)

  console.log('\nRegel 5: flytta')
  const moved = await expectOk('A1 flyttar sin bokning till dag+2 pass 3', rpc(a1, 'move_booking', { p_booking_id: bk1.id, p_date: day(2), p_slot: 3 }))
  const old = await admin.from('bookings').select('id').eq('id', bk1.id)
  check('gamla bokningen är borta', (old.data ?? []).length === 0)
  await expectError('flytt till spärrat pass nekas', rpc(a1, 'move_booking', { p_booking_id: moved.id, p_date: day(3), p_slot: 2 }), /spärrat/)
  const still = await admin.from('bookings').select('id').eq('id', moved.id)
  check('misslyckad flytt behåller bokningen', (still.data ?? []).length === 1)
  const bkB = await expectOk('B bokar dag+6 pass 1', rpc(b, 'book_slot', { p_date: day(6), p_slot: 1 }))
  await expectError('flytt till upptaget pass nekas', rpc(a1, 'move_booking', { p_booking_id: moved.id, p_date: day(6), p_slot: 1 }), /redan bokat/)
  const still2 = await admin.from('bookings').select('id').eq('id', moved.id)
  check('bokningen finns kvar efter nekad flytt', (still2.data ?? []).length === 1)

  console.log('\nRegel 6: avboka')
  await expectError('B kan inte avboka A:s bokning', rpc(b, 'cancel_booking', { p_booking_id: moved.id }), /egen lägenhets/)
  await expectOk('A2 kan avboka lägenhetens bokning (gjord av A1)', rpc(a2, 'cancel_booking', { p_booking_id: moved.id }))
  await expectOk('admin kan avboka B:s bokning', rpc(adm, 'cancel_booking', { p_booking_id: bkB.id }))

  console.log('\nRegel 7: admin bokar åt andra')
  await expectError('B kan inte boka åt lägenhet A', rpc(b, 'book_slot', { p_date: day(7), p_slot: 1, p_apartment_id: aptA.id }), /egen lägenhet/)
  await expectError('boende utan lägenhet kan inte boka', rpc(noApt, 'book_slot', { p_date: day(7), p_slot: 1 }), /inte kopplad/)
  await expectError('admin utan lägenhet kan inte boka utan att ange lägenhet', rpc(adm, 'book_slot', { p_date: day(7), p_slot: 1 }), /inte kopplad/)
  const admBk = await expectOk('admin bokar åt lägenhet B', rpc(adm, 'book_slot', { p_date: day(7), p_slot: 1, p_apartment_id: aptB.id }))
  check('bokningen tillhör lägenhet B men är gjord av admin', admBk?.apartment_id === aptB.id && admBk?.resident_id === adm.id)
  await expectError('B kan inte boka till (admin bokade åt dem)', rpc(b, 'book_slot', { p_date: day(8), p_slot: 1 }), /redan en aktiv bokning/)
  await expectOk('B kan avboka den bokning admin gjorde', rpc(b, 'cancel_booking', { p_booking_id: admBk.id }))

  console.log('\nSamtidighet: två boende i samma lägenhet bokar samtidigt')
  const results = await Promise.all([
    rpc(a1, 'book_slot', { p_date: day(9), p_slot: 1 }),
    rpc(a2, 'book_slot', { p_date: day(9), p_slot: 2 }),
    rpc(a1, 'book_slot', { p_date: day(9), p_slot: 3 }),
    rpc(a2, 'book_slot', { p_date: day(9), p_slot: 4 }),
  ])
  const okCount = results.filter((r) => !r.error).length
  check('exakt en av fyra samtidiga bokningar lyckas', okCount === 1, `${okCount} lyckades`)
  const cnt = await admin.from('bookings').select('id').eq('apartment_id', aptA.id)
  check('lägenhet A har exakt en bokning i databasen', cnt.data?.length === 1)

  console.log('\nRadering av boende (regel 11)')
  const a1Booking = cnt.data?.[0]
  const { error: delErr } = await admin.auth.admin.deleteUser(a1.id)
  check('A1 raderad i Auth', !delErr, delErr?.message)
  created.users = created.users.filter((id) => id !== a1.id)
  const afterDel = await admin.from('bookings').select('id').eq('id', a1Booking?.id ?? '')
  const resGone = await admin.from('residents').select('id').eq('id', a1.id)
  check('A1:s bokning och boende-rad försvann med kontot', (afterDel.data ?? []).length === 0 && (resGone.data ?? []).length === 0)
} catch (e) {
  failed++
  console.error('Oväntat fel:', e)
} finally {
  await cleanup()
}

console.log(`\n${passed} godkända, ${failed} underkända`)
process.exit(failed ? 1 : 0)
