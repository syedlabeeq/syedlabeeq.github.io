import { cn } from '@/lib/utils'

/**
 * TagFilterChip — blog archive filter chip.
 * Mirrors the shared TagChip `filter` variant (docs/DESIGN.md §6.3) but adds a
 * count suffix rendered in --ink-muted at 0.85 opacity, which TagChip's
 * tag-string-only label cannot express. Selected: accent border +
 * accent-subtle bg + accent text; otherwise bg-subtle / ink-secondary with
 * border-strong on hover. 150ms cross-fade.
 */

export interface TagFilterChipProps {
  tag: string
  count?: number
  selected?: boolean
  onClick?: () => void
  className?: string
}

export default function TagFilterChip({
  tag,
  count,
  selected = false,
  onClick,
  className,
}: TagFilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[12.5px] leading-[1.5] transition-colors duration-150',
        selected
          ? 'border-accent bg-accent-subtle text-accent'
          : 'border-border bg-bg-subtle text-ink-secondary hover:border-border-strong',
        className,
      )}
    >
      {tag}
      {typeof count === 'number' && (
        <span className="ml-1.5 text-ink-muted opacity-[0.85]">{count}</span>
      )}
    </button>
  )
}
