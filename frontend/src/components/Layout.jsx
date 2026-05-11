/**
 * Layout.jsx — Sidebar + navbar with role-aware navigation
 */

import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../api.js'
import {
  LayoutDashboard, FileText, TrendingUp, Bell, ScrollText,
  LogOut, Menu, Activity, ChevronRight, Users, Shield, Inbox,
} from 'lucide-react'

const ROLE_BADGE = {
  admin:                 { label: 'Admin',    cls: 'text-red-400'     },
  hospital_staff:        { label: 'Hospital', cls: 'text-blue-400'    },
  clinic_staff:          { label: 'Clinic',   cls: 'text-violet-400'  },
  public_health_officer: { label: 'PHO',      cls: 'text-emerald-400' },
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const user     = JSON.parse(localStorage.getItem('epicast_user') || '{}')
  const isAdmin  = user.role === 'admin'
  const isPHO    = user.role === 'public_health_officer'
  const badge    = ROLE_BADGE[user.role] || { label: user.role, cls: 'text-slate-400' }

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    localStorage.removeItem('epicast_token')
    localStorage.removeItem('epicast_user')
    navigate('/login')
  }

  const NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard',     icon: LayoutDashboard, show: true     },
    { to: '/reports',   label: 'Reports',        icon: FileText,        show: !isPHO   },
    { to: '/forecast',  label: 'Forecast',       icon: TrendingUp,      show: true     },
    { to: '/alerts',    label: 'Alerts',          icon: Bell,            show: true     },
    { to: '/users',           label: 'Users',            icon: Users,           show: isAdmin  },
    { to: '/access-requests', label: 'Access requests',  icon: Inbox,           show: isAdmin  },
    { to: '/logs',            label: 'Activity Logs',    icon: ScrollText,      show: isAdmin  },
  ].filter(n => n.show)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-brand-600 flex items-center justify-center shadow-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-wide">EPICAST</div>
            <div className="text-xs text-slate-400">Hyderabad · Outbreak Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
               ${isActive
                 ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30'
                 : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`
            }>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* User card */}
      <div className="px-3 pb-4 border-t border-slate-700/50 pt-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-700/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">{user.username || 'User'}</div>
            <div className={`text-xs font-medium ${badge.cls}`}>{badge.label}
              {user.assigned_clinic && <span className="text-slate-500 font-normal"> · {user.assigned_clinic}</span>}
            </div>
          </div>
          <button onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col bg-slate-900 border-r border-slate-700/50">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-64 h-full bg-slate-900 border-r border-slate-700/50">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-4 px-4 lg:px-6 py-3.5 bg-slate-900/80 backdrop-blur border-b border-slate-700/50 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Live Monitoring · Hyderabad</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs font-medium ${badge.cls}`}>
              <Shield className="w-3 h-3" />{badge.label}
            </div>
            <div className="text-xs text-slate-500">
              {new Date().toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric' })}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
