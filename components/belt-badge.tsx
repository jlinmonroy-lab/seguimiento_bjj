import { cn } from '@/lib/utils'
import { BELT_BG, BELT_LABELS, BELT_TEXT } from '@/lib/belt'
import type { BeltColor } from '@/lib/supabase/types'

interface BeltBadgeProps {
  color: BeltColor
  stripes: number
  className?: string
}

export function BeltBadge({ color, stripes, className }: BeltBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        BELT_BG[color],
        BELT_TEXT[color],
        className,
      )}
      aria-label={`Cinturón ${BELT_LABELS[color]}, ${stripes} grado${stripes !== 1 ? 's' : ''}`}
    >
      {BELT_LABELS[color]}
      {stripes > 0 && (
        <span className="flex gap-0.5" aria-hidden>
          {Array.from({ length: stripes }).map((_, i) => (
            <span key={i} className="inline-block h-2.5 w-0.5 rounded-sm bg-current opacity-60" />
          ))}
        </span>
      )}
    </span>
  )
}
