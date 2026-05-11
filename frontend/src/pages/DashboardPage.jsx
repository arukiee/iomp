/**
 * DashboardPage.jsx — Hyderabad area-level outbreak dashboard
 * Shows: user role/clinic info, area-wise status, filters, map
 */

import React, { useEffect, useState, useCallback } from 'react'
import { getDashboardStats, getDashboardZones, getDashboardAlerts, acknowledgeAlert } from '../api.js'
import StatCard    from '../components/StatCard.jsx'
import OutbreakMap from '../components/OutbreakMap.jsx'
import {
  Users, TrendingUp, Skull, MapPin, AlertTriangle,
  CheckCircle, RefreshCw, Bell, Map, Building2, Filter, Shield,
} from 'lucide-react'

const AREAS    = ['Gachibowli','Jubilee Hills','Banjara Hills','Hitech City','Madhapur',
                  'Kukatpally','Secunderabad','Ameerpet','LB Nagar','Uppal',
                  'Kondapur','Miyapur','Begumpet','Tarnaka','Charminar']
const DISEASES = ['Dengue','Cholera','Malaria','COVID-19','Typhoid']
const ZONES    = ['RED','YELLOW','GREEN']

const ROLE_BADGE = {
  admin:                 { label: 'Admin',                 cls: 'bg-red-500/20 text-red-300 border-red-500/30'           },
  hospital_staff:        { label: 'Hospital Staff',        cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30'        },
  clinic_staff:          { label: 'Clinic Staff',          cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30'  },
  public_health_officer: { label: 'Public Health Officer', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'},
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState(null)
  const [zones,   setZones]   = useState([])
  const [alerts,  setAlerts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Filters
  const [filterArea,    setFilterArea]    = useState('')
  const [filterDisease, setFilterDisease] = useState('')
  const [filterZone,    setFilterZone]    = useState('')

  const user = JSON.parse(localStorage.getItem('epicast_user') || '{}')
  const roleBadge = ROLE_BADGE[user.role] || { label: user.role, cls: 'bg-slate-700 text-slate-300' }

  const fetchAll = useCallback(async () => {
    try {
      const params = {}
      if (filterArea)    params.area    = filterArea
      if (filterDisease) params.disease = filterDisease
      if (filterZone)    params.zone    = filterZone

      const [s, z, a] = await Promise.all([
        getDashboardStats(),
        getDashboardZones(params),
        getDashboardAlerts(),
      ])
      setStats(s.data)
      setZones(z.data)
      setAlerts(a.data)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [filterArea, filterDisease, filterZone])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { const id = setInterval(fetchAll, 60_000); return () => clearInterval(id) }, [fetchAll])

  const handleAck = async (id) => {
    try {
      await acknowledgeAlert(id)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a))
    } catch (_) {}
  }

  const activeAlerts = alerts.filter(a => a.status === 'active')

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin" /><span>Loading dashboard…</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 fade-in">
      {/* Header with user role */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Hyderabad Outbreak Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Area-level disease surveillance across Hyderabad</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Role badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${roleBadge.cls}`}>
            <Shield className="w-3.5 h-3.5" />
            {roleBadge.label}
            {user.assigned_clinic && <span className="text-slate-400 ml-1">· {user.assigned_clinic}</span>}
            {!user.assigned_clinic && user.assigned_area && <span className="text-slate-400 ml-1">· {user.assigned_area}</span>}
          </div>
          <button onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm transition">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">Last updated: {lastRefresh.toLocaleTimeString()}</p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Active Cases"  value={stats.active_cases?.toLocaleString()} icon={Users}         color="brand"   />
          <StatCard title="Total Cases"   value={stats.total_cases?.toLocaleString()}  icon={TrendingUp}    color="sky"     />
          <StatCard title="Total Deaths"  value={stats.total_deaths?.toLocaleString()} icon={Skull}         color="violet"  />
          <StatCard title="Red Areas"     value={stats.red_zones}                      icon={AlertTriangle} color="red"     />
          <StatCard title="Yellow Areas"  value={stats.yellow_zones}                   icon={MapPin}        color="amber"   />
          <StatCard title="Active Clinics"value={stats.total_clinics}                  icon={Building2}     color="emerald" />
        </div>
      )}

      {/* Filters */}
      <div className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-brand-400" />
          <span className="text-sm font-medium text-white">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
            className="bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
            <option value="">All Areas</option>
            {AREAS.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={filterDisease} onChange={e => setFilterDisease(e.target.value)}
            className="bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
            <option value="">All Diseases</option>
            {DISEASES.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
            className="bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
            <option value="">All Zones</option>
            {ZONES.map(z => <option key={z}>{z}</option>)}
          </select>
        </div>
        {(filterArea || filterDisease || filterZone) && (
          <button onClick={() => { setFilterArea(''); setFilterDisease(''); setFilterZone('') }}
            className="mt-2 text-xs text-brand-400 hover:text-brand-300">
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Map + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <Map className="w-4 h-4 text-brand-400" />
            <h2 className="font-semibold text-white text-sm">Hyderabad Area Risk Map</h2>
            <span className="ml-auto text-xs text-slate-500">{zones.length} areas shown</span>
          </div>
          <OutbreakMap zones={zones} />
          <div className="flex items-center gap-5 mt-3">
            {[['RED','bg-red-500','🚨 High Risk'],['YELLOW','bg-amber-500','⚠️ Warning'],['GREEN','bg-emerald-500','✅ Safe']].map(([z,cls,lbl])=>(
              <div key={z} className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className={`w-3 h-3 rounded-full ${cls}`} />{lbl}
              </div>
            ))}
          </div>
        </div>

        {/* Active alerts */}
        <div className="glass p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-white text-sm">Active Alerts</h2>
            {activeAlerts.length > 0 && (
              <span className="ml-auto bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full border border-red-500/30">
                {activeAlerts.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
                <CheckCircle className="w-8 h-8 mb-2 text-emerald-600" />No active alerts
              </div>
            ) : activeAlerts.slice(0, 12).map((a) => (
              <div key={a.id} className={`rounded-xl p-3 border text-sm
                ${a.risk_level === 'RED'
                  ? 'bg-red-500/10 border-red-500/25'
                  : 'bg-amber-500/10 border-amber-500/25'}`}>
                <p className="font-medium text-white text-xs mb-0.5">
                  {a.disease_name} — {a.area_name}
                </p>
                <p className="text-slate-500 text-xs mb-1">
                  {a.clinics_involved} clinic{a.clinics_involved !== 1 ? 's' : ''} involved
                </p>
                <p className="text-slate-400 text-xs leading-snug">{a.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-600">{new Date(a.timestamp).toLocaleDateString('en-IN')}</span>
                  <button onClick={() => handleAck(a.id)}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area status grid */}
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-brand-400" />
          <h2 className="font-semibold text-white text-sm">Area-wise Outbreak Status</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {zones.map((z) => {
            const colourCls = z.zone === 'RED' ? 'border-red-500/40 bg-red-500/5' :
                              z.zone === 'YELLOW' ? 'border-amber-500/40 bg-amber-500/5' :
                              'border-emerald-500/30 bg-emerald-500/5'
            const badgeCls  = z.zone === 'RED' ? 'badge-red' :
                              z.zone === 'YELLOW' ? 'badge-yellow' : 'badge-green'
            return (
              <div key={z.area_id} className={`rounded-xl border p-3 ${colourCls}`}>
                <p className="text-xs font-semibold text-slate-200 mb-1">{z.area_name}</p>
                <p className="text-xs text-slate-400 mb-1">{z.clinic_count} clinics · {z.disease_count} disease{z.disease_count !== 1 ? 's' : ''}</p>
                <p className="text-xs text-slate-500 mb-2">{z.total_cases?.toLocaleString()} cases</p>
                <span className={badgeCls}>{z.zone}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
