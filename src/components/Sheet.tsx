import type { ReactNode } from 'react'

/** Bottenpanel i iOS-stil: dimmad bakgrund, handtag, glider upp. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="scrim-enter fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="sheet-enter w-full max-w-md rounded-t-[28px] bg-ios-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_40px_rgba(0,0,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-[5px] w-9 rounded-full bg-ios-fill-strong" aria-hidden />
        {children}
      </div>
    </div>
  )
}
