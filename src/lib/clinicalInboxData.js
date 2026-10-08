export const INBOX_CATEGORIES = ['prescription_reconciliation','needs_prescription','needs_outcome','message_needs_response','reissue','refill_review','lab_results_ready','purchase_review','purchase_intake'];

// Publish available tasks while later pages load. Counts always come from the
// complete server totals, never from the number of tasks loaded so far.
export async function loadClinicalInbox(fetcher, apiBase, doctorId, signal, onPage) {
  const tasks = [];
  let first;
  let offset = 0;
  do {
    const params = new URLSearchParams({ doctor_id: doctorId, lookback_days: '90', limit: '200', offset: String(offset), categories: INBOX_CATEGORIES.join(',') });
    const page = await fetcher(`${apiBase}/doctor/clinical-inbox?${params}`, { signal });
    first ??= page;
    tasks.push(...(page.tasks || []));
    onPage?.({ ...first, tasks: [...new Map(tasks.map(task => [task.id, task])).values()] });
    if (!page.has_more) break;
    if (!page.tasks?.length) throw new Error('Incomplete inbox page. Please refresh.');
    offset += page.tasks.length;
  } while (true);
  return { ...first, tasks: [...new Map(tasks.map(task => [task.id, task])).values()] };
}

// Called only after the server confirms the task was resolved.
export function removeResolvedInboxTask(snapshot, taskId) {
  const task = snapshot.tasks.find(item => item.id === taskId);
  if (!task) return snapshot;
  const decrement = counts => counts ? { ...counts, [task.category]: Math.max(0, (counts[task.category] || 0) - 1) } : counts;
  return { ...snapshot, tasks: snapshot.tasks.filter(item => item.id !== taskId),
    counts: decrement(snapshot.counts),
    current_counts: task.inbox_queue === 'earlier' ? snapshot.current_counts : decrement(snapshot.current_counts),
    earlier_counts: task.inbox_queue === 'earlier' ? decrement(snapshot.earlier_counts) : snapshot.earlier_counts
  };
}
