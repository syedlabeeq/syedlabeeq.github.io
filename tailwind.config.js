/**
 * "Paper & Slate" design system — docs/DESIGN.md §2–§4.
 * Colors map to CSS custom properties defined in src/index.css
 * (light theme on :root, dark theme on .dark — class-based).
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-subtle': 'var(--bg-subtle)',
        'bg-raised': 'var(--bg-raised)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
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
        selection: 'var(--selection)',
        merged: 'var(--state-merged)',
        published: 'var(--state-published)',
        severity: 'var(--state-severity)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      fontSize: {
        // docs/DESIGN.md §3 type scale (desktop / -sm = mobile)
        h1: ['40px', { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '700' }],
        'h1-sm': ['32px', { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '700' }],
        'post-title': ['36px', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '700' }],
        'post-title-sm': ['30px', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '700' }],
        h2: ['26px', { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '600' }],
        'h2-sm': ['22px', { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '1.35', letterSpacing: '-0.015em', fontWeight: '600' }],
        'h3-sm': ['19px', { lineHeight: '1.35', letterSpacing: '-0.015em', fontWeight: '600' }],
        h4: ['17px', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '600' }],
        lede: ['20px', { lineHeight: '1.6', fontWeight: '400' }],
        'lede-sm': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        body: ['17px', { lineHeight: '1.75', fontWeight: '400' }],
        'body-sm': ['16.5px', { lineHeight: '1.75', fontWeight: '400' }],
        'body-ui': ['15px', { lineHeight: '1.65', fontWeight: '400' }],
        'list-title': ['20px', { lineHeight: '1.35', letterSpacing: '-0.015em', fontWeight: '600' }],
        'list-title-sm': ['18px', { lineHeight: '1.35', letterSpacing: '-0.015em', fontWeight: '600' }],
        meta: ['13px', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '400' }],
        code: ['14px', { lineHeight: '1.7', fontWeight: '400' }],
        'code-sm': ['13.5px', { lineHeight: '1.7', fontWeight: '400' }],
        caption: ['13.5px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      maxWidth: {
        reading: '680px', // §3 measure — article body 68ch
        list: '768px', // §3 measure — list pages
      },
      boxShadow: {
        float: 'var(--shadow-float)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)', // §5 global easing
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
