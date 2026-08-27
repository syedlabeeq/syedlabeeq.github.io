/**
 * Content pipeline — src/lib/posts.ts
 * Fetches migrated markdown posts from /public/posts and prepares
 * everything page agents need (metadata, body, TOC, search records).
 */

import { withBase } from '@/config/site'

export interface PostMeta {
  id: string
  slug: string
  title: string
  excerpt: string
  /** ISO date YYYY-MM-DD */
  date: string
  /** minutes */
  readingTime: number
  tags: string[]
  ogImage?: string
}

export interface Post extends PostMeta {
  /** markdown body with frontmatter stripped and image paths resolved */
  body: string
}

export interface TocHeading {
  /** 2 or 3 */
  depth: number
  text: string
  /** slugified anchor id — matches ids emitted by src/components/Markdown.tsx */
  id: string
}

export interface SearchRecord {
  slug: string
  title: string
  tags: string[]
  date: string
  /** plain-text body (markdown syntax stripped) for fuse.js */
  text: string
}

let postsCache: PostMeta[] | null = null
const bodyCache = new Map<string, Post>()

/** All posts, sorted newest first. Cached after first fetch. */
export async function loadPosts(): Promise<PostMeta[]> {
  if (postsCache) return postsCache
  const res = await fetch(withBase('/posts/index.json'))
  if (!res.ok) throw new Error(`failed to load posts index: ${res.status}`)
  const raw = (await res.json()) as PostMeta[]
  postsCache = raw
    .map((p) => ({ ...p, title: p.title.trim() }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return postsCache
}

/** Single post with markdown body (frontmatter stripped, images resolved). */
export async function loadPost(slug: string): Promise<Post> {
  const cached = bodyCache.get(slug)
  if (cached) return cached
  const res = await fetch(withBase(`/posts/${slug}.md`))
  if (!res.ok) throw new Error(`failed to load post ${slug}: ${res.status}`)
  const raw = await res.text()
  const { attributes, body } = parseFrontmatter(raw)
  const metas = await loadPosts()
  const fromIndex = metas.find((m) => m.slug === slug)
  const meta: PostMeta = fromIndex ?? {
    id: String(attributes.id ?? slug),
    slug,
    title: String(attributes.title ?? slug).trim(),
    excerpt: String(attributes.excerpt ?? ''),
    date: String(attributes.date ?? ''),
    readingTime: Number(attributes.readingTime ?? estimateReadingTime(body)),
    tags: Array.isArray(attributes.tags) ? (attributes.tags as string[]) : [],
    ...(attributes.ogImage ? { ogImage: String(attributes.ogImage) } : {}),
  }
  const post: Post = { ...meta, body: resolveImages(body) }
  bodyCache.set(slug, post)
  return post
}

/**
 * Tiny YAML-frontmatter parser. Handles the subset used by the migrated
 * posts: `key: value`, quoted scalars, and inline string arrays.
 */
export function parseFrontmatter(raw: string): {
  attributes: Record<string, unknown>
  body: string
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { attributes: {}, body: raw }
  const attributes: Record<string, unknown> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!kv) continue
    const [, key, rest] = kv
    let value: unknown = rest.trim()
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else if (typeof value === 'string') {
      const unquoted = value.replace(/^["']|["']$/g, '')
      value = /^\d+$/.test(unquoted) ? Number(unquoted) : unquoted
    }
    attributes[key] = value
  }
  return { attributes, body: raw.slice(m[0].length) }
}

/** GitHub-style heading slugification — shared by TOC and renderer. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

/** Extract h2/h3 headings from markdown for a table of contents. */
export function extractHeadings(markdown: string): TocHeading[] {
  const headings: TocHeading[] = []
  let inFence = false
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/)
    if (m) {
      headings.push({
        depth: m[1].length,
        text: m[2].trim(),
        id: slugifyHeading(m[2]),
      })
    }
  }
  return headings
}

/** Rewrite relative post image paths to the migrated /images/ root. */
export function resolveImages(markdown: string): string {
  return markdown
    .replace(/\]\(images\//g, '](/images/')
    .replace(/\]\(\/images\//g, `](${withBase('/images/')}`)
}

/** Strip markdown syntax to plain text (for fuse.js full-text search). */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---/, '') // frontmatter
    .replace(/```[\s\S]*?```/g, ' ') // code fences
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Plain-text search records for every post (fuse.js). */
export async function searchRecords(): Promise<SearchRecord[]> {
  const metas = await loadPosts()
  const posts = await Promise.all(metas.map((m) => loadPost(m.slug).catch(() => null)))
  return posts
    .filter((p): p is Post => p !== null)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      tags: p.tags,
      date: p.date,
      text: markdownToPlainText(p.body),
    }))
}

export function estimateReadingTime(markdown: string): number {
  const words = markdownToPlainText(markdown).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
