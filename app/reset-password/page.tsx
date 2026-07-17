'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [isRecoveryReady, setIsRecoveryReady] = useState(false)
  const [checkingLink, setCheckingLink] = useState(true)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const recoveryError =
      searchParams.get('error_description') ??
      hashParams.get('error_description')

    if (recoveryError) {
      setLinkError(decodeURIComponent(recoveryError.replace(/\+/g, ' ')))
      setCheckingLink(false)
      return
    }

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setIsRecoveryReady(true)
        setCheckingLink(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session) {
        setIsRecoveryReady(true)
      } else if (!window.location.hash.includes('access_token')) {
        setLinkError('El enlace de recuperación no es válido o ha caducado.')
      }
      setCheckingLink(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isRecoveryReady) {
      setError('Abre un enlace de recuperación válido antes de cambiar la contraseña.')
      return
    }
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 2500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Introduce y confirma tu nueva contraseña.
          </p>
        </div>

        {checkingLink ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Validando enlace...</p>
          </div>
        ) : linkError ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">El enlace no es válido</p>
              <p className="text-sm text-muted-foreground">{linkError}</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/auth/change-password">Solicitar un enlace nuevo</Link>
            </Button>
          </div>
        ) : success ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">Contraseña actualizada correctamente.</p>
            <p className="text-xs text-muted-foreground">Redirigiendo al inicio de sesión...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="new-password">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((p) => !p)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
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
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Repite la contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading || !isRecoveryReady}>
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link href="/auth/login" className="underline underline-offset-4 hover:text-foreground transition-colors">
                Volver al inicio de sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
