#!/usr/bin/env node
/**
 * generate-static.mjs — writes the static files in public/ that depend on
 * site.config.json:
 *
 *   public/manifest.json   PWA metadata (name, colors, icons)
 *   public/404.html        the GitHub Pages SPA fallback, base-path aware
 *
 * Runs as part of `npm run generate` (and so `npm run build`). The output is
 * committed so the dev server can serve it without a build step.
 */

import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ROOT, site } from './site-config.mjs'

const base = site.basePath && site.basePath !== '/' ? site.basePath.replace(/\/*$/, '/') : '/'

const manifest = {
  name: site.author?.name || site.shortName,
  short_name: site.shortName,
  description: site.description,
  start_url: base,
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#141518',
  icons: [
    { src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: `${base}icon-maskable.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
}

/**
 * GitHub Pages has no server-side routing: every unknown path gets 404.html.
 * This one stashes the requested path in ?p= and bounces to the SPA, which
 * restores it (see the matching script in index.html).
 */
const notFound = `<!doctype html>
<html lang="${site.language ?? 'en'}">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
    <script>
      (function () {
        var base = '${base}'
        var path = window.location.pathname + window.location.search
        window.location.replace(
          window.location.origin + base + '?p=' + encodeURIComponent(path) + window.location.hash,
        )
      })()
    </script>
  </head>
  <body></body>
</html>
`

await writeFile(path.join(ROOT, 'public', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
await writeFile(path.join(ROOT, 'public', '404.html'), notFound, 'utf8')
console.log('static: wrote public/manifest.json, public/404.html')
