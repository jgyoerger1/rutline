/**
 * Public land and walk-in access. Public land is PAD-US (USGS Protected
 * Areas Database of the United States), nationwide: federal, state and
 * local land plus easements, each with a public-access code. Walk-in access
 * programs (private land leased for public hunting) are per-state layers.
 */
import type L from 'leaflet'
import type { OverlayFeature, OverlaySource } from './overlays'
import { titleCase } from './landowner'

/** PAD-US 4.1 (USGS GAP), public, CORS *. Fee and easement land only; closed (XA) land is left out at the server. */
export const PUBLIC_SOURCES: OverlaySource[] = [
  {
    id: 'padus',
    kind: 'public',
    label: 'PAD-US 4.1 (USGS)',
    state: '',
    url: 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Manager_Type_PADUS/FeatureServer/0',
    extent: [-180, 15, -60, 72],
    outFields: ['Unit_Nm', 'Mang_Name', 'Loc_Mang', 'Mang_Type', 'Des_Tp', 'Loc_Ds', 'Pub_Access', 'GIS_Acres', 'FeatClass'],
    where: "FeatClass IN ('Fee','Easement') AND Pub_Access <> 'XA'",
    maxRecordCount: 1000,
  },
]

interface AccessEntry {
  state: string
  program: string
  url: string
  where?: string
  nameField?: string
  idField: string
  extent: [number, number, number, number]
  maxRecordCount: number
  infoUrl?: string
  details?: Array<[string, string]>
}

const KS_SEASON: Record<string, string> = { SJ: 'Sep 1 – Jan 31', NJ: 'Nov 1 – Jan 31', SMY: 'Sep 1 – May 31', SMR: 'Sep 1 – Mar 31', NMY: 'Nov 1 – May 31' }

