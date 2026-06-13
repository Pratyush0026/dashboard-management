/**
 * Dataset Analysis Engine
 *
 * Server-side analysis for 100% accurate aggregations.
 * The AI never counts rows — this engine does all the math.
 */

import type {
  ColumnMeta,
  ColumnType,
  ColumnStatsEntry,
  DatasetStats,
  CrossTab,
  NumericStats,
  CategoricalStats,
  DateStats,
} from '@/lib/types'

type Row = Record<string, unknown>

// ─── Column Type Detection ──────────────────────────────────

const DATE_PATTERNS = [
  /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/,
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/,
  /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,
  /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\s/,
]

function isDateLike(val: string): boolean {
  const trimmed = val.trim()
  if (!trimmed) return false
  if (DATE_PATTERNS.some((p) => p.test(trimmed))) return true
  if (/[a-zA-Z]/.test(trimmed) && !isNaN(Date.parse(trimmed))) return true
  return false
}

function isNumericLike(val: string): boolean {
  if (!val.trim()) return false
  const cleaned = val.trim().replace(/[,₹$€£¥]/g, '').replace(/\s/g, '')
  if (cleaned === '') return false
  return !isNaN(Number(cleaned)) && isFinite(Number(cleaned))
}

function isBooleanLike(val: string): boolean {
  const lower = val.trim().toLowerCase()
  return ['true', 'false', 'yes', 'no', '0', '1'].includes(lower)
}

function parseNumeric(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).trim().replace(/[,₹$€£¥]/g, '').replace(/\s/g, '')
  const n = Number(s)
  return isNaN(n) || !isFinite(n) ? null : n
}

export function detectColumnType(values: unknown[]): ColumnType {
  const nonNull = values
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
    .map((v) => String(v))

  if (nonNull.length === 0) return 'text'

  const sample = nonNull.length > 100 ? nonNull.slice(0, 100) : nonNull

  const boolCount = sample.filter(isBooleanLike).length
  if (boolCount / sample.length > 0.8) return 'boolean'

  const dateCount = sample.filter(isDateLike).length
  if (dateCount / sample.length > 0.7) return 'date'

  const numCount = sample.filter(isNumericLike).length
  if (numCount / sample.length > 0.7) return 'numeric'

  const uniqueValues = new Set(nonNull.map((v) => v.toLowerCase().trim()))
  const uniqueRatio = uniqueValues.size / nonNull.length

  if (uniqueValues.size <= 50 && uniqueRatio < 0.5) return 'categorical'
  if (uniqueValues.size <= 20) return 'categorical'

  return 'text'
}

// ─── Column Metadata Detection ──────────────────────────────

export function analyzeColumns(rows: Row[]): ColumnMeta[] {
  if (rows.length === 0) return []

  const colNames = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      colNames.add(key)
    }
  }

  const columns: ColumnMeta[] = []

  for (const name of colNames) {
    const values = rows.map((r) => r[name])
    const type = detectColumnType(values)
    const nonNull = values.filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== ''
    )
    const uniqueValues = new Set(nonNull.map((v) => String(v).trim()))

    columns.push({
      name,
      type,
      unique_count: uniqueValues.size,
      null_count: rows.length - nonNull.length,
      sample_values: Array.from(uniqueValues).slice(0, 5),
    })
  }

  return columns
}

// ─── Per-Column Statistics ──────────────────────────────────

function computeNumericStats(values: unknown[]): NumericStats {
  const nums: number[] = []
  let nullCount = 0

  for (const v of values) {
    const n = parseNumeric(v)
    if (n !== null) {
      nums.push(n)
    } else {
      nullCount++
    }
  }

  if (nums.length === 0) {
    return { min: 0, max: 0, avg: 0, sum: 0, count: 0, null_count: nullCount }
  }

  const sum = nums.reduce((a, b) => a + b, 0)
  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    avg: Math.round((sum / nums.length) * 100) / 100,
    sum: Math.round(sum * 100) / 100,
    count: nums.length,
    null_count: nullCount,
  }
}

function computeCategoricalStats(values: unknown[]): CategoricalStats {
  const counts: Record<string, number> = {}
  let nullCount = 0

  for (const v of values) {
    const s = v !== null && v !== undefined ? String(v).trim() : ''
    if (s === '') {
      nullCount++
      continue
    }
    counts[s] = (counts[s] || 0) + 1
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }))

  return {
    value_counts: counts,
    unique_count: Object.keys(counts).length,
    null_count: nullCount,
    top_values: sorted.slice(0, 30),
  }
}

