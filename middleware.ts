import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function middleware(request: NextRequest) {
  // The password-reset form is public. The recovery link establishes its
  // temporary session before redirecting here, so this route must never be
  // intercepted by the regular authentication guard.
  if (
    request.nextUrl.pathname.startsWith('/change-password') ||
    request.nextUrl.pathname.startsWith('/reset-password')
  ) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
