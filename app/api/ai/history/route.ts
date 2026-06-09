import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'

const HISTORY_LIMIT = 20

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('ai_queries')
      .select('query,response,created_at')
      .eq('admin_id', decoded.sub)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)

    if (error) {
      console.error('AI history fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return in chronological order (oldest first)
    const history = (data ?? []).reverse()

    return NextResponse.json({ history })
  } catch (error) {
    console.error('AI history unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
