# The "Paper & Slate" design system

This is the reference the code comments point at (`docs/DESIGN.md §2.3`, and so
on). It describes what the template looks like and, more usefully, *where to
change it*.

The whole system rests on one rule:

> No component ever names a raw color, font or duration. Everything resolves
> through a CSS custom property in `src/index.css`, mapped into Tailwind in
> `tailwind.config.js`.

That's what makes the template re-skinnable — and what you'd break by writing
`text-[#1f2937]` in a component.

---

## §1 Principles

1. **Text first.** The reading column is the design. Chrome is hairlines and
   whitespace, not cards and shadows.
2. **Two themes, one set of names.** Every token exists in both light and dark.
   A token defined in only one place is a bug.
3. **Motion is punctuation.** 150–300ms, one easing curve, and nothing that
   moves without a reason. All of it collapses under `prefers-reduced-motion`.
4. **Nothing loads that isn't used.** Mermaid, shiki grammars and post bodies
   are all fetched on demand.

---

## §2 Color

### §2.1 Light theme — "Paper"

Defined on `:root` in `src/index.css`.

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#ffffff` | page background |
| `--bg-subtle` | `#f6f7f9` | inline code, table stripes, hover fills |
| `--bg-raised` | `#ffffff` | mobile nav panel, lightbox surfaces |
| `--border` | `#e4e6ea` | hairlines, most borders |
| `--border-strong` | `#cfd3d9` | blockquote rule, kbd, hover borders |
| `--ink` | `#0b0d12` | body text, headings |
| `--ink-secondary` | `#4b5563` | excerpts, standfirsts, inactive nav |
| `--ink-muted` | `#6b7280` | metadata, captions, timestamps |
| `--accent` | `#2f56cf` | links, nav underline, focus ring, progress bar |
| `--accent-hover` | `#2445a8` | link hover |
| `--accent-subtle` | `#eef2fd` | accent-tinted fills |
| `--selection` | `#dbe4fb` | `::selection` |
| `--state-merged` / `--state-published` / `--state-severity` | purple / green / red | contribution states |
| `--shadow-float` | `0 8px 30px rgba(0,0,0,.08)` | the one shadow in the system |

### §2.2 Dark theme — "Slate"

The same names under `.dark`, set on `<html>`. Not an inversion — a separate
palette: `--bg: #141518`, `--ink: #e8eaed`, `--accent: #7aa2f7`, and a softer
shadow. If you change one theme, change both.

### §2.3 Syntax colors

