import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EventDetail } from '@/components/event-detail'
import type { CalendarItem, Profile, AttendanceWithProfile } from '@/lib/supabase/types'

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: event }, { data: profile }, { data: attendance }] = await Promise.all([
    supabase.from('calendar_items').select('*').eq('id', id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('attendance')
      .select('*, profiles(id, full_name, avatar_url, belt_color, belt_stripes)')
      .eq('calendar_item_id', id),
  ])

  if (!event) notFound()

  const myAttendance = attendance?.find((a) => a.student_id === user.id) ?? null

  return (
    <EventDetail
      event={event as CalendarItem}
      profile={profile as Profile}
      attendanceList={(attendance ?? []) as AttendanceWithProfile[]}
      myAttendance={myAttendance}
      userId={user.id}
    />
  )
}
