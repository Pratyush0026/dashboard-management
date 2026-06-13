import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { email, password } = body as { email?: string; password?: string }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Check if admin exists
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !admin) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password
    const isValid = await bcrypt.compare(password, admin.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Generate JWT
    const token = await signToken({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
    })

    return NextResponse.json({
      token,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