// Walk-in and voluntary public access programs: private land leased for public hunting. Verified 2026-10-09.
const ACCESS: AccessEntry[] = [
  { state: 'CO', program: 'Colorado Walk-In Access', url: 'https://services5.arcgis.com/ttNGmDvKQA7oeDQ3/arcgis/rest/services/CPWAdminData/FeatureServer/12', where: "BigGame='Y'", idField: 'FID', extent: [-109.198, 36.994, -101.887, 41.037], maxRecordCount: 2000, infoUrl: 'https://cpw.state.co.us/hunting/walk-access-program', details: [['Cover', 'COVERLABEL'], ['Closes', 'CLOSEDATE']] },
  { state: 'IA', program: 'Iowa Habitat and Access Program (IHAP)', url: 'https://services2.arcgis.com/r6iFVcMJeA4kB4GC/arcgis/rest/services/Atlas_Web_Application/FeatureServer/2', where: "AREA_NAME LIKE 'IHAP%'", nameField: 'AREA_NAME', idField: 'Hunt_ID', extent: [-96.434, 40.577, -90.463, 43.47], maxRecordCount: 2000, infoUrl: 'https://www.iowadnr.gov/ihap', details: [['Species', 'Species'], ['Map', 'Map_Link']] },
  { state: 'ID', program: 'Idaho Access Yes!', url: 'https://gisportal-idfg.idaho.gov/hosting/rest/services/Access/Access/MapServer/1', where: "ACTIVE='Y'", nameField: 'NAME', idField: 'ID', extent: [-117.034, 41.994, -111.235, 47.282], maxRecordCount: 2000, infoUrl: 'https://idfg.idaho.gov/access/yes', details: [['Opens', 'AccessBegin'], ['Closes', 'AccessEnd'], ['Big game', 'BigGame']] },
  { state: 'KS', program: 'Kansas Walk-In Hunting Access (WIHA)', url: 'https://services1.arcgis.com/q2CglofYX6ACNEeu/arcgis/rest/services/24_25_7_29/FeatureServer/0', idField: 'AREAID', extent: [-102.05, 36.996, -94.631, 40.003], maxRecordCount: 2000, infoUrl: 'https://ksoutdoors.gov/Hunting/Where-to-Hunt-in-Kansas', details: [['Season', 'LEGENDID'], ['Archery', 'ISARCHER_1'], ['Acres', 'ACRES']] },
  { state: 'KY', program: 'Kentucky Hunter Access Area', url: 'https://services3.arcgis.com/ghsX9CKghMvyYjBU/arcgis/rest/services/Ky_KDFWR_PublicHuntingAreas_WM_gdb/FeatureServer/0', where: "Management_Level='Hunter Access Areas'", nameField: 'AREANAME', idField: 'KDFWR_ID', extent: [-83.62, 36.812, -82.255, 37.659], maxRecordCount: 2000, infoUrl: 'https://fw.ky.gov/Hunt/Pages/default.aspx', details: [['Details', 'DETAIL']] },
  { state: 'MI', program: 'Michigan Hunting Access Program (HAP)', url: 'https://services3.arcgis.com/Jdnp1TjADvSDxMAX/arcgis/rest/services/DNRWILDLandsOPENDATA/FeatureServer/0', where: "ActiveOrInactive='Active'", idField: 'HAPID', extent: [-86.482, 41.748, -82.329, 46.453], maxRecordCount: 2000, infoUrl: 'https://www.michigan.gov/hap', details: [['Allowed', 'HuntType'], ['Check-in', 'HAPInfo'], ['Note', 'SpecialComment']] },
  { state: 'MN', program: 'Minnesota Walk-In Access', url: 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/bdry_dnr_walk_in_access_sites/FeatureServer/0', nameField: 'map_title', idField: 'wia_id', extent: [-96.716, 43.508, -93.566, 46.587], maxRecordCount: 2000, infoUrl: 'https://www.dnr.state.mn.us/walkin/index.html', details: [['Uses', 'uses'], ['Notes', 'usernotes']] },
  { state: 'MO', program: 'Missouri Recreational Access Program (MRAP)', url: 'https://gisblue.mdc.mo.gov/arcgis/rest/services/Boundaries/MDC_Administrative_Boundaries/MapServer/2', nameField: 'Area_Name', idField: 'Area_Name', extent: [-94.767, 37.575, -90.206, 40.533], maxRecordCount: 1000, infoUrl: 'https://mdc.mo.gov/mrap', details: [['Access', 'Access_Typ'], ['Map', 'Map_Link']] },
  { state: 'MT', program: 'Montana Block Management', url: 'https://services3.arcgis.com/Cdxz8r11hT0MGzg1/arcgis/rest/services/FWPLND_BMA_BOUNDARY/FeatureServer/0', where: "STATUS='Active'", nameField: 'BMANAME', idField: 'BMANUM', extent: [-116.039, 44.465, -104.044, 49.0], maxRecordCount: 2000, infoUrl: 'https://fwp.mt.gov/hunt/access/blockmanagement', details: [['Access', 'ACCESSINFO'], ['Map', 'PDFMAP']] },
  { state: 'ND', program: 'North Dakota PLOTS', url: 'https://ndgishub.nd.gov/arcgis/rest/services/Applications/GNF_PLOTSGuide/MapServer/18', where: "Status='Active'", idField: 'agreement', extent: [-104.046, 45.936, -96.825, 49.0], maxRecordCount: 2000, infoUrl: 'https://gf.nd.gov/plots', details: [['Type', 'Unit_Type'], ['Location', 'Approximate_Location']] },
  { state: 'NE', program: 'Nebraska Open Fields and Waters', url: 'https://services5.arcgis.com/IOshH1zLrIieqrNk/arcgis/rest/services/OFW_2026_2027_QA_Web_Map_View/FeatureServer/0', where: "ProgramBou NOT IN ('OFW Special Regulations','OFW Fishing Only','OFW Ice Fishing Only')", idField: 'ContractNu', extent: [-104.167, 39.863, -94.164, 43.046], maxRecordCount: 2000, infoUrl: 'https://outdoornebraska.gov/publicaccessatlas/', details: [['Access', 'ProgramBou']] },
  { state: 'NM', program: 'New Mexico Open Gate', url: 'https://services2.arcgis.com/CjbW1bVhK4dB3WOa/arcgis/rest/services/NM_Open_Gate_Public_View/FeatureServer/0', where: "OG_status='Active'", nameField: 'NAME', idField: 'PropertyID', extent: [-108.951, 32.008, -103.763, 36.876], maxRecordCount: 1000, infoUrl: 'https://wildlife.dgf.nm.gov/hunting/open-gate/', details: [['Activities', 'Activities'], ['Term', 'Term'], ['More', 'MORE_INFO']] },
  { state: 'OH', program: 'Ohio DNR Agreement Hunting Area', url: 'https://gis.ohiodnr.gov/arcgis/rest/services/DOW_Services/HuntingRegulations_AGOL_3/MapServer/18', where: "HUNTING_STATUS IN ('OPEN','RESTRICTED') AND (PROP_TYPE='HUNT AREA' OR OWN_TYPE='Agreement')", nameField: 'Name_Label', idField: 'Name_Label', extent: [-84.819, 38.565, -80.519, 41.95], maxRecordCount: 1000, infoUrl: 'https://ohiodnr.gov/discover-and-learn/safety-conservation/about-ODNR/wildlife/public-hunting-areas', details: [['Hunting', 'HUNTING_STATUS']] },
  { state: 'OK', program: 'Oklahoma Land Access Program (OLAP)', url: 'https://services1.arcgis.com/jRf8jjFwxedITdFe/arcgis/rest/services/OLAP_UpdatedLayers_062626_PublicView/FeatureServer/7', where: "WIACAT='Walk-In Hunting Archery & Shotgun' AND OpenToPublic='Yes'", idField: 'OLAPID', extent: [-102.84, 33.777, -95.022, 37.091], maxRecordCount: 2000, infoUrl: 'https://www.wildlifedepartment.com/olap', details: [['Season', 'WIASeason'], ['Species', 'Species'], ['Hunters allowed', 'NumHuntersAllowed']] },
  { state: 'OR', program: 'Oregon Access & Habitat', url: 'https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/ORHAM_accesshab_test/FeatureServer/6', where: "NAME NOT LIKE '%NO%'", nameField: 'Full_name', idField: 'LandID', extent: [-124.698, 42.362, -116.879, 45.85], maxRecordCount: 2000, infoUrl: 'https://www.oregonhuntingmap.com', details: [['Rules', 'rules'], ['Map', 'URL']] },
  { state: 'PA', program: 'Pennsylvania Hunter Access', url: 'https://pgcgis.pa.gov/arcgis/rest/services/LRO/Hunter_Access_Properties_Big_and_Small_Game/MapServer/900', idField: 'AgreementId', extent: [-80.519, 39.721, -75.111, 42.164], maxRecordCount: 500, infoUrl: 'https://www.pgc.pa.gov/HuntTrap/PublicLands/HunterAccess/Pages/default.aspx', details: [['Tier', 'TierType'], ['Sunday hunting', 'SundayHunt'], ['Restrictions', 'Restrictions']] },
  { state: 'SD', program: 'South Dakota Walk-In Area', url: 'https://utility.arcgis.com/usrsvcs/servers/0164629919ba45a9be2b6a876196da4a/rest/services/Public_Lands/GFP_ManagedLand_Public/MapServer/3', where: "Type IN ('WIA','CREP')", idField: 'ID', extent: [-104.055, 42.569, -96.452, 45.945], maxRecordCount: 2000, infoUrl: 'https://gfp.sd.gov/walk-in-areas/', details: [['Type', 'Type'], ['Restrictions', 'ResType'], ['Acres', 'Acres']] },
  { state: 'TX', program: 'Texas Public Hunting Lease (APH permit)', url: 'https://tpwd.texas.gov/arcgis/rest/services/Wildlife/TPWD_PublicHuntLocatorMap/MapServer/5', where: "Active='Yes'", nameField: 'LEASE_NAME', idField: 'LEASE_NUM', extent: [-103.984, 27.193, -94.054, 36.301], maxRecordCount: 2000, infoUrl: 'https://tpwd.texas.gov/huntwild/hunt/public/', details: [['Map booklet page', 'MAPBOOK_PG']] },
  { state: 'VA', program: 'Virginia Public Access Lands for Sportsmen (PALS)', url: 'https://services.dwr.virginia.gov/arcgis/rest/services/HUB_Layers/DWR_PALS/FeatureServer/0', nameField: 'Label', idField: 'Label', extent: [-82.468, 36.978, -76.824, 37.325], maxRecordCount: 2000 },
  { state: 'WI', program: 'Wisconsin Voluntary Public Access (VPA)', url: 'https://dnrmaps.wi.gov/arcgis/rest/services/WM_VPA/WM_VPA_HUNT_LEASE_LAND_WTM/MapServer/0', where: "PROGRAM='VPA'", idField: 'REC_NO', extent: [-92.613, 42.525, -87.629, 45.47], maxRecordCount: 1000, infoUrl: 'https://dnr.wisconsin.gov/topic/lands/VPA', details: [['Map', 'PDF_MAP']] },
  { state: 'WY', program: 'Wyoming Walk-In Hunting Area', url: 'https://services6.arcgis.com/cWzdqIyxbijuhPLw/arcgis/rest/services/WIH_Boundaries/FeatureServer/0', where: "PublicView='Public' AND Type <> 'CLOSED'", nameField: 'WIH_Name', idField: 'WIA_NO', extent: [-111.237, 40.977, -103.867, 45.018], maxRecordCount: 2000, infoUrl: 'https://wgfd.wyo.gov/public-access', details: [['Type', 'Type']] },
]

export const ACCESS_SOURCES: OverlaySource[] = ACCESS.map((e) => ({
  id: `access-${e.state.toLowerCase()}`,
  kind: 'access',
  label: e.program,
  state: e.state,
  url: e.url,
  extent: e.extent,
  outFields: Array.from(new Set([e.idField, ...(e.nameField ? [e.nameField] : []), ...(e.details ?? []).map((d) => d[1])])),
  where: e.where,
  maxRecordCount: e.maxRecordCount,
  infoUrl: e.infoUrl,
  nameField: e.nameField,
  idField: e.idField,
  details: e.details,
}))

/** Readable value for a detail field: decode season codes, epoch dates, Y/N. */
export function formatDetail(sourceId: string, field: string, raw: unknown): string {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s || s === 'Null' || s === 'null' || s === ' ') return ''
  if (sourceId === 'access-ks' && field === 'LEGENDID') {
    const base = Object.keys(KS_SEASON).find((k) => s.toUpperCase().startsWith(k))
    const dates = base ? KS_SEASON[base] : s
    return /ASO$/i.test(s) ? `${dates} · archery and shotgun only` : dates
  }
  if (typeof raw === 'number' && raw > 1e11) return new Date(raw).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  if (s === 'Y') return 'Yes'
  if (s === 'N') return 'No'
  return s
}

