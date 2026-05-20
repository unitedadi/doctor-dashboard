import { useState } from 'react'
import './data.js'
import './components/shell.jsx'
import './components/appointments.jsx'
import './components/patients.jsx'
import './components/chat.jsx'
import './components/prescribe.jsx'
import './styles/dashboard.css'

function App() {
  const [route, setRoute] = useState('appointments')
  const [routeContext, setRouteContext] = useState<Record<string, string>>({})

  const Sidebar = window.DD_UI.Sidebar
  const AppointmentsView = window.DD_AppointmentsView
  const PatientsView = window.DD_PatientsView
  const ChatView = window.DD_ChatView
  const PrescribeView = window.DD_PrescribeView

  const go = (id: string, ctx: Record<string, string> = {}) => {
    setRoute(id)
    setRouteContext(ctx)
    window.scrollTo(0, 0)
  }

  const unreadChats = window.DD_DATA.CHATS.reduce(
    (sum: number, chat: { unread: number }) => sum + chat.unread,
    0,
  )

  return (
    <div className="app" data-screen-label={route}>
      <Sidebar active={route} onNav={(id: string) => go(id)} unreadChats={unreadChats} />
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
            onMessage={(id: string) => go('chat', { patientId: id })}
            onPrescribe={(id: string) => go('prescribe', { patientId: id })}
          />
        )}
        {route === 'chat' && (
          <ChatView
            initialPatientId={routeContext.patientId}
            onOpenPatient={(id: string) => go('patients', { patientId: id })}
          />
        )}
        {route === 'prescribe' && (
          <PrescribeView
            initialPatientId={routeContext.patientId}
            onSent={() => undefined}
          />
        )}
      </main>
    </div>
  )
}

export default App
