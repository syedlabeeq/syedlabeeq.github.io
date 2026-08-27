import { useCallback, useEffect, useState } from 'react'

/**
 * Theme — docs/DESIGN.md §2.4.
 * Class-based dual theme: `.dark` on <html>. Default = prefers-color-scheme,
 * choice persisted to localStorage["theme"] ("light" | "dark"). The no-flash
 * inline script in index.html applies the initial class before first paint;
 * this module owns runtime toggling, system-preference tracking, the
 * temporary `.theme-transition` class (200ms), and a `themechange` event
 * that MermaidBlock subscribes to for per-theme re-rendering.
 */

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

const STORAGE_KEY = 'theme'
const TRANSITION_MS = 250 // slightly over the 200ms css transition

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getStoredPreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** Apply a theme to <html>, briefly enabling the 200ms transition. */
export function applyTheme(theme: Theme, { transition = true }: { transition?: boolean } = {}) {
  const root = document.documentElement
  if (transition) root.classList.add('theme-transition')
  root.classList.toggle('dark', theme === 'dark')
  if (transition) {
    window.setTimeout(() => root.classList.remove('theme-transition'), TRANSITION_MS)
  }
  window.dispatchEvent(new CustomEvent<Theme>('themechange', { detail: theme }))
}

/** Toggle light/dark and persist the explicit choice. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage unavailable */
  }
  applyTheme(next)
  return next
}

/** React hook: current resolved theme + toggle + system-preference listener. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => getTheme())

  useEffect(() => {
    // The initial value already read the class set by the no-flash script in
    // index.html; from here we only react to changes.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => {
      // only follow the system when the user hasn't chosen explicitly
      if (getStoredPreference() === 'system') {
        applyTheme(systemTheme())
        setTheme(systemTheme())
      }
    }
    mq.addEventListener('change', onSystem)

    const onChange = (e: Event) => setTheme((e as CustomEvent<Theme>).detail)
    window.addEventListener('themechange', onChange)
    return () => {
      mq.removeEventListener('change', onSystem)
      window.removeEventListener('themechange', onChange)
    }
  }, [])

  const toggle = useCallback(() => setTheme(toggleTheme()), [])
  return { theme, toggle }
}
