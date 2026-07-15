'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Table2,
  Loader2,
  AlertCircle,
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react'

interface Column {
  name: string
  type: string
  unique_count?: number
  null_count?: number
  sample_values?: string[]
}

interface Dataset {
  id: string
  name: string
  sheet_name: string
  row_count: number
  column_count: number
  columns: Column[]
  uploaded_at: string
}

type DataRow = Record<string, unknown>

interface DataExplorerProps {
  dataset: Dataset | null
  onSwitchToDatasets: () => void
}

type FilterKind = 'select' | 'range' | 'date' | 'search'

interface FilterableColumn extends Column {
  kind: FilterKind
}

interface NumericRange {
  min: string
  max: string
}

interface DateRange {
  from: string
  to: string
}

const PAGE_SIZE = 25
// Beyond this many unique values a free-text column is treated as a search box
// instead of a checklist — a 300-option dropdown isn't a usable filter.
const MAX_SELECT_OPTIONS_FOR_TEXT = 30
const DROPDOWN_WIDTH = 224

function classifyColumn(col: Column): FilterKind {
  if (col.type === 'numeric') return 'range'
  if (col.type === 'date') return 'date'
  if (col.type === 'categorical' || col.type === 'boolean') return 'select'
  return (col.unique_count ?? Infinity) <= MAX_SELECT_OPTIONS_FOR_TEXT ? 'select' : 'search'
}

