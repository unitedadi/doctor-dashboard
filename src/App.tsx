import { useEffect, useState } from 'react'
import { StreamChat } from 'stream-chat'
import './data.js'
import './components/shell.jsx'
import './components/appointments.jsx'
import './components/patients.jsx'
import './components/chat.jsx'
import './components/prescribe.jsx'
import './components/refills.jsx'
import './styles/dashboard.css'
import { API_BASE, DOCTOR_ID } from './config'

function dubaiToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function fetchJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || data.error || `request_failed_${response.status}`)
  return data
}

async function fetchChatToken() {
  return fetchJson(`${API_BASE}/doctor/chat/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctor_id: DOCTOR_ID }),
  })
}

function App() {
  const [route, setRoute] = useState('appointments')
  const [routeContext, setRouteContext] = useState<Record<string, string>>({})
  const [appointmentCount, setAppointmentCount] = useState<number | null>(null)
  const [unreadChats, setUnreadChats] = useState<number | null>(null)

  const Sidebar = window.DD_UI.Sidebar
  const AppointmentsView = window.DD_AppointmentsView
  const PatientsView = window.DD_PatientsView
  const ChatView = window.DD_ChatView
  const PrescribeView = window.DD_PrescribeView
  const RefillsView = window.DD_RefillsView

  const go = (id: string, ctx: Record<string, string> = {}) => {
    setRoute(id)
    setRouteContext(ctx)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    let cancelled = false

    async function loadAppointmentCount() {
      try {
        const data = await fetchJson(`${API_BASE}/doctor/dashboard/appointments?date=${dubaiToday()}`)
        if (!cancelled) setAppointmentCount(Array.isArray(data.today) ? data.today.length : 0)
      } catch {
        if (!cancelled) setAppointmentCount(null)
      }
    }

    loadAppointmentCount()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let streamClient: StreamChat | null = null

    async function loadUnreadChats() {
      try {
        const token = await fetchChatToken()
        streamClient = new StreamChat(token.api_key, { timeout: 15000 })
        await streamClient.connectUser({ id: token.user_id, name: token.user?.name }, token.user_token)
        const channels = await streamClient.queryChannels(
          { type: 'messaging', members: { $in: [token.user_id] } },
          { last_message_at: -1 },
          { limit: 100, state: true, watch: false },
        )
        const visibleUnread = channels.reduce((sum, channel) => sum + (channel.countUnread?.() || 0), 0)
        if (!cancelled) setUnreadChats(visibleUnread)
      } catch {
        if (!cancelled) setUnreadChats(null)
      } finally {
        streamClient?.disconnectUser().catch(() => undefined)
      }
    }

    loadUnreadChats()
    const interval = window.setInterval(loadUnreadChats, 60000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      streamClient?.disconnectUser().catch(() => undefined)
    }
  }, [])

  return (
    <div className="app" data-screen-label={route}>
      <Sidebar active={route} onNav={(id: string) => go(id)} appointmentCount={appointmentCount} unreadChats={unreadChats} />
      <main className="main">
        {route === 'appointments' && (
          <AppointmentsView
            onOpenPatient={(id: string) => go('patients', { patientId: id })}
            onOpenChat={(id: string) => go('chat', { patientId: id })}
          />
        )}
        {route === 'patients' && (
          <PatientsView
            initialPatientId={routeContext.patientId}
            initialCustomerId={routeContext.customerId}
            onMessage={(id: string) => go('chat', { patientId: id })}
            onPrescribe={(id: string) => go('prescribe', { patientId: id })}
          />
        )}
        {route === 'chat' && (
          <ChatView
            initialPatientId={routeContext.patientId}
            onOpenPatient={(id: string, customerId?: string) => go('patients', { patientId: id || '', customerId: customerId || '' })}
            onPrescribe={(id: string, trackKey?: string, customerId?: string) => go('prescribe', { patientId: id || '', trackKey: trackKey || '', customerId: customerId || '' })}
          />
        )}
        {route === 'refills' && (
          <RefillsView
            onPrescribe={(id: string, trackKey?: string, customerId?: string, refillRequestId?: string) => go('prescribe', { patientId: id || '', trackKey: trackKey || 'weight-loss', customerId: customerId || '', refillRequestId: refillRequestId || '' })}
          />
        )}
        {route === 'prescribe' && (
          <PrescribeView
            initialPatientId={routeContext.patientId}
            initialCustomerId={routeContext.customerId}
            initialTrackKey={routeContext.trackKey}
            initialRefillRequestId={routeContext.refillRequestId}
            onSent={() => undefined}
          />
        )}
      </main>
    </div>
  )
}

export default App
