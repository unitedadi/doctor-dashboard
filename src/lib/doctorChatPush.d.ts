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

export type DoctorChatPushFailure = {
  code: string
  stage: string
  browserErrorName: string
  repairAttempted: boolean
  label: string
}

export function doctorChatPushRecovery(state: DoctorChatPushState['status']): DoctorChatPushRecovery | null
export function doctorChatPushFailure(error: unknown): DoctorChatPushFailure

export function subscribeDoctorChatPush(params: {
  publicKey: string
  register?: () => Promise<ServiceWorkerRegistration>
  findRegistration?: () => Promise<ServiceWorkerRegistration | undefined>
  keyFactory?: (value: string) => BufferSource
  expectedWorkerPath?: string
}): Promise<PushSubscription>

export function readDoctorChatPushState(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
export function enableDoctorChatPush(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
export function disableDoctorChatPush(params: { apiBase: string; doctorId: string }): Promise<DoctorChatPushState>
