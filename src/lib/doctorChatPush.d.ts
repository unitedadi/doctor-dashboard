export type DoctorChatPushState = {
  status: 'loading' | 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on' | 'error'
  label: string
  publicKey?: string
}

export type DoctorChatPushRecovery = {
  title: string
  detail: string
  action: string
}

export function doctorChatPushRecovery(state: DoctorChatPushState['status']): DoctorChatPushRecovery | null

export function readDoctorChatPushState(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
export function enableDoctorChatPush(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
export function disableDoctorChatPush(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
