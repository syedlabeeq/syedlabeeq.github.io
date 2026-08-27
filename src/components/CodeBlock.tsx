import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { getHighlighter, resolveLang } from '@/lib/highlight'
import { cn } from '@/lib/utils'

/**
 * CodeBlock — docs/DESIGN.md §6.6.
 * rounded-lg, 1px border, surface per §2.3 (--syn-surface), 14px JetBrains
 * Mono, horizontal scroll, my-6. Header strip (36px, bottom hairline):
 * language label or filename left (mono 11px uppercase, ink-muted), copy
 * button right (success: check + "Copied" for 1.6s, micro-pop 180ms).
 * Syntax highlighting: shiki with the dual-theme `blog-syntax` theme
 * (CSS-variable token colors — see src/lib/highlight.ts). Diff fences tint
 * added/removed lines per §2.3.
 */

export interface CodeBlockProps {
  code: string
  lang?: string
  filename?: string
  className?: string
}

export default function CodeBlock({ code, lang, filename, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const resolved = resolveLang(lang)
    if (resolved === null) {
      setHtml(null)
      return
    }
    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return
        const out = highlighter.codeToHtml(code.replace(/\n$/, ''), {
          lang: resolved,
          theme: 'blog-syntax',
          transformers: [
            {
              name: 'code-pre',
              pre(node) {
                const existing = typeof node.properties.class === 'string' ? node.properties.class : ''
                node.properties.class = cn('codeblock-pre', existing)
              },
              ...(resolved === 'diff'
                ? {
                    line(this: { source: string }, node: { properties: Record<string, unknown> }, line: number) {
                      const src = this.source.split('\n')[line - 1] ?? ''
                      const cls =
                        typeof node.properties.class === 'string' ? node.properties.class : ''
                      if (src.startsWith('+')) node.properties.class = cn(cls, 'diff-add')
                      else if (src.startsWith('-')) node.properties.class = cn(cls, 'diff-del')
                    },
                  }
                : {}),
            },
          ],
        })
        setHtml(out)
      })
      .catch(() => {
        if (!cancelled) setHtml(null)
      })
    return () => {
      cancelled = true
    }
  }, [code, lang])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const label = filename ?? (lang || 'text')

  return (
    <div
      className={cn('my-6 overflow-hidden rounded-lg border border-border', className)}
      style={{ backgroundColor: 'var(--syn-surface)' }}
    >
      <div
        className="hairline-b flex h-9 items-center justify-between pl-4 pr-2"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg-subtle) 60%, var(--bg))' }}
      >
        <span className="truncate font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-ink-muted transition-all duration-150 hover:text-ink',
            copied && 'scale-105 text-ink',
          )}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {html ? (
        <div
          // shiki output — generated locally from trusted post markdown
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="codeblock-pre" style={{ color: 'var(--syn-base)' }}>
          <code>
            {code.replace(/\n$/, '').split('\n').map((line, i) => {
              const diffCls =
                lang === 'diff'
                  ? line.startsWith('+')
                    ? ' diff-add'
                    : line.startsWith('-')
                      ? ' diff-del'
                      : ''
                  : ''
              return (
                <span key={i} className={`line${diffCls}`}>
                  {line}
                </span>
              )
            })}
          </code>
        </pre>
      )}
    </div>
  )
}
