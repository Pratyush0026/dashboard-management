import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'

const MAX_SEARCH_LENGTH = 100

function sanitizeParam(value: string | null, maxLen = MAX_SEARCH_LENGTH): string | null {
  if (!value) return null
  const trimmed = value.trim().slice(0, maxLen)
  return trimmed.length > 0 ? trimmed : null
}

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

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    // Allow up to 5000 rows for CSV export requests; normal table view uses 10-100
    const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const status = sanitizeParam(searchParams.get('status'))
    const position = sanitizeParam(searchParams.get('position'))
    const location = sanitizeParam(searchParams.get('location'))
    const search = sanitizeParam(searchParams.get('search'))

    let query = supabaseAdmin
      .from('candidates')
      .select('*', { count: 'exact' })
      .eq('admin_id', decoded.sub)

    // Status is enum — exact match is correct
    if (status) {
      query = query.eq('status', status)
    }
    // Position and location use ilike for partial/case-insensitive matching
    if (position) {
      query = query.ilike('position_applied', `%${position}%`)
    }
    if (location) {
      query = query.ilike('location', `%${location}%`)
    }
    // Full-text search on name and email
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Candidates GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data ?? [],
      pagination: { page, limit, total: count ?? 0 },
    })
  } catch (error) {
    console.error('Candidates GET unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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

    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid candidate ID required' }, { status: 400 })
    }

    // Verify ownership before deletion — prevents IDOR attacks
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('id', id)
      .eq('admin_id', decoded.sub)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('candidates')
      .delete()
      .eq('id', id)
      .eq('admin_id', decoded.sub) // double-check in delete too

    if (error) {
      console.error('Candidates DELETE error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Candidate deleted successfully' })
  } catch (error) {
    console.error('Candidates DELETE unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
