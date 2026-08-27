import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Reads site.config.json and fills the {{ ... }} placeholders in index.html,
 * so the static <head> (title, description, OG/Twitter tags, canonical URL)
 * stays in sync with the rest of the site without being duplicated by hand.
 */
const configPath = path.resolve(__dirname, 'site.config.json')
const siteConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))

function siteHtml(): Plugin {
  const flatten = (value: unknown, prefix = ''): Record<string, string> => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { [prefix]: String(value) }
    }
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [key, child]) => Object.assign(acc, flatten(child, prefix ? `${prefix}.${key}` : key)),
      {},
    )
  }

  return {
    name: 'site-html',
    // re-run the dev server's HTML transform when the config changes
    configureServer(server) {
      server.watcher.add(configPath)
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === configPath) server.restart()
      })
    },
    transformIndexHtml(html) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      const values = flatten(config)
      const url = String(config.url ?? '').replace(/\/+$/, '')
      const ogImage = String(config.seo?.ogImage ?? '')
      const base =
        config.basePath && config.basePath !== '/'
          ? String(config.basePath).replace(/\/*$/, '/')
          : '/'
      values['url'] = url
      // `siteRoot` is the site's actual home — origin + base path.
      values['siteRoot'] = `${url}${base}`
      values['seo.ogImageUrl'] = /^https?:\/\//.test(ogImage)
        ? ogImage
        : `${url}${base}${ogImage.replace(/^\//, '')}`

      return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) =>
        key in values ? values[key] : match,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Serving from a project page (https://user.github.io/repo/)? Set
  // "basePath": "/repo/" in site.config.json — it feeds Vite's base, the
  // router's basename and every asset URL.
  base: siteConfig.basePath || '/',
  plugins: [siteHtml(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
