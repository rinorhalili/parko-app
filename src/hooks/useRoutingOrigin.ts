import { useEffect, useRef, useState } from 'react'
import { distanceMeters } from '../parkingRanking'
import type { MapCoordinate } from '../types'

// GPS remains immediate on the map. Network requests and rankings use a slower origin.
export function useRoutingOrigin(location: MapCoordinate, navigating: boolean) {
  const [origin, setOrigin] = useState(location)
  const latest = useRef(location)
  latest.current = location
  useEffect(() => {
    const timer = window.setInterval(() => {
      setOrigin((previous) => distanceMeters(previous, latest.current) >= (navigating ? 30 : 75) ? latest.current : previous)
    }, 8_000)
    return () => window.clearInterval(timer)
  }, [navigating])
  return origin
}
