'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Upload, Sparkles, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import CandidatesTable from '@/components/CandidatesTable'
import ExcelUpload from '@/components/ExcelUpload'
import AIChat from '@/components/AIChat'
import type { Admin } from '@/lib/types'
import useSWR, { mutate as globalMutate } from 'swr'

type Tab = 'candidates' | 'upload' | 'insights'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'upload', label: 'Import Excel', icon: Upload },
  { id: 'insights', label: 'AI Insights', icon: Sparkles },
]

interface PaginationMeta {
  total: number
}
interface CandidateListResponse {
  pagination: PaginationMeta
}

// ── Stat SWR keys (reused for targeted invalidation after upload) ─
const STAT_KEYS = {
  total: '/api/candidates?limit=1&page=1',
  applied: '/api/candidates?limit=1&page=1&status=Applied',
  interviewing: '/api/candidates?limit=1&page=1&status=Interviewing',
  offer: '/api/candidates?limit=1&page=1&status=Offer',
} as const

// ── Global fetcher with 401 → logout handling ─────────────────────
// Stored as a module-level ref so the fetcher can trigger logout
let logoutCallback: (() => void) | null = null

const fetcher = async ([url, tok]: [string, string]) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })
  if (res.status === 401) {
    // Token expired or invalid — force logout
    logoutCallback?.()
    throw new Error('Session expired')
  }
  return res.json()
}

interface StatCard {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  bg: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('candidates')
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [tableKey, setTableKey] = useState(0)

  const handleLogout = useCallback(() => {
    logoutCallback = null
    localStorage.removeItem('token')
    localStorage.removeItem('admin')
    router.push('/login')
  }, [router])

  useEffect(() => {
    // Register logout callback so the fetcher can call it on 401
    logoutCallback = handleLogout

    const storedToken = localStorage.getItem('token')
    const adminData = localStorage.getItem('admin')

    if (!storedToken || !adminData) {
      router.push('/login')
      return
    }

    try {
      setAdmin(JSON.parse(adminData) as Admin)
      setToken(storedToken)
    } catch {
      handleLogout()
      return
    }

    setLoading(false)

    return () => {
      logoutCallback = null
    }
  }, [router, handleLogout])

  const swrOpts = { revalidateOnFocus: false }

  const { data: totalData } = useSWR<CandidateListResponse>(
    token ? [STAT_KEYS.total, token] : null, fetcher, swrOpts
  )
  const { data: appliedData } = useSWR<CandidateListResponse>(
    token ? [STAT_KEYS.applied, token] : null, fetcher, swrOpts
  )
  const { data: interviewingData } = useSWR<CandidateListResponse>(
    token ? [STAT_KEYS.interviewing, token] : null, fetcher, swrOpts
  )
  const { data: offerData } = useSWR<CandidateListResponse>(
    token ? [STAT_KEYS.offer, token] : null, fetcher, swrOpts
  )

  // ── Refresh stats + table after upload ────────────────────────
  const handleUploadSuccess = useCallback(() => {
    const tok = localStorage.getItem('token') ?? ''
    // Invalidate all stat SWR keys so they refetch
    Object.values(STAT_KEYS).forEach((url) => {
      globalMutate([url, tok])
    })
    // Bump table key to remount CandidatesTable
    setTableKey((k) => k + 1)
    setActiveTab('candidates')
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const total = totalData?.pagination?.total ?? '—'
  const applied = appliedData?.pagination?.total ?? '—'
  const interviewing = interviewingData?.pagination?.total ?? '—'
  const offer = offerData?.pagination?.total ?? '—'

  const statCards: StatCard[] = [
    { label: 'Total Candidates', value: total, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
    { label: 'Applied', value: applied, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Interviewing', value: interviewing, icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    { label: 'Offer Extended', value: offer, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ]

  return (
    <DashboardLayout admin={admin} onLogout={handleLogout}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8 fade-in">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage candidates and generate AI-powered insights
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in" style={{ animationDelay: '0.05s' }}>
          {statCards.map((card) => (
            <div key={card.label} className={`glass-card rounded-xl p-4 border ${card.bg} flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                {card.value === '—' ? (
                  <div className="skeleton h-6 w-8 rounded mt-1" />
                ) : (
                  <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div className="glass-card rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          {activeTab === 'candidates' && <CandidatesTable key={tableKey} />}
          {activeTab === 'upload' && <ExcelUpload onSuccess={handleUploadSuccess} />}
          {activeTab === 'insights' && <AIChat />}
        </div>
      </div>
    </DashboardLayout>
  )
}