function cellText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function parseNumericCell(value: unknown): number | null {
  const s = cellText(value).replace(/[,₹$€£¥]/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export default function DataExplorer({ dataset, onSwitchToDatasets }: DataExplorerProps) {
  const [rows, setRows] = useState<DataRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const [selectFilters, setSelectFilters] = useState<Record<string, string[]>>({})
  const [rangeFilters, setRangeFilters] = useState<Record<string, NumericRange>>({})
  const [dateFilters, setDateFilters] = useState<Record<string, DateRange>>({})
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!dataset) {
      setRows([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setSelectFilters({})
    setRangeFilters({})
    setDateFilters({})
    setSearchFilters({})

    const token = localStorage.getItem('admin_token')
    fetch(`/api/datasets/${dataset.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load dataset rows')
        if (!cancelled) setRows((data.dataset.data as DataRow[]) || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load dataset rows')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [dataset])

  const filterableColumns: FilterableColumn[] = useMemo(() => {
    if (!dataset) return []
    return dataset.columns
      .filter((c) => (c.unique_count ?? 1) > 1)
      .map((c) => ({ ...c, kind: classifyColumn(c) }))
  }, [dataset])

  const selectOptions = useMemo(() => {
    const options: Record<string, { value: string; count: number }[]> = {}
    for (const col of filterableColumns) {
      if (col.kind !== 'select') continue
      const counts = new Map<string, number>()
      for (const row of rows) {
        const val = cellText(row[col.name])
        if (!val) continue
        counts.set(val, (counts.get(val) || 0) + 1)
      }
      options[col.name] = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
    }
    return options
  }, [rows, filterableColumns])

  const filteredRows = useMemo(() => {
    const activeSelect = Object.entries(selectFilters).filter(([, v]) => v.length > 0)
    const activeRange = Object.entries(rangeFilters).filter(([, v]) => v.min !== '' || v.max !== '')
    const activeDate = Object.entries(dateFilters).filter(([, v]) => v.from !== '' || v.to !== '')
    const activeSearch = Object.entries(searchFilters).filter(([, v]) => v.trim() !== '')

    if (!activeSelect.length && !activeRange.length && !activeDate.length && !activeSearch.length) {
      return rows
    }

    return rows.filter((row) => {
      for (const [col, selected] of activeSelect) {
        if (!selected.includes(cellText(row[col]))) return false
      }

      for (const [col, range] of activeRange) {
        const num = parseNumericCell(row[col])
        if (num === null) return false
        if (range.min !== '' && num < Number(range.min)) return false
        if (range.max !== '' && num > Number(range.max)) return false
      }

      for (const [col, range] of activeDate) {
        const t = Date.parse(cellText(row[col]))
        if (Number.isNaN(t)) return false
        if (range.from && t < Date.parse(range.from)) return false
        // add a day so the "to" bound includes the whole selected day
        if (range.to && t >= Date.parse(range.to) + 86_400_000) return false
      }

      for (const [col, term] of activeSearch) {
        if (!cellText(row[col]).toLowerCase().includes(term.trim().toLowerCase())) return false
      }

      return true
    })
  }, [rows, selectFilters, rangeFilters, dateFilters, searchFilters])

  useEffect(() => {
    setPage(1)
  }, [selectFilters, rangeFilters, dateFilters, searchFilters, dataset])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasActiveFilters =
    Object.values(selectFilters).some((v) => v.length > 0) ||
    Object.values(rangeFilters).some((v) => v.min !== '' || v.max !== '') ||
    Object.values(dateFilters).some((v) => v.from !== '' || v.to !== '') ||
    Object.values(searchFilters).some((v) => v.trim() !== '')

  const clearAllFilters = () => {
    setSelectFilters({})
    setRangeFilters({})
    setDateFilters({})
    setSearchFilters({})
  }

  if (!dataset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
        <div className="w-20 h-20 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-6">
          <Table2 className="w-10 h-10 text-primary-300" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Dataset Selected</h3>
        <p className="text-gray-400 text-sm max-w-xs mb-6">
          Upload a dataset first to explore and filter its rows
        </p>
        <button
          onClick={onSwitchToDatasets}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-primary-500/25"
        >
          Go to Datasets
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50">
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center">
            <Table2 className="w-4 h-4 text-primary-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{dataset.name}</h2>
            <p className="text-xs text-gray-400">
              {loading
                ? 'Loading rows...'
                : `Showing ${filteredRows.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`}
            </p>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear all filters
          </button>
        )}
      </div>

      {filterableColumns.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-2 overflow-x-auto flex-shrink-0 scrollbar-thin">
          <SlidersHorizontal className="w-4 h-4 text-gray-300 flex-shrink-0" />
          {filterableColumns.map((col) => {
            if (col.kind === 'select') {
              return (
                <SelectFilter
                  key={col.name}
                  label={col.name}
                  options={selectOptions[col.name] || []}
                  selected={selectFilters[col.name] || []}
                  onChange={(values) =>
                    setSelectFilters((prev) => ({ ...prev, [col.name]: values }))
                  }
                />
              )
            }
            if (col.kind === 'range') {
              return (
                <RangeFilter
                  key={col.name}
                  label={col.name}
                  value={rangeFilters[col.name] || { min: '', max: '' }}
                  onChange={(value) => setRangeFilters((prev) => ({ ...prev, [col.name]: value }))}
                />
              )
            }
            if (col.kind === 'date') {
              return (
                <DateFilter
                  key={col.name}
                  label={col.name}
                  value={dateFilters[col.name] || { from: '', to: '' }}
                  onChange={(value) => setDateFilters((prev) => ({ ...prev, [col.name]: value }))}
                />
              )
            }
            return (
              <SearchFilter
                key={col.name}
                label={col.name}
                value={searchFilters[col.name] || ''}
                onChange={(value) => setSearchFilters((prev) => ({ ...prev, [col.name]: value }))}
              />
            )
          })}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="text-sm">Loading rows...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <Search className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-400">
              {rows.length === 0 ? 'This dataset has no rows' : 'No rows match the current filters'}
            </p>
          </div>
        ) : (
          <table className="min-w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                {dataset.columns.map((col) => (
                  <th
                    key={col.name}
                    className="text-left px-3 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wide border-b border-gray-200 whitespace-nowrap"
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {pageRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 border-b border-gray-100">
                  {dataset.columns.map((col) => (
                    <td
                      key={col.name}
                      className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate"
                      title={cellText(row[col.name])}
                    >
                      {cellText(row[col.name]) || <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && filteredRows.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: string; count: number }[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8)
    setPosition({ top: rect.bottom + 6, left: Math.max(8, left) })
  }

  // Recompute right before paint so the panel never flashes at (0, 0) on open.
  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
      setSearch('')
    }

    // The panel is portaled out of the scrollable filter bar, so it has to
    // track the trigger button's position manually as the page scrolls/resizes.
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  const visibleOptions = search
    ? options.filter((o) => o.value.toLowerCase().includes(search.toLowerCase()))
    : options

  const toggleValue = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
          selected.length > 0
            ? 'border-primary-300 bg-primary-50 text-primary-700'
            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-primary-500 text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px]">
            {selected.length}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: position.top, left: position.left, width: DROPDOWN_WIDTH }}
            className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2"
          >
            {options.length > 8 && (
              <input
                type="text"
                placeholder={`Search ${label.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full mb-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                autoFocus
              />
            )}
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {visibleOptions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No matches</p>
              ) : (
                visibleOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.value)}
                      onChange={() => toggleValue(opt.value)}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500/40"
                    />
                    <span className="flex-1 truncate text-gray-700">{opt.value}</span>
                    <span className="text-gray-400">{opt.count}</span>
                  </label>
                ))
              )}
            </div>
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="w-full mt-2 text-xs text-red-500 hover:text-red-600 text-center py-1 border-t border-gray-100 pt-2"
              >
                Clear
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

function RangeFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: NumericRange
  onChange: (value: NumericRange) => void
}) {
  const active = value.min !== '' || value.max !== ''

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs flex-shrink-0 ${
        active ? 'border-primary-300 bg-primary-50' : 'border-gray-300 bg-white'
      }`}
    >
      <span className="font-medium text-gray-600 whitespace-nowrap">{label}</span>
      <input
        type="number"
        placeholder="Min"
        value={value.min}
        onChange={(e) => onChange({ ...value, min: e.target.value })}
        className="w-16 bg-transparent border-none p-0 text-xs focus:outline-none focus:ring-0"
      />
      <span className="text-gray-300">–</span>
      <input
        type="number"
        placeholder="Max"
        value={value.max}
        onChange={(e) => onChange({ ...value, max: e.target.value })}
        className="w-16 bg-transparent border-none p-0 text-xs focus:outline-none focus:ring-0"
      />
      {active && (
        <button onClick={() => onChange({ min: '', max: '' })} className="text-gray-400 hover:text-red-500">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: DateRange
  onChange: (value: DateRange) => void
}) {
  const active = value.from !== '' || value.to !== ''

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs flex-shrink-0 ${
        active ? 'border-primary-300 bg-primary-50' : 'border-gray-300 bg-white'
      }`}
    >
      <span className="font-medium text-gray-600 whitespace-nowrap">{label}</span>
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="bg-transparent border-none p-0 text-xs focus:outline-none focus:ring-0"
      />
      <span className="text-gray-300">–</span>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="bg-transparent border-none p-0 text-xs focus:outline-none focus:ring-0"
      />
      {active && (
        <button onClick={() => onChange({ from: '', to: '' })} className="text-gray-400 hover:text-red-500">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

function SearchFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs flex-shrink-0 ${
        value ? 'border-primary-300 bg-primary-50' : 'border-gray-300 bg-white'
      }`}
    >
      <Search className="w-3.5 h-3.5 text-gray-400" />
      <input
        type="text"
        placeholder={`Search ${label}...`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 bg-transparent border-none p-0 text-xs focus:outline-none focus:ring-0"
      />
      {value && (
        <button onClick={() => onChange('')} className="text-gray-400 hover:text-red-500">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
