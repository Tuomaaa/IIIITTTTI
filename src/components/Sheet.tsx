import type { ReactNode } from 'react'

/** Side drawer on desktop, bottom sheet on mobile. */
export function Sheet({ mobile, onClose, z = 50, children }: { mobile: boolean; onClose: () => void; z?: number; children: ReactNode }) {
  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,.18)', zIndex: z - 10 }} onClick={onClose} />
      <aside
        className="fade-in scroll-thin fixed overflow-y-auto"
        style={{
          zIndex: z,
          background: 'var(--panel)',
          boxShadow: 'var(--shadow)',
          ...(mobile
            ? { left: 0, right: 0, bottom: 0, maxHeight: '82vh', borderTop: '1px solid var(--line)', borderRadius: '12px 12px 0 0' }
            : { top: 8, right: 8, bottom: 8, width: 380, border: '1px solid var(--line)', borderRadius: 10 }),
        }}
      >
        {children}
      </aside>
    </>
  )
}
