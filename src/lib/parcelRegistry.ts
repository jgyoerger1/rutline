/**
 * Curated parcel sources. Every entry was opened and point-queried before it
 * went in: geometry, fields, CORS and whether owner names actually come back.
 * Statewide layers first, then counties that publish names where their state
 * layer does not. Anything not listed here is found at runtime by
 * parcelDiscovery.ts.
 */
import type { ParcelSource } from './parcels'

export const STATEWIDE_SOURCES: ParcelSource[] = [
  {
    id: 'oh-statewide',
    label: 'Ohio Statewide Parcels (OGRIP)',
    shortLabel: 'Ohio statewide',
    url: 'https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0',
    fields: { parcelId: 'LocalParcelID', mailAddress: 'MailAddressAll', situs: 'SitusAddressAll', acres: 'LandArea', landUse: 'StateLUC', county: 'County', link: 'CAMADataSite' },
    county: null,
    state: 'OH',
    extent: [-84.82, 38.4, -80.52, 41.98],
    kind: 'statewide',
    recordsUrl: 'https://ohioparcels-geohio.hub.arcgis.com/',
  },
]

export const COUNTY_REGISTRY: ParcelSource[] = [
  {
    id: 'oh-summit',
    label: 'Summit County Fiscal Office',
    shortLabel: 'Summit County',
    url: 'https://services3.arcgis.com/3Ukh5HzAdI6WZ3KP/arcgis/rest/services/TaxParcels_public/FeatureServer/0',
    fields: { parcelId: 'PARCELID', owner: 'OWNERNME1', owner2: 'OWNERNME2', mailParts: ['PSTLADDRESS', 'PSTLCITY', 'PSTLSTATE', 'PSTLZIP5'], situs: 'SITEADDRESS', acres: 'STATEDAREA', landUse: 'USEDSCRP' },
    county: 'Summit',
    state: 'OH',
    extent: [-81.7, 40.98, -81.38, 41.36],
    kind: 'county',
    recordsUrl: 'https://fiscaloffice.summitoh.net/',
  },
  {
    id: 'oh-stark',
    label: 'Stark County Auditor',
    shortLabel: 'Stark County',
    url: 'https://scgisa.starkcountyohio.gov/arcgis/rest/services/Auditor/StarkCountyParcels/FeatureServer/0',
    fields: { parcelId: 'PIN', owner: 'OWNER', mailName: 'MAILING_NAME', mailAddress: 'MAILING_ADDRESS', situs: 'SITE_ADDRESS', acres: 'ACRES', landUse: 'LAND_USE_DESCRIPTION' },
    county: 'Stark',
    state: 'OH',
    extent: [-81.66, 40.63, -81.07, 41.0],
    kind: 'county',
    recordsUrl: 'https://www.starkcountyohio.gov/auditor',
  },
  {
    id: 'oh-geauga',
    label: 'Geauga County Auditor',
    shortLabel: 'Geauga County',
    url: 'https://gcgis.geauga.oh.gov/parcel/rest/services/AzureParcels/Parcels/FeatureServer/0',
    fields: { parcelId: 'PARCEL_ID', owner: 'Oname1', owner2: 'Oname2', mailName: 'MailName1', mailParts: ['MailStreet', 'MailCitySt', 'MailZip'], situs: 'LocDesc', acres: 'ACRES', landUse: 'PropClass' },
    county: 'Geauga',
    state: 'OH',
    extent: [-81.4, 41.34, -80.99, 41.73],
    kind: 'county',
    recordsUrl: 'https://auditor.geauga.oh.gov/',
  },
  {
    // Found 2026-10-09: the county's own service, owner names and split mailing address, CORS echoes origin
    id: 'oh-portage',
    label: 'Portage County Tax Parcels',
    shortLabel: 'Portage County',
    url: 'https://services.portageco.com/arcgis/rest/services/TaxParcel_GE/FeatureServer/0',
    fields: {
      parcelId: 'PARCELID',
      owner: 'DeededOwner',
      mailParts: ['OwnStreetNumber', 'OwnStreetDirection', 'OwnStreetName', 'OwnStreetSuffix', 'OwnCity', 'OwnState', 'OwnZipcode'],
      situsParts: ['mlocStrNo', 'mlocStrDir', 'mlocStrName', 'mlocStrSuffix', 'mlocCity'],
      acres: 'CALC_AC',
      landUse: 'mClassificationId',
      link: 'CAMA',
    },
    county: 'Portage',
    state: 'OH',
    extent: [-81.42, 40.99, -81.0, 41.36],
    kind: 'county',
    recordsUrl: 'https://www.co.portage.oh.us/auditor',
  },
]
