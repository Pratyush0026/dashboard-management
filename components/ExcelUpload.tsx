'use client'

import { useState, useCallback } from 'react'
import { Upload, AlertCircle, CheckCircle, FileSpreadsheet, X, Clock } from 'lucide-react'
import * as XLSX from 'xlsx'

interface UploadResult {
  inserted: number
  skipped: number
  total: number
}

interface RecentSession {
  filename: string
  inserted: number
  skipped: number
  total: number
  time: Date
}

interface ExcelUploadProps {
  onSuccess?: () => void
}

const REQUIRED_COLUMNS = [
  { key: 'name', label: 'name' },
  { key: 'email', label: 'email' },
  { key: 'position_applied', label: 'position_applied' },
]

const ALL_COLUMNS = [
  'name', 'email', 'phone', 'position_applied',
  'education', 'experience_years', 'skills',
  'salary_expectation', 'location', 'status',
]

export default function ExcelUpload({ onSuccess }: ExcelUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [currentFile, setCurrentFile] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Please upload an Excel file (.xlsx or .xls)')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setCurrentFile(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

      if (data.length === 0) {
        setError('The Excel file appears to be empty.')
        return
      }

      const token = localStorage.getItem('token')
      if (!token) {
        setError('Authentication required. Please log in again.')
        return
      }

      const res = await fetch('/api/candidates/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidates: data, filename: file.name }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Upload failed. Please try again.')
        return
      }

      const uploadResult: UploadResult = {
        inserted: json.inserted ?? 0,
        skipped: json.skipped ?? 0,
        total: json.total ?? data.length,
      }
      setResult(uploadResult)

      // Track session locally
      setRecentSessions((prev) =>
        [{ filename: file.name, ...uploadResult, time: new Date() }, ...prev].slice(0, 5)
      )

      // Notify parent to refresh table
      if (uploadResult.inserted > 0) {
        onSuccess?.()
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Error processing file. Please check the format and try again.')
    } finally {
      setLoading(false)
    }
  }, [onSuccess])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (file) processFile(file)
    e.currentTarget.value = '' // reset so same file can be re-selected
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Import Candidates</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload an Excel file — duplicate emails are automatically skipped.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          dragActive
            ? 'border-violet-500 bg-violet-500/5 scale-[1.01]'
            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
        } ${loading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          disabled={loading}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${
            dragActive ? 'bg-violet-500/20' : 'bg-white/5'
          }`}>
            {loading ? (
              <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className={`w-7 h-7 ${dragActive ? 'text-violet-400' : 'text-muted-foreground'}`} />
            )}
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {loading ? `Importing ${currentFile}...` : 'Drop your Excel file here'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Processing candidates...' : 'or click to browse — .xlsx or .xls'}
          </p>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 fade-in">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 fade-in">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">Import complete</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Inserted', value: result.inserted, color: 'text-emerald-400' },
              { label: 'Skipped (duplicates)', value: result.skipped, color: 'text-yellow-400' },
              { label: 'Total rows', value: result.total, color: 'text-foreground' },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 rounded-lg bg-white/4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        {/* Column reference */}
        <div className="p-5 rounded-xl bg-white/3 border border-white/6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Required columns</h3>
          <div className="space-y-1.5">
            {ALL_COLUMNS.map((col) => {
              const required = REQUIRED_COLUMNS.some((r) => r.key === col)
              return (
                <div key={col} className="flex items-center gap-2 text-xs">
                  <code className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono">
                    {col}
                  </code>
                  {required && (
                    <span className="text-red-400 text-[10px] font-medium uppercase tracking-wider">required</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent uploads */}
        <div className="p-5 rounded-xl bg-white/3 border border-white/6">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Recent uploads
          </h3>
          {recentSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No uploads this session yet.</p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/4 text-xs">
                  <div>
                    <p className="font-medium text-foreground truncate max-w-[140px]">{s.filename}</p>
                    <p className="text-muted-foreground mt-0.5">
                      {s.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-semibold">+{s.inserted}</span>
                    {s.skipped > 0 && (
                      <span className="text-muted-foreground ml-1">({s.skipped} skipped)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
