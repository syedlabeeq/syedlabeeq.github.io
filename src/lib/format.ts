import { format, parseISO } from 'date-fns'

/** "03 Feb 2026" — the date format used across list rows and post headers. */
export function formatPostDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM yyyy')
  } catch {
    return iso
  }
}
