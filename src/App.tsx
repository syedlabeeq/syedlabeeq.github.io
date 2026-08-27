import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Blog from '@/pages/Blog'
import Post from '@/pages/Post'
import Contributions from '@/pages/Contributions'
import About from '@/pages/About'
import NotFound from '@/pages/NotFound'
import { site } from '@/config/site'

/**
 * App — BrowserRouter shell (children-pattern Layout).
 * Page enter per docs/DESIGN.md §5: opacity 0→1, y 10→0, 280ms, once per
 * navigation (opacity-only under prefers-reduced-motion).
 *
 * The /contributions route only exists when `features.contributions` is on in
 * site.config.json; otherwise the URL falls through to the 404 page.
 */
export default function App() {
  const location = useLocation()
  void useReducedMotion()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<Post />} />
            {site.features.contributions && (
              <Route path="/contributions" element={<Contributions />} />
            )}
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Layout>
  )
}
