import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MembersList } from '@/components/members-list'
import type { Profile } from '@/lib/supabase/types'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: myProfile }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profiles').select('*').order('full_name', { ascending: true }),
  ])

  return (
    <MembersList
      profiles={(profiles ?? []) as Profile[]}
      currentUserId={user.id}
      isAdmin={myProfile?.role === 'admin'}
    />
  )
}
