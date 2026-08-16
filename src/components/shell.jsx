import * as React from "react";
import { doctorChatPushRecovery } from "../lib/doctorChatPush.js";
import {
  BookOpenCheck,
  Bell,
  BellOff,
  CalendarCheck2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Droplet,
  FlaskConical,
  House,
  ListFilter,
  LogOut,
  MapPin,
  MessageSquareText,
  Mic,
  Minus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Phone,
  Pill,
  Plus,
  Printer,
  Search,
  SendHorizontal,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react";

/* global React */
// Reusable bits — icons (lucide-style strokes), avatar, sidebar.

const { useState, useEffect, useRef, useMemo } = React;

// ============================================================
// Icons
// ============================================================
const Icon = ({ d, size = 18, fill = "none", stroke = "currentColor", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const L = (IconComponent, size = 18) => <IconComponent size={size} strokeWidth={1.8} />;

const I = {
  calendar: L(CalendarCheck2),
  user: L(UsersRound),
  message: L(MessageSquareText),
  pill: L(Pill),
  search: L(Search),
  send: L(SendHorizontal),
  plus: L(Plus),
  minus: L(Minus),
  x: L(X),
  chevronRight: L(ChevronRight),
  chevronLeft: L(ChevronLeft),
  chevronDown: L(ChevronDown),
  panelLeftClose: L(PanelLeftClose, 16),
  panelLeftOpen: L(PanelLeftOpen, 16),
  phone: L(Phone),
  video: L(Video),
  home: L(House),
  paperclip: L(Paperclip),
  mic: L(Mic),
  check: L(Check),
  checks: L(CheckCheck),
  warn: L(TriangleAlert),
  filter: L(ListFilter),
  download: L(Download),
  printer: L(Printer),
  more: L(MoreHorizontal),
  pin: L(MapPin),
  fileText: L(FlaskConical),
  stethoscope: L(Stethoscope),
  shield: L(BookOpenCheck),
  shieldCheck: L(ShieldCheck),
  bell: L(Bell),
  bellOff: L(BellOff),
  logOut: L(LogOut),
  drop: L(Droplet),
  dot: <Circle size={12} fill="currentColor" strokeWidth={0} />,
};

// ============================================================
// Avatar
// ============================================================
function Avatar({ initials, name, size = "md", online, tone = "neutral" }) {
  const cls = ["avatar", size === "lg" ? "lg" : size === "xl" ? "xl" : size === "sm" ? "sm" : ""].filter(Boolean).join(" ");
  // Subtle colour variety per name (deterministic), but tan-toned
  const palette = [
    { bg: "#F2E6D2", fg: "#173B3D" },
    { bg: "#E5DACA", fg: "#173B3D" },
    { bg: "#EFE5D5", fg: "#173B3D" },
    { bg: "#F7EEE0", fg: "#173B3D" },
  ];
  const idx = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  const c = tone === "inverse" ? { bg: "#173B3D", fg: "#FEF9EF" } : palette[idx];
  if (online) {
    return (
      <span className="avatar-wrap">
        <span className={cls + " online"} style={{ background: c.bg, color: c.fg, position: "relative" }}>
          {initials}
        </span>
      </span>
    );
  }
  return <span className={cls} style={{ background: c.bg, color: c.fg }}>{initials}</span>;
}

// ============================================================
// Sidebar
// ============================================================
function Sidebar({
  active,
  onNav,
  appointmentCount,
  clinicalInboxCount,
  clinicalInboxBreakdown,
  unreadChats,
  activeInboxCategory,
  onOpenInboxCategory,
  notificationState,
  notificationLabel,
  notificationDisabled,
  onToggleNotification,
  onCheckNotification,
  rating,
  doctorEmail,
  onSignOut,
}) {
  const items = [
    { id: "appointments", label: "Schedule", icon: I.calendar, count: appointmentCount },
    { id: "clinical-inbox", label: "Clinical inbox", icon: I.shieldCheck, count: clinicalInboxCount, urgent: true },
    { id: "patient-hub", label: "Patient hub", icon: I.message, count: unreadChats },
  ];
  const D = window.DD_DATA.DOCTOR;
  const alertRecovery = doctorChatPushRecovery(notificationState);
  const storageKey = `dd-sidebar-collapsed:${D.accountId || D.doctorId || "doctor"}`;
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(storageKey) === "1");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
  }, [collapsed, storageKey]);

  useEffect(() => {
    if (!accountOpen) return undefined;
    const close = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [accountOpen]);

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-brand">
        <img src="assets/logo-dardoc-teal.svg" alt="DarDoc" />
        <button type="button" className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? I.panelLeftOpen : I.panelLeftClose}
        </button>
      </div>

      <div className="nav-section-label">Workspace</div>
      {items.map((it) => (
        <React.Fragment key={it.id}>
          <button
               type="button"
               className={"nav-item" + (active === it.id ? " active" : "")}
               aria-current={active === it.id && !activeInboxCategory ? "page" : undefined}
               aria-label={it.label}
               title={collapsed ? it.label : undefined}
               onClick={() => onNav(it.id)}>
            {it.icon}
            <span className="nav-label">{it.label}</span>
            {it.count != null && it.count > 0 ? (
              <span className={"count" + (it.urgent ? " urgent" : "")}>{it.count}</span>
            ) : null}
          </button>
          {it.id === "clinical-inbox" && clinicalInboxBreakdown ? (
            <div className="sidebar-inbox-shortcuts" aria-label="Clinical inbox shortcuts">
              <button
                type="button"
                className={activeInboxCategory === "message_needs_response" ? "active" : ""}
                aria-current={activeInboxCategory === "message_needs_response" ? "page" : undefined}
                onClick={() => onOpenInboxCategory?.("message_needs_response")}
              >
                <span>Needs reply</span><strong>{clinicalInboxBreakdown.needsReply}</strong>
              </button>
              <button
                type="button"
                className={activeInboxCategory === "refill_review" ? "active" : ""}
                aria-current={activeInboxCategory === "refill_review" ? "page" : undefined}
                onClick={() => onOpenInboxCategory?.("refill_review")}
              >
                <span>Refill review</span><strong>{clinicalInboxBreakdown.refillReview}</strong>
              </button>
            </div>
          ) : null}
        </React.Fragment>
      ))}

      <div className="sidebar-doctor" ref={accountRef}>
        <button type="button" className="sidebar-doctor-profile" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen} title={collapsed ? D.name : undefined}>
          <Avatar initials={D.initials} name={D.name} size="md" tone="inverse" />
          <div className="sidebar-doctor-copy">
            <div>{D.name}</div>
            <span>{rating ? `★ ${rating.average.toFixed(1)}` : D.title}</span>
          </div>
          <span className="sidebar-account-more">{I.more}</span>
        </button>
        {accountOpen ? (
          <div className="sidebar-account-menu">
            <div className="sidebar-account-identity">
              <strong>{D.name}</strong>
              {doctorEmail || D.email ? <span>{doctorEmail || D.email}</span> : null}
              <small>{D.title}</small>
              {rating ? <em><span aria-hidden="true">★</span>{rating.average.toFixed(2)}</em> : null}
            </div>
            <div className="sidebar-account-divider" />
            <button
              type="button"
              className={"doctor-alert-toggle" + (notificationState === "on" ? " active" : "")}
              disabled={notificationDisabled}
              onClick={onToggleNotification}
              title={notificationState === "blocked" ? "Allow notifications in your browser settings" : notificationLabel}
            >
              <span className="doctor-alert-label">{notificationState === "blocked" ? I.bellOff : I.bell}<span>Dashboard alerts</span></span>
              <span className="doctor-alert-control">
                <span>{notificationLabel}</span>
                <span className="doctor-alert-track"><span /></span>
              </span>
            </button>
            {alertRecovery ? (
              <div className="doctor-alert-help" role="status">
                <strong>{alertRecovery.title}</strong>
                <p>{alertRecovery.detail}</p>
                <button type="button" onClick={onCheckNotification} disabled={!onCheckNotification}>{alertRecovery.action}</button>
              </div>
            ) : null}
            <div className="sidebar-account-divider" />
            <button type="button" className="sidebar-signout" disabled={!onSignOut} onClick={onSignOut}>{I.logOut}<span>Sign out</span></button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

// ============================================================
// Topbar
// ============================================================
function Topbar({ title, subtitle, right, search, onSearch, searchPlaceholder = "Search patients, drugs, notes" }) {
  return (
    <div className="topbar">
      {(title || subtitle) ? (
        <div style={{ minWidth: 0, flex: 1 }}>
          {title && <h1>{title}</h1>}
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
      ) : <div style={{ minWidth: 0, flex: 1 }} />}
      {search != null && (
        <div className="search">
          {I.search}
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} />
        </div>
      )}
      {right}
    </div>
  );
}

window.DD_UI = { I, Icon, Avatar, Sidebar, Topbar };
