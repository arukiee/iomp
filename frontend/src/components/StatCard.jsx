/**
 * StatCard.jsx — KPI summary card used on the Dashboard
 */

import React from 'react'

export default function StatCard({ title, value, icon: Icon, color = 'brand', trend }) {
  const colours = {
    brand:   { bg: 'bg-brand-500/15',   icon: 'text-brand-400',   border: 'border-brand-500/20'   },
    red:     { bg: 'bg-red-500/15',     icon: 'text-red-400',     border: 'border-red-500/20'     },
    amber:   { bg: 'bg-amber-500/15',   icon: 'text-amber-400',   border: 'border-amber-500/20'   },
    emerald: { bg: 'bg-emerald-500/15', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
    violet:  { bg: 'bg-violet-500/15',  icon: 'text-violet-400',  border: 'border-violet-500/20'  },
    sky:     { bg: 'bg-sky-500/15',     icon: 'text-sky-400',     border: 'border-sky-500/20'     },
  }
  const c = colours[color] || colours.brand

  return (
    <div className={`glass p-5 fade-in border ${c.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
          {trend && (
            <p className="text-xs text-slate-500 mt-1">{trend}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  )
}
