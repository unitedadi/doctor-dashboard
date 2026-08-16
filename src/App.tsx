import { useEffect, useState } from 'react'
import { StreamChat } from 'stream-chat'
import './data.js'
import './components/shell.jsx'
import './components/clinicalUi.jsx'
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
import { summarizeClinicalInboxTasks, type ClinicalInboxSummary } from './lib/clinicalInboxSummary.js'
import {
  disableDoctorChatPush,
  doctorChatPushFailure,
  enableDoctorChatPush,
  readDoctorChatPushState,
  type DoctorChatPushState,
} from './lib/doctorChatPush.js'

type AppointmentCountPayload = {
  today?: unknown[]
}

type ClinicalInboxCountPayload = {
  tasks?: unknown[]
}

type ChatTokenPayload = {
  api_key: string
  user_id: string
  user_token: string
  user?: {
    name?: string
  }
}

type FeedbackMetricsPayload = {
  metrics?: {
    minimum_sample_reached?: boolean
    average_rating?: number
    response_count?: number
  }
}

type AppProps = {
  doctorEmail?: string
  onSignOut?: () => void
}

type DashboardPatientPayload = {
  id?: string
  customerId?: string
  customer_id?: string
  name?: string
  phone?: string
  whatsapp?: string
  email?: string
  trackKey?: string
  track_key?: string
}

