import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BottomSheet, InfoRow, ParkingActions, PrimaryButton, SheetHandle, StatusBadge, TripSummary } from './components'
import { parkingMarkerHtml } from './parkingMarker'

let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

it('keeps one primary parking action and forwards every original callback', async () => {
  const navigate = vi.fn(), details = vi.fn(), street = vi.fn()
  await act(async () => root.render(<ParkingActions onNavigate={navigate} onDetails={details} onStreetView={street} />))
  const buttons = host.querySelectorAll('button')
  expect(buttons[0].textContent).toBe('Shko këtu')
  expect(host.querySelectorAll('.ui-primary')).toHaveLength(1)
  for (const button of buttons) await act(async () => button.click())
  expect(navigate).toHaveBeenCalledOnce()
  expect(details).toHaveBeenCalledOnce()
  expect(street).toHaveBeenCalledOnce()
})

it('preserves the sheet DOM ref, controlled state and pointer event handler', async () => {
  const ref = createRef<HTMLElement>(), pointer = vi.fn(), toggle = vi.fn()
  await act(async () => root.render(<BottomSheet ref={ref} className="details-sheet" aria-label="Detajet" onPointerDown={pointer}><SheetHandle aria-label="Zgjero detajet" aria-expanded={false} onClick={toggle} /></BottomSheet>))
  expect(ref.current).toBe(host.querySelector('section'))
  expect(ref.current?.classList.contains('ui-sheet')).toBe(true)
  const handle = host.querySelector('button')!
  expect(handle.getAttribute('aria-expanded')).toBe('false')
  await act(async () => { handle.dispatchEvent(new Event('pointerdown', { bubbles: true })); handle.click() })
  expect(pointer).toHaveBeenCalledOnce()
  expect(toggle).toHaveBeenCalledOnce()
})

it('does not accidentally submit a form and preserves disabled state', async () => {
  const submit = vi.fn(), click = vi.fn()
  await act(async () => root.render(<form onSubmit={submit}><PrimaryButton disabled onClick={click}>Vazhdo</PrimaryButton></form>))
  const button = host.querySelector('button')!
  expect(button.type).toBe('button')
  await act(async () => button.click())
  expect(submit).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
})

it('communicates status with text as well as color and keeps decorative icons hidden', async () => {
  await act(async () => root.render(<><StatusBadge tone="warning">Disponueshmëria nuk dihet</StatusBadge><InfoRow icon="pin" label="Adresa">Prishtinë</InfoRow></>))
  expect(host.textContent).toContain('Disponueshmëria nuk dihet')
  expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  expect(host.querySelector('.ui-status')?.classList.contains('ui-status--warning')).toBe(true)
})

it('keeps unknown trip metrics unknown, including after the visual redesign', async () => {
  await act(async () => root.render(<TripSummary minutes="—" eta="—" distance="—" arrived={false} />))
  expect([...host.querySelectorAll('strong')].map(x => x.textContent)).toEqual(['— min', '—', '—'])
})

it('uses P for individual parking markers with selected, restricted and size variants', () => {
  const base = { color: '#2463eb', category: 'public', selected: false, restricted: false, large: false }
  const compact = parkingMarkerHtml(base)
  expect(compact).toContain('parking-marker-hit')
  expect(compact).toContain('>P</span>')
  expect(compact).toContain('--parking-point-size:24px')
  const selected = parkingMarkerHtml({ ...base, selected: true, restricted: true, large: true })
  expect(selected).toContain('parking-point--selected')
  expect(selected).toContain('parking-point--restricted')
  expect(selected).toContain('--parking-point-size:34px')
})
