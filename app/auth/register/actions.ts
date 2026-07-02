'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function registerUser(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  if (!email || !password) {
    return { error: 'Correo y contraseña son obligatorios.' }
  }

  // Create the user as already confirmed via Admin API — no email sent, no rate limit
  console.log('[v0] registerUser action called for:', email)
  const admin = createAdminClient()
  const { error: adminError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (adminError) {
    return { error: adminError.message }
  }

  // Return success — the browser will sign in to get a real session cookie
  return { success: true }
}
