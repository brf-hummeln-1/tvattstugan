import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { ChevronRight } from './icons'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'tinted'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ios-tint text-white disabled:opacity-40',
  tinted: 'bg-ios-tint-soft text-ios-tint disabled:opacity-40',
  secondary: 'bg-ios-fill text-ios-tint disabled:opacity-40',
  danger: 'bg-ios-red text-white disabled:opacity-40',
  ghost: 'bg-transparent text-ios-tint disabled:opacity-40',
}

/** Kapselknapp i iOS-stil. */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`pressable min-h-[50px] w-full rounded-full px-5 text-[17px] font-semibold disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
    />
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-12 w-full rounded-ios-sm bg-ios-fill px-4 text-[17px] text-ios-label outline-none placeholder:text-ios-label-3 focus:ring-2 focus:ring-ios-tint/60 ${className}`}
    />
  )
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`min-h-12 w-full appearance-none rounded-ios-sm bg-ios-fill px-4 pr-10 text-[17px] text-ios-label outline-none focus:ring-2 focus:ring-ios-tint/60 ${className}`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ios-label-2">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 10l5 5 5-5" />
        </svg>
      </span>
    </div>
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[15px] font-medium text-ios-label-2">
      {children}
    </label>
  )
}

/** Insatt grupperad yta (secondarySystemGroupedBackground). */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-ios bg-ios-card p-4 ${className}`}>{children}</div>
}

/** Grupperad lista med hårlinjer mellan raderna. */
export function ListGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`hairline overflow-hidden rounded-ios bg-ios-card ${className}`}>{children}</div>
}

/** Rad i en grupperad lista. Blir en knapp om onClick anges. */
export function ListRow({
  title,
  subtitle,
  trailing,
  chevron = false,
  onClick,
  leading,
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  chevron?: boolean
  onClick?: () => void
  leading?: ReactNode
  className?: string
}) {
  const content = (
    <>
      {leading && <span className="mr-3 flex-none">{leading}</span>}
      <span className="min-w-0 flex-1 py-3">
        <span className="block text-[17px] text-ios-label">{title}</span>
        {subtitle && <span className="block text-[15px] text-ios-label-2">{subtitle}</span>}
      </span>
      {trailing && <span className="ml-3 flex-none text-right text-[17px] text-ios-label-2">{trailing}</span>}
      {chevron && <ChevronRight className="ml-2 flex-none text-ios-label-3" />}
    </>
  )
  const cls = `flex min-h-[52px] w-full items-center pl-4 pr-4 text-left ${className}`
  return onClick ? (
    <button type="button" onClick={onClick} className={`pressable-row ${cls}`}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  )
}

/** Sektionsrubrik ovanför en grupp (versaler, fotnotsstorlek). */
export function SectionHeader({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-5 px-4 text-[13px] uppercase tracking-wide text-ios-label-2">{children}</p>
}

export function SectionFooter({ children }: { children: ReactNode }) {
  return <p className="mt-2 px-4 text-[13px] text-ios-label-2">{children}</p>
}

/** Stor titel som i iOS navigationsfält. */
export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em]">{children}</h1>
      {action}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-ios-sm bg-ios-red-soft px-4 py-3 text-[15px] text-ios-red">{children}</p>
}

export function Spinner() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-ios-fill-strong border-t-ios-tint" />
    </div>
  )
}

/** iOS-brytare. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return <input type="checkbox" className="ios-switch" checked={checked} onChange={onChange} aria-label={label} />
}

/** Segmenterad kontroll. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex rounded-[10px] bg-ios-fill p-[2px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-9 flex-1 rounded-[8px] text-[13px] font-semibold transition-colors ${
            value === o.value ? 'bg-ios-card text-ios-label shadow-sm' : 'text-ios-label-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Liten statusmarkör (kapsel). */
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'tint' | 'green' | 'red' | 'orange' }) {
  const tones = {
    neutral: 'bg-ios-fill text-ios-label-2',
    tint: 'bg-ios-tint-soft text-ios-tint',
    green: 'bg-ios-green-soft text-ios-green',
    red: 'bg-ios-red-soft text-ios-red',
    orange: 'bg-ios-orange-soft text-ios-orange',
  }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${tones[tone]}`}>{children}</span>
}