function computeDateStats(values: unknown[]): DateStats {
  let nullCount = 0
  const dates: string[] = []

  for (const v of values) {
    const s = v !== null && v !== undefined ? String(v).trim() : ''
    if (s === '') {
      nullCount++
      continue
    }
    dates.push(s)
  }

  dates.sort()

  return {
    min: dates[0] || '',
    max: dates[dates.length - 1] || '',
    null_count: nullCount,
  }
}

function computeColumnStats(
  values: unknown[],
  type: ColumnType
): ColumnStatsEntry {
  const nullCount = values.filter(
    (v) => v === null || v === undefined || String(v).trim() === ''
  ).length

  const entry: ColumnStatsEntry = { type, null_count: nullCount }

  switch (type) {
    case 'numeric':
      entry.numeric = computeNumericStats(values)
      break
    case 'categorical':
    case 'boolean':
      entry.categorical = computeCategoricalStats(values)
      break
    case 'date':
      entry.date = computeDateStats(values)
      entry.categorical = computeCategoricalStats(values)
      break
    case 'text': {
      const uniqueCount = new Set(
        values
          .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
          .map((v) => String(v).trim())
      ).size
      if (uniqueCount <= 100) {
        entry.categorical = computeCategoricalStats(values)
      }
      break
    }
  }

  return entry
}

// ─── Cross-Tabulation ───────────────────────────────────────

function computeCrossTab(
  rows: Row[],
  rowCol: string,
  colCol: string
): CrossTab {
  const table: Record<string, Record<string, number>> = {}
  const rowTotals: Record<string, number> = {}
  const colTotals: Record<string, number> = {}
  let grandTotal = 0

  for (const row of rows) {
    const rowVal = row[rowCol] !== null && row[rowCol] !== undefined
      ? String(row[rowCol]).trim()
      : ''
    const colVal = row[colCol] !== null && row[colCol] !== undefined
      ? String(row[colCol]).trim()
      : ''

    if (!rowVal || !colVal) continue

    if (!table[rowVal]) table[rowVal] = {}
    table[rowVal][colVal] = (table[rowVal][colVal] || 0) + 1
    rowTotals[rowVal] = (rowTotals[rowVal] || 0) + 1
    colTotals[colVal] = (colTotals[colVal] || 0) + 1
    grandTotal++
  }

  return {
    row_column: rowCol,
    col_column: colCol,
    table,
    row_totals: rowTotals,
    col_totals: colTotals,
    grand_total: grandTotal,
  }
}

// ─── HR Business Segment Analysis ──────────────────────────

interface BusinessSegmentPivot {
  segment: string
  lineUps: number
  interviewDone: number
  selected: number
  offerReleased: number
  joined: number
  yetToJoin: number
  offerInProcess: number
}

function computeHRBusinessPivot(rows: Row[]): BusinessSegmentPivot[] | null {
  // Check if this looks like the HR dataset (has Clients, Zone, Interview status columns)
  const hasClients = rows.some(r => r['Clients'] !== undefined)
  const hasZone = rows.some(r => r['Zone'] !== undefined)
  const hasInterviewStatus = rows.some(r => r['Interview status(attended/not attended)'] !== undefined)
  
  if (!hasClients || !hasZone || !hasInterviewStatus) return null

  const segmentMap: Record<string, BusinessSegmentPivot> = {}

  const getSegment = (row: Row): string | null => {
    const client = String(row['Clients'] || '').trim()
    const zone = String(row['Zone'] || '').trim()
    const prefLoc = String(row['Preferred Location'] || row['Current Location'] || '').toLowerCase()

    let simplified = ''
    if (/agency/i.test(client)) simplified = 'Agency'
    else if (/banca/i.test(client)) simplified = 'Banca'
    else if (/poc/i.test(client)) simplified = 'POC'
    else if (/telesales/i.test(client)) simplified = 'Telesales'
    else return null

    if (simplified === 'POC') {
      const isNCR = /noida|delhi|ncr/i.test(prefLoc)
      return isNCR ? 'POC - NCR' : 'POC - West & South'
    }

    if (simplified === 'Telesales') {
      const isNoida = /noida/i.test(prefLoc)
      return isNoida ? 'Telesales - Noida' : 'Telesales - South'
    }

    if (zone) return `${simplified} - ${zone}`
    return null
  }

  const ORDER = [
    'Agency - North',
    'Agency - South', 
    'Agency - West',
    'Agency - East',
    'Banca - North',
    'Banca - South',
    'Banca - West',
    'Banca - East',
    'POC - NCR',
    'POC - West & South',
    'Telesales - Noida',
    'Telesales - South',
  ]

  for (const seg of ORDER) {
    segmentMap[seg] = {
      segment: seg,
      lineUps: 0,
      interviewDone: 0,
      selected: 0,
      offerReleased: 0,
      joined: 0,
      yetToJoin: 0,
      offerInProcess: 0,
    }
  }

  for (const row of rows) {
    const seg = getSegment(row)
    if (!seg || !segmentMap[seg]) continue

    segmentMap[seg].lineUps++

    const interview = String(row['Interview status(attended/not attended)'] || '').trim().toLowerCase()
    if (interview === 'attended') segmentMap[seg].interviewDone++

    const selReject = String(row['Select/ Reject'] || '').trim().toLowerCase()
    if (selReject === 'selected') segmentMap[seg].selected++

    const docStatus = String(row['Documentation Status'] || '').trim().toLowerCase()
    const doj = String(row['DOJ'] || '').trim()
    const joiningStatus = String(row['Joining Status'] || '').trim().toLowerCase()

    if (docStatus === 'done' || docStatus === 'yes') {
      segmentMap[seg].offerReleased++
    }

    if (doj && selReject === 'selected') {
      segmentMap[seg].joined++
    }

    if (selReject === 'selected' && !doj) {
      segmentMap[seg].yetToJoin++
    }

    if (selReject === 'selected' && !docStatus) {
      segmentMap[seg].offerInProcess++
    }
  }

  return ORDER
    .filter(seg => segmentMap[seg].lineUps > 0)
    .map(seg => segmentMap[seg])
}

