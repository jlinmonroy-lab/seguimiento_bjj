'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
      aria-label={mounted ? (isDark ? 'Activar modo claro' : 'Activar modo oscuro') : 'Cambiar tema'}
      suppressHydrationWarning
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
