import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { motion, useReducedMotion, useScroll } from 'framer-motion'
import { ArrowLeft, ArrowRight, SquarePen, Twitter } from 'lucide-react'
import Markdown from '@/components/Markdown'
import TagChip from '@/components/TagChip'
import Toc from '@/components/Toc'
import { formatPostDate } from '@/lib/format'
import { extractHeadings, loadPost, loadPosts } from '@/lib/posts'
import type { Post, PostMeta } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { absoluteUrl, editPostUrl, ogImageUrl, pageTitle, site } from '@/config/site'

/**
 * Post (/blog/:slug) — the long-form reading experience.
 * Shell: max-w-6xl; ≥1100px a grid [minmax(0,680px) 240px] gap-80px,
 * justify-center so the 680px measure stays optically centered beside the
 * sticky TOC rail. <1100px the TOC collapses to the inline disclosure under
 * the header hairline and content is max-w-reading mx-auto.
 * Header: back link, mono meta eyebrow, Space Grotesk title, Newsreader
 * standfirst, tag chips, hairline — staggered <700ms. Body via the shared
 * Markdown component (code/mermaid/figures handled there). Footer: feedback
 * row (suggest edit / share), prev/next cards, related reading.
 * Extras: 2px reading-progress bar at the header's bottom
 * edge, document title + OG meta per post, hash deep-links with the 88px
 * offset, and a print stylesheet (chrome hidden, light colors, 12pt/1.6).
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]
const WIDE_QUERY = '(min-width: 1100px)'

/* ---------------- hooks ---------------- */

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

function setMeta(attr: 'property' | 'name', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Document title + OG/Twitter meta per post. */
function useDocumentMeta(post: Post | null) {
  useEffect(() => {
    if (!post) return
    const title = post.title.trim()
    const url = absoluteUrl(`/blog/${post.slug}`)
    const image = ogImageUrl(post.ogImage)

    document.title = pageTitle(title)
    setMeta('name', 'description', post.excerpt)
    setMeta('property', 'og:type', 'article')
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', post.excerpt)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', image)
    setMeta('property', 'article:published_time', post.date)
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', post.excerpt)
    setMeta('name', 'twitter:image', image)

    // restore the site-level meta when leaving the post
    return () => {
      const siteDesc = site.description
      const siteImage = ogImageUrl()
      document.title = site.title
      setMeta('name', 'description', siteDesc)
      setMeta('property', 'og:type', 'website')
      setMeta('property', 'og:title', site.title)
      setMeta('property', 'og:description', siteDesc)
      setMeta('property', 'og:url', absoluteUrl('/'))
      setMeta('property', 'og:image', siteImage)
      setMeta('property', 'article:published_time', '')
      setMeta('name', 'twitter:title', site.title)
      setMeta('name', 'twitter:description', siteDesc)
      setMeta('name', 'twitter:image', siteImage)
    }
  }, [post])
}

/* ---------------- reading progress (docs/DESIGN.md §5) ---------------- */

function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  return (
    <motion.div
      aria-hidden="true"
      className="post-progress fixed inset-x-0 top-[62px] z-50 h-[2px] origin-left bg-accent print:hidden"
      style={{ scaleX: scrollYProgress }}
    />
  )
}

/* ---------------- states ---------------- */

function PostSkeleton() {
  return (
    <div className="mx-auto max-w-reading px-5 pt-8 sm:px-6 md:pt-12" aria-label="Loading post">
      <div className="h-3.5 w-24 animate-pulse rounded bg-bg-subtle" />
      <div className="mt-8 h-3.5 w-56 animate-pulse rounded bg-bg-subtle" />
      <div className="mt-4 h-9 w-4/5 animate-pulse rounded bg-bg-subtle" />
      <div className="mt-2 h-9 w-3/5 animate-pulse rounded bg-bg-subtle" />
      <div className="mt-6 h-4 w-full animate-pulse rounded bg-bg-subtle" />
      <div className="mt-2 h-4 w-11/12 animate-pulse rounded bg-bg-subtle" />
      <div className="mt-8 border-t border-border" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className={cn('h-4 animate-pulse rounded bg-bg-subtle', i % 3 === 2 ? 'w-2/3' : 'w-full')}
          />
        ))}
      </div>
    </div>
  )
}

function PostNotFound() {
  return (
    <div className="mx-auto max-w-reading px-5 py-20 text-center sm:px-6 sm:py-28">
      <h1 className="font-display text-h1-sm text-ink sm:text-h1">Post not found</h1>
      <p className="mt-4 text-[15px] text-ink-secondary">
        The writeup you're looking for doesn't exist or may have been moved.
      </p>
      <Link
        to="/blog"
        className="mt-6 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-accent transition-colors duration-150 hover:text-accent-hover"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to all posts
      </Link>
    </div>
  )
}

