import { Link } from 'react-router'
import TagChip from '@/components/TagChip'
import { formatPostDate } from '@/lib/format'
import type { PostMeta } from '@/lib/posts'

/**
 * PostListItem — docs/DESIGN.md §6.4.
 * Full-width hairline-separated row (py-6; renders its own top hairline,
 * suppressed on the first row). Grid: 110px date column (hidden on mobile,
 * where the date moves above the title) + body: title → 2-line excerpt →
 * tag chips · reading time. Whole row is one link; chips stop propagation.
 * Hover: title turns accent + row bg tint. No cards, no shadows.
 */

export interface PostListItemProps {
  post: PostMeta
}

export default function PostListItem({ post }: PostListItemProps) {
  const date = formatPostDate(post.date)

  return (
    <article className="border-t border-border first:border-t-0">
      <Link
        to={`/blog/${post.slug}`}
        className="group -mx-3 grid grid-cols-1 gap-x-6 rounded-md px-3 py-6 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--bg-subtle)_55%,transparent)] md:grid-cols-[110px_1fr]"
      >
        <time
          dateTime={post.date}
          className="hidden pt-1 font-mono text-meta text-ink-muted md:block"
        >
          {date}
        </time>
        <div className="min-w-0">
          <time
            dateTime={post.date}
            className="mb-1 block font-mono text-meta text-ink-muted md:hidden"
          >
            {date}
          </time>
          <h3 className="font-display text-list-title-sm text-ink transition-colors duration-150 group-hover:text-accent md:text-list-title">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="mt-1.5 line-clamp-2 text-[15px] leading-[1.65] text-ink-secondary">
              {post.excerpt}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {post.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
            {post.tags.length > 0 && (
              <span aria-hidden="true" className="font-mono text-[12.5px] text-ink-muted">
                ·
              </span>
            )}
            <span className="font-mono text-[12.5px] text-ink-muted">
              {post.readingTime} min read
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
