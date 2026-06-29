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
  const [provider, setProvider] = useState<'gemini' | 'openai'>(
    (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as 'gemini' | 'openai') || 'openai'
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const defaultProv = process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as 'gemini' | 'openai'
    const storedProvider = localStorage.getItem('ai_provider') as 'gemini' | 'openai'

    if (defaultProv === 'openai' || defaultProv === 'gemini') {
      setProvider(defaultProv)
    } else if (storedProvider === 'gemini' || storedProvider === 'openai') {
      setProvider(storedProvider)
    }
  }, [])

  const handleProviderChange = (newProvider: 'gemini' | 'openai') => {
    setProvider(newProvider)
    localStorage.setItem('ai_provider', newProvider)
  }

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
        body: JSON.stringify({ datasetId: dataset.id, query: text.trim(), provider }),
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
        <div className="w-20 h-20 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-6">
          <MessageSquare className="w-10 h-10 text-primary-300" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Dataset Selected</h3>
        <p className="text-gray-400 text-sm max-w-xs mb-6">
          Upload a dataset first to start getting AI-powered insights
        </p>
        <button
          id="go-to-datasets-btn"
          onClick={onSwitchToDatasets}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-primary-500/25"
        >
          Go to Datasets
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4 text-primary-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{dataset.name}</h2>
            <p className="text-xs text-gray-400">
              {dataset.row_count.toLocaleString()} rows · {dataset.column_count} cols · Sheet: {dataset.sheet_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="flex items-center gap-2 mr-2 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 transition-all hover:bg-gray-100 hover:border-gray-300">
            <div className={`w-1.5 h-1.5 rounded-full ${provider === 'gemini' ? 'bg-primary-500 shadow-sm shadow-primary-400' : 'bg-emerald-500 shadow-sm shadow-emerald-400'} animate-pulse`} />
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as 'gemini' | 'openai')}
              className="bg-transparent border-none p-0 text-xs font-semibold text-gray-700 focus:ring-0 focus:outline-none cursor-pointer hover:text-gray-900 transition-colors select-none"
            >
              <option value="gemini" className="bg-white text-gray-700">Google Gemini</option>
              <option value="openai" className="bg-white text-gray-700">OpenAI GPT-4o</option>
            </select>
          </div>

          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-50 border border-gray-300 rounded-lg pl-9 pr-8 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 w-52"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => { setShowSearch(!showSearch); setSearchQuery('') }}
            className={`p-2 rounded-lg transition-all ${showSearch ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            <Search className="w-4 h-4" />
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
            <div className="w-16 h-16 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="text-gray-900 font-semibold mb-2">Ask about your data</h3>
            <p className="text-gray-400 text-sm mb-8 text-center max-w-md">
              Ask questions about <strong className="text-gray-700">{dataset.name}</strong>. The AI analyzes your data for accurate answers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="text-left p-3 rounded-xl border border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50 transition-all duration-200 group shadow-sm"
                >
                  <p className="text-sm text-gray-500 group-hover:text-gray-800 transition-colors line-clamp-2">{prompt}</p>
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
                ? 'bg-primary-500'
                : 'bg-white border border-gray-200 shadow-sm'
            }`}>
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-gray-500" />
              )}
            </div>

            {/* Bubble */}
            <div className={`flex-1 max-w-4xl ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              {message.isLoading ? (
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                    <span className="text-sm">Analyzing data...</span>
                  </div>
                </div>
              ) : (
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary-500 text-white rounded-tr-sm shadow-lg shadow-primary-500/20'
                      : 'bg-white border border-gray-200 shadow-sm rounded-tl-sm'
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
                            <thead className="bg-primary-50">{children}</thead>
                          ),
                          th: ({ children }) => (
                            <th className="px-3 py-2 text-left text-primary-700 font-semibold border border-gray-200 text-xs uppercase tracking-wider">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="px-3 py-2 border border-gray-200 text-gray-700">
                              {children}
                            </td>
                          ),
                          tr: ({ children, ...props }) => (
                            <tr className="hover:bg-primary-50/50 transition-colors" {...props}>
                              {children}
                            </tr>
                          ),
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="text-gray-700">{children}</li>,
                          h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-semibold text-gray-900 mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-900 mb-1">{children}</h3>,
                          strong: ({ children }) => <strong className="font-semibold text-primary-600">{children}</strong>,
                          code: ({ children }) => <code className="bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded text-xs border border-primary-100">{children}</code>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-primary-400 pl-3 text-gray-500 italic my-2 bg-primary-50/50 py-1 rounded-r">
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
              <span className="text-xs text-gray-400 mt-1 px-1">{formatTime(message.timestamp)}</span>
            </div>
          </div>
        ))}

        {searchQuery && filteredMessages.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No messages matching &ldquo;{searchQuery}&rdquo;
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
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
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all resize-none max-h-32 scrollbar-thin"
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
            className="flex-shrink-0 w-12 h-12 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all duration-200 shadow-lg shadow-primary-500/25"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
