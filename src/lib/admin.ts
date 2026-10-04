import { supabase } from './supabase'

type ResidentPayload = {
  name?: string
  email?: string
  phone?: string | null
  apartment_id?: string | null
  is_admin?: boolean
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-residents', { body })
  if (error) {
    // FunctionsHttpError bär svaret med felmeddelandet från funktionen.
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.json()
        if (parsed?.error) throw new Error(parsed.error)
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw new Error(error.message || 'Något gick fel')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export const adminApi = {
  createResident: (input: ResidentPayload & { name: string; email: string }) =>
    call({ action: 'create', ...input }),
  updateResident: (id: string, input: ResidentPayload) => call({ action: 'update', id, ...input }),
  deleteResident: (id: string) => call({ action: 'delete', id }),
}
