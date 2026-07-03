'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Clock, Check, X } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { UserAvatar } from '@/components/user-avatar'
import { BeltBadge } from '@/components/belt-badge'
import { createClient } from '@/lib/supabase/client'
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  formatDateFull,
  formatTime,
} from '@/lib/belt'
import { cn } from '@/lib/utils'
import type { CalendarItem, Profile, AttendanceWithProfile, Attendance } from '@/lib/supabase/types'

interface EventDetailProps {
  event: CalendarItem
  profile: Profile
  attendanceList: AttendanceWithProfile[]
  myAttendance: Attendance | null
  userId: string
}

export function EventDetail({ event, profile, attendanceList, myAttendance, userId }: EventDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState(myAttendance?.status ?? null)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin'
  const isPast = new Date(event.end_time) < new Date()

  const confirmed = attendanceList.filter((a) => ['confirmed', 'attended'].includes(a.status))

  async function handleAttendance(action: 'confirm' | 'cancel') {
    setError(null)
    startTransition(async () => {
      const supabase = createClient()

      if (action === 'confirm') {
        if (myAttendance) {
          const { error } = await supabase
            .from('attendance')
            .update({ status: 'confirmed' })
            .eq('id', myAttendance.id)
          if (error) { setError('Error al confirmar'); return }
        } else {
          const { error } = await supabase
            .from('attendance')
            .insert({ calendar_item_id: event.id, student_id: userId, status: 'confirmed' })
          if (error) { setError('Error al confirmar'); return }
        }
        setStatus('confirmed')
      } else {
        if (myAttendance) {
          const { error } = await supabase
            .from('attendance')
            .update({ status: 'cancelled' })
            .eq('id', myAttendance.id)
          if (error) { setError('Error al cancelar'); return }
        }
        setStatus('cancelled')
      }

      router.refresh()
    })
  }

  async function handleVerify(attendanceId: string, attended: boolean) {
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('attendance')
        .update({
          status: attended ? 'attended' : 'absent',
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .eq('id', attendanceId)
      if (error) { setError('Error al verificar'); return }
      router.refresh()
    })
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        Calendario
      </Link>

      {/* Header */}
      <div className="space-y-2 mb-6">
        <Badge className={cn('border-0 text-xs', EVENT_TYPE_COLORS[event.type])}>
          {EVENT_TYPE_LABELS[event.type]}
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{event.title}</h1>

        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock size={14} />
            <span className="capitalize">{formatDateFull(event.start_time)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="opacity-0" aria-hidden />
            <span>
              {formatTime(event.start_time)} – {formatTime(event.end_time)}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin size={14} />
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{event.description}</p>
        )}
      </div>

      <Separator className="mb-6" />

      {/* Attendance action (students only, not past) */}
      {!isAdmin && !isPast && (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-foreground">Tu asistencia</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={status === 'confirmed' ? 'default' : 'outline'}
              onClick={() => handleAttendance('confirm')}
              disabled={isPending}
              className="flex-1"
            >
              <Check size={15} className="mr-1.5" />
              Confirmar
            </Button>
            <Button
              size="sm"
              variant={status === 'cancelled' ? 'destructive' : 'outline'}
              onClick={() => handleAttendance('cancel')}
              disabled={isPending || !myAttendance}
              className="flex-1"
            >
              <X size={15} className="mr-1.5" />
              Cancelar
            </Button>
          </div>
          {status === 'confirmed' && (
            <p className="text-xs text-muted-foreground">Has confirmado tu asistencia.</p>
          )}
          {status === 'cancelled' && (
            <p className="text-xs text-muted-foreground">Has cancelado tu asistencia.</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {/* Admin event controls */}
      {isAdmin && (
        <div className="mb-6 flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/events/${event.id}/edit`}>Editar evento</Link>
          </Button>
        </div>
      )}

      <Separator className="mb-6" />

      {/* Attendees */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Asistentes confirmados
          </h2>
          <span className="text-xs text-muted-foreground">
            {confirmed.length}
          </span>
        </div>

        {confirmed.length === 0 && (
          <p className="text-sm text-muted-foreground">Nadie ha confirmado todavía.</p>
        )}

        <ul className="space-y-2">
          {confirmed.map((a) => {
            const p = a.profiles
            const profileHref = a.student_id === userId
              ? '/dashboard/profile'
              : `/dashboard/students/${a.student_id}`
            return (
              <li key={a.id} className="flex items-center gap-3">
                <Link href={profileHref} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <UserAvatar name={p?.full_name ?? null} avatarUrl={p?.avatar_url ?? null} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground font-medium truncate block">
                      {p?.full_name ?? 'Alumno'}
                    </span>
                    {p && (
                      <BeltBadge color={p.belt_color} stripes={p.belt_stripes} className="mt-0.5" />
                    )}
                  </div>
                </Link>

                {/* Admin verification */}
                {isAdmin && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleVerify(a.id, true)}
                      disabled={isPending}
                      title="Marcar como asistido"
                      className={cn(
                        'rounded-full p-1.5 transition-colors',
                        a.status === 'attended'
                          ? 'bg-green-600 text-white'
                          : 'bg-secondary text-secondary-foreground hover:bg-green-100 dark:hover:bg-green-900/30',
                      )}
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => handleVerify(a.id, false)}
                      disabled={isPending}
                      title="Marcar como ausente"
                      className={cn(
                        'rounded-full p-1.5 transition-colors',
                        a.status === 'absent'
                          ? 'bg-destructive text-white'
                          : 'bg-secondary text-secondary-foreground hover:bg-red-100 dark:hover:bg-red-900/30',
                      )}
                    >
                      <X size={13} />
                    </button>

                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
