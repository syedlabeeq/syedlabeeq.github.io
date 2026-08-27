#!/usr/bin/env node
/**
 * fetch-contributions.mjs — builds public/contributions/index.json, the feed
 * behind the /contributions page and the strip on the home page.
 *
 * Sources (auto-updated):
 *   1. Curated GHSA advisories →  GET /advisories/{ghsa_id}
 *   2. Merged PRs              →  GET /search/issues?q=is:pr+is:merged+author:<user>
 *   3. Security-labelled issues→  GET /search/issues (security/vulnerability/cve labels)
 *
 * Source (manual): scripts/contributions.json
 *   For anything the public API can't find — repo-only advisories, HackerOne
 *   reports, work credited under another handle — plus the curated GHSA id
 *   list and the repo patterns to ignore.
 *
 * Configuration (site.config.json):
 *   contributions.githubUsername   whose contributions to fetch
 *   contributions.minDate          exclusive lower bound on dates
 *   features.contributions         false → the script writes nothing and exits
 *
 * Env:
 *   GITHUB_USERNAME  overrides contributions.githubUsername
 *   GITHUB_TOKEN     optional; raises the rate limit from 60/h to 5000/h
 *
 * The script never fails the build: on an API error it keeps whatever
 * public/contributions/index.json already holds.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { ROOT, site } from './site-config.mjs'

const username = process.env.GITHUB_USERNAME || site.contributions?.githubUsername || ''
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
const outDir = path.join(ROOT, 'public', 'contributions')
const outFile = path.join(outDir, 'index.json')
const manualPath = path.join(ROOT, 'scripts', 'contributions.json')
const postsIndexPath = path.join(ROOT, 'public', 'posts', 'index.json')

/** Exclusive lower bound — anything on or before this date is dropped. */
const MIN_DATE = site.contributions?.minDate || '1970-01-01'

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': `${username}-site-build`,
}
if (token) headers['Authorization'] = `Bearer ${token}`

async function ghFetch(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`GitHub API ${res.status} for ${url}: ${body.slice(0, 200)}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

function repoFromApiUrl(repositoryUrl) {
  return (repositoryUrl || '').replace('https://api.github.com/repos/', '')
}

function severityFromGhsa(s) {
  const v = (s || '').toLowerCase()
  if (['critical', 'high', 'medium', 'low'].includes(v)) return v
  return 'unknown'
}

function shorten(str, max = 240) {
  if (!str) return ''
  const clean = String(str).replace(/\r/g, '').replace(/\n+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean
}

function isNoiseRepo(repo, patterns) {
  return patterns.some((re) => re.test(repo))
}

function afterMinDate(iso) {
  if (!iso) return false
  return new Date(iso).getTime() > new Date(MIN_DATE).getTime()
}

function deriveTags({ repo, type, severity, cveId, language }) {
  const tags = new Set()
  if (type) {
    tags.add(type === 'patch' ? 'PR' : type.charAt(0).toUpperCase() + type.slice(1))
  }
  if (cveId) tags.add('CVE')
  if (severity && severity !== 'unknown') {
    tags.add(severity.charAt(0).toUpperCase() + severity.slice(1))
  }
  if (language) tags.add(language)
  if (repo) tags.add(repo.split('/')[0])
  return Array.from(tags)
}

async function loadJsonSafe(p, fallback) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'))
  } catch {
    return fallback
  }
}

async function fetchAdvisoryByGhsa(ghsaId, postsBySlug) {
  const url = `https://api.github.com/advisories/${encodeURIComponent(ghsaId)}`
  let adv
  try {
    adv = await ghFetch(url)
  } catch (e) {
    console.warn(`[contributions] advisory ${ghsaId} skipped: ${e.message}`)
    return null
  }
  const repo = adv.source_code_location
    ? adv.source_code_location.replace('https://github.com/', '').split('/').slice(0, 2).join('/')
    : adv.vulnerabilities?.[0]?.package?.name ?? ''
  const severity = severityFromGhsa(adv.severity)
  const cvss = adv.cvss?.score ?? undefined
  const cveId = adv.cve_id ?? undefined

  let relatedPostSlug
  if (cveId) {
    for (const [slug, p] of Object.entries(postsBySlug)) {
      const hay = `${p.slug} ${p.title} ${p.excerpt || ''}`.toUpperCase()
      if (hay.includes(cveId)) {
        relatedPostSlug = slug
        break
      }
    }
  }

  return {
    id: `ghsa:${adv.ghsa_id}`,
    type: 'advisory',
    title: adv.summary || cveId || adv.ghsa_id,
    summary: shorten(adv.description),
    repo,
    url: adv.html_url || `https://github.com/advisories/${adv.ghsa_id}`,
    date: adv.published_at || adv.updated_at,
    cveId,
    ghsaId: adv.ghsa_id,
    severity,
    cvss,
    state: adv.withdrawn_at ? 'withdrawn' : 'published',
    tags: deriveTags({ repo, type: 'advisory', severity, cveId }),
    relatedPostSlug,
  }
}

