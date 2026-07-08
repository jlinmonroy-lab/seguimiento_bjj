'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookmarkCheck, CalendarRange, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { CalendarItem, CalendarItemType } from '@/lib/supabase/types'
import { EVENT_TYPE_LABELS } from '@/lib/belt'
import { cn } from '@/lib/utils'

interface EventFormProps {
  userId: string
  event?: CalendarItem
  initialDate?: string // "YYYY-MM-DD" pre-filled from calendar day click
}

const pad = (n: number) => String(n).padStart(2, '0')

function toDateInput(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toTimeInput(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function todayDate() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function combine(date: string, time: string) {
  return new Date(`${date}T${time}`)
}

// Returns "YYYY-MM" for the current month
function currentYearMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

// Generate all dates in a given "YYYY-MM" that match the selected weekdays (0=Mon…6=Sun)
function datesForWeekdays(yearMonth: string, weekdays: number[]): string[] {
  const [year, month] = yearMonth.split('-').map(Number)
  const dates: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day)
    const dow = (d.getDay() + 6) % 7 // Mon=0…Sun=6
    if (weekdays.includes(dow)) {
      dates.push(`${year}-${pad(month)}-${pad(day)}`)
    }
  }
  return dates
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function EventForm({ userId, event, initialDate }: EventFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!event

  // Mode: 'single' or 'batch'
  const [mode, setMode] = useState<'single' | 'batch'>('single')

  const [title, setTitle] = useState(event?.title ?? '')
  const [type, setType] = useState<CalendarItemType>(event?.type ?? 'class')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [eventDate, setEventDate] = useState(event ? toDateInput(event.start_time) : (initialDate ?? todayDate()))
  const [startTime, setStartTime] = useState(event ? toTimeInput(event.start_time) : '')
  const [endTime, setEndTime] = useState(event ? toTimeInput(event.end_time) : '')
  const [giNogi, setGiNogi] = useState<'gi' | 'nogi' | 'both' | ''>(event?.gi_nogi ?? '')

  // Batch-mode state
  const [batchWeekdays, setBatchWeekdays] = useState<number[]>([]) // Mon=0…Sun=6
  const [batchYearMonth, setBatchYearMonth] = useState(currentYearMonth())

  const [savingDefault, setSavingDefault] = useState<'title' | 'description' | 'location' | 'startTime' | 'endTime' | null>(null)
  const [savedDefault, setSavedDefault] = useState<'title' | 'description' | 'location' | 'startTime' | 'endTime' | null>(null)

  useEffect(() => {
    if (isEdit) return
    const supabase = createClient()
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['default_title', 'default_description', 'default_location', 'default_start_time', 'default_end_time'])
      .then(({ data }) => {
        if (!data) return
        for (const row of data) {
          if (row.key === 'default_title' && row.value) setTitle(row.value)
          if (row.key === 'default_description' && row.value) setDescription(row.value)
          if (row.key === 'default_location' && row.value) setLocation(row.value)
          if (row.key === 'default_start_time' && row.value) setStartTime(row.value)
          if (row.key === 'default_end_time' && row.value) setEndTime(row.value)
        }
      })
  }, [isEdit])

  async function saveDefault(field: 'title' | 'description' | 'location' | 'startTime' | 'endTime') {
    setSavingDefault(field)
    const supabase = createClient()
    const keyMap = {
      title: 'default_title',
      description: 'default_description',
      location: 'default_location',
      startTime: 'default_start_time',
      endTime: 'default_end_time',
    }
    const valueMap = { title, description, location, startTime, endTime }
    await supabase
      .from('app_settings')
      .upsert({ key: keyMap[field], value: valueMap[field] }, { onConflict: 'key' })
    setSavingDefault(null)
    setSavedDefault(field)
    setTimeout(() => setSavedDefault(null), 2000)
  }

  function handleStartChange(value: string) {
    setStartTime(value)
    if (endTime && value && endTime <= value) {
      setEndTime(value)
    }
  }

  function toggleWeekday(dow: number) {
    setBatchWeekdays(prev =>
      prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow].sort()
    )
  }

  // Derived: how many events will be created in batch mode
  const batchDates = mode === 'batch' && batchWeekdays.length > 0
    ? datesForWeekdays(batchYearMonth, batchWeekdays)
    : []

  async function handleDelete() {
    if (!event) return
    if (!confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('calendar_items').delete().eq('id', event.id)
      if (error) { setError('Error al eliminar'); return }
      router.push('/dashboard')
      router.refresh()
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!startTime || !endTime) {
      setError('Completa la hora de inicio y la de fin.')
      return
    }

    if (mode === 'batch') {
      if (batchWeekdays.length === 0) {
        setError('Selecciona al menos un día de la semana.')
        return
      }
      if (batchDates.length === 0) {
        setError('No hay fechas para ese mes con los días seleccionados.')
        return
      }
      // Validate times using a dummy date
      const dummyStart = combine(batchDates[0], startTime)
      const dummyEnd = combine(batchDates[0], endTime)
      if (dummyStart >= dummyEnd) {
        setError('La hora de inicio debe ser anterior a la de fin.')
        return
      }

      startTransition(async () => {
        const supabase = createClient()
        const basePayload = {
          title,
          type,
          description: description || null,
          location: location || null,
          created_by: userId,
          is_recurring: false,
          recurrence_rule: null,
          gi_nogi: giNogi !== '' ? giNogi : null,
        }
        const rows = batchDates.map(date => ({
          ...basePayload,
          start_time: combine(date, startTime).toISOString(),
          end_time: combine(date, endTime).toISOString(),
        }))

        const { error } = await supabase.from('calendar_items').insert(rows)
        if (error) { setError(`Error al crear eventos: ${error.message}`); return }
        router.push('/dashboard')
        router.refresh()
      })
      return
    }

    // Single mode
    if (!eventDate) {
      setError('Completa la fecha.')
      return
    }
    const startDateTime = combine(eventDate, startTime)
    const endDateTime = combine(eventDate, endTime)
    if (startDateTime >= endDateTime) {
      setError('La hora de inicio debe ser anterior a la de fin.')
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const payload = {
        title,
        type,
        description: description || null,
        location: location || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        created_by: userId,
        is_recurring: false,
        recurrence_rule: null,
        gi_nogi: giNogi !== '' ? giNogi : null,
      }

      if (isEdit) {
        const { error } = await supabase.from('calendar_items').update(payload).eq('id', event.id)
        if (error) { setError('Error al guardar'); return }
        router.push(`/dashboard/events/${event.id}`)
      } else {
        const { data, error } = await supabase.from('calendar_items').insert(payload).select().single()
        if (error) { setError('Error al crear'); return }
        router.push(`/dashboard/events/${data.id}`)
      }
      router.refresh()
    })
  }

  // Month navigation for batch mode
  function shiftMonth(delta: number) {
    const [y, m] = batchYearMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setBatchYearMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }

  const [batchYear, batchMonthIdx] = batchYearMonth.split('-').map(Number)

  return (
    <div>
      <Link
        href={isEdit ? `/dashboard/events/${event?.id}` : '/dashboard'}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        {isEdit ? 'Volver al evento' : 'Calendario'}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">
        {isEdit ? 'Editar evento' : 'Nueva clase / evento'}
      </h1>

      {/* Mode toggle — only in create mode */}
      {!isEdit && (
        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-xl">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
              mode === 'single'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Calendar size={15} />
            Evento único
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
              mode === 'batch'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <CalendarRange size={15} />
            Por lotes
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground" htmlFor="title">Título</label>
            <button
              type="button"
              onClick={() => saveDefault('title')}
              disabled={savingDefault === 'title'}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <BookmarkCheck size={13} />
              {savedDefault === 'title' ? 'Guardado' : savingDefault === 'title' ? 'Guardando...' : 'Predeterminar'}
            </button>
          </div>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Clase de BJJ"
          />
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Tipo</label>
          <Select value={type} onValueChange={(v) => setType(v as CalendarItemType)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(EVENT_TYPE_LABELS) as CalendarItemType[]).map((k) => (
                <SelectItem key={k} value={k}>{EVENT_TYPE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gi / NoGi */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Gi / NoGi <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <div className="flex gap-2">
            {(['gi', 'nogi', 'both'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setGiNogi(prev => prev === opt ? '' : opt)}
                className={cn(
                  'flex-1 rounded-md border py-2 text-sm font-medium transition-colors',
                  giNogi === opt
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-foreground hover:bg-accent',
                )}
              >
                {opt === 'gi' ? 'Gi' : opt === 'nogi' ? 'NoGi' : 'Ambos'}
              </button>
            ))}
          </div>
        </div>

        {/* Date section — single vs batch */}
        {mode === 'single' ? (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="date">Fecha</label>
            <input
              id="date"
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {/* Month picker */}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                ‹
              </button>
              <span className="text-sm font-semibold text-foreground">
                {MONTHS_ES[batchMonthIdx - 1]} {batchYear}
              </span>
              <button type="button" onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                ›
              </button>
            </div>

            {/* Weekday selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Días de la semana</p>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((label, dow) => (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleWeekday(dow)}
                    className={cn(
                      'rounded-lg py-2 text-xs font-medium transition-colors',
                      batchWeekdays.includes(dow)
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            {batchDates.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Se crearán <span className="font-semibold text-foreground">{batchDates.length} eventos</span>:{' '}
                {batchDates.slice(0, 3).map(d => {
                  const [,, day] = d.split('-')
                  return `${parseInt(day)} ${MONTHS_ES[batchMonthIdx - 1].slice(0, 3).toLowerCase()}.`
                }).join(', ')}
                {batchDates.length > 3 && ` y ${batchDates.length - 3} más`}
              </p>
            )}
            {batchWeekdays.length > 0 && batchDates.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay fechas para ese mes.</p>
            )}
          </div>
        )}

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground" htmlFor="start">Hora inicio</label>
              <button
                type="button"
                onClick={() => saveDefault('startTime')}
                disabled={savingDefault === 'startTime' || !startTime}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <BookmarkCheck size={13} />
                {savedDefault === 'startTime' ? 'Guardado' : savingDefault === 'startTime' ? 'Guardando...' : 'Predeterminar'}
              </button>
            </div>
            <input
              id="start"
              type="time"
              required
              value={startTime}
              onChange={(e) => handleStartChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground" htmlFor="end">Hora fin</label>
              <button
                type="button"
                onClick={() => saveDefault('endTime')}
                disabled={savingDefault === 'endTime' || !endTime}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <BookmarkCheck size={13} />
                {savedDefault === 'endTime' ? 'Guardado' : savingDefault === 'endTime' ? 'Guardando...' : 'Predeterminar'}
              </button>
            </div>
            <input
              id="end"
              type="time"
              required
              value={endTime}
              min={startTime || undefined}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground" htmlFor="location">
              Ubicación <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <button
              type="button"
              onClick={() => saveDefault('location')}
              disabled={savingDefault === 'location'}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <BookmarkCheck size={13} />
              {savedDefault === 'location' ? 'Guardado' : savingDefault === 'location' ? 'Guardando...' : 'Predeterminar'}
            </button>
          </div>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Dojo, sala, etc."
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground" htmlFor="desc">
              Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <button
              type="button"
              onClick={() => saveDefault('description')}
              disabled={savingDefault === 'description'}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <BookmarkCheck size={13} />
              {savedDefault === 'description' ? 'Guardado' : savingDefault === 'description' ? 'Guardando...' : 'Predeterminar'}
            </button>
          </div>
          <textarea
            id="desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Detalles del evento..."
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending
              ? 'Guardando...'
              : isEdit
              ? 'Guardar cambios'
              : mode === 'batch'
              ? batchDates.length > 0
                ? `Crear ${batchDates.length} eventos`
                : 'Crear eventos'
              : 'Crear evento'}
          </Button>
          {isEdit && (
            <Button type="button" variant="destructive" disabled={isPending} onClick={handleDelete}>
              Eliminar
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
