import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it } from 'vitest'
import { useDialogFocus } from './useDialogFocus'

function Dialog() {
  const ref = useRef<HTMLDivElement>(null)
  useDialogFocus(ref)
  return <div ref={ref} tabIndex={-1}><button>First</button><button disabled>Disabled</button><button>Last</button></div>
}
afterEach(() => { document.body.innerHTML = '' })
it('wraps keyboard focus in both directions and restores the trigger', async () => {
  const trigger = document.createElement('button')
  const container = document.createElement('div')
  document.body.append(trigger, container)
  trigger.focus()
  const root = createRoot(container)
  await act(async () => root.render(<Dialog />))
  const buttons = container.querySelectorAll('button')
  expect(document.activeElement).toBe(buttons[0])
  buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(buttons[2])
  buttons[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(buttons[0])
  await act(async () => root.unmount())
  expect(document.activeElement).toBe(trigger)
})