type DashboardActionPayload = {
  id?: string
  source?: string
  items?: unknown[]
  patient?: DashboardPatientPayload
  patientId?: string
  customerId?: string
  patientName?: string
  phone?: string
  email?: string
  trackKey?: string
  track_key?: string
  appointmentId?: string
  sourceId?: string
  refillRequestId?: string
  category?: string
  orderMode?: string
  quickWlpLeadId?: string
  doctorId?: string
  b2bPartnerId?: string
  b2b_partner_id?: string
  b2bPartnerName?: string
  b2b_partner_name?: string
  b2bPromoCode?: string
  b2b_promo_code?: string
  quickWlpDoctorId?: string
  lead_id?: string
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

function initialNavigation(): { route: string; context: Record<string, string> } {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  const channelId = params.get('channel_id') || ''
  if ((view === 'patient-hub' || view === 'chat') && channelId) {
    return {
      route: 'patient-hub',
      context: {
        channelId,
        hubMode: params.get('hub_mode') || 'needs_reply',
      },
    }
  }
  return { route: 'appointments', context: {} }
}

function App({ doctorEmail = '', onSignOut }: AppProps) {
  const [initialNavigationState] = useState(initialNavigation)
  const [route, setRoute] = useState(initialNavigationState.route)
  const [routeContext, setRouteContext] = useState<Record<string, string>>(initialNavigationState.context)
  const [appointmentCount, setAppointmentCount] = useState<number | null>(null)
  const [clinicalInboxCount, setClinicalInboxCount] = useState<number | null>(null)
  const [clinicalInboxBreakdown, setClinicalInboxBreakdown] = useState<ClinicalInboxSummary | null>(null)
  const [unreadChats, setUnreadChats] = useState<number | null>(null)
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null)
  const [pushState, setPushState] = useState<DoctorChatPushState>({ status: 'loading', label: 'Checking alerts' })
  const [pushBusy, setPushBusy] = useState(false)

  const Sidebar = window.DD_UI.Sidebar
  const ClinicalInboxView = window.DD_ClinicalInboxView
  const AppointmentsView = window.DD_AppointmentsView
  const PatientsView = window.DD_PatientsView
  const ChatView = window.DD_ChatView
  const PrescribeView = window.DD_PrescribeView
  const RefillsView = window.DD_RefillsView

  const routeLabel = (id: string) => ({
    appointments: 'Schedule',
    'clinical-inbox': 'Clinical inbox',
    'patient-hub': 'Patient hub',
    patients: 'Patient hub',
    chat: 'Patient hub',
    refills: 'Clinical inbox',
  }[id] || 'Clinical workspace')

  const go = (id: string, ctx: Record<string, string> = {}) => {
    setRoute(id)
    setRouteContext(id === 'prescribe'
      ? { ...ctx, originRoute: route, originLabel: routeLabel(route) }
      : ctx)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    let cancelled = false
    readDoctorChatPushState({ apiBase: API_BASE, doctorId: DOCTOR_ID })
      .then((state) => {
        if (!cancelled) setPushState(state)
      })
      .catch(() => {
        if (!cancelled) setPushState({ status: 'unavailable', label: 'Alerts unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ doctor_id: DOCTOR_ID, lookback_days: '90', limit: '100' })
    fetchJson<ClinicalInboxCountPayload>(`${API_BASE}/doctor/clinical-inbox?${params.toString()}`)
      .then((data) => {
        if (!cancelled) {
          const summary = summarizeClinicalInboxTasks(data.tasks)
          setClinicalInboxCount(summary.total)
          setClinicalInboxBreakdown(summary)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClinicalInboxCount(null)
          setClinicalInboxBreakdown(null)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchJson<FeedbackMetricsPayload>(`${API_BASE}/doctor/consultation-feedback/metrics?doctor_id=${encodeURIComponent(DOCTOR_ID)}`)
      .then((data) => {
        const metrics = data.metrics
        if (!cancelled && metrics?.minimum_sample_reached && Number.isFinite(metrics.average_rating) && Number.isFinite(metrics.response_count)) {
          setRating({ average: Number(metrics.average_rating), count: Number(metrics.response_count) })
        }
      })
      .catch(() => {
        if (!cancelled) setRating(null)
      })
    return () => { cancelled = true }
  }, [])

  const togglePush = async () => {
    if (pushBusy || ['loading', 'unsupported', 'unavailable', 'blocked'].includes(pushState.status)) return
    setPushBusy(true)
    try {
      const state = pushState.status === 'on'
        ? await disableDoctorChatPush({ apiBase: API_BASE, doctorId: DOCTOR_ID })
        : await enableDoctorChatPush({ apiBase: API_BASE, doctorId: DOCTOR_ID })
      setPushState(state)
    } catch (error) {
      const failure = doctorChatPushFailure(error)
      console.error('[doctor-chat-push] activation_failed', {
        code: failure.code,
        stage: failure.stage,
        browser_error_name: failure.browserErrorName,
        repair_attempted: failure.repairAttempted,
      })
      setPushState({ status: 'error', label: failure.label })
    } finally {
      setPushBusy(false)
    }
  }

  const checkPush = async () => {
    if (pushBusy) return
    setPushBusy(true)
    try {
      setPushState(await readDoctorChatPushState({ apiBase: API_BASE, doctorId: DOCTOR_ID }))
    } catch {
      setPushState({ status: 'unavailable', label: 'Alerts unavailable' })
    } finally {
      setPushBusy(false)
    }
  }

  const openAmendPrescription = (patient: DashboardPatientPayload, prescription: DashboardActionPayload) => {
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
        clinicalInboxBreakdown={clinicalInboxBreakdown}
        unreadChats={unreadChats}
        activeInboxCategory={route === 'clinical-inbox' ? routeContext.category || '' : ''}
        onOpenInboxCategory={(category: string) => go('clinical-inbox', { category })}
        notificationState={pushState.status}
        notificationLabel={pushBusy ? 'Updating alerts' : pushState.label}
        notificationDisabled={pushBusy || ['loading', 'unsupported', 'unavailable', 'blocked'].includes(pushState.status)}
        onToggleNotification={togglePush}
        onCheckNotification={checkPush}
        rating={rating}
        doctorEmail={doctorEmail}
        onSignOut={onSignOut}
      />
      <main className="main">
        {route === 'clinical-inbox' && (
          <ClinicalInboxView
            onCountChange={setClinicalInboxCount}
            onBreakdownChange={setClinicalInboxBreakdown}
            initialCategory={routeContext.category || ''}
            onOpenPatient={(id: string, customerId?: string) => go('patient-hub', { patientId: id || '', customerId: customerId || '', hubMode: 'charts' })}
            onOpenChat={(id: string, channelId?: string) => go('patient-hub', { patientId: id || '', channelId: channelId || '', hubMode: 'needs_reply' })}
            onPrescribeRx={(task: DashboardActionPayload) => go('prescribe', {
              patientId: task?.patientId || '',
              customerId: task?.customerId || '',
              patientName: task?.patientName || '',
              patientPhone: task?.phone || '',
              trackKey: task?.trackKey || 'weight-loss',
              consultationId: task?.appointmentId || task?.sourceId || '',
              consultationSource: 'RX',
              refillRequestId: task?.refillRequestId || '',
              prescriptionMode: task?.refillRequestId || task?.category === 'refill_review' ? 'refill' : task?.category === 'reissue' ? 'reissue' : 'issue',
              amendId: task?.category === 'reissue' ? task?.sourceId || '' : '',
              orderMode: task?.orderMode || '',
            })}
            onPrescribeQuickWlp={(task: DashboardActionPayload) => go('prescribe', {
              patientId: task?.patientId || '',
              customerId: task?.customerId || '',
              consultationId: task?.appointmentId || task?.sourceId || '',
              consultationSource: 'QUICKWLP',
              quickWlpLeadId: task?.quickWlpLeadId || task?.patientId || '',
              quickWlpName: task?.patientName || '',
              quickWlpPhone: task?.phone || '',
              quickWlpWhatsapp: task?.phone || '',
              quickWlpEmail: task?.email || '',
              quickWlpDoctorId: task?.doctorId || DOCTOR_ID,
              quickWlpTrackKey: task?.trackKey || task?.track_key || 'weight-loss',
              quickWlpSellerId: task?.b2bPartnerId || task?.b2b_partner_id || '',
              quickWlpSellerName: task?.b2bPartnerName || task?.b2b_partner_name || '',
              quickWlpPromoCode: task?.b2bPromoCode || task?.b2b_promo_code || '',
              prescriptionMode: 'quickwlp',
              orderMode: task?.orderMode || '',
            })}
          />
        )}
        {route === 'appointments' && (
          <AppointmentsView
            onOpenPatient={(id: string, customerId?: string) => go('patient-hub', { patientId: id, customerId: customerId || '', hubMode: 'charts' })}
            onOpenChat={(id: string, customerId?: string, channelId?: string) => go('patient-hub', { patientId: id, customerId: customerId || '', channelId: channelId || '', hubMode: 'all' })}
            onPrescribeRx={(appointment: DashboardActionPayload) => go('prescribe', {
              patientId: appointment?.patientId || appointment?.patient?.id || '',
              customerId: appointment?.patient?.customerId || '',
              patientName: appointment?.patient?.name || '',
              patientPhone: appointment?.patient?.phone || '',
              trackKey: appointment?.trackKey || 'weight-loss',
              consultationId: appointment?.id || '',
              consultationSource: 'RX',
              prescriptionMode: 'issue',
              orderMode: appointment?.orderMode || '',
            })}
            onPrescribeQuickWlp={(appointment: DashboardActionPayload) => go('prescribe', {
              patientId: appointment?.patient?.id || appointment?.patientId || '',
              customerId: appointment?.patient?.customerId || '',
              consultationId: appointment?.id || '',
              consultationSource: 'QUICKWLP',
              quickWlpLeadId: appointment?.quickWlpLeadId || appointment?.patientId || '',
              quickWlpName: appointment?.patient?.name || '',
              quickWlpPhone: appointment?.patient?.phone || '',
              quickWlpWhatsapp: appointment?.patient?.whatsapp || '',
              quickWlpEmail: appointment?.patient?.email || '',
              quickWlpDoctorId: appointment?.doctorId || DOCTOR_ID,
              quickWlpTrackKey: appointment?.trackKey || appointment?.track_key || 'weight-loss',
              quickWlpSellerId: appointment?.b2bPartnerId || appointment?.b2b_partner_id || '',
              quickWlpSellerName: appointment?.b2bPartnerName || appointment?.b2b_partner_name || '',
              quickWlpPromoCode: appointment?.b2bPromoCode || appointment?.b2b_promo_code || '',
              prescriptionMode: 'quickwlp',
              orderMode: appointment?.orderMode || '',
            })}
          />
        )}
        {route === 'patients' && (
          <PatientsView
            initialPatientId={routeContext.patientId}
            initialCustomerId={routeContext.customerId}
            onMessage={(id: string, customerId?: string) => go('patient-hub', { patientId: id, customerId: customerId || '', hubMode: 'all' })}
            onPrescribe={(id: string, customerId?: string, trackKey?: string, prescriptionMode?: string, orderMode?: string, consultationId?: string, consultationSource?: string) => go('prescribe', { patientId: id, customerId: customerId || '', trackKey: trackKey || '', prescriptionMode: prescriptionMode || 'issue', orderMode: orderMode || '', consultationId: consultationId || '', consultationSource: consultationSource || '' })}
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
            onPrescribe={(id: string, trackKey?: string, customerId?: string, prescriptionMode?: string, orderMode?: string, consultationId?: string, consultationSource?: string) => go('prescribe', { patientId: id || '', trackKey: trackKey || '', customerId: customerId || '', prescriptionMode: prescriptionMode || 'issue', orderMode: orderMode || '', consultationId: consultationId || '', consultationSource: consultationSource || '' })}
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
            initialConsultationId={routeContext.consultationId}
            initialConsultationSource={routeContext.consultationSource}
            initialRefillRequestId={routeContext.refillRequestId}
            initialPrescriptionMode={routeContext.prescriptionMode}
            initialOrderMode={routeContext.orderMode}
            initialQuickWlpLeadId={routeContext.quickWlpLeadId}
            initialQuickWlpName={routeContext.quickWlpName}
            initialQuickWlpPhone={routeContext.quickWlpPhone}
            initialQuickWlpWhatsapp={routeContext.quickWlpWhatsapp}
            initialQuickWlpEmail={routeContext.quickWlpEmail}
            initialQuickWlpDoctorId={routeContext.quickWlpDoctorId}
            initialQuickWlpTrackKey={routeContext.quickWlpTrackKey}
            initialQuickWlpSellerId={routeContext.quickWlpSellerId}
            initialQuickWlpSellerName={routeContext.quickWlpSellerName}
            initialQuickWlpPromoCode={routeContext.quickWlpPromoCode}
            initialAmendSource={routeContext.amendSource}
            initialAmendId={routeContext.amendId}
            initialAmendItems={routeContext.amendItems}
            initialPatientName={routeContext.patientName}
            initialPatientPhone={routeContext.patientPhone}
            originLabel={routeContext.originLabel}
            onBack={() => go(routeContext.originRoute || 'appointments')}
            onSent={() => undefined}
          />
        )}
      </main>
    </div>
  )
}

export default App
