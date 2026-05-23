import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { StreamChat } from "stream-chat";
import {
  Channel,
  ChannelHeader,
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
  };
}

function channelPatientName(channel, currentUserId) {
  const members = Object.values(channel?.state?.members || {})
    .map((member) => member.user)
    .filter(Boolean);
  const patient = members.find((user) => {
    const text = `${user.id || ""} ${user.name || ""}`.toLowerCase();
    return user.id !== currentUserId && !text.includes("doctor") && !text.includes("dardoc");
  }) || members.find((user) => user.id !== currentUserId);

  return patient?.name || channel?.data?.name || "Patient";
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

function StreamChannelRows({ channels }) {
  const { channel: activeChannel, client, setActiveChannel } = useChatContext("StreamChannelRows");

  return (
    <div className="stream-kit-row-list">
      {channels.map((item) => {
        const patientName = channelPatientName(item, client.userID);
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

function StreamConversation({ onOpenPatient }) {
  const { channel } = useChatContext("StreamConversation");
  const patientId = channel?.data?.patient_id || channel?.data?.patientId;

  if (!channel) return <EmptyChatPanel />;

  return (
    <div className="stream-kit-conversation">
      <Channel channel={channel}>
        <Window>
          <div className="stream-kit-header">
            <ChannelHeader />
            {patientId && (
              <button type="button" className="btn-ghost stream-kit-chart-button" onClick={() => onOpenPatient(patientId)}>
                Open chart
              </button>
            )}
          </div>
          <MessageList />
          <MessageComposer focus />
        </Window>
        <Thread />
      </Channel>
    </div>
  );
}

function ChatView({ initialPatientId, onOpenPatient }) {
  const { Topbar } = window.DD_UI;
  const [client, setClient] = useStateC(null);
  const [initialChannelId, setInitialChannelId] = useStateC("");
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

      if (initialPatientId) {
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
  const renderChannels = React.useCallback((channels) => <StreamChannelRows channels={channels} />, []);

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
              <StreamConversation onOpenPatient={onOpenPatient} />
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
