/**
 * ReportsPage.jsx — Submit new clinic-level case/death reports + view all reports
 *                   Hyderabad-focused facility list
 */

import React, { useEffect, useState } from 'react'
import { getReports, reportCase, reportDeath } from '../api.js'
import { FileText, Plus, X, CheckCircle, AlertCircle, RefreshCw, Building2 } from 'lucide-react'

// ── Hyderabad clinics list ────────────────────────────────────────────────────
const HYD_CLINICS = [
  // Gachibowli
  { area_id:'HYD-GACHI', area_name:'Gachibowli', clinic_name:'AIG Hospital',           lat:17.4400, lon:78.3489 },
  { area_id:'HYD-GACHI', area_name:'Gachibowli', clinic_name:'Continental Hospital',    lat:17.4338, lon:78.3536 },
  { area_id:'HYD-GACHI', area_name:'Gachibowli', clinic_name:'Medicover Clinic',        lat:17.4450, lon:78.3520 },
  // Jubilee Hills
  { area_id:'HYD-JUBIL', area_name:'Jubilee Hills', clinic_name:'Apollo Hospital',      lat:17.4239, lon:78.4071 },
  { area_id:'HYD-JUBIL', area_name:'Jubilee Hills', clinic_name:'Rainbow Hospital',     lat:17.4300, lon:78.4100 },
  { area_id:'HYD-JUBIL', area_name:'Jubilee Hills', clinic_name:'Olive Clinic',         lat:17.4200, lon:78.4130 },
  // Banjara Hills
  { area_id:'HYD-BANJA', area_name:'Banjara Hills', clinic_name:'Care Hospitals',       lat:17.4126, lon:78.4482 },
  { area_id:'HYD-BANJA', area_name:'Banjara Hills', clinic_name:'Ankura Hospital',      lat:17.4160, lon:78.4440 },
  { area_id:'HYD-BANJA', area_name:'Banjara Hills', clinic_name:'MaxCure Hospital',     lat:17.4180, lon:78.4500 },
  // Hitech City
  { area_id:'HYD-HTECH', area_name:'Hitech City',   clinic_name:'Yashoda Hitech',       lat:17.4486, lon:78.3908 },
  { area_id:'HYD-HTECH', area_name:'Hitech City',   clinic_name:'Shalini Hospital',     lat:17.4510, lon:78.3950 },
  { area_id:'HYD-HTECH', area_name:'Hitech City',   clinic_name:'Primus Clinic',        lat:17.4460, lon:78.3870 },
  // Madhapur
  { area_id:'HYD-MADHA', area_name:'Madhapur',      clinic_name:'Seven Hills Hospital', lat:17.4525, lon:78.3913 },
  { area_id:'HYD-MADHA', area_name:'Madhapur',      clinic_name:'Madhava Clinic',       lat:17.4550, lon:78.3940 },
  { area_id:'HYD-MADHA', area_name:'Madhapur',      clinic_name:'Lotus Healthcare',     lat:17.4480, lon:78.3920 },
  // Kukatpally
  { area_id:'HYD-KUKAT', area_name:'Kukatpally',    clinic_name:'KIMS Hospital',        lat:17.4849, lon:78.4138 },
  { area_id:'HYD-KUKAT', area_name:'Kukatpally',    clinic_name:'Mediwin Hospital',     lat:17.4870, lon:78.4160 },
  { area_id:'HYD-KUKAT', area_name:'Kukatpally',    clinic_name:'SunCare Clinic',       lat:17.4820, lon:78.4120 },
  // Secunderabad
  { area_id:'HYD-SECUN', area_name:'Secunderabad',  clinic_name:'Yashoda Hospital',     lat:17.4399, lon:78.4983 },
  { area_id:'HYD-SECUN', area_name:'Secunderabad',  clinic_name:'Sunshine Hospital',    lat:17.4420, lon:78.5000 },
  { area_id:'HYD-SECUN', area_name:'Secunderabad',  clinic_name:'Care Clinic',          lat:17.4370, lon:78.4960 },
  // Ameerpet
  { area_id:'HYD-AMEER', area_name:'Ameerpet',      clinic_name:'Vijaya Hospital',      lat:17.4375, lon:78.4483 },
  { area_id:'HYD-AMEER', area_name:'Ameerpet',      clinic_name:'Vaibhav Clinic',       lat:17.4395, lon:78.4510 },
  { area_id:'HYD-AMEER', area_name:'Ameerpet',      clinic_name:'Ameerpet Health Centre',lat:17.4360,lon:78.4460 },
  // LB Nagar
  { area_id:'HYD-LBNGA', area_name:'LB Nagar',      clinic_name:'Rajeev Gandhi Hospital',lat:17.3472,lon:78.5511 },
  { area_id:'HYD-LBNGA', area_name:'LB Nagar',      clinic_name:'Sparsh Hospital',      lat:17.3490, lon:78.5530 },
  { area_id:'HYD-LBNGA', area_name:'LB Nagar',      clinic_name:'LB General Clinic',    lat:17.3450, lon:78.5490 },
  // Uppal
  { area_id:'HYD-UPPAL', area_name:'Uppal',         clinic_name:'Uppal General Hospital',lat:17.4055,lon:78.5592 },
  { area_id:'HYD-UPPAL', area_name:'Uppal',         clinic_name:'City Care Clinic',     lat:17.4070, lon:78.5610 },
  { area_id:'HYD-UPPAL', area_name:'Uppal',         clinic_name:'Medicity Hospital',    lat:17.4040, lon:78.5570 },
  // Kondapur
  { area_id:'HYD-KONDA', area_name:'Kondapur',      clinic_name:'Aware Gleneagles',     lat:17.4600, lon:78.3724 },
  { area_id:'HYD-KONDA', area_name:'Kondapur',      clinic_name:'Kondapur Health Clinic',lat:17.4620,lon:78.3750 },
  { area_id:'HYD-KONDA', area_name:'Kondapur',      clinic_name:'Synergy Hospitals',    lat:17.4580, lon:78.3700 },
  // Miyapur
  { area_id:'HYD-MIYAP', area_name:'Miyapur',       clinic_name:'Citizens Specialty',   lat:17.4963, lon:78.3553 },
  { area_id:'HYD-MIYAP', area_name:'Miyapur',       clinic_name:'Miyapur Clinic',       lat:17.4980, lon:78.3570 },
  { area_id:'HYD-MIYAP', area_name:'Miyapur',       clinic_name:'Amrutha Hospital',     lat:17.4940, lon:78.3530 },
  // Begumpet
  { area_id:'HYD-BEGUM', area_name:'Begumpet',      clinic_name:'NIMS',                 lat:17.4350, lon:78.4651 },
  { area_id:'HYD-BEGUM', area_name:'Begumpet',      clinic_name:'Begumpet Health Centre',lat:17.4370,lon:78.4670 },
  { area_id:'HYD-BEGUM', area_name:'Begumpet',      clinic_name:'Sterling Hospital',    lat:17.4330, lon:78.4630 },
  // Tarnaka
  { area_id:'HYD-TARNA', area_name:'Tarnaka',       clinic_name:'Tarnaka Area Hospital',lat:17.4289, lon:78.5424 },
  { area_id:'HYD-TARNA', area_name:'Tarnaka',       clinic_name:"St. Theresa's Clinic", lat:17.4310, lon:78.5440 },
  { area_id:'HYD-TARNA', area_name:'Tarnaka',       clinic_name:'Osmania General',      lat:17.3888, lon:78.4771 },
  // Charminar
  { area_id:'HYD-CHARM', area_name:'Charminar',     clinic_name:'Government General',   lat:17.3800, lon:78.4741 },
  { area_id:'HYD-CHARM', area_name:'Charminar',     clinic_name:'Charminar Clinic',     lat:17.3610, lon:78.4720 },
  { area_id:'HYD-CHARM', area_name:'Charminar',     clinic_name:'Al-Shifa Hospital',    lat:17.3580, lon:78.4700 },
]

