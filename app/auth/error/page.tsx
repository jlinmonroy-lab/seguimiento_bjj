import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Error de autenticación</h1>
        <p className="text-muted-foreground">
          Hubo un problema al iniciar sesión. Por favor, inténtalo de nuevo.
        </p>
        <Link
          href="/auth/login"
          className="inline-block mt-2 text-sm font-medium underline underline-offset-4 text-foreground"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </main>
  )
}
