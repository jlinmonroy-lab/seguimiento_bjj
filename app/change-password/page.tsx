'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function ChangePasswordPage() {
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRequestReset(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      // Password recovery emails must always return to the stable production
      // domain. Using window.location.origin here would make preview deployments
      // generate links that stop working once that preview is replaced.
      const productionUrl = 'https://brazilian-jiu-jitsu-dojo-app.vercel.app'
      const redirectTo = `${productionUrl}/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (resetError) throw resetError
      setEmailSent(true)
    } catch (resetError: unknown) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : 'No se ha podido enviar el correo de recuperación.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} />
          Volver al inicio de sesión
        </Link>

        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Cambiar contraseña
          </h1>
          <p className="text-sm text-muted-foreground">
            Introduce tu correo y te enviaremos un enlace para crear una nueva contraseña.
          </p>
        </div>

        {emailSent ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">Correo enviado</p>
            <p className="text-xs text-muted-foreground">
              Revisa la bandeja de entrada de{' '}
              <span className="font-medium text-foreground">{email}</span> y abre el enlace para continuar.
            </p>
            <button
              type="button"
              onClick={() => setEmailSent(false)}
              className="pt-2 text-xs font-medium text-foreground underline underline-offset-4"
            >
              Usar otro correo
            </button>
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
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="tu@correo.com"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace de cambio'}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
