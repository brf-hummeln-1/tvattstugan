import { useCallback, useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDateTime } from '../lib/time'
import { Button, Card, ErrorText, PageTitle, SectionFooter, Spinner } from '../components/ui'

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
      <PageTitle
        action={
          resident?.is_admin && page && !editing ? (
            <button
              type="button"
              className="pressable mb-1 text-[17px] text-ios-tint"
              onClick={() => {
                setDraft(page.content)
                setEditing(true)
              }}
            >
              Redigera
            </button>
          ) : undefined
        }
      >
        Info
      </PageTitle>
      <ErrorText>{error}</ErrorText>
      {!page ? (
        <Spinner />
      ) : editing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={18}
            className="w-full rounded-ios bg-ios-card p-4 font-mono text-[15px] outline-none focus:ring-2 focus:ring-ios-tint/60"
          />
          <SectionFooter>Rad som börjar med # blir rubrik, rader med - blir punktlista, **fet** text.</SectionFooter>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Sparar…' : 'Spara'}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
            Avbryt
          </Button>
        </div>
      ) : (
        <>
          <Card>
            <div className="prose-ios" dangerouslySetInnerHTML={{ __html: html }} />
          </Card>
          <SectionFooter>Uppdaterad {formatDateTime(page.updated_at)}</SectionFooter>
        </>
      )}
    </div>
  )
}
