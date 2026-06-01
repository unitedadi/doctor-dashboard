import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { StreamChat } from "stream-chat";
import {
  Channel,
  ChannelList,
  Chat,
  MessageComposer,
  MessageList,
  Thread,
  Window,
  useChatContext,
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
    track_key: item.track_key || item.trackKey || "",
  };
}

function channelMemberPatient(channel, currentUserId) {
  const members = Object.values(channel?.state?.members || {})
    .map((member) => member.user)
    .filter(Boolean);
  return members.find((user) => {
    const text = `${user.id || ""} ${user.name || ""}`.toLowerCase();
    return user.id !== currentUserId && !text.includes("doctor") && !text.includes("dardoc");
  }) || members.find((user) => user.id !== currentUserId);
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findChannelPatient(channel, currentUserId, patientDirectory = []) {
  const data = channel?.data || {};
  const memberPatient = channelMemberPatient(channel, currentUserId);
  const channelText = `${channel?.id || ""} ${channel?.cid || ""}`.toLowerCase();
  const dataPatient = data.patient && typeof data.patient === "object" ? data.patient : null;
  const patientId = data.patient_id || data.patientId || dataPatient?.id;
  const customerId = data.customer_id || data.customerId || dataPatient?.customer_id;

  const match = patientDirectory.find((patient) => {
    const name = normalizeName(patient.name);
    const memberName = normalizeName(memberPatient?.name);
    return (
      patient.id === patientId ||
      patient.customer_id === customerId ||
      patient.customer_id === memberPatient?.id ||
      (patient.customer_id && channelText.includes(String(patient.customer_id).toLowerCase())) ||
      (name && memberName && (name === memberName || name.includes(memberName) || memberName.includes(name)))
    );
  });
  return match || null;
}

function channelPatient(channel, currentUserId, patientDirectory = []) {
  const data = channel?.data || {};
  const memberPatient = channelMemberPatient(channel, currentUserId);
  const dataPatient = data.patient && typeof data.patient === "object" ? data.patient : null;
  const patientId = data.patient_id || data.patientId || dataPatient?.id;
  const customerId = data.customer_id || data.customerId || dataPatient?.customer_id;
  const match = findChannelPatient(channel, currentUserId, patientDirectory);
  if (match) return mapPatientForChannel(match);

  if (dataPatient) return mapPatientForChannel(dataPatient);

  return {
    id: patientId || "",
    customer_id: customerId || memberPatient?.id || "",
    name: memberPatient?.name || data.name || "Patient",
    initials: memberPatient?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "P",
    track_key: data.track_key || data.trackKey || "",
  };
}

function mapPrescribablePatient(item) {
  return {
    id: item.patient_id,
    customer_id: item.customer_id,
    name: item.name || "Unknown patient",
    initials: item.initials || "P",
    age: item.age,
    sex: titleCase(item.sex),
    track_key: item.track_key || "",
    can_prescribe: item.can_prescribe === true,
  };
}

function channelServiceName(channel, patientName) {
  const name = channel?.data?.name || "";
  return name && name !== patientName ? name : "Rx chat";
}

function latestMessage(channel) {
  const messages = channel?.state?.messages || [];
  return messages[messages.length - 1] || null;
}

function latestMessagePreview(channel, currentUserId) {
  const message = latestMessage(channel);
  if (!message) return "No messages yet";
  const author = message.user?.id === currentUserId ? "You" : message.user?.name || "Patient";
  const body = message.text || (message.attachments?.length ? "Attachment" : "Message");
  return `${author}: ${body}`;
}

function disabledReasonCopy(reason) {
  const copy = {
    completed_consultation_not_found: "Completed consultation required",
    subscription_inactive: "Subscription inactive",
    track_not_found: "Rx track missing",
  };
  return copy[reason] || "Prescription not available";
}

function fetchChannelContext(channelId) {
  return fetchJson(`${API_BASE}/doctor/chat/channels/${encodeURIComponent(channelId)}/context?doctor_id=${DOCTOR_ID}`);
}

function formatChannelTime(channel) {
  const message = latestMessage(channel);
  const date = message?.created_at ? new Date(message.created_at) : channel?.data?.last_message_at ? new Date(channel.data.last_message_at) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const dubaiDay = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: "Asia/Dubai" });
  const today = dubaiDay.format(now);
  const value = dubaiDay.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (value === today) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dubai" }).format(date);
  }
  if (value === dubaiDay.format(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Dubai" }).format(date);
}

function EmptyChatPanel() {
  return <div className="empty-state stream-chat-empty">Select a conversation to open chat.</div>;
}

function StreamChannelRows({ channels, patientDirectory }) {
  const { channel: activeChannel, client, setActiveChannel } = useChatContext("StreamChannelRows");

  return (
    <div className="stream-kit-row-list">
      {channels.map((item) => {
        const patientName = channelPatient(item, client.userID, patientDirectory).name;
        const unread = item.countUnread?.() || 0;
        const isActive = item.cid === activeChannel?.cid;

        return (
          <button
            key={item.cid}
            type="button"
            className={"stream-kit-row" + (isActive ? " active" : "") + (unread ? " unread" : "")}
            onClick={() => setActiveChannel(item)}
          >
            <span className="stream-kit-row-main">
              <span className="stream-kit-row-top">
                <span className="stream-kit-row-name">{patientName}</span>
                <span className="stream-kit-row-time">{formatChannelTime(item)}</span>
              </span>
              <span className="stream-kit-row-service">{channelServiceName(item, patientName)}</span>
              <span className="stream-kit-row-preview">{latestMessagePreview(item, client.userID)}</span>
            </span>
            {unread ? <span className="stream-kit-row-badge">{unread}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ClinicalChatHeader({ channel, context, contextLoading, contextError, fallbackPatient, prescribablePatient, onOpenPatient, onPrescribe }) {
  const contextPatient = context?.patient ? mapPatientForChannel({ ...context.patient, track_key: context.rx?.track_key }) : null;
  const patient = contextPatient || fallbackPatient;
  const patientId = prescribablePatient?.id || context?.actions?.prescribe_patient_id || patient?.id || channel?.data?.patient_id || channel?.data?.patientId;
  const chartPatientId = context?.patient?.id || patient?.id || channel?.data?.patient_id || channel?.data?.patientId;
  const patientCustomerId = prescribablePatient?.customer_id || context?.patient?.customer_id || patient?.customer_id || channel?.data?.customer_id || channel?.data?.customerId;
  const prescribeTrackKey = prescribablePatient?.track_key || context?.actions?.prescribe_track_key || context?.rx?.track_key || patient?.track_key || channel?.data?.track_key || channel?.data?.trackKey || "";
  const service = channelServiceName(channel, patient?.name);
  const meta = [
    patient?.age && `${patient.age}`,
    patient?.sex,
    context?.rx?.track_key || patient?.track_key || channel?.data?.track_key || channel?.data?.trackKey || service,
  ].filter(Boolean).join(" · ");
  const canOpenChart = context?.actions?.can_open_chart ?? Boolean(chartPatientId || patientCustomerId);
  const canPrescribe = context?.actions?.can_prescribe ?? Boolean(prescribablePatient?.can_prescribe);
  const prescribeDisabledReason = context?.rx?.can_prescribe_reason ? disabledReasonCopy(context.rx.can_prescribe_reason) : "Patient is not ready to prescribe";

  return (
    <div className="clinical-chat-header">
      <div className="clinical-chat-main">
        <div className="clinical-chat-eyebrow">{service}</div>
        <div className="clinical-chat-name">{patient?.name || "Patient"}</div>
        <div className="clinical-chat-meta">
          {contextLoading ? "Checking Rx eligibility..." : contextError ? "Patient context from chat" : meta || "Patient context from chat"}
        </div>
      </div>
      <div className="clinical-chat-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={!canOpenChart}
          title={canOpenChart ? "Open patient chart" : "Waiting for patient mapping from backend"}
          onClick={() => canOpenChart && onOpenPatient(chartPatientId, patientCustomerId)}
        >
          Patient chart
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canPrescribe}
          title={canPrescribe ? "Create or update prescription" : prescribeDisabledReason}
          onClick={() => canPrescribe && onPrescribe(patientId, prescribeTrackKey, patientCustomerId)}
        >
          Prescribe
        </button>
      </div>
    </div>
  );
}

function StreamConversation({ onOpenPatient, onPrescribe, patientDirectory, prescribableDirectory }) {
  const { channel, client } = useChatContext("StreamConversation");
  const fallbackPatient = channelPatient(channel, client.userID, patientDirectory);
  const directoryPrescribablePatient = findChannelPatient(channel, client.userID, prescribableDirectory);
  const [activePrescribablePatient, setActivePrescribablePatient] = useStateC(null);
  const [channelContext, setChannelContext] = useStateC(null);
  const [contextLoading, setContextLoading] = useStateC(false);
  const [contextError, setContextError] = useStateC("");

  const prescribablePatient = activePrescribablePatient || directoryPrescribablePatient;

  useEffectC(() => {
    let cancelled = false;
    const loadPrescribablePatient = async () => {
      if (!channel?.id) {
        setActivePrescribablePatient(null);
        return;
      }
      try {
        const data = await fetchJson(`${API_BASE}/doctor/rx/prescribable-patients?doctor_id=${DOCTOR_ID}&limit=100&offset=0`);
        const mappedPatients = (data.patients || []).map(mapPrescribablePatient);
        if (!cancelled) setActivePrescribablePatient(findChannelPatient(channel, client.userID, mappedPatients) || null);
      } catch {
        if (!cancelled) setActivePrescribablePatient(null);
      }
    };

    loadPrescribablePatient();
    return () => { cancelled = true; };
  }, [channel?.id, client.userID]);

  useEffectC(() => {
    let cancelled = false;
    const loadContext = async () => {
      if (!channel?.id) {
        setChannelContext(null);
        setContextError("");
        return;
      }
      setContextLoading(true);
      setContextError("");
      try {
        const data = await fetchChannelContext(channel.id);
        if (!cancelled) setChannelContext(data);
      } catch (err) {
        if (!cancelled) {
          setChannelContext(null);
          setContextError(err.message || "channel_context_unavailable");
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    };

    loadContext();
    return () => { cancelled = true; };
  }, [channel?.id]);

  if (!channel) return <EmptyChatPanel />;

  return (
    <div className="stream-kit-conversation">
      <Channel channel={channel}>
        <Window>
          <div className="stream-kit-header">
            <ClinicalChatHeader
              channel={channel}
              context={channelContext}
              contextError={contextError}
              contextLoading={contextLoading}
              fallbackPatient={fallbackPatient}
              onOpenPatient={onOpenPatient}
              onPrescribe={onPrescribe}
              prescribablePatient={prescribablePatient}
            />
          </div>
          <MessageList />
          <MessageComposer focus />
        </Window>
        <Thread />
      </Channel>
    </div>
  );
}

function ChatView({ initialPatientId, onOpenPatient, onPrescribe }) {
  const { Topbar } = window.DD_UI;
  const [client, setClient] = useStateC(null);
  const [initialChannelId, setInitialChannelId] = useStateC("");
  const [patientDirectory, setPatientDirectory] = useStateC([]);
  const [prescribableDirectory, setPrescribableDirectory] = useStateC([]);
  const [loading, setLoading] = useStateC(true);
  const [error, setError] = useStateC("");
  const loadIdRef = React.useRef(0);

  const loadChat = React.useCallback(async () => {
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    setLoading(true);
    setError("");
    try {
      const token = await fetchChatToken();
      const streamClient = new StreamChat(token.api_key, { timeout: 15000 });

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

      const patientsPayload = await fetchJson(`${API_BASE}/doctor/dashboard/patients?doctor_id=${DOCTOR_ID}`).catch(() => ({ patients: [] }));
      const patients = patientsPayload.patients || [];
      setPatientDirectory(patients);
      const prescribablePayload = await fetchJson(`${API_BASE}/doctor/rx/prescribable-patients?doctor_id=${DOCTOR_ID}&limit=100&offset=0`).catch(() => ({ patients: [] }));
      setPrescribableDirectory((prescribablePayload.patients || []).map(mapPrescribablePatient));

      if (initialPatientId) {
        const patient = patients.find((item) => item.id === initialPatientId);
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
          setInitialChannelId(opened.channel_id || "");

          const createdChannel = streamClient.channel(opened.channel_type, opened.channel_id, {
            name: patient.name,
            patient_id: patient.id,
            patient: mapPatientForChannel(patient),
          });
          await createdChannel.watch().catch(() => {});
        }
      }

      if (loadId !== loadIdRef.current) {
        await streamClient.disconnectUser().catch(() => {});
        return null;
      }

      setClient(streamClient);
      return streamClient;
    } catch (err) {
      if (loadId === loadIdRef.current) setError(err.message || "Could not connect GetStream chat.");
      return null;
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, [initialPatientId]);

  useEffectC(() => {
    let connectedClient = null;
    let cancelled = false;

    loadChat().then((streamClient) => {
      if (!cancelled) connectedClient = streamClient;
      else if (streamClient) streamClient.disconnectUser().catch(() => {});
    });

    return () => {
      cancelled = true;
      loadIdRef.current += 1;
      if (connectedClient) connectedClient.disconnectUser().catch(() => {});
    };
  }, [loadChat]);

  const channelFilters = useMemoC(() => {
    if (!client?.userID) return {};
    return {
      type: "messaging",
      members: { $in: [client.userID] },
    };
  }, [client]);

  const channelSort = useMemoC(() => ({ last_message_at: -1 }), []);
  const channelOptions = useMemoC(() => ({ limit: 30, presence: true, state: true, watch: true }), []);
  const renderChannels = React.useCallback((channels) => <StreamChannelRows channels={channels} patientDirectory={patientDirectory} />, [patientDirectory]);

  return (
    <>
      <Topbar
        title="Messages"
        subtitle={loading ? "Connecting to GetStream" : "Powered by GetStream"}
      />

      {error && (
        <div className="api-state chat-api-state">
          <span>{error}</span>
          <button type="button" className="btn-ghost" onClick={loadChat}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="empty-state stream-chat-empty">Connecting to GetStream...</div>
      ) : client ? (
        <div className="stream-chat-shell stream-chat-kit-shell">
          <Chat client={client} theme="str-chat__theme-light">
            <div className="stream-kit-layout">
              <div className="stream-kit-list">
                <ChannelList
                  customActiveChannel={initialChannelId || undefined}
                  filters={channelFilters}
                  options={channelOptions}
                  renderChannels={renderChannels}
                  setActiveChannelOnMount
                  showChannelSearch
                  sort={channelSort}
                />
              </div>
              <StreamConversation
                onOpenPatient={onOpenPatient}
                onPrescribe={onPrescribe}
                patientDirectory={patientDirectory}
                prescribableDirectory={prescribableDirectory}
              />
            </div>
          </Chat>
        </div>
      ) : (
        <EmptyChatPanel />
      )}
    </>
  );
}

window.DD_ChatView = ChatView;
