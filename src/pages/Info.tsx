import { useCallback, useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/time'
import { Button, Card, ErrorText, PageTitle, Spinner } from '../components/ui'

type InfoPage = { content: string; updated_at: string }

export function Info() {
  const { resident } = useAuth()
  const [page, setPage] = useState<InfoPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('info_page').select('content, updated_at').eq('id', 1).maybeSingle()
    if (error) setError(error.message)
    else setPage(data as InfoPage)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('info_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'info_page' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const html = useMemo(() => {
    if (!page) return ''
    return DOMPurify.sanitize(marked.parse(page.content, { async: false }) as string)
  }, [page])

  async function save() {
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('info_page')
      .update({ content: draft, updated_at: new Date().toISOString(), updated_by: resident?.id ?? null })
      .eq('id', 1)
    setBusy(false)
    if (error) return setError(error.message)
    setEditing(false)
    await load()
  }

  return (
    <div className="mx-auto max-w-md">
      <PageTitle>Info</PageTitle>
      <ErrorText>{error}</ErrorText>
      {!page ? (
        <Spinner />
      ) : editing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={18}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-base outline-none focus:border-sky-600"
          />
          <p className="text-sm text-slate-500">
            Formatering: rad som börjar med # blir rubrik, rader med - blir punktlista, **fet** text.
          </p>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Sparar…' : 'Spara'}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
            Avbryt
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <div
              className="prose-sm space-y-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-slate-700 [&_a]:text-sky-700 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Card>
          <p className="text-sm text-slate-500">Uppdaterad {formatDateTime(page.updated_at)}</p>
          {resident?.is_admin && (
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(page.content)
                setEditing(true)
              }}
            >
              Redigera (admin)
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
