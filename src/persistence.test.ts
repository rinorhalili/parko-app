import { beforeEach, describe, expect, it } from 'vitest'
import { clearParkedSession, loadParkedSession, loadPreferences, saveParkedSession, savePreferences } from './persistence'

describe('local persistence', () => {
  beforeEach(() => localStorage.clear())

  it('restores saved parking preferences', () => {
    savePreferences({ savedParkingIds: ['osm-way-1'], selectedParkingId: 'osm-way-1' })
    expect(loadPreferences().savedParkingIds).toEqual(['osm-way-1'])
  })

  it('persists and clears a parking timer', () => {
    const session = { parkingId: 'osm-way-1', parkedAt: { lat: 42.66, lng: 21.16 }, startedAt: 1, endsAt: 2, note: 'A2', reminderEnabled: true }
    saveParkedSession(session)
    expect(loadParkedSession()).toEqual(session)
    clearParkedSession()
    expect(loadParkedSession()).toBeNull()
  })
})
