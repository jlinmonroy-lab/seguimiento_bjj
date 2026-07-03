'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// Keeps a history stack in sessionStorage so back() works reliably inside iframes
// and in cases where window.history has no previous entry.
const STORAGE_KEY = 'v0_nav_history'

function getHistory(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function setHistory(h: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h))
  } catch {}
}

export function BackButton() {
  const router = useRouter()
  const pathname = usePathname()
  const prevPathname = useRef<string | null>(null)

  // Push current path into history whenever pathname changes
  useEffect(() => {
    if (prevPathname.current && prevPathname.current !== pathname) {
      const h = getHistory()
      // Avoid duplicates at the top of the stack
      if (h[h.length - 1] !== prevPathname.current) {
        h.push(prevPathname.current)
        // Keep stack bounded
        if (h.length > 20) h.shift()
        setHistory(h)
      }
    }
    prevPathname.current = pathname
  }, [pathname])

  function handleBack() {
    const h = getHistory()
    if (h.length > 0) {
      const prev = h[h.length - 1]
      setHistory(h.slice(0, -1))
      router.push(prev)
    } else {
      // Fallback to browser history
      router.back()
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
      aria-label="Volver atrás"
    >
      <ArrowLeft size={18} />
    </button>
  )
}
