import { useEffect } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { pageTitle, site } from '@/config/site'

/**
 * 404 (*) — a calm dead end.
 * A calm dead end: say what happened, offer the two most useful exits, done.
 * No error theatrics, no terminal jokes. GH Pages serves public/404.html which
 * redirects via ?p= — this route is what renders once the SPA restores the path.
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

export default function NotFound() {
  const reduce = useReducedMotion()

  useEffect(() => {
    document.title = pageTitle('Page not found')
    return () => {
      document.title = site.title
    }
  }, [])

  const enter = (delay: number, _y: number, duration: number) =>
    reduce
      ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0.15, delay } }
      : {
          initial: false,
          animate: { opacity: 1, y: 0 },
          transition: { duration, delay, ease: EASE },
        }

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-6">
      <div className="flex min-h-[52vh] flex-col justify-center py-20">
        <motion.p
          {...enter(0, 12, 0.26)}
          className="font-mono text-[13px] tracking-[0.1em] text-ink-muted"
        >
          404 · NOT FOUND
        </motion.p>

        <motion.h1
          {...enter(0.06, 12, 0.26)}
          className="mt-3 font-display text-h1-sm text-ink sm:text-h1"
        >
          This page doesn't exist.
        </motion.h1>

        <motion.p
          {...enter(0.14, 12, 0.26)}
          className="mt-4 max-w-[48ch] text-[15.5px] text-ink-secondary"
        >
          The link may be broken, the post may have been renamed, or the URL was
          typed wrong. Nothing is on fire.
        </motion.p>

        <motion.div {...enter(0.22, 8, 0.22)} className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back home
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-[14px] font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle"
            >
              Browse the blog
            </Link>
          </div>
          {site.features.search && (
            <p className="mt-5 font-mono text-[12.5px] text-ink-muted">
              Looking for a specific post? Press <span className="kbd">/</span> on the blog page to
              search.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  )
}
