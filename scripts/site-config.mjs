/**
 * Shared loader so the Node build scripts read the same site.config.json the
 * app does. Import it, don't re-parse the file.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const siteConfigPath = path.join(ROOT, 'site.config.json')
const featuresConfigPath = path.join(ROOT, 'features.config.json')

export const site = JSON.parse(readFileSync(siteConfigPath, 'utf8'))

try {
  const overrides = JSON.parse(readFileSync(featuresConfigPath, 'utf8'))
  if (overrides && typeof overrides === 'object') {
    site.features = { ...site.features, ...overrides }
  }
} catch {
  // optional overrides file — ignore if missing or invalid
}

/** Site URL with any trailing slash removed. */
export const siteUrl = String(site.url ?? '').replace(/\/+$/, '')

/** Turn a possibly-relative config path into an absolute URL. */
export function absoluteUrl(value) {
  if (!value) return ''
  if (/^https?:\/\//.test(value)) return value
  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`
}
