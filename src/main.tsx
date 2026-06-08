import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider, SignIn, UserButton, useAuth } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import {
  CLERK_PUBLISHABLE_KEY,
  getActiveDoctorAccount,
  resolveDoctorAccountFromLocation,
  setActiveDoctorAccount,
} from './config.js'

setActiveDoctorAccount(resolveDoctorAccountFromLocation())

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
  const { isLoaded, isSignedIn } = useAuth()
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const account = getActiveDoctorAccount()

  useEffect(() => {
    if (isLoaded) {
      setLoadTimedOut(false)
      return undefined
    }
    const timer = window.setTimeout(() => setLoadTimedOut(true), 6000)
    return () => window.clearTimeout(timer)
  }, [isLoaded])

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

  return (
    <>
      <div className="doctor-session-pill">
        <span>{account.accountId}</span>
        <strong>{account.profile.name}</strong>
        <UserButton />
      </div>
      <App />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {CLERK_PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl={window.location.href}>
        <DoctorAuthShell />
      </ClerkProvider>
    ) : (
      <MissingClerkConfig />
    )}
  </StrictMode>,
)
