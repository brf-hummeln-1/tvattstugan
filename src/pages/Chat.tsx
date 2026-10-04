import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatTime, todayISO } from '../lib/time'
import { Button, ErrorText, Spinner } from '../components/ui'

type Message = {
  id: string
  resident_id: string
  body: string
  created_at: string
  resident: { name: string; apartment: { label: string } | null } | null
}

const PAGE = 100
const messageSelect = '*, resident:residents(name, apartment:apartments(label))'

export function Chat() {
  const { resident } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(messageSelect)
      .order('created_at', { ascending: false })
      .limit(PAGE)
    if (error) {
      setError(error.message)
    } else {
      setMessages((data as Message[]).reverse())
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Hämta raden med namn och lägenhet (realtime-payloaden saknar join).
        const { data } = await supabase.from('messages').select(messageSelect).eq('id', payload.new.id).maybeSingle()
        if (data) {
          setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
      })
      .subscribe()
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // Scrolla till senaste meddelandet när listan ändras.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, loading])

  async function send(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || !resident) return
    setSending(true)
    setError(null)
    const { data, error } = await supabase
      .from('messages')
      .insert({ resident_id: resident.id, body })
      .select(messageSelect)
      .single()
    setSending(false)
    if (error) {
      setError(`Kunde inte skicka: ${error.message}`)
      return
    }
    setText('')
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]))
  }

  async function remove(id: string) {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) setError(error.message)
    else setMessages((prev) => prev.filter((m) => m.id !== id))
    setConfirmDeleteId(null)
  }

  const today = todayISO()

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <h1 className="mb-2 text-2xl font-bold">Chatt</h1>
      <ErrorText>{error}</ErrorText>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto py-2">
        {loading ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-slate-500">Inga meddelanden ännu. Skriv det första!</p>
        ) : (
          messages.map((m) => {
            const mine = m.resident_id === resident?.id
            const when = m.created_at.slice(0, 10) === today ? formatTime(m.created_at) : formatDateTime(m.created_at)
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    mine ? 'rounded-br-md bg-sky-700 text-white' : 'rounded-bl-md bg-white text-slate-900 shadow-sm'
                  }`}
                >
                  <p className={`text-sm font-semibold ${mine ? 'text-sky-100' : 'text-sky-800'}`}>
                    {m.resident?.name ?? 'Borttagen boende'}
                    {m.resident?.apartment ? `, lgh ${m.resident.apartment.label}` : ''}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-lg">{m.body}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className={`text-xs ${mine ? 'text-sky-200' : 'text-slate-500'}`}>{when}</span>
                    {resident?.is_admin &&
                      (confirmDeleteId === m.id ? (
                        <span className="flex gap-2 text-xs">
                          <button type="button" className="font-semibold text-red-200 underline" onClick={() => remove(m.id)}>
                            Ta bort
                          </button>
                          <button type="button" className="underline" onClick={() => setConfirmDeleteId(null)}>
                            Avbryt
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`text-xs underline ${mine ? 'text-sky-200' : 'text-slate-500'}`}
                          onClick={() => setConfirmDeleteId(m.id)}
                        >
                          Ta bort
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 flex gap-2 bg-slate-50 pt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Skriv ett meddelande…"
          maxLength={2000}
          enterKeyHint="send"
          className="min-h-14 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-lg outline-none focus:border-sky-600"
        />
        <Button type="submit" disabled={sending || !text.trim()} className="w-auto px-5">
          Skicka
        </Button>
      </form>
    </div>
  )
}
