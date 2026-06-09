import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'

// Top-level ESM import — initialized lazily to avoid build-time key check
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

const MAX_QUERY_LENGTH = 500
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX_QUERIES = 10
const CONTEXT_CANDIDATE_LIMIT = 100 // max candidates sent to AI (token savings)
const HISTORY_CONTEXT_PAIRS = 5 // last N Q&A pairs included for continuity

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json(
        { error: 'AI service not configured. Please set OPENAI_API_KEY.' },
        { status: 503 }
      )
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
    const { query } = body as { query?: string }

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const trimmedQuery = query.trim().slice(0, MAX_QUERY_LENGTH)
    if (!trimmedQuery) {
      return NextResponse.json({ error: 'Query cannot be empty' }, { status: 400 })
    }

    // ── Rate limiting: count queries in last window ──────────────
    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000
    ).toISOString()

    const { count: recentCount } = await supabaseAdmin
      .from('ai_queries')
      .select('id', { count: 'exact', head: true })
      .eq('admin_id', decoded.sub)
      .gte('created_at', windowStart)

    if ((recentCount ?? 0) >= RATE_LIMIT_MAX_QUERIES) {
      return NextResponse.json(
        { error: `Rate limit reached. Maximum ${RATE_LIMIT_MAX_QUERIES} queries per minute.` },
        { status: 429 }
      )
    }

    // ── Fetch candidates (limit columns and rows to reduce tokens) ──
    const { data: candidates } = await supabaseAdmin
      .from('candidates')
      .select('name,email,position_applied,experience_years,skills,location,status')
      .eq('admin_id', decoded.sub)
      .limit(CONTEXT_CANDIDATE_LIMIT)
      .order('created_at', { ascending: false })

    if (!candidates || candidates.length === 0) {
      return NextResponse.json(
        {
          response:
            "You don't have any candidates yet. Please upload an Excel file with candidate data first, then I can help you analyze it.",
        }
      )
    }

    // ── Fetch recent chat history for context continuity ──────────
    const { data: history } = await supabaseAdmin
      .from('ai_queries')
      .select('query,response')
      .eq('admin_id', decoded.sub)
      .order('created_at', { ascending: false })
      .limit(HISTORY_CONTEXT_PAIRS)

    // ── Build compact candidate context ──────────────────────────
    const candidateContext = (candidates as Array<{
      name: string
      position_applied: string
      experience_years: number
      location: string
      status: string
      skills: string
    }>)
      .map(
        (c) =>
          `${c.name} | ${c.position_applied} | ${c.experience_years}yr | ${c.location} | ${c.status} | Skills: ${c.skills}`
      )
      .join('\n')

    const totalCount = candidates.length
    const truncationNote =
      totalCount === CONTEXT_CANDIDATE_LIMIT
        ? `\n(Showing most recent ${CONTEXT_CANDIDATE_LIMIT} candidates)`
        : ''

    const systemPrompt = `You are TalentHub AI, an expert HR analytics assistant. You have access to candidate data and provide concise, data-driven insights.

Guidelines:
- Be direct and specific — avoid verbose filler text
- When listing candidates, use a table format (| col | col |)
- Summarize counts and percentages when relevant
- If asked for top candidates, rank them with reasoning

Candidate Data (${totalCount} candidates${truncationNote}):
Name | Position | Experience | Location | Status | Skills
${candidateContext}`

    // Build messages array with history for context
    const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (history && history.length > 0) {
      // Reverse to get chronological order (oldest first)
      const chronological = [...history].reverse()
      for (const h of chronological) {
        historyMessages.push({ role: 'user', content: h.query })
        historyMessages.push({ role: 'assistant', content: h.response })
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: trimmedQuery },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    })

    const response =
      completion.choices[0]?.message?.content?.trim() || 'No response generated.'

    // ── Persist query + response for history ──────────────────────
    await supabaseAdmin.from('ai_queries').insert([
      {
        admin_id: decoded.sub,
        query: trimmedQuery,
        response,
      },
    ])

    return NextResponse.json({ response })
  } catch (error) {
    console.error('AI Query error:', error)
    // Don't expose internal error details to client
    return NextResponse.json(
      { error: 'Failed to process your query. Please try again.' },
      { status: 500 }
    )
  }
}
