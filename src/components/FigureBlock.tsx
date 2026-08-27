import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * FigureBlock — docs/DESIGN.md §6.7.
 * Image in a rounded-lg frame with 1px border; in dark mode it sits on a
 * --bg-raised mat with p-3 so light screenshots don't glare (no brightness
 * filters). Caption below: 13.5px, ink-muted, centered, mt-3, auto-numbered
 * "Figure N — …". Click opens a lightbox (image at natural size capped to
 * 90% viewport, backdrop rgba(0,0,0,.6) + 4px blur, Esc/backdrop close,
 * scale 0.96→1 + fade 200ms).
 */

export interface FigureBlockProps {
  src: string
  alt?: string
  /** caption text without the "Figure N —" prefix (auto-numbered by Markdown) */
  caption?: string
  figNumber?: number
  className?: string
}

export default function FigureBlock({
  src,
  alt = '',
  caption,
  figNumber,
  className,
}: FigureBlockProps) {
  const [open, setOpen] = useState(false)

  const captionText = caption ?? alt
  const captionLine =
    figNumber != null
      ? `Figure ${figNumber}${captionText ? `: ${captionText}` : ''}`
      : captionText

  return (
    <figure className={cn('my-8', className)}>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="block w-full cursor-zoom-in rounded-lg border border-border bg-bg-raised p-0 transition-colors duration-150 hover:border-border-strong dark:p-3"
            aria-label={alt || 'Open figure'}
          >
            <img
              src={src}
              alt={alt}
              loading="lazy"
              className="mx-auto block max-w-full rounded-md dark:rounded-sm"
            />
          </button>
        </Dialog.Trigger>
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
            className="fixed inset-0 z-[90] flex items-center justify-center p-6 outline-none"
            onClick={() => setOpen(false)}
          >
            <Dialog.Title className="sr-only">{alt || caption || 'Figure'}</Dialog.Title>
            <Dialog.Description className="sr-only">
              {caption ?? alt ?? 'Enlarged figure'}
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
            <motion.img
              src={src}
              alt={alt}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] cursor-zoom-out rounded-lg border border-border-strong object-contain"
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {captionLine && (
        <figcaption className="mt-3 text-center text-caption text-ink-muted">
          {captionLine}
        </figcaption>
      )}
    </figure>
  )
}
