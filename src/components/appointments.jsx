import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";

/* global React */
const { useEffect: useEffectA, useMemo: useMemoA, useState: useStateA } = React;

function dubaiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatScreenDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatSectionDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function addDays(date, amount) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return next.toISOString().slice(0, 10);
}

function isCompletable(status) {
  return !["completed", "cancelled", "canceled", "no_show"].includes(String(status || "").toLowerCase());
}

function toTitle(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(minutes) {
  if (!minutes) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function mapAppointment(item) {
  const patient = item.patient || {};
  return {
    id: item.id,
    patientId: item.patient_id,
    time: item.time,
    duration: item.duration_minutes,
    service: item.service_name,
    type: item.visit_type === "video" ? "Video call" : toTitle(item.visit_type),
    location: item.location_label,
    status: item.status,
    patient: {
      id: patient.id || item.patient_id,
      name: patient.name || "Unknown patient",
      initials: patient.initials || "P",
      age: patient.age,
      sex: toTitle(patient.sex),
      chat: patient.chat || item.chat || { available: false, unavailable_reason: "chat_locked" },
    },
    chat: item.chat || patient.chat || { available: false, unavailable_reason: "chat_locked" },
    date: item.date,
    meetingLink: item.meeting_link,
    trackKey: item.track_key,
  };
}

function AppointmentsView({ onOpenPatient, onOpenChat }) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const currentDate = useMemoA(() => dubaiToday(), []);
  const [selectedDate, setSelectedDate] = useStateA(currentDate);
  const [today, setToday] = useStateA([]);
  const [week, setWeek] = useStateA([]);
  const [selectedId, setSelectedId] = useStateA(null);
  const [loading, setLoading] = useStateA(true);
  const [error, setError] = useStateA("");
  const [joiningId, setJoiningId] = useStateA(null);
  const [callingId, setCallingId] = useStateA(null);
  const [callConfirm, setCallConfirm] = useStateA(null);
  const [completingId, setCompletingId] = useStateA(null);
  const [completeConfirm, setCompleteConfirm] = useStateA(null);
  const [callToast, setCallToast] = useStateA("");

  const loadAppointments = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/doctor/dashboard/appointments?date=${selectedDate}&doctor_id=${encodeURIComponent(DOCTOR_ID)}`);
      if (!response.ok) throw new Error(`appointments_request_failed_${response.status}`);
      const data = await response.json();
      const nextToday = (data.today || []).map(mapAppointment).sort((a, b) => a.time.localeCompare(b.time));
      const nextWeek = (data.week || []).map(mapAppointment).sort((a, b) => {
        const dateCompare = String(a.date).localeCompare(String(b.date));
        return dateCompare || a.time.localeCompare(b.time);
      });

      setToday(nextToday);
      setWeek(nextWeek);
      setSelectedId((current) => {
        const all = [...nextToday, ...nextWeek];
        if (current && all.some((appointment) => appointment.id === current)) return current;
        return nextToday.find((appointment) => appointment.status === "upcoming")?.id || nextToday[0]?.id || nextWeek[0]?.id || null;
      });
    } catch {
      setError("Could not load appointments from the dev API.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffectA(() => {
    loadAppointments();
  }, [loadAppointments]);

  const allAppointments = useMemoA(() => [...today, ...week], [today, week]);
  const selected = allAppointments.find((appointment) => appointment.id === selectedId) || null;
  const selectedPatient = selected?.patient || null;
  const canCompleteSelected = selected && isCompletable(selected.status);
  const upcomingCount = today.filter((appointment) => appointment.status === "upcoming").length;
  const videoCount = today.filter((appointment) => appointment.type === "Video call").length;
  const bookedMinutes = today.reduce((sum, appointment) => sum + (appointment.duration || 0), 0);
  const activeAppointmentId = today.find((appointment) => appointment.status === "upcoming")?.id || today[0]?.id;
  const dateStr = formatScreenDate(selectedDate);
  const sectionDate = formatSectionDate(selectedDate);
  const isToday = selectedDate === currentDate;
  const joinAppointment = async (appointment, event) => {
    event.stopPropagation();
    setJoiningId(appointment.id);
    try {
      const response = await fetch(`${API_BASE}/doctor/appointments/${appointment.id}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.session_url) throw new Error(data.error || data.status || "session_unavailable");
      window.open(data.session_url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open the appointment session.");
    } finally {
      setJoiningId(null);
    }
  };
  const callPatient = async () => {
    if (!callConfirm) return;
    const appointment = callConfirm;
    setCallingId(appointment.id);
    setCallConfirm(null);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/doctor/appointments/${appointment.id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: DOCTOR_ID }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "call_failed");
      setCallToast(`Calling ${appointment.patient.name}`);
      setTimeout(() => setCallToast(""), 2400);
    } catch {
      setError("Could not call the patient for this appointment.");
    } finally {
      setCallingId(null);
    }
  };
  const completeConsultation = async () => {
    if (!completeConfirm) return;
    const appointment = completeConfirm;
    setCompletingId(appointment.id);
    setCompleteConfirm(null);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/doctor/appointments/${appointment.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: DOCTOR_ID,
          completion_notes_json: {
            note: "Consultation completed from doctor dashboard.",
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "complete_failed");
      setCallToast(`Completed ${appointment.patient.name}'s consultation`);
      setTimeout(() => setCallToast(""), 2400);
      await loadAppointments();
    } catch {
      setError("Could not complete this consultation.");
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <>
      <Topbar
        title={isToday ? "Today's clinic" : "Clinic schedule"}
        subtitle={dateStr}
      />
      <div className="apt-layout">
        <div className="apt-main dd-scroll">
          <div className="today-stat-row">
            <div className="stat"><div className="v">{loading ? "..." : today.length}</div><div className="l">Appointments</div></div>
            <div className="stat"><div className="v">{loading ? "..." : upcomingCount}</div><div className="l">Upcoming</div></div>
            <div className="stat"><div className="v">{loading ? "..." : videoCount}</div><div className="l">Video visits</div></div>
            <div className="stat"><div className="v">{loading ? "..." : formatDuration(bookedMinutes)}</div><div className="l">Booked time</div></div>
          </div>

          <div className="section-hdr">
            <div className="label apt-date-label">{sectionDate}</div>
            <div className="apt-date-actions" aria-label="Appointment date navigation">
              <button type="button" className="btn-icon" onClick={() => setSelectedDate((date) => addDays(date, -1))} aria-label="Previous day" title="Previous day">
                {I.chevronLeft}
              </button>
              <button type="button" className="apt-today-button" onClick={() => setSelectedDate(currentDate)} disabled={isToday}>
                Today
              </button>
              <button type="button" className="btn-icon" onClick={() => setSelectedDate((date) => addDays(date, 1))} aria-label="Next day" title="Next day">
                {I.chevronRight}
              </button>
            </div>
          </div>

          {error && (
            <div className="api-state">
              <span>{error}</span>
              <button type="button" className="btn-ghost" onClick={loadAppointments}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="apt-loading">
              <div />
              <div />
              <div />
            </div>
          ) : today.length === 0 ? (
            <div className="empty-state apt-empty">No appointments for this date.</div>
          ) : (
            <div className="timeline">
              {today.map((a) => {
                const isNow = a.id === activeAppointmentId;
                const isSel = a.id === selectedId;
                return (
                  <div key={a.id} className={"tl-row" + (isNow ? " now" : "")}>
                    <div className="time">{a.time}</div>
                    <div className="dot-mark"></div>
                    <div className={"apt-card" + (isSel ? " selected" : "") + (isNow && !isSel ? " now-card" : "")}
                         onClick={() => setSelectedId(a.id)}>
                      <Avatar initials={a.patient.initials} name={a.patient.name} size="md" />
                      <div style={{ minWidth: 0 }}>
                        <div className="apt-name">{a.patient.name}</div>
                        <div className="apt-meta">
                          <span>{a.duration} min</span>
                          <span className="dot-sep" />
                          <span>{a.location}</span>
                          {a.status === "completed" && <><span className="dot-sep" /><span>Completed</span></>}
                        </div>
                      </div>
                      <div className="apt-actions">
                        <span className="svc-tag">{a.service}</span>
                        {a.meetingLink && a.status === "upcoming" && (
                          <button className="btn-ghost apt-join-btn" onClick={(event) => joinAppointment(a, event)} disabled={joiningId === a.id}>
                            {I.video}<span>{joiningId === a.id ? "Opening" : "Join"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="apt-side dd-scroll">
          {loading ? (
            <div className="empty-state">Loading appointments...</div>
          ) : selected && selectedPatient ? (
            <div className="fade-in" key={selected.id}>
              <div className="section-hdr"><div className="label">Appointment</div></div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
                <Avatar initials={selectedPatient.initials} name={selectedPatient.name} size="lg" />
                <div>
                  <div style={{ font: "400 18px/1.2 var(--dd-font)", color: "var(--dd-text-primary)" }}>{selectedPatient.name}</div>
                  <div style={{ font: "400 13px/1.4 var(--dd-font)", color: "var(--dd-text-secondary)", marginTop: 4 }}>
                    {[selectedPatient.age, selectedPatient.sex].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>

              <div className="kv-row"><div className="k">Service</div><div className="v">{selected.service}</div></div>
              <div className="kv-row"><div className="k">Time</div><div className="v">{selected.time} · {selected.duration} min</div></div>
              <div className="kv-row"><div className="k">Mode</div><div className="v">{selected.type}</div></div>
              <div className="kv-row"><div className="k">Location</div><div className="v">{selected.location}</div></div>
              <div className="kv-row"><div className="k">Status</div><div className="v" style={{ textTransform: "capitalize" }}>{selected.status}</div></div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 22 }}>
                {selected.meetingLink && selected.status === "upcoming" && (
                  <>
                    <button className="dd-btn-block" onClick={(event) => joinAppointment(selected, event)} disabled={joiningId === selected.id}>
                      {joiningId === selected.id ? "Opening session..." : "Join video consultation"}
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => setCallConfirm(selected)}
                      disabled={callingId === selected.id}
                    >
                      {I.phone}<span>{callingId === selected.id ? "Calling..." : "Call Patient"}</span>
                    </button>
                  </>
                )}
                {canCompleteSelected && (
                  <button
                    className="btn-ghost"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => setCompleteConfirm(selected)}
                    disabled={completingId === selected.id}
                  >
                    {I.check}<span>{completingId === selected.id ? "Completing..." : "Complete Consultation"}</span>
                  </button>
                )}
                <button className="btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenPatient(selectedPatient.id)}>Open patient chart</button>
                <button
                  className="btn-ghost"
                  style={{ width: "100%", justifyContent: "center", opacity: selected.chat?.available ? 1 : 0.45, cursor: selected.chat?.available ? "pointer" : "not-allowed" }}
                  onClick={() => onOpenChat(selectedPatient.id)}
                  disabled={!selected.chat?.available}
                  title={selected.chat?.available ? `Message ${selectedPatient.name}` : "Chat is locked for this patient"}
                >
                  {I.message}<span>Message {selectedPatient.name.split(" ")[0]}</span>
                </button>
              </div>

            </div>
          ) : <div className="empty-state">Select an appointment</div>}
        </div>
      </div>
      {callConfirm && (
        <div className="confirm-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="call-patient-title">
            <h2 id="call-patient-title">Call patient?</h2>
            <p>Make sure you have joined the meeting first before calling the patient.</p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setCallConfirm(null)}>Cancel</button>
              <button className="btn-primary" onClick={callPatient}>{I.phone}<span>Call Patient</span></button>
            </div>
          </div>
        </div>
      )}
      {completeConfirm && (
        <div className="confirm-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-consultation-title">
            <h2 id="complete-consultation-title">Complete consultation?</h2>
            <p>Only mark consultation as completed when you have finished the video call with the customer.</p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setCompleteConfirm(null)}>Cancel</button>
              <button className="btn-primary" onClick={completeConsultation}>{I.check}<span>Complete Consultation</span></button>
            </div>
          </div>
        </div>
      )}
      {callToast && (
        <div className="toast">
          {I.phone}<span>{callToast}</span>
        </div>
      )}
    </>
  );
}

window.DD_AppointmentsView = AppointmentsView;
