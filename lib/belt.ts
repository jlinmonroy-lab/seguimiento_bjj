import type { BeltColor } from '@/lib/supabase/types'

export const BELT_LABELS: Record<BeltColor, string> = {
  white: 'Blanco',
  blue: 'Azul',
  purple: 'Morado',
  brown: 'Marrón',
  black: 'Negro',
  coral: 'Coral',
}

// Returns a Tailwind bg color class for each belt
export const BELT_BG: Record<BeltColor, string> = {
  white: 'bg-neutral-200 dark:bg-neutral-300',
  blue: 'bg-blue-600',
  purple: 'bg-purple-600',
  brown: 'bg-amber-800',
  black: 'bg-neutral-900 dark:bg-neutral-950 border border-border',
  coral: 'bg-red-400',
}

export const BELT_TEXT: Record<BeltColor, string> = {
  white: 'text-neutral-800',
  blue: 'text-white',
  purple: 'text-white',
  brown: 'text-white',
  black: 'text-white',
  coral: 'text-white',
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  class: 'Clase',
  graduation: 'Graduación',
  seminar: 'Seminario',
  competition: 'Competición',
}

export const EVENT_TYPE_COLORS: Record<string, string> = {
  class: 'bg-secondary text-secondary-foreground',
  graduation: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  seminar: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  competition: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function formatDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function isSameDay(a: string, b: Date) {
  const da = new Date(a)
  return (
    da.getFullYear() === b.getFullYear() &&
    da.getMonth() === b.getMonth() &&
    da.getDate() === b.getDate()
  )
}
