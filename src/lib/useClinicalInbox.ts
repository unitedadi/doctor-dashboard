import { useCallback, useEffect, useState } from 'react'
import { API_BASE, DOCTOR_ID } from '../config.js'
import { fetchJson } from './authFetch.js'
import { loadClinicalInbox } from './clinicalInboxData.js'

export function useClinicalInbox(route: string) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ tasks: any[]; counts: Record<string, number> | null; loading: boolean; error: string }>({ tasks: [], counts: null, loading: true, error: '' })
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('doctor-data-changed', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('doctor-data-changed', refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [refresh])
  useEffect(() => {
    const controller = new AbortController()
    setState(previous => ({ ...previous, loading: true, error: '' }))
    loadClinicalInbox(fetchJson, API_BASE, DOCTOR_ID, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ tasks: data.tasks, counts: data.counts ?? null, loading: false, error: '' })
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: error.message || 'Could not refresh inbox' }))
    })
    return () => controller.abort()
  }, [route, revision])
  return { ...state, refresh }
}
