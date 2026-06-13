'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, Trash2, Loader2, ChevronRight, AlertCircle, BarChart2, Search, Filter, X } from 'lucide-react'

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

interface DatasetManagerProps {
  datasets: Dataset[]
  selectedDataset: Dataset | null
  onDatasetSelect: (dataset: Dataset) => void
  onDatasetAdded: (dataset: Dataset) => void
  onDatasetDeleted: (datasetId: string) => void
}

export default function DatasetManager({
  datasets,
  selectedDataset,
  onDatasetSelect,
  onDatasetAdded,
  onDatasetDeleted,
}: DatasetManagerProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const handleFileUpload = async (file: File) => {
    setUploadError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed')
        return
      }

      onDatasetAdded(data.dataset)
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    e.target.value = ''
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileUpload(file)
    },
    []
  )

  const handleDelete = async (datasetId: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return

    setDeletingId(datasetId)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`/api/datasets?id=${datasetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        onDatasetDeleted(datasetId)
      }
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'numeric': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      case 'categorical': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
      case 'date': return 'bg-green-500/10 text-green-400 border border-green-500/20'
      case 'boolean': return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
    }
  }

  // Filter datasets based on search + selected dataset's columns based on type
  const filteredDatasets = datasets.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedColumns = selectedDataset?.columns || []
  const filteredColumns = typeFilter === 'all' 
    ? selectedColumns 
    : selectedColumns.filter(c => c.type === typeFilter)

  const uniqueTypes = [...new Set(selectedColumns.map(c => c.type))]

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* Left: Dataset List */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-slate-900/30">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white mb-1">Datasets</h2>
          <p className="text-xs text-slate-500">{datasets.length} file{datasets.length !== 1 ? 's' : ''} uploaded</p>
        </div>

        {/* Upload Area */}
        <div className="p-4 border-b border-white/5">
          <label
            className={`flex flex-col items-center gap-3 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-slate-700 hover:border-purple-500/50 hover:bg-slate-800/50'
            } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileInput}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <span className="text-sm text-slate-400">Processing...</span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300">Upload Excel or CSV</p>
                  <p className="text-xs text-slate-500 mt-0.5">.xlsx, .xls, .csv</p>
                </div>
              </>
            )}
          </label>

          {uploadError && (
            <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{uploadError}</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dataset List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredDatasets.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {datasets.length === 0 ? 'No datasets yet' : 'No results found'}
              </p>
            </div>
          ) : (
            filteredDatasets.map((dataset) => (
              <div
                key={dataset.id}
                className={`group p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                  selectedDataset?.id === dataset.id
                    ? 'border-purple-500/40 bg-purple-500/10'
                    : 'border-white/5 hover:border-white/10 hover:bg-slate-800/30'
                }`}
                onClick={() => onDatasetSelect(dataset)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selectedDataset?.id === dataset.id ? 'bg-purple-500/20' : 'bg-slate-800'
                  }`}>
                    <FileSpreadsheet className={`w-4 h-4 ${
                      selectedDataset?.id === dataset.id ? 'text-purple-400' : 'text-slate-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{dataset.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {dataset.row_count.toLocaleString()} rows · {dataset.column_count} cols
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{formatDate(dataset.uploaded_at)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(dataset.id) }}
                    disabled={deletingId === dataset.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    {deletingId === dataset.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {selectedDataset?.id === dataset.id && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-purple-400">
                    <span>Sheet: {dataset.sheet_name}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span>Active</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Column Details */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDataset ? (
          <>
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedDataset.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Sheet: {selectedDataset.sheet_name} · {selectedDataset.row_count.toLocaleString()} rows · {selectedDataset.column_count} columns
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                >
                  <option value="all">All Types</option>
                  {uniqueTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredColumns.map((col) => (
                  <div key={col.name} className="glass rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-white truncate flex-1 mr-2">{col.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getTypeColor(col.type)}`}>
                        {col.type}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500">
                      {col.unique_count !== undefined && (
                        <div className="flex justify-between">
                          <span>Unique values</span>
                          <span className="text-slate-300">{col.unique_count.toLocaleString()}</span>
                        </div>
                      )}
                      {col.null_count !== undefined && col.null_count > 0 && (
                        <div className="flex justify-between">
                          <span>Null count</span>
                          <span className="text-yellow-400">{col.null_count.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {col.sample_values && col.sample_values.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {col.sample_values.slice(0, 3).map((v, i) => (
                          <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                            {v}
                          </span>
                        ))}
                        {col.sample_values.length > 3 && (
                          <span className="text-xs text-slate-600">+{col.sample_values.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5 flex items-center justify-center mb-6">
              <BarChart2 className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Dataset Selected</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              Upload an Excel or CSV file to get started with AI-powered insights
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
