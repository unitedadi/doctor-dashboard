import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { StreamChat } from "stream-chat";
import {
  Channel,
  Chat,
  MessageComposer,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";

/* global React */
const { useEffect: useEffectC, useMemo: useMemoC, useState: useStateC } = React;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || `request_failed_${response.status}`);
  return data;
}

function fetchChatToken() {
  return fetchJson(`${API_BASE}/doctor/chat/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctor_id: DOCTOR_ID }),
  });
}

function lastMessagePreview(channel) {
  const messages = channel?.state?.messages || [];
  const last = messages[messages.length - 1];
  if (!last) return "No messages yet";
  if (last.text) return last.text;
  if (last.attachments?.length) return "Attachment";
  return "Message";
}

function lastMessageTime(channel) {
  const messages = channel?.state?.messages || [];
  const last = messages[messages.length - 1];
  if (!last?.created_at) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(new Date(last.created_at));
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapPatientForChannel(item) {
  return {
    id: item.id,
    customer_id: item.customer_id,
    name: item.name || "Unknown patient",
    initials: item.initials || "P",
    age: item.age,
    sex: titleCase(item.sex),
    conditions: Array.isArray(item.conditions) ? item.conditions : [],
    allergies: Array.isArray(item.allergies) ? item.allergies : [],
    medications: Array.isArray(item.medications) ? item.medications : [],
  };
}

function ChatView({ initialPatientId, onOpenPatient }) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const [client, setClient] = useStateC(null);
  const [channels, setChannels] = useStateC([]);
  const [activeId, setActiveId] = useStateC(null);
  const [activeStreamChannel, setActiveStreamChannel] = useStateC(null);
  const [activeChannelLoading, setActiveChannelLoading] = useStateC(false);
  const [activeChannelError, setActiveChannelError] = useStateC("");
  const [activeChannelRetry, setActiveChannelRetry] = useStateC(0);
  const [patientContext, setPatientContext] = useStateC(null);
  const [search, setSearch] = useStateC("");
  const [loading, setLoading] = useStateC(true);
  const [error, setError] = useStateC("");

  const loadChat = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await fetchChatToken();
      const channelPayload = await fetchJson(`${API_BASE}/doctor/chat/channels?doctor_id=${DOCTOR_ID}`);
      const streamClient = new StreamChat(token.api_key, { timeout: 15000 });
      if (streamClient.userID) {
        await streamClient.disconnectUser();
      }

      let currentUserToken = token.user_token;
      const tokenProvider = async () => {
        if (currentUserToken) {
          const nextToken = currentUserToken;
          currentUserToken = "";
          return nextToken;
        }
        const refreshed = await fetchChatToken();
        return refreshed.user_token;
      };

      await streamClient.connectUser({ id: token.user_id, name: token.user.name }, tokenProvider);

      let channelEntries = channelPayload.channels || [];
      if (initialPatientId && !channelEntries.some((entry) => entry.patient_id === initialPatientId)) {
        const patientsPayload = await fetchJson(`${API_BASE}/doctor/dashboard/patients?doctor_id=${DOCTOR_ID}`);
        const patient = (patientsPayload.patients || []).find((item) => item.id === initialPatientId);
        if (patient?.chat?.available && patient.customer_id) {
          const opened = await fetchJson(`${API_BASE}/doctor/chat/channels`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              doctor_id: DOCTOR_ID,
              patient_id: patient.id,
              customer_id: patient.customer_id,
            }),
          });
          channelEntries = [
            ...channelEntries,
            {
              ...opened,
              patient_id: patient.id,
              customer_id: patient.customer_id,
              patient: mapPatientForChannel(patient),
            },
          ];
        }
      }

      setClient(streamClient);
      setChannels(channelEntries);
      setActiveId((current) => {
        if (initialPatientId) {
          const match = channelEntries.find((item) => item.patient_id === initialPatientId);
          if (match) return match.channel_id;
        }
        if (current && channelEntries.some((item) => item.channel_id === current)) return current;
        return null;
      });
    } catch (err) {
      setError(err.message || "Could not connect GetStream chat.");
    } finally {
      setLoading(false);
    }
  }, [initialPatientId]);

  useEffectC(() => {
    loadChat();
  }, [loadChat]);

  useEffectC(() => {
    if (!initialPatientId) return;
    const match = channels.find((item) => item.patient_id === initialPatientId);
    if (match) setActiveId(match.channel_id);
  }, [channels, initialPatientId]);

  const active = channels.find((item) => item.channel_id === activeId) || null;
  const activePatient = patientContext?.patient || active?.patient || null;

  useEffectC(() => {
    let cancelled = false;
    let watchedChannel = null;

    async function watchActiveChannel() {
      setActiveStreamChannel(null);
      setActiveChannelError("");
      if (!client || !active) return;

      setActiveChannelLoading(true);
      try {
        const streamChannel = client.channel(active.channel_type, active.channel_id);
        watchedChannel = streamChannel;
        await streamChannel.watch();
        if (!cancelled) setActiveStreamChannel(streamChannel);
      } catch (err) {
        if (!cancelled) setActiveChannelError(err.message || "Could not open this conversation.");
      } finally {
        if (!cancelled) setActiveChannelLoading(false);
      }
    }

    watchActiveChannel();
    return () => {
      cancelled = true;
      if (watchedChannel) watchedChannel.stopWatching().catch(() => {});
    };
  }, [client, active, activeChannelRetry]);

  useEffectC(() => {
    let cancelled = false;
    async function loadContext() {
      if (!active?.patient_id) {
        setPatientContext(null);
        return;
      }
      try {
        const data = await fetchJson(`${API_BASE}/doctor/patients/${active.patient_id}/chat-context?doctor_id=${DOCTOR_ID}`);
        if (!cancelled) setPatientContext(data);
      } catch {
        if (!cancelled) setPatientContext({ patient: active.patient, shared_files: [] });
      }
    }
    loadContext();
    return () => { cancelled = true; };
  }, [active]);

  const filteredList = useMemoC(() => {
    const query = search.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter((item) => item.patient.name.toLowerCase().includes(query));
  }, [channels, search]);

  const totalUnread = useMemoC(() => {
    if (!client) return 0;
    return client.user?.total_unread_count || 0;
  }, [client]);

  return (
    <>
      <Topbar
        title="Messages"
        subtitle={loading ? "Connecting to GetStream" : `${totalUnread} unread · powered by GetStream`}
      />
      <div className="chat-layout">
        <div className="chat-list dd-scroll">
          <div className="search" style={{ width: "100%", marginBottom: 12 }}>
            {I.search}
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages" />
          </div>

          {error && (
            <div className="api-state chat-api-state">
              <span>{error}</span>
              <button type="button" className="btn-ghost" onClick={loadChat}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="patient-loading"><div /><div /><div /></div>
          ) : filteredList.map((item) => {
            const p = item.patient;
            const isActive = item.channel_id === activeId;
            const listChannel = isActive ? activeStreamChannel : null;
            const unread = listChannel?.countUnread?.() || 0;
            return (
              <div key={item.channel_id} className={"chat-list-item" + (isActive ? " active" : "")} onClick={() => setActiveId(item.channel_id)}>
                <Avatar initials={p.initials} name={p.name} size="md" online />
                <div style={{ minWidth: 0 }}>
                  <div className="top">
                    <span className="nm">{p.name}</span>
                    <span className="tm">{lastMessageTime(listChannel)}</span>
                  </div>
                  <div className="pv">{isActive && activeChannelLoading ? "Opening conversation..." : lastMessagePreview(listChannel)}</div>
                </div>
                {unread > 0 ? <span className="badge">{unread}</span> : <span style={{ width: 20 }} />}
              </div>
            );
          })}
          {!loading && filteredList.length === 0 && <div className="empty-state chat-empty">No active Rx chat channels.</div>}
        </div>

        {activeChannelError ? (
          <div className="api-state chat-api-state">
            <span>{activeChannelError}</span>
            <button type="button" className="btn-ghost" onClick={() => setActiveChannelRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : client && activeStreamChannel && activePatient ? (
          <div className="stream-chat-shell">
            <Chat client={client} theme="str-chat__theme-light">
              <Channel channel={activeStreamChannel}>
                <div className="chat-thread stream-chat-thread">
                  <div className="chat-thread-hdr">
                    <Avatar initials={activePatient.initials} name={activePatient.name} size="md" online />
                    <div>
                      <div className="name">{activePatient.name}</div>
                      <div className="sub">
                        <span style={{ color: "#3FA871" }}>Stream connected</span>
                        <span className="dot-sep" />
                        <span>{[activePatient.age, activePatient.sex, activePatient.conditions?.[0] || "Rx patient"].filter(Boolean).join(" · ")}</span>
                      </div>
                    </div>
                    <div className="right">
                      <button className="icon-btn" title="Voice call">{I.phone}</button>
                      <button className="icon-btn" title="Video call">{I.video}</button>
                      <button className="icon-btn" onClick={() => onOpenPatient(activePatient.id)} title="Open chart">{I.user}</button>
                      <button className="icon-btn">{I.more}</button>
                    </div>
                  </div>

                  <Window>
                    <MessageList />
                    <MessageComposer focus />
                  </Window>
                  <Thread />
                </div>
              </Channel>
            </Chat>
          </div>
        ) : activeChannelLoading ? (
          <div className="empty-state">Opening conversation...</div>
        ) : (
          <div className="empty-state">Select a conversation to open chat.</div>
        )}

        {activePatient && (
          <ChatPatientSide patient={activePatient} sharedFiles={patientContext?.shared_files || []} onOpenPatient={onOpenPatient} />
        )}
      </div>
    </>
  );
}

function ChatPatientSide({ patient, sharedFiles, onOpenPatient }) {
  const { I, Avatar } = window.DD_UI;
  return (
    <div className="chat-side dd-scroll">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 22 }}>
        <Avatar initials={patient.initials} name={patient.name} size="xl" />
        <div style={{ font: "400 18px/1.2 var(--dd-font)", marginTop: 12 }}>{patient.name}</div>
        <div style={{ font: "400 13px/1.4 var(--dd-font)", color: "var(--dd-text-secondary)", marginTop: 4 }}>
          {[patient.age, patient.sex].filter(Boolean).join(" · ")}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn-ghost" style={{ padding: "8px 14px" }} onClick={() => onOpenPatient(patient.id)}>Open chart</button>
        </div>
      </div>

      <h4>Active conditions</h4>
      <div>{patient.conditions?.length ? patient.conditions.map((c, i) => <span key={i} className="tag">{c}</span>) : <div className="inline-empty">No active conditions reported.</div>}</div>

      <h4>Allergies</h4>
      <div>{patient.allergies?.length ? patient.allergies.map((a, i) => <span key={i} className="tag warn">{I.warn}<span style={{ marginLeft: 6 }}>{a}</span></span>) : <div className="inline-empty">No allergies reported.</div>}</div>

      <h4>Current medications</h4>
      {patient.medications?.length ? patient.medications.map((m, i) => (
        <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--dd-divider)" }}>
          <div style={{ font: "400 14px/1.3 var(--dd-font)" }}>{m.name}</div>
          {m.schedule && <div style={{ font: "400 12px/1.4 var(--dd-font)", color: "var(--dd-text-secondary)", marginTop: 2 }}>{m.schedule}</div>}
        </div>
      )) : <div className="inline-empty">No active Rx medications.</div>}

      <h4>Shared files</h4>
      {sharedFiles.length ? (
        <div className="attach-grid">
          {sharedFiles.map((file) => <div key={file.id || file.url} className="a">{file.name}<div className="ext">{file.type || "File"}</div></div>)}
        </div>
      ) : <div className="inline-empty">No shared files.</div>}
    </div>
  );
}

window.DD_ChatView = ChatView;
