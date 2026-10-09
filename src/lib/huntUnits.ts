/**
 * Deer hunting units by state, from each wildlife agency's own public
 * ArcGIS layer. Every entry was opened, point-queried and checked for
 * browser access before it went in. States that set deer seasons by county
 * have no entry; the county name on the parcel covers them.
 */
import type { OverlayFeature, OverlaySource } from './overlays'
import { titleCase } from './landowner'

interface UnitEntry {
  state: string
  term: string
  label: string
  url: string
  nameField: string
  idField: string
  extent: [number, number, number, number]
  maxRecordCount: number
  where?: string
  infoUrl?: string
  /** Extra attributes worth showing on tap: [label, field] */
  details?: Array<[string, string]>
  /** The layer's names are out of date: UPPERCASE layer name -> current name */
  rename?: Record<string, string>
}

const ENTRIES: UnitEntry[] = [
  // ---- Central ----
  { state: 'AR', term: 'Deer Zone', label: 'AGFC Deer Zones', url: 'https://services.arcgis.com/5bMc8SlGDYGINZr5/arcgis/rest/services/deerZones/FeatureServer/0', nameField: 'flabel', idField: 'fname', extent: [-94.6179, 33.0043, -89.6422, 36.4997], maxRecordCount: 2000, infoUrl: 'https://www.agfc.com/en/hunting/big-game/deer/deerzones/' },
  { state: 'IA', term: 'Nonresident Deer Zone', label: 'Iowa DNR Nonresident Deer Zones', url: 'https://services2.arcgis.com/r6iFVcMJeA4kB4GC/arcgis/rest/services/Atlas_Web_Application/FeatureServer/3', nameField: 'NR_Deer', idField: 'OBJECTID', extent: [-96.6849, 40.3328, -90.0694, 43.5195], maxRecordCount: 2000, where: 'NR_Deer IS NOT NULL' },
  { state: 'IN', term: 'County', label: 'IDNR County Antlerless Bag Limits', url: 'https://services.arcgis.com/2Mcx1M1MORKfBNPM/arcgis/rest/services/Indiana_Counties_ExportFeatures_upd/FeatureServer/0', nameField: 'NAME', idField: 'GEOID', extent: [-88.1612, 37.7554, -84.6882, 41.7753], maxRecordCount: 2000, details: [['Antlerless bag 2026–27', 'start_26_27bag']] },
  { state: 'KS', term: 'Deer Management Unit', label: 'KDWP Deer Management Units', url: 'https://services1.arcgis.com/q2CglofYX6ACNEeu/arcgis/rest/services/Kansas_Deer_Management_Units/FeatureServer/0', nameField: 'DMU', idField: 'DMU', extent: [-102.0518, 36.993, -94.5884, 40.0032], maxRecordCount: 2000 },
  { state: 'KY', term: 'Deer Zone', label: 'KDFWR Deer Zones', url: 'https://services5.arcgis.com/RMHPuOW5MJ6iyTV6/arcgis/rest/services/Deer_Zones/FeatureServer/1', nameField: 'CurrentZone', idField: 'FIPS', extent: [-89.7044, 36.457, -81.8842, 39.0895], maxRecordCount: 2000, details: [['County', 'NAME']] },
  { state: 'LA', term: 'Deer Hunting Area', label: 'LDWF Deer Hunting Areas', url: 'https://services1.arcgis.com/6euNCaGPCgCzgAVF/arcgis/rest/services/HuntingAreas/FeatureServer/3', nameField: 'Area_ID', idField: 'Area_ID', extent: [-94.0432, 28.8542, -88.7583, 33.0196], maxRecordCount: 2000 },
  { state: 'MI', term: 'Deer Management Unit', label: 'Michigan DNR Deer Management Units', url: 'https://services3.arcgis.com/Jdnp1TjADvSDxMAX/arcgis/rest/services/WILDGameSpeciesManagementUnitsAndZonesOPENDATA/FeatureServer/3', nameField: 'MangementUnitName', idField: 'DeerManagementUnit', extent: [-90.5569, 41.6321, -82.0704, 48.2165], maxRecordCount: 2000 },
  {
    state: 'MN',
    term: 'Deer Permit Area',
    label: 'Minnesota DNR Deer Permit Areas',
    url: 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/bdry_deer_permit_areas/FeatureServer/0',
    nameField: 'dpa',
    idField: 'dpa',
    extent: [-97.2392, 43.4994, -89.4918, 49.3845],
    maxRecordCount: 2000,
    details: [['Designation', 'designatio'], ['Archery', 'archery'], ['Firearm A', 'firearma'], ['Firearm B', 'firearmb'], ['Muzzleloader', 'muzzleload'], ['Youth', 'youth'], ['Early antlerless', 'earlyantle'], ['Late season', 'lateseason'], ['Special rules', 'specialreg']],
  },
  {
    state: 'MS',
    term: 'Deer Management Unit',
    label: 'MDWFP Deer Management Units',
    url: 'https://arcgis.mdwfp.com/arcgis/rest/services/Public/Public_WMA_Data/MapServer/7',
    nameField: 'Name',
    idField: 'Name',
    extent: [-91.6549, 30.1739, -88.0979, 34.9956],
    maxRecordCount: 1000,
    rename: { 'NORTH EAST ZONE': 'Hills', 'SOUTH ZONE': 'Southeast', 'DELTA ZONE': 'Delta', 'NORTH CENTRAL ZONE': 'North Central' },
  },
  { state: 'ND', term: 'Deer Gun Hunting Unit', label: 'NDGF Deer Gun Units', url: 'https://ndgishub.nd.gov/arcgis/rest/services/Applications/GNF_GeneralInformation/MapServer/33', nameField: 'UNIT_ID', idField: 'UNIT_ID', extent: [-104.0489, 45.935, -96.5545, 49.0006], maxRecordCount: 1000 },
  { state: 'NE', term: 'Deer Management Unit', label: 'NGPC Deer Management Units', url: 'https://services5.arcgis.com/IOshH1zLrIieqrNk/arcgis/rest/services/Deer_Mangement_Units_2022/FeatureServer/0', nameField: 'UnitName', idField: 'UnitName', extent: [-104.0535, 39.9999, -95.3083, 43.0017], maxRecordCount: 2000 },
  { state: 'SD', term: 'Deer Hunting Unit', label: 'SDGFP Deer Hunting Units', url: 'https://utility.arcgis.com/usrsvcs/servers/4809843472ba4b799984754b41cd2b6b/rest/services/Hunting/Hunting_Unit_Survey/MapServer/0', nameField: 'unit', idField: 'ObjectID', extent: [-104.3133, 42.3979, -96.2854, 46.0567], maxRecordCount: 2000, where: "Species='White-tailed Deer'" },
  { state: 'TN', term: 'Deer Management Unit', label: 'TWRA Deer Management Units', url: 'https://services3.arcgis.com/PWXNAH2YKmZY7lBq/arcgis/rest/services/DeerMgmtUnitCountie_Dissolve/FeatureServer/0', nameField: 'DMU', idField: 'DMU', extent: [-90.3987, 34.9064, -81.6464, 36.6179], maxRecordCount: 2000 },
  { state: 'WI', term: 'Deer Management Unit', label: 'Wisconsin DNR Deer Management Units', url: 'https://dnrmaps.wi.gov/arcgis/rest/services/WM_CWD/WM_DMU_MSU_DMZ_Ext/MapServer/2', nameField: 'DEER_MGMT_UNIT_NAME', idField: 'DEER_MGMT_UNIT_ID', extent: [-92.9642, 42.458, -86.7088, 47.0831], maxRecordCount: 1000, details: [['Zone', 'DEER_MANAGEMENT_ZONE'], ['Metro sub-unit', 'METRO_SUBUNIT_NAME']] },

  // ---- East ----
  { state: 'CT', term: 'Deer Management Zone', label: 'CT DEEP Deer and Turkey Management Zones', url: 'https://services1.arcgis.com/FjPcSmEFuDYlIdKC/arcgis/rest/services/Deer_Turkey_Management_Zones/FeatureServer/0', nameField: 'zone', idField: 'FID', extent: [-73.7422, 40.9888, -71.7814, 42.0486], maxRecordCount: 2000 },
  { state: 'DE', term: 'Deer Management Zone', label: 'DNREC Deer Management Zones', url: 'https://enterprise.firstmap.delaware.gov/arcgis/rest/services/Society/DE_Wildlife/FeatureServer/6', nameField: 'ZONE', idField: 'OBJECTID', extent: [-75.789, 38.4512, -75.0487, 39.8395], maxRecordCount: 2000 },
  { state: 'FL', term: 'Deer Management Unit', label: 'FWC White-tailed Deer Management Units', url: 'https://gis.myfwc.com/hosting/rest/services/Open_Data/White_tailed_Deer_Management_Unit_Areas/MapServer/4', nameField: 'DMU', idField: 'OBJECTID', extent: [-87.6393, 24.8814, -79.8724, 31.0436], maxRecordCount: 2000 },
  { state: 'MA', term: 'Wildlife Management Zone', label: 'MassWildlife Wildlife Management Zones', url: 'https://services1.arcgis.com/7iJyYTjCtKsZS1LR/arcgis/rest/services/WildlifeManagementZones/FeatureServer/0', nameField: 'DMZ', idField: 'OBJECTID_1', extent: [-73.5334, 41.2303, -69.8985, 42.8773], maxRecordCount: 1000 },
  { state: 'ME', term: 'Wildlife Management District', label: 'MDIFW Wildlife Management Districts', url: 'https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/WMD/FeatureServer/0', nameField: 'IDENTIFIER', idField: 'OBJECTID_1', extent: [-71.1668, 42.9435, -66.7817, 47.4396], maxRecordCount: 2000, where: 'IDENTIFIER > 0' },
  { state: 'NH', term: 'Wildlife Management Unit', label: 'NH Fish and Game Deer WMUs', url: 'https://services8.arcgis.com/hg1B9Egwk1I5p300/arcgis/rest/services/WMU/FeatureServer/1', nameField: 'WMU', idField: 'OBJECTID', extent: [-72.5571, 42.6971, -70.7022, 45.3057], maxRecordCount: 1000 },
  { state: 'NJ', term: 'Deer Management Zone', label: 'NJ DFW Deer Management Zones', url: 'https://services1.arcgis.com/QWdNfRs7lkPq4g4Q/arcgis/rest/services/Deer_Management_Zones_in_New_Jersey/FeatureServer/159', nameField: 'DMZ', idField: 'OBJECTID', extent: [-75.5871, 38.9246, -73.8992, 41.3563], maxRecordCount: 2000 },
  { state: 'NY', term: 'Wildlife Management Unit', label: 'NYSDEC Wildlife Management Units', url: 'https://services6.arcgis.com/DZHaqZm9cxOD4CWM/arcgis/rest/services/Wildlife_Management_Units/FeatureServer/0', nameField: 'UNIT', idField: 'OBJECTID', extent: [-79.9967, 40.4049, -71.65, 44.9735], maxRecordCount: 2000, infoUrl: 'https://www.dec.ny.gov/outdoor/8302.html' },
  {
    state: 'OH',
    term: 'County',
    label: 'ODNR Deer Regulations by County',
    url: 'https://gis.ohiodnr.gov/arcgis/rest/services/DOW_Services/HuntingRegulations_AGOL_3/MapServer/7',
    nameField: 'COUNTY',
    idField: 'OBJECTID',
    extent: [-84.9185, 38.3802, -80.4797, 41.9938],
    maxRecordCount: 1000,
    infoUrl: 'https://ohiodnr.gov/buy-and-apply/hunting-fishing-boating/hunting-resources/deer-hunting-resources',
    details: [
      ['Bag limit', 'County_Bag_Limit'],
      ['Archery', 'ArcherySeason'],
      ['Gun', 'GunSeason'],
      ['Muzzleloader', 'MuzzleloaderSeason'],
      ['Youth gun', 'YouthSeason'],
    ],
  },
  { state: 'PA', term: 'Wildlife Management Unit', label: 'PGC Wildlife Management Units', url: 'https://services1.arcgis.com/k8yxvICm95iIFicb/arcgis/rest/services/PGC_Boundaries/FeatureServer/301', nameField: 'wmu_id', idField: 'OBJECTID', extent: [-80.5193, 39.7199, -74.6896, 42.2693], maxRecordCount: 2000, where: "wmu_status='Active'", details: [['Antler restriction', 'wmu_antler_restriction'], ['CWD', 'cwd_detection_status']] },
  { state: 'SC', term: 'Game Zone', label: 'SCDNR Game Zones', url: 'https://services.arcgis.com/acgZYxoN5Oj8pDLa/arcgis/rest/services/South_Carolina_Game_Zones/FeatureServer/0', nameField: 'GameZone', idField: 'OBJECTID', extent: [-83.3679, 32.0231, -78.5018, 35.201], maxRecordCount: 2000 },
  { state: 'VT', term: 'Wildlife Management Unit', label: 'VT Fish and Wildlife WMUs', url: 'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_BOUNDARIES_SP_NOCACHE_v2/MapServer/164', nameField: 'BOUNDARY', idField: 'OBJECTID', extent: [-73.4379, 42.7269, -71.4653, 45.0167], maxRecordCount: 1000 },

  // ---- West ----
  { state: 'AK', term: 'Game Management Unit', label: 'ADF&G Game Management Subunits', url: 'https://gis.adfg.alaska.gov/ags/rest/services/wc_public/GMUSubunits/FeatureServer/4', nameField: 'SubLabel', idField: 'UnitSub', extent: [-179.2, 51.16, -129.9, 71.44], maxRecordCount: 1000 },
  { state: 'AZ', term: 'Game Management Unit', label: 'AZGFD Game Management Units', url: 'https://services2.arcgis.com/os1CphwIyxBDDUGn/arcgis/rest/services/HunterDonationInteractiveWebmap_1921/FeatureServer/0', nameField: 'GMUNAME', idField: 'GMUNAME', extent: [-114.816, 31.3321, -109.0452, 37.0039], maxRecordCount: 2000 },
  { state: 'CA', term: 'Deer Hunt Zone', label: 'CDFW Deer Hunt Zones', url: 'https://services2.arcgis.com/Uq9r85Potqm3MfRV/arcgis/rest/services/biosds342_fpu/FeatureServer/0', nameField: 'Zone_Nam', idField: 'Zone_Nam', extent: [-124.4096, 32.534, -114.1315, 42.0098], maxRecordCount: 2000 },
  { state: 'CO', term: 'Game Management Unit', label: 'CPW Big Game GMUs', url: 'https://services5.arcgis.com/ttNGmDvKQA7oeDQ3/arcgis/rest/services/CPWAdminData/FeatureServer/6', nameField: 'GMUID', idField: 'GMUID', extent: [-109.0604, 36.9924, -102.0415, 41.0035], maxRecordCount: 2000 },
  { state: 'HI', term: 'Public Hunting Unit', label: 'DLNR Public Hunting Areas', url: 'https://geodata.hawaii.gov/arcgis/rest/services/Terrestrial/MapServer/33', nameField: 'unit_name', idField: 'mammal_uni', extent: [-159.7841, 18.9507, -154.7732, 22.2134], maxRecordCount: 1000, where: "status LIKE 'Hunting Area%Mammal%'" },
  { state: 'ID', term: 'Game Management Unit', label: 'IDFG Game Management Units', url: 'https://services.arcgis.com/FjJI5xHF2dUPVrgK/arcgis/rest/services/GameManagementUnits/FeatureServer/0', nameField: 'NAME', idField: 'NAME', extent: [-117.2433, 41.9882, -111.0433, 49.0], maxRecordCount: 1000 },
  { state: 'MT', term: 'Hunting District', label: 'MT FWP Deer and Elk Hunting Districts 2026–27', url: 'https://services3.arcgis.com/Cdxz8r11hT0MGzg1/arcgis/rest/services/ADMBND_HD_DEERELKLION/FeatureServer/0', nameField: 'NAME', idField: 'DISTRICT', extent: [-116.05, 44.3582, -104.0396, 49.0001], maxRecordCount: 1000 },
  { state: 'NV', term: 'Hunt Unit', label: 'NDOW Hunt Units', url: 'https://services.arcgis.com/RyxlXSfFi87rAosq/arcgis/rest/services/NDOWGameMgmtUnits/FeatureServer/0', nameField: 'HUNTUNIT', idField: 'HUNTUNIT', extent: [-120.1375, 34.9903, -113.7943, 41.9918], maxRecordCount: 1000 },
  { state: 'NM', term: 'Game Management Unit', label: 'NM Game Management Units', url: 'https://services2.arcgis.com/CjbW1bVhK4dB3WOa/arcgis/rest/services/NMDGF_Game_Management_Units_I_E__v2_WFL1/FeatureServer/0', nameField: 'GMU', idField: 'GMU', extent: [-109.0505, 31.3322, -103.0021, 37.0002], maxRecordCount: 2000 },
  { state: 'OR', term: 'Wildlife Management Unit', label: 'ODFW Wildlife Management Units', url: 'https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/For_Download_Wildlife_Management_Units_(WMUs)/FeatureServer/19', nameField: 'UNIT_NAME', idField: 'UNIT_NUM', extent: [-124.5666, 41.9921, -116.4635, 46.2923], maxRecordCount: 2000 },
  { state: 'UT', term: 'Hunt Unit', label: 'UDWR 2026 General Season Deer Units', url: 'https://services.arcgis.com/ZzrwjTRez6FJiOq4/arcgis/rest/services/2026MuleDeerGeneralSeason2/FeatureServer/0', nameField: 'boundary_name', idField: 'boundary_name', extent: [-114.0529, 36.9999, -109.0415, 42.0017], maxRecordCount: 2000 },
  { state: 'WA', term: 'Game Management Unit', label: 'WDFW Game Management Units 2026–27', url: 'https://geodataservices.wdfw.wa.gov/arcgis/rest/services/MapServices/SharedReferenceLayers/MapServer/0', nameField: 'GMU_Name', idField: 'GMU_Num', extent: [-124.7551, 45.487, -116.7085, 49.0493], maxRecordCount: 2000 },
  { state: 'WY', term: 'Deer Hunt Area', label: 'WGFD Deer Hunt Areas', url: 'https://services6.arcgis.com/cWzdqIyxbijuhPLw/arcgis/rest/services/DeerHuntAreas/FeatureServer/3', nameField: 'HUNTNAME', idField: 'HUNTAREA', extent: [-111.05, 40.9947, -104.0522, 45.0068], maxRecordCount: 2000 },
]

