import { useEffect, useMemo, useState } from 'react'
import { useNavigationType, useSearchParams } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SearchX } from 'lucide-react'
import Fuse from 'fuse.js'
import SearchInput from '@/components/SearchInput'
import PostListItem from '@/components/PostListItem'
import TagFilterChip from '@/components/blog/TagFilterChip'
import { loadPosts, searchRecords } from '@/lib/posts'
import type { PostMeta, SearchRecord } from '@/lib/posts'
import { pageTitle, site } from '@/config/site'
import { cn } from '@/lib/utils'

/**
 * Blog (/blog) — the complete, filterable archive: quiet search
 * (fuse.js over searchRecords(), 120ms debounce), multi-select tag chips
 * with counts, year-grouped PostListItem rows (newest first), URL state
 * (?tag= repeatable + ?q=, replaceState), result-count line, empty and
 * loading/error states. Motion: subtle fades/rises only (150–300ms),
 * opacity-only under prefers-reduced-motion.
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
const SCROLL_KEY = 'blog:scrollY'

interface YearGroup {
  year: string
  posts: PostMeta[]
}

function groupByYear(posts: PostMeta[]): YearGroup[] {
  const groups: YearGroup[] = []
  for (const post of posts) {
    const year = post.date.slice(0, 4) || 'Undated'
    const last = groups[groups.length - 1]
    if (last && last.year === year) {
      last.posts.push(post)
    } else {
      groups.push({ year, posts: [post] })
    }
  }
  return groups
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <SearchX size={28} aria-hidden="true" className="text-ink-muted" />
      <p className="mt-4 text-[15px] font-semibold text-ink">No posts found</p>
      <p className="mt-1 text-[14px] text-ink-secondary">
        Try a different keyword or clear the tag filter.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 rounded-md border border-border px-4 py-2 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle"
      >
        Clear filters
      </button>
    </div>
  )
}

export default function Blog() {
  const reduce = useReducedMotion()
  const navigationType = useNavigationType()
  const [searchParams, setSearchParams] = useSearchParams()

  const [posts, setPosts] = useState<PostMeta[] | null>(null)
  const [records, setRecords] = useState<SearchRecord[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  /* ---------- data ---------- */

  useEffect(() => {
    document.title = pageTitle(site.blog.heading)
    return () => {
      document.title = site.title
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadPosts()
      .then((all) => {
        if (!cancelled) setPosts(all)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    // Warm the full-text search index alongside the archive. This fetches every
    // post body, so it only runs when search is switched on.
    if (site.features.search) {
      searchRecords()
        .then((recs) => {
          if (!cancelled) setRecords(recs)
        })
        .catch(() => {
          /* search stays tag-only if the index fails to build */
        })
    }
    return () => {
      cancelled = true
    }
  }, [retryNonce])

  /* ---------- scroll restoration (back from a post keeps position) ---------- */

  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
      } catch {
        /* storage unavailable */
      }
    }
  }, [])

  useEffect(() => {
    if (!posts) return
    let saved: number | null = null
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY)
      saved = raw === null ? null : Number(raw)
      sessionStorage.removeItem(SCROLL_KEY)
    } catch {
      /* storage unavailable */
    }
    if (navigationType === 'POP' && saved !== null && Number.isFinite(saved) && saved > 0) {
      const y = saved
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
  }, [posts, navigationType])

  /* ---------- URL state ---------- */

  const selectedTags = useMemo(() => searchParams.getAll('tag'), [searchParams])
  const query = searchParams.get('q') ?? ''

  const setQuery = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set('q', value)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }

  const toggleTag = (tag: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const current = next.getAll('tag')
        next.delete('tag')
        const updated = current.includes(tag)
          ? current.filter((t) => t !== tag)
          : [...current, tag]
        for (const t of updated) next.append('tag', t)
        return next
      },
      { replace: true },
    )
  }

  const clearTags = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('tag')
        return next
      },
      { replace: true },
    )
  }

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  /* ---------- search (120ms debounce) ---------- */

  const [debouncedQuery, setDebouncedQuery] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 120)
    return () => clearTimeout(t)
  }, [query])

  const fuse = useMemo(
    () =>
      records
        ? new Fuse(records, {
            keys: [
              { name: 'title', weight: 0.5 },
              { name: 'tags', weight: 0.3 },
              { name: 'text', weight: 0.2 },
            ],
            threshold: 0.3,
            ignoreLocation: true,
          })
        : null,
    [records],
  )

  /* ---------- filtering (tags OR within, AND with search) ---------- */

  const filtered = useMemo(() => {
    if (!posts) return null
    let result = posts
    if (selectedTags.length > 0) {
      result = result.filter((p) => p.tags.some((t) => selectedTags.includes(t)))
    }
    const q = debouncedQuery.trim()
    if (q && fuse) {
      const hits = new Set(fuse.search(q).map((r) => r.item.slug))
      result = result.filter((p) => hits.has(p.slug))
    }
    return result
  }, [posts, selectedTags, fuse, debouncedQuery])

  const groups = useMemo(() => (filtered ? groupByYear(filtered) : []), [filtered])

  /* ---------- derived header data ---------- */

  const metaLine = useMemo(() => {
    if (!posts || posts.length === 0) return null
    const years = posts.map((p) => p.date.slice(0, 4)).filter(Boolean)
    const min = years.reduce((a, b) => (b < a ? b : a), years[0])
    const max = years.reduce((a, b) => (b > a ? b : a), years[0])
    const range = min === max ? min : `${min}–${max}`
    return `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} · ${range}`
  }, [posts])

  const tagCounts = useMemo(() => {
    if (!posts) return []
    const counts = new Map<string, number>()
    for (const p of posts) {
      for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }, [posts])

  /* ---------- animation ---------- */

  const filtersActive = selectedTags.length > 0 || debouncedQuery.trim().length > 0
  const listKey = `${selectedTags.join('|')}::${debouncedQuery.trim()}`
  // First list render staggers 45ms/item (260ms, y:12); filter changes
  // stagger 35ms/item (180ms, y:8)
  const isInitialList = !filtersActive

  const rowStagger = reduce ? 0 : isInitialList ? 0.045 : 0.035
  const rowDuration = isInitialList ? 0.26 : 0.18
  const rowY = isInitialList ? 12 : 8

  const headerAnim = (delayMs: number) => ({
    initial: false,
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.26, delay: delayMs / 1000, ease: EASE },
  })

  /* ---------- render ---------- */

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-6">
      {/* Section 1 — page header */}
      <header className="pb-8 pt-10 sm:pt-14">
        <motion.h1 {...headerAnim(0)} className="font-display text-h1-sm text-ink sm:text-h1">
          {site.blog.heading}
        </motion.h1>
        <motion.p
          {...headerAnim(60)}
          className="mt-3 max-w-[60ch] text-[15.5px] leading-[1.65] text-ink-secondary"
        >
          {site.blog.description}
        </motion.p>
        {metaLine && (
          <motion.p {...headerAnim(120)} className="mt-2 font-mono text-[12.5px] text-ink-muted">
            {metaLine}
          </motion.p>
        )}
      </header>

      {/* Section 2 — controls (search + tags) */}
      <motion.section
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="border-b border-border pb-6"
        aria-label="Filter posts"
      >
        {site.features.search && <SearchInput value={query} onChange={setQuery} />}
        {tagCounts.length > 0 && (
          <div
            className={cn(
              'flex items-center gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent)] [scrollbar-width:none] md:flex-wrap md:overflow-visible md:[mask-image:none] [&::-webkit-scrollbar]:hidden',
              site.features.search && 'mt-3',
            )}
            role="group"
            aria-label="Filter by tag"
          >
            <TagFilterChip
              tag="All"
              selected={selectedTags.length === 0}
              onClick={clearTags}
            />
            {tagCounts.map(({ tag, count }) => (
              <TagFilterChip
                key={tag}
                tag={tag}
                count={count}
                selected={selectedTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              />
            ))}
          </div>
        )}
      </motion.section>

      {/* Section 3 — post list (year-grouped) */}
      {failed && (
        <div className="py-20 text-center">
          <p className="text-[14px] text-ink-muted">Posts failed to load.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false)
              setRetryNonce((n) => n + 1)
            }}
            className="mt-4 rounded-md border border-border px-4 py-2 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle"
          >
            Retry
          </button>
        </div>
      )}

      {!failed && !posts && (
        <p className="py-20 text-center font-mono text-[12.5px] text-ink-muted">
          Loading posts…
        </p>
      )}

      {!failed && filtered && (
        <section className="pb-16 pt-2" aria-label="Post archive">
          {filtersActive && (
            <p className="pt-4 font-mono text-[12.5px] text-ink-muted">
              {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              {debouncedQuery.trim() && <> for &ldquo;{debouncedQuery.trim()}&rdquo;</>}
              {selectedTags.length > 0 && (
                <>
                  {' '}
                  · {selectedTags.length === 1 ? 'tag' : 'tags'}: {selectedTags.join(', ')}
                </>
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="ml-2 text-accent transition-colors duration-150 hover:text-accent-hover"
              >
                Clear
              </button>
            </p>
          )}

          {filtered.length === 0 ? (
            <EmptyState onClear={clearFilters} />
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div
                key={listKey}
                initial={false}
                animate="show"
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: reduce ? 0 : 0.045 } },
                }}
              >
                {groups.map((group, i) => (
                  <motion.section
                    key={group.year}
                    variants={{
                      hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: 0.3,
                          ease: EASE,
                          staggerChildren: rowStagger,
                        },
                      },
                    }}
                    className={i === 0 ? (filtersActive ? 'mt-4' : 'mt-6') : 'mt-10'}
                    aria-label={`Posts from ${group.year}`}
                  >
                    <div className="flex items-center gap-4">
                      <h2 className="font-mono text-meta uppercase tracking-[0.08em] text-ink-muted">
                        {group.year}
                      </h2>
                      <div aria-hidden="true" className="h-px flex-1 bg-border" />
                    </div>
                    <div>
                      {group.posts.map((post) => (
                        <motion.div
                          key={post.slug}
                          variants={{
                            hidden: reduce ? { opacity: 0 } : { opacity: 0, y: rowY },
                            show: {
                              opacity: 1,
                              y: 0,
                              transition: { duration: rowDuration, ease: EASE },
                            },
                          }}
                        >
                          <PostListItem post={post} />
                        </motion.div>
                      ))}
                    </div>
                  </motion.section>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </section>
      )}
    </div>
  )
}
