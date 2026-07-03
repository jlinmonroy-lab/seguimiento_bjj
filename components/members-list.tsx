'use client'

import Link from 'next/link'
import { UserAvatar } from '@/components/user-avatar'
import { BeltBadge } from '@/components/belt-badge'
import type { Profile } from '@/lib/supabase/types'

interface MembersListProps {
  profiles: Profile[]
  currentUserId: string
  isAdmin: boolean
}

export function MembersList({ profiles, currentUserId, isAdmin }: MembersListProps) {
  // Master (admin) first, then students alphabetically
  const sorted = [...profiles].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1
    if (a.role !== 'admin' && b.role === 'admin') return 1
    return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'es')
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Miembros</h1>

      <ul className="space-y-2">
        {sorted.map((member) => {
          const isOwn = member.id === currentUserId
          const canView = isOwn || isAdmin
          const href = isOwn
            ? '/dashboard/profile'
            : `/dashboard/students/${member.id}`

          const inner = (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/40">
              <UserAvatar
                avatarUrl={member.avatar_url}
                name={member.full_name}
                className="h-11 w-11 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {member.full_name ?? 'Sin nombre'}
                  </span>
                  {member.role === 'admin' && (
                    <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                      Maestro
                    </span>
                  )}
                </div>
                {member.belt_color && (
                  <div className="mt-1">
                    <BeltBadge color={member.belt_color} stripes={member.belt_stripes ?? 0} />
                  </div>
                )}
              </div>
            </div>
          )

          return (
            <li key={member.id}>
              {canView ? (
                <Link href={href} className="block">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
