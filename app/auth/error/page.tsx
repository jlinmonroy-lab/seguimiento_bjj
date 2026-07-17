import Link from 'next/link'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Enlace no válido</h1>
        <p className="text-sm text-muted-foreground">
          {message ?? 'El enlace de recuperación no es válido o ha expirado.'}
        </p>
        <div className="flex flex-col gap-2 items-center">
          <Link
            href="/change-password"
            className="inline-block text-sm font-medium underline underline-offset-4 text-foreground hover:opacity-80 transition-opacity"
          >
            Solicitar un nuevo enlace
          </Link>
          <Link
            href="/auth/login"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </main>
  )
}