const DISEASES = ['Dengue','Cholera','Malaria','COVID-19','Typhoid','Influenza','Hepatitis A','Leptospirosis']

// Group clinics by area for the select dropdown
const AREAS = [...new Set(HYD_CLINICS.map(c => c.area_name))]

const BLANK_FORM = { clinic_key: '', disease_name: '', case_count: '', death_count: '', date: '' }

export default function ReportsPage() {
  const [reports,    setReports]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(BLANK_FORM)
  const [formType,   setFormType]   = useState('case')
  const [submitting, setSubmitting] = useState(false)
  const [toast,      setToast]      = useState(null)

  const fetchReports = async () => {
    try {
      const { data } = await getReports()
      setReports(data)
    } catch (_) {} finally { setLoading(false) }
  }

  useEffect(() => { fetchReports() }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const clinic = HYD_CLINICS.find((c) => `${c.area_id}::${c.clinic_name}` === form.clinic_key)
    if (!clinic)           { showToast('Please select a clinic', 'error'); return }
    if (!form.disease_name){ showToast('Please select a disease', 'error'); return }
    setSubmitting(true)
    try {
      const payload = {
        area_id:      clinic.area_id,
        area_name:    clinic.area_name,
        clinic_name:  clinic.clinic_name,
        latitude:     clinic.lat,
        longitude:    clinic.lon,
        disease_name: form.disease_name,
        date:         form.date || undefined,
        ...(formType === 'case'  ? { case_count:  parseInt(form.case_count)  || 0 } : {}),
        ...(formType === 'death' ? { death_count: parseInt(form.death_count) || 0 } : {}),
      }
      formType === 'case' ? await reportCase(payload) : await reportDeath(payload)
      showToast('Report submitted successfully')
      setForm(BLANK_FORM)
      setShowForm(false)
      fetchReports()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Submission failed', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
          ${toast.type === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Hyderabad Clinic Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Submit and manage clinic-level outbreak case reports</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-xl text-white text-sm font-medium transition shadow-lg shadow-brand-600/20"
        >
          <Plus className="w-4 h-4" /> New Report
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass p-6 fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">Submit New Report</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Report type toggle */}
          <div className="flex gap-2 mb-5">
            {['case','death'].map((t) => (
              <button key={t} onClick={() => setFormType(t)}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition
                  ${formType === t ? 'bg-brand-600 text-white' : 'bg-slate-700/40 text-slate-400 hover:text-white'}`}>
                {t === 'case' ? '🦠 Case Report' : '☠️ Death Report'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Clinic select — grouped by area */}
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Hyderabad Clinic / Hospital *</label>
              <select value={form.clinic_key} onChange={(e) => setForm({ ...form, clinic_key: e.target.value })}
                className="w-full bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500">
                <option value="">Select clinic…</option>
                {AREAS.map((area) => (
                  <optgroup key={area} label={`— ${area} —`}>
                    {HYD_CLINICS.filter(c => c.area_name === area).map((c) => (
                      <option key={`${c.area_id}::${c.clinic_name}`} value={`${c.area_id}::${c.clinic_name}`}>
                        {c.clinic_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Disease */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Disease *</label>
              <select value={form.disease_name} onChange={(e) => setForm({ ...form, disease_name: e.target.value })}
                className="w-full bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500">
                <option value="">Select disease…</option>
                {DISEASES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>

            {/* Count */}
            {formType === 'case' ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Case Count</label>
                <input type="number" min="0" value={form.case_count}
                  onChange={(e) => setForm({ ...form, case_count: e.target.value })}
                  placeholder="0"
                  className="w-full bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Death Count</label>
                <input type="number" min="0" value={form.death_count}
                  onChange={(e) => setForm({ ...form, death_count: e.target.value })}
                  placeholder="0"
                  className="w-full bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500" />
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Report Date (optional)</label>
              <input type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500" />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setForm(BLANK_FORM) }}
                className="px-5 py-2.5 rounded-xl bg-slate-700/40 text-slate-300 text-sm hover:bg-slate-700 transition">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reports table */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-400" />
            <h2 className="font-semibold text-white text-sm">All Reports</h2>
            <span className="text-xs text-slate-500 ml-1">({reports.length})</span>
          </div>
          <button onClick={fetchReports} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/40 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  {['ID','Clinic','Area','Disease','Cases','Deaths','Date'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 text-xs">#{r.id}</td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        {r.clinic_name || '—'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-xs">{r.area_name}</td>
                    <td className="py-2.5 px-3 text-slate-300">{r.disease_name}</td>
                    <td className="py-2.5 px-3 text-slate-300">{r.case_count?.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-400">{r.death_count}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">
                      {new Date(r.timestamp).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
