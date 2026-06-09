'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ArrowRight, Upload, Filter, Sparkles, Download, Users, Zap } from 'lucide-react'
import Link from 'next/link'

const FEATURES = [
  {
    icon: Upload,
    title: 'Excel Import',
    description:
      'Drag and drop Excel files. Automatic deduplication prevents double imports.',
    color: 'from-violet-500/20 to-violet-600/5',
    iconColor: 'text-violet-400',
    border: 'border-violet-500/20',
  },
  {
    icon: Filter,
    title: 'Smart Filtering',
    description:
      'Search by name, filter by position, location, status — all in real time.',
    color: 'from-indigo-500/20 to-indigo-600/5',
    iconColor: 'text-indigo-400',
    border: 'border-indigo-500/20',
  },
  {
    icon: Sparkles,
    title: 'AI Insights',
    description:
      'Ask questions in plain English. Get ranked lists, stats, and recommendations.',
    color: 'from-blue-500/20 to-blue-600/5',
    iconColor: 'text-blue-400',
    border: 'border-blue-500/20',
  },
]

const STATS = [
  { value: '500+', label: 'Candidates per batch' },
  { value: '< 1s', label: 'Search response time' },
  { value: '100%', label: 'Data isolated per admin' },
]

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) router.push('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen mesh-bg overflow-hidden">
      {/* Ambient orbs */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-600/8 blur-[100px]" />
        <div className="absolute -bottom-20 left-1/3 w-[400px] h-[400px] rounded-full bg-blue-600/6 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Users className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-foreground">TalenTrack</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="btn-primary px-4 py-2 text-sm rounded-lg"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-16 pb-20 text-center">
        <div className="slide-up inline-flex items-center gap-2 px-3 py-1.5 mb-8 rounded-full glass text-xs font-medium text-violet-400 border border-violet-500/20">
          <Zap className="w-3 h-3" />
          AI-powered candidate management
        </div>

        <h1 className="slide-up text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1]"
          style={{ animationDelay: '0.05s' }}>
          Hire smarter with{' '}
          <span className="gradient-text">AI insights</span>
        </h1>

        <p
          className="slide-up text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed"
          style={{ animationDelay: '0.1s' }}
        >
          Import candidates from Excel, search and filter in milliseconds, and
          let AI answer your recruiting questions in plain English.
        </p>

        <div
          className="slide-up flex flex-col sm:flex-row gap-3 justify-center items-center"
          style={{ animationDelay: '0.15s' }}
        >
          <Link
            href="/register"
            className="btn-primary flex items-center gap-2 px-7 py-3.5 text-base rounded-xl"
          >
            Start for free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="btn-ghost flex items-center gap-2 px-7 py-3.5 text-base rounded-xl"
          >
            Sign in to dashboard
          </Link>
        </div>

        {/* Stats row */}
        <div
          className="slide-up mt-16 flex flex-col sm:flex-row justify-center gap-8 sm:gap-16"
          style={{ animationDelay: '0.2s' }}
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold gradient-text">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-12 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={`fade-in glass-card p-6 rounded-2xl border ${feature.border} hover:border-opacity-50 transition-all duration-300 group hover:-translate-y-1`}
                style={{ animationDelay: `${0.25 + i * 0.08}s` }}
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download sample */}
      <section className="relative z-10 px-6 md:px-12 pb-20 text-center">
        <a
          href="/sample_candidates.xlsx"
          download="sample_candidates.xlsx"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass border border-white/10 text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
        >
          <Download className="w-4 h-4" />
          Download sample Excel template
        </a>
      </section>
    </div>
  )
}
