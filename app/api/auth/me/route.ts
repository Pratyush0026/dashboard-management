import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, email, name, created_at')
      .eq('id', decoded.sub)
      .single()

    if (error || !admin) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: admin })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
