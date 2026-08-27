import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, SearchX } from 'lucide-react'
import ContributionItem from '@/components/ContributionItem'
import { loadContributions } from '@/lib/contributions'
import type { Contribution } from '@/lib/contributions'
import { cn } from '@/lib/utils'
import { pageTitle, site } from '@/config/site'

/**
 * Contributions (/contributions).
 * Quiet ledger of merged PRs ("patches") and published advisories rendered
 * from /contributions/index.json. Header (H1 + description + computed stat
 * line), text filter tabs (All / Advisories / Patches, counts, layoutId
 * underline) with a ghost sort dropdown, year-grouped hairline-separated
 * ContributionItem rows, "Show all" reveal. URL state: ?type=&sort=asc.
 * Motion is subtle fades/rises only (150–300ms, §5 easing).
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
const PAGE_SIZE = 20
const BASE_TITLE = site.title

type TypeFilter = 'all' | 'advisory' | 'patch'
type SortOrder = 'desc' | 'asc'

const TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'advisory', label: 'Advisories' },
  { key: 'patch', label: 'Patches' },
]

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: 'desc', label: 'Newest' },
  { key: 'asc', label: 'Oldest' },
]

function yearOf(item: Contribution): string {
  return item.date.slice(0, 4)
}

/* ---------------- Section 2 — sort dropdown ---------------- */

