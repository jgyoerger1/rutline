import { AnimatePresence, motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ember-500 text-ember-950 hover:bg-ember-400 border border-ember-300/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
  secondary: 'bg-pine-800 text-bone-50 hover:bg-pine-700 border border-bone-50/10 shadow-[inset_0_1px_0_rgba(242,237,226,0.06)]',
  ghost: 'bg-transparent text-bone-200 hover:bg-pine-800/70 border border-transparent',
  danger: 'bg-transparent text-ember-400 hover:bg-ember-950/60 border border-ember-600/30',
}
const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
}

export function Button({ variant = 'secondary', size = 'md', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={`push inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function IconButton({ label, className = '', children, size = 44, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: number }) {
  return (
    <button aria-label={label} title={label} style={{ width: size, height: size }} className={`push inline-grid place-items-center rounded-xl glass text-bone-50 hover:bg-pine-700/80 transition-colors disabled:opacity-50 ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Segmented<T extends string>({ value, onChange, options, id, className = '' }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; id: string; className?: string }) {
  return (
    <div role="radiogroup" className={`inline-flex p-1 rounded-xl bg-pine-900 border border-bone-50/8 ${className}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button key={o.value} role="radio" aria-checked={active} onClick={() => onChange(o.value)} className={`push relative px-3 h-8 rounded-lg text-[13px] font-medium transition-colors ${active ? 'text-ember-950' : 'text-bone-400 hover:text-bone-50'}`}>
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-ember-500" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Field({ label, helper, error, children, className = '' }: { label: string; helper?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[12px] font-medium tracking-wide text-bone-400 uppercase">{label}</span>
      {children}
      {error ? <span className="text-[12px] text-ember-400">{error}</span> : helper ? <span className="text-[12px] text-bone-600">{helper}</span> : null}
    </label>
  )
}

const INPUT = 'w-full h-11 px-3.5 rounded-xl bg-pine-900 border border-bone-50/10 text-bone-50 placeholder:text-bone-600 outline-none focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/15 transition-colors'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${INPUT} ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${INPUT} h-auto min-h-24 py-3 leading-relaxed resize-y ${className}`} {...rest} />
}

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[11px] uppercase tracking-[0.18em] text-bone-600 ${className}`}>{children}</div>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function EmptyState({ icon, title, body, action, className = '' }: { icon: ReactNode; title: string; body: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-bone-50/8 bg-pine-900/60 px-6 py-10 md:px-10 ${className}`}>
      <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-ember-500/8 blur-3xl pointer-events-none" aria-hidden />
      <div className="relative grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
        <div className="w-14 h-14 rounded-2xl grid place-items-center bg-pine-800 border border-bone-50/10 text-ember-400">{icon}</div>
        <div className="max-w-[52ch]">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm text-bone-400 leading-relaxed">{body}</p>
          {action && <div className="mt-5 flex flex-wrap gap-2">{action}</div>}
        </div>
      </div>
    </div>
  )
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-xl border border-ember-600/30 bg-ember-950/40 px-4 py-3 text-sm text-bone-200">
      <span className="w-1.5 h-1.5 rounded-full bg-ember-400 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export function Sheet({ open, onClose, title, children, footer, scrollKey }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; scrollKey?: string | number | null }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [scrollKey, open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="backdrop" className="fixed inset-0 z-[55] bg-pine-950/55 md:bg-transparent md:pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.section
            key="sheet"
            role="dialog"
            aria-modal="true"
            className="fixed z-[56] inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl glass flex flex-col md:inset-y-0 md:left-auto md:right-0 md:w-[440px] md:max-h-none md:rounded-none md:rounded-l-3xl md:border-l"
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-bone-50/8">
              <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-bone-50/15" />
              <div className="flex-1 min-w-0 text-base font-semibold tracking-tight truncate">{title}</div>
              <button onClick={onClose} aria-label="Close" className="push w-9 h-9 grid place-items-center rounded-lg text-bone-400 hover:text-bone-50 hover:bg-pine-700/70">
                <X size={18} />
              </button>
            </div>
            <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
            {footer && <div className="px-5 py-3 border-t border-bone-50/8 pb-safe">{footer}</div>}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}

export function Chip({ active, onClick, children, className = '' }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button onClick={onClick} className={`push shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium border transition-colors ${active ? 'bg-ember-500 text-ember-950 border-ember-300/30' : 'glass text-bone-200 hover:text-bone-50'} ${className}`}>
      {children}
    </button>
  )
}

export function Stat({ label, value, sub, mono = true }: { label: string; value: ReactNode; sub?: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <SectionLabel>{label}</SectionLabel>
      <div className={`mt-1 text-lg leading-tight tnum ${mono ? 'font-mono' : 'font-medium'}`}>{value}</div>
      {sub && <div className="text-[12px] text-bone-600 mt-0.5 truncate">{sub}</div>}
    </div>
  )
}
