import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * TagChip — docs/DESIGN.md §6.3.
 * rounded-full, 12.5px JetBrains Mono, px-2.5 py-0.5, bg-subtle surface,
 * ink-secondary text, 1px border.
 *
 * variant="filter"  — interactive toggle: hover border-strong; selected gets
 *                     accent border + accent-subtle bg + accent text.
 * variant="display" — inside post entries: hover text accent; links to
 *                     /blog?tag=<tag> (stops propagation of the parent row link).
 */

export interface TagChipProps {
  tag: string
  variant?: 'display' | 'filter'
  selected?: boolean
  onClick?: () => void
  className?: string
}

export default function TagChip({
  tag,
  variant = 'display',
  selected = false,
  onClick,
  className,
}: TagChipProps) {
  const navigate = useNavigate()

  const base = cn(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[12.5px] leading-[1.5] transition-colors duration-150',
    className,
  )

  if (variant === 'filter') {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={cn(
          base,
          selected
            ? 'border-accent bg-accent-subtle text-accent'
            : 'border-border bg-bg-subtle text-ink-secondary hover:border-border-strong',
        )}
      >
        {tag}
      </button>
    )
  }

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigate(`/blog?tag=${encodeURIComponent(tag)}`)
  }

  return (
    <a
      href={`/blog?tag=${encodeURIComponent(tag)}`}
      onClick={handleClick}
      className={cn(base, 'border-border bg-bg-subtle text-ink-secondary hover:text-accent')}
    >
      {tag}
    </a>
  )
}
