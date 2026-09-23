import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Onboarding from './Onboarding'
import { loadOnboarding, saveOnboarding } from './state'
import { useOnboarding } from './useOnboarding'
import { savePreferences } from '../persistence'

let root: Root
let host: HTMLDivElement
const requestLocation = vi.fn()
function Harness({ result = 'ready' }: { result?: 'ready' | 'denied' | 'unavailable' | 'locating' | 'outside' }) {
  const onboarding = useOnboarding()
  const [locationStatus, setLocationStatus] = useState<'idle' | typeof result>('idle')
  return onboarding.mode ? <Onboarding {...onboarding} mode={onboarding.mode} locationStatus={locationStatus}
    onRequestLocation={() => { requestLocation(); setLocationStatus(result) }} onFinish={onboarding.finish} onCancel={onboarding.cancelEdit} />
    : <><h1>Parking map</h1><button onClick={onboarding.restart}>Replay</button><button onClick={onboarding.editPreferences}>Edit preferences</button></>
}
async function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(el => el.textContent === label || el.getAttribute('aria-label') === label)
  expect(button, `Button ${label}`).toBeDefined()
  await act(async () => button!.click())
}
async function mount(result?: Parameters<typeof Harness>[0]['result']) {
  await act(async () => root.render(<Harness result={result} />))
}
async function remount() {
  await act(async () => root.unmount())
  root = createRoot(host)
  await mount()
}
beforeEach(() => {
  localStorage.clear()
  requestLocation.mockClear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

it('completes first run without location and bypasses onboarding on a returning visit', async () => {
  await mount()
  expect(host.textContent).toContain('Parkimi në Prishtinë, më i thjeshtë.')
  expect(requestLocation).not.toHaveBeenCalled()
  await click('Fillo')
  expect(host.textContent).toContain('Përdor vendndodhjen')
  expect(requestLocation).not.toHaveBeenCalled()
  await click('Jo tani')
  const choices = host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')
  await act(async () => { choices[0].click(); choices[3].click() })
  await click('Vazhdo')
  expect(loadOnboarding().completed).toBe(false)
  expect(host.textContent).toContain('Butonat kryesorë')
  await click('Vazhdo')
  expect(host.textContent).toContain('Je gati të parkosh.')
  await click('Gjej parking')
  expect(host.textContent).toContain('Parking map')
  expect(loadOnboarding().preferences).toEqual(['closest', 'covered'])
  await remount()
  expect(host.textContent).toContain('Parking map')
  expect(requestLocation).not.toHaveBeenCalled()
})

it.each(['ready', 'outside'] as const)('requests location only on explicit action and advances on %s', async result => {
  await mount(result)
  await click('Fillo')
  expect(requestLocation).not.toHaveBeenCalled()
  await click('Lejo lokacionin')
  expect(requestLocation).toHaveBeenCalledTimes(1)
  expect(host.textContent).toContain('Çfarë ka më shumë rëndësi për ty?')
  expect(document.activeElement?.textContent).toBe('Çfarë ka më shumë rëndësi për ty?')
})

it.each(['denied', 'unavailable', 'locating'] as const)('allows continuing when location is %s', async result => {
  await mount(result)
  await click('Fillo')
  await click('Lejo lokacionin')
  expect(host.querySelector('[role=status]')?.textContent).not.toBe('')
  if (result === 'locating') expect(host.querySelector<HTMLButtonElement>('.onboarding-primary')?.disabled).toBe(true)
  await click('Jo tani')
  await click('Vazhdo')
  await click('Vazhdo')
  await click('Gjej parking')
  expect(loadOnboarding().completed).toBe(true)
  expect(loadOnboarding().preferences).toEqual([])
})

it('keeps selection when going back and supports editing and explicit replay after completion', async () => {
  await mount()
  await click('Fillo')
  await click('Jo tani')
  await act(async () => host.querySelector<HTMLInputElement>('input')!.click())
  await click('Vazhdo')
  expect(host.textContent).toContain('Butonat kryesorë')
  await click('Kthehu')
  expect(host.querySelector<HTMLInputElement>('input')?.checked).toBe(true)
  await click('Vazhdo')
  await click('Vazhdo')
  await click('Gjej parking')
  await click('Edit preferences')
  await act(async () => host.querySelector<HTMLInputElement>('input')!.click())
  await click('Anulo ndryshimet e preferencave')
  expect(loadOnboarding().preferences).toEqual(['closest'])
  await click('Edit preferences')
  await act(async () => host.querySelector<HTMLInputElement>('input')!.click())
  await click('Ruaj preferencat')
  expect(loadOnboarding().preferences).toEqual([])
  await click('Replay')
  expect(host.textContent).toContain('Parkimi në Prishtinë, më i thjeshtë.')
})

it('does not mistake unfinished onboarding for a legacy installation after app preferences are saved', async () => {
  await mount()
  savePreferences({ selectedParkingId: 'osm-123' })
  await remount()
  expect(host.textContent).toContain('Parkimi në Prishtinë, më i thjeshtë.')
})

it('preserves the direct-to-map experience for existing installations', async () => {
  savePreferences({ selectedParkingId: 'osm-123' })
  await mount()
  expect(host.textContent).toContain('Parking map')
  expect(loadOnboarding().completed).toBe(true)
})

it('validates persisted data and keeps storage failure non-blocking', async () => {
  localStorage.setItem('parko:onboarding:v1', '{broken')
  expect(loadOnboarding().completed).toBe(false)
  localStorage.setItem('parko:onboarding:v1', JSON.stringify({ version: 1, completed: 'yes', preferences: ['closest', 'fake', 'closest'] }))
  expect(loadOnboarding()).toEqual({ version: 1, completed: false, preferences: ['closest'] })
  const storage = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
  expect(saveOnboarding({ version: 1, completed: true, preferences: [] })).toBe(false)
  await mount()
  expect(host.textContent).toContain('Ruajtja në shfletues nuk është e disponueshme')
  await click('Fillo')
  await click('Jo tani')
  await click('Vazhdo')
  await click('Vazhdo')
  await click('Gjej parking')
  expect(host.textContent).toContain('Parking map')
  storage.mockRestore()
})