function SortDropdown({
  sort,
  onChange,
}: {
  sort: SortOrder
  onChange: (s: SortOrder) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = SORT_OPTIONS.find((o) => o.key === sort) ?? SORT_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[13px] text-ink-secondary transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle hover:text-ink"
      >
        <span>
          Sort: <span className="text-ink">{active.label}</span>
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn(
            'text-ink-muted transition-transform duration-200 ease-out-expo',
            open && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label="Sort order"
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-border bg-bg-raised py-1 shadow-float"
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={opt.key === sort}
                onClick={() => {
                  onChange(opt.key)
                  setOpen(false)
                }}
                className={cn(
                  'flex h-9 w-full items-center justify-between px-3 text-[13px] transition-colors duration-150 hover:bg-bg-subtle',
                  opt.key === sort ? 'text-ink' : 'text-ink-secondary hover:text-ink',
                )}
              >
                {opt.label}
                {opt.key === sort && (
                  <Check size={14} aria-hidden="true" className="text-accent" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------------- Section 3 — year group ---------------- */

function YearGroup({
  year,
  items,
  startIndex,
  revealOffset,
}: {
  year: string
  items: Contribution[]
  /** global row index of the first row in this group (for the 40ms stagger) */
  startIndex: number
  /** index at which a "Show all" reveal began (stagger restarts there) */
  revealOffset: number
}) {
  void useReducedMotion()
  return (
    <motion.section
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.3, ease: EASE }}
      aria-label={`Contributions from ${year}`}
    >
      <div className="flex items-center gap-4">
        <h2 className="font-mono text-[13px] uppercase tracking-[0.08em] text-ink-muted">
          {year}
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <div>
        {items.map((item, i) => {
          const globalIndex = startIndex + i
          const staggerIndex = Math.max(0, globalIndex - revealOffset)
          return (
            <motion.div
              key={item.id}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.2,
                delay: Math.min(staggerIndex * 0.04, 0.6),
                ease: EASE,
              }}
            >
              <ContributionItem item={item} />
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}

/* ---------------- loading / error / empty states ---------------- */

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="border-t border-border py-5 first:border-t-0">
          <div className="flex items-center gap-2.5">
            <span className="h-[22px] w-[72px] rounded-md bg-bg-subtle" />
            <span className="h-[14px] w-[70px] rounded bg-bg-subtle" />
          </div>
          <div className="mt-3 h-[18px] w-3/4 rounded bg-bg-subtle" />
          <div className="mt-2 h-[14px] w-full rounded bg-bg-subtle" />
          <div className="mt-1.5 h-[14px] w-2/3 rounded bg-bg-subtle" />
          <div className="mt-3 h-[13px] w-1/3 rounded bg-bg-subtle" />
        </div>
      ))}
    </div>
  )
}

/* ---------------- page ---------------- */

export default function Contributions() {
  void useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Contribution[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    document.title = pageTitle(site.contributions.heading)
    return () => {
      document.title = BASE_TITLE
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadContributions()
      .then((data) => {
        if (cancelled) return
        setItems(data)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'failed to load contributions')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const type: TypeFilter =
    searchParams.get('type') === 'advisory' || searchParams.get('type') === 'patch'
      ? (searchParams.get('type') as TypeFilter)
      : 'all'
  const sort: SortOrder = searchParams.get('sort') === 'asc' ? 'asc' : 'desc'

  const updateParams = (nextType: TypeFilter, nextSort: SortOrder) => {
    const next = new URLSearchParams(searchParams)
    if (nextType === 'all') next.delete('type')
    else next.set('type', nextType)
    if (nextSort === 'desc') next.delete('sort')
    else next.set('sort', nextSort)
    setSearchParams(next, { replace: true })
    setShowAll(false)
  }

  const counts = useMemo(() => {
    const all = items ?? []
    return {
      all: all.length,
      advisory: all.filter((i) => i.type === 'advisory').length,
      patch: all.filter((i) => i.type === 'patch').length,
    }
  }, [items])

  const statLine = useMemo(() => {
    if (!items || items.length === 0) return null
    const patches = items.filter((i) => i.type === 'patch').length
    const advisories = items.length - patches
    const years = items.map((i) => yearOf(i))
    const min = Math.min(...years.map(Number))
    const max = Math.max(...years.map(Number))
    return `${items.length} contributions · ${patches} patches merged · ${advisories} advisories published · ${min}–${max}`
  }, [items])

  const filtered = useMemo(() => {
    const all = items ?? []
    const byType = type === 'all' ? all : all.filter((i) => i.type === type)
    const sorted = [...byType].sort((a, b) => (a.date < b.date ? -1 : 1))
    return sort === 'desc' ? sorted.reverse() : sorted
  }, [items, type, sort])

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE)

  const groups = useMemo(() => {
    const out: { year: string; items: Contribution[]; startIndex: number }[] = []
    visible.forEach((item, index) => {
      const year = yearOf(item)
      const last = out[out.length - 1]
      if (last && last.year === year) last.items.push(item)
      else out.push({ year, items: [item], startIndex: index })
    })
    return out
  }, [visible])

  // index at which a "Show all" reveal began — its stagger restarts there
  const revealOffset = showAll ? PAGE_SIZE : 0

  const headerAnim = (delayMs: number) => ({
    initial: false,
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.26, delay: delayMs / 1000, ease: EASE },
  })

  const listKey = `${type}|${sort}`

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-6">
      {/* ---------- Section 1 — page header ---------- */}
      <header className="pb-8 pt-10 sm:pt-14">
        <motion.h1 {...headerAnim(0)} className="font-display text-h1-sm text-ink sm:text-h1">
          {site.contributions.heading}
        </motion.h1>
        <motion.p
          {...headerAnim(60)}
          className="mt-3 max-w-[62ch] text-[15.5px] leading-[1.65] text-ink-secondary"
        >
          {site.contributions.description}
        </motion.p>
        {statLine && (
          <motion.p
            {...headerAnim(120)}
            className="mt-2 font-mono text-[12.5px] text-ink-muted"
          >
            {statLine}
          </motion.p>
        )}
      </header>

      {/* ---------- Section 2 — filter tabs + sort ---------- */}
      <motion.section
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        className="pb-6"
        aria-label="Filter contributions"
      >
        <div className="flex items-end justify-between gap-4 border-b border-border">
          <div role="tablist" aria-label="Contribution type" className="flex items-center gap-5">
            {TABS.map((tab) => {
              const isActive = tab.key === type
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => updateParams(tab.key, sort)}
                  className={cn(
                    'relative pb-2.5 text-[14.5px] font-medium transition-colors duration-150',
                    isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {tab.label}
                  <span className="ml-1.5 font-mono text-[12px] text-ink-muted">
                    {counts[tab.key]}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="contrib-tab-underline"
                      transition={{ duration: 0.22, ease: EASE }}
                      className="absolute -bottom-px left-0 right-0 h-[2px] bg-accent"
                    />
                  )}
                </button>
              )
            })}
          </div>
          <div className="pb-1.5">
            <SortDropdown sort={sort} onChange={(s) => updateParams(type, s)} />
          </div>
        </div>
      </motion.section>

      {/* ---------- Section 3 — contribution list ---------- */}
      {loadError ? (
        <div className="py-20 text-center">
          <p className="text-[15px] font-medium text-ink">Couldn't load contributions.</p>
          <p className="mt-1 font-mono text-[12.5px] text-ink-muted">{loadError}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-5 rounded-md border border-border px-4 py-2 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle"
          >
            Try again
          </button>
        </div>
      ) : items === null ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <SearchX size={28} aria-hidden="true" className="mx-auto text-ink-muted" />
          <p className="mt-3 text-[15px] font-semibold text-ink">No items in this view.</p>
          <button
            type="button"
            onClick={() => updateParams('all', 'desc')}
            className="mt-2 text-[14px] text-accent transition-colors duration-150 hover:text-accent-hover"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={listKey}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="[&>section+section]:mt-10"
            >
              {groups.map((group) => (
                <YearGroup
                  key={`${listKey}|${group.year}`}
                  year={group.year}
                  items={group.items}
                  startIndex={group.startIndex}
                  revealOffset={revealOffset}
                />
              ))}
            </motion.div>
          </AnimatePresence>
          {!showAll && filtered.length > PAGE_SIZE && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-md border border-border px-4 py-2 text-[14px] font-medium text-ink-secondary transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle hover:text-ink"
              >
                Show all ({filtered.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
