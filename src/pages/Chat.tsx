import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDateTime, formatTime, todayISO } from '../lib/time'
import { ErrorText, Spinner } from '../components/ui'
import { SendIcon } from '../components/icons'

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
        const { data } = await supabase.from('messages').select(messageSelect).eq('id', payload.new.id).maybeSingle()
        if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]))
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
      <h1 className="mb-2 text-[34px] font-bold tracking-[-0.02em]">Chatt</h1>
      <ErrorText>{error}</ErrorText>

      <div className="flex-1 space-y-2 overflow-y-auto py-2">
        {loading ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-ios-label-2">Inga meddelanden ännu. Skriv det första!</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.resident_id === resident?.id
            const prev = messages[i - 1]
            const sameSender = prev && prev.resident_id === m.resident_id
            const when = m.created_at.slice(0, 10) === today ? formatTime(m.created_at) : formatDateTime(m.created_at)
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${sameSender ? '' : 'pt-2'}`}>
                {!mine && !sameSender && (
                  <p className="mb-0.5 ml-3 text-[13px] text-ios-label-2">
                    {m.resident?.name ?? 'Borttagen boende'}
                    {m.resident?.apartment ? ` · lgh ${m.resident.apartment.label}` : ''}
                  </p>
                )}
                <div
                  className={`max-w-[80%] rounded-[20px] px-4 py-2 text-[17px] ${
                    mine ? 'rounded-br-[6px] bg-ios-tint text-white' : 'rounded-bl-[6px] bg-ios-bubble text-ios-label'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <div className={`mt-0.5 flex items-center gap-3 px-3 text-[11px] text-ios-label-3`}>
                  <span>{when}</span>
                  {resident?.is_admin &&
                    (confirmDeleteId === m.id ? (
                      <>
                        <button type="button" className="font-semibold text-ios-red" onClick={() => remove(m.id)}>
                          Ta bort
                        </button>
                        <button type="button" className="text-ios-tint" onClick={() => setConfirmDeleteId(null)}>
                          Avbryt
                        </button>
                      </>
                    ) : (
                      <button type="button" className="text-ios-label-3" onClick={() => setConfirmDeleteId(m.id)}>
                        Ta bort
                      </button>
                    ))}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 flex items-end gap-2 bg-ios-bg pt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Meddelande"
          maxLength={2000}
          enterKeyHint="send"
          className="min-h-[44px] flex-1 rounded-full border border-ios-separator bg-ios-card px-4 text-[17px] outline-none placeholder:text-ios-label-3 focus:border-ios-tint"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Skicka"
          className="pressable flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-ios-tint text-white disabled:opacity-30"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  )
}
