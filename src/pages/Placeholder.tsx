import { Card, PageTitle } from '../components/ui'

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle>{title}</PageTitle>
      <Card>
        <p className="text-slate-600">Den här delen är inte byggd ännu.</p>
      </Card>
    </div>
  )
}
