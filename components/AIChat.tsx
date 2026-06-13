'use client'

import { useState, useRef, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  FileSpreadsheet,
  Trash2,
  ChevronDown,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface Dataset {
  id: string
  name: string
  sheet_name: string
  row_count: number
  column_count: number
  columns: Array<{ name: string; type: string }>
  uploaded_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}

interface AIChatProps {
  dataset: Dataset | null
  onSwitchToDatasets: () => void
}

const SUGGESTED_PROMPTS = [
  'Give me a complete recruitment funnel summary table for all business segments',
  'Show me a cross-tabulation of clients by zone with total counts',
  'Which recruiter has the highest selection rate? Show a detailed table',
  'Show me the top 10 locations with the most candidates',
  'Summarize the overall recruitment performance with key metrics',
  'What percentage of candidates attended their interviews?',
]

export default function AIChat({ dataset, onSwitchToDatasets }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const generateId = () => Math.random().toString(36).slice(2)

  const sendMessage = async (text: string) => {
    if (!text.trim() || !dataset || loading) return

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    const loadingMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setInput('')
    setLoading(true)

    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch('/api/datasets/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ datasetId: dataset.id, query: text.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.isLoading
              ? { ...m, content: `Error: ${data.error || 'Failed to get response'}`, isLoading: false }
              : m
          )
        )
        return
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.isLoading ? { ...m, content: data.response, isLoading: false } : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.isLoading
            ? { ...m, content: 'Network error. Please try again.', isLoading: false }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    if (messages.length > 0 && confirm('Clear all messages?')) {
      setMessages([])
    }
  }

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  if (!dataset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5 flex items-center justify-center mb-6">
          <MessageSquare className="w-10 h-10 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Dataset Selected</h3>
        <p className="text-slate-500 text-sm max-w-xs mb-6">
          Upload a dataset first to start getting AI-powered insights
        </p>
        <button
          id="go-to-datasets-btn"
          onClick={onSwitchToDatasets}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Datasets
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{dataset.name}</h2>
            <p className="text-xs text-slate-500">
              {dataset.row_count.toLocaleString()} rows · {dataset.column_count} cols · Sheet: {dataset.sheet_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 w-52"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => { setShowSearch(!showSearch); setSearchQuery('') }}
            className={`p-2 rounded-lg transition-all ${showSearch ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
          >
            <Search className="w-4 h-4" />
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Ask about your data</h3>
            <p className="text-slate-500 text-sm mb-8 text-center max-w-md">
              Ask questions about <strong className="text-slate-300">{dataset.name}</strong>. The AI analyzes your data for accurate answers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="text-left p-3 rounded-xl border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-200 group"
                >
                  <p className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors line-clamp-2">{prompt}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredMessages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-gradient-to-br from-purple-600 to-blue-600'
                : 'bg-gradient-to-br from-slate-700 to-slate-600'
            }`}>
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-slate-300" />
              )}
            </div>

            {/* Bubble */}
            <div className={`flex-1 max-w-4xl ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              {message.isLoading ? (
                <div className="glass border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing data...</span>
                  </div>
                </div>
              ) : (
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-purple-600/80 to-blue-600/80 text-white rounded-tr-sm border border-purple-500/20'
                      : 'glass border border-white/5 rounded-tl-sm'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <div className="prose-dark text-sm overflow-x-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-3">
                              <table className="text-sm">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-purple-500/10">{children}</thead>
                          ),
                          th: ({ children }) => (
                            <th className="px-3 py-2 text-left text-purple-300 font-semibold border border-slate-700/50 text-xs uppercase tracking-wider">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="px-3 py-2 border border-slate-700/50 text-slate-300">
                              {children}
                            </td>
                          ),
                          tr: ({ children, ...props }) => (
                            <tr className="hover:bg-slate-800/30 transition-colors" {...props}>
                              {children}
                            </tr>
                          ),
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-slate-300">{children}</li>,
                          h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-semibold text-white mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold text-white mb-1">{children}</h3>,
                          strong: ({ children }) => <strong className="font-semibold text-purple-300">{children}</strong>,
                          code: ({ children }) => <code className="bg-slate-800 text-purple-300 px-1.5 py-0.5 rounded text-xs">{children}</code>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-purple-500/50 pl-3 text-slate-400 italic my-2">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
              <span className="text-xs text-slate-600 mt-1 px-1">{formatTime(message.timestamp)}</span>
            </div>
          </div>
        ))}

        {searchQuery && filteredMessages.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No messages matching &ldquo;{searchQuery}&rdquo;
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5 bg-slate-900/30">
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              id="ai-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything about ${dataset.name}...`}
              rows={1}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none max-h-32 scrollbar-thin"
              style={{ minHeight: '48px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`
              }}
            />
          </div>
          <button
            id="ai-send-btn"
            type="submit"
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg shadow-purple-500/25"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </form>
        <p className="text-xs text-slate-600 mt-2 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