export const UNIT_SOURCES: OverlaySource[] = ENTRIES.map((e) => ({
  id: `units-${e.state.toLowerCase()}`,
  kind: 'units',
  label: e.label,
  state: e.state,
  url: e.url,
  extent: e.extent,
  outFields: Array.from(new Set([e.nameField, e.idField, ...(e.details ?? []).map((d) => d[1])])),
  where: e.where,
  maxRecordCount: e.maxRecordCount,
  term: e.term,
  nameField: e.nameField,
  idField: e.idField,
  infoUrl: e.infoUrl,
  details: e.details,
}))

const SHORT: Record<string, string> = {
  'Game Management Unit': 'GMU',
  'Wildlife Management Unit': 'WMU',
  'Wildlife Management Zone': 'WMZ',
  'Game Zone': 'Zone',
  'Nonresident Deer Zone': 'NR Zone',
  'Deer Hunting Area': 'Area',
  'Deer Gun Hunting Unit': 'Unit',
  'Deer Hunting Unit': 'Unit',
  'Deer Management Unit': 'DMU',
  'Wildlife Management District': 'WMD',
  'Deer Management Zone': 'Zone',
  'Deer Management Area': 'DMA',
  'Deer Permit Area': 'DPA',
  'Hunting District': 'HD',
  'Deer Hunt Area': 'Area',
  'Deer Hunt Zone': 'Zone',
  'Hunt Unit': 'Unit',
  'Deer Zone': 'Zone',
}

