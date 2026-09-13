import { useEffect, useRef, useState } from 'react'
import { preferenceOptions, type OnboardingPreference } from './state'
import './onboarding.css'

type Props = {
  mode: 'intro' | 'preferences'
  preferences: OnboardingPreference[]
  storageAvailable: boolean
  locationStatus: 'idle' | 'locating' | 'ready' | 'outside' | 'denied' | 'unavailable'
  onRequestLocation: () => void
  onFinish: (preferences: OnboardingPreference[]) => void
  onCancel: () => void
}

function Icon({ kind }: { kind: OnboardingPreference | 'location' | 'check' }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'closest' && <><path d="M12 21s6-5.4 6-11a6 6 0 0 0-12 0c0 5.6 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>}
    {kind === 'cheapest' && <><path d="M18 5a7 7 0 1 0 0 14M4 10h10M4 14h9" /></>}
    {kind === 'available' && <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></>}
    {kind === 'covered' && <><path d="m3 10 9-6 9 6M5 10v10h14V10M9 20v-7h6v7" /></>}
    {kind === 'location' && <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>}
    {kind === 'check' && <path d="m5 12 4 4L19 6" />}
  </svg>
}

function ParkingVisual() {
  return <div className="onboarding-map" aria-hidden="true">
    <svg viewBox="0 0 336 140" fill="none">
      <path d="M0 36h336M0 111h336M58 0v140M263 0v140M147 0l31 140" stroke="#fff" strokeWidth="14" />
      <path d="M0 36h336M0 111h336M58 0v140M263 0v140" stroke="#dce3e9" strokeWidth="1" />
      <rect x="193" y="52" width="52" height="42" rx="5" fill="#d4eade" />
      <path d="M59 112h76q29 0 29-27V71q0-35 35-35h53" stroke="#fff" strokeWidth="10" />
      <path d="M59 112h76q29 0 29-27V71q0-35 35-35h53" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="59" cy="112" r="6" fill="var(--primary)" stroke="#fff" strokeWidth="3" />
      <rect x="245" y="20" width="32" height="32" rx="8" fill="var(--available)" />
      <path d="M257 44V28h5a5 5 0 0 1 0 10h-5" stroke="#fff" strokeWidth="2.5" />
    </svg>
    <span>PRISHTINA</span>
  </div>
}

