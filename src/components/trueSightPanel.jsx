import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";
import { formatDubaiDate, trueSightConversationEntries, trueSightSummaryLayers } from "../lib/truesightDoctorView.js";

/* global React */
const { useEffect: useEffectTS, useState: useStateTS } = React;

const AI_LABEL = "TrueSight is DarDoc's AI companion, not a clinician.";

function trueSightUrl(patientId, view, extra = {}) {
  const params = new URLSearchParams({ doctor_id: DOCTOR_ID, ...extra });
  return `${API_BASE}/doctor/truesight/patients/${encodeURIComponent(patientId)}/${view}?${params.toString()}`;
}

// Renders nothing until the backend says TrueSight has something for this patient and the
// doctor view is switched on; a patient outside the doctor's care is a 404 and hides it too.
function useTrueSight(patientId, view, extra) {
  const [state, setState] = useStateTS({ loading: true, data: null });
  const key = JSON.stringify(extra || {});
  useEffectTS(() => {
    if (!patientId) return undefined;
    let cancelled = false;
    setState({ loading: true, data: null });
    fetchJson(trueSightUrl(patientId, view, JSON.parse(key)))
      .then((data) => { if (!cancelled) setState({ loading: false, data }); })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null }); });
    return () => { cancelled = true; };
  }, [patientId, view, key]);
  return state;
}

function SectionShell({ title, subtitle, children, className = "" }) {
  return (
    <section className={`patient-chart-section truesight-section ${className}`.trim()}>
      <div className="patient-chart-section-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function TrueSightSummaryCard({ patientId, compact = false }) {
  const { data } = useTrueSight(patientId, "summary");
  const layers = trueSightSummaryLayers(data);
  if (!layers) return null;
  const shown = compact ? layers.filter((layer) => layer.key === "measure" || layer.key === "follow") : layers;
  return (
    <SectionShell
      title="What TrueSight holds"
      subtitle={`${data.label || AI_LABEL} Counted from the patient's records, as of ${formatDubaiDate(data.as_of, true)}.`}
      className={compact ? "truesight-summary compact" : "truesight-summary"}
    >
      <div className="truesight-layers">
        {shown.map((layer) => (
          <div className="truesight-layer" key={layer.key}>
            <h4>{layer.title}</h4>
            {layer.rows.length ? (
              <dl>
                {layer.rows.slice(0, compact ? 3 : 8).map((row, index) => (
                  <div key={`${layer.key}-${index}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="truesight-layer-empty">{layer.empty || "Nothing yet."}</p>
            )}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function TrueSightConversation({ patientId }) {
  const [before, setBefore] = useStateTS(null);
  const [older, setOlder] = useStateTS([]);
  const { data, loading } = useTrueSight(patientId, "conversation", { limit: "20" });
  const [nextBefore, setNextBefore] = useStateTS(null);
  const [loadingOlder, setLoadingOlder] = useStateTS(false);

  useEffectTS(() => {
    setOlder([]);
    setBefore(null);
    setNextBefore(data?.next_before || null);
  }, [data]);

  useEffectTS(() => {
    if (!before) return undefined;
    let cancelled = false;
    setLoadingOlder(true);
    fetchJson(trueSightUrl(patientId, "conversation", { limit: "20", before }))
      .then((page) => {
        if (cancelled) return;
        setOlder((current) => [...current, ...(page.items || [])]);
        setNextBefore(page.next_before || null);
      })
      .catch(() => { if (!cancelled) setNextBefore(null); })
      .finally(() => { if (!cancelled) setLoadingOlder(false); });
    return () => { cancelled = true; };
  }, [before, patientId]);

  if (loading || !data?.available) return null;
  const entries = trueSightConversationEntries([...(data.items || []), ...older]);
  return (
    <SectionShell
      title="TrueSight conversation"
      subtitle={`What TrueSight sent this patient and what they answered, newest first. ${data.label || AI_LABEL}`}
    >
      {entries.length ? (
        <ol className="truesight-thread">
          {entries.map((entry) => (
            <li key={`${entry.side}-${entry.id}`} className={`truesight-entry ${entry.side}`}>
              <div className="truesight-entry-head">
                <strong>{entry.side === "truesight" ? "TrueSight" : "Patient"}</strong>
                <time>{formatDubaiDate(entry.at, true)}</time>
              </div>
              {entry.title ? <p className="truesight-entry-title">{entry.title}</p> : null}
              {entry.body ? <p>{entry.body}</p> : null}
              {entry.meta ? <span className="truesight-entry-meta">{entry.meta}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="inline-empty">No TrueSight conversation with this patient yet.</div>
      )}
      {nextBefore ? (
        <button type="button" className="clinical-secondary-action truesight-older" disabled={loadingOlder} onClick={() => setBefore(nextBefore)}>
          {loadingOlder ? "Loading…" : "Show older"}
        </button>
      ) : null}
    </SectionShell>
  );
}
