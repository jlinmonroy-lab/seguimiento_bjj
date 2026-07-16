'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
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

const BELT_OPTIONS: BeltColor[] = ['white', 'blue', 'purple', 'brown', 'black', 'coral']

const CATEGORY_OPTIONS = [
  { value: 'infantil', label: 'Infantil (4–15 años)' },
  { value: 'juvenil', label: 'Juvenil (16–17 años)' },
  { value: 'adulto', label: 'Adulto (18–29 años)' },
  { value: 'master_1', label: 'Máster 1 (30–35 años)' },
  { value: 'master_2', label: 'Máster 2 (36–40 años)' },
  { value: 'master_3', label: 'Máster 3 (41–45 años)' },
  { value: 'master_4', label: 'Máster 4 (46–50 años)' },
  { value: 'master_5', label: 'Máster 5 (51–55 años)' },
  { value: 'master_6', label: 'Máster 6 (56–60 años)' },
  { value: 'master_7', label: 'Máster 7 (61+ años)' },
]

export function ProfileView({ profile, userId, isOwnProfile, isAdmin }: ProfileViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isUploading, setIsUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [beltColor, setBeltColor] = useState<BeltColor>(profile?.belt_color ?? 'white')
  const [beltStripes, setBeltStripes] = useState(profile?.belt_stripes ?? 0)
  const [adminNotes, setAdminNotes] = useState(profile?.admin_notes ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [weight, setWeight] = useState<string>(profile?.weight != null ? String(profile.weight) : '')
  const [category, setCategory] = useState<string>(profile?.category ?? '')

  // Change password state
  const [showPasswordPanel, setShowPasswordPanel] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)

  const handlePasswordChange = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setIsChangingPassword(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(error.message)
      } else {
        setPasswordSuccess('Contraseña actualizada correctamente.')
        setNewPassword('')
        setConfirmPassword('')
        setShowPasswordPanel(false)
      }
    } finally {
      setIsChangingPassword(false)
    }
  }, [newPassword, confirmPassword])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setIsUploading(true)

    try {
      const supabase = createClient()
      // Always overwrite as avatar.ext so old files are replaced
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' })

      if (uploadError) {
        setError(`Error al subir la imagen: ${uploadError.message}`)
        return
      }

      // Get public URL — works now that bucket is public
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Append cache-buster so the browser doesn't show the old image
      const url = `${data.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', profile.id)

      if (updateError) {
        setError(`Error al actualizar avatar: ${updateError.message}`)
        return
      }

      setAvatarUrl(url)
      router.refresh()
    } finally {
      setIsUploading(false)
      // Reset input so the same file can be re-selected if needed
      if (fileRef.current) fileRef.current.value = ''
    }
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
        weight: weight !== '' ? parseFloat(weight) : null,
        category: category !== '' ? category : null,
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

      <div className="flex items-center justify-between mt-12 mb-6">
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
              disabled={isPending || isUploading}
              className="absolute -bottom-1 -right-1 rounded-full bg-foreground p-1.5 text-background shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              aria-label={isUploading ? 'Subiendo foto...' : 'Cambiar foto'}
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
                {Array.from(
                  { length: (beltColor === 'black' || beltColor === 'coral' ? 10 : 4) + 1 },
                  (_, n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 0 ? 'Sin grados' : `${n} grado${n !== 1 ? 's' : ''}`}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="weight">
              Peso (kg)
            </label>
            <input
              id="weight"
              type="number"
              min="0"
              max="300"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              disabled={!isOwnProfile && !isAdmin}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              placeholder="ej. 73.5"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Categoría</label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={!isOwnProfile && !isAdmin}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
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

      {/* Change password — own profile only */}
      {isOwnProfile && (
        <div className="mt-4">
          {!showPasswordPanel ? (
            <a
              href="https://brazilian-jiu-jitsu-dojo-l4ohc5jqi-jlinmonroy-7836s-projects.vercel.app/reset-password"
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
            >
              Cambiar contraseña
            </a>
          ) : (
            <form onSubmit={handlePasswordChange} className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Cambiar contraseña</span>
                <button
                  type="button"
                  onClick={() => { setShowPasswordPanel(false); setNewPassword(''); setConfirmPassword(''); setPasswordError(null) }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="new-password">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(p => !p)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showNewPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showNewPwd
                      ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                      : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="confirm-password">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Repite la contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(p => !p)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showConfirmPwd
                      ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                      : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
              {passwordSuccess && <p className="text-sm text-green-600 dark:text-green-400">{passwordSuccess}</p>}

              <Button type="submit" disabled={isChangingPassword} className="w-full">
                {isChangingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