Code is highlighted by [shiki](https://shiki.style) with a custom theme
(`src/lib/highlight.ts`) whose token colors are *themselves* CSS variables:

```
--syn-surface  --syn-base      --syn-keyword   --syn-string
--syn-function --syn-number    --syn-type      --syn-operator
--syn-comment  --syn-punctuation
--syn-added-bg --syn-removed-bg   (diff line backgrounds)
```

Because the highlighter emits `var(--syn-*)` rather than hex, code recolors the
instant the theme flips — no re-highlighting pass. Light is GitHub-flavored,
dark is Monokai-flavored; swap the values and every code block follows.

### §2.4 Theme switching

`src/lib/theme.ts` owns it. An inline script in `index.html` sets `.dark`
before first paint (no flash). The toggle persists `light`/`dark` to
`localStorage["theme"]`; with nothing stored the site follows
`prefers-color-scheme` and keeps following it. During a toggle, a temporary
`.theme-transition` class enables a 200ms color transition on everything, then
removes itself. A `themechange` event fires so components that render to a
canvas or SVG — mermaid diagrams — can redraw.

---

## §3 Typography

Four families, each with one job:

| Family | Tailwind | Job |
| --- | --- | --- |
| Space Grotesk 500/700 | `font-display` | headings, wordmark |
| Inter 400/500/600 | `font-sans` | body and UI |
| Newsreader italic | `font-serif` | ledes, standfirsts, blockquotes |
| JetBrains Mono 400/500 | `font-mono` | code, metadata, timestamps |

The scale is named, not numeric — each name carries size, line-height, tracking
and weight, and each has a `-sm` mobile variant:

`text-h1` · `text-post-title` · `text-h2` · `text-h3` · `text-h4` ·
`text-lede` · `text-body` · `text-body-ui` · `text-list-title` · `text-meta` ·
`text-code` · `text-caption`

So a page heading is `font-display text-h1-sm text-ink sm:text-h1`, everywhere.

**Measure.** Article bodies are capped at `max-w-reading` (680px ≈ 68
characters); list pages at `max-w-list` (768px). Don't widen them — the
line-height is tuned for that measure.

**Links.** In prose: accent-colored with a 1px underline at 40% opacity,
3px offset, thickening on hover. In UI: the `.ui-link` utility grows an
underline in from the left over 200ms.

**To change the fonts** you must edit three files, and they have to agree: the
Google Fonts `<link>` in `index.html`, `fontFamily` in `tailwind.config.js`,
and the `body { font-family }` rule in `src/index.css`.

---

## §4 Layout

- Page shells: `max-w-3xl` for reading pages, `max-w-6xl` for the post page
  (article + TOC rail), horizontal padding `px-5` / `sm:px-6`.
- Sections are separated by **hairlines** — `.hairline-t` / `.hairline-b`,
  a 1px `--border` rule — with `py-8` to `py-10` around them. No cards.
- The post page becomes a two-column grid at ≥1100px:
  `[minmax(0,680px) 240px]` with an 80px gap, centered so the measure stays
  optically centered next to the sticky TOC. Below that width the TOC collapses
  into an inline disclosure.
- The header is 64px, sticky, with a 12px backdrop blur over 82%-opaque
  background. Heading anchors carry `scroll-margin-top: 88px` so deep links
  clear it.

---

## §5 Motion

One curve: `cubic-bezier(0.22, 1, 0.36, 1)`, exposed as `ease-out-expo`.
Durations 150–300ms. The vocabulary:

| Pattern | Spec |
| --- | --- |
| Page enter | opacity 0→1, y 10→0, 280ms |
| List stagger | 35–55ms between items, y 8–12px |
| Hover | color 150ms; arrows translate 3px over 200ms |
| Theme toggle | icon rotates 90° and scales, 250ms |
| Reading progress | scaleX bound to scroll, no easing |

Under `prefers-reduced-motion: reduce`, CSS collapses all durations to 0.01ms
*and* components read framer-motion's `useReducedMotion()` to drop `y` offsets
entirely — fades only. Follow both halves when you add animation.

---

## §6 Components

Where each piece of the UI lives.

| § | Component | File | Notes |
| --- | --- | --- | --- |
| 6.1 | Navbar | `src/components/Navbar.tsx` | sticky, blurred; animated `layoutId` underline; mobile panel |
| 6.2 | Footer | `src/components/Footer.tsx` | wordmark, tagline, socials, back-to-top after 600px |
| 6.3 | TagChip | `src/components/TagChip.tsx` | pill; `filter` variant used by the archive |
| 6.4 | PostListItem | `src/components/PostListItem.tsx` | date rail, title, excerpt, tags, reading time |
| 6.5 | SearchInput | `src/components/SearchInput.tsx` | `/` to focus, Escape to clear |
| 6.6 | CodeBlock | `src/components/CodeBlock.tsx` | shiki, language label, optional filename, copy button, diff lines |
| 6.7 | FigureBlock | `src/components/FigureBlock.tsx` | auto "Figure N", caption, click-to-zoom |
| 6.8 | MermaidBlock | `src/components/MermaidBlock.tsx` | lazy mermaid, re-renders on `themechange`, zoomable |
| 6.9 | ContributionItem | `src/components/ContributionItem.tsx` | repo, state dot, summary; condensed variant for the home strip |
| 6.10 | Toc | `src/components/Toc.tsx` | sticky rail, scroll-spy, inline disclosure below 1100px |
| 6.11 | kbd | `.kbd` in `src/index.css` | keyboard hints |

The markdown renderer (`src/components/Markdown.tsx`) is what wires these
together: it walks marked's token stream and maps each block type to one of the
components above. Add a `case` there to support something new.

---

## Recipes

**Change the accent color.** Edit `--accent`, `--accent-hover`,
`--accent-subtle` and `--selection` in both `:root` and `.dark`. That covers
links, the nav underline, the reading-progress bar, focus rings and the About
page bullets.

**Go warmer/cooler overall.** The neutrals are `--bg`, `--bg-subtle`,
`--bg-raised`, `--border`, `--border-strong`, `--ink`, `--ink-secondary`,
`--ink-muted`. Shift their hue together, in both themes, and keep
`--ink-muted` on `--bg-subtle` at 4.5:1 or better.

**Tighter or looser type.** The scale is one object in `tailwind.config.js`
(`theme.extend.fontSize`). Changing `body`/`body-sm` there changes every
paragraph in every post.

**A different code theme.** Either change the `--syn-*` values, or replace
`syntaxTheme` in `src/lib/highlight.ts` with any bundled shiki theme — you'll
lose the instant theme flip, so you'd load one theme per mode instead.

**A new language for code blocks.** Add a `() => import('shiki/langs/<id>.mjs')`
entry to `LANGUAGES` and a fence alias to `LANG_ALIASES`, both in
`src/lib/highlight.ts`.