// ─── Full Dataset Analysis ──────────────────────────────────

export function analyzeDataset(rows: Row[], columns: ColumnMeta[]): DatasetStats {
  const columnStats: Record<string, ColumnStatsEntry> = {}

  for (const col of columns) {
    const values = rows.map((r) => r[col.name])
    columnStats[col.name] = computeColumnStats(values, col.type)
  }

  const categoricalCols = columns.filter(
    (c) =>
      (c.type === 'categorical' || c.type === 'boolean') &&
      c.unique_count <= 25 &&
      c.unique_count >= 2
  )

  const crossTabs: CrossTab[] = []
  const maxCrossTabs = 15
  let crossTabCount = 0

  for (let i = 0; i < categoricalCols.length && crossTabCount < maxCrossTabs; i++) {
    for (let j = i + 1; j < categoricalCols.length && crossTabCount < maxCrossTabs; j++) {
      crossTabs.push(
        computeCrossTab(rows, categoricalCols[i].name, categoricalCols[j].name)
      )
      crossTabCount++
    }
  }

  // Add HR-specific cross tabs if applicable
  const clientCol = columns.find(c => c.name === 'Clients')
  const zoneCol = columns.find(c => c.name === 'Zone')
  const selRejectCol = columns.find(c => c.name === 'Select/ Reject')
  const interviewCol = columns.find(c => c.name === 'Interview status(attended/not attended)')

  if (clientCol && zoneCol && crossTabCount < maxCrossTabs) {
    crossTabs.push(computeCrossTab(rows, 'Clients', 'Zone'))
    crossTabCount++
  }
  if (clientCol && selRejectCol && crossTabCount < maxCrossTabs) {
    crossTabs.push(computeCrossTab(rows, 'Clients', 'Select/ Reject'))
    crossTabCount++
  }
  if (clientCol && interviewCol && crossTabCount < maxCrossTabs) {
    crossTabs.push(computeCrossTab(rows, 'Clients', 'Interview status(attended/not attended)'))
    crossTabCount++
  }

  return {
    columns: columnStats,
    cross_tabs: crossTabs,
    row_count: rows.length,
    column_count: columns.length,
  }
}

// ─── AI Context Builder ─────────────────────────────────────

function formatCrossTabAsTable(ct: CrossTab): string {
  const colValues = Object.keys(ct.col_totals).sort()
  const rowValues = Object.keys(ct.row_totals).sort()

  if (colValues.length === 0 || rowValues.length === 0) return ''

  let table = `\n${ct.row_column} × ${ct.col_column}:\n`
  table += `| ${ct.row_column} | ${colValues.join(' | ')} | Total |\n`
  table += `| ${'-'.repeat(ct.row_column.length)} | ${colValues.map((c) => '-'.repeat(c.length)).join(' | ')} | ----- |\n`

  for (const rv of rowValues) {
    const cells = colValues.map((cv) => String(ct.table[rv]?.[cv] || 0))
    table += `| ${rv} | ${cells.join(' | ')} | ${ct.row_totals[rv]} |\n`
  }

  const totalCells = colValues.map((cv) => String(ct.col_totals[cv] || 0))
  table += `| **Total** | ${totalCells.join(' | ')} | ${ct.grand_total} |\n`

  return table
}

