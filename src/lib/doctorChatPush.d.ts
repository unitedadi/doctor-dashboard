export type DoctorChatPushState = {
  status: 'loading' | 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on' | 'error'
  label: string
  publicKey?: string
}

export function readDoctorChatPushState(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
export function enableDoctorChatPush(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
export function disableDoctorChatPush(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