/* ---------------- article footer pieces ---------------- */

const ghostButton =
  'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-secondary transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle hover:text-ink'

function NeighborCard({ post, direction }: { post: PostMeta; direction: 'newer' | 'older' }) {
  const older = direction === 'older'
  return (
    <Link
      to={`/blog/${post.slug}`}
      className={cn(
        'group flex flex-col rounded-xl border border-border p-5 transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle',
        older && 'sm:items-end sm:text-right',
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
        {older ? (
          <>
            Older
            <ArrowRight size={12} aria-hidden="true" />
          </>
        ) : (
          <>
            <ArrowLeft size={12} aria-hidden="true" />
            Newer
          </>
        )}
      </span>
      <span className="mt-2 line-clamp-2 text-[15.5px] font-semibold leading-snug text-ink transition-colors duration-150 group-hover:text-accent">
        {post.title}
      </span>
      <span className="mt-2 font-mono text-[12px] text-ink-muted">{formatPostDate(post.date)}</span>
    </Link>
  )
}

/** Up to 3 posts sharing the most tags with the current one. */
function relatedPosts(current: Post, all: PostMeta[]): PostMeta[] {
  const tags = new Set(current.tags)
  return all
    .filter((p) => p.slug !== current.slug)
    .map((p) => ({ p, shared: p.tags.filter((t) => tags.has(t)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, 3)
    .map(({ p }) => p)
}

/* ---------------- print stylesheet ---------------- */

const PRINT_CSS = `
@media print {
  header, footer, .post-progress, .post-chrome { display: none !important; }
  html, html.dark {
    --bg: #ffffff; --bg-subtle: #ffffff; --bg-raised: #ffffff;
    --border: #cccccc; --border-strong: #aaaaaa;
    --ink: #000000; --ink-secondary: #222222; --ink-muted: #444444;
    --accent: #1a1a1a; --accent-hover: #1a1a1a;
  }
  body { background: #ffffff; font-size: 12pt; line-height: 1.6; }
  a { text-decoration: none; }
}
`

/* ---------------- page ---------------- */

type Status = 'loading' | 'ready' | 'missing'

/**
 * Route wrapper: keying on the slug remounts PostView when the reader moves
 * from one post to the next, so its loading state resets on its own.
 */
export default function PostPage() {
  const { slug = '' } = useParams()
  return <PostView key={slug} slug={slug} />
}

function PostView({ slug }: { slug: string }) {
  const location = useLocation()
  void useReducedMotion()
  const wide = useMediaQuery(WIDE_QUERY)

  const [post, setPost] = useState<Post | null>(null)
  const [metas, setMetas] = useState<PostMeta[]>([])
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false
    Promise.all([loadPosts(), loadPost(slug).catch(() => null)])
      .then(([all, loaded]) => {
        if (cancelled) return
        setMetas(all)
        if (loaded) {
          setPost(loaded)
          setStatus('ready')
        } else {
          setStatus('missing')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('missing')
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useDocumentMeta(post)

  // Deep links: …#heading-id scrolls to the heading once content is in the
  // DOM; the 88px offset comes from scroll-margin-top (index.css).
  useEffect(() => {
    if (status !== 'ready') return
    const id = decodeURIComponent(location.hash.replace(/^#/, ''))
    if (!id) return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView()
    }, 80)
    return () => window.clearTimeout(t)
  }, [status, location.hash])

  const headings = useMemo(() => (post ? extractHeadings(post.body) : []), [post])
  const showSidebar = site.features.tableOfContents && headings.length >= 3

  if (status === 'loading') return <PostSkeleton />
  if (status === 'missing' || !post) return <PostNotFound />

  const index = metas.findIndex((m) => m.slug === post.slug)
  const newer = index > 0 ? metas[index - 1] : null
  const older = index >= 0 && index < metas.length - 1 ? metas[index + 1] : null
  const related = relatedPosts(post, metas)
  const updated = (post as PostMeta & { updated?: string }).updated

  const editUrl = editPostUrl(post.slug)
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    post.title.trim(),
  )}&url=${encodeURIComponent(absoluteUrl(`/blog/${post.slug}`))}`

  const rise = (delayMs: number) => ({
    initial: false,
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, delay: delayMs / 1000, ease: EASE },
  })
  const fade = (delayMs: number) => ({
    initial: false,
    animate: { opacity: 1 },
    transition: { duration: 0.28, delay: delayMs / 1000, ease: EASE },
  })

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6">
      <style>{PRINT_CSS}</style>
      <ReadingProgress />

      <div
        className={cn(
          showSidebar &&
            'min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,680px)_240px] min-[1100px]:justify-center min-[1100px]:gap-20',
        )}
      >
        <article className="mx-auto w-full min-w-0 max-w-reading min-[1100px]:mx-0">
          {/* -------- Section 1 — article header -------- */}
          <header className="pb-8 pt-8 md:pt-12">
            <motion.div {...fade(0)}>
              <Link
                to="/blog"
                className="group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-muted transition-colors duration-150 hover:text-accent"
              >
                <ArrowLeft
                  size={14}
                  aria-hidden="true"
                  className="transition-transform duration-200 ease-out-expo group-hover:-translate-x-[3px]"
                />
                All posts
              </Link>
            </motion.div>

            <motion.p {...fade(60)} className="mt-6 font-mono text-meta text-ink-muted">
              Published on {formatPostDate(post.date)}
              {' · '}
              {post.readingTime} min read
              {updated ? ` · Updated on ${formatPostDate(updated)}` : ''}
            </motion.p>

            <motion.h1
              {...rise(120)}
              className="mt-3 font-display text-post-title-sm text-ink md:text-post-title"
            >
              {post.title}
            </motion.h1>

            {post.excerpt && (
              <motion.p
                {...fade(200)}
                className="mt-4 max-w-[68ch] font-serif text-[18px] italic leading-[1.6] text-ink-secondary md:text-[19px]"
              >
                {post.excerpt}
              </motion.p>
            )}

            {post.tags.length > 0 && (
              <motion.div {...fade(260)} className="mt-5 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <TagChip key={tag} tag={tag} variant="display" />
                ))}
              </motion.div>
            )}

            <motion.div
              initial={false}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.35, delay: 0.3, ease: EASE }}
              className="mt-8 h-px origin-left bg-border"
            />
          </header>

          {/* inline TOC disclosure (<1100px) — directly under the hairline */}
          {!wide && showSidebar && (
            <div className="mb-2 mt-6">
              <Toc headings={headings} />
            </div>
          )}

          {/* -------- Section 2 — body -------- */}
          <Markdown markdown={post.body} className="py-10" />

          {/* -------- Section 4 — article footer -------- */}
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mt-16"
          >
            {(site.features.editOnGitHub || site.features.shareOnX) && (
              <div className="post-chrome flex flex-wrap items-center justify-between gap-4 border-t border-border py-6">
                <p className="font-mono text-[12.5px] text-ink-muted">Found an error?</p>
                <div className="flex flex-wrap items-center gap-3">
                  {site.features.editOnGitHub && (
                    <a href={editUrl} target="_blank" rel="noreferrer" className={ghostButton}>
                      <SquarePen size={14} aria-hidden="true" />
                      Suggest an edit
                    </a>
                  )}
                  {site.features.shareOnX && (
                    <a href={shareUrl} target="_blank" rel="noreferrer" className={ghostButton}>
                      <Twitter size={14} aria-hidden="true" />
                      Share on X
                    </a>
                  )}
                </div>
              </div>
            )}

            {(newer || older) && (
              <nav aria-label="More posts" className="post-chrome grid gap-4 sm:grid-cols-2">
                {newer ? (
                  <NeighborCard post={newer} direction="newer" />
                ) : (
                  <div aria-hidden="true" className="hidden sm:block" />
                )}
                {older ? (
                  <NeighborCard post={older} direction="older" />
                ) : (
                  <div aria-hidden="true" className="hidden sm:block" />
                )}
              </nav>
            )}

            {related.length > 0 && (
              <section className="post-chrome mt-12 pb-4">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                  Related reading
                </h2>
                <ul className="mt-2">
                  {related.map((p) => (
                    <li key={p.slug} className="border-t border-border first:border-t-0">
                      <Link
                        to={`/blog/${p.slug}`}
                        className="group flex items-baseline justify-between gap-4 py-3"
                      >
                        <span className="text-[15px] font-medium text-ink-secondary transition-colors duration-150 group-hover:text-accent">
                          {p.title}
                        </span>
                        <span className="shrink-0 font-mono text-[12px] text-ink-muted">
                          {formatPostDate(p.date)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </motion.div>
        </article>

        {/* -------- Section 3 — sidebar TOC (≥1100px) -------- */}
        {wide && showSidebar && (
          <aside className="post-chrome">
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.15, ease: EASE }}
              className="h-full pt-8 md:pt-12"
            >
              <Toc headings={headings} />
            </motion.div>
          </aside>
        )}
      </div>
    </div>
  )
}
