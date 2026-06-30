import { useEffect, useState } from 'react'
import { StreamChat } from 'stream-chat'
import './data.js'
import './components/shell.jsx'
import './components/patientChart.jsx'
import './components/clinicalInbox.jsx'
import './components/appointments.jsx'
import './components/patients.jsx'
import './components/chat.jsx'
import './components/prescribe.jsx'
import './components/refills.jsx'
import './styles/dashboard.css'
import { API_BASE, DOCTOR_ID } from './config'
import { fetchJson } from './lib/authFetch.js'

type AppointmentCountPayload = {
  today?: unknown[]
}

type ChatTokenPayload = {
  api_key: string
  user_id: string
  user_token: string
  user?: {
    name?: string
  }
}

function dubaiToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function fetchChatToken() {
  return fetchJson<ChatTokenPayload>(`${API_BASE}/doctor/chat/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctor_id: DOCTOR_ID }),
  })
}

function App() {
  const [route, setRoute] = useState('appointments')
  const [routeContext, setRouteContext] = useState<Record<string, string>>({})
  const [appointmentCount, setAppointmentCount] = useState<number | null>(null)
  const [clinicalInboxCount, setClinicalInboxCount] = useState<number | null>(null)
  const [unreadChats, setUnreadChats] = useState<number | null>(null)

  const Sidebar = window.DD_UI.Sidebar
  const ClinicalInboxView = window.DD_ClinicalInboxView
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

  const openAmendPrescription = (patient: any, prescription: any) => {
    const source = prescription?.source || ''
    const items = Array.isArray(prescription?.items) ? prescription.items : []
    const base = {
      amendSource: source,
      amendId: prescription?.id || '',
      amendItems: JSON.stringify(items),
      patientId: patient?.id || '',
      customerId: patient?.customerId || patient?.customer_id || '',
      patientName: patient?.name || '',
      patientPhone: patient?.phone || '',
      trackKey: prescription?.trackKey || prescription?.track_key || patient?.trackKey || patient?.track_key || 'weight-loss',
      prescriptionMode: 'reissue',
    }
    if (source === 'quickwlp_prescription') {
      go('prescribe', {
        ...base,
        quickWlpLeadId: prescription?.quickWlpLeadId || prescription?.lead_id || '',
        quickWlpName: patient?.name || '',
        quickWlpPhone: patient?.phone || '',
        quickWlpEmail: patient?.email || '',
        quickWlpDoctorId: DOCTOR_ID,
      })
      return
    }
    go('prescribe', base)
  }

  useEffect(() => {
    let cancelled = false

    async function loadAppointmentCount() {
      try {
        const data = await fetchJson<AppointmentCountPayload>(`${API_BASE}/doctor/dashboard/appointments?date=${dubaiToday()}&doctor_id=${encodeURIComponent(DOCTOR_ID)}`)
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
      <Sidebar
        active={route}
        onNav={(id: string) => go(id)}
        appointmentCount={appointmentCount}
        clinicalInboxCount={clinicalInboxCount}
        unreadChats={unreadChats}
      />
      <main className="main">
        {route === 'clinical-inbox' && (
          <ClinicalInboxView
            onCountChange={setClinicalInboxCount}
            onOpenPatient={(id: string, customerId?: string) => go('patient-hub', { patientId: id || '', customerId: customerId || '', hubMode: 'charts' })}
            onOpenChat={(id: string, channelId?: string) => go('patient-hub', { patientId: id || '', channelId: channelId || '', hubMode: 'needs_reply' })}
            onPrescribeRx={(task: any) => go('prescribe', {
              patientId: task?.patientId || '',
              customerId: task?.customerId || '',
              trackKey: task?.trackKey || 'weight-loss',
              refillRequestId: task?.refillRequestId || '',
              prescriptionMode: task?.refillRequestId || task?.category === 'refill_review' ? 'refill' : task?.category === 'reissue' ? 'reissue' : 'issue',
            })}
            onPrescribeQuickWlp={(task: any) => go('prescribe', {
              quickWlpLeadId: task?.quickWlpLeadId || task?.patientId || '',
              quickWlpName: task?.patientName || '',
              quickWlpPhone: task?.phone || '',
              quickWlpWhatsapp: task?.phone || '',
              quickWlpEmail: task?.email || '',
              quickWlpDoctorId: task?.doctorId || DOCTOR_ID,
              quickWlpTrackKey: task?.trackKey || task?.track_key || 'weight-loss',
              prescriptionMode: 'quickwlp',
            })}
          />
        )}
        {route === 'appointments' && (
          <AppointmentsView
            onOpenPatient={(id: string, customerId?: string) => go('patient-hub', { patientId: id, customerId: customerId || '', hubMode: 'charts' })}
            onOpenChat={(id: string, customerId?: string, channelId?: string) => go('patient-hub', { patientId: id, customerId: customerId || '', channelId: channelId || '', hubMode: 'all' })}
            onPrescribeRx={(appointment: any) => go('prescribe', {
              patientId: appointment?.patientId || appointment?.patient?.id || '',
              trackKey: appointment?.trackKey || 'weight-loss',
              prescriptionMode: 'issue',
            })}
            onPrescribeQuickWlp={(appointment: any) => go('prescribe', {
              quickWlpLeadId: appointment?.quickWlpLeadId || appointment?.patientId || '',
              quickWlpName: appointment?.patient?.name || '',
              quickWlpPhone: appointment?.patient?.phone || '',
              quickWlpWhatsapp: appointment?.patient?.whatsapp || '',
              quickWlpEmail: appointment?.patient?.email || '',
              quickWlpDoctorId: appointment?.doctorId || DOCTOR_ID,
              quickWlpTrackKey: appointment?.trackKey || appointment?.track_key || 'weight-loss',
              prescriptionMode: 'quickwlp',
            })}
          />
        )}
        {route === 'patients' && (
          <PatientsView
            initialPatientId={routeContext.patientId}
            initialCustomerId={routeContext.customerId}
            onMessage={(id: string, customerId?: string) => go('patient-hub', { patientId: id, customerId: customerId || '', hubMode: 'all' })}
            onPrescribe={(id: string, customerId?: string, trackKey?: string, prescriptionMode?: string) => go('prescribe', { patientId: id, customerId: customerId || '', trackKey: trackKey || '', prescriptionMode: prescriptionMode || 'issue' })}
            onAmendPrescription={openAmendPrescription}
          />
        )}
        {(route === 'patient-hub' || route === 'chat') && (
          <ChatView
            initialPatientId={routeContext.patientId}
            initialCustomerId={routeContext.customerId}
            initialChannelId={routeContext.channelId}
            initialHubMode={routeContext.hubMode}
            onOpenPatient={(id: string, customerId?: string) => go('patient-hub', { patientId: id || '', customerId: customerId || '' })}
            onPrescribe={(id: string, trackKey?: string, customerId?: string, prescriptionMode?: string) => go('prescribe', { patientId: id || '', trackKey: trackKey || '', customerId: customerId || '', prescriptionMode: prescriptionMode || 'issue' })}
            onAmendPrescription={openAmendPrescription}
          />
        )}
        {route === 'refills' && (
          <RefillsView
            onPrescribe={(id: string, trackKey?: string, customerId?: string, refillRequestId?: string) => go('prescribe', { patientId: id || '', trackKey: trackKey || 'weight-loss', customerId: customerId || '', refillRequestId: refillRequestId || '', prescriptionMode: 'refill' })}
          />
        )}
        {route === 'prescribe' && (
          <PrescribeView
            initialPatientId={routeContext.patientId}
            initialCustomerId={routeContext.customerId}
            initialTrackKey={routeContext.trackKey}
            initialRefillRequestId={routeContext.refillRequestId}
            initialPrescriptionMode={routeContext.prescriptionMode}
            initialQuickWlpLeadId={routeContext.quickWlpLeadId}
            initialQuickWlpName={routeContext.quickWlpName}
            initialQuickWlpPhone={routeContext.quickWlpPhone}
            initialQuickWlpWhatsapp={routeContext.quickWlpWhatsapp}
            initialQuickWlpEmail={routeContext.quickWlpEmail}
            initialQuickWlpDoctorId={routeContext.quickWlpDoctorId}
            initialQuickWlpTrackKey={routeContext.quickWlpTrackKey}
            initialAmendSource={routeContext.amendSource}
            initialAmendId={routeContext.amendId}
            initialAmendItems={routeContext.amendItems}
            initialPatientName={routeContext.patientName}
            initialPatientPhone={routeContext.patientPhone}
            onSent={() => undefined}
          />
        )}
      </main>
    </div>
  )
}

export default App
