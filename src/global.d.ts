import type { ComponentType } from 'react'

declare module '*.jsx'

declare global {
  interface Window {
    DD_DATA: {
      DOCTOR: {
        name: string
        title: string
        initials: string
        license?: string
        accountId?: string
        doctorId?: string
      }
      CHATS: Array<{ unread: number }>
    }
    DD_UI: {
      Sidebar: ComponentType<Record<string, unknown>>
    }
    DD_ClinicalInboxView: ComponentType<Record<string, unknown>>
    DD_AppointmentsView: ComponentType<Record<string, unknown>>
    DD_PatientsView: ComponentType<Record<string, unknown>>
    DD_ChatView: ComponentType<Record<string, unknown>>
    DD_PrescribeView: ComponentType<Record<string, unknown>>
    DD_RefillsView: ComponentType<Record<string, unknown>>
    DD_QuickWlpView: ComponentType<Record<string, unknown>>
  }
}

export {}
