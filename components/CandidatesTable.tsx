'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, Search, Download, ChevronLeft, ChevronRight, X } from 'lucide-react'
import useSWR from 'swr'
import type { Candidate } from '@/lib/types'

// ─── Fetcher ────────────────────────────────────────────────
const fetcher = (url: string) =>
  fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
  }).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  })

// ─── Debounce hook ──────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debounced
}

// ─── Status badge ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Applied: 'badge-applied',
    Interviewing: 'badge-interviewing',
    Offer: 'badge-offer',
    Rejected: 'badge-rejected',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'badge-applied'}`}>
      {status}
    </span>
  )
}

// ─── Candidate avatar ───────────────────────────────────────
function CandidateAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Deterministic color from name
  const colors = [
    'from-violet-500 to-indigo-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-rose-600',
    'from-pink-500 to-purple-600',
  ]
  const idx = name.charCodeAt(0) % colors.length

  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ─── Skeleton rows ──────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
          {Array.from({ length: 7 }).map((_, j) => (
            <td key={j} className="px-5 py-4">
              <div className="skeleton h-4 rounded" style={{ width: j === 0 ? '140px' : j === 1 ? '180px' : '80px' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ─── Delete confirm modal ───────────────────────────────────
function DeleteModal({
  name,
  onConfirm,
  onCancel,
  loading,
}: {
  name: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative glass-card rounded-2xl p-6 w-full max-w-sm border border-white/10 fade-in">
        <h3 className="text-base font-semibold text-foreground mb-2">Delete candidate?</h3>
        <p className="text-sm text-muted-foreground mb-6">
          <span className="text-foreground font-medium">{name}</span> will be permanently removed. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-ghost flex-1 py-2.5 text-sm rounded-lg">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 text-sm rounded-lg font-medium bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-all disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────
export default function CandidatesTable() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Debounce text inputs to reduce API calls
  const debouncedSearch = useDebounce(search, 300)
  const debouncedPosition = useDebounce(positionFilter, 300)
  const debouncedLocation = useDebounce(locationFilter, 300)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [debouncedSearch, debouncedPosition, debouncedLocation, statusFilter])

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: '10',
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(statusFilter && { status: statusFilter }),
    ...(debouncedPosition && { position: debouncedPosition }),
    ...(debouncedLocation && { location: debouncedLocation }),
  })

  const { data, error, isLoading, mutate } = useSWR(
    `/api/candidates?${queryParams}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  )

  const candidates: Candidate[] = data?.data ?? []
  const total: number = data?.pagination?.total ?? 0
  const totalPages = Math.ceil(total / 10)

  const hasActiveFilters = search || statusFilter || positionFilter || locationFilter

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setPositionFilter('')
    setLocationFilter('')
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteLoading) return  // guard against double-submit
    setDeleteLoading(true)
    const targetId = deleteTarget.id
    try {
      const res = await fetch('/api/candidates', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
        body: JSON.stringify({ id: targetId }),
      })
      if (res.ok) {
        setDeleteTarget(null) // close modal before mutate to prevent flash
        await mutate()
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('Delete failed:', data.error)
      }
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeleteLoading(false)
    }
  }

  const [exportLoading, setExportLoading] = useState(false)

  const handleExport = async () => {
    if (exportLoading) return
    setExportLoading(true)
    try {
      // Fetch ALL candidates matching current filters (up to 5000)
      const exportParams = new URLSearchParams({
        page: '1',
        limit: '5000',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter && { status: statusFilter }),
        ...(debouncedPosition && { position: debouncedPosition }),
        ...(debouncedLocation && { location: debouncedLocation }),
      })
      const res = await fetch(`/api/candidates?${exportParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      })
      if (!res.ok) return
      const allData = await res.json()
      const allCandidates: Candidate[] = allData?.data ?? []
      if (allCandidates.length === 0) return

      const header = ['Name', 'Email', 'Phone', 'Position', 'Education', 'Experience (yr)', 'Skills', 'Salary', 'Location', 'Status']
      const rows = allCandidates.map((c) => [
        c.name, c.email, c.phone, c.position_applied, c.education,
        c.experience_years, c.skills, c.salary_expectation, c.location, c.status,
      ])
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `candidates_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Delay revoke so browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Candidates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {total > 0 ? `${total} total` : 'No candidates yet'}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={total === 0 || exportLoading}
            className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm rounded-lg disabled:opacity-40"
          >
            {exportLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export all CSV
              </>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-dark w-full pl-9 pr-4 py-2.5 text-sm"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-dark w-full px-3 py-2.5 text-sm appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Applied">Applied</option>
            <option value="Interviewing">Interviewing</option>
            <option value="Offer">Offer</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Position */}
          <input
            type="text"
            placeholder="Filter by position..."
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="input-dark w-full px-3 py-2.5 text-sm"
          />

          {/* Location */}
          <input
            type="text"
            placeholder="Filter by location..."
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="input-dark w-full px-3 py-2.5 text-sm"
          />
        </div>

        {/* Active filter pill */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Filters active</span>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                  {['Candidate', 'Email', 'Position', 'Exp.', 'Location', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows />
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-red-400">
                      Failed to load candidates. Please refresh.
                    </td>
                  </tr>
                ) : candidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-white/4 flex items-center justify-center mb-2">
                          <Search className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No candidates found</p>
                        <p className="text-xs text-muted-foreground">
                          {hasActiveFilters
                            ? 'Try adjusting your filters'
                            : 'Upload an Excel file to get started'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  candidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className="border-b transition-colors group hover:bg-white/[0.025]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <CandidateAvatar name={candidate.name} />
                          <span className="text-sm font-medium text-foreground">{candidate.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{candidate.email}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{candidate.position_applied}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">{candidate.experience_years}yr</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{candidate.location}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={candidate.status} />
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setDeleteTarget(candidate)}
                          className="opacity-0 group-hover:opacity-100 btn-danger p-1.5 rounded-lg transition-all"
                          aria-label={`Delete ${candidate.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-ghost p-2 rounded-lg disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-xs rounded-lg transition-all font-medium ${
                      page === pageNum
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                        : 'btn-ghost'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-ghost p-2 rounded-lg disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
