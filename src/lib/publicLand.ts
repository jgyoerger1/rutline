/**
 * Public land and walk-in access. Public land is PAD-US (USGS Protected Areas
 * Database), nationwide; walk-in programs are per-state layers. Sources and
 * code tables are filled from verified endpoints.
 */
import type L from 'leaflet'
import type { OverlayFeature, OverlaySource } from './overlays'

export const PUBLIC_SOURCES: OverlaySource[] = []
export const ACCESS_SOURCES: OverlaySource[] = []

export type Access = 'open' | 'restricted' | 'closed' | 'unknown'

export interface PublicInfo {
  name: string
  manager: string
  managerType: string
  designation: string
  access: Access
  acres: number | null
  easement: boolean
}

export function describePublic(f: OverlayFeature): PublicInfo {
  const p = f.props
  return {
    name: String(p.Unit_Nm ?? 'Public land'),
    manager: String(p.Mang_Name ?? ''),
    managerType: String(p.Mang_Type ?? ''),
    designation: String(p.Des_Tp ?? ''),
    access: 'unknown',
    acres: typeof p.GIS_Acres === 'number' ? p.GIS_Acres : null,
    easement: false,
  }
}

export function publicStyle(f: OverlayFeature): L.PathOptions | null {
  void f
  return { color: '#8fa882', weight: 1, opacity: 0.8, fillColor: '#8fa882', fillOpacity: 0.18 }
}

export function accessStyle(): L.PathOptions {
  return { color: '#f5a86b', weight: 1.5, opacity: 0.9, dashArray: '5 4', fillColor: '#e8702c', fillOpacity: 0.1 }
}

export interface AccessInfo {
  program: string
  name: string
  infoUrl: string | null
}

export function describeAccess(f: OverlayFeature): AccessInfo {
  const src = ACCESS_SOURCES.find((s) => s.id === f.sourceId)
  return { program: src?.label ?? 'Walk-in access', name: src?.nameField ? String(f.props[src.nameField] ?? '') : '', infoUrl: src?.infoUrl ?? null }
}
