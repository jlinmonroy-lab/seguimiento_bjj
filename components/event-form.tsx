'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { CalendarItem, CalendarItemType } from '@/lib/supabase/types'
import { EVENT_TYPE_LABELS } from '@/lib/belt'

interface EventFormProps {
  userId: string
  event?: CalendarItem
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventForm({ userId, event }: EventFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!event

  const [title, setTitle] = useState(event?.title ?? '')
  const [type, setType] = useState<CalendarItemType>(event?.type ?? 'class')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [startTime, setStartTime] = useState(event ? toDatetimeLocal(event.start_time) : '')
  const [endTime, setEndTime] = useState(event ? toDatetimeLocal(event.end_time) : '')

  const [savingDefault, setSavingDefault] = useState<'title' | 'description' | 'location' | null>(null)
  const [savedDefault, setSavedDefault] = useState<'title' | 'description' | 'location' | null>(null)

  // Load defaults from app_settings only when creating a new event
  useEffect(() => {
    if (isEdit) return
    const supabase = createClient()
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['default_title', 'default_description', 'default_location'])
      .then(({ data }) => {
        if (!data) return
        for (const row of data) {
          if (row.key === 'default_title' && row.value) setTitle(row.value)
          if (row.key === 'default_description' && row.value) setDescription(row.value)
          if (row.key === 'default_location' && row.value) setLocation(row.value)
        }
      })
  }, [isEdit])

  async function saveDefault(field: 'title' | 'description' | 'location') {
    setSavingDefault(field)
    const supabase = createClient()
    const keyMap = { title: 'default_title', description: 'default_description', location: 'default_location' }
    const valueMap = { title, description, location }
    await supabase
      .from('app_settings')
      .upsert({ key: keyMap[field], value: valueMap[field] }, { onConflict: 'key' })
    setSavingDefault(null)
    setSavedDefault(field)
    setTimeout(() => setSavedDefault(null), 2000)
  }

  function handleStartChange(value: string) {
    setStartTime(value)
    if (endTime && value && new Date(endTime) <= new Date(value)) {
      setEndTime(value)
    }
  }

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
      setError('Completa las fechas de inicio y fin.')
      return
    }
    if (new Date(startTime) >= new Date(endTime)) {
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
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        created_by: userId,
        is_recurring: false,
        recurrence_rule: null,
      }

      if (isEdit) {
        const { error } = await supabase
          .from('calendar_items')
          .update(payload)
          .eq('id', event.id)
        if (error) { setError('Error al guardar'); return }
        router.push(`/dashboard/events/${event.id}`)
      } else {
        const { data, error } = await supabase
          .from('calendar_items')
          .insert(payload)
          .select()
          .single()
        if (error) { setError('Error al crear'); return }
        router.push(`/dashboard/events/${data.id}`)
      }
      router.refresh()
    })
  }

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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground" htmlFor="title">
              Título
            </label>
            <button
              type="button"
              onClick={() => saveDefault('title')}
              disabled={savingDefault === 'title'}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Guardar como título predeterminado"
            >
              <BookmarkCheck size={13} />
              {savedDefault === 'title'
                ? 'Guardado'
                : savingDefault === 'title'
                ? 'Guardando...'
                : 'Predeterminar'}
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

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Tipo</label>
          <Select value={type} onValueChange={(v) => setType(v as CalendarItemType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EVENT_TYPE_LABELS) as CalendarItemType[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {EVENT_TYPE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="start">
            Inicio
          </label>
          <input
            id="start"
            type="datetime-local"
            required
            value={startTime}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="end">
            Fin
          </label>
          <input
            id="end"
            type="datetime-local"
            required
            value={endTime}
            min={startTime || undefined}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

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
              title="Guardar como ubicación predeterminada"
            >
              <BookmarkCheck size={13} />
              {savedDefault === 'location'
                ? 'Guardado'
                : savingDefault === 'location'
                ? 'Guardando...'
                : 'Predeterminar'}
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
              title="Guardar como descripción predeterminada"
            >
              <BookmarkCheck size={13} />
              {savedDefault === 'description'
                ? 'Guardado'
                : savingDefault === 'description'
                ? 'Guardando...'
                : 'Predeterminar'}
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
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear evento'}
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              Eliminar
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
