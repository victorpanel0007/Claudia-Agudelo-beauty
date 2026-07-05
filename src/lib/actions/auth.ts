'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(email: string, password: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }
  }

  const rol = session?.user?.user_metadata?.rol
  if (rol === 'especialista') {
    redirect('/especialista')
  } else {
    redirect('/admin')
  }
}