async function fetchAdvisories(postsBySlug, advisoryIds) {
  const out = []
  for (const id of advisoryIds) {
    const adv = await fetchAdvisoryByGhsa(id, postsBySlug)
    if (adv) out.push(adv)
  }
  return out
}

async function fetchPullRequests() {
  const q = encodeURIComponent(`is:pr is:merged author:${username} -user:${username}`)
  const url = `https://api.github.com/search/issues?q=${q}&sort=updated&order=desc&per_page=100`
  const data = await ghFetch(url)
  const items = data.items || []
  return items.map((it) => {
    const repo = repoFromApiUrl(it.repository_url)
    return {
      id: `pr:${repo}#${it.number}`,
      type: 'patch',
      title: it.title,
      summary: shorten(it.body),
      repo,
      url: it.html_url,
      date: it.closed_at || it.updated_at || it.created_at,
      state: 'merged',
      tags: deriveTags({ repo, type: 'patch' }),
    }
  })
}

async function fetchSecurityIssues() {
  const q = encodeURIComponent(
    `is:issue author:${username} -user:${username} label:security,vulnerability,cve`,
  )
  const url = `https://api.github.com/search/issues?q=${q}&sort=created&order=desc&per_page=50`
  try {
    const data = await ghFetch(url)
    const items = (data.items || []).filter((it) => !it.pull_request)
    return items.map((it) => {
      const repo = repoFromApiUrl(it.repository_url)
      return {
        id: `issue:${repo}#${it.number}`,
        type: 'report',
        title: it.title,
        summary: shorten(it.body),
        repo,
        url: it.html_url,
        date: it.created_at,
        state: it.state === 'closed' ? 'closed' : 'open',
        tags: deriveTags({ repo, type: 'report' }),
      }
    })
  } catch (e) {
    console.warn('[contributions] security issues lookup skipped:', e.message)
    return []
  }
}

function mergeOverrides(items, overrides) {
  // Overrides win on collisions (same id).
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const it of overrides) byId.set(it.id, it)
  return Array.from(byId.values())
}

function applyFilters(items, excludePatterns) {
  return items.filter((it) => {
    // Advisories are evergreen — never filter them by date.
    if (it.type !== 'advisory' && !afterMinDate(it.date)) return false
    if (it.repo && isNoiseRepo(it.repo, excludePatterns)) return false
    return true
  })
}

async function main() {
  if (site.features?.contributions === false) {
    console.log('[contributions] features.contributions is false — writing empty placeholder')
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(
      outFile,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          username: site.contributions?.githubUsername || '',
          items: [],
        },
        null,
        2,
      ),
    )
    return
  }
  if (!username) {
    console.warn('[contributions] no contributions.githubUsername configured — skipping')
    return
  }

  console.log(
    `[contributions] fetching for "${username}" ${
      token ? '(authenticated, 5000/h)' : '(unauthenticated, 60/h)'
    } | min date > ${MIN_DATE}`,
  )

  const posts = await loadJsonSafe(postsIndexPath, [])
  const postsBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]))
  const manual = await loadJsonSafe(manualPath, {})
  const overrides = (manual.items || []).filter((it) => it && typeof it === 'object' && it.id)
  const advisoryIds = (manual.advisoryIds || []).filter((id) => typeof id === 'string')
  const excludePatterns = (manual.excludeRepoPatterns || [])
    .filter((p) => typeof p === 'string')
    .map((p) => new RegExp(p, 'i'))

  let advisories = []
  let prs = []
  let issues = []
  try {
    ;[advisories, prs, issues] = await Promise.all([
      fetchAdvisories(postsBySlug, advisoryIds),
      fetchPullRequests(),
      fetchSecurityIssues(),
    ])
  } catch (e) {
    console.warn('[contributions] fetch failed, keeping existing JSON:', e.message)
    const existing = await loadJsonSafe(outFile, null)
    if (existing) {
      console.log(`[contributions] preserved ${existing.items?.length ?? 0} cached items`)
      return
    }
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(
      outFile,
      JSON.stringify({ generatedAt: new Date().toISOString(), username, items: [] }, null, 2),
    )
    return
  }

  const merged = mergeOverrides([...advisories, ...prs, ...issues], overrides)
  const filtered = applyFilters(merged, excludePatterns)
    .map((it) => ({
      ...it,
      title: typeof it.title === 'string' ? it.title.replace(/ — /g, ', ') : it.title,
      summary: typeof it.summary === 'string' ? it.summary.replace(/ — /g, ', ') : it.summary,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const payload = { generatedAt: new Date().toISOString(), username, items: filtered }
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2))

  const counts = filtered.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] ?? 0) + 1
    return acc
  }, {})
  const summary = Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')
  console.log(
    `[contributions] wrote ${filtered.length} items (${summary}) | API: ${advisories.length} advisories, ${prs.length} PRs, ${issues.length} issues | manual: ${overrides.length}`,
  )
}

main().catch((e) => {
  console.error('[contributions] unexpected error:', e)
  process.exit(0)
})
