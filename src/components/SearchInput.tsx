import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'

/**
 * SearchInput — docs/DESIGN.md §6.5.
 * Quiet rounded-lg input: bg-subtle, 1px border, 16px Search icon left,
 * placeholder "Search posts…". Focus: accent border + 2px accent-subtle
 * ring. Right-side <kbd>/</kbd> hint — pressing `/` anywhere focuses the
 * input; Esc blurs and clears.
 */

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search posts…',
  className,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onChange('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChange])

  return (
    <div className={className}>
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Search posts"
          className="w-full rounded-lg border border-border bg-bg-subtle py-2 pl-9 pr-10 text-[15px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-subtle"
        />
        <kbd aria-hidden="true" className="kbd absolute right-3 top-1/2 -translate-y-1/2">
          /
        </kbd>
      </div>
    </div>
  )
}
