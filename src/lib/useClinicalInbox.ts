import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE, DOCTOR_ID } from '../config.js'
import { fetchJson } from './authFetch.js'
import { loadClinicalInbox } from './clinicalInboxData.js'

export function useClinicalInbox() {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ tasks: any[]; counts: Record<string, number> | null; loading: boolean; error: string }>({ tasks: [], counts: null, loading: true, error: '' })
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
      if (!controller.signal.aborted) setState(previous => previous.counts ? previous : { tasks: data.tasks, counts: data.counts ?? null, loading: true, error: '' })
    }).then(data => {
      if (!controller.signal.aborted) setState({ tasks: data.tasks, counts: data.counts ?? null, loading: false, error: '' })
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: error.message || 'Could not refresh inbox' }))
    }).finally(() => {
      if (!controller.signal.aborted) refreshing.current = false
    })
    return () => controller.abort()
  }, [revision])
  return { ...state, refresh }
}
