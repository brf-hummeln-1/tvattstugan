import type { ReactNode } from 'react'

/** Enkel bottenpanel för bekräftelser. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
