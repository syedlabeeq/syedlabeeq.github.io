/**
 * Icon registry for `social[].type` in site.config.json.
 *
 * Add a row here to support a new kind of link — any icon from lucide-react
 * works, the JSON only ever holds the string key.
 */

import {
  AtSign,
  Github,
  Globe,
  Instagram,
   Linkedin,
   Phone,
  Mail,
  Rss,
  Send,
  Twitch,
  Twitter,
  Youtube,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  email: Mail,
  github: Github,
  linkedin: Linkedin,
  x: Twitter,
  twitter: Twitter,
  mastodon: AtSign,
  bluesky: AtSign,
  instagram: Instagram,
  youtube: Youtube,
  twitch: Twitch,
  telegram: Send,
   rss: Rss,
   phone: Phone,
  website: Globe,
}

/** Icon for a social link type, falling back to a globe for unknown types. */
export function iconFor(type: string): LucideIcon {
  return ICONS[type] ?? Globe
}
