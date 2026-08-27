import { useEffect, useId, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { Expand, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * MermaidBlock — docs/DESIGN.md §6.8 / §2.4.
 * Lazy-loads the mermaid bundle, renders to SVG with a per-theme config
 * (lines = --border/--ink-muted, text = --ink, primary actors = --accent,
 * Inter 13px) and RE-RENDERS on theme change (listens for the `themechange`
 * event from src/lib/theme.ts). Wrapped like a figure: rounded-lg border,
 * --bg-subtle surface, centered diagram, optional caption. Max height 70vh
 * with internal scroll; an expand button opens it in the figure lightbox.
 */

export interface MermaidBlockProps {
  chart: string
  caption?: string
  className?: string
}

let mermaidPromise: Promise<typeof import('mermaid')['default']> | null = null

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default)
  }
  return mermaidPromise
}

/** Resolve the current CSS variables to concrete colors for mermaid. */
function currentThemeConfig() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  const dark = document.documentElement.classList.contains('dark')
  return {
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: 13,
    themeVariables: {
      dark,
      background: 'transparent',
      primaryColor: v('--bg-subtle'),
      primaryBorderColor: v('--border-strong'),
      primaryTextColor: v('--ink'),
      secondaryColor: v('--bg-raised'),
      secondaryBorderColor: v('--border-strong'),
      secondaryTextColor: v('--ink'),
      tertiaryColor: v('--bg-raised'),
      lineColor: v('--ink-muted'),
      textColor: v('--ink'),
      mainBkg: v('--bg-subtle'),
      nodeBorder: v('--border-strong'),
      clusterBkg: v('--bg-raised'),
      clusterBorder: v('--border'),
      edgeLabelBackground: v('--bg'),
      actorBorder: v('--accent'),
      actorBkg: v('--bg-subtle'),
      actorTextColor: v('--ink'),
      actorLineColor: v('--border-strong'),
      signalColor: v('--ink-secondary'),
      signalTextColor: v('--ink'),
      activationBorderColor: v('--accent'),
      activationBkgColor: v('--bg-raised'),
      noteBkgColor: v('--bg-raised'),
      noteBorderColor: v('--border-strong'),
      noteTextColor: v('--ink-secondary'),
      labelBoxBkgColor: v('--bg'),
      labelTextColor: v('--ink'),
    },
  } as const
}

export default function MermaidBlock({ chart, caption, className }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    let cancelled = false
    let counter = 0

    const render = async () => {
      try {
        const mermaid = await loadMermaid()
        mermaid.initialize(currentThemeConfig())
        const { svg: out } = await mermaid.render(`mmd-${uid}-${counter++}`, chart)
        if (!cancelled) {
          setSvg(out)
          setFailed(false)
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    render()
    const onThemeChange = () => render()
    window.addEventListener('themechange', onThemeChange)
    return () => {
      cancelled = true
      window.removeEventListener('themechange', onThemeChange)
    }
  }, [chart, uid])

  const diagram = svg ? (
    <div
      className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full"
      // mermaid output — generated locally from trusted post markdown
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : failed ? (
    <pre className="overflow-x-auto p-4 font-mono text-code-sm text-ink-muted">{chart}</pre>
  ) : (
    <div className="h-24 animate-pulse rounded-md bg-bg-raised" aria-label="Loading diagram" />
  )

  return (
    <figure className={cn('my-8', className)}>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <div className="relative rounded-lg border border-border bg-bg-subtle p-4">
          <div className="max-h-[70vh] overflow-auto">{diagram}</div>
          {svg && (
            <Dialog.Trigger asChild>
              <button
                type="button"
                aria-label="Expand diagram"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-raised text-ink-muted transition-colors duration-150 hover:text-ink"
              >
                <Expand size={13} />
              </button>
            </Dialog.Trigger>
          )}
        </div>
        <Dialog.Portal>
          <Dialog.Overlay asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[4px]"
            />
          </Dialog.Overlay>
          <Dialog.Content
            className="fixed inset-0 z-[90] flex items-center justify-center overflow-auto p-6 outline-none"
            onClick={() => setOpen(false)}
          >
            <Dialog.Title className="sr-only">{caption ?? 'Diagram'}</Dialog.Title>
            <Dialog.Description className="sr-only">
              {caption ?? 'Enlarged diagram'}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-md text-white/70 transition-colors duration-150 hover:text-white"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
            {svg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg border border-border bg-bg p-6 [&_svg]:h-auto [&_svg]:max-w-none"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {caption && (
        <figcaption className="mt-3 text-center text-caption text-ink-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