const byId = new Map(UNIT_SOURCES.map((s) => [s.id, s]))
const renames = new Map(ENTRIES.map((e) => [`units-${e.state.toLowerCase()}`, e.rename]))

/** "WMU 2D", "GMU 45", "Unit 15", "DMU-033 · Ingham County", "Portage County" */
export function unitLabel(f: OverlayFeature): string | null {
  const src = byId.get(f.sourceId)
  if (!src) return null
  let name = String(f.props[src.nameField!] ?? '').trim()
  const id = String(f.props[src.idField!] ?? '').trim()
  const rename = renames.get(src.id)?.[name.toUpperCase()]
  if (rename) name = rename
  if (!name && !id) return null
  // County-based states: the regulation unit is the county (or a township carved out of it)
  if (src.term === 'County') return /county/i.test(name) ? titleCase(name) : `${titleCase(name)} County`
  const short = SHORT[src.term ?? ''] ?? 'Unit'
  // Already says what it is: "UNIT 15", "Zone 10", "Deer Permit Area 604"
  if (name && new RegExp(`^(${short}|unit|zone|area|district|deer permit area|dmu|wmu|gmu)\\b`, 'i').test(name)) return titleCase(name).replace(/\b(Dmu|Wmu|Gmu|Dpa)\b/g, (m) => m.toUpperCase())
  const isCode = (s: string) => /^[\dA-Z][\dA-Z.-]{0,7}$/.test(s)
  const code = isCode(name) ? name : isCode(id) ? id : ''
  const words = name && name !== code ? titleCase(name) : ''
  const tag = code ? (code.toUpperCase().startsWith(short.toUpperCase()) ? code : `${short} ${code}`) : ''
  if (tag && words) return `${tag} · ${words}`
  if (tag) return tag
  return words ? `${short} ${words}` : null
}

/** Map labels stay short: drop the trailing " - Southern Farmland Zone" style qualifiers. */
export function unitMapLabel(f: OverlayFeature): string | null {
  const full = unitLabel(f)
  if (!full) return null
  const cut = full.split(' - ')[0]
  return cut.length > 30 ? `${cut.slice(0, 28)}…` : cut
}

export function unitSource(sourceId: string): OverlaySource | undefined {
  return byId.get(sourceId)
}

if (import.meta.env.DEV) (window as unknown as { __units: unknown }).__units = { UNIT_SOURCES, unitLabel, unitMapLabel }
