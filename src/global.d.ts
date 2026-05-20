import type { ComponentType } from 'react'

declare module '*.jsx'

declare global {
  interface Window {
    DD_DATA: {
      CHATS: Array<{ unread: number }>
    }
    DD_UI: {
      Sidebar: ComponentType<Record<string, unknown>>
    }
    DD_AppointmentsView: ComponentType<Record<string, unknown>>
    DD_PatientsView: ComponentType<Record<string, unknown>>
    DD_ChatView: ComponentType<Record<string, unknown>>
    DD_PrescribeView: ComponentType<Record<string, unknown>>
  }
}

export {}
