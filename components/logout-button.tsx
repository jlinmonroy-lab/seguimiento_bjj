'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground disabled:opacity-60"
      aria-label="Cerrar sesión"
    >
      <LogOut size={16} />
      <span className="hidden sm:inline">{isPending ? 'Saliendo...' : 'Salir'}</span>
    </button>
  )
}
