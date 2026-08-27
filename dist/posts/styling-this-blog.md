---
id: 2
slug: styling-this-blog
title: Styling this blog — tokens, type, and the two themes
excerpt: Every color, size and easing curve in this template resolves through a CSS custom property. Change the tokens and the whole site follows, in both light and dark.
date: 2026-01-20
readingTime: 7
tags: ["Meta", "Design", "CSS"]
---

The design system here has one rule: no component names a raw color. Everything
goes through a CSS custom property, defined once for light and once for dark, and
mapped into Tailwind so you write `text-ink-muted` instead of `text-[#6b7280]`.

That's what makes this template re-skinnable. You can change the palette
without opening a single component.

## The token layer

`src/index.css` defines the light theme on `:root` and the dark theme on
`.dark`. Same names, different values:

```css
:root {
  --bg: #ffffff;
  --bg-subtle: #f6f7f9;
  --border: #e4e6ea;
  --ink: #0b0d12;
  --ink-secondary: #4b5563;
  --ink-muted: #6b7280;
  --accent: #2f56cf;
}

.dark {
  --bg: #141518;
  --bg-subtle: #1b1c20;
  --border: #26282d;
  --ink: #e8eaed;
  --ink-secondary: #a9b4bb;
  --ink-muted: #7d8890;
  --accent: #7aa2f7;
}
```

`tailwind.config.js` maps those to utility classes:

```js
colors: {
  bg: 'var(--bg)',
  'bg-subtle': 'var(--bg-subtle)',
  ink: {
    DEFAULT: 'var(--ink)',
    secondary: 'var(--ink-secondary)',
    muted: 'var(--ink-muted)',
  },
  accent: {
    DEFAULT: 'var(--accent)',
    hover: 'var(--accent-hover)',
    subtle: 'var(--accent-subtle)',
  },
}
```

So `bg-bg-subtle`, `text-ink-muted` and `border-border` all work, and all of
them flip when the theme does.

### Recoloring the whole site

Change `--accent` (and its `--accent-hover` / `--accent-subtle` companions) in
both blocks. That's the link color, the nav underline, the reading-progress
bar, the focus ring and the bullet on the about page — one variable, six
places.

Two rules worth keeping:

1. **Set both themes.** A token defined only under `:root` will look wrong in
   dark mode, not fall back gracefully.
2. **Check contrast.** `--ink-muted` on `--bg-subtle` is the tightest pair in
   the system; keep it at 4.5:1 or better.

## Type

Four families, each with a job:

| Family | Used for | Tailwind |
| --- | --- | --- |
| Space Grotesk | headings, wordmark | `font-display` |
| Inter | body and UI text | `font-sans` |
| Newsreader (italic) | ledes, pull quotes | `font-serif` |
| JetBrains Mono | code, metadata, timestamps | `font-mono` |

The scale is named rather than numeric — `text-h1`, `text-post-title`,
`text-lede`, `text-body`, `text-meta` — with a `-sm` variant of each for
mobile. That means a heading is written once:

```jsx
<h1 className="font-display text-h1-sm text-ink sm:text-h1">
```

To change the fonts: swap the Google Fonts link in `index.html`, then update
`fontFamily` in `tailwind.config.js` and the `font-family` on `body` in
`src/index.css`. Three files, and they must agree.

## Measure and rhythm

Article bodies are capped at `max-w-reading` (680px, about 68 characters) and
list pages at `max-w-list`. Sections are separated by hairlines — a 1px border
in `--border` via the `.hairline-t` / `.hairline-b` utilities — not by cards or
shadows. The only shadow in the system is `--shadow-float`, used on the mobile
nav panel and the image lightbox.

## Motion

One easing curve, `cubic-bezier(0.22, 1, 0.36, 1)`, exposed as
`ease-out-expo`. Durations sit between 150ms and 300ms. Page transitions fade
and rise 10px; list items stagger by 35–55ms.

Everything collapses under `prefers-reduced-motion`, both in CSS and in the
components, which read framer-motion's `useReducedMotion()` and drop the
`y` offsets:

```jsx
const reduce = useReducedMotion()
const variants = {
  hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } },
}
```

If you add animation, follow the same pattern. It's the difference between a
site that feels calm and one that makes people motion-sick.

## Syntax highlighting

Code blocks are highlighted by [shiki](https://shiki.style) using a custom
theme whose token colors are *also* CSS variables (`--syn-keyword`,
`--syn-string`, `--syn-comment`, …). That's why code recolors instantly when
you toggle the theme instead of needing a re-render — the highlighter emits
`var(--syn-*)` references, and the browser resolves them.

The full token list is in `docs/DESIGN.md`.
