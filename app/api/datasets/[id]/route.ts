import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'

export const maxDuration = 30

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 })

    const { id } = await params

    const { data: dataset, error } = await supabaseAdmin
      .from('datasets')
      .select('id, name, sheet_name, data, columns, row_count, column_count, uploaded_at')
      .eq('id', id)
      .eq('admin_id', decoded.sub)
      .single()

    if (error || !dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    return NextResponse.json({ dataset })
  } catch (error) {
    console.error('GET dataset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