const MANAGER_NAMES: Record<string, string> = {
  BLM: 'Bureau of Land Management', USFS: 'U.S. Forest Service', FWS: 'U.S. Fish and Wildlife Service', NPS: 'National Park Service', USACE: 'Army Corps of Engineers', USBR: 'Bureau of Reclamation', TVA: 'Tennessee Valley Authority', DOD: 'Department of Defense', NRCS: 'Natural Resources Conservation Service', BIA: 'Bureau of Indian Affairs', OTHF: 'Federal agency',
  SFW: 'State fish and wildlife agency', SDNR: 'State Department of Natural Resources', SDC: 'State Department of Conservation', SPR: 'State parks', SLB: 'State land board', SDOL: 'State land department', OTHS: 'State agency',
  REG: 'Regional agency', RWD: 'Regional water district', CITY: 'City', CNTY: 'County', UNKL: 'Local government', NGO: 'Conservation organization', PVT: 'Private', JNT: 'Joint management', TRIB: 'Tribal land',
}

const DESIGNATIONS: Record<string, string> = {
  NF: 'National Forest', NG: 'National Grassland', NWR: 'National Wildlife Refuge', PUB: 'National Public Lands', WA: 'Wilderness Area', WSA: 'Wilderness Study Area', NRA: 'National Recreation Area', NP: 'National Park', NM: 'National Monument', NCA: 'Conservation Area', NLS: 'National Lakeshore or Seashore',
  REC: 'Recreation Management Area', RMA: 'Resource Management Area', MIL: 'Military Land', ACC: 'Access Area', SP: 'State Park', SW: 'State Wilderness', SCA: 'State Conservation Area', SREC: 'State Recreation Area', SRMA: 'State Resource Management Area', SOTH: 'State Land',
  LP: 'Local Park', LCA: 'Local Conservation Area', LREC: 'Local Recreation Area', LRMA: 'Local Resource Management Area', LOTH: 'Local Land', PCON: 'Private Conservation Land', PREC: 'Private Recreation Land', PFOR: 'Private Forest',
  CONE: 'Conservation Easement', RECE: 'Recreation Easement', FORE: 'Forest Easement', AGRE: 'Agricultural Easement', RANE: 'Ranch Easement', OTHE: 'Easement', UNKE: 'Easement',
}

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

