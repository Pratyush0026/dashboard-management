// ─── Column Types ──────────────────────────────────────────
export type ColumnType = 'numeric' | 'categorical' | 'boolean' | 'date' | 'text'

export interface ColumnMeta {
  name: string
  type: ColumnType
  unique_count: number
  null_count: number
  sample_values: string[]
}

// ─── Column Statistics ─────────────────────────────────────
export interface NumericStats {
  min: number
  max: number
  avg: number
  sum: number
  count: number
  null_count: number
}

export interface CategoricalStats {
  value_counts: Record<string, number>
  unique_count: number
  null_count: number
  top_values: { value: string; count: number }[]
}

export interface DateStats {
  min: string
  max: string
  null_count: number
}

export interface ColumnStatsEntry {
  type: ColumnType
  null_count: number
  numeric?: NumericStats
  categorical?: CategoricalStats
  date?: DateStats
}

// ─── Cross-Tabulation ──────────────────────────────────────
export interface CrossTab {
  row_column: string
  col_column: string
  table: Record<string, Record<string, number>>
  row_totals: Record<string, number>
  col_totals: Record<string, number>
  grand_total: number
}

// ─── Full Dataset Statistics ───────────────────────────────
export interface DatasetStats {
  columns: Record<string, ColumnStatsEntry>
  cross_tabs: CrossTab[]
  row_count: number
  column_count: number
}

// ─── Dataset Row ───────────────────────────────────────────
export type DataRow = Record<string, unknown>
