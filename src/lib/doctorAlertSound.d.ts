export function unlockDoctorAlertSound(options?: { AudioContextClass?: typeof AudioContext | null }): Promise<boolean>
export function playDoctorAlertSound(options?: { context?: AudioContext | null }): boolean
export function createDoctorTabAttention(options?: {
  documentTarget?: Pick<Document, 'title' | 'hidden' | 'hasFocus' | 'querySelector' | 'addEventListener' | 'removeEventListener'>
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  title?: string
  attentionTitle?: string
  favicon?: string
  attentionFavicon?: string
}): { show: () => boolean; clear: () => boolean; stop: () => void }
export function createDoctorAlertMessageHandler(options?: {
  play?: (type: 'appointment.new' | 'message.new' | 'refill_request.new') => unknown
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  seen?: Set<string>
  accepted?: Set<string>
  onAccepted?: (alert: { source: string; event_id: string; type: string }) => unknown
}): (event: MessageEvent) => boolean
export function startDoctorAlertSound(): () => void
