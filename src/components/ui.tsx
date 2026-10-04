import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-sky-700 text-white active:bg-sky-800 disabled:bg-sky-300',
  secondary: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100 disabled:text-slate-400',
  danger: 'bg-red-600 text-white active:bg-red-700 disabled:bg-red-300',
  ghost: 'bg-transparent text-sky-700 active:bg-sky-50 disabled:text-slate-400',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`min-h-14 w-full rounded-xl px-5 text-lg font-semibold transition disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
    />
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-200 ${className}`}
    />
  )
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-200 ${className}`}
    />
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-base font-medium text-slate-700">
      {children}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-2xl font-bold">{children}</h1>
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-xl bg-red-50 p-3 text-base text-red-700">{children}</p>
}

export function Spinner() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-700" />
    </div>
  )
}
