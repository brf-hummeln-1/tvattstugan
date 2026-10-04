// Engångsskript: skapar första admin-användaren (Auth-konto + residents-rad).
// Körs lokalt. Service role key matas in interaktivt och sparas inte.
//
//   node scripts/create-admin.mjs "Linus Lindskoog" l.lindskoog@gmail.com
//
import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const [name, email] = process.argv.slice(2)
if (!name || !email) {
  console.error('Användning: node scripts/create-admin.mjs "Namn" mejl@adress.se')
  process.exit(1)
}

const url = process.env.SUPABASE_URL ?? 'https://sbnafogvwkxaqrjzmzhe.supabase.co'
let key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) {
  const rl = createInterface({ input: stdin, output: stdout })
  key = (await rl.question('Klistra in service role key (visas inte i repot): ')).trim()
  rl.close()
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const cleanEmail = email.trim().toLowerCase()

const { data: existing } = await admin.from('residents').select('id').eq('email', cleanEmail).maybeSingle()
if (existing) {
  console.log('Det finns redan en boende med den adressen, uppdaterar till admin.')
  const { error } = await admin.from('residents').update({ is_admin: true, name }).eq('id', existing.id)
  if (error) throw error
  process.exit(0)
}

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: cleanEmail,
  email_confirm: true,
  user_metadata: { name },
})
if (createError) throw createError

const { error: insertError } = await admin.from('residents').insert({
  id: created.user.id,
  name,
  email: cleanEmail,
  is_admin: true,
})
if (insertError) {
  await admin.auth.admin.deleteUser(created.user.id)
  throw insertError
}
console.log(`Admin skapad: ${name} <${cleanEmail}>`)
