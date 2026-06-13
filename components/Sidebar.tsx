'use client'

import { Database, MessageSquare, LogOut, Sparkles, ChevronRight, FileSpreadsheet } from 'lucide-react'
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
    <aside className="w-64 min-h-screen flex flex-col border-r border-white/5 bg-slate-900/50">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/25 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold gradient-text">TalenTrack</span>
            <p className="text-xs text-slate-500">Admin Dashboard</p>
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
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={activeTab === item.id ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}>
              {item.icon}
            </span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge !== undefined && (
              <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        {/* Dataset list */}
        {datasets.length > 0 && (
          <div className="pt-4">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 mb-2">
              Recent Datasets
            </p>
            <div className="space-y-1">
              {datasets.slice(0, 5).map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => onDatasetSelect(ds)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-200 group ${
                    selectedDataset?.id === ds.id
                      ? 'bg-blue-500/10 text-blue-300'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{ds.name}</span>
                  {selectedDataset?.id === ds.id && (
                    <ChevronRight className="w-3 h-3 text-blue-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user ? getInitials(user.name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          id="logout-btn"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 group"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
