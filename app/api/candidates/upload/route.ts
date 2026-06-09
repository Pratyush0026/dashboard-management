import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'

const MAX_BATCH_SIZE = 500

interface RawCandidate {
  name?: unknown
  email?: unknown
  phone?: unknown
  position_applied?: unknown
  education?: unknown
  experience_years?: unknown
  skills?: unknown
  salary_expectation?: unknown
  location?: unknown
  status?: unknown
}

type ProcessedCandidate = {
  admin_id: string
  name: string
  email: string
  phone: string
  position_applied: string
  education: string
  experience_years: number
  skills: string
  salary_expectation: string
  location: string
  status: string
}

function str(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback
  return String(val).trim().slice(0, 500)
}

const VALID_STATUSES = new Set(['Applied', 'Interviewing', 'Offer', 'Rejected'])

function parseStatus(val: unknown): string {
  const s = str(val)
  return VALID_STATUSES.has(s) ? s : 'Applied'
}

export async function POST(request: NextRequest) {
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
    const { candidates, filename = 'unknown.xlsx' } = body as {
      candidates: RawCandidate[]
      filename?: string
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: 'No candidate data provided' }, { status: 400 })
    }

    if (candidates.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} rows` },
        { status: 400 }
      )
    }

    // ── Step 1: Validate and map incoming rows ────────────────────
    const validRows: ProcessedCandidate[] = []
    let validationSkipped = 0

    candidates.forEach((c) => {
      const name = str(c.name)
      const email = str(c.email).toLowerCase()
      const position = str(c.position_applied)

      // Skip rows missing required fields
      if (!name || !email || !position) {
        validationSkipped++
        return
      }

      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        validationSkipped++
        return
      }

      validRows.push({
        admin_id: decoded.sub,
        name,
        email,
        phone: str(c.phone),
        position_applied: position,
        education: str(c.education),
        experience_years: Math.max(0, parseInt(String(c.experience_years)) || 0),
        skills: Array.isArray(c.skills)
          ? (c.skills as string[]).join(', ')
          : str(c.skills),
        salary_expectation: str(c.salary_expectation),
        location: str(c.location),
        status: parseStatus(c.status),
      })
    })

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found. Ensure name, email, and position_applied columns are filled.' },
        { status: 400 }
      )
    }

    // ── Step 2: Fetch existing emails (chunked to avoid URL length limits) ──
    // PostgREST encodes .in() as a URL param — 500 emails can exceed 8KB limit.
    // We chunk into batches of 100 and merge results.
    const incomingEmails = validRows.map((r) => r.email)
    const CHUNK_SIZE = 100
    const existingEmails: string[] = []

    for (let i = 0; i < incomingEmails.length; i += CHUNK_SIZE) {
      const chunk = incomingEmails.slice(i, i + CHUNK_SIZE)
      const { data: chunkData } = await supabaseAdmin
        .from('candidates')
        .select('email')
        .eq('admin_id', decoded.sub)
        .in('email', chunk)

      if (chunkData) {
        existingEmails.push(...chunkData.map((r: { email: string }) => r.email))
      }
    }

    const existingEmailSet = new Set(existingEmails)


    // ── Step 3: Filter out duplicates ────────────────────────────
    const newRows = validRows.filter((r) => !existingEmailSet.has(r.email))
    const duplicateSkipped = validRows.length - newRows.length
    const totalSkipped = validationSkipped + duplicateSkipped

    let inserted = 0

    // ── Step 4: Insert only new rows ─────────────────────────────
    if (newRows.length > 0) {
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('candidates')
        .insert(newRows)
        .select('id')

      if (insertError) {
        console.error('Upload insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      inserted = insertedData?.length ?? 0
    }

    // ── Step 5: Record upload session (best-effort) ───────────────
    // upload_sessions table may not exist yet — don't fail if it doesn't
    await supabaseAdmin
      .from('upload_sessions')
      .insert([
        {
          admin_id: decoded.sub,
          filename: str(filename, 'unknown.xlsx').slice(0, 255),
          total_rows: candidates.length,
          inserted,
          skipped: totalSkipped,
        },
      ])
      .then(() => null)
      .catch(() => null) // silently ignore if table doesn't exist

    return NextResponse.json(
      {
        message: 'Upload complete',
        inserted,
        skipped: totalSkipped,
        total: candidates.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Upload unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
