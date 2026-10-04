import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean }

function base(props: IconProps) {
  const { filled, className = '', ...rest } = props
  return {
    ...rest,
    className: `h-7 w-7 ${className}`,
    viewBox: '0 0 24 24',
    fill: filled ? 'currentColor' : 'none',
    stroke: 'currentColor',
    strokeWidth: filled ? 0 : 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

/** Kalender */
export function CalendarIcon(props: IconProps) {
  const b = base(props)
  return props.filled ? (
    <svg {...b}>
      <path d="M7 2.5a1 1 0 0 1 1 1V5h8V3.5a1 1 0 1 1 2 0V5h.5A3.5 3.5 0 0 1 22 8.5V9H2v-.5A3.5 3.5 0 0 1 5.5 5H6V3.5a1 1 0 0 1 1-1ZM2 11h20v7.5a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 18.5V11Zm5 3.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" />
    </svg>
  ) : (
    <svg {...b}>
      <rect x="3" y="5.5" width="18" height="15.5" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="7.5" cy="15" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="15" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Tvättmaskin */
export function WasherIcon(props: IconProps) {
  const b = base(props)
  return props.filled ? (
    <svg {...b}>
      <path
        fillRule="evenodd"
        d="M6.5 2A3.5 3.5 0 0 0 3 5.5v13A3.5 3.5 0 0 0 6.5 22h11a3.5 3.5 0 0 0 3.5-3.5v-13A3.5 3.5 0 0 0 17.5 2h-11ZM7 4.75a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm3.5 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2ZM12 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-3 5a3 3 0 0 1 5.7-1.3c-.9.2-1.5.9-2.7.9S10.3 13 9 12.7V14Z"
      />
    </svg>
  ) : (
    <svg {...b}>
      <rect x="3.5" y="2.75" width="17" height="18.5" rx="3" />
      <circle cx="12" cy="14" r="4.5" />
      <path d="M8.3 13.5c1.2-1 2.3-1 3.7 0s2.5 1 3.7 0" />
      <circle cx="7.25" cy="6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10.25" cy="6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Pratbubblor */
export function ChatIcon(props: IconProps) {
  const b = base(props)
  return props.filled ? (
    <svg {...b}>
      <path d="M12 3C6.75 3 2.5 6.6 2.5 11c0 2.1.95 4 2.5 5.4-.2 1.3-.8 2.6-1.7 3.6-.2.25 0 .6.3.6 1.9-.1 3.6-.8 4.9-1.8 1.1.35 2.3.55 3.5.55 5.25 0 9.5-3.6 9.5-8S17.25 3 12 3Z" />
    </svg>
  ) : (
    <svg {...b}>
      <path d="M12 3.75c-4.8 0-8.5 3.2-8.5 7.25 0 2 .9 3.75 2.4 5-.2 1.3-.7 2.5-1.5 3.5 1.8-.1 3.4-.75 4.7-1.7 .9.3 1.9.45 2.9.45 4.8 0 8.5-3.2 8.5-7.25S16.8 3.75 12 3.75Z" />
    </svg>
  )
}

/** Info-cirkel */
export function InfoIcon(props: IconProps) {
  const b = base(props)
  return props.filled ? (
    <svg {...b}>
      <path
        fillRule="evenodd"
        d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 4.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm-1.5 4.5h2.25v4.5h1.5v1.5h-4.5v-1.5h1.5v-3h-.75v-1.5Z"
      />
    </svg>
  ) : (
    <svg {...b}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.75v.25" />
    </svg>
  )
}

/** Tre prickar i cirkel (Mer) */
export function MoreIcon(props: IconProps) {
  const b = base(props)
  return props.filled ? (
    <svg {...b}>
      <path
        fillRule="evenodd"
        d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19ZM7.5 10.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
      />
    </svg>
  ) : (
    <svg {...b}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="7.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ChevronRight({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.5 6l6 6-6 6" />
    </svg>
  )
}

export function ChevronLeft({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 5l-7 7 7 7" />
    </svg>
  )
}

export function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function SendIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${className}`} fill="currentColor" aria-hidden>
      <path d="M12 4a1 1 0 0 1 .7.3l6 6a1 1 0 0 1-1.4 1.4L13 7.4V19a1 1 0 1 1-2 0V7.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l6-6A1 1 0 0 1 12 4Z" />
    </svg>
  )
}

export function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
