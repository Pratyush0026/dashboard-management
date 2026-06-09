'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, User, AlertCircle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ParsedTable {
  headers: string[]
  rows: string[][]
}

function parseMarkdownTable(text: string): ParsedTable | null {
  const lines = text.split('\n').filter((l) => l.trim())
  const tableStart = lines.findIndex((l) => l.includes('|'))
  if (tableStart === -1) return null

  const headers = lines[tableStart]
    .split('|')
    .map((h) => h.trim())
    .filter(Boolean)

  let dataStart = tableStart + 1
  if (dataStart < lines.length && /^[\s|:-]+$/.test(lines[dataStart])) {
    dataStart++
  }

  const rows: string[][] = []
  for (let i = dataStart; i < lines.length; i++) {
    if (!lines[i].includes('|')) break
    const cells = lines[i]
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
    if (cells.length === headers.length) rows.push(cells)
  }

  return rows.length > 0 ? { headers, rows } : null
}

function TableRenderer({ headers, rows }: ParsedTable) {
  return (
    <div className="overflow-x-auto rounded-xl border mt-3" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: 'rgba(124,58,237,0.1)', borderBottom: '1px solid var(--border)' }}>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-violet-300">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b transition-colors hover:bg-white/[0.025]"
              style={{ borderColor: 'var(--border)' }}
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const table = !isUser ? parseMarkdownTable(message.content) : null

  // Extract text before table
  const textContent = table
    ? message.content.split('\n').find((l) => !l.includes('|') && l.trim())
    : message.content

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-md px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white" style={{ background: 'var(--primary)' }}>
          {message.content}
        </div>
        <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-3.5 h-3.5 text-violet-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-violet-500/20">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 max-w-3xl px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        {textContent && (
          <p className="whitespace-pre-wrap text-foreground">{textContent}</p>
        )}
        {table && <TableRenderer headers={table.headers} rows={table.rows} />}
        {!table && !textContent && (
          <p className="whitespace-pre-wrap text-foreground">{message.content}</p>
        )}
      </div>
    </div>
  )
}

// ─── Typing indicator ───────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-500/20">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-4 py-3.5 rounded-2xl rounded-tl-sm flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}

// ─── GREETING ───────────────────────────────────────────────
const GREETING: Message = {
  role: 'assistant',
  content:
    'Hi! I\'m your AI recruiting assistant. Ask me anything about your candidates:\n• "Who are the top candidates for backend engineer?"\n• "List candidates with more than 5 years of experience"\n• "What are the most common skills?"\n• "Show candidates in Mumbai"\n\nWhat would you like to know?',
}

// ─── Main component ─────────────────────────────────────────
export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, loading, scrollToBottom])

  // Load chat history from DB on mount
  useEffect(() => {
    const loadHistory = async () => {
      const token = localStorage.getItem('token')
      if (!token) return
      try {
        const res = await fetch('/api/ai/history', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json() as { history: { query: string; response: string }[] }
        if (data.history && data.history.length > 0) {
          const loaded: Message[] = []
          for (const h of data.history) {
            loaded.push({ role: 'user', content: h.query })
            loaded.push({ role: 'assistant', content: h.response })
          }
          setMessages([GREETING, ...loaded])
        }
      } catch {
        // Silently fail — history is optional
      } finally {
        setHistoryLoaded(true)
      }
    }
    loadHistory()
  }, [])

  const handleSend = async () => {
    const query = input.trim()
    if (!query || loading) return

    setInput('')
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: query }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
        body: JSON.stringify({ query }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError('Rate limit reached. Please wait a moment before asking another question.')
        } else {
          setError(data.error || 'Failed to get a response. Please try again.')
        }
        return
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] p-6">
      {/* Header */}
      <div className="mb-5 flex-shrink-0">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          AI Insights
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask questions about your candidates in plain English
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className="fade-in">
            <MessageBubble message={msg} />
          </div>
        ))}
        {loading && (
          <div className="fade-in">
            <TypingIndicator />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3 flex-shrink-0 fade-in">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400 text-xs">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2 items-end">
        <div className="flex-1 relative gradient-border rounded-xl">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your candidates... (Enter to send, Shift+Enter for newline)"
            disabled={loading}
            rows={1}
            className="input-dark w-full px-4 py-3 text-sm resize-none rounded-xl"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="btn-primary h-12 w-12 flex items-center justify-center rounded-xl flex-shrink-0"
          aria-label="Send message"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 text-center flex-shrink-0">
        Shift+Enter for new line · AI may make mistakes — verify important information
      </p>
    </div>
  )
}
