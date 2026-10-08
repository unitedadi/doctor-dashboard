export type ClinicalInboxSummary = {
  needsOutcome: number
  purchaseReview: number
  purchaseIntake: number
  total: number
  needsPrescription: number
  needsReply: number
  refillReview: number
}

export function clinicalTaskCategory(task: unknown): string
export function isDoctorClinicalTask(task: unknown): boolean
export function summarizeClinicalInboxTasks(tasks: unknown, counts?: Record<string, number> | null): ClinicalInboxSummary
