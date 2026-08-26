import { PRISHTINA_DESTINATIONS } from './destinations'
import type { Destination } from './types'

export type MapLandmark = Destination & {
  icon: string
  minZoom: number
}

const landmarkDisplay: Record<string, Pick<MapLandmark, 'icon' | 'minZoom'>> = {
  'nene-tereza': { icon: '★', minZoom: 13 },
  biblioteka: { icon: '▦', minZoom: 13 },
  katedralja: { icon: '⌂', minZoom: 13 },
  stadiumi: { icon: '◉', minZoom: 13 },
  qkuk: { icon: '+', minZoom: 12 },
  germia: { icon: '♣', minZoom: 12 },
  'stacioni-autobuseve': { icon: '▰', minZoom: 13 },
  teatri: { icon: '♪', minZoom: 14 },
  'zahir-pajaziti': { icon: '★', minZoom: 14 },
  'fakulteti-ekonomik': { icon: 'U', minZoom: 15 },
}

export const PRISHTINA_LANDMARKS: MapLandmark[] = PRISHTINA_DESTINATIONS
  .filter((destination) => landmarkDisplay[destination.id])
  .map((destination) => ({ ...destination, ...landmarkDisplay[destination.id] }))
