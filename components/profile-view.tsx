'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { UserAvatar } from '@/components/user-avatar'
import { BeltBadge } from '@/components/belt-badge'
import { createClient } from '@/lib/supabase/client'
import { BELT_LABELS } from '@/lib/belt'
import type { Profile, BeltColor } from '@/lib/supabase/types'

interface ProfileViewProps {
  profile: Profile
  userId: string
  isOwnProfile: boolean
  isAdmin: boolean
}

const BELT_OPTIONS: BeltColor[] = ['white', 'blue', 'purple', 'brown', 'black']

export function ProfileView({ profile, userId, isOwnProfile, isAdmin }: ProfileViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [beltColor, setBeltColor] = useState<BeltColor>(profile?.belt_color ?? 'white')
  const [beltStripes, setBeltStripes] = useState(profile?.belt_stripes ?? 0)
  const [adminNotes, setAdminNotes] = useState(profile?.admin_notes ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    startTransition(async () => {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) { setError('Error al subir la imagen'); return }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + `?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', profile.id)

      if (updateError) { setError('Error al actualizar avatar'); return }

      setAvatarUrl(url)
      router.refresh()
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const supabase = createClient()
      const updates: Partial<Profile> = {
        full_name: fullName,
        belt_color: beltColor,
        belt_stripes: beltStripes,
      }

      // Admin can save notes on any profile
      if (isAdmin && !isOwnProfile) {
        updates.admin_notes = adminNotes
      }
      // Admin editing their own profile can also update belt
      if (isAdmin && isOwnProfile) {
        updates.admin_notes = adminNotes
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)

      if (error) { setError('Error al guardar'); return }
      setSuccess('Cambios guardados correctamente.')
      router.refresh()
    })
  }

  const displayName = profile?.full_name ?? 'Sin nombre'

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
      {!isOwnProfile && (
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft size={16} />
          Calendario
        </Link>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isOwnProfile ? 'Mi perfil' : displayName}
        </h1>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <UserAvatar name={profile?.full_name ?? null} avatarUrl={avatarUrl} size="lg" />
          {isOwnProfile && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
              className="absolute -bottom-1 -right-1 rounded-full bg-foreground p-1.5 text-background shadow-sm hover:opacity-90 transition-opacity"
              aria-label="Cambiar foto"
            >
              <Camera size={12} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleAvatarChange}
            aria-label="Subir foto de perfil"
          />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{displayName}</p>
          <BeltBadge color={beltColor} stripes={beltStripes} />
          {!isOwnProfile && profile?.role && (
            <p className="text-xs text-muted-foreground capitalize">{profile.role === 'admin' ? 'Administrador' : 'Alumno'}</p>
          )}
        </div>
      </div>

      <Separator className="mb-6" />

      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="name">
            Nombre completo
          </label>
          <input
            id="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!isOwnProfile && !isAdmin}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            placeholder="Tu nombre"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Cinturón</label>
            <Select
              value={beltColor}
              onValueChange={(v) => setBeltColor(v as BeltColor)}
              disabled={!isOwnProfile && !isAdmin}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BELT_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {BELT_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Grados</label>
            <Select
              value={String(beltStripes)}
              onValueChange={(v) => setBeltStripes(Number(v))}
              disabled={!isOwnProfile && !isAdmin}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? 'Sin grados' : `${n} grado${n !== 1 ? 's' : ''}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Admin notes — only visible to admins */}
        {isAdmin && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="notes">
              Notas privadas{' '}
              <span className="text-xs text-muted-foreground font-normal">(solo visibles para el admin)</span>
            </label>
            <textarea
              id="notes"
              rows={4}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Observaciones sobre el alumno..."
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  )
}
