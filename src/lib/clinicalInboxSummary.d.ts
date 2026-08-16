export type ClinicalInboxSummary = {
  total: number
  needsReply: number
  refillReview: number
}

export function clinicalTaskCategory(task: unknown): string
export function isDoctorClinicalTask(task: unknown): boolean
export function summarizeClinicalInboxTasks(tasks: unknown): ClinicalInboxSummary
