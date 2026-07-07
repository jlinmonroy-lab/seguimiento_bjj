import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EventForm } from '@/components/event-form'

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { date } = await searchParams

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
      <EventForm userId={user.id} initialDate={date} />
    </div>
  )
}
