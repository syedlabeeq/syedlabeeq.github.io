import type { HighlighterCore } from 'shiki/core'

/**
 * Shiki singleton — docs/DESIGN.md §2.3.
 * One custom theme ("blog-syntax") whose token colors are CSS variable
 * references (`var(--syn-*)`); the variables flip between the GitHub-light
 * and Monokai-flavored palettes via `.dark` in index.css, so a single
 * highlight pass renders correctly in both themes.
 *
 * The bundle and grammars are lazy-loaded on first use; only the languages
 * used by the posts are registered.
 */

/**
 * Grammars registered with the highlighter. They load together on the first
 * code block, so keep the list to the languages you actually write about —
 * and add one here (plus an alias below) when you need another. The full list
 * of ids lives at https://shiki.style/languages.
 */
const LANGUAGES = [
  () => import('shiki/langs/bash.mjs'),
  () => import('shiki/langs/shellsession.mjs'),
  () => import('shiki/langs/javascript.mjs'),
  () => import('shiki/langs/typescript.mjs'),
  () => import('shiki/langs/tsx.mjs'),
  () => import('shiki/langs/css.mjs'),
  () => import('shiki/langs/html.mjs'),
  () => import('shiki/langs/python.mjs'),
  () => import('shiki/langs/c.mjs'),
  () => import('shiki/langs/rust.mjs'),
  () => import('shiki/langs/go.mjs'),
  () => import('shiki/langs/sql.mjs'),
  () => import('shiki/langs/json.mjs'),
  () => import('shiki/langs/yaml.mjs'),
  () => import('shiki/langs/ini.mjs'),
  () => import('shiki/langs/makefile.mjs'),
  () => import('shiki/langs/markdown.mjs'),
  () => import('shiki/langs/diff.mjs'),
] as const

/** markdown fence label → registered shiki lang id (null = plaintext) */
const LANG_ALIASES: Record<string, string | null> = {
  '': null,
  text: null,
  plaintext: null,
  txt: null,
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'shellsession',
  'shell-session': 'shellsession',
  shellsession: 'shellsession',
  js: 'javascript',
  javascript: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'tsx',
  jsx: 'tsx',
  css: 'css',
  html: 'html',
  xml: 'html',
  svg: 'html',
  py: 'python',
  python: 'python',
  c: 'c',
  h: 'c',
  cpp: 'c',
  rs: 'rust',
  rust: 'rust',
  go: 'go',
  golang: 'go',
  sql: 'sql',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  toml: 'ini',
  make: 'makefile',
  makefile: 'makefile',
  md: 'markdown',
  markdown: 'markdown',
  diff: 'diff',
  patch: 'diff',
}

export function resolveLang(lang: string | undefined): string | null {
  const key = (lang ?? '').toLowerCase().trim()
  return key in LANG_ALIASES ? LANG_ALIASES[key] : null
}

const syntaxTheme = {
  name: 'blog-syntax',
  type: 'dark',
  colors: {
    'editor.background': 'transparent',
    'editor.foreground': 'var(--syn-base)',
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: 'var(--syn-comment)', fontStyle: 'italic' },
    },
    {
      scope: ['keyword', 'storage', 'storage.type', 'keyword.control', 'keyword.other'],
      settings: { foreground: 'var(--syn-keyword)' },
    },
    {
      scope: ['string', 'string.quoted', 'punctuation.definition.string'],
      settings: { foreground: 'var(--syn-string)' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call', 'variable.function'],
      settings: { foreground: 'var(--syn-function)' },
    },
    {
      scope: [
        'constant.numeric',
        'constant.language',
        'constant.other',
        'support.constant',
        'variable.other.constant',
        'entity.other.attribute-name',
        'constant.character',
      ],
      settings: { foreground: 'var(--syn-number)' },
    },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'support.type',
        'support.class',
        'entity.name.tag',
        'storage.type.cs',
        'entity.name.section',
      ],
      settings: { foreground: 'var(--syn-type)' },
    },
    {
      scope: ['keyword.operator'],
      settings: { foreground: 'var(--syn-operator)' },
    },
    {
      scope: ['punctuation', 'meta.brace', 'punctuation.separator'],
      settings: { foreground: 'var(--syn-punctuation)' },
    },
    {
      scope: ['markup.inserted'],
      settings: { foreground: 'var(--syn-function)' },
    },
    {
      scope: ['markup.deleted'],
      settings: { foreground: 'var(--syn-keyword)' },
    },
  ],
}

let highlighterPromise: Promise<HighlighterCore> | null = null

export function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
      ])
      return createHighlighterCore({
        themes: [syntaxTheme as never],
        langs: LANGUAGES.map((load) => load()),
        engine: createJavaScriptRegexEngine(),
      })
    })()
  }
  return highlighterPromise
}
