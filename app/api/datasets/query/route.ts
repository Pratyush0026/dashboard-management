import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/client'
import { verifyToken } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildAIContext } from '@/lib/dataset-analysis'
import type { ColumnMeta } from '@/lib/types'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) return NextResponse.json({ error: 'Database not configured' }, { status: 500 })

    const body = await request.json()
    const { datasetId, query } = body as { datasetId?: string; query?: string }

    if (!datasetId || !query) {
      return NextResponse.json({ error: 'Dataset ID and query are required' }, { status: 400 })
    }

    // Fetch dataset
    const { data: dataset, error: dsError } = await supabaseAdmin
      .from('datasets')
      .select('id, name, sheet_name, data, columns, column_stats, row_count')
      .eq('id', datasetId)
      .eq('admin_id', decoded.sub)
      .single()

    if (dsError || !dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    const rows = dataset.data as Record<string, unknown>[]
    const columns = dataset.columns as ColumnMeta[]
    const stats = dataset.column_stats

    const dataContext = buildAIContext(
      dataset.name,
      dataset.sheet_name || 'Sheet1',
      rows,
      columns,
      stats,
    )

    const systemPrompt = `You are an expert data analyst AI. The user has uploaded a dataset and you have been given:
1. Complete column metadata with types and statistics
2. Pre-computed cross-tabulations (these are 100% accurate — never recount them)
3. Pre-computed HR Business Segment Pivot Table (if applicable — use it exactly as provided)
4. Sample or full data rows

CRITICAL RULES:
- Use ONLY the pre-computed numbers from the context. NEVER manually count from row data.
- When you see a "HR BUSINESS SEGMENT PIVOT TABLE" in the context, use those exact numbers for any HR summary questions.
- Format tables using proper markdown table syntax with | separators.
- Do NOT use bold (**) for normal numbers — only use it for headers or grand totals in tables.
- When asked for a summary table, output a clean markdown table.
- Be concise and direct. Use tables for structured data, bullet points for lists.

${dataContext}`

    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent({
      systemInstruction: systemPrompt,
      contents: [{ role: 'user', parts: [{ text: query }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    })

    const response = result.response.text()

    // Save query to history
    await supabaseAdmin.from('ai_queries').insert([{
      admin_id: decoded.sub,
      dataset_id: datasetId,
      query,
      response,
    }])

    return NextResponse.json({ response })
  } catch (error: any) {
    console.error('Query error:', error)
    const errMsg = error?.message || String(error)
    let userFriendlyError = 'Failed to process query'

    if (errMsg.includes('Quota exceeded') || errMsg.includes('429') || error?.status === 429) {
      userFriendlyError = 'Gemini API quota exceeded (429). Please check your API key or billing/quota plan on Google AI Studio.'
    } else if (errMsg.includes('API key') || errMsg.includes('not found') || error?.status === 403) {
      userFriendlyError = 'Invalid Gemini API key. Please verify your API key configuration.'
    } else {
      userFriendlyError = `AI Query Failed: ${errMsg}`
    }

    return NextResponse.json({ error: userFriendlyError }, { status: 500 })
  }
}
