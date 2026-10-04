// Edge Function: admin hanterar boende (skapa, ändra, radera).
// Kräver att anroparen är inloggad och admin. Använder service role för Auth Admin API.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type CreateInput = {
  action: 'create'
  name: string
  email: string
  phone?: string | null
  apartment_id?: string | null
  is_admin?: boolean
}
type UpdateInput = {
  action: 'update'
  id: string
  name?: string
  email?: string
  phone?: string | null
  apartment_id?: string | null
  is_admin?: boolean
}
type DeleteInput = { action: 'delete'; id: string }
type Input = CreateInput | UpdateInput | DeleteInput

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metoden stöds inte' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Inte inloggad' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Vem anropar?
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Inte inloggad' }, 401)
  const callerId = userData.user.id

  const { data: caller } = await admin
    .from('residents')
    .select('is_admin')
    .eq('id', callerId)
    .maybeSingle()
  if (!caller?.is_admin) return json({ error: 'Bara admin får göra detta' }, 403)

  let input: Input
  try {
    input = await req.json()
  } catch {
    return json({ error: 'Ogiltig begäran' }, 400)
  }

  try {
    switch (input.action) {
      case 'create': {
        const name = input.name?.trim()
        const email = normalizeEmail(input.email ?? '')
        if (!name || !email || !email.includes('@')) {
          return json({ error: 'Namn och giltig mejladress krävs' }, 400)
        }
        const { data: existing } = await admin
          .from('residents')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        if (existing) return json({ error: 'Det finns redan en boende med den mejladressen' }, 409)

        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { name },
        })
        if (createError || !created.user) {
          return json({ error: createError?.message ?? 'Kunde inte skapa kontot' }, 400)
        }

        const { error: insertError } = await admin.from('residents').insert({
          id: created.user.id,
          name,
          email,
          phone: input.phone?.trim() || null,
          apartment_id: input.apartment_id || null,
          is_admin: !!input.is_admin,
        })
        if (insertError) {
          // Rulla tillbaka Auth-kontot så vi inte får ett konto utan boende-rad.
          await admin.auth.admin.deleteUser(created.user.id)
          return json({ error: insertError.message }, 400)
        }
        return json({ ok: true, id: created.user.id })
      }

      case 'update': {
        if (!input.id) return json({ error: 'id saknas' }, 400)
        const patch: Record<string, unknown> = {}
        if (input.name !== undefined) {
          const name = input.name.trim()
          if (!name) return json({ error: 'Namn krävs' }, 400)
          patch.name = name
        }
        if (input.phone !== undefined) patch.phone = input.phone?.trim() || null
        if (input.apartment_id !== undefined) patch.apartment_id = input.apartment_id || null
        if (input.is_admin !== undefined) {
          if (input.id === callerId && input.is_admin === false) {
            return json({ error: 'Du kan inte ta bort admin från dig själv' }, 400)
          }
          patch.is_admin = !!input.is_admin
        }
        if (input.email !== undefined) {
          const email = normalizeEmail(input.email)
          if (!email.includes('@')) return json({ error: 'Ogiltig mejladress' }, 400)
          const { error: emailError } = await admin.auth.admin.updateUserById(input.id, {
            email,
            email_confirm: true,
          })
          if (emailError) return json({ error: emailError.message }, 400)
          patch.email = email
        }
        if (Object.keys(patch).length > 0) {
          const { error: updateError } = await admin.from('residents').update(patch).eq('id', input.id)
          if (updateError) return json({ error: updateError.message }, 400)
        }
        return json({ ok: true })
      }

      case 'delete': {
        if (!input.id) return json({ error: 'id saknas' }, 400)
        if (input.id === callerId) return json({ error: 'Du kan inte radera dig själv' }, 400)
        // Auth-kontot raderas; residents, bokningar, meddelanden, push-prenumerationer
        // och inställningar följer med via on delete cascade.
        const { error: deleteError } = await admin.auth.admin.deleteUser(input.id)
        if (deleteError) return json({ error: deleteError.message }, 400)
        return json({ ok: true })
      }

      default:
        return json({ error: 'Okänd åtgärd' }, 400)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Okänt fel' }, 500)
  }
})
