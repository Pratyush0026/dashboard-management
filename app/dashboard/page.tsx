'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import DatasetManager from '@/components/DatasetManager'
import DataExplorer from '@/components/DataExplorer'
import AIChat from '@/components/AIChat'

interface User {
  id: string
  email: string
  name: string
}

interface Dataset {
  id: string
  name: string
  sheet_name: string
  row_count: number
  column_count: number
  columns: Array<{
    name: string
    type: string
    unique_count?: number
    null_count?: number
    sample_values?: string[]
  }>
  uploaded_at: string
}

export type ActiveTab = 'datasets' | 'explorer' | 'ai-chat'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('datasets')
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    const storedUser = localStorage.getItem('admin_user')

    if (!token || !storedUser) {
      router.push('/login')
      return
    }

    try {
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)
    } catch {
      router.push('/login')
      return
    }

    fetchDatasets(token)
  }, [router])

  const fetchDatasets = async (token: string) => {
    try {
      const res = await fetch('/api/datasets', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      const data = await res.json()
      if (data.datasets) {
        setDatasets(data.datasets)
        if (data.datasets.length > 0 && !selectedDataset) {
          setSelectedDataset(data.datasets[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch datasets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    router.push('/login')
  }

  const handleDatasetSelect = (dataset: Dataset) => {
    setSelectedDataset(dataset)
    setActiveTab('ai-chat')
  }

  const handleDatasetAdded = (dataset: Dataset) => {
    setDatasets((prev) => [dataset, ...prev])
    setSelectedDataset(dataset)
    setActiveTab('ai-chat')
  }

  const handleDatasetDeleted = (datasetId: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== datasetId))
    if (selectedDataset?.id === datasetId) {
      const remaining = datasets.filter((d) => d.id !== datasetId)
      setSelectedDataset(remaining[0] || null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-500 animate-pulse" />
          <p className="text-gray-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        datasets={datasets}
        selectedDataset={selectedDataset}
        onDatasetSelect={handleDatasetSelect}
      />

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {activeTab === 'datasets' && (
          <DatasetManager
            datasets={datasets}
            selectedDataset={selectedDataset}
            onDatasetSelect={handleDatasetSelect}
            onDatasetAdded={handleDatasetAdded}
            onDatasetDeleted={handleDatasetDeleted}
          />
        )}
        {activeTab === 'explorer' && (
          <DataExplorer
            dataset={selectedDataset}
            onSwitchToDatasets={() => setActiveTab('datasets')}
          />
        )}
        {activeTab === 'ai-chat' && (
          <AIChat
            dataset={selectedDataset}
            onSwitchToDatasets={() => setActiveTab('datasets')}
          />
        )}
      </main>
    </div>
  )
}
