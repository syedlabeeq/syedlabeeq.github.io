/**
 * generate-share-pages.mjs — one tiny static HTML page per post under
 * public/blog/<slug>/index.html.
 *
 * GitHub Pages can't server-render the SPA, so crawlers and link unfurlers
 * (Slack, X, Discord) would otherwise only ever see the site-level meta tags.
 * Each generated page carries the post's own title/description/OG image and
 * then bounces the human visitor into the SPA route.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { ROOT, absoluteUrl, site, siteUrl as configuredUrl } from './site-config.mjs'

const postsIndexPath = path.join(ROOT, 'public', 'posts', 'index.json')
const outputRoot = path.join(ROOT, 'public', 'blog')
const siteUrl = (process.env.SITE_URL || configuredUrl).replace(/\/+$/, '')
const defaultImage = absoluteUrl(site.seo?.ogImage ?? '/og-cover.svg')
const language = site.language ?? 'en'
const base = site.basePath && site.basePath !== '/' ? site.basePath.replace(/\/*$/, '/') : '/'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderPostPage(post) {
  const slug = String(post.slug).trim()
  const title = escapeHtml(String(post.title).trim())
  const description = escapeHtml(String(post.excerpt).trim())
  const publishedDate = escapeHtml(String(post.date).trim())
  const postPath = `/blog/${slug}`
  const canonicalUrl = `${siteUrl}${base}${postPath.replace(/^\//, '')}`
  
  // Use post-specific OG image if available, otherwise default
  const ogImage = post.ogImage 
    ? escapeHtml(String(post.ogImage).trim())
    : defaultImage

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonicalUrl}" />

    <meta property="og:type" content="article" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="article:published_time" content="${publishedDate}" />

    <meta name="twitter:card" content="${escapeHtml(site.seo?.twitterCard ?? 'summary_large_image')}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />

    <script>
      (function () {
        var fullPath = '${base}${postPath.replace(/^\//, '')}' + window.location.search
        var redirect = '${base}?p=' + encodeURIComponent(fullPath)
        window.location.replace(redirect + window.location.hash)
      })();
    </script>
  </head>
  <body></body>
</html>
`
}

async function main() {
  if (site.features?.shareOnX === false) {
    console.log('[share-pages] shareOnX disabled — skipping share page generation')
    return
  }

  const raw = await fs.readFile(postsIndexPath, 'utf8')
  const posts = JSON.parse(raw)

  await fs.mkdir(outputRoot, { recursive: true })

  for (const post of posts) {
    if (!post.slug || !post.title || !post.excerpt || !post.date) {
      continue
    }

    const postDir = path.join(outputRoot, String(post.slug).trim())
    await fs.mkdir(postDir, { recursive: true })
    const filePath = path.join(postDir, 'index.html')
    await fs.writeFile(filePath, renderPostPage(post), 'utf8')
  }

  console.log(`Generated share pages for ${posts.length} posts`)
}

main().catch((error) => {
  console.error('Failed to generate share pages:', error)
  process.exit(1)
})