const pick = (p: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = p[k]
    if (v != null && String(v).trim() && String(v).trim() !== 'Null') return String(v).trim()
  }
  return ''
}

function accessOf(p: Record<string, unknown>): Access {
  const code = pick(p, 'Pub_Access', 'pub_access', 'PUB_ACCESS').toUpperCase()
  const text = pick(p, 'd_Pub_Acce', 'd_Pub_Access').toLowerCase()
  if (code === 'OA' || text.startsWith('open')) return 'open'
  if (code === 'RA' || text.startsWith('restricted')) return 'restricted'
  if (code === 'XA' || text.startsWith('closed')) return 'closed'
  return 'unknown'
}

export function describePublic(f: OverlayFeature): PublicInfo {
  const p = f.props
  const acres = Number(pick(p, 'GIS_Acres', 'gis_acres', 'GIS_ACRES'))
  const category = pick(p, 'Category', 'category', 'd_Category')
  const mangCode = pick(p, 'Mang_Name').toUpperCase()
  const desCode = pick(p, 'Des_Tp').toUpperCase()
  const localDes = pick(p, 'Loc_Ds')
  return {
    name: titleCase(pick(p, 'Unit_Nm', 'unit_nm', 'UNIT_NM', 'Loc_Nm') || 'Public land'),
    manager: pick(p, 'Loc_Mang') || MANAGER_NAMES[mangCode] || pick(p, 'd_Mang_Nam', 'Mang_Name'),
    managerType: pick(p, 'Mang_Type', 'mang_type', 'd_Mang_Typ'),
    // "Wildlife Area" from the state beats the national category when the state gives one
    designation: localDes && localDes.length < 40 && !/^\d+$/.test(localDes) ? titleCase(localDes) : DESIGNATIONS[desCode] || pick(p, 'd_Des_Tp', 'Des_Tp'),
    access: accessOf(p),
    acres: Number.isFinite(acres) && acres > 0 ? acres : null,
    easement: /easement/i.test(category) || pick(p, 'FeatClass') === 'Easement',
  }
}

