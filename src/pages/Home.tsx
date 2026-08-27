import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import PostListItem from '@/components/PostListItem'
import ContributionItem from '@/components/ContributionItem'
import { AccentDot } from '@/components/Navbar'
import { loadPosts } from '@/lib/posts'
import type { PostMeta } from '@/lib/posts'
import { loadContributions } from '@/lib/contributions'
import type { Contribution } from '@/lib/contributions'
import { avatarUrl, site } from '@/config/site'

/**
 * Home (/) — intro (avatar, name, Newsreader lede, link row), latest posts,
 * an optional contributions strip, then the global footer. All reveals are
 * subtle 150–300ms fades/rises, mount-triggered; total budget < 1s.
 *
 * Copy and counts come from `home` in site.config.json; the contributions
 * strip disappears entirely when `features.contributions` is false.
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

function useIntroAnimation() {
  void useReducedMotion()
  return (delayMs: number) => ({
    initial: false,
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.26, delay: delayMs / 1000, ease: EASE },
  })
}

function ArrowLink({
  to,
  children,
  accent = false,
}: {
  to: string
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-1 text-[14.5px] font-medium transition-colors duration-150 ${
        accent ? 'text-accent hover:text-accent-hover' : 'text-ink-secondary hover:text-ink'
      }`}
    >
      {children}
      <ArrowRight
        size={14}
        aria-hidden="true"
        className="transition-transform duration-200 ease-out-expo group-hover:translate-x-[3px]"
      />
    </Link>
  )
}

/* ---------------- Section 1 — Intro ---------------- */

function Intro() {
  const anim = useIntroAnimation()
  void useReducedMotion()

  const avatar = (
    <motion.div
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.15, ease: EASE }}
      className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border sm:h-14 sm:w-14"
    >
      <img src={avatarUrl} alt={`Portrait of ${site.author.name}`} className="h-full w-full object-cover" />
    </motion.div>
  )

  return (
    <section className="pb-10 pt-10 sm:pb-12 sm:pt-16">
      <motion.p
        {...anim(0)}
        className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.1em] text-ink-muted"
      >
        <AccentDot />
        {site.home.eyebrow}
      </motion.p>

      <div className="mt-4 sm:mt-6">
        <motion.div
          {...anim(60)}
          className="flex items-center gap-3 sm:items-start sm:justify-between"
        >
          <motion.h1
            initial={false}
            className="font-display text-h1-sm text-ink leading-tight sm:text-h1"
          >
            {site.author.name}
          </motion.h1>
          <span className="flex-shrink-0">{avatar}</span>
        </motion.div>
      </div>

      <motion.p {...anim(120)} className="mt-3 font-mono text-[14px] text-ink-muted">
        @{site.author.handle} · {site.author.role}
      </motion.p>

      <motion.p
        {...anim(180)}
        className="mt-5 max-w-[38ch] font-serif text-lede-sm italic text-ink/85 dark:text-ink-secondary sm:text-lede"
      >
        {site.home.lede}
      </motion.p>

      <motion.div {...anim(240)} className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <ArrowLink to="/blog" accent>
          Read the blog
        </ArrowLink>
        {site.features.contributions && <ArrowLink to="/contributions">Contributions</ArrowLink>}
        <ArrowLink to="/about">About</ArrowLink>
      </motion.div>
    </section>
  )
}

/* ---------------- Section 2 — Latest posts ---------------- */

function LatestPosts() {
  const reduce = useReducedMotion()
  const [posts, setPosts] = useState<PostMeta[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    document.title = site.title
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
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="hairline-t py-10">
      <motion.div
        initial={false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.3, ease: EASE }}
        className="mb-2 flex items-baseline justify-between"
      >
        <h2 className="font-display text-h2-sm text-ink sm:text-h2">{site.home.latestHeading}</h2>
        {posts && (
          <span className="font-mono text-[12.5px] text-ink-muted">{posts.length} posts</span>
        )}
      </motion.div>

      {failed && <p className="py-6 text-[14px] text-ink-muted">Posts failed to load.</p>}

      {posts && (
        <motion.div
          initial={false}
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: reduce ? 0 : 0.055 } },
          }}
        >
          {posts.slice(0, site.home.latestCount).map((post) => (
            <motion.div
              key={post.slug}
              variants={{
                hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } },
              }}
            >
              <PostListItem post={post} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="mt-4 flex justify-end">
        <ArrowLink to="/blog" accent>
          All posts
        </ArrowLink>
      </div>
    </section>
  )
}

/* ---------------- Section 3 — Recent contributions ---------------- */

function RecentContributions() {
  const reduce = useReducedMotion()
  const [items, setItems] = useState<Contribution[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadContributions()
      .then((all) => {
        if (!cancelled) setItems(all)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="hairline-t py-10">
      <motion.div
        initial={false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.3, ease: EASE }}
        className="mb-2 flex items-baseline justify-between"
      >
        <h2 className="font-display text-h2-sm text-ink sm:text-h2">
          {site.home.contributionsHeading}
        </h2>
        <ArrowLink to="/contributions" accent>
          All contributions
        </ArrowLink>
      </motion.div>

      {failed && (
        <p className="py-6 text-[14px] text-ink-muted">Contributions failed to load.</p>
      )}

      {items && (
        <motion.div
          initial={false}
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: reduce ? 0 : 0.055 } },
          }}
        >
          {items.slice(0, site.home.contributionsCount).map((item) => (
            <motion.div
              key={item.id}
              variants={{
                hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } },
              }}
            >
              <ContributionItem item={item} condensed />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  )
}

/* ---------------- Page ---------------- */

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-6">
      <Intro />
      <LatestPosts />
      {site.features.contributions && <RecentContributions />}
    </div>
  )
}
