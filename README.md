# Blog template

A quiet, fast, config-driven personal blog. React + Vite + Tailwind, markdown
posts, dual light/dark theme, and a GitHub Pages deploy that needs no server.

Everything personal lives in **one file** — [`site.config.json`](site.config.json).
Nothing in `src/` hardcodes a name, a handle, or a URL.

```
├── site.config.json          ← your name, links, copy, feature switches
├── public/posts/             ← your writing (markdown + an index.json)
├── src/                      ← the app; you rarely need to touch it
│   ├── index.css             ← design tokens (colors, both themes)
│   ├── config/site.ts        ← typed accessor for site.config.json
│   ├── components/           ← navbar, footer, post renderer, code blocks…
│   └── pages/                ← home, blog, post, contributions, about, 404
├── scripts/                  ← build-time generators (RSS, manifest, …)
└── docs/DESIGN.md            ← the design system, section by section
```

## What you get

- **Markdown posts** with syntax highlighting ([shiki](https://shiki.style)),
  mermaid diagrams, auto-numbered figures with a lightbox, and an
  automatically-built table of contents with scroll-spy.
- **Two themes.** Light "Paper" and dark "Slate", both defined as CSS custom
  properties. No flash on load; the choice persists; system preference is the
  default.
- **A real archive.** Full-text search (fuse.js), multi-select tag filters,
  year grouping, and URL state so a filtered view is shareable.
- **Link previews that work.** Every post gets a tiny static HTML page with its
  own OG tags, so X/Slack/Discord unfurl the post, not the site.
- **RSS**, a generated web-app manifest, a print stylesheet, and
  `prefers-reduced-motion` support throughout.
- **An optional contributions page** that pulls your merged pull requests and
  security advisories from the GitHub API at build time.
- **No trackers, no analytics, no cookies.** Nothing phones home.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

Then, in order:

1. **Edit `site.config.json`.** Name, handle, URL, social links, the copy on
   the home and about pages. See the reference below.
2. **Replace the placeholder art** in `public/`: `favicon.svg`, `icon.svg`,
   `icon-maskable.svg`, `og-cover.svg`, and `images/avatar.svg`. (Any format
   works — point the config at `avatar.jpg` if you'd rather use a photo.)
3. **Delete the three sample posts** in `public/posts/` and their rows in
   `public/posts/index.json`, then write your own. The samples double as
   documentation, so read them before you delete them.
4. **Recolor if you like** — see [docs/DESIGN.md](docs/DESIGN.md), or the
   "Styling this blog" sample post.

```bash
npm run build          # typecheck, regenerate, bundle to dist/
npm run preview        # serve dist/ locally
npm run lint
```

## Writing a post

Two edits per post. First the markdown, in `public/posts/<slug>.md`:

```markdown
---
id: 4
slug: my-new-post
title: My new post
excerpt: One or two sentences — this is what shows in the archive, the RSS feed, and link previews.
date: 2026-03-01
readingTime: 6
tags: ["Engineering", "Notes"]
ogImage: /images/posts/my-new-post/cover.png
---

Your first paragraph.

## A heading

Text, `code`, [links](https://example.com), lists, tables, images, and
mermaid fences all work.
```

Then a matching row at the **top** of `public/posts/index.json` (newest first —
though the app sorts by date anyway):

```json
{
  "id": "4",
  "slug": "my-new-post",
  "title": "My new post",
  "excerpt": "One or two sentences …",
  "date": "2026-03-01",
  "readingTime": 6,
  "tags": ["Engineering", "Notes"]
}
```

`ogImage` is optional. Post images go in `public/images/posts/<slug>/` and are
referenced with an absolute path (`/images/posts/<slug>/cover.png`).

The sample post **Markdown reference** exercises every feature the renderer
supports — keep it around while you're getting started.

## Configuration reference

All of it lives in `site.config.json`.

### Identity

| Key | What it does |
| --- | --- |
| `url` | Canonical site URL. Used for OG tags, RSS, share links. No trailing slash. |
| `basePath` | `/` for a user site or custom domain; `/repo/` when the site is served from a repository subpath. |
| `title` | Browser title and the site-level OG title. |
| `shortName` | Suffix on per-page titles (`Post title · shortName`). |
| `description` | Meta description, OG description, RSS channel description. |
| `language` | `<html lang>` and the RSS language. |
| `author.name` | Shown on the home and about pages. |
| `author.handle` | Rendered as `@handle`. |
| `author.role` | One-liner under your name on the home page. |
| `author.email` | Contact address (also used by the About page's copy button). |
| `author.avatar` | Path to your portrait, e.g. `/images/avatar.jpg`. |
| `wordmark` | The three parts of the header wordmark: `before` + accented `accent` + `after`. Set `accent` to `""` for a plain wordmark. |
| `seo.ogImage` | Default link-preview image (1200×630 works best). |
| `repo.url` / `repo.branch` / `repo.postsDir` | Where "Suggest an edit" points. |

### Structure

| Key | What it does |
| --- | --- |
| `nav` | Header and footer links: `{ label, to, end }`. `end: true` means exact-match highlighting (use it for `/`). |
| `social` | Icon row in the footer and the list on the About page: `{ type, label, href, value }`. `type` picks the icon — see `src/config/icons.ts` for the list, and add to it for anything missing. |

### Feature switches

| Key | When `false` |
| --- | --- |
| `features.contributions` | The page, the route, the nav item, the home strip and the build-time fetch all disappear. |
| `features.rss` | No feed icon in the header or footer. (The file is still generated; delete `generate-rss.mjs` from `npm run generate` to stop that too.) |
| `features.search` | Hides the archive's search box; tag filters stay. |
| `features.editOnGitHub` | Removes the "Suggest an edit" link under each post. |
| `features.shareOnX` | Removes the "Share on X" link under each post. |
| `features.tableOfContents` | No sticky TOC rail on posts. |

### Copy

`home`, `blog`, `about`, `contributions` and `footer` hold the prose for each
page — headings, ledes, the About bio paragraphs, the focus-area list, the
colophon. Arrays grow and shrink: three bio paragraphs or one, four focus areas
or none.

## The contributions page

Optional, and GitHub-specific. `scripts/fetch-contributions.mjs` builds
`public/contributions/index.json` from three sources:

- merged pull requests authored by `contributions.githubUsername`,
- security advisories whose GHSA ids you list in `scripts/contributions.json`,
- anything else you add by hand to that file's `items` array.

Run it locally with `npm run fetch:contributions` (set `GITHUB_TOKEN` to raise
the rate limit from 60 to 5000 requests/hour); in CI the workflow passes the
token automatically. If the API call fails, the script keeps the existing JSON
and the build carries on.

Not for you? Set `features.contributions` to `false` and delete
`src/pages/Contributions.tsx`, `src/components/ContributionItem.tsx`,
`src/lib/contributions.ts` and `scripts/fetch-contributions.mjs`.

## Deploying

The included workflow (`.github/workflows/deploy.yml`) builds and publishes on
every push to `main` or `master`.

**User site** (`username.github.io`): push this repo to a repository of that
name, then Settings → Pages → Source → **GitHub Actions**. Done.

**Project site** (`username.github.io/blog`): set `"basePath": "/blog/"` in
`site.config.json` — Vite's `base`, the router's basename, every asset URL and
the generated 404/RSS/share pages all read it.

**Custom domain**: add a `public/CNAME` file containing the domain, set it
under Settings → Pages, and update `url` in the config.

The nightly cron in the workflow only refreshes the contributions feed — delete
the `schedule:` block if you don't use that page.

### Why the generated files are committed

`npm run generate` (run automatically by `prebuild`) writes `public/rss.xml`,
`public/manifest.json`, `public/404.html`, `public/blog/**/index.html` and
`public/contributions/index.json`. They're kept in git so a fresh clone runs
`npm run dev` correctly without a GitHub token. Re-run `npm run generate`
whenever you add a post, or just let the build do it.

## Adding UI components

The template ships only what it uses, but it's configured for
[shadcn/ui](https://ui.shadcn.com) (see `components.json`), so you can pull in
components as you need them:

```bash
npx shadcn@latest add dialog
```

They'll land in `src/components/ui/` and inherit the Tailwind config.

## Provenance and licensing

This template is derived from
[locus-x64/locus-x64.github.io](https://github.com/locus-x64/locus-x64.github.io):
the design system, layout and components come from that site, with all of the
author's identity, writing and images removed and replaced by configuration and
placeholders.

**That repository ships no license file**, which under default copyright means
no permission is granted to reuse its code. If you plan to publish a site built
on this template — and especially if you plan to redistribute the template
itself — ask the author for an explicit license first. The sample posts,
placeholder art and configuration layer added here are yours to do with as you
like.
