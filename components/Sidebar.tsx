'use client'

import { Database, MessageSquare, LogOut, Sparkles, ChevronRight, FileSpreadsheet, Table2 } from 'lucide-react'
import type { ActiveTab } from '@/app/dashboard/page'

interface Dataset {
  id: string
  name: string
  sheet_name: string
  row_count: number
  column_count: number
  columns: Array<{ name: string; type: string }>
  uploaded_at: string
}

interface User {
  id: string
  email: string
  name: string
}

interface SidebarProps {
  user: User | null
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
  onLogout: () => void
  datasets: Dataset[]
  selectedDataset: Dataset | null
  onDatasetSelect: (dataset: Dataset) => void
}

export default function Sidebar({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  datasets,
  selectedDataset,
  onDatasetSelect,
}: SidebarProps) {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'datasets',
      label: 'Datasets',
      icon: <Database className="w-4 h-4" />,
      badge: datasets.length > 0 ? datasets.length : undefined,
    },
    {
      id: 'explorer',
      label: 'Data Explorer',
      icon: <Table2 className="w-4 h-4" />,
    },
    {
      id: 'ai-chat',
      label: 'AI Insights',
      icon: <MessageSquare className="w-4 h-4" />,
    },
  ]

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <aside className="w-64 min-h-screen flex flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold gradient-text">TalenTrack</span>
            <p className="text-xs text-gray-400">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
              activeTab === item.id
                ? 'bg-primary-50 text-primary-600 border border-primary-200'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className={activeTab === item.id ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'}>
              {item.icon}
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge !== undefined && (
              <span className="bg-primary-100 text-primary-600 text-xs px-2 py-0.5 rounded-full font-medium">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* Dataset list */}
        {datasets.length > 0 && (
          <div className="pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Recent Datasets
            </p>
            <div className="space-y-1">
              {datasets.slice(0, 5).map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => onDatasetSelect(ds)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group ${
                    selectedDataset?.id === ds.id
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{ds.name}</span>
                  {selectedDataset?.id === ds.id && (
                    <ChevronRight className="w-3 h-3 text-primary-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user ? getInitials(user.name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          id="logout-btn"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 group"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
