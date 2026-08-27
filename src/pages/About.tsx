import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { iconFor } from '@/config/icons'
import { avatarUrl, pageTitle, site, socialLinks } from '@/config/site'

/**
 * About (/about) — portrait + bio + focus areas + elsewhere/contact + colophon.
 * Deliberately restrained; one Newsreader serif accent is the only flourish.
 * CSS-var tokens only; both themes; subtle fades only.
 *
 * Every string on this page lives in `about`, `author` and `social` in
 * site.config.json.
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

/** Copy-to-clipboard ghost mini-button (check + "Copied", 1.6s). */
function CopyButton({ value, what }: { value: string; what: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // clipboard API unavailable (e.g. insecure context) — hidden-textarea fallback
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void copy()
      }}
      aria-label={copied ? `${what} copied` : `Copy ${what}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] font-medium text-ink-muted transition-colors duration-150 hover:border-border-strong hover:bg-bg-subtle hover:text-ink"
    >
      {copied ? (
        <Check size={13} aria-hidden="true" className="text-accent" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function About() {
  const reduce = useReducedMotion()

  useEffect(() => {
    document.title = pageTitle('About')
    return () => {
      document.title = site.title
    }
  }, [])

  const rise = (delay = 0) =>
    reduce
      ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0.15, delay } }
      : {
          initial: false,
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.26, delay, ease: EASE },
        }

  const inView = (delay = 0, duration = 0.3) =>
    reduce
      ? {
          initial: false,
          whileInView: { opacity: 1 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.15, delay },
        }
      : {
          initial: false,
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration, delay, ease: EASE },
        }

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-6">
      {/* ---------- Section 1 — Header ---------- */}
      <header className="flex flex-col gap-6 pt-10 pb-8 sm:flex-row sm:items-center sm:pt-14 sm:pb-10">
        <motion.div
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="shrink-0"
        >
          <div className="rounded-full border border-border bg-bg p-1">
            <img
              src={avatarUrl}
              alt={`Portrait of ${site.author.name}`}
              width={128}
              height={128}
              className="size-24 rounded-full sm:size-32"
            />
          </div>
        </motion.div>
        <div>
          <motion.h1 {...rise(0.08)} className="font-display text-h1-sm text-ink sm:text-h1">
            {site.about.heading}
          </motion.h1>
          <motion.p {...rise(0.14)} className="mt-2 font-mono text-[14px] text-ink-muted">
            @{site.author.handle}
          </motion.p>
          <motion.p {...rise(0.2)} className="mt-1.5 text-[15.5px] text-ink-secondary">
            {site.about.tagline}
          </motion.p>
        </div>
      </header>

      {/* ---------- Section 2 — Bio ---------- */}
      <section className="hairline-t py-8">
        <div className="max-w-reading text-body-sm text-ink sm:text-body">
          {site.about.bio.map((paragraph, i) => (
            <motion.p key={i} {...inView(i * 0.08)} className={i === 0 ? undefined : 'mt-5'}>
              {paragraph}
            </motion.p>
          ))}
        </div>
      </section>

      {/* ---------- Section 3 — Focus areas ---------- */}
      {site.about.focus.length > 0 && (
        <section className="hairline-t py-8">
          <h2 className="mb-6 font-display text-h2-sm text-ink sm:text-h2">
            {site.about.focusHeading}
          </h2>
          <dl>
            {site.about.focus.map((area, i) => (
              <motion.div
                key={area.term}
                {...inView(i * 0.07, 0.26)}
                className="grid gap-1.5 border-t border-border py-5 first:border-t-0 first:pt-0 sm:grid-cols-[180px_1fr] sm:gap-6"
              >
                <dt className="flex items-center gap-2.5 text-[15.5px] font-semibold text-ink">
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
                  {area.term}
                </dt>
                <dd className="text-[15px] text-ink-secondary">{area.definition}</dd>
              </motion.div>
            ))}
          </dl>
        </section>
      )}

      {/* ---------- Section 4 — Elsewhere / contact ---------- */}
      <section className="hairline-t py-8">
        <h2 className="mb-6 font-display text-h2-sm text-ink sm:text-h2">
          {site.about.elsewhereHeading}
        </h2>
        <ul>
          {socialLinks.map((link, i) => {
            const Icon = iconFor(link.type)
            const isMail = link.href.startsWith('mailto:')
            const internal = isMail || link.href.startsWith('/')
            return (
              <motion.li
                key={link.label}
                {...inView(i * 0.05, 0.22)}
                className="border-t border-border first:border-t-0"
              >
                <a
                  href={link.href}
                  {...(internal ? {} : { target: '_blank', rel: 'noreferrer' })}
                  className="group -mx-3 flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-150 hover:bg-bg-subtle"
                >
                  <Icon size={18} aria-hidden="true" className="shrink-0 text-ink-muted" />
                  <span className="text-[15px] font-medium text-ink transition-colors duration-150 group-hover:text-accent">
                    {link.label}
                  </span>
                  {link.value && (
                    <span className="truncate font-mono text-[13px] text-ink-muted">
                      {link.value}
                    </span>
                  )}
                  <span className="ml-auto shrink-0">
                    {isMail ? (
                      <CopyButton value={link.href.replace(/^mailto:/, '')} what="email address" />
                    ) : internal ? null : (
                      <ExternalLink size={15} aria-hidden="true" className="text-ink-muted" />
                    )}
                  </span>
                </a>
              </motion.li>
            )
          })}
        </ul>
      </section>

      {/* ---------- Section 5 — Colophon ---------- */}
      <motion.section {...inView(0, 0.25)} className="hairline-t py-8">
        <div className="max-w-[60ch] font-mono text-[12.5px] leading-[1.7] text-ink-muted">
          {site.about.colophon.map((line, i) => (
            <p key={i} className="mb-2">
              {line}
            </p>
          ))}
          <p className="mb-2">
            <a
              href={site.repo.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline decoration-accent/40 underline-offset-[3px] transition-colors duration-150 hover:text-accent-hover hover:decoration-accent-hover"
            >
              Source on GitHub
            </a>
            .
          </p>
        </div>
      </motion.section>
    </div>
  )
}
