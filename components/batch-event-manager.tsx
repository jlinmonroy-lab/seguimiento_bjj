'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Trash2, Pencil, Check } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import type { CalendarItem, CalendarItemType } from '@/lib/supabase/types'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, formatDate, formatTime } from '@/lib/belt'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')

function localKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toTimeInput(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function combine(date: string, time: string) {
  return new Date(`${date}T${time}`)
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function localDow(iso: string) {
  // Mon=0…Sun=6
  return (new Date(iso).getDay() + 6) % 7
}

interface BatchEventManagerProps {
  items: CalendarItem[]
}

export function BatchEventManager({ items }: BatchEventManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // --- Filter state ---
  const [filterWeekdays, setFilterWeekdays] = useState<number[]>([])
  const [filterType, setFilterType] = useState<CalendarItemType | 'all'>('all')
  const [filterGiNogi, setFilterGiNogi] = useState<'gi' | 'nogi' | 'both' | 'all'>('all')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // --- Edit fields state ---
  const [mode, setMode] = useState<'idle' | 'edit' | 'delete'>('idle')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editType, setEditType] = useState<CalendarItemType | ''>('')
  const [editGiNogi, setEditGiNogi] = useState<'gi' | 'nogi' | 'both' | ''>('')

  function toggleWeekday(dow: number) {
    setFilterWeekdays(prev =>
      prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow].sort()
    )
  }

  // Filtered events
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filterWeekdays.length > 0 && !filterWeekdays.includes(localDow(item.start_time))) return false
      if (filterType !== 'all' && item.type !== filterType) return false
      if (filterGiNogi !== 'all' && item.gi_nogi !== filterGiNogi) return false
      const key = localKey(item.start_time)
      if (filterFrom && key < filterFrom) return false
      if (filterTo && key > filterTo) return false
      return true
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [items, filterWeekdays, filterType, filterGiNogi, filterFrom, filterTo])

  const hasFilters = filterWeekdays.length > 0 || filterType !== 'all' || filterGiNogi !== 'all' || filterFrom || filterTo

  async function handleBatchDelete() {
    if (!confirm(`¿Eliminar ${filtered.length} evento${filtered.length !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const ids = filtered.map(i => i.id)
      const { error } = await supabase.from('calendar_items').delete().in('id', ids)
      if (error) { setError(`Error al eliminar: ${error.message}`); return }
      setSuccess(`${ids.length} evento${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}.`)
      setMode('idle')
      router.refresh()
    })
  }

  async function handleBatchEdit() {
    setError(null)
    // Build update object from non-empty fields
    const updates: Partial<CalendarItem> = {}
    if (editType) updates.type = editType
    if (editTitle.trim()) updates.title = editTitle.trim()
    if (editLocation.trim()) updates.location = editLocation.trim()
    if (editGiNogi) updates.gi_nogi = editGiNogi

    // Time update: rebuild ISO using each event's original date
    const hasTimeChange = editStartTime || editEndTime

    if (!hasTimeChange && Object.keys(updates).length === 0) {
      setError('Introduce al menos un campo a modificar.')
      return
    }

    if ((editStartTime && !editEndTime) || (!editStartTime && editEndTime)) {
      setError('Si cambias la hora, debes introducir tanto la hora de inicio como la de fin.')
      return
    }

    if (editStartTime && editEndTime && editStartTime >= editEndTime) {
      setError('La hora de inicio debe ser anterior a la de fin.')
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      let anyError = false

      for (const item of filtered) {
        const row: Record<string, unknown> = { ...updates }
        if (hasTimeChange) {
          const dateKey = localKey(item.start_time)
          row.start_time = combine(dateKey, editStartTime).toISOString()
          row.end_time = combine(dateKey, editEndTime).toISOString()
        }
        const { error } = await supabase.from('calendar_items').update(row).eq('id', item.id)
        if (error) { anyError = true }
      }

      if (anyError) {
        setError('Algunos eventos no se pudieron actualizar.')
      } else {
        setSuccess(`${filtered.length} evento${filtered.length !== 1 ? 's' : ''} actualizado${filtered.length !== 1 ? 's' : ''}.`)
        setMode('idle')
        router.refresh()
      }
    })
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        Calendario
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Edición por lote</h1>
      <p className="text-sm text-muted-foreground mb-6">Filtra los eventos que quieres modificar o eliminar.</p>

      {/* Filters */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</p>

        {/* Weekday filter */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">Día de la semana</p>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, dow) => (
              <button
                key={dow}
                type="button"
                onClick={() => toggleWeekday(dow)}
                className={cn(
                  'rounded-lg py-2 text-xs font-medium transition-colors',
                  filterWeekdays.includes(dow)
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Type filter */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Tipo</p>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as CalendarItemType | 'all')}>
              <SelectTrigger className="w-full text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(Object.keys(EVENT_TYPE_LABELS) as CalendarItemType[]).map(k => (
                  <SelectItem key={k} value={k}>{EVENT_TYPE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Gi / NoGi</p>
            <Select value={filterGiNogi} onValueChange={(v) => setFilterGiNogi(v as 'gi' | 'nogi' | 'both' | 'all')}>
              <SelectTrigger className="w-full text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="gi">Gi</SelectItem>
                <SelectItem value="nogi">NoGi</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Desde</p>
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">Hasta</p>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {hasFilters
              ? <><span className="font-semibold text-foreground">{filtered.length}</span> evento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</>
              : `${items.length} eventos en total`
            }
          </span>
        </div>
        {filtered.length > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setMode(mode === 'edit' ? 'idle' : 'edit'); setSuccess(null); setError(null) }}
              className="gap-1.5"
            >
              <Pencil size={13} />
              Editar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { setMode(mode === 'delete' ? 'idle' : 'delete'); setSuccess(null); setError(null) }}
              className="gap-1.5"
            >
              <Trash2 size={13} />
              Eliminar
            </Button>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {mode === 'edit' && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-4">
          <p className="text-sm font-semibold text-foreground">
            Modificar {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-muted-foreground -mt-2">Deja en blanco los campos que no quieras cambiar.</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Título</label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Sin cambios"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Hora inicio</label>
              <input
                type="time"
                value={editStartTime}
                onChange={e => setEditStartTime(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Hora fin</label>
              <input
                type="time"
                value={editEndTime}
                onChange={e => setEditEndTime(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Ubicación</label>
            <input
              type="text"
              value={editLocation}
              onChange={e => setEditLocation(e.target.value)}
              placeholder="Sin cambios"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Tipo</label>
              <Select value={editType} onValueChange={(v) => setEditType(v as CalendarItemType | '')}>
                <SelectTrigger className="w-full text-sm h-9"><SelectValue placeholder="Sin cambios" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cambios</SelectItem>
                  {(Object.keys(EVENT_TYPE_LABELS) as CalendarItemType[]).map(k => (
                    <SelectItem key={k} value={k}>{EVENT_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Gi / NoGi</label>
              <Select value={editGiNogi} onValueChange={(v) => setEditGiNogi(v as 'gi' | 'nogi' | 'both' | '')}>
                <SelectTrigger className="w-full text-sm h-9"><SelectValue placeholder="Sin cambios" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cambios</SelectItem>
                  <SelectItem value="gi">Gi</SelectItem>
                  <SelectItem value="nogi">NoGi</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleBatchEdit} disabled={isPending} size="sm" className="flex-1 gap-1.5">
              <Check size={13} />
              {isPending ? 'Guardando...' : `Guardar cambios`}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMode('idle')}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Delete confirmation panel */}
      {mode === 'delete' && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Eliminar {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer. Se eliminarán también los registros de asistencia asociados.</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleBatchDelete} disabled={isPending} className="flex-1 gap-1.5">
              <Trash2 size={13} />
              {isPending ? 'Eliminando...' : `Eliminar ${filtered.length} evento${filtered.length !== 1 ? 's' : ''}`}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMode('idle')}>Cancelar</Button>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-border bg-card p-3 mb-4 flex items-center gap-2 text-sm text-foreground">
          <Check size={14} className="text-green-600 dark:text-green-400 shrink-0" />
          {success}
        </div>
      )}

      {/* Event list preview */}
      <Separator className="mb-4" />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {hasFilters ? 'Eventos seleccionados' : 'Todos los eventos'}
      </p>
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {hasFilters ? 'Ningún evento coincide con los filtros.' : 'No hay eventos.'}
          </p>
        )}
        {filtered.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-card-foreground truncate">{item.title}</span>
                <Badge className={cn('text-xs shrink-0 border-0', EVENT_TYPE_COLORS[item.type])}>
                  {EVENT_TYPE_LABELS[item.type]}
                </Badge>
                {item.gi_nogi && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {item.gi_nogi === 'gi' ? 'Gi' : item.gi_nogi === 'nogi' ? 'NoGi' : 'Gi & NoGi'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
                {(() => { const s = formatDate(item.start_time); return s.charAt(0).toUpperCase() + s.slice(1) })()}
                {' · '}
                {formatTime(item.start_time)} – {formatTime(item.end_time)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {WEEKDAY_LABELS[localDow(item.start_time)]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
