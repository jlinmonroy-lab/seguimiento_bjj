import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileView } from '@/components/profile-view'
import type { Profile } from '@/lib/supabase/types'

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: myProfile }, { data: studentProfile }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', id).single(),
  ])

  if (!studentProfile) notFound()

  const isAdmin = myProfile?.role === 'admin'

  let attendanceStats: { attended: number; absent: number } | undefined

  if (isAdmin && studentProfile.role === 'student') {
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', id)
      .in('status', ['attended', 'absent'])

    attendanceStats = {
      attended: attendance?.filter((item) => item.status === 'attended').length ?? 0,
      absent: attendance?.filter((item) => item.status === 'absent').length ?? 0,
    }
  }

  // Students can view other members' profiles in read-only mode
  // but cannot edit them — only admins can edit other profiles
  return (
    <ProfileView
      profile={studentProfile as Profile}
      userId={user.id}
      isOwnProfile={false}
      isAdmin={isAdmin}
      attendanceStats={attendanceStats}
    />
  )
}
