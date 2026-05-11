/**
 * OutbreakMap.jsx — Hyderabad Leaflet map with ONE marker per area.
 * GREEN = Safe Area | YELLOW = Warning Area | RED = High Risk Area
 */

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

const ZONE_CFG = {
  RED:    { fill: '#ef4444', border: '#dc2626', radius: 22, label: '🚨 High Risk Area' },
  YELLOW: { fill: '#f59e0b', border: '#d97706', radius: 16, label: '⚠️ Warning Area'   },
  GREEN:  { fill: '#10b981', border: '#059669', radius: 11, label: '✅ Safe Area'       },
}

const HYD_CENTER = [17.385, 78.4867]
const HYD_ZOOM   = 12

export default function OutbreakMap({ zones = [] }) {
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const markersLayer = useRef(null)

  useEffect(() => {
    if (mapInstance.current) return

    mapInstance.current = L.map(mapRef.current, {
      center: HYD_CENTER, zoom: HYD_ZOOM, preferCanvas: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(mapInstance.current)

    markersLayer.current = L.layerGroup().addTo(mapInstance.current)

    return () => { mapInstance.current?.remove(); mapInstance.current = null }
  }, [])

  useEffect(() => {
    if (!markersLayer.current) return
    markersLayer.current.clearLayers()

    zones.forEach((z) => {
      const cfg = ZONE_CFG[z.zone] || ZONE_CFG.GREEN

      // Pulse ring for RED
      if (z.zone === 'RED') {
        L.circleMarker([z.latitude, z.longitude], {
          radius: cfg.radius + 10,
          fillColor: 'rgba(239,68,68,0.2)',
          color: 'transparent',
          fillOpacity: 0.4,
          interactive: false,
        }).addTo(markersLayer.current)
      }

      const circle = L.circleMarker([z.latitude, z.longitude], {
        radius:      cfg.radius,
        fillColor:   cfg.fill,
        color:       cfg.border,
        weight:      2.5,
        opacity:     1,
        fillOpacity: 0.75,
      })

      // Clinic list HTML
      const clinicRows = (z.clinic_names || []).slice(0, 5).map(c =>
        `<div style="display:flex;align-items:center;gap:5px;padding:2px 0;font-size:11px;color:#e2e8f0;">
           <span style="width:6px;height:6px;border-radius:50%;background:${cfg.fill};flex-shrink:0;"></span>
           ${c}
         </div>`
      ).join('')
      const moreClinic = z.clinic_count > 5
        ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">+${z.clinic_count-5} more</div>` : ''

      // Nearby outbreaks
      const nearbyHTML = z.nearby_outbreaks?.length
        ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #334155;">
             <div style="color:#94a3b8;font-size:11px;margin-bottom:3px;">Nearby Outbreaks:</div>
             ${z.nearby_outbreaks.map(n=>`<div style="font-size:11px;color:#fbbf24;">⚠️ ${n}</div>`).join('')}
           </div>` : ''

      // Disease tags
      const diseaseTags = (z.diseases || []).map(d =>
        `<span style="display:inline-block;padding:1px 7px;border-radius:4px;
          background:${cfg.fill}22;color:${cfg.fill};border:1px solid ${cfg.fill}44;
          font-size:10px;margin:2px 2px 0 0;">${d}</span>`
      ).join('')

      circle.bindPopup(`
        <div style="min-width:230px;font-family:sans-serif;">
          <div style="background:${cfg.fill}18;border:1px solid ${cfg.fill}44;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
            <div style="font-weight:700;font-size:14px;color:#f1f5f9;">${z.area_name}</div>
            <div style="font-size:11px;color:#94a3b8;">Hyderabad</div>
            <div style="margin-top:5px;display:inline-block;padding:2px 9px;border-radius:4px;
              background:${cfg.fill}33;color:${cfg.fill};font-size:11px;font-weight:700;">
              ${cfg.label}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:12px;padding:0 2px 6px;">
            <span style="color:#94a3b8">Clinics</span>   <span style="color:#e2e8f0">${z.clinic_count}</span>
            <span style="color:#94a3b8">Diseases</span>  <span style="color:#e2e8f0">${z.disease_count}</span>
            <span style="color:#94a3b8">Total Cases</span><span style="color:#e2e8f0">${z.total_cases?.toLocaleString()}</span>
            <span style="color:#94a3b8">Deaths</span>    <span style="color:#e2e8f0">${z.total_deaths?.toLocaleString()}</span>
          </div>
          <div style="padding:0 2px 4px;">
            <div style="color:#94a3b8;font-size:11px;margin-bottom:4px;">Active Diseases:</div>
            <div>${diseaseTags}</div>
          </div>
          <div style="padding:4px 2px 2px;border-top:1px solid #1e293b;">
            <div style="color:#94a3b8;font-size:11px;margin-bottom:3px;">Reporting Clinics:</div>
            ${clinicRows}${moreClinic}
          </div>
          ${nearbyHTML}
        </div>
      `, { maxWidth: 300 })

      markersLayer.current.addLayer(circle)
    })
  }, [zones])

  return (
    <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-slate-700/50"
      style={{ height: '460px' }} />
  )
}
