import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { TocHeading } from '@/lib/posts'
import { cn } from '@/lib/utils'

/**
 * Toc — docs/DESIGN.md §6.10. Quiet sticky table of contents with scroll-spy.
 * Desktop (≥1100px): sticky right column (top 96px, 220px), "On this page"
 * label, items 13.5px ink-muted with a 2px left track; the active segment
 * is accent (slides via layout animation, 220ms) and its text turns --ink.
 * Mobile: inline disclosure box ("On this page", chevron rotates 180°,
 * content expands 250ms). Clicks smooth-scroll; the 88px header offset is
 * handled by scroll-margin-top on headings.
 */

export interface TocProps {
  headings: TocHeading[]
  className?: string
}

function useScrollSpy(headings: TocHeading[]): string | null {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null)

  useEffect(() => {
    if (headings.length === 0) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const threshold = 88 + 16
        let current: string | null = headings[0].id
        for (const h of headings) {
          const el = document.getElementById(h.id)
          if (el && el.getBoundingClientRect().top <= threshold) current = h.id
        }
        setActive(current)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [headings])

  return active
}

function scrollToHeading(id: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
  }
}

function TocList({
  headings,
  active,
  onNavigate,
}: {
  headings: TocHeading[]
  active: string | null
  onNavigate?: () => void
}) {
  return (
    <ul className="relative border-l-2 border-border">
      {headings.map((h) => {
        const isActive = h.id === active
        return (
          <li key={h.id} className="relative">
            {isActive && (
              <motion.span
                layoutId="toc-active-marker"
                className="absolute -left-[2px] top-1.5 bottom-1.5 w-[2px] rounded-full bg-accent"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                scrollToHeading(h.id)(e)
                onNavigate?.()
              }}
              className={cn(
                'block py-1 pl-3 text-[13.5px] leading-[1.5] transition-colors duration-150',
                h.depth === 3 && 'pl-[26px]',
                isActive ? 'text-ink' : 'text-ink-muted hover:text-ink-secondary',
              )}
            >
              {h.text}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

export default function Toc({ headings, className }: TocProps) {
  const active = useScrollSpy(headings)
  const [open, setOpen] = useState(false)

  if (headings.length === 0) return null

  return (
    <>
      {/* desktop: sticky right column */}
      <nav
        aria-label="Table of contents"
        className={cn('sticky top-24 hidden w-[220px] min-[1100px]:block', className)}
      >
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
          On this page
        </p>
        <TocList headings={headings} active={active} />
      </nav>

      {/* mobile: inline disclosure */}
      <div className="rounded-lg border border-border bg-bg-subtle min-[1100px]:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-4 py-2.5"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
            On this page
          </span>
          <ChevronDown
            size={15}
            className={cn(
              'text-ink-muted transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-1 pb-3 pt-1">
                <TocList headings={headings} active={active} onNavigate={() => setOpen(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
