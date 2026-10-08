import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE, DOCTOR_ID } from '../config.js'
import { fetchJson } from './authFetch.js'
import type { InboxData } from './clinicalInboxData.js'
import { loadClinicalInbox, removeResolvedInboxTask } from './clinicalInboxData.js'

export function useClinicalInbox() {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<InboxData & { loading: boolean; error: string }>({ tasks: [], counts: undefined, loading: true, error: '' })
  const refreshing = useRef(false)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    const focused = () => { if (!refreshing.current) refresh() }
    const visible = () => { if (document.visibilityState === 'visible') focused() }
    window.addEventListener('doctor-data-changed', refresh)
    window.addEventListener('focus', focused)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('doctor-data-changed', refresh)
      window.removeEventListener('focus', focused)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [refresh])
  useEffect(() => {
    const controller = new AbortController()
    refreshing.current = true
    setState(previous => ({ ...previous, loading: true, error: '' }))
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)])
    loadClinicalInbox(fetchJson, API_BASE, DOCTOR_ID, signal, data => {
      if (!controller.signal.aborted) setState(previous => previous.counts ? previous : { ...data, loading: true, error: '' })
    }).then(data => {
      if (!controller.signal.aborted) setState({ ...data, loading: false, error: '' })
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: error.message || 'Could not refresh inbox' }))
    }).finally(() => {
      if (!controller.signal.aborted) refreshing.current = false
    })
    return () => controller.abort()
  }, [revision])
  const resolveTask = useCallback((taskId: string) => {
    setState(previous => removeResolvedInboxTask(previous, taskId))
    refresh()
  }, [refresh])
  return { ...state, refresh, resolveTask }
}
