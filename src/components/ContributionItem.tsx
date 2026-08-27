import { ExternalLink } from 'lucide-react'
import type { Contribution } from '@/lib/contributions'
import { formatContributionDate } from '@/lib/contributions'
import { cn } from '@/lib/utils'

/**
 * ContributionItem — docs/DESIGN.md §6.9.
 * Hairline-separated row (py-5). Type badge (Advisory = published-green
 * tint, Patch = accent tint; 11px mono uppercase) + state badge (merged
 * purple / published green; dot + label 12px mono). Title is an external
 * link (Inter 600 15.5px, hover accent + ExternalLink 13px). Meta row:
 * `repo/name · 08 Jun 2026 · tags` (mono 12.5px ink-muted).
 * `condensed` (home strip): one-line summary clamp, no tag list.
 */

export interface ContributionItemProps {
  item: Contribution
  condensed?: boolean
}

function TypeBadge({ type }: { type: string }) {
  const advisory = type === 'advisory'
  return (
    <span
      className="rounded-md px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.04em]"
      style={{
        color: advisory ? 'var(--state-published)' : 'var(--accent)',
        backgroundColor: advisory
          ? 'color-mix(in srgb, var(--state-published) 14%, transparent)'
          : 'var(--accent-subtle)',
      }}
    >
      {advisory ? 'Advisory' : 'Patch'}
    </span>
  )
}

function StateBadge({ state }: { state: string }) {
  const color =
    state === 'published'
      ? 'var(--state-published)'
      : state === 'merged'
        ? 'var(--state-merged)'
        : 'var(--ink-muted)'
  return (
    <span className="flex items-center gap-1.5 font-mono text-[12px]" style={{ color }}>
      <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-current" />
      {state}
    </span>
  )
}

export default function ContributionItem({ item, condensed = false }: ContributionItemProps) {
  return (
    <article className="border-t border-border first:border-t-0">
      <div className="py-5">
        <div className="flex items-center gap-2.5">
          <TypeBadge type={item.type} />
          <StateBadge state={item.state} />
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-2 inline-flex items-baseline gap-1.5"
        >
          <span className="text-[15.5px] font-semibold leading-[1.45] text-ink transition-colors duration-150 group-hover:text-accent">
            {item.title}
          </span>
          <ExternalLink
            size={13}
            aria-hidden="true"
            className="shrink-0 translate-y-[1px] text-ink-muted transition-colors duration-150 group-hover:text-accent"
          />
        </a>
        {item.summary && (
          <p
            className={cn(
              'mt-1 text-[14px] leading-[1.6] text-ink-secondary',
              condensed ? 'line-clamp-1' : 'line-clamp-2',
            )}
          >
            {item.summary}
          </p>
        )}
        <p className="mt-2 font-mono text-[12.5px] text-ink-muted">
          {item.repo}
          <span aria-hidden="true"> · </span>
          {formatContributionDate(item.date)}
          {!condensed && item.tags.length > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              {item.tags.join(' ')}
            </>
          )}
        </p>
      </div>
    </article>
  )
}
