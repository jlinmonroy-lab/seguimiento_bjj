import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/bottom-nav'
import { LogoutButton } from '@/components/logout-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { BackButton } from '@/components/back-button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="fixed top-3 left-3 z-50">
        <BackButton />
      </div>
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton />
      </div>
      <main className="flex-1 pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
