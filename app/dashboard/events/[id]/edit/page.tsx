import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EventForm } from '@/components/event-form'
import type { CalendarItem } from '@/lib/supabase/types'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: event }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('calendar_items').select('*').eq('id', id).single(),
  ])

  if (profile?.role !== 'admin') redirect('/dashboard')
  if (!event) notFound()

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
      <EventForm userId={user.id} event={event as CalendarItem} />
    </div>
  )
}
