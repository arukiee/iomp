/**
 * ForecastPage.jsx — Disease spread forecasting with Chart.js visualization
 */

import React, { useState } from 'react'
import { getForecast } from '../api.js'
import ForecastChart from '../components/ForecastChart.jsx'
import { TrendingUp, RefreshCw, AlertCircle, Info } from 'lucide-react'

const DISEASES = ['Dengue','Cholera','Malaria','COVID-19','Typhoid','Influenza','Hepatitis A','Leptospirosis']

export default function ForecastPage() {
  const [selectedDisease, setSelectedDisease] = useState('Dengue')
  const [forecastData,    setForecastData]    = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')

  const runForecast = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getForecast(selectedDisease)
      setForecastData(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Forecast failed. No data for this disease.')
      setForecastData(null)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Disease Forecast</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          ML-powered 7-day spread prediction using Linear Regression
        </p>
      </div>

      {/* Controls */}
      <div className="glass p-5">
        <h2 className="font-semibold text-white text-sm mb-4">Configure Forecast</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-slate-400 mb-1.5">Select Disease</label>
            <select
              value={selectedDisease}
              onChange={(e) => setSelectedDisease(e.target.value)}
              className="w-full bg-slate-700/40 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {DISEASES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <button
            onClick={runForecast}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition shadow-lg shadow-brand-600/20"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {loading ? 'Running…' : 'Generate Forecast'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Chart */}
      {forecastData && (
        <div className="glass p-6 fade-in">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">
                {forecastData.disease_name} — Case Projection
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Historical (14 days) + 7-day forecast • Model: {forecastData.model}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">R² Score</div>
              <div className={`text-lg font-bold ${forecastData.r2_score >= 0.7 ? 'text-emerald-400' : forecastData.r2_score >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
                {forecastData.r2_score}
              </div>
            </div>
          </div>

          <ForecastChart data={forecastData} />

          {/* Forecast table */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">7-Day Forecast Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {forecastData.forecast_labels.map((label, i) => (
                <div key={label} className="bg-slate-700/30 rounded-xl p-3 text-center border border-slate-600/30">
                  <div className="text-xs text-slate-400 mb-1">{label}</div>
                  <div className="text-lg font-bold text-amber-300">
                    {forecastData.forecast_data[i]?.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">cases</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!forecastData && !loading && !error && (
        <div className="glass p-12 text-center fade-in">
          <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Select a disease and click Generate Forecast to see predictions</p>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-slate-500">
            <Info className="w-3.5 h-3.5" />
            Uses scikit-learn Linear Regression on 14-day historical data
          </div>
        </div>
      )}
    </div>
  )
}
