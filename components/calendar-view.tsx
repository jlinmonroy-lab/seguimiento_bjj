'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'

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

const WEEKDAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function CalendarView({ profile, items, myAttendance }: CalendarViewProps) {
  const isAdmin = profile?.role === 'admin'
  const router = useRouter()
  const attendanceMap = new Map(myAttendance.map((a) => [a.calendar_item_id, a]))
  const [now] = useState(() => new Date())
  const [showPast, setShowPast] = useState(false)

  // Batch attendance state (students only)
  const [showBatchPanel, setShowBatchPanel] = useState(false)
  const [batchDays, setBatchDays] = useState<number[]>([]) // 0=Mon…6=Sun
  const [batchYear, setBatchYear] = useState(() => now.getFullYear())
  const [batchMonth, setBatchMonth] = useState(() => now.getMonth())
  const [batchResult, setBatchResult] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Events the student could batch-confirm: upcoming, matching chosen days/month, not yet confirmed/attended
  const batchCandidates = batchDays.length === 0 ? [] : items.filter(i => {
    const d = new Date(i.start_time)
    if (d < now) return false
    if (d.getFullYear() !== batchYear || d.getMonth() !== batchMonth) return false
    const dow = (d.getDay() + 6) % 7 // Mon=0
    if (!batchDays.includes(dow)) return false
    const att = attendanceMap.get(i.id)
    return !att || (att.status !== 'confirmed' && att.status !== 'attended')
  })

  async function handleBatchConfirm() {
    if (batchCandidates.length === 0) return
    startTransition(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const rows = batchCandidates.map(i => ({
        calendar_item_id: i.id,
        student_id: user.id,
        status: 'confirmed' as const,
      }))

      const { error } = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'calendar_item_id,student_id' })

      if (error) {
        setBatchResult(`Error: ${error.message}`)
      } else {
        setBatchResult(`Asistencia confirmada en ${rows.length} clase${rows.length !== 1 ? 's' : ''}.`)
        router.refresh()
      }
    })
  }

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

  // Events to show in the list below — exclude past events (admins can see them separately)
  const monthItems = selectedKey
    ? (grouped.get(selectedKey) ?? [])
    : items.filter(i => {
        const d = new Date(i.start_time)
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth
      })

  const listItems: CalendarItem[] = monthItems
    // When a specific day is selected, show all its events (including past ones)
    // When browsing the month, only show upcoming events
    .filter(i => selectedKey ? true : new Date(i.end_time) >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    // When browsing the month (no day selected), only show the next 3 upcoming classes
    .slice(0, selectedKey ? undefined : 3)

  // Past events for admin — all past events across all months, newest first
  const pastItems: CalendarItem[] = isAdmin
    ? items
        .filter(i => new Date(i.end_time) < now)
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    : []

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

      {/* Batch attendance — students only */}
      {!isAdmin && (
        <div className="mb-5">
          {!showBatchPanel ? (
            <button
              onClick={() => { setShowBatchPanel(true); setBatchResult(null) }}
              className="flex items-center gap-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <CalendarCheck size={16} className="text-muted-foreground" />
              Confirmar asistencia por lote
            </button>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Confirmar asistencia por lote</span>
                <button
                  onClick={() => { setShowBatchPanel(false); setBatchDays([]); setBatchResult(null) }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cerrar
                </button>
              </div>

              {/* Day-of-week selector */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Días de la semana</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS_ES.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBatchDays(prev =>
                        prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                      )}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        batchDays.includes(idx)
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-background text-foreground border-border hover:bg-accent',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month selector */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Mes</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (batchMonth === 0) { setBatchYear(y => y - 1); setBatchMonth(11) }
                      else setBatchMonth(m => m - 1)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent transition-colors"
                  >
                    <ChevronLeft size={15} className="text-muted-foreground" />
                  </button>
                  <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
                    {MONTHS_ES[batchMonth]} {batchYear}
                  </span>
                  <button
                    onClick={() => {
                      if (batchMonth === 11) { setBatchYear(y => y + 1); setBatchMonth(0) }
                      else setBatchMonth(m => m + 1)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent transition-colors"
                  >
                    <ChevronRight size={15} className="text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Preview */}
              {batchDays.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {batchCandidates.length === 0
                    ? 'No hay clases pendientes de confirmar para esos días.'
                    : `Se confirmarán ${batchCandidates.length} clase${batchCandidates.length !== 1 ? 's' : ''}.`}
                </p>
              )}

              {batchResult && (
                <p className={cn(
                  'text-xs font-medium',
                  batchResult.startsWith('Error') ? 'text-destructive' : 'text-green-600 dark:text-green-400',
                )}>
                  {batchResult}
                </p>
              )}

              <Button
                onClick={handleBatchConfirm}
                disabled={isPending || batchCandidates.length === 0}
                size="sm"
                className="w-full"
              >
                {isPending
                  ? 'Confirmando...'
                  : batchCandidates.length > 0
                  ? `Confirmar ${batchCandidates.length} clase${batchCandidates.length !== 1 ? 's' : ''}`
                  : 'Confirmar asistencia'}
              </Button>
            </div>
          )}
        </div>
      )}

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
                          <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
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

      {/* Past events — admin only */}
      {isAdmin && pastItems.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowPast(p => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronRight
              size={16}
              className={cn('transition-transform', showPast && 'rotate-90')}
            />
            Clases pasadas
            <span className="ml-auto text-xs font-normal">{pastItems.length}</span>
          </button>

          {showPast && (
            <div className="mt-3 space-y-2">
              {pastItems.map(item => {
                const attendance = attendanceMap.get(item.id)
                return (
                  <Link
                    key={item.id}
                    href={`/dashboard/events/${item.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent opacity-70"
                  >
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
                      <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
                        {(() => {
                          const s = formatDate(localKey(item.start_time) + 'T00:00:00')
                          return s.charAt(0).toUpperCase() + s.slice(1)
                        })()}
                        {' · '}
                        {formatTime(item.start_time)} – {formatTime(item.end_time)}
                      </p>
                    </div>
                    {/* Attendance summary */}
                    <div className="shrink-0 text-right">
                      <span className="text-xs text-muted-foreground">
                        {attendance?.status === 'attended' ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">Asistido</span>
                        ) : null}
                      </span>
                      <ChevronRight size={16} className="text-muted-foreground mt-0.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Color dot per event — gi_nogi takes priority over type when set
function dotColor(type: string, giNogi?: string | null) {
  if (giNogi === 'nogi') return 'bg-pink-300'
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
