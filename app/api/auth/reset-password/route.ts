import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { token, newPassword } = body as { token?: string; newPassword?: string }

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    let decoded: { id: string; exp: string }

    try {
      decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8')) as {
        id: string
        exp: string
      }
    } catch {
      return NextResponse.json({ error: 'Invalid or malformed token' }, { status: 400 })
    }

    if (!decoded.id || !decoded.exp) {
      return NextResponse.json({ error: 'Invalid token structure' }, { status: 400 })
    }

    if (new Date(decoded.exp) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 })
    }

    const passwordHash = await hashPassword(newPassword)

    const { error } = await supabaseAdmin
      .from('admin_users')
      .update({ password_hash: passwordHash })
      .eq('id', decoded.id)

    if (error) {
      console.error('Reset password update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Password reset successfully. You can now sign in.' })
  } catch (error) {
    console.error('Reset password unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
