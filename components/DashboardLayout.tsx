'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { LogOut, Users, Upload, Sparkles, Home } from 'lucide-react'
import Link from 'next/link'
import type { Admin } from '@/lib/types'

interface DashboardLayoutProps {
  children: ReactNode
  admin: Admin | null
  onLogout: () => void
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
]

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

function AvatarInitials({ email }: { email: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-violet-500/20">
      {getInitials(email)}
    </div>
  )
}

export default function DashboardLayout({
  children,
  admin,
  onLogout,
}: DashboardLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col z-20" style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-foreground">TalenTrack</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-violet-500/15 text-violet-300 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-violet-400' : ''}`} />
                {label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          {admin && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <AvatarInitials email={admin.email} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Admin</p>
                <p className="text-sm font-medium text-foreground truncate">{admin.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:text-red-400 hover:bg-red-500/8"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  )
}
