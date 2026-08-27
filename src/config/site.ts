/**
 * Site configuration — the single place where "who is this blog" lives.
 *
 * Everything personal (name, links, copy, feature switches) is read from
 * `site.config.json` at the project root. Components import from here, never
 * from the JSON directly, so the shape stays typed and derived values
 * (nav filtering, absolute URLs, document titles) have one home.
 *
 * The same JSON is read by the Node scripts in scripts/ and injected into
 * index.html by the `siteHtml()` Vite plugin, so a value only ever has to be
 * changed once.
 */

import featuresRaw from '../../features.config.json'
import raw from '../../site.config.json'

export interface SocialLink {
  /** icon key — see ICONS in src/config/icons.ts */
  type: string
  label: string
  href: string
  /** shown next to the label on the About page (optional) */
  value?: string
}

export interface NavItem {
  label: string
  to: string
  end: boolean
}

export interface FocusArea {
  term: string
  definition: string
}

export interface SiteConfig {
  url: string
  basePath: string
  title: string
  shortName: string
  description: string
  language: string
  author: {
    name: string
    handle: string
    role: string
    email: string
    avatar: string
  }
  wordmark: { before: string; accent: string; after: string }
  seo: { ogImage: string; twitterCard: string }
  repo: { url: string; branch: string; postsDir: string }
  nav: NavItem[]
  social: SocialLink[]
  features: {
    contributions: boolean
    rss: boolean
    search: boolean
    editOnGitHub: boolean
    shareOnX: boolean
    tableOfContents: boolean
  }
  home: {
    eyebrow: string
    lede: string
    latestHeading: string
    latestCount: number
    contributionsHeading: string
    contributionsCount: number
  }
  blog: { heading: string; description: string }
  about: {
    heading: string
    tagline: string
    bio: string[]
    focusHeading: string
    focus: FocusArea[]
    elsewhereHeading: string
    colophon: string[]
  }
  contributions: {
    githubUsername: string
    heading: string
    description: string
    minDate: string
  }
  footer: { tagline: string; copyrightHolder: string; copyrightNote: string }
}

const featuresOverrides = (featuresRaw ?? {}) as Partial<SiteConfig['features']>
const baseSite = raw as SiteConfig
export const site: SiteConfig = {
  ...baseSite,
  features: {
    ...baseSite.features,
    ...featuresOverrides,
  },
}

/* ---------------- derived values ---------------- */

/**
 * The path the site is served from — `/` normally, `/repo/` for a project
 * page. Vite sets it from `basePath` in site.config.json (see vite.config.ts),
 * which keeps this correct in dev, in the build and in the router.
 */
export const basePath: string = import.meta.env.BASE_URL || '/'

/** Prefix a root-relative path with the base: `/posts/x.md` → `/repo/posts/x.md`. */
export function withBase(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('data:')) {
    return path
  }
  return `${basePath.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

/** Nav items, minus anything a disabled feature would 404 on. */
export const navItems: NavItem[] = site.nav.filter((item) => {
  if (!site.features.contributions && item.to === '/contributions') return false
  return true
})

/** Social links, minus RSS when the feed is switched off. Root-relative hrefs
 * (like /rss.xml) are base-prefixed so they survive a project-page deploy. */
export const socialLinks: SocialLink[] = site.social
  .filter((link) => {
    if (!site.features.rss && (link.type === 'rss' || link.href.endsWith('/rss.xml'))) return false
    return true
  })
  .map((link) => ({ ...link, href: withBase(link.href) }))

/** The site's own GitHub profile URL, if one is configured. */
export const githubUrl: string =
  site.social.find((l) => l.type === 'github')?.href ?? site.repo.url

export const rssUrl = withBase('/rss.xml')
export const rssEnabled = site.features.rss

/** `https://example.com/blog/my-post` — absolute, base-aware, no double slashes. */
export function absoluteUrl(path: string): string {
  const origin = site.url.replace(/\/+$/, '')
  return `${origin}${withBase(path)}`
}

/** Absolute OG image URL (config value may be relative). */
export function ogImageUrl(image?: string): string {
  const value = image ?? site.seo.ogImage
  return /^https?:\/\//.test(value) ? value : absoluteUrl(value)
}

/** The author's portrait, base-aware. */
export const avatarUrl: string = withBase(site.author.avatar)

/** `Post title · short-name` — the per-page document title. */
export function pageTitle(section?: string): string {
  return section ? `${section} · ${site.shortName}` : site.title
}

/** GitHub "edit this page" URL for a post slug. */
export function editPostUrl(slug: string): string {
  const repo = site.repo.url.replace(/\/+$/, '')
  return `${repo}/edit/${site.repo.branch}/${site.repo.postsDir}/${slug}.md`
}

/** Copyright line year — starts at the configured year, extends to now. */
export function copyrightYear(): string {
  return String(new Date().getFullYear())
}
