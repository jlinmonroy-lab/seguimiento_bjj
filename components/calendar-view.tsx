'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  formatTime,
  formatDate,
} from '@/lib/belt'
import type { CalendarItem, Profile, Attendance } from '@/lib/supabase/types'

interface CalendarViewProps {
  profile: Profile
  items: CalendarItem[]
  myAttendance: Attendance[]
}

const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

// Local-time date key "YYYY-MM-DD" — matches how the form saves dates
function localKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// Day-of-week (local time) adjusted so Monday = 0
function dayIndex(date: Date) {
  return (date.getDay() + 6) % 7
}

function groupByDate(items: CalendarItem[]) {
  const map = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const key = localKey(item.start_time)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

export function CalendarView({ profile, items, myAttendance }: CalendarViewProps) {
  const isAdmin = profile?.role === 'admin'
  const router = useRouter()
  const attendanceMap = new Map(myAttendance.map((a) => [a.calendar_item_id, a]))
  const [now] = useState(() => new Date())

  // Calendar navigation — use local time so month matches the user's clock
  const [viewYear, setViewYear] = useState(() => now.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => now.getMonth()) // 0-indexed

  // Selected day filter (null = show all events of the month)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const grouped = groupByDate(items)

  // Build the grid using local time so the grid aligns with the user's timezone
  const firstDay = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset = dayIndex(firstDay) // blanks before day 1

  const today = todayKey()

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedKey(null)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedKey(null)
  }

  function handleDayClick(key: string, hasEvents: boolean) {
    if (hasEvents) {
      // Toggle day filter
      setSelectedKey(prev => prev === key ? null : key)
    } else if (isAdmin) {
      // No events on this day — navigate to new event with date pre-filled
      router.push(`/dashboard/events/new?date=${key}`)
    }
  }

  // Events to show in the list below — always exclude past events
  const listItems: CalendarItem[] = (selectedKey
    ? (grouped.get(selectedKey) ?? [])
    : items.filter(i => {
        const d = new Date(i.start_time)
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth
      })
  )
    .filter(i => new Date(i.end_time) >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  // Group list items by day for display
  const listGrouped = groupByDate(listItems)
  const listDates = Array.from(listGrouped.keys()).sort()

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendario</h1>
        {isAdmin && (
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/events/new">Nueva clase</Link>
          </Button>
        )}
      </div>

      {/* Monthly calendar grid */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-5 shadow-sm">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} className="text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {MONTHS_ES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS_ES.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1 tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Leading blanks */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayItems = grouped.get(key) ?? []
            const hasEvents = dayItems.length > 0
            const isToday = key === today
            const isSelected = key === selectedKey

            // Up to 3 dots — one per event, color driven by gi_nogi then type
            const dotItems = dayItems.slice(0, 3)

            // Admins can click any day; non-admins can only click days with events
            const isClickable = hasEvents || isAdmin

            return (
              <button
                key={key}
                onClick={() => isClickable ? handleDayClick(key, hasEvents) : undefined}
                disabled={!isClickable}
                className={cn(
                  'flex flex-col items-center justify-center min-h-12 rounded-xl transition-colors py-2',
                  isClickable && 'cursor-pointer hover:bg-accent',
                  !isClickable && 'cursor-default',
                  isSelected && 'bg-foreground text-background hover:bg-foreground',
                  isToday && !isSelected && 'bg-accent',
                )}
                aria-label={
                  !hasEvents && isAdmin
                    ? `Crear evento el ${day} de ${MONTHS_ES[viewMonth]}`
                    : `${day} de ${MONTHS_ES[viewMonth]}`
                }
              >
                <span className={cn(
                  'text-base leading-none font-medium',
                  isSelected ? 'text-background' : isToday ? 'text-foreground font-bold' : 'text-foreground',
                  !hasEvents && !isAdmin && 'text-muted-foreground font-normal',
                  !hasEvents && isAdmin && 'text-foreground/60 font-normal',
                )}>
                  {day}
                </span>
                {/* Event dots */}
                <div className="flex gap-0.5 mt-1.5 h-2">
                  {dotItems.map((item, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'h-2 w-2 rounded-full',
                        isSelected ? 'bg-background' : dotColor(item.type, item.gi_nogi),
                      )}
                    />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day label or month label */}
      {selectedKey && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">
            {(() => {
              const s = formatDate(selectedKey + 'T00:00:00Z')
              return s.charAt(0).toUpperCase() + s.slice(1)
            })()}
          </span>
          <button
            onClick={() => setSelectedKey(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todo el mes
          </button>
        </div>
      )}

      {/* Event list */}
      {listItems.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-10">
          {selectedKey ? 'Sin eventos este día.' : 'Sin eventos este mes.'}
        </p>
      ) : (
        <div className="space-y-6">
          {listDates.map(dateKey => {
            const dayItems = listGrouped.get(dateKey)!
            const isToday = dateKey === today

            return (
              <div key={dateKey}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={cn(
                    'text-sm font-semibold',
                    isToday ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {isToday ? 'Hoy' : (() => {
                      const s = formatDate(dateKey + 'T00:00:00Z')
                      return s.charAt(0).toUpperCase() + s.slice(1)
                    })()}
                  </span>
                  {isToday && <span className="h-1.5 w-1.5 rounded-full bg-foreground inline-block" />}
                </div>

                <div className="space-y-2">
                  {dayItems.map(item => {
                    const attendance = attendanceMap.get(item.id)
                    const confirmed = attendance?.status === 'confirmed'
                    const cancelled = attendance?.status === 'cancelled'
                    const attended = attendance?.status === 'attended'
                    return (
                      <Link
                        key={item.id}
                        href={`/dashboard/events/${item.id}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
                      >
                        {/* Color accent bar */}
                        <span className={cn('w-1 self-stretch rounded-full shrink-0', accentBar(item.type))} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-card-foreground truncate">
                              {item.title}
                            </span>
                            <Badge className={cn('text-xs shrink-0 border-0', EVENT_TYPE_COLORS[item.type])}>
                              {EVENT_TYPE_LABELS[item.type]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatTime(item.start_time)} – {formatTime(item.end_time)}
                            {item.location ? ` · ${item.location}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {attended && <span className="text-xs font-medium text-green-600 dark:text-green-400">Asististe</span>}
                          {confirmed && !attended && <span className="text-xs font-medium text-foreground">Confirmado</span>}
                          {cancelled && <span className="text-xs text-muted-foreground">Cancelado</span>}
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
      )}
    </div>
  )
}

// Color dot per event — gi_nogi takes priority over type when set
function dotColor(type: string, giNogi?: string | null) {
  if (giNogi === 'nogi') return 'bg-pink-300'
  if (giNogi === 'gi')   return 'bg-sky-400'
  switch (type) {
    case 'graduation':  return 'bg-amber-500'
    case 'seminar':     return 'bg-blue-500'
    case 'competition': return 'bg-red-500'
    case 'open':        return 'bg-emerald-500'
    default:            return 'bg-foreground'
  }
}

// Left accent bar color per event type (shown in event list)
function accentBar(type: string) {
  switch (type) {
    case 'graduation':  return 'bg-amber-400'
    case 'seminar':     return 'bg-blue-400'
    case 'competition': return 'bg-red-400'
    case 'open':        return 'bg-emerald-400'
    default:            return 'bg-muted-foreground'
  }
}