// Manager type -> colour. Federal sage, state brass, local slate, conservation groups dusk.
const TONES: Record<string, string> = { FED: '#8fb07e', STAT: '#cdb27a', LOC: '#8fa7bd', DIST: '#8fa7bd', JNT: '#8fa7bd', NGO: '#b39cc4', PVT: '#b39cc4', TRIB: '#c9a07c', UNK: '#a9ad9f' }

function managerCode(p: Record<string, unknown>): string {
  const code = pick(p, 'Mang_Type', 'mang_type', 'MANG_TYPE').toUpperCase()
  if (TONES[code]) return code
  const text = pick(p, 'd_Mang_Typ', 'd_Mang_Type').toLowerCase()
  if (text.startsWith('federal')) return 'FED'
  if (text.startsWith('state')) return 'STAT'
  if (/local|county|city|regional|district/.test(text)) return 'LOC'
  if (/non-?governmental|ngo/.test(text)) return 'NGO'
  if (text.startsWith('private')) return 'PVT'
  if (/tribal|american indian/.test(text)) return 'TRIB'
  return 'UNK'
}

/** Closed land is protected but not open to anyone: not drawn. Restricted and unknown are drawn quieter. */
export function publicStyle(f: OverlayFeature): L.PathOptions | null {
  const info = describePublic(f)
  if (info.access === 'closed') return null
  const tone = TONES[managerCode(f.props)]
  const open = info.access === 'open'
  // Satellite imagery eats pale fills: open land reads clearly, restricted a step quieter with a dashed edge
  return {
    color: tone,
    weight: open ? 1.8 : 1.5,
    opacity: open ? 1 : 0.9,
    dashArray: info.easement ? '2 4' : info.access === 'restricted' ? '7 4' : undefined,
    fillColor: tone,
    fillOpacity: open ? (info.easement ? 0.16 : 0.3) : info.access === 'restricted' ? 0.2 : 0.12,
  }
}

export function accessStyle(): L.PathOptions {
  return { color: '#f5a86b', weight: 1.6, opacity: 0.95, dashArray: '5 4', fillColor: '#e8702c', fillOpacity: 0.12 }
}

export interface AccessInfo {
  program: string
  name: string
  infoUrl: string | null
  details: Array<{ label: string; value: string; link: boolean }>
}

export function describeAccess(f: OverlayFeature): AccessInfo {
  const src = ACCESS_SOURCES.find((s) => s.id === f.sourceId)
  const named = src?.nameField ? String(f.props[src.nameField] ?? '').trim() : ''
  const id = src?.idField ? String(f.props[src.idField] ?? '').trim() : ''
  const details = (src?.details ?? [])
    .map(([label, field]) => ({ label, value: formatDetail(f.sourceId, field, f.props[field]), link: false }))
    .filter((d) => d.value)
    .map((d) => ({ ...d, link: /^https?:\/\//i.test(d.value) }))
  return {
    program: src?.label ?? 'Walk-in access',
    name: named ? (named === named.toUpperCase() ? titleCase(named) : named) : id ? `Area ${id}` : '',
    infoUrl: src?.infoUrl ?? null,
    details,
  }
}

export const PUBLIC_LEGEND: Array<{ label: string; short: string; tone: string }> = [
  { label: 'Federal', short: 'Fed', tone: TONES.FED },
  { label: 'State', short: 'State', tone: TONES.STAT },
  { label: 'County and local', short: 'Local', tone: TONES.LOC },
  { label: 'Conservation groups', short: 'NGO', tone: TONES.NGO },
]
