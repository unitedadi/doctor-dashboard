/* eslint-disable react-refresh/only-export-components */
import { Component, StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignIn, useAuth, useClerk, useUser } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import {
  CLERK_PUBLISHABLE_KEY,
  getActiveDoctorAccount,
  resolveDoctorAccountFromEmail,
  resolveDoctorAccountFromLocation,
  setActiveDoctorAccount,
} from './config.js'
import { setApiTokenProvider } from './lib/authFetch.js'

setActiveDoctorAccount(resolveDoctorAccountFromLocation() || undefined)

const SKIP_CLERK =
  import.meta.env.VITE_SKIP_CLERK === '1' ||
  import.meta.env.VITE_SKIP_CLERK === 'true'

function isMobileDevice() {
  if (typeof window === 'undefined') return false

  const nav = window.navigator as Navigator & {
    userAgentData?: { mobile?: boolean }
  }
  const userAgent = nav.userAgent || ''
  const platform = nav.platform || ''
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Kindle|Silk/i.test(userAgent)
  const iPadOsDesktopMode = platform === 'MacIntel' && nav.maxTouchPoints > 1
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const screenWidth = window.screen?.width || window.innerWidth
  const screenHeight = window.screen?.height || window.innerHeight
  const tabletOrPhoneScreen = Math.min(screenWidth, screenHeight) <= 1024

  return Boolean(nav.userAgentData?.mobile || mobileUserAgent || iPadOsDesktopMode || (coarsePointer && tabletOrPhoneScreen))
}

function syncMobileBlockedRootClass(blocked: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('mobile-device-blocked-root', blocked)
  document.body?.classList.toggle('mobile-device-blocked-root', blocked)
}

function MobileDeviceBlocked() {
  return (
    <div className="doctor-auth-page mobile-device-blocked-page">
      <div className="doctor-auth-card mobile-device-blocked-card">
        <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
        <p className="doctor-auth-kicker">For doctors</p>
        <h1>Open on a desktop to continue</h1>
        <p className="doctor-auth-copy">
          The clinical portal is desktop only. Patient charts, prescribing, and safety checks need a full-size screen.
        </p>
        <p className="doctor-auth-device-note">Sign in from your computer at <strong>rx.dardoc.co</strong></p>
      </div>
    </div>
  )
}

function DesktopOnlyGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(() => {
    const initialBlocked = isMobileDevice()
    syncMobileBlockedRootClass(initialBlocked)
    return initialBlocked
  })

  useEffect(() => {
    syncMobileBlockedRootClass(blocked)
  }, [blocked])

  useEffect(() => {
    const updateBlocked = () => {
      const nextBlocked = isMobileDevice()
      syncMobileBlockedRootClass(nextBlocked)
      setBlocked(nextBlocked)
    }
    const coarsePointerQuery = window.matchMedia?.('(pointer: coarse)')

    window.addEventListener('resize', updateBlocked)
    window.addEventListener('orientationchange', updateBlocked)
    coarsePointerQuery?.addEventListener?.('change', updateBlocked)

    return () => {
      window.removeEventListener('resize', updateBlocked)
      window.removeEventListener('orientationchange', updateBlocked)
      coarsePointerQuery?.removeEventListener?.('change', updateBlocked)
    }
  }, [])

  if (blocked) return <MobileDeviceBlocked />
  return <>{children}</>
}

function MissingClerkConfig() {
  return (
    <div className="doctor-auth-page">
      <div className="doctor-auth-card auth-card-400">
        <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
        <p className="doctor-auth-kicker">For doctors</p>
        <h1>Login could not load</h1>
        <p className="doctor-auth-copy">
          The sign-in service did not respond. Your connection may be offline, or this domain is not allowed for the configured key.
        </p>
        <button type="button" className="doctor-auth-button" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div>
  )
}

function PortalUnavailable() {
  return (
    <div className="doctor-auth-page">
      <div className="doctor-auth-card auth-card-420">
        <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
        <p className="doctor-auth-kicker">For doctors</p>
        <h1>The portal is unavailable</h1>
        <p className="doctor-auth-copy">
          Something on our side is not responding. No patient data was changed. If a consultation is starting now, call the patient directly from your phone.
        </p>
        <button type="button" className="doctor-auth-button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  )
}

class PortalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? <PortalUnavailable /> : this.props.children
  }
}

