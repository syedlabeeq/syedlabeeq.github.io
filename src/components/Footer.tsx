import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { Wordmark } from '@/components/Navbar'
import { iconFor } from '@/config/icons'
import { copyrightYear, navItems, site, socialLinks } from '@/config/site'

/**
 * Footer — top hairline, py-10.
 * Row 1: wordmark + one-line description left, social icon row right.
 * Row 2: copyright colophon + "Back to top" (appears after 600px of scroll,
 * fades in 200ms).
 *
 * The tagline, the social row and the copyright line all come from
 * site.config.json (`footer`, `social`).
 */

function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className="flex items-center gap-1.5 text-[12.5px] text-ink-muted transition-opacity duration-200 hover:text-ink"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      Back to top
      <ArrowUp size={13} />
    </button>
  )
}

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="hairline-t py-10"
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:max-w-6xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Wordmark className="text-[16px] font-semibold" />
            <p className="mt-2 max-w-sm text-caption text-ink-muted">{site.footer.tagline}</p>
            <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
             {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="ui-link text-[13px] text-ink-muted transition-colors duration-150 hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
           <div className="flex items-center gap-3">
             {socialLinks.map((link) => {
              const Icon = iconFor(link.type)
              const internal = link.href.startsWith('mailto:') || link.href.startsWith('/')
              return (
                <a
                  key={link.label}
                  href={link.href}
                  {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  aria-label={link.label}
                  className="text-ink-muted transition-colors duration-150 hover:text-accent"
                >
                  <Icon size={18} />
                </a>
              )
             })}
           </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-[12.5px] text-ink-muted">
          <p>
            © <span className="font-mono">{copyrightYear()}</span> {site.footer.copyrightHolder}
            {site.footer.copyrightNote && (
              <>
                <span aria-hidden="true" className="mx-2">
                  ·
                </span>
                {site.footer.copyrightNote}
              </>
            )}
          </p>
          <BackToTop />
        </div>
      </div>
    </motion.footer>
  )
}
