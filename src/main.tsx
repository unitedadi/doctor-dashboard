import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignIn, useAuth, useUser } from '@clerk/react'
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

function MobileDeviceBlocked() {
  return (
    <div className="doctor-auth-page mobile-device-blocked-page">
      <div className="doctor-auth-card mobile-device-blocked-card">
        <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
        <p className="doctor-auth-kicker">For Doctors</p>
        <h1>Mobile use is not allowed</h1>
        <p className="doctor-auth-copy">
          This portal is available only on desktop devices. Please login via Desktop.
        </p>
      </div>
    </div>
  )
}

function DesktopOnlyGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(() => isMobileDevice())

  useEffect(() => {
    const updateBlocked = () => setBlocked(isMobileDevice())
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
      <div className="doctor-auth-card">
        <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
        <p className="doctor-auth-kicker">For Doctors</p>
        <h1>Clerk is not configured</h1>
        <p className="doctor-auth-copy">
          Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> or <code>VITE_CLERK_PUBLISHABLE_KEY</code> to enable login.
        </p>
      </div>
    </div>
  )
}

function DoctorAuthShell() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [account, setAccount] = useState(getActiveDoctorAccount())

  useEffect(() => {
    if (isLoaded) {
      setLoadTimedOut(false)
      return undefined
    }
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

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setWorkspaceReady(false)
      return
    }

    const locationAccountId = resolveDoctorAccountFromLocation()
    const primaryEmail =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      ''
    const emailAccountId = resolveDoctorAccountFromEmail(primaryEmail)
    const resolvedAccountId = locationAccountId || emailAccountId

    if (!resolvedAccountId) {
      setWorkspaceError(primaryEmail ? `No doctor workspace is linked to ${primaryEmail}.` : 'No doctor workspace is linked to this login.')
      setWorkspaceReady(true)
      return
    }

    setWorkspaceError('')
    setAccount(setActiveDoctorAccount(resolvedAccountId))
    setWorkspaceReady(true)
  }, [isLoaded, isSignedIn, user])

  if (!isLoaded) {
    return (
      <div className="doctor-auth-page">
        <div className="doctor-auth-card">
          <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
          <p className="doctor-auth-kicker">For Doctors</p>
          <h1>{loadTimedOut ? 'Cannot load login' : 'Loading'}</h1>
          <p className="doctor-auth-copy">
            {loadTimedOut
              ? 'Clerk did not finish loading. Check that this domain is allowed for the configured publishable key.'
              : 'Checking your doctor dashboard session.'}
          </p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="doctor-auth-page">
        <div className="doctor-auth-card">
          <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
          <p className="doctor-auth-kicker">For Doctors</p>
          <h1>Sign in to continue</h1>
          <p className="doctor-auth-copy">
            Workspace: <strong>{account.profile.name}</strong>
          </p>
          <SignIn routing="hash" />
        </div>
      </div>
    )
  }

  if (workspaceError) {
    return (
      <div className="doctor-auth-page">
        <div className="doctor-auth-card">
          <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
          <p className="doctor-auth-kicker">For Doctors</p>
          <h1>Workspace not linked</h1>
          <p className="doctor-auth-copy">{workspaceError}</p>
        </div>
      </div>
    )
  }

  if (!workspaceReady) {
    return (
      <div className="doctor-auth-page">
        <div className="doctor-auth-card">
          <img src="/assets/logo-dardoc-teal.svg" alt="DarDoc" />
          <p className="doctor-auth-kicker">For Doctors</p>
          <h1>Loading</h1>
          <p className="doctor-auth-copy">Opening your doctor workspace.</p>
        </div>
      </div>
    )
  }

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesktopOnlyGate>
      {SKIP_CLERK ? (
        <App />
      ) : CLERK_PUBLISHABLE_KEY ? (
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl={window.location.href}>
          <DoctorAuthShell />
        </ClerkProvider>
      ) : (
        <MissingClerkConfig />
      )}
    </DesktopOnlyGate>
  </StrictMode>,
)
