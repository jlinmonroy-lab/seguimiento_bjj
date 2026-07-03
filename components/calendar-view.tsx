'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  formatTime,
  formatDate,
  formatDateShort,
} from '@/lib/belt'
import type { CalendarItem, Profile, Attendance } from '@/lib/supabase/types'

interface CalendarViewProps {
  profile: Profile
  items: CalendarItem[]
  myAttendance: Attendance[]
}

// Use a UTC-based date key so server and client produce the same string
function utcDateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function todayUtcKey() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function groupByDate(items: CalendarItem[]) {
  const map = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const key = utcDateKey(item.start_time)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

export function CalendarView({ profile, items, myAttendance }: CalendarViewProps) {
  const isAdmin = profile?.role === 'admin'
  const attendanceMap = new Map(myAttendance.map((a) => [a.calendar_item_id, a]))

  // Split into upcoming and past
  const now = new Date()
  const upcoming = items.filter((i) => new Date(i.end_time) >= now)
  const past = items.filter((i) => new Date(i.end_time) < now)

  const [showPast, setShowPast] = useState(false)
  const displayed = showPast ? [...upcoming, ...past] : upcoming

  const grouped = groupByDate(displayed)
  const sortedDates = Array.from(grouped.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  )

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendario</h1>
        {isAdmin && (
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/events/new">
              <Plus size={16} className="mr-1" />
              Nueva clase
            </Link>
          </Button>
        )}
      </div>

      {displayed.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-12">
          No hay clases ni eventos próximos.
        </p>
      )}

      <div className="space-y-6">
        {sortedDates.map((dateKey) => {
          const dayItems = grouped.get(dateKey)!
          const dateObj = new Date(dateKey)
          const isToday = todayUtcKey() === dateKey

          return (
            <div key={dateKey}>
              <div className="flex items-baseline gap-2 mb-2">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isToday ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {isToday
                    ? 'Hoy'
                    : (() => {
                        const s = formatDate(dateObj.toISOString())
                        return s.charAt(0).toUpperCase() + s.slice(1)
                      })()}
                </span>
                {isToday && (
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground inline-block" />
                )}
              </div>

              <div className="space-y-2">
                {dayItems.map((item) => {
                  const attendance = attendanceMap.get(item.id)
                  const confirmed = attendance?.status === 'confirmed'
                  const cancelled = attendance?.status === 'cancelled'
                  const attended = attendance?.status === 'attended'
                  const isPast = new Date(item.end_time) < now

                  return (
                    <Link
                      key={item.id}
                      href={`/dashboard/events/${item.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent',
                        isPast && 'opacity-60',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-card-foreground truncate">
                            {item.title}
                          </span>
                          <Badge
                            className={cn(
                              'text-xs shrink-0 border-0',
                              EVENT_TYPE_COLORS[item.type],
                            )}
                          >
                            {EVENT_TYPE_LABELS[item.type]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTime(item.start_time)} – {formatTime(item.end_time)}
                          {item.location ? ` · ${item.location}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {attended && (
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">Asististe</span>
                        )}
                        {confirmed && !attended && (
                          <span className="text-xs font-medium text-foreground">Confirmado</span>
                        )}
                        {cancelled && (
                          <span className="text-xs text-muted-foreground">Cancelado</span>
                        )}
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {past.length > 0 && (
        <button
          onClick={() => setShowPast((v) => !v)}
          className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPast ? 'Ocultar pasados' : `Ver ${past.length} evento${past.length !== 1 ? 's' : ''} pasado${past.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}
