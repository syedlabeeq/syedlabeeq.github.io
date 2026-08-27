import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { marked } from 'marked'
import type { Token, Tokens } from 'marked'
import CodeBlock from '@/components/CodeBlock'
import MermaidBlock from '@/components/MermaidBlock'
import FigureBlock from '@/components/FigureBlock'
import { slugifyHeading } from '@/lib/posts'
import { cn } from '@/lib/utils'

/**
 * Markdown — shared post renderer (docs/DESIGN.md §3/§6).
 * - headings → Space Grotesk scale with anchor ids matching extractHeadings()
 * - code fences → CodeBlock (```mermaid → MermaidBlock)
 * - images → FigureBlock with auto "Figure N —" numbering
 * - links / inline code / blockquotes (Newsreader italic) / tables / hr per
 *   the .post-prose styles in index.css
 */

export interface MarkdownProps {
  markdown: string
  className?: string
}

/* ---------------- inline tokens ---------------- */

function renderInline(tokens: Token[] | undefined, keyPrefix: string): ReactNode[] {
  if (!tokens) return []
  return tokens.map((token, i) => {
    const key = `${keyPrefix}-${i}`
    switch (token.type) {
      case 'text':
        return 'tokens' in token && token.tokens
          ? renderInline(token.tokens as Token[], key)
          : (token as Tokens.Text).text
      case 'strong':
        return (
          <strong key={key} className="font-semibold text-ink">
            {renderInline((token as Tokens.Strong).tokens, key)}
          </strong>
        )
      case 'em':
        return <em key={key}>{renderInline((token as Tokens.Em).tokens, key)}</em>
      case 'codespan':
        return (
          <code key={key} className="inline-code">
            {(token as Tokens.Codespan).text}
          </code>
        )
      case 'link': {
        const t = token as Tokens.Link
        const external = /^https?:\/\//.test(t.href)
        return (
          <a
            key={key}
            href={t.href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {renderInline(t.tokens, key)}
          </a>
        )
      }
      case 'image': {
        const t = token as Tokens.Image
        return (
          <img key={key} src={t.href} alt={t.text} className="inline max-w-full" loading="lazy" />
        )
      }
      case 'br':
        return <br key={key} />
      case 'del':
        return <del key={key}>{renderInline((token as Tokens.Del).tokens, key)}</del>
      case 'escape':
        return (token as Tokens.Escape).text
      case 'html':
        return (token as Tokens.HTML).text
      default:
        return 'raw' in token ? (token as { raw: string }).raw : null
    }
  })
}

/* ---------------- block renderer ---------------- */

function renderBlocks(tokens: Token[]): ReactNode[] {
  let fig = 0
  return tokens.map((token, i) => {
    const key = `b-${i}`
    switch (token.type) {
      case 'space':
        return null
      case 'heading': {
        const t = token as Tokens.Heading
        const id = slugifyHeading(t.text)
        if (t.depth <= 2) {
          return (
            <h2
              key={key}
              id={id}
              className="mb-3 mt-10 font-display text-h2-sm text-ink md:text-h2"
            >
              {renderInline(t.tokens, key)}
            </h2>
          )
        }
        if (t.depth === 3) {
          return (
            <h3
              key={key}
              id={id}
              className="mb-2 mt-8 font-display text-h3-sm text-ink md:text-h3"
            >
              {renderInline(t.tokens, key)}
            </h3>
          )
        }
        return (
          <h4 key={key} id={id} className="mb-2 mt-6 text-h4 text-ink">
            {renderInline(t.tokens, key)}
          </h4>
        )
      }
      case 'code': {
        const t = token as Tokens.Code
        const [lang, ...meta] = (t.lang ?? '').split(':')
        if (lang === 'mermaid') {
          return <MermaidBlock key={key} chart={t.text} />
        }
        return (
          <CodeBlock key={key} code={t.text} lang={lang} filename={meta.join(':') || undefined} />
        )
      }
      case 'paragraph': {
        const t = token as Tokens.Paragraph
        // a paragraph containing only an image becomes a FigureBlock
        if (t.tokens.length === 1 && t.tokens[0].type === 'image') {
          const img = t.tokens[0] as Tokens.Image
          fig += 1
          return (
            <FigureBlock key={key} src={img.href} alt={img.text} caption={img.text} figNumber={fig} />
          )
        }
        return (
          <p key={key} className="my-4 text-body-sm text-ink md:text-body" style={{ textWrap: 'pretty' }}>
            {renderInline(t.tokens, key)}
          </p>
        )
      }
      case 'list': {
        const t = token as Tokens.List
        const ListTag = t.ordered ? 'ol' : 'ul'
        return (
          <ListTag
            key={key}
            className={cn(
              'my-4 space-y-1.5 pl-6 text-body-sm text-ink marker:text-ink-muted md:text-body',
              t.ordered ? 'list-decimal' : 'list-disc',
            )}
          >
            {t.items.map((item, j) => (
              <li key={j} className="pl-1">
                {item.tokens.map((sub, k) =>
                  sub.type === 'text' && 'tokens' in sub && sub.tokens ? (
                    <span key={k}>{renderInline(sub.tokens as Token[], `${key}-${j}`)}</span>
                  ) : (
                    <span key={k}>{renderBlocks([sub])}</span>
                  ),
                )}
              </li>
            ))}
          </ListTag>
        )
      }
      case 'blockquote': {
        const t = token as Tokens.Blockquote
        return <blockquote key={key}>{renderBlocks(t.tokens)}</blockquote>
      }
      case 'table': {
        const t = token as Tokens.Table
        return (
          <div key={key} className="my-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="bg-bg-subtle">
                  {t.header.map((cell, j) => (
                    <th
                      key={j}
                      className="border-b border-border px-3 py-2 text-left font-semibold text-ink"
                    >
                      {renderInline(cell.tokens, `${key}-h${j}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, r) => (
                  <tr key={r} className={cn(r % 2 === 1 && 'bg-bg-subtle')}>
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className="border-b border-border px-3 py-2 align-top text-ink-secondary last:border-b-0"
                      >
                        {renderInline(cell.tokens, `${key}-${r}-${c}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      case 'hr':
        return <hr key={key} className="my-10 border-border" />
      case 'html':
        return null
      default:
        return 'tokens' in token ? (
          <div key={key}>{renderBlocks((token as { tokens: Token[] }).tokens)}</div>
        ) : 'raw' in token ? (
          <p key={key} className="my-4 text-body-sm text-ink md:text-body">
            {(token as { raw: string }).raw}
          </p>
        ) : null
    }
  })
}

export default function Markdown({ markdown, className }: MarkdownProps) {
  const tokens = useMemo(() => {
    const stripped = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    return marked.lexer(stripped)
  }, [markdown])

  return <div className={cn('post-prose', className)}>{renderBlocks(tokens)}</div>
}
