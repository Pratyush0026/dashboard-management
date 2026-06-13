import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { email } = body as { email?: string }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if admin exists
    const { data: admin } = await supabaseAdmin
      .from('admins')
      .select('id, email, name')
      .eq('email', email.toLowerCase().trim())
      .single()

    // Always return success to prevent email enumeration
    if (!admin) {
      return NextResponse.json({ message: 'If that email exists, you will receive a reset link.' })
    }

    // In a real app, you'd send an email here
    // For now, just return success
    return NextResponse.json({ message: 'If that email exists, you will receive a reset link.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
