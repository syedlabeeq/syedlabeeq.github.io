import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Github, Menu, Moon, Rss, Sun, X } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { githubUrl, navItems, rssEnabled, rssUrl, site } from '@/config/site'

/**
 * Navbar — sticky 64px header, backdrop blur over 82% bg, bottom hairline.
 * Wordmark (Space Grotesk 700, middle character in accent) + 7px accent dot.
 * Desktop: text nav with animated accent underline (layoutId), RSS/GitHub
 * icons, theme toggle. Mobile: hamburger panel under the header.
 *
 * Links, labels and the wordmark all come from site.config.json.
 */

const NAV_ITEMS = navItems

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-display text-[18px] font-bold lowercase tracking-[-0.02em] text-ink',
        className,
      )}
    >
      {site.wordmark.before}
      <span className="text-accent">{site.wordmark.accent}</span>
      {site.wordmark.after}
    </span>
  )
}

/** 7px accent dot — decorative brand mark. */
export function AccentDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-[7px] w-[7px] rounded-full bg-accent', className)}
    />
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const reduceMotion = useReducedMotion()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label="Toggle dark mode"
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:text-ink',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

const iconLinkClass =
  'flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:text-ink'

export default function Navbar() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  // The mobile panel remembers which route it was opened on, so navigating
  // closes it without an effect that fights the router.
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const open = openedAt === location.pathname
  const setOpen = (next: boolean) => setOpenedAt(next ? location.pathname : null)

  return (
    <header
      className="hairline-b sticky top-0 z-50 h-16 backdrop-blur-[12px]"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}
    >
      <div className="mx-auto flex h-full max-w-3xl items-center justify-between px-5 sm:px-6 lg:max-w-6xl">
        <Link to="/" className="flex items-center gap-2" aria-label={`${site.shortName}, home`}>
          <Wordmark />
          <AccentDot />
        </Link>

        {/* desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative py-1 text-[14.5px] font-medium transition-colors duration-150',
                  isActive ? 'text-ink' : 'text-ink-secondary hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-accent"
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}

          <div className="flex items-center gap-1 pl-6">
            {rssEnabled && (
              <a href={rssUrl} className={iconLinkClass} aria-label="RSS feed">
                <Rss size={18} />
              </a>
            )}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={iconLinkClass}
              aria-label="GitHub profile"
            >
              <Github size={18} />
            </a>
            <ThemeToggle />
          </div>
        </nav>

        {/* mobile controls */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className={iconLinkClass}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? 'x' : 'menu'}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.7 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex"
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* mobile menu panel */}
      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Mobile"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="hairline-b absolute inset-x-0 top-16 bg-bg-raised shadow-float md:hidden"
          >
            <div className="px-5 py-3">
              {NAV_ITEMS.map((item, i) => (
                <motion.div
                  key={item.to}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: reduceMotion ? 0 : i * 0.04,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex h-11 items-center text-[15px] font-medium',
                        isActive ? 'text-ink' : 'text-ink-secondary',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </motion.div>
              ))}
              <div className="hairline-t mt-2 flex items-center gap-1 pt-3 pb-1">
                {rssEnabled && (
                  <a href={rssUrl} className={iconLinkClass} aria-label="RSS feed">
                    <Rss size={18} />
                  </a>
                )}
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={iconLinkClass}
                  aria-label="GitHub profile"
                >
                  <Github size={18} />
                </a>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
