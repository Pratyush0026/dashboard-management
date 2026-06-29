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

    if (error) {
      const msg = (error as any)?.message || ''
      if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Cannot reach the database. Your Supabase project may be paused — go to supabase.com and restore it.' },
          { status: 503 }
        )
      }
      if (msg.includes('does not exist') || (error as any)?.code === '42P01') {
        return NextResponse.json(
          { error: 'Database tables not found. Run the SQL in lib/supabase/setup.sql in your Supabase dashboard.' },
          { status: 500 }
        )
      }
      // PGRST116 = no rows (user not found) — this is normal
      if ((error as any)?.code !== 'PGRST116') {
        console.error('Login DB error:', error)
        return NextResponse.json({ error: `Database error: ${msg}` }, { status: 500 })
      }
    }

    if (!admin) {
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
