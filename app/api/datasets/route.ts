import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { analyzeColumns, analyzeDataset } from '@/lib/dataset-analysis'
import type { ColumnMeta } from '@/lib/types'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 })

    const { data: datasets, error } = await supabaseAdmin
      .from('datasets')
      .select('id, name, sheet_name, row_count, column_count, columns, uploaded_at')
      .eq('admin_id', decoded.sub)
      .order('uploaded_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Failed to fetch datasets' }, { status: 500 })

    return NextResponse.json({ datasets })
  } catch (error) {
    console.error('GET datasets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const sheetNameOverride = formData.get('sheetName') as string | null

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ]
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json({ error: 'Only Excel and CSV files are supported' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    let sheetName = sheetNameOverride || workbook.SheetNames[0]
    // Prefer 'Data' sheet if it exists
    if (workbook.SheetNames.includes('Data') && !sheetNameOverride) {
      sheetName = 'Data'
    }

    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) {
      return NextResponse.json({
        error: `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`
      }, { status: 400 })
    }

    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      raw: false,
    }) as Record<string, unknown>[]

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'No data found in the selected sheet' }, { status: 400 })
    }

    const columns = analyzeColumns(rawRows)
    const columnStats = analyzeDataset(rawRows, columns)

    const { data: dataset, error } = await supabaseAdmin
      .from('datasets')
      .insert([{
        admin_id: decoded.sub,
        name: file.name.replace(/\.[^/.]+$/, ''),
        sheet_name: sheetName,
        data: rawRows,
        columns: columns,
        column_stats: columnStats,
        row_count: rawRows.length,
        column_count: columns.length,
      }])
      .select('id, name, sheet_name, row_count, column_count, columns, uploaded_at')
      .single()

    if (error || !dataset) {
      console.error('Dataset insert error:', error)
      return NextResponse.json({ error: 'Failed to save dataset' }, { status: 500 })
    }

    return NextResponse.json({
      dataset,
      sheet_names: workbook.SheetNames,
    }, { status: 201 })
  } catch (error) {
    console.error('POST datasets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Dataset ID is required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('datasets')
      .delete()
      .eq('id', id)
      .eq('admin_id', decoded.sub)

    if (error) return NextResponse.json({ error: 'Failed to delete dataset' }, { status: 500 })

    return NextResponse.json({ message: 'Dataset deleted' })
  } catch (error) {
    console.error('DELETE datasets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