export default function Onboarding({ mode, preferences, storageAvailable, locationStatus, onRequestLocation, onFinish, onCancel }: Props) {
  const editing = mode === 'preferences'
  const [step, setStep] = useState(editing ? 2 : 0)
  const [selected, setSelected] = useState(preferences)
  const [requested, setRequested] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }); content.current?.scrollTo?.(0, 0) }, [step])
  useEffect(() => {
    if (step === 1 && requested && (locationStatus === 'ready' || locationStatus === 'outside')) {
      setRequested(false)
      setStep(2)
    }
  }, [locationStatus, requested, step])

  const title = ['Parkimi në Prishtinë, më i thjeshtë.', 'Gjej parking pranë teje', 'Çfarë ka më shumë rëndësi për ty?', 'Je gati të parkosh.'][step]
  const description = [
    'Gjej parkingje të lira, krahaso opsionet dhe mbërrij pa humbur kohë.',
    'Përdor vendndodhjen për të parë parkingjet aty pranë dhe për të marrë udhëzime të sakta.',
    'Mund t’i ndryshosh këto preferenca kurdo.',
    'Le ta gjejmë opsionin më të mirë të parkingut për ty.',
  ][step]
  const pending = requested && locationStatus === 'locating'
  const locationMessage = locationStatus === 'denied'
    ? 'Lokacioni është bllokuar në shfletues. Mund ta aktivizosh te cilësimet, ose të vazhdosh duke kërkuar në hartë.'
    : locationStatus === 'unavailable'
      ? 'Nuk mundëm ta gjejmë lokacionin. Provo përsëri, ose vazhdo dhe zgjidh një vend në hartë.'
      : pending ? 'Po e gjejmë lokacionin… Mund të vazhdosh edhe pa të.' : ''
  const next = () => {
    if (step === 3 || editing) { onFinish(selected); return }
    if (step === 1) {
      if (locationStatus === 'ready' || locationStatus === 'outside') { setStep(2); return }
      setRequested(true)
      onRequestLocation()
      return
    }
    setStep(step + 1)
  }
  const primaryLabel = editing ? 'Ruaj preferencat' : step === 0 ? 'Fillo' : step === 1
    ? pending ? 'Po kërkojmë…' : locationStatus === 'ready' || locationStatus === 'outside' ? 'Vazhdo' : requested ? 'Provo përsëri' : 'Lejo lokacionin'
    : step === 2 ? 'Vazhdo' : 'Gjej parking'

  return <section className="onboarding" lang="sq" aria-label={editing ? 'Preferencat e parkingut' : 'Mirë se vjen në Parko'}>
    <header className="onboarding-header">
      {step > 0 || editing ? <button type="button" className="onboarding-back" aria-label={editing ? 'Anulo ndryshimet e preferencave' : 'Kthehu'} onClick={() => {
        if (editing) { onCancel(); return }
        setRequested(false)
        setStep(step - 1)
      }}>←</button> : <span className="onboarding-brand">Parko<span>.</span></span>}
      {!editing && step < 3 && <span className="onboarding-progress" aria-label={`Hapi ${step + 1} nga 3`}><span aria-hidden="true">{[0, 1, 2].map(index => <i key={index} className={index <= step ? 'is-complete' : ''} />)}</span>{step + 1} / 3</span>}
      {!editing && step === 3 && <span className="onboarding-eyebrow">GJITHÇKA GATI</span>}
    </header>
    <div className="onboarding-content" ref={content}>
      <div key={step} className="onboarding-step">
        {step === 0 && <ParkingVisual />}
        {step === 1 && <span className="onboarding-symbol"><Icon kind="location" /></span>}
        {step === 3 && <span className="onboarding-symbol onboarding-symbol--ready"><Icon kind="check" /></span>}
        <h1 ref={heading} tabIndex={-1}>{title}</h1>
        <p className="onboarding-description">{description}</p>
        {step === 0 && <p className="onboarding-note">Disponueshmëria shfaqet vetëm aty ku është raportuar.</p>}
        {step === 1 && <>
          <div className="onboarding-location-benefit"><Icon kind="closest" /><span>S’ke dhënë lokacionin? S’ka problem.<small>Mund të kërkosh një zonë ose të zgjedhësh një vend në hartë.</small></span></div>
          <p className="onboarding-status" role="status">{locationMessage}</p>
        </>}
        {step === 2 && <>
          <fieldset className="onboarding-preferences"><legend>Zgjidh ato që kanë rëndësi për ty</legend>
            {preferenceOptions.map(option => <label key={option.id} className={`onboarding-option ${selected.includes(option.id) ? 'is-selected' : ''}`}>
              <Icon kind={option.id} /><span><strong>{option.label}</strong><small>{option.detail}</small></span>
              <input type="checkbox" checked={selected.includes(option.id)} onChange={() => setSelected(current => current.includes(option.id) ? current.filter(id => id !== option.id) : [...current, option.id])} />
            </label>)}
          </fieldset>
          <p className="onboarding-note">Ruhet në këtë pajisje për personalizim në të ardhmen. Filtrat dhe renditja e hartës mbeten të pandryshuara.</p>
        </>}
        {step === 3 && <div className="onboarding-location-benefit"><Icon kind="closest" /><span>Fillo me një destinacion<small>Kërko një vend ose prek hartën për të parë parkingjet aty pranë.</small></span></div>}
      </div>
    </div>
    <footer className="onboarding-footer">
      {!storageAvailable && <p className="onboarding-note" role="status">Ruajtja në shfletues nuk është e disponueshme. Zgjedhjet mund të mos mbahen pas mbylljes së faqes.</p>}
      <button type="button" className="button onboarding-primary" disabled={pending} onClick={next}>{primaryLabel}</button>
      {step === 1 && <button type="button" className="onboarding-secondary" onClick={() => { setRequested(false); setStep(2) }}>Jo tani</button>}
      {step === 0 && <span className="onboarding-footer-note">Nuk nevojitet llogari për të eksploruar</span>}
    </footer>
  </section>
}
