import type { MunicipalParkingCategory } from './types'

export const PRISHTINA_PARKING_RULES_URL = 'https://prishtinaparking.net/leje-tjera/'

type ParkingTags = Record<string, string>

export type MunicipalParkingData = {
  operator: string | null
  municipalManaged: boolean
  municipalCode: string | null
  municipalCategory: MunicipalParkingCategory | null
  municipalZone: 1 | 2 | 3 | null
  usageHours: string | null
  officialVisitorPrice: number | null
}

const categoryByCode: Record<string, MunicipalParkingCategory> = {
  A: 'residential',
  B: 'residential',
  U: 'residential',
  D: 'residential',
  K: 'commercial',
  P: 'combined',
}

function extractMunicipalCode(tags: ParkingTags) {
  const candidate = [tags.ref, tags['parking:ref'], tags['ref:parking'], tags.name, tags['name:sq']]
    .filter(Boolean)
    .join(' ')
  const match = candidate.toUpperCase().match(/(?:^|\s)([ABUDKP])\s*-?\s*(\d{1,3})(?=\s|$)/)
  return match ? `${match[1]}${match[2]}` : null
}

export function deriveMunicipalParkingData(tags: ParkingTags): MunicipalParkingData {
  const operator = tags.operator?.trim() || null
  const municipalManaged = /prishtina\s*parking/i.test(operator ?? '')
  if (!municipalManaged) {
    return {
      operator,
      municipalManaged: false,
      municipalCode: null,
      municipalCategory: null,
      municipalZone: null,
      usageHours: null,
      officialVisitorPrice: null,
    }
  }

  const municipalCode = extractMunicipalCode(tags)
  const codePrefix = municipalCode?.[0] ?? ''
  const municipalCategory = categoryByCode[codePrefix] ?? null

  // Only the A-code is explicitly documented as Zone 1. We intentionally do
  // not guess a numeric zone for B/U/D/K/P entries without an official code.
  const municipalZone = codePrefix === 'A' ? 1 as const : null
  const usageHours = municipalCategory === 'residential'
    ? '07:00–18:00 për vizitorë; kontrollo tabelën lokale'
    : municipalCategory === 'commercial'
      ? '07:00–23:00; kontrollo tabelën lokale'
      : municipalCategory === 'combined'
        ? 'Pagesë për çdo orë; kontrollo tabelën lokale'
        : null

  return {
    operator,
    municipalManaged,
    municipalCode,
    municipalCategory,
    municipalZone,
    usageHours,
    officialVisitorPrice: municipalZone === 1 ? 1 : null,
  }
}
