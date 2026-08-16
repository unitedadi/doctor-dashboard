export function unlockDoctorAlertSound(options?: { AudioContextClass?: typeof AudioContext | null }): Promise<boolean>
export function playDoctorAlertSound(options?: { context?: AudioContext | null }): boolean
export function createDoctorAlertMessageHandler(options?: {
  play?: (type: 'appointment.new' | 'message.new' | 'refill_request.new') => unknown
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  seen?: Set<string>
}): (event: MessageEvent) => boolean
export function startDoctorAlertSound(): () => void