function DoctorAuthShell() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { user } = useUser()
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [account, setAccount] = useState(getActiveDoctorAccount())

  useEffect(() => {
    if (isLoaded) return undefined
    const timer = window.setTimeout(() => setLoadTimedOut(true), 6000)
    return () => window.clearTimeout(timer)
  }, [isLoaded])

  useEffect(() => {
    if (!isSignedIn) {
      setApiTokenProvider(null)
      return
    }

    setApiTokenProvider(() => getToken())
    return () => setApiTokenProvider(null)
  }, [getToken, isSignedIn])

  /* Clerk identity is external state; this effect resolves it into the active doctor workspace. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const locationAccountId = resolveDoctorAccountFromLocation()
    const primaryEmail =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      ''
    const emailAccountId = resolveDoctorAccountFromEmail(primaryEmail)
    const resolvedAccountId = locationAccountId || emailAccountId

    if (!resolvedAccountId) {
      setWorkspaceError(`You are signed in as ${primaryEmail || 'this account'}, but no doctor workspace is linked to this account.`)
      setWorkspaceReady(true)
      return
    }

    setWorkspaceError('')
    setAccount(setActiveDoctorAccount(resolvedAccountId))
    setWorkspaceReady(true)
  }, [isLoaded, isSignedIn, user])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isLoaded) {
    return (
      <div className="doctor-auth-page">
        <div className="doctor-auth-card auth-card-380">
          <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
          <p className="doctor-auth-kicker">For doctors</p>
          <h1>{loadTimedOut ? 'Login could not load' : 'Opening your workspace'}</h1>
          <p className="doctor-auth-copy">
            {loadTimedOut
              ? 'The sign-in service did not respond. Your connection may be offline, or this domain is not allowed for the configured key.'
              : 'Checking your doctor dashboard session. This takes a moment.'}
          </p>
          {!loadTimedOut ? <div className="doctor-auth-skeleton" aria-hidden="true"><span /><span /><span /></div> : null}
          {loadTimedOut ? <button type="button" className="doctor-auth-button" onClick={() => window.location.reload()}>Try again</button> : null}
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="doctor-auth-page">
        <div className="doctor-auth-card auth-card-400">
          <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
          <p className="doctor-auth-kicker">For doctors</p>
          <h1>Sign in to continue</h1>
          <p className="doctor-auth-copy">
            Workspace · <strong>{account.profile.name}</strong>
          </p>
          <div className="doctor-auth-clerk">
            <SignIn routing="hash" />
            <p className="doctor-auth-security">Secured by Clerk · desktop only</p>
          </div>
        </div>
      </div>
    )
  }

  if (workspaceError) {
    return (
      <div className="doctor-auth-page">
        <div className="doctor-auth-card auth-card-420">
          <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
          <p className="doctor-auth-kicker">For doctors</p>
          <h1>Workspace not linked</h1>
          <p className="doctor-auth-copy">{workspaceError}</p>
          <p className="doctor-auth-copy">Ask the DarDoc clinical team to link your account, then sign in again.</p>
          <div className="doctor-auth-actions">
            <button type="button" className="doctor-auth-button" onClick={() => signOut({ redirectUrl: window.location.href })}>Sign in with another account</button>
            <button type="button" className="doctor-auth-button secondary" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  if (!workspaceReady) {
    return (
      <div className="doctor-auth-page">
        <div className="doctor-auth-card auth-card-380">
          <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
          <p className="doctor-auth-kicker">For doctors</p>
          <h1>Opening your workspace</h1>
          <p className="doctor-auth-copy">Checking your doctor dashboard session. This takes a moment.</p>
          <div className="doctor-auth-skeleton" aria-hidden="true"><span /><span /><span /></div>
        </div>
      </div>
    )
  }

  const doctorEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || ''
  return <App doctorEmail={doctorEmail} onSignOut={() => signOut()} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesktopOnlyGate>
      <PortalErrorBoundary>
        {SKIP_CLERK ? (
          <App />
        ) : CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl={window.location.href}>
            <DoctorAuthShell />
          </ClerkProvider>
        ) : (
          <MissingClerkConfig />
        )}
      </PortalErrorBoundary>
    </DesktopOnlyGate>
  </StrictMode>,
)
