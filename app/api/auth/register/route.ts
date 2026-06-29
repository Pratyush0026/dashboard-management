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
    const { email, password, name } = body as { email?: string; password?: string; name?: string }

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12)

    // Create admin
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .insert([{
        email: email.toLowerCase().trim(),
        password_hash,
        name: name.trim(),
      }])
      .select()
      .single()

    if (error || !admin) {
      console.error('Register error:', error)
      const msg = (error as any)?.message || ''
      if (msg.includes('does not exist') || (error as any)?.code === '42P01') {
        return NextResponse.json(
          { error: 'Database tables not found. Please run the setup SQL in your Supabase dashboard (see lib/supabase/setup.sql).' },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: `Failed to create account: ${msg}` }, { status: 500 })
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
    }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
