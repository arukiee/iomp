/**
 * AlertsPage.jsx — Area-level alerts with clinic details
 */

import React, { useEffect, useState } from 'react'
import { getDashboardAlerts, acknowledgeAlert } from '../api.js'
import { Bell, CheckCircle, RefreshCw, AlertTriangle, Zap, Building2, MapPin } from 'lucide-react'

export default function AlertsPage() {
  const [alerts,  setAlerts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const fetchAlerts = async () => {
    try { const { data } = await getDashboardAlerts(); setAlerts(data) }
    catch (_) {} finally { setLoading(false) }
  }

  useEffect(() => { fetchAlerts() }, [])

  const handleAck = async (id) => {
    try {
      await acknowledgeAlert(id)
      setAlerts(prev => prev.map(a => a.id === id ? {...a, status:'acknowledged'} : a))
    } catch (_) {}
  }

  const displayed = alerts.filter(a => filter === 'all' ? true : a.status === filter)
  const activeCount = alerts.filter(a => a.status === 'active').length

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Hyderabad Outbreak Alerts</h1>
          <p className="text-sm text-slate-400 mt-0.5">Area-level alerts from the zone classification engine</p>
        </div>
        <button onClick={fetchAlerts} className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Total Alerts',  value:alerts.length,              color:'border-slate-600/50 bg-slate-800/40'     },
          { label:'Active',        value:activeCount,                color:'border-red-500/30   bg-red-500/8'        },
          { label:'Acknowledged',  value:alerts.length-activeCount,  color:'border-emerald-500/30 bg-emerald-500/8' },
        ].map(({label,value,color}) => (
          <div key={label} className={`rounded-2xl border p-4 text-center ${color}`}>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {['all','active','acknowledged'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium capitalize transition
              ${filter === f ? 'bg-brand-600 text-white' : 'bg-slate-700/40 text-slate-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-slate-500" /></div>
      ) : displayed.length === 0 ? (
        <div className="glass p-12 text-center">
          <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No alerts found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(a => {
            const high  = a.risk_level === 'RED'
            const isAck = a.status === 'acknowledged'

            return (
              <div key={a.id} className={`glass p-5 border transition fade-in
                ${isAck ? 'opacity-50 border-slate-600/30' : high ? 'border-red-500/30' : 'border-amber-500/30'}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl flex-shrink-0
                    ${isAck ? 'bg-slate-700/40' : high ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                    {isAck ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                           : high ? <Zap className="w-5 h-5 text-red-400" />
                                  : <AlertTriangle className="w-5 h-5 text-amber-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className="font-semibold text-white text-sm">{a.disease_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                        ${isAck ? 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                                : high ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                       : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                        {isAck ? 'Acknowledged' : high ? '🚨 HIGH RISK' : '⚠️ WARNING'}
                      </span>
                    </div>

                    {/* Area info */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                      <MapPin className="w-3 h-3" />
                      <span className="font-medium">{a.area_name}</span>
                      <span className="text-slate-600">·</span>
                      <Building2 className="w-3 h-3" />
                      <span>{a.clinics_involved} clinic{a.clinics_involved !== 1 ? 's' : ''} involved</span>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed mb-2">{a.message}</p>

                    {/* Affected clinics list */}
                    {a.affected_clinics?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {a.affected_clinics.slice(0,5).map(c => (
                          <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/30">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-slate-500">{new Date(a.timestamp).toLocaleString('en-IN')}</p>
                  </div>

                  {!isAck && (
                    <button onClick={() => handleAck(a.id)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-xl text-xs font-medium border border-emerald-500/25 transition">
                      <CheckCircle className="w-3.5 h-3.5" />Acknowledge
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
