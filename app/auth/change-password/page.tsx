'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function ChangePasswordPage() {
  const router = useRouter()

  // Step 1 — request reset email
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Step 2 — set new password (reached after clicking the email link)
  const [isRecoverySession, setIsRecoverySession] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)

  // Detect when Supabase processes the recovery token from the email link
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setEmailLoading(true)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/change-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
      setEmailSent(true)
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Error al enviar el correo.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)

    if (newPassword.length < 6) {
      setPwdError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Las contraseñas no coinciden.')
      return
    }

    setPwdLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwdSuccess(true)
      setTimeout(() => router.push('/auth/login'), 2500)
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : 'Error al cambiar la contraseña.')
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">

        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Volver al inicio de sesión
        </Link>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Cambiar contraseña</h1>
          <p className="text-sm text-muted-foreground">
            {isRecoverySession
              ? 'Introduce tu nueva contraseña a continuación.'
              : 'Introduce tu correo y te enviaremos un enlace para cambiar la contraseña.'}
          </p>
        </div>

        {/* ── Step 2: set new password (after clicking email link) ── */}
        {isRecoverySession ? (
          pwdSuccess ? (
            <div className="rounded-xl border border-border bg-card p-5 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">Contraseña actualizada correctamente.</p>
              <p className="text-xs text-muted-foreground">Redirigiendo al inicio de sesión...</p>
            </div>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(p => !p)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Repite la contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(p => !p)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}

              <Button type="submit" className="w-full" disabled={pwdLoading}>
                {pwdLoading ? 'Actualizando...' : 'Actualizar contraseña'}
              </Button>
            </form>
          )

        /* ── Step 1: request reset email ── */
        ) : emailSent ? (
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <p className="text-sm font-medium text-foreground">Correo enviado.</p>
            <p className="text-xs text-muted-foreground">
              Revisa tu bandeja de entrada en <span className="font-medium">{email}</span> y pulsa el enlace para continuar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="tu@correo.com"
              />
            </div>

            {emailError && <p className="text-sm text-destructive">{emailError}</p>}

            <Button type="submit" className="w-full" disabled={emailLoading}>
              {emailLoading ? 'Enviando...' : 'Enviar enlace de cambio'}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
