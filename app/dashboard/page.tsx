import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/calendar-view'
import type { CalendarItem, Profile, Attendance } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: items }, { data: myAttendance }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('calendar_items')
      .select('*')
      .order('start_time', { ascending: true }),
    supabase
      .from('attendance')
      .select('*')
      .eq('student_id', user.id),
  ])

  return (
    <CalendarView
      profile={profile as Profile}
      items={(items ?? []) as CalendarItem[]}
      myAttendance={(myAttendance ?? []) as Attendance[]}
    />
  )
}
