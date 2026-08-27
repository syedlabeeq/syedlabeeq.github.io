import type { ReactNode } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/**
 * Layout — children pattern (App wraps <Layout><Routes/></Layout>).
 * Navbar (sticky) + <main> + Footer. The nav is sticky in normal flow, so
 * pages need no offset bookkeeping.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg text-ink">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
