/**
 * AccessRequestsPage.jsx — Admin inbox + quick “create account” from a request
 */

import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  getAccessRequests,
  createUser,
  markAccessRequestProvisioned,
} from '../api.js'
import {
  PROVISION_ROLES,
  HYD_AREAS,
  CLINICS_BY_AREA,
  suggestUsernameFromEmail,
  suggestTemporaryPassword,
} from '../constants/hyderabadUserForm.js'
import {
  Inbox,
  RefreshCw,
  Lock,
  Mail,
  Building2,
  User,
  Search,
  UserPlus,
  X,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react'

const BLANK_PROVISION = {
  username: '',
  password: '',
  role: 'clinic_staff',
  assigned_area: '',
  assigned_clinic: '',
  full_name: '',
  email: '',
}

export default function AccessRequestsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [queueTab, setQueueTab] = useState('open')
  const [provisionFor, setProvisionFor] = useState(null)
  const [pForm, setPForm] = useState(BLANK_PROVISION)
  const [pSubmitting, setPSubmitting] = useState(false)
  const [pError, setPError] = useState('')
  const [toast, setToast] = useState(null)

  const fetchRows = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getAccessRequests()
      setRows(data)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 403) {
        setError('Access denied — administrators only.')
      } else if (status === 401) {
        setError(typeof detail === 'string' ? detail : 'Session invalid. Please sign in again.')
      } else {
        setError('Failed to load access requests.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows() }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const openProvision = (row) => {
    setPError('')
    setProvisionFor(row)
    setPForm({
      ...BLANK_PROVISION,
      full_name: row.full_name || '',
      email: row.email || '',
      username: suggestUsernameFromEmail(row.email),
      password: suggestTemporaryPassword(),
      role: 'clinic_staff',
    })
  }

  const closeProvision = () => {
    setProvisionFor(null)
    setPForm(BLANK_PROVISION)
    setPError('')
  }

  const availableClinics = CLINICS_BY_AREA[pForm.assigned_area] || []

  const handleProvisionSubmit = async (e) => {
    e.preventDefault()
    setPError('')
    if (!pForm.username.trim() || !pForm.password.trim()) {
      setPError('Username and password are required.')
      return
    }
    setPSubmitting(true)
    try {
      await createUser({
        username: pForm.username.trim(),
        password: pForm.password,
        role: pForm.role,
        assigned_area: pForm.assigned_area,
        assigned_clinic: pForm.assigned_clinic,
        full_name: pForm.full_name.trim(),
        email: pForm.email.trim(),
      })
      try {
        await markAccessRequestProvisioned(provisionFor.id, pForm.username.trim())
      } catch (markErr) {
        showToast(
          `User "${pForm.username}" was created, but marking this request failed. Mark it manually or refresh.`,
          'error',
        )
        closeProvision()
        fetchRows()
        setPSubmitting(false)
        return
      }
      showToast(`Account "${pForm.username}" created and request marked done.`)
      closeProvision()
      fetchRows()
    } catch (err) {
      const d = err.response?.data?.detail
      setPError(typeof d === 'string' ? d : 'Could not create user. Check username is unique.')
    } finally {
      setPSubmitting(false)
    }
  }

  const q = search.trim().toLowerCase()
  const searched = useMemo(() => {
    if (!q) return rows
    return rows.filter((r) =>
      [r.full_name, r.email, r.organization, r.use_case, r.provisioned_username]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [rows, q])

  const openRows = searched.filter((r) => !r.provisioned_username)
  const doneRows = searched.filter((r) => r.provisioned_username)
  const list = queueTab === 'open' ? openRows : doneRows

  return (
    <div className="space-y-6 fade-in relative">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
          ${toast.type === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Access requests</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Approve a request in one step:{' '}
            <strong className="text-slate-300">Create account</strong> pre-fills name, email, and a suggested username and password. You can edit everything before saving.
            {' '}
            <Link to="/users" className="text-brand-400 hover:underline">Open full Users page</Link>
            {' '}for edits later.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRows}
          className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/25 text-brand-300 rounded-xl px-4 py-2.5 text-xs">
        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
        Administrators only. Creating a user from here also marks the request as completed.
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
          <Lock className="w-4 h-4" />
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex rounded-xl border border-slate-600/50 p-0.5 bg-slate-800/40 w-fit">
              <button
                type="button"
                onClick={() => setQueueTab('open')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  queueTab === 'open'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                To do ({openRows.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('done')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  queueTab === 'done'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Done ({doneRows.length})
              </button>
            </div>
            <div className="glass p-3 flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-slate-700/40 border border-slate-600/50 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <Inbox className="w-4 h-4 text-brand-400" />
              <h2 className="font-semibold text-white text-sm">
                {queueTab === 'open' ? 'Queue' : 'Provisioned'}
              </h2>
              <span className="text-xs text-slate-500 ml-1">({list.length})</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-center text-slate-500 py-10 text-sm">
                {queueTab === 'open'
                  ? rows.length === 0
                    ? 'No access requests yet.'
                    : 'Nothing left in this queue for your search.'
                  : 'No completed requests match your search.'}
              </p>
            ) : (
              <div className="space-y-4">
                {list.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-xl border p-4 text-sm ${
                      r.provisioned_username
                        ? 'border-slate-700/40 bg-slate-800/20 opacity-90'
                        : 'border-slate-700/50 bg-slate-800/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(r.full_name || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            {r.full_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {new Date(r.created_at).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-600 font-mono">#{r.id}</span>
                        {!r.provisioned_username && (
                          <button
                            type="button"
                            onClick={() => openProvision(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition shadow-lg shadow-brand-600/20"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Create account
                          </button>
                        )}
                      </div>
                    </div>
                    {r.provisioned_username ? (
                      <div className="text-xs text-emerald-400/90 flex items-center gap-1.5 mb-2">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Account <span className="font-mono text-emerald-300">{r.provisioned_username}</span>
                        {r.provisioned_at && (
                          <span className="text-slate-500">
                            · {new Date(r.provisioned_at).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    ) : null}
                    <div className="space-y-2 text-slate-300">
                      <div className="flex items-start gap-2">
                        <Mail className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                        <a href={`mailto:${r.email}`} className="text-brand-400 hover:underline break-all">
                          {r.email}
                        </a>
                      </div>
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                        <span>{r.organization}</span>
                      </div>
                      {r.use_case ? (
                        <p className="text-slate-400 text-xs leading-relaxed pl-6 border-l border-slate-600/50 ml-1">
                          {r.use_case}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {provisionFor && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="provision-title"
          onClick={(e) => e.target === e.currentTarget && !pSubmitting && closeProvision()}
        >
          <div
            className="bg-slate-900 border border-slate-600/60 rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 id="provision-title" className="text-lg font-semibold text-white">
                  Create account from request
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Request #{provisionFor.id} · {provisionFor.organization}
                </p>
              </div>
              <button
                type="button"
                disabled={pSubmitting}
                onClick={closeProvision}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 mb-4 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {pError}
              </div>
            )}

            <form onSubmit={handleProvisionSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Username</label>
                <input
                  value={pForm.username}
                  onChange={(e) => setPForm({ ...pForm, username: e.target.value })}
                  required
                  className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  placeholder="login id"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400">Password</label>
                  <button
                    type="button"
                    onClick={() => setPForm({ ...pForm, password: suggestTemporaryPassword() })}
                    className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    New suggestion
                  </button>
                </div>
                <input
                  type="text"
                  autoComplete="new-password"
                  value={pForm.password}
                  onChange={(e) => setPForm({ ...pForm, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">Share this password securely with the user; they should change it after first login.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Full name</label>
                  <input
                    value={pForm.full_name}
                    onChange={(e) => setPForm({ ...pForm, full_name: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={pForm.email}
                    onChange={(e) => setPForm({ ...pForm, email: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Role</label>
                <select
                  value={pForm.role}
                  onChange={(e) => setPForm({ ...pForm, role: e.target.value, assigned_clinic: '' })}
                  className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  {PROVISION_ROLES.map((ro) => (
                    <option key={ro.value} value={ro.value}>
                      {ro.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Assigned area</label>
                <select
                  value={pForm.assigned_area}
                  onChange={(e) => setPForm({ ...pForm, assigned_area: e.target.value, assigned_clinic: '' })}
                  className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">— None —</option>
                  {HYD_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              {['clinic_staff', 'hospital_staff'].includes(pForm.role) && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Assigned clinic</label>
                  <select
                    value={pForm.assigned_clinic}
                    onChange={(e) => setPForm({ ...pForm, assigned_clinic: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">— None —</option>
                    {availableClinics.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {!pForm.assigned_area && (
                    <p className="text-[11px] text-slate-500 mt-1">Pick an area to list clinics.</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-slate-700/50">
                <button
                  type="button"
                  disabled={pSubmitting}
                  onClick={closeProvision}
                  className="px-4 py-2.5 rounded-xl bg-slate-700/50 text-slate-300 text-sm hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {pSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Create user &amp; mark done
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
