import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BatchEventManager } from '@/components/batch-event-manager'
import type { CalendarItem } from '@/lib/supabase/types'

export default async function BatchEditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: items } = await supabase
    .from('calendar_items')
    .select('*')
    .order('start_time', { ascending: true })

  return (
    <main className="flex-1 pb-20">
      <BatchEventManager items={(items ?? []) as CalendarItem[]} />
    </main>
  )
}
