---
id: 1
slug: hello-world
title: Hello, world — and how this blog works
excerpt: The one-file configuration, where posts live, and what happens between `npm run dev` and a deployed site. Start here, delete it when you've read it.
date: 2026-01-12
readingTime: 4
tags: ["Meta", "Getting Started"]
---

This post exists so the blog isn't empty on first run, and so you can see what
a real post looks like before you write one. Delete it when you're done —
nothing links to it by name.

## The one file you have to edit

Everything personal about this site lives in `site.config.json` at the project
root: your name, the wordmark in the header, social links, the copy on the home
and about pages, and a set of feature switches.

```json
{
  "url": "https://your-username.github.io",
  "title": "your-handle | Notes",
  "author": {
    "name": "Your Name",
    "handle": "your-handle"
  }
}
```

Nothing in `src/` hardcodes your identity. Components import from
`@/config/site`, the Node scripts in `scripts/` read the same JSON, and the
`siteHtml()` plugin in `vite.config.ts` fills the `{{ ... }}` placeholders in
`index.html`. Change a value once and it lands everywhere.

## Where posts live

One markdown file per post in `public/posts/`, plus a row in
`public/posts/index.json`. The index is what the blog list, the search, the RSS
feed and the share pages all read — the markdown body is fetched lazily, only
when someone opens the post.

```bash
# a new post is two edits
$EDITOR public/posts/my-new-post.md
$EDITOR public/posts/index.json
```

The frontmatter block at the top of this file shows the fields. `slug` has to
match the filename, `readingTime` is in minutes, and `tags` drive the filter
chips on the blog page.

> Keep the excerpt to one or two sentences. It's the only thing a reader sees
> in the archive list, in the RSS feed, and in a link preview on X or Slack.

## What runs at build time

`npm run build` triggers a `prebuild` step first, which regenerates four
things:

| Script | Output | Why |
| --- | --- | --- |
| `generate-static.mjs` | `public/manifest.json`, `public/404.html` | PWA metadata and the SPA fallback, from your config |
| `fetch-contributions.mjs` | `public/contributions/index.json` | GitHub PRs and advisories |
| `generate-rss.mjs` | `public/rss.xml` | RSS 2.0 feed |
| `generate-share-pages.mjs` | `public/blog/<slug>/index.html` | per-post link previews |

The last one matters more than it looks. GitHub Pages can't server-render a
single-page app, so without those little static pages every post would unfurl
with the site-level title and description instead of its own.

## Next

Read [Styling this blog](/blog/styling-this-blog) for the design tokens — colors,
type scale, spacing — and [Markdown reference](/blog/markdown-reference) for
everything the renderer supports.