export function buildAIContext(
  datasetName: string,
  sheetName: string,
  rows: Row[],
  columns: ColumnMeta[],
  stats: DatasetStats
): string {
  const parts: string[] = []

  parts.push(
    `=== DATASET: "${datasetName}" (Sheet: ${sheetName}) ===`,
    `Total: ${stats.row_count} rows × ${stats.column_count} columns\n`
  )

  parts.push('COLUMNS:')
  for (const col of columns) {
    let desc = `• ${col.name} (${col.type})`
    if (col.null_count > 0) desc += ` — ${col.null_count} nulls`

    const cs = stats.columns[col.name]
    if (cs?.numeric) {
      const n = cs.numeric
      desc += ` — range: ${n.min}–${n.max}, avg: ${n.avg}, sum: ${n.sum}`
    }
    if (cs?.categorical && col.type === 'categorical') {
      const top = cs.categorical.top_values.slice(0, 10)
      desc += ` — ${cs.categorical.unique_count} unique: ${top.map((t) => `${t.value}(${t.count})`).join(', ')}`
    }
    if (cs?.categorical && col.type === 'boolean') {
      const top = cs.categorical.top_values
      desc += ` — ${top.map((t) => `${t.value}(${t.count})`).join(', ')}`
    }
    if (cs?.date) {
      desc += ` — range: ${cs.date.min} to ${cs.date.max}`
    }
    parts.push(desc)
  }

  parts.push('\nDETAILED VALUE COUNTS:')
  for (const col of columns) {
    const cs = stats.columns[col.name]
    if (cs?.categorical && (col.type === 'categorical' || col.type === 'boolean')) {
      parts.push(`\n${col.name}:`)
      for (const tv of cs.categorical.top_values) {
        parts.push(`  ${tv.value}: ${tv.count}`)
      }
    }
  }

  if (stats.cross_tabs.length > 0) {
    parts.push('\n\nPRE-COMPUTED CROSS-TABULATIONS (use these numbers — they are 100% accurate):')
    for (const ct of stats.cross_tabs) {
      const rowCount = Object.keys(ct.row_totals).length
      const colCount = Object.keys(ct.col_totals).length
      if (rowCount > 0 && colCount > 0 && rowCount <= 25 && colCount <= 25) {
        parts.push(formatCrossTabAsTable(ct))
      }
    }
  }

  // HR Business Pivot Table
  const hrPivot = computeHRBusinessPivot(rows)
  if (hrPivot && hrPivot.length > 0) {
    parts.push('\n\nHR BUSINESS SEGMENT PIVOT TABLE (pre-computed, 100% accurate):')
    parts.push('This table groups candidates by Client-Zone Business segments with full funnel metrics.')
    parts.push('| Business | Line Ups | Interview Done | Selected | Offer Released | Joined | Yet to Join | Offer in Process |')
    parts.push('| -------- | -------- | -------------- | -------- | -------------- | ------ | ----------- | ---------------- |')

    let totalLineUps = 0, totalInterview = 0, totalSelected = 0
    let totalOffer = 0, totalJoined = 0, totalYet = 0, totalProcess = 0

    for (const seg of hrPivot) {
      parts.push(`| ${seg.segment} | ${seg.lineUps} | ${seg.interviewDone} | ${seg.selected} | ${seg.offerReleased} | ${seg.joined} | ${seg.yetToJoin} | ${seg.offerInProcess} |`)
      totalLineUps += seg.lineUps
      totalInterview += seg.interviewDone
      totalSelected += seg.selected
      totalOffer += seg.offerReleased
      totalJoined += seg.joined
      totalYet += seg.yetToJoin
      totalProcess += seg.offerInProcess
    }

    parts.push(`| **Grand Total** | **${totalLineUps}** | **${totalInterview}** | **${totalSelected}** | **${totalOffer}** | **${totalJoined}** | **${totalYet}** | **${totalProcess}** |`)
  }

  const colNames = columns.map((c) => c.name)

  if (rows.length <= 300) {
    parts.push(`\n\nFULL DATA (all ${rows.length} rows):`)
    parts.push(colNames.join(' | '))
    for (const row of rows) {
      const cells = colNames.map((c) => {
        const v = row[c]
        return v !== null && v !== undefined ? String(v).trim() : ''
      })
      parts.push(cells.join(' | '))
    }
  } else {
    const sampleSize = 20
    parts.push(`\n\nSAMPLE DATA (first ${sampleSize} of ${rows.length} rows):`)
    parts.push(colNames.join(' | '))
    for (const row of rows.slice(0, sampleSize)) {
      const cells = colNames.map((c) => {
        const v = row[c]
        return v !== null && v !== undefined ? String(v).trim() : ''
      })
      parts.push(cells.join(' | '))
    }
    parts.push(`... (${rows.length - sampleSize} more rows — use the PRE-COMPUTED statistics above for aggregation questions)`)
  }

  return parts.join('\n')
}
