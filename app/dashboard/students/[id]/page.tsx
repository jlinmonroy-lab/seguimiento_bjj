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

  if (myProfile?.role !== 'admin') redirect('/dashboard')
  if (!studentProfile) notFound()

  return (
    <ProfileView
      profile={studentProfile as Profile}
      userId={user.id}
      isOwnProfile={false}
      isAdmin={true}
    />
  )
}
