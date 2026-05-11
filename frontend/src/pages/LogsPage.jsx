/**
 * LogsPage.jsx — Admin-only activity audit log viewer
 */

import React, { useEffect, useState } from 'react'
import { getLogs } from '../api.js'
import { ScrollText, RefreshCw, Lock, User, Search } from 'lucide-react'

export default function LogsPage() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getLogs()
      setLogs(data)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 403) {
        setError('Access denied — this page is restricted to administrators only.')
      } else if (status === 401) {
        setError(typeof detail === 'string' ? detail : 'Your session is invalid or expired. Please sign in again.')
      } else {
        setError('Failed to load logs.')
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs() }, [])

  const filtered = logs.filter((l) =>
    !search ||
    l.username.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  )

  const actionColour = (action) => {
    const a = action.toUpperCase()
    if (a.includes('LOGIN'))       return 'text-emerald-400'
    if (a.includes('LOGOUT'))      return 'text-slate-400'
    if (a.includes('REPORT'))      return 'text-blue-400'
    if (a.includes('ALERT'))       return 'text-amber-400'
    if (a.includes('FORECAST'))    return 'text-violet-400'
    if (a.includes('DASHBOARD'))   return 'text-sky-400'
    return 'text-slate-300'
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Logs</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Admin audit trail — all platform actions
          </p>
        </div>
        <button onClick={fetchLogs} className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Admin-only notice */}
      <div className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/25 text-brand-300 rounded-xl px-4 py-2.5 text-xs">
        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
        This page is restricted to administrators only.
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
          <Lock className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Search */}
      {!error && (
        <div className="glass p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or action…"
              className="w-full bg-slate-700/40 border border-slate-600/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      )}

      {/* Table */}
      {!error && (
        <div className="glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <ScrollText className="w-4 h-4 text-brand-400" />
            <h2 className="font-semibold text-white text-sm">Audit Trail</h2>
            <span className="text-xs text-slate-500 ml-1">({filtered.length} entries)</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    {['#','User','Action','Timestamp'].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="py-2.5 px-3 text-slate-600 text-xs">{l.id}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {l.username[0]?.toUpperCase()}
                          </div>
                          <span className="text-slate-200 font-medium">{l.username}</span>
                        </div>
                      </td>
                      <td className={`py-2.5 px-3 font-mono text-xs ${actionColour(l.action)}`}>{l.action}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">
                        {new Date(l.timestamp).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-center text-slate-500 py-8">No log entries found</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
