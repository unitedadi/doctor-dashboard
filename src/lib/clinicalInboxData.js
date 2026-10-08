export const INBOX_CATEGORIES = ['needs_prescription','needs_outcome','message_needs_response','reissue','refill_review','lab_results_ready','purchase_review','purchase_intake'];

// Load every page before publishing a new snapshot. A failed page must never
// replace a correct count with a partial list.
export async function loadClinicalInbox(fetcher, apiBase, doctorId, signal) {
  const tasks = [];
  let first;
  let offset = 0;
  do {
    const params = new URLSearchParams({ doctor_id: doctorId, lookback_days: '90', limit: '100', offset: String(offset), categories: INBOX_CATEGORIES.join(',') });
    const page = await fetcher(`${apiBase}/doctor/clinical-inbox?${params}`, { signal });
    first ??= page;
    tasks.push(...(page.tasks || []));
    if (!page.has_more) break;
    if (!page.tasks?.length) throw new Error('Incomplete inbox page. Please refresh.');
    offset += page.tasks.length;
  } while (true);
  return { ...first, tasks: [...new Map(tasks.map(task => [task.id, task])).values()] };
}
